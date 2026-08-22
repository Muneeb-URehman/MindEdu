import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Frown, Plus, Users, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, RequireRole } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/teacher/")({
  head: () => ({
    meta: [
      { title: "Teacher dashboard — AIED" },
      {
        name: "description",
        content: "Create worksheets, assign them to students, and track progress and class mood.",
      },
      { property: "og:title", content: "Teacher dashboard — AIED" },
      { property: "og:description", content: "Track worksheets, progress and class mood." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireRole role="teacher">
        <TeacherDashboard />
      </RequireRole>
    </AppShell>
  ),
});

function TeacherDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-overview", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: worksheets, error } = await supabase
        .from("worksheets")
        .select("id, title, subject, topic, questions, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: assignments } = await supabase.from("assignments").select("id, worksheet_id");
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      const { data: emotions } = await supabase
        .from("student_feedback")
        .select("assignment_id, emotional_state");

      const negative = (emotions ?? []).filter(
        (e) => e.emotional_state === "frustrated" || e.emotional_state === "bored",
      );
      const worksheetByAssignment = new Map((assignments ?? []).map((a) => [a.id, a.worksheet_id]));
      const counts = new Map<string, number>();
      negative.forEach((e) => {
        const wid = worksheetByAssignment.get(e.assignment_id);
        if (wid) counts.set(wid, (counts.get(wid) ?? 0) + 1);
      });
      const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topWorksheet = (worksheets ?? []).find((w) => w.id === topId);

      return {
        worksheets: worksheets ?? [],
        assignments: assignments ?? [],
        studentCount: studentRoles?.length ?? 0,
        hardestTopic: topWorksheet ? `${topWorksheet.topic || topWorksheet.title}` : "—",
      };
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Teacher dashboard</h1>
          <p className="mt-1 text-muted-foreground">Worksheets, progress and class mood.</p>
        </div>
        <Button asChild>
          <Link to="/teacher/worksheets/new">
            <Plus className="size-4" /> Create worksheet
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Students" value={String(data?.studentCount ?? 0)} />
        <StatCard icon={FileText} label="Worksheets created" value={String(data?.worksheets.length ?? 0)} />
        <StatCard icon={Frown} label="Most difficult topic" value={data?.hardestTopic ?? "—"} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>My worksheets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : data!.worksheets.length === 0 ? (
            <p className="text-muted-foreground">
              No worksheets yet. Create your first one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.worksheets.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.title}</TableCell>
                    <TableCell>{w.subject}</TableCell>
                    <TableCell>{(w.questions as unknown as unknown[])?.length ?? 0}</TableCell>
                    <TableCell>
                      {data!.assignments.filter((a) => a.worksheet_id === w.id).length} students
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/teacher/worksheets/$id" params={{ id: w.id }}>
                          View progress
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-center gap-4 pt-6">
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
