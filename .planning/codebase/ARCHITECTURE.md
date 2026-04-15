# Architecture

**Analysis Date:** 2026-04-14

## Pattern Overview

**Overall:** Full-stack monorepo with layered service architecture. A single Next.js 15 App Router application (`apps/web`) depends on four domain-specific TypeScript packages (`@mindmap/db`, `@mindmap/llm`, `@mindmap/misconceptions`, `@mindmap/router`). Server Actions and Route Handlers form the RPC surface between client and server. LLM orchestration is isolated behind an adapter interface. Knowledge graph state lives in PostgreSQL with pgvector for semantic deduplication. Misconceptions are version-controlled YAML with Zod validation.

**Key Characteristics:**
- Turborepo monorepo with 4 packages + 1 app, pnpm workspaces
- Server-centric: all business logic in Server Actions or Route Handlers; client components own only transient UI state
- Type safety across all boundaries: Zod schemas validate LLM outputs, API inputs, YAML library entries, and form submissions
- Two LLM providers: Anthropic Claude (text generation/diagnostics) and OpenAI (embeddings only)
- Streaming responses via Vercel AI SDK for both enrichment and diagnostic conversations
- No global client state management library; React `useState`/`useReducer` for component-local state only

## Package/Module Boundaries

| Package | Responsibility | Public API | Depends On |
|---------|---------------|------------|------------|
| `@mindmap/db` | PostgreSQL schema (Drizzle), connection pool, typed query helpers | `db`, `schema`, `findSimilarConcepts()`, `createConceptEdges()`, `getEdgeCoOccurrences()`, `deleteExpiredUsers()` | `drizzle-orm`, `pg`, `pgvector`, `@neondatabase/serverless` |
| `@mindmap/llm` | LLM adapter factory, prompt builders, concept extraction, embedding generation | `createLLMAdapter()`, `extractConcepts()`, `generateEmbedding()`, `buildEnrichSystemPrompt()`, `buildProbeSystemPrompt()`, `buildConfrontSystemPrompt()`, `evaluateResolution()`, `generateLessonPlan()`, `analyzeStudentThemes()` | `ai` (Vercel AI SDK), `@ai-sdk/anthropic`, `@ai-sdk/openai`, `zod` |
| `@mindmap/misconceptions` | YAML misconception library loader, Zod validation, in-memory cache | `loadLibrary()`, `loadThemes()`, `getMisconceptionsByDomainAndBand()`, `getMisconceptionById()`, `getMisconceptionsByTheme()`, `getThemeById()` | `js-yaml`, `zod` |
| `@mindmap/router` | Concept routing decision engine (enrich vs diagnose) | `routeQuestion()`, `semanticFallback()`, `gradeLevelToGradeBand()` | `@mindmap/misconceptions`, `ai`, `zod` |
| `apps/web` | Next.js application: pages, API routes, Server Actions, components | HTTP endpoints, rendered pages | All four packages above |

**Dependency graph (strictly unidirectional):**
```
apps/web → @mindmap/db
apps/web → @mindmap/llm
apps/web → @mindmap/misconceptions
apps/web → @mindmap/router → @mindmap/misconceptions
```

The `@mindmap/db` package has NO dependency on `@mindmap/llm`. The `LessonPlanJson` type in `packages/db/src/schema/theme-lesson-plans.ts` is a structural mirror declared locally to avoid a db-to-llm dependency.

## Layers

**Presentation (Next.js App Router):**
- Purpose: Server-rendered pages, streaming responses, client-side form handling
- Location: `apps/web/app/`
- Contains: Route handlers (`route.ts`), layout components (`layout.tsx`), page components (`page.tsx`), client components
- Depends on: All four packages + `lib/auth`, `lib/graph`, `actions/*`
- Used by: Browser clients (students, teachers)
- Boundary: Middleware (`apps/web/middleware.ts`) enforces auth redirect for `/student/*` and `/teacher/*` via NextAuth edge-safe config

**Server Actions:**
- Purpose: Secure RPC for data-reading operations callable from Server Components or client components
- Location: `apps/web/actions/*.ts`
- Files: `auth.ts`, `questions.ts`, `graph.ts`, `diagnostic.ts`, `dashboard.ts`, `class.ts`, `themes.ts`
- Pattern: Every function starts with `auth()` session check; userId always from session, never from client params
- Used by: Page components (Server Components via `await`) and client components (via import)

**API Route Handlers:**
- Purpose: Streaming LLM interactions that require Vercel AI SDK stream response format
- Location: `apps/web/app/api/`
- Endpoints: `POST /api/ask` (question enrichment), `POST /api/diagnose` (diagnostic conversation), `GET /api/cron/cleanup` (COPPA TTL)
- Pattern: Route Handlers for streaming; Server Actions for non-streaming data operations

**Database & Query Layer:**
- Purpose: PostgreSQL schema, Drizzle ORM, typed query helpers
- Location: `packages/db/src/`
- Schema files: `schema/auth.ts`, `schema/questions.ts`, `schema/classes.ts`, `schema/diagnostic-sessions.ts`, `schema/theme-lesson-plans.ts`
- Query helpers: `queries/concepts.ts` (pgvector ANN search, edge creation, co-occurrence), `queries/cleanup.ts` (COPPA TTL)
- Connection: `drizzle(new Pool({ connectionString: DATABASE_URL }), { schema })`
- Exports: `db` singleton, `schema` namespace, query functions

**LLM Orchestration:**
- Purpose: Anthropic Claude integration, prompt engineering, concept extraction, embedding generation
- Location: `packages/llm/src/`
- Adapter pattern: `adapters/factory.ts` returns `AnthropicAdapter` (currently the only provider)
- Prompt builders: `prompts/enrich.ts`, `prompts/extract.ts`, `prompts/disambiguate.ts`, `prompts/diagnose-probe.ts`, `prompts/diagnose-confront.ts`, `prompts/diagnose-resolve.ts`, `prompts/generate-lesson-plan.ts`, `prompts/analyze-student-themes.ts`
- Embeddings: `embeddings.ts` uses OpenAI `text-embedding-3-small` (1536 dimensions) via Vercel AI SDK
- Model: `claude-sonnet-4-20250514` hardcoded in `adapters/anthropic.ts`

**Routing & Decision Engine:**
- Purpose: Route concepts to enrich or diagnose mode
- Location: `packages/router/src/`
- Two-stage routing: string matching (`routeQuestion()`) then LLM semantic fallback (`semanticFallback()`)
- Stateless: receives model instance from caller, does not create its own adapter
- Confidence threshold: semantic matches require > 0.6 confidence

**Misconceptions Library:**
- Purpose: Version-controlled YAML registry of K-12 misconceptions with themes
- Location: `packages/misconceptions/library/` (YAML) and `packages/misconceptions/src/` (loader/schema)
- Domains covered: physics, biology, math, history
- Theme system: `library/themes.yaml` defines root-cause themes; misconceptions link to themes via `themes` array field
- Caching: singleton loader with `resetLibraryCache()` / `resetThemeCache()` for testing

**Component & UI Layer:**
- Purpose: React components organized by feature domain
- Location: `apps/web/components/`
- Subdirectories: `auth/`, `class/`, `dashboard/`, `diagnostic/`, `graph/`, `layout/`, `questions/`, `ui/`
- Graph rendering: D3.js 2D force simulation in `graph/knowledge-graph.tsx`, Three.js 3D solar system in `graph/solar-graph.tsx` / `graph/solar-scene.tsx`
- UI primitives: shadcn/ui in `ui/` (button, card, input, form, etc.)

**Utility Layer:**
- Purpose: Shared helpers, type definitions, graph algorithms
- Location: `apps/web/lib/`
- Auth: `lib/auth.ts` (NextAuth instance), `lib/auth.config.ts` (edge-safe config)
- Graph: `lib/graph/centrality.ts` (Brandes betweenness), `lib/graph/clusters.ts`, `lib/graph/domain-colors.ts`
- Dashboard: `lib/dashboard-types.ts`, `lib/theme-aggregation.ts`, `lib/theme-cache-hash.ts`

## Data Flow

**A. Student Asks a Question (Enrich + Concept Extraction):**

1. Student submits question via `QuestionForm` client component
2. Client POSTs to `/api/ask` (Route Handler)
3. Route Handler: Zod validates input, checks auth via `auth()`, enforces one-per-day UTC constraint
4. Route Handler: checks `ANTHROPIC_API_KEY` exists (503 if missing)
5. Route Handler: gets student grade level from most recent class enrollment
6. Route Handler: calls `streamText()` with `buildEnrichSystemPrompt(gradeLevel)` — streams response to client
7. `onFinish` callback (server-side, after stream completes):
   a. Insert Question record in DB with `routingMode: "enrich"`
   b. Call `extractConcepts(question, aiResponse)` — LLM extracts 2-4 concepts with domains using `generateText()` + Zod schema output
   c. Route each concept: `routeQuestion(conceptName, gradeLevel, domain)` — string match against misconception library
   d. Collect unmatched concepts → batch LLM `semanticFallback()` — single call for all unmatched
   e. Merge string matches + semantic matches; pick highest-confidence diagnose decision
   f. Update question record with final routing mode and misconception ID
   g. For each concept: generate 1536-dim OpenAI embedding → pgvector ANN search for duplicates → auto-merge (>0.92 similarity), LLM disambiguate (0.85-0.92), or create new (<0.85)
   h. Create `concept_questions` join records
   i. Create `curiosity_link` edges between all concepts from this question
   j. If diagnose mode: validate misconception ID against library, set concept status to "misconception", create `diagnosticSessions` record at stage "probe"

**B. Diagnostic Conversation (Probe → Confront → Resolve):**

1. Session created server-side in `/api/ask` `onFinish` (cannot be triggered by client)
2. Client sends POST to `/api/diagnose` with `{ sessionId, message }`
3. Server loads session with ownership check (`userId` from auth, not from request)
4. State machine stages:
   - **probe** (no messages): Build probe system prompt from misconception library's `probe_questions[0]`, stream initial probe question to student
   - **probe/classify** (with student response): Build confrontation prompt using `misconceptionEntry.confrontation_scenarios[0]`, transition to `classify` then `confront`, stream confrontation
   - **confront** (with student final response): Call `evaluateResolution()` — LLM evaluates if misconception was resolved, update concept status (`misconception` → `healthy` if resolved), build resolve reveal message, stream final response
   - **resolve** (terminal): Return JSON `{ stage, outcome, misconceptionName }` — no more streaming
5. Each stage persists full message history to `diagnosticSessions.messages` (JSONB array)
6. `convertToModelMessages()` (AI SDK v6) is always awaited — it is async

**C. Teacher Dashboard:**

1. Teacher navigates to `/teacher/classes/[classId]/dashboard`
2. Server Action `getClassDashboardData(classId)` in `actions/dashboard.ts`:
   - Auth + class ownership check (teacher must own class)
   - Batch fetch: enrollments → all concepts → all edges → all questions → all diagnostic sessions (no N+1 queries)
   - Compute per-student: streak, breadth score, inactivity status, mini graph data
   - Aggregate: concept heatmap (by name, cross-student), misconception clusters (by misconception ID), theme clusters (via `buildThemeClusters()`)
3. Theme clusters computed by JS-side Map join: project diagnostic_sessions through misconception library's `themes` field — NO extra DB query, NO theme column on sessions
4. Dashboard renders tabs: Overview, Students, Concepts, Misconceptions, Themes

**D. Theme Lesson Plan Generation:**

1. Teacher clicks "Generate Lesson Plan" for a theme in `actions/themes.ts`
2. Server computes `dataHash` (SHA-256 of misconception counts per theme)
3. Cache check: look for existing `theme_lesson_plans` row with matching `(classId, themeId, dataHash)`, ordered by `generatedAt DESC`
4. Cache miss: call `generateLessonPlan()` from `@mindmap/llm`, INSERT new row (never UPDATE — append-only history)
5. Force regenerate: skip cache lookup, always INSERT new row

**E. Student Knowledge Graph:**

1. Student navigates to `/student/graph`
2. Server Action `getGraphData()` in `actions/graph.ts`:
   - Fetch all concepts for userId (name, domain, status, visitCount)
   - Fetch all edges (source, target, type) where either endpoint belongs to user
   - Compute degree, betweenness centrality (Brandes algorithm in `lib/graph/centrality.ts`), bridge detection
   - Compute edge weights: 30% co-occurrence + 50% endpoint importance + 20% edge type bonus
   - Compute node importance: 35% degree + 30% betweenness + 25% visitCount + 10% bridge bonus
3. Client renders D3.js force-directed graph (2D) or Three.js 3D solar system
4. Node health states: `unprobed` (white/default), `healthy` (teal), `misconception` (coral), bridge (gold)
5. LLM-powered node search via `searchNodes()` — sends concept names to Claude for fuzzy matching

**State Management:**
- **Server state:** PostgreSQL is canonical source for all domain data (questions, concepts, edges, sessions, classes)
- **Client state:** React `useState` for transient UI (selected node, graph zoom, form inputs, tab selection)
- **Session state:** NextAuth v5 JWT session cookie — user ID and role stored in JWT via callbacks
- **Caching:** Misconception YAML loaded once per process, cached in module-level variable; lesson plan cache in DB with data hash

## Key Abstractions

**LLMAdapter (Factory Pattern):**
- Purpose: Abstract LLM provider behind a common interface
- Factory: `packages/llm/src/adapters/factory.ts` — `createLLMAdapter()` reads `LLM_PROVIDER` env var
- Implementation: `packages/llm/src/adapters/anthropic.ts` — wraps `@ai-sdk/anthropic` provider
- Interface: `getModel()` returns Vercel AI SDK model instance; `getModelId()` returns model string
- Extension: Add new adapter file, register in factory switch statement

**RoutingDecision (Discriminated Union):**
- Definition: `packages/router/src/index.ts`
- Shape: `{ mode: "enrich" }` | `{ mode: "diagnose"; misconceptionId: string; probability: number }`
- Used in: `/api/ask` onFinish to determine whether to create a diagnostic session

**DiagnosticSession State Machine:**
- States: `probe` → `classify` (transient) → `confront` → `resolve` (terminal)
- Outcomes: `resolved` | `unresolved` | `incomplete`
- Persistence: `stage` and `outcome` columns on `diagnostic_sessions` table; `messages` as JSONB array
- Transitions: Controlled exclusively by `/api/diagnose` Route Handler; client cannot manipulate stage

**Concept Deduplication Pipeline (GRPH-02):**
- Location: `apps/web/app/api/ask/route.ts` lines 183-295
- Three-tier decision:
  1. Similarity > 0.92 → auto-merge (increment visitCount on existing concept)
  2. Similarity 0.85-0.92 → LLM disambiguation via `disambiguateConcept()`
  3. Similarity < 0.85 or no match → create new concept with embedding
- Fallback: If embedding generation fails entirely, insert concept without embedding

**Theme Aggregation (THME-03):**
- Location: `apps/web/lib/theme-aggregation.ts`
- Pattern: Pure JS functions — no DB access, no auth imports — testable under Vitest
- Projection: Maps diagnostic_sessions rows through misconception library's `themes` field at query time
- No denormalized theme column on sessions table

**Lesson Plan Cache (LSPL-02):**
- Table: `theme_lesson_plans` in `packages/db/src/schema/theme-lesson-plans.ts`
- Cache key: `(classId, themeId, dataHash)` — dataHash is SHA-256 of misconception counts
- Append-only: never UPDATE rows; force regenerate creates new row with same cache key
- Index: non-unique (allows multiple rows per cache key for history)

## Entry Points

**POST /api/ask** — Question Enrichment:
- Location: `apps/web/app/api/ask/route.ts`
- Triggers: Student question submission from `QuestionForm`
- Auth: Session check, userId from `auth()`
- Responsibilities: Stream AI response, extract concepts, route to enrich/diagnose, embed/deduplicate concepts, create edges, optionally create diagnostic session

**POST /api/diagnose** — Diagnostic Conversation:
- Location: `apps/web/app/api/diagnose/route.ts`
- Triggers: Diagnostic chat messages from `DiagnosticChat` component
- Auth: Session check, session ownership verification
- Responsibilities: Execute stage-appropriate prompt, stream response, persist messages, transition stages, evaluate resolution

**GET /api/cron/cleanup** — COPPA TTL Enforcement:
- Location: `apps/web/app/api/cron/cleanup/route.ts`
- Triggers: Vercel Cron or system cron with `CRON_SECRET` bearer token
- Auth: Bearer token check (not NextAuth)
- Responsibilities: Delete expired users (cascades to all child data)

**GET|POST /api/auth/[...nextauth]** — Auth Endpoints:
- Location: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Triggers: NextAuth sign-in/sign-out/session flows
- Responsibilities: Delegate to NextAuth handlers

**/ (Landing Page):**
- Location: `apps/web/app/page.tsx`
- Client component with login/signup views
- Public access (no auth required)

**/student (Student Dashboard):**
- Location: `apps/web/app/student/page.tsx`
- Server Component: fetches hasAskedToday, todayQuestion, gradeLevel, todayConcepts, todayDiagnostic
- Renders `QuestionForm` with pre-fetched data

**/student/graph (Knowledge Graph):**
- Location: `apps/web/app/student/graph/page.tsx`
- Server data fetch via `getGraphData()`, client-side D3/Three.js rendering

**/student/diagnose/[sessionId] (Diagnostic Session):**
- Location: `apps/web/app/student/diagnose/[sessionId]/page.tsx`
- Renders `DiagnosticChat` for active diagnostic conversation

**/teacher (Teacher Home):**
- Location: `apps/web/app/teacher/page.tsx`
- Lists teacher's classes with join codes and links

**/teacher/classes/[classId]/dashboard (Class Dashboard):**
- Location: `apps/web/app/teacher/classes/[classId]/dashboard/page.tsx`
- Full dashboard with tabs: overview, students, concepts, misconceptions, themes

## Error Handling

**Strategy:** Fail open (graceful degradation) for non-critical AI features; fail closed for auth and data integrity.

**Patterns:**

- **Missing API keys:** Return HTTP 503 with user-facing message before any LLM call
  - Files: `apps/web/app/api/ask/route.ts` line 69-75, `apps/web/app/api/diagnose/route.ts` line 49-55

- **Embedding failure:** Concept inserted without embedding; deduplication skipped; graph less precise but functional
  - File: `apps/web/app/api/ask/route.ts` lines 263-284 (catch block with fallback insert)
  - Includes one retry with 500ms delay before falling back

- **Semantic fallback failure:** Returns empty array; concepts remain in enrich mode
  - File: `packages/router/src/semantic-fallback.ts` lines 64-70 (try/catch wrapping entire function)

- **Invalid misconception ID from LLM:** Validated against library before creating session; fabricated IDs rejected silently
  - File: `apps/web/app/api/ask/route.ts` lines 301-327

- **Session ownership violation:** Return 404 (not 403) to prevent information leakage
  - File: `apps/web/app/api/diagnose/route.ts` lines 58-71

- **One-per-day rate limit:** UTC date range query; return 429 if question exists
  - File: `apps/web/app/api/ask/route.ts` lines 49-67

- **Concept extraction failure in onFinish:** Caught and logged; question still saved even if concept extraction fails
  - File: `apps/web/app/api/ask/route.ts` line 338 (outer try/catch)

## Cross-Cutting Concerns

**Logging:**
- `console.log` / `console.error` / `console.warn` in server code
- Prefixed for easy filtering: `[router]`, `[dedup]`, `[diagnose]`, `[cleanup]`, `[semanticFallback]`
- Key decision points logged: merge vs new concept, routing mode, diagnostic session creation

**Validation:**
- Zod schemas at every trust boundary:
  - Client → Server: `questionSchema` in `apps/web/app/api/ask/route.ts`, `signUpSchema` in `apps/web/actions/auth.ts`, `createClassSchema` / `joinClassSchema` in `apps/web/actions/class.ts`
  - LLM → App: `conceptExtractionSchema` in `packages/llm/src/prompts/extract.ts`, `semanticRouteSchema` in `packages/router/src/semantic-fallback.ts`, `lessonPlanSchema` in `packages/llm/src/prompts/generate-lesson-plan.ts`
  - YAML → App: `misconceptionLibrarySchema`, `themeLibrarySchema` in `packages/misconceptions/src/schema.ts`
  - DB JSONB → App: `uiMessageSchema` for diagnostic session messages in `apps/web/app/api/diagnose/route.ts`

**Authentication:**
- NextAuth v5 (beta) with Credentials provider (email/password, bcrypt 12 rounds)
- Session strategy: JWT (not database sessions)
- DrizzleAdapter connects NextAuth to the users/accounts/sessions/verificationTokens tables
- Split config: `lib/auth.config.ts` (edge-safe, no Node imports) for middleware; `lib/auth.ts` (full config with providers) for server
- Middleware protects `/student/*` and `/teacher/*` routes
- All Server Actions and Route Handlers call `auth()` and extract `userId` from session

**Data Privacy (PRIV-01):**
- Only question text + gradeLevel sent to LLM — no student name, email, userId, or enrollment data
- `StudentThemeProfile` type in `lib/dashboard-types.ts` explicitly excludes all PII fields
- PRIV-01 audit script: `scripts/priv-01-audit.sh`
- Comments throughout codebase mark PII boundaries

**Authorization:**
- Role-based: `student` and `teacher` roles on user record
- Class ownership: dashboard/roster actions verify `classes.teacherId === session.user.id`
- Data scoping: all concept/question/session queries include `userId` filter from auth session
- Cross-user prevention: concept detail, diagnostic session access include ownership check

**Rate Limiting:**
- One question per calendar day per student (UTC range query)
- File: `apps/web/app/api/ask/route.ts` lines 49-67

## Deployment Architecture

**Development:**
- `pnpm dev` → Turborepo runs `next dev` for `apps/web`
- Docker Compose (`docker-compose.yml`) provides PostgreSQL 16 + pgvector locally
- Environment: `.env` file with `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

**Production (Vercel + Neon):**
- Next.js deployed to Vercel with `output: "standalone"` and `outputFileTracingRoot` set to monorepo root
- PostgreSQL hosted on Neon (serverless, `@neondatabase/serverless` driver available)
- Workspace packages transpiled via `transpilePackages` in `next.config.ts`
- `pg` marked as `serverExternalPackages` to avoid bundling native bindings
- COPPA cleanup via Vercel Cron calling `/api/cron/cleanup`

**Production (Self-Hosted Docker):**
- Multi-stage `Dockerfile` at project root
- `docker-compose.yml` for PostgreSQL + pgvector + Next.js standalone
- Swap `@ai-sdk/anthropic` for `ollama-ai-provider` for air-gap deployments

---

*Architecture analysis: 2026-04-14*
