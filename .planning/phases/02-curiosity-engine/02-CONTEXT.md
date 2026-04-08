# Phase 2: Curiosity Engine - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the daily curiosity question flow: student submits a question, receives a streaming AI answer with a Socratic follow-up, concepts are extracted and stored as graph nodes, the routing engine decides enrich vs. diagnose mode, and students can view their question history with streak tracking.

</domain>

<decisions>
## Implementation Decisions

### AI Answer Pipeline
- Streaming responses via Vercel AI SDK `streamText` — better UX, user sees answer forming in real-time
- One-question-per-day enforced via DB check: query today's questions for user, reject if count >= 1
- Concept extraction via separate `generateObject` call with Zod schema after main answer — cleaner, typed output, no parsing fragility
- Grade-appropriate language via system prompt: "Explain at a grade {N} level" using student's grade level from profile

### Routing Engine
- Routing logic lives in `@mindmap/router` package — testable, separated from Next.js API routes
- Concept-to-misconception matching via string matching on concept name + domain + grade band — simple v1, no embeddings needed yet (Phase 3 adds pgvector)
- When routing picks "diagnose" in Phase 2: log the decision but serve enrich mode — diagnose flow built in Phase 4
- Socratic follow-up is part of the main answer prompt: "End with one thought-provoking follow-up question" — avoids doubling latency

### Question UI & History
- Question input centered on student dashboard as primary CTA: "What are you curious about today?"
- Answer displayed as markdown rendered inline below the question
- Streak display as small badge/counter near profile: "🔥 5 days" — visible but not dominant
- Question history as reverse-chronological list with date headers — simple, scannable

### Claude's Discretion
- Specific Anthropic Claude API prompt structure and system message content
- Zod schema shape for concept extraction output
- Exact database schema for questions and sessions tables
- Markdown rendering library choice (react-markdown or similar)
- Error handling for LLM API failures and rate limits

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@mindmap/db` — Drizzle client and schema (users, sessions, classes, etc.)
- `@mindmap/misconceptions` — loadLibrary(), getMisconceptionsByDomainAndBand() for routing lookups
- `@mindmap/llm` — stub with LLMAdapter interface (needs implementation)
- `@mindmap/router` — stub with RoutingDecision type (needs implementation)
- `apps/web/lib/auth.ts` — auth() function for session access
- `apps/web/components/layout/` — app shell and sidebar
- shadcn/ui components already installed (button, input, card, etc.)

### Established Patterns
- Server actions in `apps/web/actions/` (see auth.ts, class.ts)
- Auth via `auth()` call in server actions and pages
- Drizzle queries with `db.insert()`, `db.query()`, `eq()` from drizzle-orm
- Next.js App Router with route groups: (auth), student/, teacher/

### Integration Points
- New questions table in `@mindmap/db` schema
- New concepts table in `@mindmap/db` schema (nodes for the knowledge graph)
- New API route for streaming AI responses
- Student dashboard page needs the question input and history

</code_context>

<specifics>
## Specific Ideas

- Vercel AI SDK's `streamText` with `@ai-sdk/anthropic` provider for Claude API calls
- `generateObject` with Zod schema for structured concept extraction
- Questions table: id, userId, text, aiResponse, createdAt
- Concepts table: id, name, subjectDomain, userId, createdAt (embeddings added in Phase 3)
- ConceptQuestions join table: conceptId, questionId (many-to-many)
- The routing decision should be logged per question for debugging and Phase 4 integration
- Research noted: pgvector cosine distance operator `<=>` returns distance, not similarity

</specifics>

<deferred>
## Deferred Ideas

- pgvector embeddings and semantic deduplication — Phase 3
- Diagnose mode Socratic flow — Phase 4
- Cross-subject bridge detection — Phase 3

</deferred>
