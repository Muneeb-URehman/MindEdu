import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, RequireRole } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/teacher/students/$studentId")({
  head: () => ({
    meta: [
      { title: "Student details — AIED" },
      { name: "description", content: "A student's answers, AI feedback and reported feelings." },
      { property: "og:title", content: "Student details — AIED" },
      { property: "og:description", content: "A student's answers, AI feedback and feelings." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireRole role="teacher">
        <StudentDetail />
      </RequireRole>
    </AppShell>
  ),
});

const emojiFor: Record<string, string> = {
  frustrated: "😫",
  bored: "🥱",
  confident: "😀",
  excited: "🤩",
};

function StudentDetail() {
  const { studentId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, learning_style, sen_notes")
        .eq("id", studentId)
        .maybeSingle();

      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, worksheet:worksheets(id, title, subject, questions)")
        .eq("student_id", studentId);

      const ids = (assignments ?? []).map((a) => a.id);
      const [{ data: attempts }, { data: emotions }] = await Promise.all([
        ids.length
          ? supabase
              .from("student_attempts")
              .select("assignment_id, question_id, student_answer, ai_feedback, is_correct, submitted_at")
              .in("assignment_id", ids)
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase
              .from("student_feedback")
              .select("assignment_id, question_id, emotional_state")
              .in("assignment_id", ids)
          : Promise.resolve({ data: [] as never[] }),
      ]);

      return {
        profile,
        assignments: assignments ?? [],
        attempts: attempts ?? [],
        emotions: emotions ?? [],
      };
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div>
      <Link to="/teacher" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-bold">{data?.profile?.full_name ?? "Student"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Learning style: {data?.profile?.learning_style || "not set"}
      </p>

      <div className="mt-6 space-y-6">
        {data!.assignments.map((a) => {
          const worksheet = a.worksheet as unknown as {
            title: string;
            subject: string;
            questions: { question_id: string; text: string }[];
          };
          return (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{worksheet?.title}</CardTitle>
                  <Badge variant="secondary">{worksheet?.subject}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(worksheet?.questions ?? []).map((q, i) => {
                  const attempt = data!.attempts.find(
                    (t) => t.assignment_id === a.id && t.question_id === q.question_id,
                  );
                  const feelings = data!.emotions.filter(
                    (e) => e.assignment_id === a.id && e.question_id === q.question_id,
                  );
                  return (
                    <div key={q.question_id} className="rounded-xl border border-border p-4">
                      <p className="text-sm font-semibold">
                        Q{i + 1}. {q.text}
                      </p>
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">Answer: </span>
                        {attempt?.student_answer || "— not answered —"}
                      </p>
                      {attempt?.ai_feedback ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          AI feedback: {attempt.ai_feedback}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {attempt?.is_correct === true ? (
                          <Badge className="bg-success text-success-foreground">Correct</Badge>
                        ) : attempt?.is_correct === false ? (
                          <Badge variant="destructive">Needs work</Badge>
                        ) : null}
                        {feelings.map((f, idx) => (
                          <span key={idx} className="text-lg" title={f.emotional_state}>
                            {emojiFor[f.emotional_state]}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
        {data!.assignments.length === 0 ? (
          <p className="text-muted-foreground">No worksheets assigned to this student yet.</p>
        ) : null}
      </div>
    </div>
  );
}
