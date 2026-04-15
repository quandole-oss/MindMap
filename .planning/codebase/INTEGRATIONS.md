# External Integrations

**Analysis Date:** 2026-04-14

## APIs & External Services

**Anthropic Claude (Primary LLM):**
- Purpose: Text generation for question answering (enrich mode), concept extraction, misconception diagnosis (probe/confront/resolve stages), disambiguation, lesson plan generation, and student theme analysis
- SDK: `@ai-sdk/anthropic` ^3.0.68 (via Vercel AI SDK abstraction)
- Auth: `ANTHROPIC_API_KEY` environment variable
- Model: `claude-sonnet-4-20250514` (hard-coded in `packages/llm/src/adapters/anthropic.ts`)
- Provider factory: `packages/llm/src/adapters/factory.ts` (selects provider via `LLM_PROVIDER` env var, defaults to `anthropic`)
- Key usage files:
  - `packages/llm/src/prompts/enrich.ts` - Enrichment system prompt builder
  - `packages/llm/src/prompts/extract.ts` - Concept extraction with `Output.object` + Zod schema
  - `packages/llm/src/prompts/disambiguate.ts` - Concept deduplication disambiguation
  - `packages/llm/src/prompts/diagnose-probe.ts` - Socratic probe prompt
  - `packages/llm/src/prompts/diagnose-confront.ts` - Confrontation prompt
  - `packages/llm/src/prompts/diagnose-resolve.ts` - Resolution evaluation with structured output
  - `packages/llm/src/prompts/generate-lesson-plan.ts` - Teacher lesson plan generation
  - `packages/llm/src/prompts/analyze-student-themes.ts` - Student theme profile analysis
- API patterns used: `generateText` with `Output.object` for structured JSON; `streamText` for streaming responses to client

**OpenAI (Embeddings Only):**
- Purpose: Generate 1536-dimensional text embeddings for concept deduplication via pgvector
- SDK: `@ai-sdk/openai` ^3.0.52 (via Vercel AI SDK `embed` function)
- Auth: `OPENAI_API_KEY` environment variable
- Model: `text-embedding-3-small` (1536 dimensions)
- Key file: `packages/llm/src/embeddings.ts`
- Security constraint: Input limited to 500 characters; only concept names passed (no PII per PRIV-01)
- Graceful degradation: If embedding fails (no API key), concepts are inserted without embeddings; deduplication falls back to name-only matching

**Vercel AI SDK (Abstraction Layer):**
- Package: `ai` ^6.0.154
- Used across: `packages/llm`, `packages/router`, `apps/web`
- Core functions: `generateText`, `streamText`, `embed`, `Output.object`, `convertToModelMessages`
- Provider swapping: Change `LLM_PROVIDER` env var and install corresponding adapter (currently only `anthropic` implemented)
- Streaming: `result.toTextStreamResponse()` for `/api/ask`, `result.toUIMessageStreamResponse()` for `/api/diagnose`

## Data Storage

**PostgreSQL 16 + pgvector:**
- Connection: `DATABASE_URL` environment variable
- Docker image: `pgvector/pgvector:pg16` (includes pgvector extension)
- ORM: Drizzle ORM 0.45.2 (pinned via pnpm override)
- Drivers:
  - `pg` ^8.20.0 - Standard Node.js driver (used in Docker/self-hosted)
  - `@neondatabase/serverless` ^1.0.2 - Serverless driver (for Vercel/Neon deployments)
- Connection setup: `packages/db/src/index.ts` (creates `Pool` from `pg`, wraps with Drizzle)
- Schema source of truth: `packages/db/src/schema/index.ts` (re-exports all table definitions)
- Migrations:
  - Generator: `drizzle-kit generate` (config: `packages/db/drizzle.config.ts`)
  - Push: `drizzle-kit push` (direct schema push)
  - Migrate: `drizzle-kit migrate` (run migration files)
  - Migration directory: `packages/db/src/migrations/`
  - Current migrations: `0000_abandoned_polaris.sql`
- Seed: `packages/db/src/seed.ts` (run via `pnpm seed` or `turbo run seed`)

**Database Tables:**

| Table | Schema File | Purpose |
|-------|-------------|---------|
| `users` | `packages/db/src/schema/auth.ts` | User accounts (student/teacher roles, password hash, COPPA TTL `expiresAt`) |
| `sessions` | `packages/db/src/schema/auth.ts` | NextAuth session tokens |
| `accounts` | `packages/db/src/schema/auth.ts` | OAuth provider accounts (NextAuth) |
| `verificationTokens` | `packages/db/src/schema/auth.ts` | Email verification tokens (NextAuth) |
| `classes` | `packages/db/src/schema/classes.ts` | Teacher classes with join codes and grade levels |
| `class_enrollments` | `packages/db/src/schema/classes.ts` | Student-class enrollment records with COPPA TTL |
| `questions` | `packages/db/src/schema/questions.ts` | Student questions with AI responses and routing mode |
| `concepts` | `packages/db/src/schema/questions.ts` | Extracted concepts with pgvector embeddings (1536-dim), health status, visit counts |
| `concept_edges` | `packages/db/src/schema/questions.ts` | Knowledge graph edges (types: `curiosity_link`, `bridge`, `misconception_cluster`) |
| `concept_questions` | `packages/db/src/schema/questions.ts` | Join table linking concepts to questions |
| `diagnostic_sessions` | `packages/db/src/schema/diagnostic-sessions.ts` | Misconception diagnosis sessions (stages: probe/classify/confront/resolve) |
| `theme_lesson_plans` | `packages/db/src/schema/theme-lesson-plans.ts` | Cached teacher lesson plans with SHA-256 data hash for cache invalidation |

**pgvector Integration:**
- Column: `concepts.embedding` - `vector(1536)` (nullable for backward compatibility)
- Index: HNSW on `concepts.embedding` with `vector_cosine_ops` operator class
- Query helper: `packages/db/src/queries/concepts.ts` - `findSimilarConcepts()` using `cosineDistance` with `ORDER BY ASC` (required for HNSW index usage)
- Deduplication pipeline: Auto-merge (>0.92 similarity) / LLM disambiguate (0.85-0.92) / Create new (<0.85)

**File Storage:**
- Local filesystem only - No cloud storage (S3, GCS, etc.)
- Misconception YAML library: `packages/misconceptions/library/*.yaml`

**Caching:**
- No external cache service (no Redis, Memcached)
- Lesson plan cache: Database-level via `theme_lesson_plans` table with `dataHash` column (SHA-256 of input data)
- Misconception library: In-memory cache in `packages/misconceptions/src/loader.ts` (loaded once per process, reset via `resetLibraryCache()`)

## Authentication

**Provider:** NextAuth v5 (Auth.js) beta
- Package: `next-auth` (beta channel)
- Strategy: Credentials provider (email/password)
- Session: JWT-based (`session: { strategy: "jwt" }`)
- Password hashing: `bcryptjs` 2.4.3
- Database adapter: `@auth/drizzle-adapter` 1.11.1 (maps to `users`, `accounts`, `sessions`, `verificationTokens` tables)

**Configuration files:**
- `apps/web/lib/auth.ts` - Full auth config with Credentials provider, JWT callbacks (adds `id` and `role` to token/session), Drizzle adapter, custom sign-in page `/login`
- `apps/web/lib/auth.config.ts` - Edge-safe config (no Node.js imports); used by middleware for route protection
- `apps/web/app/api/auth/[...nextauth]/route.ts` - NextAuth route handler (exports `GET`, `POST`)

**Middleware:**
- File: `apps/web/middleware.ts`
- Protected route matchers: `/student/:path*`, `/teacher/:path*`
- Behavior: Unauthenticated users redirected to `/login`

**Session shape (JWT callbacks):**
- `session.user.id` - User UUID
- `session.user.role` - `"student"` or `"teacher"`

**Auth setting:** `trustHost: true` (required for Docker/reverse proxy deployments)

## API Routes

| Route | Method | Purpose | Auth | Key File |
|-------|--------|---------|------|----------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth handler (login, session, callbacks) | Public | `apps/web/app/api/auth/[...nextauth]/route.ts` |
| `/api/ask` | POST | Submit daily question, stream AI response, extract concepts, route to enrich/diagnose | JWT session required | `apps/web/app/api/ask/route.ts` |
| `/api/diagnose` | POST | Drive diagnostic session through probe/confront/resolve stages | JWT session required | `apps/web/app/api/diagnose/route.ts` |
| `/api/cron/cleanup` | GET | COPPA TTL cleanup - delete expired student accounts | Bearer token (`CRON_SECRET`) | `apps/web/app/api/cron/cleanup/route.ts` |

**Route configuration:**
- `maxDuration = 60` set on `/api/ask` and `/api/diagnose` (Vercel serverless function timeout)
- Input validation: Zod schemas on all request bodies
- Rate limiting: One question per day per student (UTC date range check in `/api/ask`)

## Environment Variables Required

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgresql://mindmap:mindmap@localhost:5432/mindmap` (dev) |
| `AUTH_SECRET` | NextAuth JWT encryption key (min 32 chars) | Yes | Demo value in docker-compose (must override for production) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Yes (for AI features) | None; `/api/ask` and `/api/diagnose` return 503 if missing |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | Yes (for concept deduplication) | None; graceful degradation to insert without embedding |
| `LLM_PROVIDER` | LLM provider selection | No | `"anthropic"` |
| `CRON_SECRET` | Bearer token for `/api/cron/cleanup` | No | None; cleanup endpoint returns 503 if unset |
| `NODE_ENV` | Deployment environment | No | `"production"` in Docker |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | No | `"1"` in Docker |

**Secrets location:**
- Docker Compose: `.env` file at project root (template: `.env.example`)
- Vercel: Environment variables in project dashboard; `DATABASE_URL` auto-set by Neon integration

## Misconception Library (YAML)

- Location: `packages/misconceptions/library/`
- Format: YAML files, one per domain
- Files:
  - `packages/misconceptions/library/physics.yaml`
  - `packages/misconceptions/library/biology.yaml`
  - `packages/misconceptions/library/chemistry.yaml` (not yet present)
  - `packages/misconceptions/library/math.yaml`
  - `packages/misconceptions/library/history.yaml`
  - `packages/misconceptions/library/themes.yaml` (theme registry, separate schema)
- Parser: `js-yaml` 4.1.1 in `packages/misconceptions/src/loader.ts`
- Validation: Zod schemas in `packages/misconceptions/src/schema.ts`
- Caching: In-memory singleton per process; `resetLibraryCache()` / `resetThemeCache()` for testing

## Third-Party SDKs

| SDK | Version | Purpose | Key Files |
|-----|---------|---------|-----------|
| `@ai-sdk/anthropic` | ^3.0.68 | Anthropic Claude LLM provider | `packages/llm/src/adapters/anthropic.ts` |
| `@ai-sdk/openai` | ^3.0.52 | OpenAI embeddings provider | `packages/llm/src/embeddings.ts` |
| `@ai-sdk/react` | ^3.0.156 | React hooks for streaming AI UI | `apps/web/components/diagnostic/diagnostic-chat.tsx` |
| `ai` (Vercel AI SDK) | ^6.0.154 | Provider-agnostic LLM abstraction | All prompt builders in `packages/llm/src/prompts/` |
| `@auth/drizzle-adapter` | ^1.11.1 | NextAuth database adapter | `apps/web/lib/auth.ts` |
| `drizzle-orm` | 0.45.2 | Type-safe PostgreSQL ORM | `packages/db/src/` |
| `pgvector` | ^0.2.1 | pgvector Node.js bindings | `packages/db/src/queries/concepts.ts` |

## Webhooks & Callbacks

**Incoming:**
- `/api/cron/cleanup` - COPPA TTL cleanup endpoint, callable by Vercel Cron or external system cron via `curl -H "Authorization: Bearer $CRON_SECRET"`
- No other external webhook endpoints

**Outgoing:**
- No outgoing webhooks or callbacks
- All external calls are synchronous HTTP to Anthropic and OpenAI APIs via Vercel AI SDK

## Data Flow Summary

**Question Answering (`/api/ask`):**
1. Auth check (JWT session) -> extract `userId`
2. One-per-day rate limit check (UTC date range)
3. Look up student grade level from `class_enrollments`
4. `streamText` to Anthropic Claude with enrichment system prompt
5. `onFinish` callback:
   a. Save question + AI response to `questions` table
   b. `extractConcepts` via Claude (structured output with Zod)
   c. `routeQuestion` via string matching against YAML misconception library
   d. `semanticFallback` via Claude for unmatched concepts (batched LLM call)
   e. For each concept: `generateEmbedding` (OpenAI) -> `findSimilarConcepts` (pgvector) -> auto-merge / LLM disambiguate / create new
   f. `createConceptEdges` for co-occurring concepts
   g. If routing = diagnose: create `diagnostic_sessions` row at stage `probe`

**Diagnostic Session (`/api/diagnose`):**
1. Auth check -> load session with ownership verification
2. Stage `probe` (no messages): Stream probe question via Claude
3. Stage `probe`/`classify` (with student message): Stream confrontation via Claude, advance to `confront`
4. Stage `confront` (with student message): `evaluateResolution` via Claude structured output -> update concept health -> stream resolve message -> terminal state

**COPPA Cleanup (`/api/cron/cleanup`):**
1. Verify `CRON_SECRET` bearer token
2. `deleteExpiredUsers` - CASCADE deletes all student data for expired accounts

---

*Integration audit: 2026-04-14*
