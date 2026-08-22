import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, RequireRole } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/teacher/worksheets/new")({
  head: () => ({
    meta: [
      { title: "Create worksheet — AIED" },
      { name: "description", content: "Build a worksheet and assign it to your students." },
      { property: "og:title", content: "Create worksheet — AIED" },
      { property: "og:description", content: "Build a worksheet and assign it to your students." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireRole role="teacher">
        <CreateWorksheet />
      </RequireRole>
    </AppShell>
  ),
});

type Draft = { text: string; expected_answer: string };

function CreateWorksheet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [questions, setQuestions] = useState<Draft[]>([{ text: "", expected_answer: "" }]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return profiles ?? [];
    },
  });

  const save = async () => {
    if (!user) return;
    const clean = questions.filter((q) => q.text.trim());
    if (!title.trim() || clean.length === 0) {
      toast.error("Add a title and at least one question.");
      return;
    }
    setSaving(true);
    const { data: worksheet, error } = await supabase
      .from("worksheets")
      .insert({
        teacher_id: user.id,
        title,
        subject,
        topic,
        grade_level: gradeLevel,
        questions: clean.map((q, i) => ({
          question_id: `q${i + 1}`,
          text: q.text.trim(),
          type: "text",
          expected_answer: q.expected_answer.trim() || undefined,
        })),
      })
      .select("id")
      .single();

    if (error || !worksheet) {
      setSaving(false);
      toast.error(error?.message ?? "Could not save the worksheet.");
      return;
    }

    if (selected.length) {
      const { error: assignError } = await supabase.from("assignments").insert(
        selected.map((student_id) => ({ worksheet_id: worksheet.id, student_id })),
      );
      if (assignError) toast.error(assignError.message);
    }

    setSaving(false);
    toast.success("Worksheet created!");
    navigate({ to: "/teacher/worksheets/$id", params: { id: worksheet.id } });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Create a worksheet</h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Maths"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              placeholder="Fractions"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">Grade level</Label>
            <Input
              id="grade"
              placeholder="Year 5"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Question {i + 1}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea
                className="mt-2"
                placeholder="What is 1/2 + 1/4?"
                value={q.text}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, idx) => (idx === i ? { ...item, text: e.target.value } : item)),
                  )
                }
              />
              <Input
                className="mt-2"
                placeholder="Expected answer (optional, kept private from students)"
                value={q.expected_answer}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, idx) =>
                      idx === i ? { ...item, expected_answer: e.target.value } : item,
                    ),
                  )
                }
              />
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => setQuestions((prev) => [...prev, { text: "", expected_answer: "" }])}
          >
            <Plus className="size-4" /> Add question
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Assign to students</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(students ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No student accounts yet.</p>
          ) : (
            students!.map((s) => (
              <label key={s.id} className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={(checked) =>
                    setSelected((prev) =>
                      checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                    )
                  }
                />
                {s.full_name || "Unnamed student"}
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/teacher" })}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          Save worksheet
        </Button>
      </div>
    </div>
  );
}
