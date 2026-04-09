# Architecture

**Analysis Date:** 2026-04-09

## Pattern Overview

**Overall:** Full-stack monorepo with layered service architecture: Next.js app wrapping domain-specific packages communicating via TypeScript interfaces and async message passing. Knowledge graph owned by database layer (Drizzle ORM), pedagogical state machine (enrich/diagnose routing) owned by middleware layer (`@mindmap/router`), LLM orchestration isolated in `@mindmap/llm`, misconception library version-controlled in YAML in `@mindmap/misconceptions`.

**Key Characteristics:**
- Monorepo with Turborepo orchestration across 4 packages + 1 app
- Strict separation of concerns: each package exports a public API surface
- Server-centric data flow: Server Actions in Next.js, streaming responses via Vercel AI SDK
- Type safety across boundaries: Zod schemas validate at every trust boundary (client → server, LLM outputs, database reads)
- No global client state: React `useState` for transient UI only (graph zoom, selected node); database is source of truth

## Layers

**Presentation (Next.js App Router):**
- Purpose: Server-rendered pages, streaming responses, client form handling
- Location: `/apps/web/app`
- Contains: Route handlers (`route.ts`), layout components (`layout.tsx`), page components (`page.tsx`), client components
- Depends on: All four packages + `lib/auth`, `lib/graph`, `actions/*`
- Used by: Browser clients (students, teachers)
- Boundary: Middleware (`middleware.ts`) enforces auth redirect for `/student/*` and `/teacher/*`

**Server Actions & API Endpoints:**
- Purpose: Secure RPC layer for client-server communication
- Location: `/apps/web/actions/*.ts` (Server Actions) and `/apps/web/app/api/**/*.ts` (Route Handlers)
- Contains: Database queries, LLM calls, business logic not exposed to client
- Depends on: Database, LLM, Router packages; auth context from session
- Used by: Client components via `useAction` hook or `fetch()`
- Boundary: `"use server"` pragma enforces server-only execution; auth checks at function entry

**Database & Query Layer:**
- Purpose: PostgreSQL schema definition, Drizzle ORM setup, typed query helpers
- Location: `/packages/db/src/`
- Contains: Drizzle schema (auth, questions, concepts, edges), query builders, seed data
- Depends on: `drizzle-orm`, `pg`, `pgvector`, `@neondatabase/serverless`
- Used by: All server code (API routes, Server Actions, edge endpoints)
- Boundary: `db` singleton exported from `/packages/db/src/index.ts`, schema types drive all queries

**LLM Orchestration:**
- Purpose: Anthropic Claude integration, prompt engineering, concept extraction, misconception diagnosis
- Location: `/packages/llm/src/`
- Contains: Adapter factory, Anthropic adapter, prompt builders (enrich/probe/confront/resolve), extraction schema
- Depends on: `ai` (Vercel AI SDK), `@ai-sdk/anthropic`, Zod
- Used by: API routes (`/api/ask`, `/api/diagnose`) and Router package for semantic fallback
- Boundary: Typed exports of `extractConcepts()`, `buildProbeSystemPrompt()`, etc.; adapters are swappable

**Routing & Decision Engine:**
- Purpose: Route extracted concepts to enrich or diagnose mode; semantic fallback for LLM disambiguation
- Location: `/packages/router/src/`
- Contains: String-match router (`routeQuestion`), semantic fallback (`semanticFallback`), grade-to-band converter
- Depends on: Misconceptions package for library queries, AI SDK for LLM calls
- Used by: POST `/api/ask` to decide primary misconception to diagnose
- Boundary: Pure functions + deterministic decision export; stateless except for library caching

**Misconceptions Library:**
- Purpose: Version-controlled YAML registry of student misconceptions, Zod validation
- Location: `/packages/misconceptions/src/` and `/packages/misconceptions/library/`
- Contains: Loader (filesystem → YAML → Zod validation), schema definitions, in-memory cache
- Depends on: `js-yaml`, Zod
- Used by: Router (string/semantic matching), API endpoints (probe/confront/resolve lookups)
- Boundary: Singleton loader with cache reset function; misconceptions keyed by domain + grade band + ID

**Component & UI Layer:**
- Purpose: React UI components, form handling, graph visualization
- Location: `/apps/web/components/`
- Contains: shadcn/ui primitives, domain components (auth, dashboard, graph, diagnostic), layout
- Depends on: React 19, Tailwind CSS v4, react-hook-form, D3.js, Three.js, sonner toast
- Used by: Page components in Next.js App Router
- Boundary: Client components (`"use client"`) for interactivity; Server Components where possible for data fetching

## Data Flow

**A. Student Asks a Question (Enrich Path):**

1. Student submits question via `QuestionForm` (client component)
2. Form posts to `/api/ask` (Route Handler, Server Action wrapper)
3. Route Handler validates input with Zod, checks one-per-day constraint, extracts userId from session
4. LLM calls Claude via Vercel AI SDK with `buildEnrichSystemPrompt(gradeLevel)`
5. Claude streams response; on finish callback:
   - Insert Question record in DB
   - Extract concepts via `extractConcepts(question, response)` (LLM call with Zod schema)
   - Route each concept: `routeQuestion(conceptName, gradeLevel, domain)` (string match + semantic fallback)
   - For each concept: generate embedding, search pgvector for duplicates, merge or create new
   - Create `concept_questions` join records
   - Create `curiosity_link` edges between all concepts from this question
   - If diagnose mode → create `diagnosticSessions` record at stage "probe"
6. Response streams to client; client shows AI answer

**B. Student Enters Diagnostic Flow (Diagnose Path):**

1. Diagnostic session created in `/api/ask` onFinish (server-side, cannot be faked by client)
2. Session state machine in `/api/diagnose`:
   - **probe stage**: LLM asks probe question from misconception library
   - **classify stage** (transient): LLM reads probe response, decides if misconception is evident
   - **confront stage**: LLM presents confrontation scenario to trigger cognitive conflict
   - **resolve stage** (terminal): LLM evaluates if misconception was resolved; concept status updated
3. Each stage message (role, content) persisted in `diagnosticSessions.messages` array (JSONB)
4. Client polls `/api/diagnose` with sessionId; server loads session, streams next stage prompt
5. On final stage completion, concept status changes: `misconception` → `healthy` (resolved) or stays `misconception`

**C. Teacher Views Dashboard:**

1. Teacher navigates to `/teacher/classes/[classId]/dashboard`
2. Server Action `getDashboardData()` aggregates:
   - Class roster (students, enrollment dates, grade levels)
   - Student query counts (questions per day, streaks)
   - Misconception clusters (frequency by domain, by student)
   - Curiosity patterns (most common concepts by grade band)
3. Dashboard renders charts (D3-powered bar charts, heatmaps) using aggregated data
4. Data refreshes on page load; no real-time subscriptions

**D. Student Explores Knowledge Graph:**

1. Student navigates to `/student/graph`
2. Server Action `getGraphData()` queries:
   - All concepts for userId with status, embedding, visit count
   - All concept_edges for userId with co-occurrence weight (derived from concept_questions joins)
   - Bridge connection data (semantically similar concept pairs across different curiosity contexts)
3. `GraphPageClient` (client component) receives nodes + edges, passes to D3.js force simulation
4. D3 renders 4 node types (healthy=teal, unprobed=white, misconception=coral, bridge=gold)
5. Client interactions (drag, hover, zoom) handled by D3; no server calls during interaction

**State Management:**
- Database: Canonical source for knowledge graph, questions, sessions, user roles
- Session: Auth state in NextAuth v5 session cookie
- Component state: Transient UI state (selected node, graph zoom, form input) in React hooks only
- No Redux, Zustand, or context API for domain state

## Key Abstractions

**LLMAdapter:**
- Purpose: Abstract Claude client behind interface; factory enables provider swapping
- Examples: `/packages/llm/src/adapters/anthropic.ts`, factory in `/packages/llm/src/adapters/factory.ts`
- Pattern: Factory function returns adapter instance; adapter has `getModel()` and `getModelId()` methods

**RoutingDecision:**
- Purpose: Type-safe enum for concept routing outcome
- Examples: `{ mode: "enrich" }` or `{ mode: "diagnose"; misconceptionId: string; probability: number }`
- Usage: Returned by `routeQuestion()`, merged with semantic matches, used to create diagnostic sessions

**DiagnosticSession State Machine:**
- Purpose: Enforce valid stage transitions (probe → classify → confront → resolve)
- States: `probe` (initial), `classify` (transient), `confront`, `resolve` (terminal)
- Pattern: Server-side stage validation in `/api/diagnose` before proceeding; stage updates persisted to DB

**ConceptDeduplication Pipeline (GRPH-02):**
- Purpose: Prevent concept name duplicates while allowing semantic equivalence
- Stages: 
  1. Generate embedding for extracted concept name via OpenAI
  2. pgvector HNSW ANN search for similar existing concepts (cosine similarity >= 0.85)
  3. If similarity > 0.92 → auto-merge (increment visitCount)
  4. If 0.85-0.92 → LLM disambiguation (ask if names refer to same concept)
  5. If no match or LLM says different → create new concept with embedding
- Pattern: Run in POST `/api/ask` onFinish; single concept per concept_questions join

**Misconception Library Cache:**
- Purpose: Load YAML once, validate against Zod, cache in memory
- Examples: `/packages/misconceptions/src/loader.ts`
- Pattern: Singleton with `resetLibraryCache()` for testing; loaded from filesystem at startup or on-demand

## Entry Points

**POST /api/ask:**
- Location: `/apps/web/app/api/ask/route.ts`
- Triggers: Student question submission from QuestionForm
- Responsibilities: Stream AI enrichment response, extract concepts, route to enrich/diagnose, create diagnostic session if needed, handle embedding/deduplication

**POST /api/diagnose:**
- Location: `/apps/web/app/api/diagnose/route.ts`
- Triggers: Diagnostic session message or stage advancement
- Responsibilities: Load session with ownership check, execute stage-appropriate system prompt, stream response, persist messages and stage transitions

**GET /student/graph:**
- Location: `/apps/web/app/student/graph/page.tsx`
- Triggers: Student navigation to graph view
- Responsibilities: Fetch graph data (nodes, edges, bridge connections), render via D3.js

**GET /student/page:**
- Location: `/apps/web/app/student/page.tsx`
- Triggers: Student dashboard (daily curiosity prompt)
- Responsibilities: Check if student asked today, fetch today's question/response, render QuestionForm

**GET /teacher/page:**
- Location: `/apps/web/app/teacher/page.tsx`
- Triggers: Teacher home (class list)
- Responsibilities: List teacher's classes, link to class dashboards

**GET /teacher/classes/[classId]/dashboard:**
- Location: `/apps/web/app/teacher/classes/[classId]/dashboard/page.tsx`
- Triggers: Teacher opens class dashboard
- Responsibilities: Fetch and render aggregated misconception data, curiosity patterns, engagement metrics

## Error Handling

**Strategy:** Fail open (graceful degradation) for non-critical features; fail closed for auth/data integrity.

**Patterns:**

- **Embedding failure**: If OpenAI embedding call fails, concept inserted without embedding; deduplication skipped for that concept
  - Code: `/apps/web/app/api/ask/route.ts` line 263-277
  - Impact: Knowledge graph less precise but still functional

- **Semantic fallback failure**: If LLM semantic matching fails, returns empty array; concepts remain in enrich mode
  - Code: `/packages/router/src/semantic-fallback.ts` line 67-70
  - Impact: Some misconceptions not detected; misconception entry rejected if not in library

- **Missing API keys**: Return 503 immediately with user-facing message
  - Code: `/apps/web/app/api/ask/route.ts` line 69-75, `/apps/web/app/api/diagnose/route.ts` line 49-55
  - Impact: Student sees "AI features require configuration" rather than silent hang

- **Invalid misconception ID**: LLM-generated misconception IDs rejected; validated against library before creating session
  - Code: `/apps/web/app/api/ask/route.ts` line 301-327
  - Impact: Prevents fabricated misconceptions from entering graph

- **Session ownership violation**: Return 404 (not 403) for unauthorized session access
  - Code: `/apps/web/app/api/diagnose/route.ts` line 58-71
  - Impact: Students cannot discover other students' sessions via error messages (INFR-07 / T-04-05)

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.log` / `console.error` in server code; structured logging for routing/deduplication decisions
- Pattern: Prefixed logs: `[router]`, `[dedup]`, `[diagnose]` for easy grep
- Location: `/apps/web/app/api/ask/route.ts` lines 186-261, `/packages/router/src/semantic-fallback.ts` line 68

**Validation:**
- Approach: Zod schemas at every boundary; Drizzle ORM column types enforce DB constraints
- Pattern: `safeParse()` for user input; `.parse()` for trusted internal data; custom refinements for business logic
- Examples: 
  - `questionSchema` (POST body) in `/apps/web/app/api/ask/route.ts`
  - `misconceptionLibrarySchema` in `/packages/misconceptions/src/schema.ts`
  - `conceptExtractionSchema` in `/packages/llm/src/prompts/extract.ts`

**Authentication:**
- Approach: NextAuth v5 with email/password provider; session-based, checked at middleware + endpoint entry
- Pattern: `auth()` Server Action returns session with user.id; compared against DB records; 401/404 on mismatch
- Scope: All `/student/*` and `/teacher/*` routes protected by middleware; public routes (login, signup, /) accessible to all
- Location: Middleware `/apps/web/middleware.ts`, auth config `/apps/web/lib/auth.config.ts`, auth setup `/apps/web/lib/auth.ts`

**Data Privacy (PRIV-01):**
- Approach: Only question text + gradeLevel sent to Claude; no PII, no user names, no enrollment data
- Pattern: Comments in code mark PII boundaries; explicit parameter lists prevent accidental data leakage
- Location: `/apps/web/app/api/ask/route.ts` line 84-87 (enrichment), `/apps/web/app/api/diagnose/route.ts` line 96 (diagnostic)

**Rate Limiting:**
- Approach: One question per calendar day per student (UTC time range check)
- Pattern: Query questions created between startOfDay and startOfTomorrow; return 429 if found
- Location: `/apps/web/app/api/ask/route.ts` line 49-67

---

*Architecture analysis: 2026-04-09*
