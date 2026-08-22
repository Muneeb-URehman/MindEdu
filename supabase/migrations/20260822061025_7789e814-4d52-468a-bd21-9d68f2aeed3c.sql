CREATE TYPE public.app_role AS ENUM ('student','teacher','admin');
CREATE TYPE public.attempt_status AS ENUM ('saved','awaiting_feedback','submitted');
CREATE TYPE public.emotional_state AS ENUM ('frustrated','bored','confident','excited');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  learning_style TEXT,
  sen_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'teacher')) WITH CHECK (true);
CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  r := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role',''), 'student')::public.app_role;
  IF r = 'admin' THEN r := 'student'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  grade_level TEXT NOT NULL DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksheets TO authenticated;
GRANT ALL ON public.worksheets TO service_role;
ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID NOT NULL REFERENCES public.worksheets ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ,
  UNIQUE (worksheet_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  student_answer TEXT NOT NULL DEFAULT '',
  ai_feedback TEXT,
  is_correct BOOLEAN,
  status public.attempt_status NOT NULL DEFAULT 'saved',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_attempts TO authenticated;
GRANT ALL ON public.student_attempts TO service_role;
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  emotional_state public.emotional_state NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.student_feedback TO authenticated;
GRANT ALL ON public.student_feedback TO service_role;
ALTER TABLE public.student_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_assignment_worksheet(_assignment_id UUID, _teacher UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.worksheets w ON w.id = a.worksheet_id
    WHERE a.id = _assignment_id AND w.teacher_id = _teacher
  )
$$;

CREATE POLICY "teacher manages own worksheets" ON public.worksheets FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(),'teacher'));
CREATE POLICY "student reads assigned worksheets" ON public.worksheets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.worksheet_id = worksheets.id AND a.student_id = auth.uid()));

CREATE POLICY "teacher manages assignments" ON public.assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.worksheets w WHERE w.id = assignments.worksheet_id AND w.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.worksheets w WHERE w.id = assignments.worksheet_id AND w.teacher_id = auth.uid()));
CREATE POLICY "student reads own assignments" ON public.assignments FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "student manages own attempts" ON public.student_attempts FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "teacher reads attempts" ON public.student_attempts FOR SELECT TO authenticated
  USING (public.owns_assignment_worksheet(assignment_id, auth.uid()));

CREATE POLICY "student manages own emotions" ON public.student_feedback FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "teacher reads emotions" ON public.student_feedback FOR SELECT TO authenticated
  USING (public.owns_assignment_worksheet(assignment_id, auth.uid()));