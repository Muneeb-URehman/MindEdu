import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requestAiFeedback, type AiFeedback } from "@/lib/ai-feedback.functions";
import { AppShell, RequireRole } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/student/assignment/$id")({
  head: () => ({
    meta: [
      { title: "Worksheet — AIED" },
      { name: "description", content: "Answer questions and get instant AI tutor feedback." },
      { property: "og:title", content: "Worksheet — AIED" },
      { property: "og:description", content: "Answer questions and get instant AI tutor feedback." },
    ],
  }),
  component: () => (
    <AppShell>
      <RequireRole role="student">
        <WorksheetPlayer />
      </RequireRole>
    </AppShell>
  ),
});

type Question = { question_id: string; text: string; type?: string };

const emotions = [
  { key: "frustrated", label: "Frustrated", emoji: "😫" },
  { key: "bored", label: "Boring", emoji: "🥱" },
  { key: "confident", label: "Confident", emoji: "😀" },
  { key: "excited", label: "Excited", emoji: "🤩" },
] as const;

function WorksheetPlayer() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const askAi = useServerFn(requestAiFeedback);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [pending, setPending] = useState<"check" | "hint" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assignment", id, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: assignment, error } = await supabase
        .from("assignments")
        .select("id, worksheet:worksheets(title, subject, topic, questions)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;

      const { data: attempts } = await supabase
        .from("student_attempts")
        .select("question_id, student_answer, ai_feedback, is_correct, status")
        .eq("assignment_id", id);

      const worksheet = assignment?.worksheet as unknown as {
        title: string;
        subject: string;
        topic: string;
        questions: Question[];
      } | null;
      return { worksheet, attempts: attempts ?? [] };
    },
  });

  const questions = useMemo(() => data?.worksheet?.questions ?? [], [data]);
  const question = questions[index];
  const attempt = data?.attempts.find((a) => a.question_id === question?.question_id);

  useEffect(() => {
    setAnswer(attempt?.student_answer ?? "");
    setFeedback(
      attempt?.ai_feedback
        ? {
            is_correct: attempt.is_correct,
            feedback_message: attempt.ai_feedback,
            suggested_next_step: "",
          }
        : null,
    );
  }, [index, attempt?.question_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (mode: "check" | "hint") => {
    if (!question) return;
    if (mode === "check" && !answer.trim()) {
      toast.error("Write your answer first.");
      return;
    }
    setPending(mode);
    try {
      const result = await askAi({
        data: { assignmentId: id, questionId: question.question_id, answer, mode },
      });
      setFeedback(result);
      queryClient.invalidateQueries({ queryKey: ["assignment", id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  };

  const reportEmotion = async (state: (typeof emotions)[number]["key"]) => {
    if (!question || !user) return;
    const { error } = await supabase.from("student_feedback").insert({
      assignment_id: id,
      student_id: user.id,
      question_id: question.question_id,
      emotional_state: state,
    });
    if (error) toast.error(error.message);
    else toast.success("Thanks for telling us how you feel!");
  };

  if (isLoading) return <p className="text-muted-foreground">Loading worksheet…</p>;
  if (!data?.worksheet) return <p className="text-muted-foreground">Worksheet not found.</p>;
  if (!question) return <p className="text-muted-foreground">This worksheet has no questions yet.</p>;

  const done = data.attempts.filter((a) => a.status === "submitted").length;
  const tone =
    feedback?.is_correct === true
      ? "border-success/40 bg-success/10"
      : feedback?.is_correct === false
        ? "border-destructive/40 bg-destructive/10"
        : "border-warning/50 bg-warning/10";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/student" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to my worksheets
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{data.worksheet.title}</h1>
        <Badge variant="secondary">{data.worksheet.subject}</Badge>
      </div>
      <Progress className="mt-4" value={questions.length ? (done / questions.length) * 100 : 0} />

      <Card className="mt-6 shadow-soft">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Question {index + 1} of {questions.length}
          </p>
          <CardTitle className="text-xl leading-snug">{question.text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={5}
            className="text-base"
            placeholder="Write your answer here…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("check")} disabled={pending !== null}>
              {pending === "check" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Check my work
            </Button>
            <Button variant="outline" onClick={() => run("hint")} disabled={pending !== null}>
              {pending === "hint" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lightbulb className="size-4" />
              )}
              Need a hint?
            </Button>
          </div>

          {feedback ? (
            <div className={`rounded-xl border p-4 ${tone}`}>
              <p className="font-semibold">
                {feedback.is_correct === true
                  ? "Nice work!"
                  : feedback.is_correct === false
                    ? "Not quite — let's try again"
                    : "Here's a hint"}
              </p>
              <p className="mt-1 text-sm">{feedback.feedback_message}</p>
              {feedback.suggested_next_step ? (
                <p className="mt-2 text-sm text-muted-foreground">{feedback.suggested_next_step}</p>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How do you feel about this question?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {emotions.map((e) => (
                <Button
                  key={e.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => reportEmotion(e.key)}
                >
                  <span aria-hidden>{e.emoji}</span> {e.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-between">
        <Button
          variant="ghost"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ArrowLeft className="size-4" /> Previous
        </Button>
        <Button
          variant="ghost"
          disabled={index >= questions.length - 1}
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Next <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
