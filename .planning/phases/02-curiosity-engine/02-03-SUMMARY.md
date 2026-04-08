---
phase: 02-curiosity-engine
plan: 03
subsystem: question-submission
tags: [streaming, ai-sdk, useCompletion, react-markdown, sonner, server-actions, privacy]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [question-form-ui, streaming-api-route, server-actions-questions, answer-display]
  affects: [apps/web/app/student/page.tsx, apps/web/app/layout.tsx]
tech_stack:
  added: [ai@6.x, "@ai-sdk/react@3.x", react-markdown@10.x, remark-gfm@4.x, sonner@2.x, "@mindmap/llm (workspace)", "@mindmap/router (workspace)"]
  patterns: [useCompletion-text-stream, server-action-one-per-day, onFinish-concept-extraction, react-markdown-safe-render]
key_files:
  created:
    - apps/web/app/api/ask/route.ts
    - apps/web/actions/questions.ts
    - apps/web/components/questions/question-form.tsx
    - apps/web/components/questions/answer-display.tsx
    - apps/web/components/ui/textarea.tsx
    - apps/web/components/ui/skeleton.tsx
    - apps/web/components/ui/sonner.tsx
  modified:
    - apps/web/package.json
    - apps/web/app/student/page.tsx
    - apps/web/app/layout.tsx
    - package.json
decisions:
  - "Use toTextStreamResponse() not toUIMessageStreamResponse() — useCompletion expects text stream protocol, toUIMessageStreamResponse is for useChat"
  - "Add @neondatabase/serverless + @opentelemetry/api + pg + @types/pg to apps/web to unify drizzle-orm peer dep resolution (two instances caused TS private property conflict)"
  - "Use createLLMAdapter().getModel() in API route instead of direct @ai-sdk/anthropic import — avoids adding @ai-sdk/anthropic as apps/web direct dep"
  - "Socratic follow-up extracted client-side: last paragraph ending with ? separated from body, shown in callout with Think about this: label"
  - "shadcn components (textarea, skeleton, sonner) created manually matching shadcn patterns — npx shadcn CLI was unavailable"
metrics:
  duration_seconds: 494
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_created: 7
  files_modified: 4
---

# Phase 02 Plan 03: Streaming Question Submission Summary

**One-liner**: Streaming `/api/ask` route with one-per-day enforcement, concept extraction pipeline, and `QuestionForm`/`AnswerDisplay` client components wiring the full ask-and-learn loop into the student dashboard.

---

## What Was Built

**`/api/ask` POST route** (`apps/web/app/api/ask/route.ts`):
- Auth gate (401 if no session) — T-02-08
- Zod validation: non-empty string, max 500 chars — T-02-09
- One-per-day UTC date-range check returning 429 — T-02-10
- Grade level fetched from most recent class enrollment (default 6)
- `streamText` with `buildEnrichSystemPrompt(gradeLevel)` — PRIV-01: only question text and grade level go to Claude, never name/email/userId
- `onFinish` callback: insert question row → `extractConcepts()` → `routeQuestion()` per concept → update question with routing mode → insert concepts as `unprobed` → insert `concept_questions` join rows
- Diagnose routing logged to console, not surfaced to student
- `toTextStreamResponse()` compatible with `useCompletion` text stream protocol
- `maxDuration = 60`

**`apps/web/actions/questions.ts`** — server actions:
- `hasAskedToday()`: UTC date-range query returning boolean
- `getTodayQuestion()`: returns today's question row or null
- `getStudentGradeLevel()`: most recent class enrollment grade level, default 6
- `getQuestionHistory()`: reverse-chronological question list
- `getStreak()`: consecutive day streak calculation

**`QuestionForm`** (`apps/web/components/questions/question-form.tsx`):
- `useCompletion` hook with `streamProtocol: "text"` POSTing to `/api/ask`
- Textarea with placeholder "What are you curious about today?", min-h 88px
- "Ask my question" submit button with `Loader2` spinner while loading
- Inline skeleton placeholder (3 pulsing lines) before first token arrives
- Daily-limit state: "You've asked your question for today" + "Come back tomorrow to keep your streak going"
- Sonner toast on completion: "New concepts added to your graph"
- Error display on network failure

**`AnswerDisplay`** (`apps/web/components/questions/answer-display.tsx`):
- `react-markdown` + `remark-gfm` — no `dangerouslySetInnerHTML` — T-02-12
- Custom component overrides: `img` → null, styled `pre`/`code`, 16px body paragraphs
- Socratic follow-up extraction: last paragraph ending with `?` separated into "Think about this:" callout with `--muted` background and 2px `--primary` left border
- `role="status" aria-live="polite" aria-label="Loading answer"` when streaming

**Student dashboard** (`apps/web/app/student/page.tsx`):
- `QuestionForm` as primary CTA at `max-w-[680px]` centered column
- Parallel data fetching with `Promise.all` for enrollments, askedToday, todayQuestion, gradeLevel
- Classes section below, unchanged from Phase 1

**Root layout** (`apps/web/app/layout.tsx`):
- Sonner `<Toaster />` added inside body

---

## Threat Model Compliance

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-02-08 (Spoofing) | MITIGATED | `auth()` at route entry; userId from session only |
| T-02-09 (Tampering) | MITIGATED | Zod validation: non-empty, max 500 chars |
| T-02-10 (DoS) | MITIGATED | One-per-day check + 429; `maxDuration=60` |
| T-02-11 (PII Disclosure) | MITIGATED | Only `question` + `gradeLevel` sent to Claude; no name/email/userId |
| T-02-12 (XSS via markdown) | MITIGATED | react-markdown → safe React elements; img override → null; no raw HTML |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Drizzle-orm dual-instance type conflict**
- **Found during:** Task 1 (first pnpm build)
- **Issue:** `pnpm add ai @ai-sdk/react` introduced a new drizzle-orm peer dep resolution instance (`drizzle-orm@0.45.2(@neondatabase/serverless@1.0.2)(@types/pg@8.20.0)(pg@8.20.0)`) alongside the existing one (`drizzle-orm@0.45.2(@neondatabase/serverless@1.0.2)(@opentelemetry/api@1.9.0)(@types/pg@8.20.0)(pg@8.20.0)`). TypeScript rejected `SQL<unknown>` from one instance where the other was expected (private property conflict).
- **Fix:** Added `@neondatabase/serverless`, `pg`, `@opentelemetry/api`, `@types/pg` to `apps/web` deps so pnpm resolves `drizzle-orm` to the same peer-dep-qualified instance used by `@mindmap/db`. Also added `pnpm.overrides.drizzle-orm` to root `package.json`.
- **Files modified:** `apps/web/package.json`, `package.json`, `pnpm-lock.yaml`
- **Commit:** 9e39139

**2. [Rule 1 - Bug] toUIMessageStreamResponse() incompatible with useCompletion**
- **Found during:** Task 2 (reviewing AI SDK API)
- **Issue:** The plan specified `toUIMessageStreamResponse()` but this returns a UI message stream format designed for `useChat`. `useCompletion` with `streamProtocol: "text"` requires `toTextStreamResponse()`.
- **Fix:** Changed route to return `result.toTextStreamResponse()` and configured `useCompletion` with `streamProtocol: "text"`.
- **Files modified:** `apps/web/app/api/ask/route.ts`, `apps/web/components/questions/question-form.tsx`
- **Commit:** 5e76681

**3. [Rule 3 - Blocking] shadcn CLI unavailable for textarea/skeleton/sonner**
- **Found during:** Task 1 (npx shadcn@latest add command denied)
- **Issue:** The plan called for `npx shadcn@latest add textarea skeleton scroll-area sonner` but CLI execution was denied.
- **Fix:** Manually created `textarea.tsx`, `skeleton.tsx`, `sonner.tsx` in `apps/web/components/ui/` matching shadcn patterns and the existing component style in the codebase.
- **Files created:** `apps/web/components/ui/textarea.tsx`, `apps/web/components/ui/skeleton.tsx`, `apps/web/components/ui/sonner.tsx`
- **Commit:** 9e39139

**4. [Rule 2 - Missing] sonner package not installed by initial pnpm add**
- **Found during:** Task 1 (second pnpm build)
- **Issue:** `sonner` was listed as a component to install via shadcn CLI but wasn't included in the initial `pnpm add` command. Build failed with `Cannot find module 'sonner'`.
- **Fix:** `pnpm add sonner` in `apps/web`.
- **Commit:** 9e39139

---

## Known Stubs

None. All data flows are wired:
- Grade level comes from DB (classEnrollments), defaulting to 6
- `hasAskedToday` and `getTodayQuestion` are live DB queries
- Streaming connects `useCompletion → /api/ask → streamText → Claude`
- Concept extraction and routing happen in `onFinish` with real DB inserts

The concept count in the toast is generic ("New concepts added to your graph") rather than `{N} new concepts` because the count is only available server-side in `onFinish`. This is intentional in v1 — the plan explicitly noted "use generic since we don't have count client-side."

---

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries beyond what the plan's threat model covers.

---

## Self-Check: PASSED

Files confirmed present:
- apps/web/app/api/ask/route.ts: FOUND
- apps/web/actions/questions.ts: FOUND
- apps/web/components/questions/question-form.tsx: FOUND
- apps/web/components/questions/answer-display.tsx: FOUND
- apps/web/components/ui/textarea.tsx: FOUND
- apps/web/components/ui/skeleton.tsx: FOUND
- apps/web/components/ui/sonner.tsx: FOUND

Commits confirmed:
- 9e39139 feat(02-03): install AI SDK deps, create streaming /api/ask route and server actions
- 5e76681 feat(02-03): build question form, answer display, and update student dashboard

Build: PASSED (5 successful, 0 failed)
PRIV-01: PASSED (no session.user.name or session.user.email in API route)
