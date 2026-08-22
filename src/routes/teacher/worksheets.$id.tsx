import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, RequireRole } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/teacher/worksheets/$id")({
  head: () => ({
    meta: [
      { title: "Worksheet progress — AIED" },
      { name: "description", content: "See who finished, how they scored, and how they felt." },
      { property: "og:title", content: "Worksheet progress — AIED" },
      { property: "og:description", content: "See who finished, how they scored, and how they felt." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireRole role="teacher">
        <WorksheetProgress />
      </RequireRole>
    </AppShell>
  ),
});

type Question = { question_id: string; text: string };

function WorksheetProgress() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["worksheet-progress", id],
    queryFn: async () => {
      const { data: worksheet, error } = await supabase
        .from("worksheets")
        .select("id, title, subject, topic, questions")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, student_id")
        .eq("worksheet_id", id);

      const assignmentIds = (assignments ?? []).map((a) => a.id);
      const studentIds = (assignments ?? []).map((a) => a.student_id);

      const [{ data: attempts }, { data: emotions }, { data: profiles }, { data: roles }] =
        await Promise.all([
          assignmentIds.length
            ? supabase
                .from("student_attempts")
                .select("assignment_id, question_id, is_correct, status")
                .in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [] as never[] }),
          assignmentIds.length
            ? supabase
                .from("student_feedback")
                .select("assignment_id, question_id, emotional_state")
                .in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [] as never[] }),
          studentIds.length
            ? supabase.from("profiles").select("id, full_name").in("id", studentIds)
            : Promise.resolve({ data: [] as never[] }),
          supabase.from("user_roles").select("user_id").eq("role", "student"),
        ]);

      const { data: allProfiles } = await supabase.from("profiles").select("id, full_name");
      const studentRoster = (roles ?? [])
        .map((r) => (allProfiles ?? []).find((p) => p.id === r.user_id))
        .filter(Boolean) as { id: string; full_name: string }[];

      return {
        worksheet,
        assignments: assignments ?? [],
        attempts: attempts ?? [],
        emotions: emotions ?? [],
        profiles: profiles ?? [],
        roster: studentRoster,
      };
    },
  });

  const assignMore = async () => {
    if (!assigning.length) return;
    const { error } = await supabase
      .from("assignments")
      .insert(assigning.map((student_id) => ({ worksheet_id: id, student_id })));
    if (error) toast.error(error.message);
    else {
      toast.success("Assigned!");
      setAssigning([]);
      queryClient.invalidateQueries({ queryKey: ["worksheet-progress", id] });
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!data?.worksheet) return <p className="text-muted-foreground">Worksheet not found.</p>;

  const questions = (data.worksheet.questions as unknown as Question[]) ?? [];
  const unassigned = data.roster.filter(
    (s) => !data.assignments.some((a) => a.student_id === s.id),
  );

  return (
    <div>
      <Link to="/teacher" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{data.worksheet.title}</h1>
        <Badge variant="secondary">{data.worksheet.subject}</Badge>
        <span className="text-sm text-muted-foreground">{data.worksheet.topic}</span>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Student progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not assigned to anyone yet.</p>
          ) : (
            data.assignments.map((a) => {
              const name =
                data.profiles.find((p) => p.id === a.student_id)?.full_name ?? "Student";
              const rows = data.attempts.filter((t) => t.assignment_id === a.id);
              const done = rows.filter((t) => t.status === "submitted").length;
              const correct = rows.filter((t) => t.is_correct === true).length;
              const flags = data.emotions.filter(
                (e) =>
                  e.assignment_id === a.id &&
                  (e.emotional_state === "frustrated" || e.emotional_state === "bored"),
              ).length;
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                >
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold">{name}</p>
                    <Progress
                      className="mt-2"
                      value={questions.length ? (done / questions.length) * 100 : 0}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {done}/{questions.length} answered · {correct} correct
                      {flags ? ` · ${flags} struggle flags` : ""}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/teacher/students/$studentId" params={{ studentId: a.student_id }}>
                      View details
                    </Link>
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Class insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions in this worksheet.</p>
          ) : (
            questions.map((q, i) => {
              const negative = data.emotions.filter(
                (e) =>
                  e.question_id === q.question_id &&
                  (e.emotional_state === "frustrated" || e.emotional_state === "bored"),
              ).length;
              const total = data.assignments.length || 1;
              const pct = Math.round((negative / total) * 100);
              return (
                <div key={q.question_id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">
                    Q{i + 1}. {q.text}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pct}% of assigned students flagged this as frustrating or boring.
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {unassigned.length ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Assign to more students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unassigned.map((s) => (
              <label key={s.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={assigning.includes(s.id)}
                  onCheckedChange={(checked) =>
                    setAssigning((prev) =>
                      checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                    )
                  }
                />
                {s.full_name || "Unnamed student"}
              </label>
            ))}
            <Button onClick={assignMore} disabled={!assigning.length}>
              <UserPlus className="size-4" /> Assign selected
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
