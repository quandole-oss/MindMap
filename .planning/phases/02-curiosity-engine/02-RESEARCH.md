# Phase 2: Curiosity Engine - Research

**Researched:** 2026-04-08
**Domain:** Vercel AI SDK streaming, structured concept extraction, routing logic, DB schema, student UI
**Confidence:** HIGH (stack, patterns, DB design); MEDIUM (exact AI SDK v6 migration surface)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Streaming responses via Vercel AI SDK `streamText` — better UX, user sees answer forming in real-time
- One-question-per-day enforced via DB check: query today's questions for user, reject if count >= 1
- Concept extraction via separate `generateObject` call with Zod schema after main answer — cleaner, typed output, no parsing fragility
- Grade-appropriate language via system prompt: "Explain at a grade {N} level" using student's grade level from profile
- Routing logic lives in `@mindmap/router` package — testable, separated from Next.js API routes
- Concept-to-misconception matching via string matching on concept name + domain + grade band — simple v1, no embeddings needed yet (Phase 3 adds pgvector)
- When routing picks "diagnose" in Phase 2: log the decision but serve enrich mode — diagnose flow built in Phase 4
- Socratic follow-up is part of the main answer prompt: "End with one thought-provoking follow-up question" — avoids doubling latency
- Question input centered on student dashboard as primary CTA: "What are you curious about today?"
- Answer displayed as markdown rendered inline below the question
- Streak display as small badge/counter near profile: "X days" — visible but not dominant
- Question history as reverse-chronological list with date headers — simple, scannable

### Claude's Discretion
- Specific Anthropic Claude API prompt structure and system message content
- Zod schema shape for concept extraction output
- Exact database schema for questions and sessions tables
- Markdown rendering library choice (react-markdown or similar)
- Error handling for LLM API failures and rate limits

### Deferred Ideas (OUT OF SCOPE)
- pgvector embeddings and semantic deduplication — Phase 3
- Diagnose mode Socratic flow — Phase 4
- Cross-subject bridge detection — Phase 3
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CURI-01 | Student can submit one curiosity question per day via text input | DB check pattern in "One Question Per Day" section; server action pattern from class.ts |
| CURI-02 | AI responds with a rich, age-appropriate answer based on student grade level | streamText + system prompt with grade level; grade-band mapping from integer |
| CURI-03 | AI asks one Socratic follow-up question after each answer | Embedded in main prompt instruction; no second LLM call needed |
| CURI-04 | Student can view their full question history with timestamps | questions table with createdAt; reverse-chronological query |
| CURI-05 | Daily streak tracking visible to the student (days-in-a-row) | Streak computation via consecutive-day query pattern documented below |
| CURI-06 | AI extracts underlying concepts from each question/answer exchange | generateText with Output.object() in AI SDK v6; Zod schema for concept list |
| CURI-07 | Extracted concepts are added as nodes to the student's knowledge graph | concepts table + concept_questions join table insert after extraction |
| MISC-04 | Routing engine determines enrich vs. diagnose mode | routeQuestion() in @mindmap/router using getMisconceptionsByDomainAndBand() |
| MISC-05 | Enrich mode: AI gives rich answer, Socratic follow-up, adds concept as unprobed node | Full enrich pipeline: streamText + extract + insert concept with status="unprobed" |
| INFR-03 | LLM layer uses Anthropic Claude API as primary provider via Vercel AI SDK | anthropic() provider from @ai-sdk/anthropic in @mindmap/llm |
| INFR-04 | LLM adapter pattern supports swapping providers via environment variable | LLM_PROVIDER env var selecting anthropic/openai/ollama; factory in @mindmap/llm |
| PRIV-01 | No student PII sent to LLM providers in prompts | Anonymized context pattern: only grade level + question text, no name/email/ID |
</phase_requirements>

---

## Summary

Phase 2 builds the full curiosity question pipeline: student submits question, receives a streaming AI answer with embedded Socratic follow-up, concepts are extracted and stored as graph nodes, and the routing engine decides enrich vs. diagnose mode. All existing Phase 1 infrastructure (Drizzle ORM, Auth.js session, server actions, shadcn/ui components) is reusable without modification.

The most important discovery from this research: **the CONTEXT.md references `generateObject` which was deprecated in Vercel AI SDK v6** (the current `latest` version, 6.0.154). The correct v6 API is `generateText` with `Output.object({ schema })`. This is not a breaking change in behavior — the output is the same typed object — but the import and call signature differ. The planner must use the v6 API, not v4 patterns referenced in CONTEXT.md.

The second key finding: the DB currently has no `questions`, `concepts`, or `concept_questions` tables. These three tables (plus an optional `routing_decisions` log) are the only schema additions Phase 2 needs. Grade levels are stored as integers (0=K, 1-12) in the DB; the router needs a mapping function to convert these to `GradeBand` strings ("K-5", "6-8", "9-12") that the misconception library uses.

**Primary recommendation:** Install `ai@^6`, `@ai-sdk/anthropic@^3`, and `@ai-sdk/react@^3` into the appropriate packages. Implement the LLM adapter using `streamText` for the answer and `generateText` with `Output.object()` for concept extraction. The router needs a single `gradeLevelToGradeBand()` utility and name-based matching against the misconception library.

---

## Standard Stack

### Core (Phase 2 additions — not yet installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | 6.0.154 [VERIFIED: npm registry] | Vercel AI SDK core — streamText, generateText, Output | Current latest; v4 patterns in CONTEXT.md are from an older version |
| `@ai-sdk/anthropic` | 3.0.68 [VERIFIED: npm registry] | Anthropic Claude provider | Primary LLM per project brief; INFR-03 |
| `@ai-sdk/react` | 3.0.156 [VERIFIED: npm registry] | useCompletion hook for client streaming | Required for client-side streaming UI |
| `react-markdown` | 10.1.0 [VERIFIED: npm registry] | Render AI markdown answer inline | Already available as standard; v10 is current |
| `remark-gfm` | 4.0.1 [VERIFIED: npm registry] | GFM tables/strikethrough in markdown | Standard companion to react-markdown |

### Already Installed (reuse from Phase 1)

| Library | Location | Reuse Pattern |
|---------|----------|---------------|
| `drizzle-orm` 0.45.2 | `@mindmap/db` | Add questions/concepts schema; no upgrade needed |
| `zod` 3.25 | `apps/web`, `@mindmap/misconceptions` | Concept extraction schema |
| `@mindmap/misconceptions` | workspace | `getMisconceptionsByDomainAndBand()` for router |
| `shadcn/ui` (button, input, card, badge) | `apps/web` | Question form and history UI |
| Auth.js v5 + `auth()` | `apps/web/lib/auth.ts` | Session access in server actions and API routes |

### Installation

```bash
# In @mindmap/llm package
cd packages/llm
pnpm add ai @ai-sdk/anthropic

# In apps/web (for client hook + markdown rendering)
cd apps/web
pnpm add ai @ai-sdk/react react-markdown remark-gfm
```

Note: `ai` needs to be in both `@mindmap/llm` (for `streamText`, `generateText`, `Output`) and `apps/web` (for `useCompletion` hook from `@ai-sdk/react`).

### Version Verification

```bash
npm view ai version          # → 6.0.154
npm view @ai-sdk/anthropic version  # → 3.0.68
npm view @ai-sdk/react version      # → 3.0.156
npm view react-markdown version     # → 10.1.0
```

---

## Architecture Patterns

### Recommended File Structure (Phase 2 additions only)

```
packages/
  llm/
    src/
      adapters/
        anthropic.ts          # AnthropicAdapter implements LLMAdapter
        factory.ts            # createLLMAdapter(provider) factory
      prompts/
        enrich.ts             # buildEnrichPrompt(question, gradeLevel)
        extract.ts            # buildExtractPrompt(question, answer)
      index.ts                # LLMAdapter interface (update stub)
  router/
    src/
      utils.ts                # gradeLevelToGradeBand(gradeLevel: number): GradeBand
      index.ts                # routeQuestion() implementation (update stub)
  db/
    src/
      schema/
        questions.ts          # questions, concepts, concept_questions tables
        index.ts              # re-export (add questions.ts)
      queries/
        questions.ts          # typed query helpers for questions/concepts

apps/web/
  actions/
    questions.ts              # submitQuestionAction, getQuestionHistory, getStreak
  app/
    api/
      ask/
        route.ts              # POST streaming endpoint
    student/
      page.tsx                # Update: add question form + history + streak badge
  components/
    questions/
      question-form.tsx       # "use client" — form with useCompletion hook
      answer-display.tsx      # "use client" — react-markdown streamed answer
      question-history.tsx    # Server component — reverse-chrono list
      streak-badge.tsx        # Server component — "X days" badge
```

### Pattern 1: AI SDK v6 streamText API Route

**What:** POST route that accepts question + gradeLevel, validates the one-per-day limit, then streams a Claude response.

**Critical v6 note:** `toDataStreamResponse()` is gone in v6. Use `toUIMessageStreamResponse()` instead. [VERIFIED: ai-sdk.dev migration guide]

```typescript
// apps/web/app/api/ask/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { auth } from '@/lib/auth';

export const maxDuration = 30; // Vercel streaming timeout

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { question, gradeLevel } = await req.json();

  // One-per-day check (see server action pattern below)
  // ... DB check here

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: buildEnrichSystemPrompt(gradeLevel),
    prompt: question,
    onFinish: async ({ text }) => {
      // After streaming: save question + answer, run concept extraction
      await saveAndExtractConcepts({ userId: session.user.id, question, answer: text, gradeLevel });
    },
  });

  return result.toUIMessageStreamResponse();
}
```

[CITED: ai-sdk.dev/docs/getting-started/nextjs-app-router]

### Pattern 2: AI SDK v6 Structured Concept Extraction (Output.object)

**What:** After the main answer is complete (in the `onFinish` callback), call `generateText` with `Output.object()` to extract concepts. This is the v6 replacement for `generateObject`.

**Critical note for CONTEXT.md alignment:** CONTEXT.md says "Concept extraction via separate `generateObject` call". The behavior is identical, but the v6 API is `generateText` with `Output.object()`. [VERIFIED: ai-sdk.dev/docs/migration-guides/migration-guide-6-0]

```typescript
// packages/llm/src/adapters/anthropic.ts
import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const conceptExtractionSchema = z.object({
  concepts: z.array(z.object({
    name: z.string().describe('Short canonical concept name, e.g. "photosynthesis", "gravity"'),
    domain: z.enum(['physics', 'biology', 'math', 'history', 'general'])
      .describe('Subject domain this concept belongs to'),
  })).describe('2-6 core concepts underlying the question and answer'),
});

export async function extractConcepts(
  question: string,
  answer: string
): Promise<Array<{ name: string; domain: string }>> {
  const { output } = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    output: Output.object({ schema: conceptExtractionSchema }),
    prompt: `Extract the core concepts from this educational exchange.

Question: ${question}
Answer: ${answer}`,
  });
  return output.concepts;
}
```

[CITED: ai-sdk.dev/docs/migration-guides/migration-guide-6-0]

### Pattern 3: Client-Side Streaming with useCompletion

**What:** `useCompletion` from `@ai-sdk/react` handles the fetch, SSE parsing, and state management for streaming text to the UI.

```typescript
// apps/web/components/questions/question-form.tsx
'use client';

import { useCompletion } from '@ai-sdk/react';
import { useState } from 'react';

export function QuestionForm({ gradeLevel }: { gradeLevel: number }) {
  const { completion, complete, isLoading, error } = useCompletion({
    api: '/api/ask',
    body: { gradeLevel },  // Extra body fields merged with prompt
  });

  const [question, setQuestion] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await complete(question);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={question} onChange={e => setQuestion(e.target.value)} />
      <button type="submit" disabled={isLoading}>Ask</button>
      {completion && <AnswerDisplay markdown={completion} />}
      {error && <p>Something went wrong. Please try again.</p>}
    </form>
  );
}
```

[CITED: ai-sdk.dev/docs/ai-sdk-ui/completion]

### Pattern 4: Grade Level to Grade Band Mapping

**What:** The DB stores grade level as integer (0=K, 1-12 per classes.ts comment). The router and misconception library use `GradeBand` strings ("K-5", "6-8", "9-12"). A utility function bridges these.

```typescript
// packages/router/src/utils.ts
import type { GradeBand } from '@mindmap/misconceptions';

export function gradeLevelToGradeBand(gradeLevel: number): GradeBand {
  if (gradeLevel <= 5) return 'K-5';   // 0=K, 1=1st, ..., 5=5th
  if (gradeLevel <= 8) return '6-8';   // 6th, 7th, 8th
  return '9-12';                        // 9th through 12th
}
```

[ASSUMED] — boundary at grade 5/6 and 8/9 follows standard U.S. elementary/middle/high school structure. The misconception library entries observed in the YAML files confirm these three bands.

### Pattern 5: Router Implementation with String Matching

**What:** The router v1 uses string matching (not embeddings) on concept name against the misconception library. The matching is case-insensitive and checks if any YAML entry name is contained in the concept name or vice versa.

```typescript
// packages/router/src/index.ts
import { loadLibrary, getMisconceptionsByDomainAndBand, type GradeBand } from '@mindmap/misconceptions';
import { gradeLevelToGradeBand } from './utils';

export type RoutingDecision =
  | { mode: 'enrich' }
  | { mode: 'diagnose'; misconceptionId: string; probability: number };

export function routeQuestion(
  conceptName: string,
  gradeLevel: number,
  domain: string
): RoutingDecision {
  const gradeBand = gradeLevelToGradeBand(gradeLevel);
  const candidates = getMisconceptionsByDomainAndBand(domain, gradeBand);

  const conceptLower = conceptName.toLowerCase();
  for (const entry of candidates) {
    const entryLower = entry.name.toLowerCase();
    if (conceptLower.includes(entryLower) || entryLower.includes(conceptLower)) {
      return { mode: 'diagnose', misconceptionId: entry.id, probability: 0.8 };
    }
  }

  return { mode: 'enrich' };
}
```

### Pattern 6: One-Per-Day Check

**What:** Before processing a question, query today's questions for this user using a date range.

```typescript
// In server action or API route
import { and, eq, gte, lt } from 'drizzle-orm';

async function hasAskedTodayQuestion(userId: string): Promise<boolean> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfDay.getTime() + 86_400_000);

  const existing = await db.query.questions.findFirst({
    where: and(
      eq(schema.questions.userId, userId),
      gte(schema.questions.createdAt, startOfDay),
      lt(schema.questions.createdAt, startOfTomorrow),
    ),
  });
  return !!existing;
}
```

### Pattern 7: Streak Calculation

**What:** Streak = count of consecutive days with at least one question, looking backward from today.

```typescript
// Streak query — fetch one row per day with a question, ordered descending
const rows = await db
  .selectDistinct({ day: sql<string>`DATE(${schema.questions.createdAt})` })
  .from(schema.questions)
  .where(eq(schema.questions.userId, userId))
  .orderBy(desc(schema.questions.createdAt))
  .limit(365); // cap; no student has 365-day history yet

let streak = 0;
const today = new Date();
today.setHours(0, 0, 0, 0);

for (let i = 0; i < rows.length; i++) {
  const expectedDay = new Date(today.getTime() - i * 86_400_000);
  const rowDay = new Date(rows[i].day);
  if (rowDay.getTime() !== expectedDay.getTime()) break;
  streak++;
}
```

[ASSUMED] — standard consecutive-day streak algorithm; the DATE() SQL function behavior with timezone may need UTC handling (see Pitfalls section).

### Pattern 8: PRIV-01 Anonymized Prompt Construction

**What:** Prompts must not contain student name, email, or user ID. Only grade level (a non-identifying attribute) and the question text go to Claude.

```typescript
// packages/llm/src/prompts/enrich.ts

export function buildEnrichSystemPrompt(gradeLevel: number): string {
  const gradeBand = gradeLevelToGradeBand(gradeLevel);
  const gradeDescription = gradeLevel === 0 ? 'Kindergarten' : `Grade ${gradeLevel}`;
  return [
    `You are a knowledgeable and encouraging educational tutor.`,
    `Adjust your language, vocabulary, and examples for a ${gradeDescription} student (${gradeBand}).`,
    `Give a rich, engaging answer that builds genuine understanding.`,
    `End with exactly one thought-provoking follow-up question to deepen their thinking.`,
    `Do not mention the student's name or personal information.`,
  ].join(' ');
}
```

Grade level is not PII under FERPA/COPPA — it is an academic attribute, not a personally identifying fact. It does not uniquely identify a student. [CITED: FPF Vetting Generative AI Tools for Use in Schools, Oct 2024]

### Anti-Patterns to Avoid

- **Calling Claude directly in React components:** Exposes API keys in bundle. All LLM calls go through `POST /api/ask`.
- **Using `toDataStreamResponse()`:** Removed in AI SDK v6. Use `toUIMessageStreamResponse()`. [VERIFIED: migration guide]
- **Using `generateObject()` import:** Deprecated in v6. Use `generateText` with `Output.object()`. [VERIFIED: migration guide]
- **Storing grade level with question text in prompt as "Student: [name], Grade: X":** Violates PRIV-01. Pass grade level only.
- **Running `loadLibrary()` on every request:** It's already cached after first call in `@mindmap/misconceptions/loader.ts` via `_library` module variable. Do not re-implement caching.
- **Timezone-naive streak counting:** Using `new Date().toDateString()` for day boundaries produces wrong results across timezones. Use UTC-based comparison or Postgres `DATE()` with explicit timezone.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming LLM to browser | Custom SSE/chunked response | `streamText` + `toUIMessageStreamResponse()` + `useCompletion` | SDK handles backpressure, reconnects, partial parsing |
| Structured concept output | JSON regex parsing from raw LLM text | `generateText` with `Output.object({ schema })` | Schema validation, type safety, retry on malformed output |
| Markdown rendering | Custom HTML sanitizer | `react-markdown` + `remark-gfm` | XSS-safe, handles streaming partial markdown correctly |
| Grade band conversion | Hardcoded switch statements across codebase | Single `gradeLevelToGradeBand()` in `@mindmap/router` | Single source of truth; router already imports from misconceptions |
| Misconception library lookup | Re-loading YAML in router or API route | `getMisconceptionsByDomainAndBand()` from `@mindmap/misconceptions` | Already implemented with caching; use it |

---

## Database Schema (New Tables Required)

All three tables are new. The DB currently has: `users`, `sessions`, `accounts`, `verificationTokens`, `classes`, `classEnrollments`. [VERIFIED: packages/db/src/schema/index.ts]

```typescript
// packages/db/src/schema/questions.ts
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const questions = pgTable('questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  aiResponse: text('ai_response'),        // stored after streaming completes
  routingMode: text('routing_mode', { enum: ['enrich', 'diagnose'] }),
  routingMisconceptionId: text('routing_misconception_id'), // null when enrich
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const concepts = pgTable('concepts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domain: text('domain').notNull(),       // 'physics' | 'biology' | 'math' | 'history' | 'general'
  status: text('status', { enum: ['unprobed', 'healthy', 'misconception'] })
    .notNull().default('unprobed'),
  // embedding column deferred to Phase 3
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const conceptQuestions = pgTable('concept_questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  conceptId: text('concept_id').notNull().references(() => concepts.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
});
```

**Key schema decision (Claude's Discretion):** The `aiResponse` column stores the complete answer after streaming finishes (populated in `onFinish` callback). During streaming, the client receives text via SSE. This avoids partial responses in history.

**Phase 3 note:** The `concepts` table intentionally omits an `embedding` vector column. Phase 3 will `ALTER TABLE` to add it. Drizzle handles this via a new migration.

---

## Common Pitfalls

### Pitfall 1: AI SDK Version Mismatch (CRITICAL)

**What goes wrong:** Code written with v4 `generateObject` import will compile but `generateObject` is deprecated in v6 and removed from the primary recommended API surface. The CONTEXT.md discussion references v4 patterns.

**Why it happens:** The project has not yet installed `ai` or `@ai-sdk/anthropic`; when installing, `npm install ai` gets v6.0.154 today.

**How to avoid:** Use `generateText` with `Output.object({ schema })` instead of `generateObject`. Use `toUIMessageStreamResponse()` instead of `toDataStreamResponse()`.

**Warning signs:** TypeScript errors on `generateObject` import, or `toDataStreamResponse is not a function` at runtime.

### Pitfall 2: Missing maxDuration on Streaming Route

**What goes wrong:** Vercel serverless functions time out at 10 seconds by default. Claude generating a rich K-12 answer takes 5-20 seconds.

**Why it happens:** Default Vercel function timeout.

**How to avoid:** Add `export const maxDuration = 30;` (or higher, up to 60 for hobby plan) to `apps/web/app/api/ask/route.ts`.

**Warning signs:** Stream cuts off mid-response on Vercel deployments; works fine locally.

### Pitfall 3: Streak Timezone Bug

**What goes wrong:** A student asks a question at 11pm EST. The server (UTC) records it as the next calendar day. Their streak breaks the following day.

**Why it happens:** `new Date()` is UTC on the server; day boundaries differ per user timezone.

**How to avoid:** For v1 simplicity, compute streak in UTC consistently. Document this limitation. Alternatively, store a `date` (not timestamp) column separately using Postgres `CURRENT_DATE AT TIME ZONE 'UTC'`.

**Warning signs:** Streaks break or double-count for students in different timezones.

### Pitfall 4: Concurrent Duplicate Question Submission

**What goes wrong:** Student double-clicks submit; two POST requests race to the DB. Both pass the one-per-day check before either inserts.

**Why it happens:** The one-per-day check is not atomic with the insert.

**How to avoid:** Add a DB-level unique index on `(user_id, DATE(created_at))`. Drizzle supports this via `uniqueIndex`:

```typescript
import { uniqueIndex, sql } from 'drizzle-orm/pg-core';

// In questions table definition:
}, (t) => [
  uniqueIndex('questions_user_date_unique')
    .on(t.userId, sql`DATE(${t.createdAt})`)
]);
```

**Warning signs:** Users occasionally get two questions recorded for the same day.

### Pitfall 5: LLM onFinish vs. Streaming Race

**What goes wrong:** The API route returns the stream response, but `onFinish` callback runs after. If `onFinish` throws (DB error during concept extraction), the user sees a successful stream but no concepts are saved.

**Why it happens:** `onFinish` is fire-and-forget after `toUIMessageStreamResponse()` is returned.

**How to avoid:** Wrap `onFinish` body in try/catch and log errors to console. Concept extraction failure should not surface to the user. Add a retry mechanism or queue in Phase 3+ if needed.

**Warning signs:** Questions appear in history with no concepts attached; server logs show extraction errors.

### Pitfall 6: react-markdown Client Bundle Boundary

**What goes wrong:** `react-markdown` uses `use client` internally in some versions. Importing it in a Server Component causes a build error.

**Why it happens:** react-markdown v10 uses React hooks internally.

**How to avoid:** Only import `react-markdown` inside components marked `'use client'`. Create a thin `<AnswerDisplay markdown={text} />` client component to contain it.

**Warning signs:** Next.js build error: "You're importing a component that needs useEffect."

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateObject()` (v4/v5) | `generateText` + `Output.object()` (v6) | AI SDK v6, 2025 | Must use new API; old import still exists but deprecated |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` | AI SDK v6 | Different method name on StreamTextResult |
| `useChat` for completions | `useCompletion` for single-turn prompts | AI SDK v4+ | useCompletion is correct for question-answer (not multi-turn chat) |
| Manual SSE parsing | `useCompletion` hook | AI SDK v3+ | Never hand-roll |

**Deprecated/outdated:**
- `generateObject`: Deprecated in AI SDK v6. Code still runs but scheduled for removal. Use `generateText` + `Output.object()`.
- `toDataStreamResponse()`: Removed in AI SDK v6. Use `toUIMessageStreamResponse()`.

---

## Code Examples

### Full enrich flow skeleton (verified pattern)

```typescript
// apps/web/app/api/ask/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { auth } from '@/lib/auth';
import { db, schema } from '@mindmap/db';
import { and, eq, gte, lt } from 'drizzle-orm';
import { createLLMAdapter } from '@mindmap/llm';
import { routeQuestion } from '@mindmap/router';

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { question } = await req.json();
  const userId = session.user.id;

  // 1. One-per-day check
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const existing = await db.query.questions.findFirst({
    where: and(eq(schema.questions.userId, userId), gte(schema.questions.createdAt, today), lt(schema.questions.createdAt, tomorrow)),
  });
  if (existing) return Response.json({ error: 'One question per day' }, { status: 429 });

  // 2. Get grade level from enrollment (most recent class)
  const enrollment = await db.query.classEnrollments.findFirst({
    where: eq(schema.classEnrollments.studentId, userId),
    orderBy: (t, { desc }) => [desc(t.enrolledAt)],
  });
  const gradeLevel = enrollment?.gradeLevel ?? 6; // default grade 6 if unenrolled

  // 3. Stream answer
  const adapter = createLLMAdapter();
  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: adapter.buildEnrichPrompt(gradeLevel),
    prompt: question,
    onFinish: async ({ text }) => {
      try {
        // Save question row
        const [saved] = await db.insert(schema.questions).values({
          userId, text: question, aiResponse: text,
        }).returning();
        // Extract concepts (async, non-blocking for user)
        const concepts = await adapter.extractConcepts(question, text);
        // Route each concept
        for (const concept of concepts) {
          const decision = routeQuestion(concept.name, gradeLevel, concept.domain);
          // Insert concept node + link to question
          const [node] = await db.insert(schema.concepts).values({
            userId, name: concept.name, domain: concept.domain, status: 'unprobed',
          }).returning();
          await db.insert(schema.conceptQuestions).values({ conceptId: node.id, questionId: saved.id });
          // Log routing decision on question row (update)
          if (decision.mode === 'diagnose') {
            console.log(`[router] diagnose: ${concept.name} → ${decision.misconceptionId}`);
          }
        }
      } catch (err) {
        console.error('[onFinish] concept extraction failed:', err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
```

[CITED: ai-sdk.dev streaming patterns; adapted to project conventions]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 (installed in @mindmap/misconceptions) |
| Config file | `packages/router/vitest.config.ts` (Wave 0 gap — needs creation) |
| Quick run command | `pnpm --filter @mindmap/router test` |
| Full suite command | `pnpm --filter "@mindmap/*" test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CURI-01 | Rejects second question same day | unit | `pnpm --filter @mindmap/router test` | No — Wave 0 |
| CURI-02 | System prompt contains grade level | unit | `pnpm --filter @mindmap/llm test` | No — Wave 0 |
| CURI-06 | Concept extraction returns valid schema | unit | `pnpm --filter @mindmap/llm test` | No — Wave 0 |
| MISC-04 | routeQuestion returns enrich for unknown concept | unit | `pnpm --filter @mindmap/router test` | No — Wave 0 |
| MISC-04 | routeQuestion returns diagnose for known misconception | unit | `pnpm --filter @mindmap/router test` | No — Wave 0 |
| MISC-05 | Grade band mapping: 0-5 → K-5, 6-8 → 6-8, 9-12 → 9-12 | unit | `pnpm --filter @mindmap/router test` | No — Wave 0 |
| PRIV-01 | Enrich system prompt contains no user name or email | unit | `pnpm --filter @mindmap/llm test` | No — Wave 0 |
| INFR-04 | createLLMAdapter returns different type per env var | unit | `pnpm --filter @mindmap/llm test` | No — Wave 0 |

### Wave 0 Gaps

- [ ] `packages/router/vitest.config.ts` — router package has no test infrastructure yet
- [ ] `packages/router/src/__tests__/router.test.ts` — covers MISC-04, MISC-05, grade band mapping
- [ ] `packages/llm/vitest.config.ts` — llm package has no test infrastructure yet
- [ ] `packages/llm/src/__tests__/prompts.test.ts` — covers CURI-02, PRIV-01
- [ ] `packages/llm/src/__tests__/adapter.test.ts` — covers INFR-04 factory

The `@mindmap/router` tests are pure functions (no I/O, no mocking) and can run immediately once Vitest is configured.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth.js session via `auth()` — already implemented in Phase 1 |
| V3 Session Management | yes | Database session strategy in Auth.js — already implemented |
| V4 Access Control | yes | `auth()` check at API route entry; users only access their own questions |
| V5 Input Validation | yes | Zod schema validates question payload length; 500-char max recommended |
| V6 Cryptography | no | No new crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Student submits question on behalf of another student | Spoofing | Only use `session.user.id` from Auth.js, never from request body |
| LLM prompt injection via malicious question text | Tampering | System prompt is authoritative; user question is `prompt:`, not `system:`; Claude 3.5 is resilient to simple injection |
| Excessive API calls (rate abuse) | Denial of Service | One-per-day DB check + 429 response; consider `ANTHROPIC_API_KEY` usage monitoring |
| PII leak in prompts (PRIV-01) | Information Disclosure | Prompt builder uses only grade level + question text; no name/email/userId ever passed to Claude |
| XSS via AI-generated markdown | Tampering | `react-markdown` renders to safe React elements (not `dangerouslySetInnerHTML`); no additional sanitization needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Grade band boundaries: 0-5 → "K-5", 6-8 → "6-8", 9-12 → "9-12" | gradeLevelToGradeBand utility | Wrong boundary could route K-5 misconceptions to 6th graders; low risk since YAML entries show these are the exact three bands used |
| A2 | `generateObject` still compiles in AI SDK v6 (just deprecated, not removed) | Standard Stack warning | If removed, code using it will fail to compile; confirmed deprecated per migration guide, but runtime behavior not directly verified |
| A3 | Streak computation via UTC day boundaries is acceptable for v1 | Streak Calculation pattern | Students at day-boundary timezone edges may see incorrect streak; documented limitation |
| A4 | Grade level from most recent enrollment is correct grade context | API route gradeLevel lookup | Student in multiple classes could get wrong grade context for routing; edge case, acceptable for v1 |

---

## Open Questions

1. **What if the student has no class enrollment?**
   - What we know: The DB check for grade level uses `classEnrollments.findFirst`. If no enrollment exists, grade level is undefined.
   - What's unclear: Should unenrolled students be blocked from asking questions, or default to a grade level?
   - Recommendation: Default to grade 6 (middle school) as a safe fallback. The question can still be answered; routing will just use grade 6 context.

2. **Where is the routing decision logged per question?**
   - What we know: CONTEXT.md says "log the decision but serve enrich mode." The questions table has `routingMode` and `routingMisconceptionId` columns.
   - What's unclear: Should each concept's routing decision be logged, or just the first/most relevant?
   - Recommendation: Log the routing decision for the first "diagnose" match per question. If all concepts route to "enrich", record `routingMode = 'enrich'`, `routingMisconceptionId = null`.

3. **How does the student dashboard get the grade level for the form?**
   - What we know: The student page is a Server Component and can call `getStudentEnrollments()`.
   - What's unclear: Should the grade level be passed as a prop to the client QuestionForm, or fetched in the API route?
   - Recommendation: Pass grade level as a prop from the Server Component to the `QuestionForm` client component. This avoids an extra DB round-trip in the API route.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | questions/concepts tables | Assumed available (Docker from Phase 1) | 16 | — |
| `ANTHROPIC_API_KEY` env var | Claude API calls | Unknown — not verified | — | Set before running; no fallback |
| `ai` npm package | @mindmap/llm | Not installed yet | — | Install: `pnpm add ai` |
| `@ai-sdk/anthropic` npm package | @mindmap/llm | Not installed yet | — | Install: `pnpm add @ai-sdk/anthropic` |
| `@ai-sdk/react` npm package | apps/web | Not installed yet | — | Install: `pnpm add @ai-sdk/react` |
| `react-markdown` npm package | apps/web | Not installed | — | Install: `pnpm add react-markdown remark-gfm` |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY`: Must be set in `.env.local` before the LLM adapter can make calls. No fallback exists for the primary provider. Wave 0 should include an env var setup step.

**Missing dependencies with fallback:**
- All npm packages above can be installed as part of Wave 0 setup tasks.

---

## Sources

### Primary (HIGH confidence)
- [ai-sdk.dev/docs/migration-guides/migration-guide-6-0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) — generateObject deprecation, toUIMessageStreamResponse, v5→v6 breaking changes
- [ai-sdk.dev/docs/getting-started/nextjs-app-router](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) — streamText + toUIMessageStreamResponse pattern
- [ai-sdk.dev/docs/ai-sdk-ui/completion](https://ai-sdk.dev/docs/ai-sdk-ui/completion) — useCompletion hook API
- npm registry: `npm view ai version` → 6.0.154, `npm view @ai-sdk/anthropic version` → 3.0.68, `npm view @ai-sdk/react version` → 3.0.156
- Codebase: `packages/db/src/schema/auth.ts`, `classes.ts` — existing schema; `packages/misconceptions/src/schema.ts` — GradeBand type; `packages/misconceptions/library/physics.yaml` — confirmed three grade bands

### Secondary (MEDIUM confidence)
- [ai-sdk.dev/docs/ai-sdk-core/generating-structured-data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — Output.object pattern (v6)
- FPF "Vetting Generative AI Tools for Use in Schools" (Oct 2024) — grade level not PII under FERPA

### Tertiary (LOW confidence)
- WebSearch results on FERPA/COPPA guidance — general privacy best practices, not MindMap-specific legal opinion

---

## Metadata

**Confidence breakdown:**
- Standard stack (library versions): HIGH — verified via npm registry
- AI SDK v6 API surface: MEDIUM — verified via official migration guide; exact `generateObject` deprecation timeline not pinned
- DB schema design: HIGH — follows established Phase 1 Drizzle patterns exactly
- Router string matching: HIGH — simple algorithm; YAML structure confirmed in codebase
- Privacy guidance: MEDIUM — general FERPA principles applied; not legal advice

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (AI SDK moves fast; recheck `ai` version before installing)
