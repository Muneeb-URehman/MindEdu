import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, RequireRole } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/student/")({
  head: () => ({
    meta: [
      { title: "My worksheets — AIED" },
      { name: "description", content: "Your assigned worksheets and progress with the AI tutor." },
      { property: "og:title", content: "My worksheets — AIED" },
      { property: "og:description", content: "Your assigned worksheets and progress." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireRole role="student">
        <StudentDashboard />
      </RequireRole>
    </AppShell>
  ),
});

function StudentDashboard() {
  const { user, fullName } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["student-assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from("assignments")
        .select("id, due_date, worksheet:worksheets(id, title, subject, topic, questions)")
        .order("assigned_at", { ascending: false });
      if (error) throw error;

      const { data: attempts } = await supabase
        .from("student_attempts")
        .select("assignment_id, question_id, status");

      return (assignments ?? []).map((a) => {
        const worksheet = a.worksheet as unknown as {
          id: string;
          title: string;
          subject: string;
          topic: string;
          questions: { question_id: string }[];
        };
        const total = worksheet?.questions?.length ?? 0;
        const done = (attempts ?? []).filter(
          (t) => t.assignment_id === a.id && t.status === "submitted",
        ).length;
        return { id: a.id, due_date: a.due_date, worksheet, total, done };
      });
    },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold">Hi {fullName?.split(" ")[0] ?? "there"} 👋</h1>
      <p className="mt-1 text-muted-foreground">Pick a worksheet and let's learn together.</p>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading your worksheets…</p>
      ) : (data?.length ?? 0) === 0 ? (
        <Card className="mt-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            No worksheets assigned yet. Check back soon!
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((a) => {
            const pct = a.total ? Math.round((a.done / a.total) * 100) : 0;
            return (
              <Card key={a.id} className="flex flex-col shadow-soft">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{a.worksheet?.subject || "General"}</Badge>
                    {a.due_date ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="size-3" />
                        {new Date(a.due_date).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  <CardTitle className="mt-2 text-lg">{a.worksheet?.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{a.worksheet?.topic}</p>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground">
                    {a.done} of {a.total} questions done
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/student/assignment/$id" params={{ id: a.id }}>
                      <BookOpen className="size-4" />
                      {a.done === 0 ? "Start" : a.done === a.total ? "Review" : "Continue"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
