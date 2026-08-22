import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Brain, HeartHandshake, LineChart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIED Integrated School System — AI worksheets for schools" },
      {
        name: "description",
        content:
          "Teachers create worksheets, students solve them with a patient AI tutor, and everyone gets instant, useful feedback.",
      },
      { property: "og:title", content: "AIED Integrated School System" },
      {
        property: "og:description",
        content:
          "Teachers create worksheets, students solve them with a patient AI tutor, and everyone gets instant feedback.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Brain,
    title: "Scaffolded AI feedback",
    body: "The tutor never hands over the answer — it nudges students with hints and guiding questions.",
  },
  {
    icon: HeartHandshake,
    title: "Feelings, not just scores",
    body: "Students tap an emoji when they feel stuck or bored, so teachers see struggle before it becomes failure.",
  },
  {
    icon: LineChart,
    title: "Teacher insight dashboard",
    body: "See completion, correctness, and the questions that frustrate a class the most.",
  },
];

function Index() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session && role) {
      navigate({ to: role === "teacher" ? "/teacher" : "/student", replace: true });
    }
  }, [loading, session, role, navigate]);

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-hero-gradient px-6 py-16 text-primary-foreground shadow-soft sm:px-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          <Sparkles className="size-3.5" /> AI in the classroom
        </span>
        <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
          Worksheets that answer back — kindly.
        </h1>
        <p className="mt-4 max-w-xl text-base opacity-90">
          A school platform where teachers assign worksheets, students get instant tutoring
          feedback, and progress and emotions are visible at a glance.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" variant="secondary" onClick={() => navigate({ to: "/auth" })}>
            Get started
          </Button>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="border-border/70">
            <CardContent className="pt-6">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
