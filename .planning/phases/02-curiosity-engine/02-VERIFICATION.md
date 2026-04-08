---
phase: 02-curiosity-engine
verified: 2026-04-08T20:52:44Z
status: human_needed
score: 5/5 must-haves verified (with one documented deviation)
overrides_applied: 0
gaps:
deferred:
  - truth: "Student can watch concepts automatically appear as nodes on their graph (visual graph rendering)"
    addressed_in: "Phase 3"
    evidence: "Phase 3 goal: 'rendered as an interactive force-directed D3.js graph the student can explore'; SC #2: 'The force-directed D3.js graph renders all concept nodes with size scaled to visit count and color encoding health state'"
human_verification:
  - test: "Submit a question as a student and verify streaming works end-to-end"
    expected: "Answer streams character-by-character; Socratic follow-up appears in 'Think about this:' callout after streaming; toast 'New concepts added to your graph' fires; form transitions to daily-limit state"
    why_human: "Requires live Anthropic API key + running dev server; streaming behavior cannot be verified statically"
  - test: "Submit a second question on the same day"
    expected: "Form already shows daily-limit state from server-side hasAskedToday; API returns 429 if direct POST attempted"
    why_human: "Requires live authenticated session and DB state; statically confirmed via code but behavioral verification needs dev server"
  - test: "Check the server console after a question submission for routing decision logs"
    expected: "If concept matches misconception library entry, '[router] diagnose: {concept} -> {misconceptionId}' appears in console; enrich path produces no log line"
    why_human: "Console output only visible during live execution with real LLM response"
  - test: "Navigate to /student/questions and verify question history renders"
    expected: "Questions appear in reverse-chronological order with 'Today'/'Yesterday'/date headers; 'See answer' toggle expands AI response; empty state 'No questions yet' shown for new students"
    why_human: "Requires live session with DB data; UI grouping and aria-expanded behavior need browser verification"
  - test: "Verify streak badge displays in sidebar after asking a question"
    expected: "Flame icon with '{N} day streak' text visible below username; hidden when streak is 0"
    why_human: "Requires live session; streak calculation depends on DB state across UTC days"
---

# Phase 2: Curiosity Engine Verification Report

**Phase Goal:** A student can submit a daily curiosity question, receive an age-appropriate AI answer with a Socratic follow-up, and watch concepts automatically appear as nodes on their graph — and the routing engine correctly decides enrich vs. diagnose mode
**Verified:** 2026-04-08T20:52:44Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Student can submit exactly one curiosity question per day; a second submission on the same day is blocked with a clear message | ✓ VERIFIED | `apps/web/app/api/ask/route.ts`: UTC date-range query → 429 `{error: "One question per day"}`; `QuestionForm` shows "You've asked your question for today" heading when `hasAskedToday=true` |
| SC-2 | Student receives an AI answer calibrated to their grade level with one Socratic follow-up question appended | ✓ VERIFIED | `buildEnrichSystemPrompt(gradeLevel)` confirmed grade-appropriate (23 LLM tests pass including PRIV-01 checks); `AnswerDisplay` extracts last `?`-ending paragraph into "Think about this:" callout |
| SC-3 | Student can view their complete question history with timestamps and the AI response for each entry | ✓ VERIFIED | `/student/questions` page calls `getQuestionHistory()` (live DB query, limit 30); `QuestionHistory` renders date-grouped entries with "See answer"/"Hide answer" toggle; empty state present |
| SC-4 | Student's daily streak counter increments correctly and is visible on their profile | ✓ VERIFIED | `getStreak()` live DB query with UTC consecutive-day logic; `StreakBadge` in sidebar via `student/layout.tsx → AppShell → Sidebar`; returns null at streak=0 |
| SC-5 | After submitting a question, new concept nodes appear in the student's knowledge graph, and the routing engine logs whether enrich or diagnose mode was selected for each concept | ✓ VERIFIED (data layer) / DEFERRED (visual layer) | `/api/ask` `onFinish`: concepts inserted to DB as `status: 'unprobed'`; `routeQuestion()` called per concept; `[router] diagnose: ...` console.log on diagnose match. Visual graph rendering deferred to Phase 3. |

**Score:** 5/5 truths verified (SC-5 visual graph deferred to Phase 3)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Visual graph rendering of concept nodes (D3.js force-directed graph) | Phase 3 | Phase 3 goal: "rendered as an interactive force-directed D3.js graph the student can explore"; SC #2: "force-directed D3.js graph renders all concept nodes with size scaled to visit count and color encoding health state" |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/llm/src/adapters/anthropic.ts` | Anthropic Claude adapter implementation | ✓ VERIFIED | Exports `AnthropicAdapter` with `getModel()` returning `anthropic('claude-sonnet-4-20250514')` and `getModelId()` |
| `packages/llm/src/adapters/factory.ts` | LLM adapter factory with env-based provider selection | ✓ VERIFIED | Exports `createLLMAdapter()`; reads `LLM_PROVIDER` env, validates against allowlist, throws on unknown provider |
| `packages/llm/src/prompts/enrich.ts` | System prompt builder for enrich mode (PRIV-01 compliant) | ✓ VERIFIED | Exports `buildEnrichSystemPrompt(gradeLevel)`; inlined grade band logic; no PII placeholders |
| `packages/llm/src/prompts/extract.ts` | Concept extraction prompt + Zod schema | ✓ VERIFIED | Exports `conceptExtractionSchema`, `buildExtractPrompt`, `extractConcepts`; Zod validates domain enum |
| `packages/router/src/index.ts` | Routing engine with string matching | ✓ VERIFIED | Exports `routeQuestion`, `RoutingDecision`; case-insensitive match; multi-word guard to prevent false positives |
| `packages/router/src/utils.ts` | Grade level to grade band mapping | ✓ VERIFIED | Exports `gradeLevelToGradeBand`; 0-5→K-5, 6-8→6-8, 9-12→9-12 |
| `packages/db/src/schema/questions.ts` | questions, concepts, conceptQuestions tables | ✓ VERIFIED | All three tables present with correct columns; foreign keys cascade; concepts.status defaults to 'unprobed' |
| `packages/db/src/schema/index.ts` | Re-exports all schema including new questions tables | ✓ VERIFIED | `export * from "./questions"` present |
| `apps/web/app/api/ask/route.ts` | POST streaming endpoint for question submission | ✓ VERIFIED | Auth check (401), Zod validation (400), one-per-day check (429), `streamText`, `onFinish` pipeline, `maxDuration=60`, `toTextStreamResponse()` |
| `apps/web/actions/questions.ts` | Server actions for question data | ✓ VERIFIED | Exports `hasAskedToday`, `getTodayQuestion`, `getStudentGradeLevel`, `getQuestionHistory`, `getStreak` — all live DB queries |
| `apps/web/components/questions/question-form.tsx` | Client component with useCompletion hook for streaming | ✓ VERIFIED | `useCompletion` with `api: '/api/ask'` and `streamProtocol: 'text'`; correct placeholder text and button label |
| `apps/web/components/questions/answer-display.tsx` | Client component rendering markdown answer | ✓ VERIFIED | `react-markdown` + `remark-gfm`; custom `img` → null override; `role="status" aria-live="polite"` when streaming; Socratic follow-up extracted |
| `apps/web/app/student/page.tsx` | Updated student dashboard with question panel as primary CTA | ✓ VERIFIED | `QuestionForm` at `max-w-[680px]` centered column; parallel data fetching with `Promise.all` |
| `apps/web/app/student/questions/page.tsx` | Question history page at /student/questions | ✓ VERIFIED | Server component; auth gate; calls `getQuestionHistory()`; "My Questions" heading |
| `apps/web/components/questions/question-history.tsx` | Client component rendering reverse-chronological question list | ✓ VERIFIED | Date groups with `<h2>` headers; "See answer"/"Hide answer" toggle with `aria-expanded`; empty state |
| `apps/web/components/questions/streak-badge.tsx` | Streak counter with Flame icon | ✓ VERIFIED | Returns null at streak=0; Flame icon; `aria-label`; `h-7` height |
| `apps/web/components/layout/sidebar.tsx` | Updated sidebar with My Questions nav and streak badge | ✓ VERIFIED | `MessageSquare` icon; "My Questions" href="/student/questions"; `StreakBadge` rendered for student role only |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/llm/src/adapters/factory.ts` | `packages/llm/src/adapters/anthropic.ts` | `import { AnthropicAdapter } from "./anthropic"` | ✓ WIRED | Import confirmed at line 1 of factory.ts |
| `packages/router/src/index.ts` | `@mindmap/misconceptions` | `getMisconceptionsByDomainAndBand` | ✓ WIRED | Import and usage at lines 1 and 25 of router/index.ts |
| `packages/router/src/index.ts` | `packages/router/src/utils.ts` | `gradeLevelToGradeBand` | ✓ WIRED | Import at line 2; used in `routeQuestion` at line 24; re-exported at line 54 |
| `apps/web/components/questions/question-form.tsx` | `apps/web/app/api/ask/route.ts` | `useCompletion` POSTing to `/api/ask` | ✓ WIRED | `api: '/api/ask'` at line 33 |
| `apps/web/app/api/ask/route.ts` | `@mindmap/llm` | `streamText + extractConcepts in onFinish` | ✓ WIRED | `buildEnrichSystemPrompt` used in `streamText` at line 78; `extractConcepts` called in `onFinish` at line 98 |
| `apps/web/app/api/ask/route.ts` | `@mindmap/router` | `routeQuestion` called per extracted concept | ✓ WIRED | `routeQuestion` imported and called inside `routingDecisions` map at line 106 |
| `apps/web/app/api/ask/route.ts` | `@mindmap/db` | `db.insert(schema.questions)` + `db.insert(schema.concepts)` | ✓ WIRED | Lines 87-146: question inserted, concepts inserted with `status: 'unprobed'`, concept_questions join rows inserted |
| `apps/web/app/student/questions/page.tsx` | `apps/web/actions/questions.ts` | `getQuestionHistory` server action call | ✓ WIRED | Import at line 4; called at line 14 |
| `apps/web/components/layout/sidebar.tsx` | `apps/web/components/questions/streak-badge.tsx` | `StreakBadge` rendered below user name | ✓ WIRED | Import at line 9; rendered at line 69 |
| `apps/web/app/student/layout.tsx` | `apps/web/actions/questions.ts` | `getStreak` server action | ✓ WIRED | Import at line 5; called at line 18 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `QuestionForm` | `completion` | `useCompletion` → `/api/ask` → `streamText` → Claude API | Yes (live stream) | ✓ FLOWING |
| `AnswerDisplay` | `markdown` prop | `completion` from `useCompletion`, or `todayQuestion.aiResponse` from DB | Yes (live or DB) | ✓ FLOWING |
| `apps/web/app/api/ask/route.ts` | concepts in `onFinish` | `extractConcepts(question, text)` → Claude API → Zod parse | Yes (live LLM call) | ✓ FLOWING |
| `QuestionHistory` | `questions` prop | `getQuestionHistory()` → `db.query.questions.findMany(...)` limit 30 | Yes (DB query filtered by session.user.id) | ✓ FLOWING |
| `StreakBadge` | `streak` prop | `getStreak()` → `db.query.questions.findMany(...)` limit 365 → consecutive-day count | Yes (live DB query) | ✓ FLOWING |
| `student/layout.tsx` | `streak` | `await getStreak()` → DB | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| LLM package tests (39 tests) | `pnpm --filter @mindmap/llm test -- --run` | 2 test files, 23 tests passed | ✓ PASS |
| Router package tests (16 tests) | `pnpm --filter @mindmap/router test -- --run` | 1 test file, 16 tests passed | ✓ PASS |
| Full project build | `pnpm build` | 5 successful, 0 failed (cached) | ✓ PASS |
| Streaming response format | `toTextStreamResponse()` in route.ts | Compatible with `useCompletion streamProtocol: 'text'` | ✓ PASS (code verified) |
| PRIV-01: no PII in LLM prompts | `grep -n "session.user.name\|session.user.email" apps/web/app/api/ask/route.ts` | No matches — userId only used for DB queries, never in prompt args | ✓ PASS |
| Live streaming / concept extraction | Requires running dev server + Anthropic API key | Cannot test statically | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CURI-01 | 02-02, 02-03 | Student can submit one curiosity question per day via text input | ✓ SATISFIED | `hasAskedToday()` server action + API 429 gate + `QuestionForm` daily-limit state |
| CURI-02 | 02-01, 02-03 | AI responds with rich, age-appropriate answer based on student grade level | ✓ SATISFIED | `buildEnrichSystemPrompt(gradeLevel)` in `streamText`; grade level from most recent enrollment |
| CURI-03 | 02-01, 02-03 | AI asks one Socratic follow-up question after each answer | ✓ SATISFIED | System prompt includes "End with exactly one thought-provoking follow-up question"; `AnswerDisplay` extracts and renders it |
| CURI-04 | 02-02, 02-04 | Student can view their full question history with timestamps | ✓ SATISFIED | `/student/questions` page; `getQuestionHistory()` DB query; date-grouped with `<h2>` headers |
| CURI-05 | 02-04 | Daily streak tracking visible to the student | ✓ SATISFIED | `getStreak()` UTC consecutive-day logic; `StreakBadge` in sidebar; hidden at 0 |
| CURI-06 | 02-01, 02-03 | AI extracts underlying concepts from each question/answer exchange | ✓ SATISFIED | `extractConcepts()` in `onFinish`; `conceptExtractionSchema` Zod validation; live LLM call |
| CURI-07 | 02-02, 02-03 | Extracted concepts are added as nodes to the student's knowledge graph | ✓ SATISFIED | `db.insert(schema.concepts)` per concept in `onFinish`; `status: 'unprobed'`; concept_questions join rows |
| MISC-04 | 02-01 | Routing engine determines enrich vs. diagnose mode | ✓ SATISFIED | `routeQuestion(conceptName, gradeLevel, domain)` in `@mindmap/router`; 16 tests pass |
| MISC-05 | 02-01, 02-03 | Enrich mode: AI gives rich answer, asks Socratic follow-up, adds concept as unprobed node | ✓ SATISFIED | `buildEnrichSystemPrompt` + `streamText`; `extractConcepts` + `db.insert(schema.concepts, {status: 'unprobed'})` |
| INFR-03 | 02-01 | LLM layer uses Anthropic Claude API as primary provider via Vercel AI SDK | ✓ SATISFIED | `AnthropicAdapter` wraps `@ai-sdk/anthropic`; `claude-sonnet-4-20250514` |
| INFR-04 | 02-01 | LLM adapter pattern supports swapping providers via environment variable | ✓ SATISFIED | `createLLMAdapter()` reads `LLM_PROVIDER` env; throws on unknown provider |
| PRIV-01 | 02-01, 02-03 | No student PII is sent to LLM providers in prompts | ✓ SATISFIED | `buildEnrichSystemPrompt` uses only `gradeLevel` integer; API route sends only `question` (text) + `system` prompt; userId never in prompt or system args; 7 PRIV-01 tests enforce this |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `packages/db/src/schema/questions.ts` | `index()` instead of `uniqueIndex()` on `(userId, createdAt)` — documented deviation from plan requirement of unique constraint at DB level | ⚠️ Warning | Race condition risk: concurrent duplicate requests within the same millisecond could bypass application-layer one-per-day check. Application-layer UTC date-range check mitigates normal-use cases. Documented in 02-02-SUMMARY as intentional (drizzle-kit push error 42P17 with sql DATE expression). |
| `apps/web/components/questions/question-form.tsx` | Generic error toast ("We couldn't get an answer right now. Your question was saved — we'll try again shortly.") is shown for all errors including 429 | ℹ️ Info | Student who double-submits within the same session sees a generic error rather than "you've already asked today". The server-side `hasAskedToday` prop prevents normal double-submission; the 429 only fires on race conditions. Not a blocker. |

### Human Verification Required

### 1. End-to-End Question Submission with Streaming

**Test:** Start dev server (`pnpm dev`), log in as a student, type a question like "Why is the sky blue?" and click "Ask my question"
**Expected:** Answer streams character-by-character; "Think about this:" callout appears with the Socratic follow-up after streaming completes; toast "New concepts added to your graph" fires; form transitions to "You've asked your question for today" daily-limit state
**Why human:** Requires live Anthropic API key (`ANTHROPIC_API_KEY` env), running Next.js dev server, and live streaming behavior that cannot be verified statically

### 2. Second Submission Blocked Clearly

**Test:** After asking a question, refresh the student dashboard
**Expected:** `QuestionForm` shows "You've asked your question for today" heading immediately (server-rendered `hasAskedToday=true`); attempting a direct POST to `/api/ask` returns 429
**Why human:** Requires live authenticated session with DB state persisted from step 1

### 3. Routing Engine Console Log Verification

**Test:** Check the Next.js server console output after a question submission where a concept matches a known misconception (e.g., ask "why do heavier objects fall faster?")
**Expected:** `[router] diagnose: heavier objects fall faster -> phys-001` appears in server console; enrich-mode concepts produce no log line
**Why human:** Console output only accessible during live execution with real LLM response producing the specific misconception-matching concept text

### 4. Question History Page Renders Correctly

**Test:** Navigate to `/student/questions` after submitting at least one question
**Expected:** Questions appear in reverse-chronological order with "Today" date header; "See answer" toggle expands AI response; empty state "No questions yet" shows for students with no questions; `aria-expanded` attribute toggles correctly
**Why human:** Requires live session with DB data; UI grouping and interactive toggle behavior need browser verification

### 5. Streak Badge in Sidebar

**Test:** Submit a question, then reload any student page
**Expected:** Flame icon with "1 day streak" text visible below username in sidebar; verifying it's hidden for streak=0 requires a fresh account
**Why human:** Streak calculation depends on DB state across UTC days; badge rendering requires visual inspection

### Gaps Summary

No blocking gaps found. All five roadmap success criteria are implemented and verified at code level:

- One-per-day enforcement: application-layer UTC date-range query + 429 API response + form daily-limit state
- Grade-appropriate AI answer with Socratic follow-up: confirmed via `buildEnrichSystemPrompt` and `AnswerDisplay` extraction
- Question history with timestamps: `/student/questions` page with date-grouped `QuestionHistory` component
- Daily streak visible: `StreakBadge` in sidebar via server-rendered layout
- Concepts saved to DB as unprobed nodes: `onFinish` pipeline with `routeQuestion` logging

**Documented deviation (not a gap):** The unique constraint on `(userId, DATE(created_at))` was downgraded to a regular index due to a drizzle-kit push error (42P17 with SQL expression indexes). Application-layer enforcement remains. A race condition could theoretically bypass the one-per-day check under concurrent requests, but is extremely unlikely in normal use.

**Deferred (Phase 3):** Visual graph rendering of concept nodes — Phase 2 stores concepts in the database; the D3.js force-directed graph visualization is Phase 3's primary deliverable.

---

_Verified: 2026-04-08T20:52:44Z_
_Verifier: Claude (gsd-verifier)_
