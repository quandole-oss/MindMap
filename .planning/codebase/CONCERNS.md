# Technical Concerns

**Analysis Date:** 2026-04-14

---

## Security

| Concern | Severity | Location | Notes |
|---------|----------|----------|-------|
| No role check in layout routes | HIGH | `apps/web/app/teacher/layout.tsx`, `apps/web/app/student/layout.tsx` | Layouts check `!!session?.user` but never verify `session.user.role`. A student can navigate to `/teacher/*` URLs and access teacher layouts. Server actions do enforce ownership (e.g., class.teacherId check), but the UI is fully accessible. |
| No security headers configured | HIGH | `apps/web/next.config.ts` | Missing `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`. A K-12 app handling minors' data should have CSP to prevent XSS and clickjacking headers. |
| AUTH_SECRET has weak Docker default | MEDIUM | `docker-compose.yml` (line 26) | `AUTH_SECRET: ${AUTH_SECRET:-demo-secret-change-in-production-min-32-chars}` provides a deterministic fallback. If deployers skip setting AUTH_SECRET, all JWT tokens are signed with a known string. Add a startup check that rejects the default value. |
| No rate limiting on any endpoint | MEDIUM | `apps/web/app/api/ask/route.ts`, `apps/web/app/api/diagnose/route.ts` | No IP-based or per-user rate limiting. The one-per-day business rule protects against question spam, but `/api/diagnose` has no per-user throttle — a student could send unlimited messages. The LLM-powered `searchNodes` in `apps/web/actions/graph.ts` has no throttle either (each call invokes Claude). |
| Middleware only checks authentication, not authorization | MEDIUM | `apps/web/middleware.ts`, `apps/web/lib/auth.config.ts` | The `authorized` callback checks `isLoggedIn` for `/student/*` and `/teacher/*` paths but never inspects the user's role. Any authenticated user can access any protected path at the middleware level. |
| COPPA TTL (expiresAt) never populated | MEDIUM | `apps/web/actions/auth.ts` (line 43), `packages/db/src/schema/auth.ts` (line 12) | The `expiresAt` column exists on `users` and `classEnrollments` tables for COPPA compliance, but `signUpAction` never sets it. The cleanup cron at `apps/web/app/api/cron/cleanup/route.ts` deletes users WHERE `expiresAt IS NOT NULL AND expiresAt <= now` — this never matches any user because expiresAt is always NULL. COPPA TTL is completely non-functional. |
| No CRON job configured for COPPA cleanup | LOW | `vercel.json` | The `/api/cron/cleanup` endpoint exists but `vercel.json` has no `crons` configuration. On Vercel deployments, the cleanup never runs automatically. Docker Compose also has no cron container. |
| Diagnostic search sends full node list to Claude | LOW | `apps/web/actions/graph.ts` (lines 389-425) | `searchNodes` sends every concept name/domain to Claude for search matching. For students with many concepts, this could leak the full concept list in a single prompt. Not a PII issue (no names/emails), but the node list itself could be considered educational data. |

## Performance

| Concern | Severity | Location | Notes |
|---------|----------|----------|-------|
| Missing database index on `concepts.userId` | HIGH | `packages/db/src/schema/questions.ts` (lines 31-58) | The `concepts` table is queried by `userId` in 7+ locations across `actions/graph.ts`, `actions/dashboard.ts`, `actions/questions.ts`, and `packages/db/src/queries/concepts.ts`. The only index is the HNSW embedding index. Add `index("concepts_user_id_idx").on(t.userId)`. |
| Missing database index on `conceptQuestions` join columns | MEDIUM | `packages/db/src/schema/questions.ts` (lines 85-93) | `conceptQuestions` is queried by both `conceptId` and `questionId` but has no indexes on either column. These are used in `actions/graph.ts` (getNodeDetails) and `actions/questions.ts` (getTodayQuestionConcepts). |
| No database index on `classEnrollments.studentId` | MEDIUM | `packages/db/src/schema/classes.ts` (lines 13-22) | `classEnrollments` has a unique constraint on `(classId, studentId)` which creates a composite index, but queries that filter only by `studentId` (e.g., `apps/web/app/api/ask/route.ts:79`, `apps/web/actions/questions.ts:42`) cannot use it efficiently. Add a standalone index on `studentId`. |
| `onFinish` callback in `/api/ask` runs heavy sequential operations | MEDIUM | `apps/web/app/api/ask/route.ts` (lines 93-341) | After streaming the answer, the `onFinish` callback sequentially: (1) inserts question, (2) calls extractConcepts (LLM), (3) calls routeQuestion per concept, (4) calls semanticFallback (LLM), (5) generates embedding per concept (OpenAI), (6) finds similar concepts (pgvector), (7) disambiguates (LLM) per ambiguous concept, (8) inserts concepts, (9) creates edges, (10) creates diagnostic session. This is 3-6 LLM/API calls executed sequentially. The stream closes immediately but background processing can take 10-30 seconds. |
| `getEdgeCoOccurrences` is O(n^2) in concept count | LOW | `packages/db/src/queries/concepts.ts` (lines 39-53) | Nested loop over all concept pairs to count co-occurrences. For a student with 100 concepts, this is 4,950 pair comparisons. Not a problem at current scale but will degrade with power users. |
| `computeBetweennessCentrality` is O(V*E) | LOW | `apps/web/lib/graph/centrality.ts`, `apps/web/actions/graph.ts` (line 80) | Documented as server-side only, which is correct. For graphs with 200+ nodes and dense edges, this becomes noticeable. Already noted in code comments. |
| No connection pool sizing for serverless | LOW | `packages/db/src/index.ts` (lines 5-7) | The `pg.Pool` is created with default settings (max 10 connections). On Vercel serverless, each function instance creates its own pool. With concurrent invocations, connection count can exceed PostgreSQL limits. The `@neondatabase/serverless` driver is listed as a dependency but not used — the code uses `pg` directly. |

## Technical Debt

| Item | Severity | Location | Notes |
|------|----------|----------|-------|
| `onFinish` silent failure swallows all post-stream errors | HIGH | `apps/web/app/api/ask/route.ts` (lines 93-341) | The entire concept extraction, deduplication, routing, and session creation pipeline runs in an `onFinish` callback wrapped in a single try/catch that only calls `console.error`. If any step fails (DB insert, LLM call, embedding), the student sees a successful answer but: the question is never saved, concepts are never extracted, no diagnostic session is created, and no graph updates happen. There is no retry mechanism and no user notification. |
| Unsafe type casts in auth callbacks | MEDIUM | `apps/web/lib/auth.ts` (lines 52, 59) | `(user as any).role` and `(session.user as any).role` bypass TypeScript safety. The Auth.js v5 beta types do not include custom fields. Fix by extending the NextAuth types via module augmentation in a `types/next-auth.d.ts` file. |
| `experimental_output` used throughout LLM layer | MEDIUM | `packages/llm/src/prompts/extract.ts`, `packages/llm/src/prompts/disambiguate.ts`, `packages/llm/src/prompts/diagnose-resolve.ts`, `packages/llm/src/prompts/generate-lesson-plan.ts`, `packages/llm/src/prompts/analyze-student-themes.ts`, `packages/router/src/semantic-fallback.ts` | Every structured output call uses `generateText` with `experimental_output: Output.object(...)` instead of the stable `generateObject` API. This is an experimental API in Vercel AI SDK that could change or be removed. The `generateObject` API is already stable and used correctly in `apps/web/actions/graph.ts:407`. Migrate all `experimental_output` calls to `generateObject`. |
| `diagnostic_sessions` lacks `classId` column | MEDIUM | `packages/db/src/schema/diagnostic-sessions.ts` | Documented explicitly in `apps/web/actions/themes.ts` (lines 196-204). Without a `classId` column, scoping diagnostic sessions to a specific class requires joining through `classEnrollments`. If a student is in multiple classes, their sessions are visible to all teachers. A future migration should add `classId` to tighten per-class isolation. |
| Single migration file — no incremental migration story | MEDIUM | `packages/db/src/migrations/` | Only one migration exists (`0000_abandoned_polaris.sql`). Schema changes appear to be applied via `drizzle-kit push` directly. Production deployments need a proper migration chain for safe schema evolution. |
| Model ID hardcoded in adapter | LOW | `packages/llm/src/adapters/anthropic.ts` (line 4) | `private readonly modelId = "claude-sonnet-4-20250514"` is hardcoded. Should be configurable via environment variable (e.g., `LLM_MODEL`) to allow model upgrades without code changes. |
| Only Anthropic adapter implemented | LOW | `packages/llm/src/adapters/factory.ts` | The factory only supports `"anthropic"`. The OpenAI and Ollama adapters mentioned in the spec are not implemented. Setting `LLM_PROVIDER=openai` throws an error. |
| eslint-disable-next-line for hooks deps | LOW | `apps/web/components/diagnostic/diagnostic-chat.tsx` (line 72), `apps/web/components/graph/bridge-toast.tsx` (line 55) | Suppressed exhaustive-deps warnings indicate potential stale closure bugs. |

## Missing/Incomplete Features

| Feature | Status | Notes |
|---------|--------|-------|
| COPPA TTL enforcement | Non-functional | `expiresAt` column exists but is never populated during user signup. Cleanup cron exists but is never scheduled. |
| OpenAI/Ollama LLM adapters | Stub only | Factory in `packages/llm/src/adapters/factory.ts` throws for any provider other than `"anthropic"`. |
| Email verification | Not implemented | `emailVerified` column exists in users schema (`packages/db/src/schema/auth.ts:8`) but no verification flow exists. Students can sign up with any email. |
| Password reset | Not implemented | No forgot-password flow. Users who lose credentials have no recovery path. |
| Environment variable validation | Not implemented | No startup check for required env vars (`DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). Missing vars cause runtime errors deep in execution paths instead of clear startup failures. |
| Vercel Cron for cleanup | Not configured | `vercel.json` has no `crons` array despite `/api/cron/cleanup` endpoint existing. |
| E2E tests | Not present | No Playwright, Cypress, or any E2E testing framework. Only unit tests exist. |
| Class deletion | Not implemented | Teachers can create classes and remove students but cannot delete a class. No `deleteClassAction` exists. |

## Dependency Risks

| Dependency | Risk | Notes |
|------------|------|-------|
| `next-auth: "beta"` | HIGH | `apps/web/package.json` (line 35) pins to the `beta` dist-tag. Every `pnpm install` could pull a different version with breaking changes. Pin to a specific version (e.g., `"5.0.0-beta.25"`) immediately. The Auth.js v5 beta has been stable for months but semver guarantees do not apply. |
| `ai: "^6.0.154"` | MEDIUM | Vercel AI SDK major version 6 — the `experimental_output` API used throughout is explicitly experimental. Monitor for deprecation notices. The SDK moves fast with frequent breaking changes between major versions. |
| `drizzle-orm: "0.45.2"` (pinned via pnpm override) | MEDIUM | Root `package.json` has `"pnpm": { "overrides": { "drizzle-orm": "0.45.2" } }`. This is due to known Drizzle bugs (e.g., jsonb default bug documented in `packages/db/src/schema/diagnostic-sessions.ts:48`). The override prevents accidental upgrades but also blocks security patches. |
| `three: "^0.183.2"` + R3F ecosystem | LOW | Three.js + React Three Fiber + Drei + postprocessing is a heavy dependency tree for the 3D knowledge graph. Bundle size impact is mitigated by code splitting but upgrade coordination across `three`/`@react-three/fiber`/`@react-three/drei` requires all three to be compatible. |

## Architecture Concerns

| Concern | Impact | Notes |
|---------|--------|-------|
| LLM cost amplification per question | HIGH | A single student question triggers: (1) `streamText` for the answer, (2) `extractConcepts` LLM call, (3) `semanticFallback` LLM call if unmatched concepts, (4) `disambiguateConcept` LLM call per ambiguous concept, (5) `generateEmbedding` OpenAI call per concept. This is 3-6 API calls per question. A 30-student class = 90-180 API calls/day. No cost monitoring or budget controls exist. |
| `searchNodes` uses LLM for every search query | MEDIUM | `apps/web/actions/graph.ts` (lines 389-425). Each graph search invokes `generateObject` with Claude, passing the full concept list. This is expensive for a UI interaction. Should use pgvector semantic search or simple client-side text filtering instead. |
| Streaming response decoupled from persistence | MEDIUM | In `/api/ask`, the answer streams to the client immediately while all persistence (question save, concept extraction, graph updates, diagnostic session creation) happens asynchronously in `onFinish`. If the server crashes or the callback errors, the student sees an answer that was never saved. There is no mechanism to reconcile this state. |
| Teacher narrative generation is uncached | LOW | `apps/web/actions/themes.ts` (line 478, `generateStudentNarrative`). Per the D-19 comment: "the result is NOT cached. Every open regenerates." Each time a teacher clicks on a student narrative, a full LLM call runs. For teachers reviewing many students, this is both slow and expensive. |

## Data Integrity

| Concern | Severity | Notes |
|---------|----------|-------|
| Questions can exist without concepts | HIGH | If the `onFinish` callback in `apps/web/app/api/ask/route.ts` fails after inserting the question (line 96) but before extracting concepts (line 107), the question row exists but has no linked concepts. The graph never updates, and the question appears in history with no concept connection. No cleanup or retry mechanism exists. |
| Concepts without embeddings break deduplication | MEDIUM | `apps/web/app/api/ask/route.ts` (lines 270-284). When embedding generation fails, concepts are inserted with `embedding: null`. Future questions about the same topic create duplicate concepts because pgvector similarity search skips null embeddings. These duplicates accumulate over time, inflating the knowledge graph. |
| JSONB messages column typed as `any[]` | MEDIUM | `packages/db/src/schema/diagnostic-sessions.ts` (line 51). The `messages` column is `jsonb.$type<any[]>()`. Read-time validation exists in `apps/web/app/api/diagnose/route.ts` (lines 27-34) via `validateMessages()`, but write-time validation only covers the AI SDK output shape — it does not validate that all messages conform to a strict schema before database insertion. |
| Diagnostic session stage can become inconsistent | LOW | In `apps/web/app/api/diagnose/route.ts` (lines 203-206), stage is set to `"classify"` BEFORE the LLM call completes. If the LLM call fails or the server crashes, the session is stuck at `"classify"` with no way to advance or retry. The `onFinish` callback updates to `"confront"` but if it fails, the stage remains at the intermediate state. |
| Edge deduplication relies on concept ordering | LOW | `packages/db/src/queries/concepts.ts` (lines 126-129). Edges are stored with `sourceConceptId < targetConceptId` (lexicographic). The unique constraint `(sourceConceptId, targetConceptId, edgeType)` plus `onConflictDoNothing` prevents duplicates. This works correctly but is fragile — any code that inserts edges without the lexicographic ordering would bypass the dedup. |

## Test Coverage Gaps

| Untested Area | Files | Risk | Priority |
|--------------|-------|------|----------|
| API route handlers | `apps/web/app/api/ask/route.ts`, `apps/web/app/api/diagnose/route.ts` | These are the most complex files in the codebase (345 and 338 lines). The entire question-answer-extract-route-deduplicate pipeline has zero test coverage. | HIGH |
| Auth actions | `apps/web/actions/auth.ts` | SignUp and SignIn flows including password hashing and error handling are untested. | HIGH |
| Class actions | `apps/web/actions/class.ts` | Create class, join class, remove student actions have no tests. Authorization checks (teacher-only, student-only) are untested. | HIGH |
| Graph actions | `apps/web/actions/graph.ts` | `getGraphData`, `getNodeDetails`, `getBridgeConnection`, `searchNodes` — all untested. The betweenness centrality computation that feeds node importance has tests (`apps/web/lib/graph/__tests__/clusters.test.ts`) but the action layer wrapping it does not. | MEDIUM |
| Diagnostic actions | `apps/web/actions/diagnostic.ts` | `getActiveSession`, `getSessionById`, `getTodayDiagnosticSession` — untested. | MEDIUM |
| Question actions | `apps/web/actions/questions.ts` | `hasAskedToday`, `getStreak`, `getQuestionHistory` — untested. Streak calculation logic in particular has edge cases around timezone boundaries. | MEDIUM |
| Middleware authorization | `apps/web/middleware.ts` | No test that verifies unauthenticated users are redirected or that role-based access is (or should be) enforced. | MEDIUM |
| Cleanup cron endpoint | `apps/web/app/api/cron/cleanup/route.ts` | Bearer token validation and deletion logic are untested. | LOW |

---

*Concerns audit: 2026-04-14*
