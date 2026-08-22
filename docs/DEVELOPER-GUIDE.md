# Developer Guide

## Running locally

```sh
npm i
npm run dev      # http://localhost:8080
```

Environment variables for the backend URL and publishable key are generated into `.env` — do not edit them by hand. `LOVABLE_API_KEY` is injected on the server and is required by the AI tutor.

## Adding a page

1. Create a file in `src/routes` — the path maps to the URL (`teacher/reports.tsx` → `/teacher/reports`). Never edit `src/routeTree.gen.ts`.
2. Export a route with `createFileRoute`, include a `head()` with a unique title/description, and wrap protected content in `<RequireRole role="teacher">`.

```tsx
export const Route = createFileRoute('/teacher/reports')({
  head: () => ({ meta: [{ title: 'Reports · AIED' }] }),
  component: Reports,
})
```

## Reading and writing data

Client-side reads use the generated client and run under RLS as the signed-in user:

```ts
import { supabase } from '@/integrations/supabase/client'
const { data } = await supabase.from('worksheets').select('*').order('created_at', { ascending: false })
```

Anything that needs a secret (AI keys, cross-user checks) belongs in a server function:

```ts
export const doThing = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data, context }) => { /* context.supabase, context.userId */ })
```

Rules that matter here:
- Files declaring `createServerFn` must contain only imports, types and the exported functions.
- Never call a `requireSupabaseAuth` server function from a public route loader — call it from a component (`useServerFn` + `useQuery`).

## Changing the schema

Write a migration that, for every new public table, does: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`. Store roles only in `user_roles` and check them with `has_role()` inside policies. After a migration, `src/integrations/supabase/types.ts` is regenerated — don't edit it manually.

## Styling

All colors, gradients and shadows are semantic tokens in `src/styles.css` (teal primary, amber accent, Baloo 2 headings, Nunito body). Use `bg-primary`, `text-muted-foreground`, etc. Never hardcode `text-white`, `bg-black` or hex utilities in components.

## Extending the AI tutor

The prompt lives in `src/lib/ai-feedback.functions.ts`. To change tone, hint policy or word limit, edit the `systemPrompt` array. To add a new mode (e.g. `worked_example`), extend the `mode` enum in `FeedbackInput`, add the corresponding `userPrompt` branch, and expose a button in `src/routes/student/assignment.$id.tsx`.

## Conventions

- Components import `*.functions.ts`, never `*.server.ts`.
- Toasts come from `sonner`; `<Toaster />` is mounted once in `__root.tsx`.
- Keep every route's `head()` unique for SEO.
