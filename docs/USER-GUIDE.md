# User Guide — AIED Integrated School System

A short, non-technical walkthrough of how to use the app.

## 1. Creating an account

1. Open the app and click **Sign in / Get started** (route `/auth`).
2. Choose **Create account**, enter your full name, email and password, and pick your role:
   - **Student** — receives worksheets and AI tutoring.
   - **Teacher** — creates worksheets and monitors progress.
3. You can also use **Continue with Google**.
4. After signing in you are sent to your dashboard automatically:
   - Students → `/student`
   - Teachers → `/teacher`

> Note: email confirmation may be required depending on the project settings. If you cannot log in right after signing up, check your inbox.

## 2. Teachers

### Create a worksheet
1. Go to **Teacher dashboard** → **New worksheet** (`/teacher/worksheets/new`).
2. Fill in title, subject, topic and grade level.
3. Add questions one at a time. For each question you provide:
   - the question text,
   - optionally an **expected answer** (kept private — used only to help the AI grade).
4. Select the students who should receive it, then save. The worksheet is created and assigned in one step.

### Track progress
- `/teacher` — overview: number of students, active worksheets, and topics students struggle with most.
- `/teacher/worksheets/:id` — per-worksheet progress: who has answered what, correctness, and class-level insights (questions that many students got wrong or flagged as frustrating).
- `/teacher/students/:studentId` — one student's answers, AI feedback given, and the emotions they reported.

Use the struggle flags (frustrated/bored reports plus wrong answers) to decide who needs a follow-up.

## 3. Students

1. `/student` lists every assigned worksheet with a progress bar and due date.
2. Open a worksheet (`/student/assignment/:id`) to answer questions one by one.
3. For each question you can:
   - **Check my answer** — the AI tutor says whether you are on track and explains why, without giving the answer away.
   - **Give me a hint** — a nudge to get started.
   - **Report how you feel** — frustrated, bored, confident or excited. Your teacher sees this so they can help.
4. Answers and AI feedback are saved automatically, so you can leave and come back.

## 4. What the AI tutor will and will not do

- It never hands over the final answer.
- It gives one hint or a simpler related question when you are wrong.
- It praises and explains briefly when you are right.
- It adapts to the learning style saved on your profile, when set.

## 5. Troubleshooting

| Problem | What to do |
| --- | --- |
| "This worksheet is not assigned to you." | You opened another student's assignment link. Go back to `/student`. |
| "The tutor is busy right now." | AI rate limit — wait a few seconds and retry. |
| "AI credits have run out." | Ask the workspace admin to top up AI credits. |
| Signed in but on the wrong dashboard | Your role is set at signup; ask an admin to correct the role record. |
