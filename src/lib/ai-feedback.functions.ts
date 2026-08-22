import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const FeedbackInput = z.object({
  assignmentId: z.string().uuid(),
  questionId: z.string().min(1),
  answer: z.string().max(4000),
  mode: z.enum(["check", "hint"]),
});

type Question = {
  question_id: string;
  text: string;
  type?: string;
  expected_answer?: string;
};

export type AiFeedback = {
  is_correct: boolean | null;
  feedback_message: string;
  suggested_next_step: string;
};

export const requestAiFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FeedbackInput.parse(input))
  .handler(async ({ data, context }): Promise<AiFeedback> => {
    const { supabase, userId } = context;

    const { data: assignment, error: assignmentError } = await supabase
      .from("assignments")
      .select("id, student_id, worksheet:worksheets(subject, topic, grade_level, questions)")
      .eq("id", data.assignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error(assignmentError.message);
    if (!assignment || assignment.student_id !== userId) {
      throw new Error("This worksheet is not assigned to you.");
    }

    const worksheet = assignment.worksheet as unknown as {
      subject: string;
      topic: string;
      grade_level: string;
      questions: Question[];
    };
    const question = (worksheet?.questions ?? []).find((q) => q.question_id === data.questionId);
    if (!question) throw new Error("Question not found.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("learning_style")
      .eq("id", userId)
      .maybeSingle();

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");

    const systemPrompt = [
      `You are a patient, encouraging tutor for a student${worksheet.grade_level ? ` in ${worksheet.grade_level}` : ""}.`,
      `The topic is ${worksheet.subject || "General"} - ${worksheet.topic || "this worksheet"}.`,
      "Never give the final answer directly. If the student is wrong, guide them with one hint or a simpler related question.",
      "If they are right, praise the effort and briefly explain why it is correct.",
      profile?.learning_style
        ? `The student's stated learning style is "${profile.learning_style}". Tailor your explanation accordingly.`
        : "",
      "Keep the message under 70 words, warm and age-appropriate.",
      'Reply ONLY with JSON: {"is_correct": boolean|null, "feedback_message": string, "suggested_next_step": string}.',
    ]
      .filter(Boolean)
      .join(" ");

    const userPrompt =
      data.mode === "hint"
        ? `Question: ${question.text}\nStudent's work so far: ${data.answer || "(nothing yet)"}\nTask: Give a hint that helps them start, without the answer. Set is_correct to null.`
        : `Question: ${question.text}\nStudent's Answer: ${data.answer}\n${
            question.expected_answer ? `Teacher's expected answer (private): ${question.expected_answer}\n` : ""
          }Task: Provide feedback on the student's work following your instructions.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("The tutor is busy right now. Please try again in a moment.");
      if (response.status === 402)
        throw new Error("AI credits have run out. Please ask your school admin to top up the workspace.");
      const detail = await response.text();
      console.error("AI gateway error", response.status, detail);
      throw new Error("The AI tutor could not answer right now.");
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";

    let parsed: AiFeedback;
    try {
      const json = JSON.parse(raw) as Partial<AiFeedback>;
      parsed = {
        is_correct: typeof json.is_correct === "boolean" ? json.is_correct : null,
        feedback_message: json.feedback_message ?? "Let's look at this together.",
        suggested_next_step: json.suggested_next_step ?? "",
      };
    } catch {
      parsed = { is_correct: null, feedback_message: raw.slice(0, 500), suggested_next_step: "" };
    }

    if (data.mode === "hint") parsed.is_correct = null;

    const { error: saveError } = await supabase.from("student_attempts").upsert(
      {
        assignment_id: data.assignmentId,
        student_id: userId,
        question_id: data.questionId,
        student_answer: data.answer,
        ai_feedback: parsed.feedback_message,
        is_correct: parsed.is_correct,
        status: data.mode === "hint" ? "saved" : "submitted",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,question_id" },
    );
    if (saveError) console.error("Failed to save attempt", saveError.message);

    return parsed;
  });
