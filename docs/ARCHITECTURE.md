# Architecture

## Stack

- **TanStack Start v1** (React 19 + Vite 7) with file-based routing in `src/routes`.
- **Tailwind CSS v4** configured through `src/styles.css` (design tokens in `@theme`).
- **Lovable Cloud backend** (Postgres + auth + row level security).
- **Lovable AI Gateway** (`google/gemini-3.7-flash`) for tutor feedback.

## Directory map

```
src/
  routes/
    __root.tsx                     app shell: fonts, AuthProvider, Toaster, <Outlet/>
    index.tsx                      public landing page
    auth.tsx                       sign in / sign up (email + Google), role picker
    student/index.tsx              student dashboard (assignments + progress)
    student/assignment.$id.tsx     worksheet player: answers, AI feedback, mood
    teacher/index.tsx              teacher overview + struggle topics
    teacher/worksheets.new.tsx     worksheet builder + assignment
    teacher/worksheets.$id.tsx     per-worksheet class progress
    teacher/students.$studentId.tsx per-student detail
  components/AppShell.tsx          shared nav + <RequireRole> guard
  components/ui/*                  shadcn primitives
  hooks/useAuth.tsx                session, role and profile context
  lib/ai-feedback.functions.ts     server function calling the AI gateway
  integrations/supabase/*          generated client, types, auth middleware
```

## Data model

| Table | Purpose | Key columns |
| --- | --- | --- |
| `profiles` | One row per user | `id` (= auth user id), `full_name`, `learning_style`, `sen_notes` |
| `user_roles` | Roles kept off the profile table on purpose | `user_id`, `role` (`student`/`teacher`/`admin`) |
| `worksheets` | Teacher-authored content | `teacher_id`, `title`, `subject`, `topic`, `grade_level`, `questions` (JSONB) |
| `assignments` | Worksheet → student link | `worksheet_id`, `student_id`, `due_date` |
| `student_attempts` | Answers + AI feedback | `assignment_id`, `question_id`, `student_answer`, `ai_feedback`, `is_correct`, `status` |
| `student_feedback` | Emoji mood per question | `assignment_id`, `question_id`, `emotional_state` |

`questions` JSONB shape:

```json
[{ "question_id": "q1", "text": "What is 7 × 8?", "type": "short_answer", "expected_answer": "56" }]
```

### Access control

- Roles live in `user_roles` and are checked by the security-definer function `has_role(uuid, app_role)`; never read roles from client state for authorization.
- `owns_assignment_worksheet(_assignment_id, _teacher)` lets teachers read attempts for worksheets they authored.
- RLS: students read/write only their own attempts, feedback and assignments; teachers manage only their own worksheets and the students assigned to them.

## AI feedback flow

1. Student clicks *Check my answer* or *Give me a hint*.
2. The client calls the server function `requestAiFeedback` (`src/lib/ai-feedback.functions.ts`).
3. `requireSupabaseAuth` middleware verifies the bearer token; the handler re-checks that the assignment belongs to the caller.
4. The handler builds a tutoring system prompt (grade level, subject, learning style, "never reveal the answer") and calls the Lovable AI gateway with `response_format: json_object`.
5. Response `{ is_correct, feedback_message, suggested_next_step }` is upserted into `student_attempts` and returned to the UI.

Error mapping: HTTP 429 → "tutor is busy", 402 → "AI credits have run out".

## Auth flow

`AuthProvider` (`src/hooks/useAuth.tsx`) subscribes to auth state changes, then loads the user's role and profile. `RequireRole` in `AppShell.tsx` renders the child route only when the loaded role matches, redirecting otherwise. Server-side, protected server functions rely on the bearer token attached by the client-side function middleware registered in `src/start.ts`.
