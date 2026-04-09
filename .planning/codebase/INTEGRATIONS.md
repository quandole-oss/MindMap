# External Integrations

**Analysis Date:** 2026-04-09

## APIs & External Services

**LLM Providers:**
- **Anthropic Claude** - Primary AI provider for question answering and misconception diagnosis
  - SDK: `@ai-sdk/anthropic` 3.0.68
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Usage: Text generation, structured object extraction via Zod schemas
  - Entry points: `packages/llm/src/adapters/anthropic.ts`

- **OpenAI** - Secondary provider and embeddings service
  - SDK: `@ai-sdk/openai` 3.0.52
  - Auth: `OPENAI_API_KEY` environment variable
  - Usage: Text embedding generation for concept deduplication (1536-dimensional vectors)
  - Entry point: `packages/llm/src/embeddings.ts`

**LLM Provider Abstraction:**
- Vercel AI SDK 6.0.154 (`ai` package)
  - Factory pattern for provider selection
  - Supports: Anthropic, OpenAI, Ollama (self-hosted variant)
  - Entry point: `packages/llm/src/adapters/factory.ts`

## Data Storage

**Databases:**
- **PostgreSQL 16** - Primary relational data store
  - Connection: `DATABASE_URL` environment variable
  - Client libraries:
    - `pg` 8.20.0 (standard Node.js driver)
    - `@neondatabase/serverless` 1.0.2 (Vercel/serverless driver)
  - ORM: Drizzle ORM 0.45.2
    - Config: `packages/db/drizzle.config.ts`
    - Dialect: postgresql

**Vector Store:**
- **pgvector 0.8.x extension** (PostgreSQL)
  - Package: `pgvector` 0.2.1 (Node.js bindings)
  - Purpose: Concept embedding storage and semantic similarity searches
  - Index type: HNSW (Hierarchical Navigable Small World)
  - Dimension: Configurable (1536 for OpenAI `text-embedding-3-small`, customizable for Ollama embeddings)
  - Usage: Deduplicating semantically similar concepts across student questions

**File Storage:**
- Local filesystem only - No cloud storage integration detected
- Misconception library: YAML files in `packages/misconceptions/`
- Database migrations: `packages/db/src/migrations/`

**Caching:**
- Next.js built-in caching: `next/cache` API for RSC revalidation
- No external caching service (Redis, Memcached) detected

## Authentication & Identity

**Auth Provider:**
- NextAuth (v5 beta) - Custom email/password authentication
  - Package: `next-auth` (beta)
  - Adapter: `@auth/drizzle-adapter` 1.11.1
  - Config: `apps/web/lib/auth.config.ts`, `apps/web/lib/auth.ts`
  - Route: `apps/web/app/api/auth/[...nextauth]`

**Implementation Approach:**
- Credentials provider (email/password)
- Session storage: PostgreSQL via Drizzle adapter
- Middleware-based route protection: `apps/web/middleware.ts`
- Protected routes: `/student/*`, `/teacher/*`
- Password hashing: bcryptjs 2.4.3

**Session Storage:**
- Database table: Managed by `@auth/drizzle-adapter`
- Schema location: `packages/db/src/schema/auth.ts`
- Encryption key: `AUTH_SECRET` (min 32 characters)

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration present

**Logging:**
- OpenTelemetry API 1.9.0 - Instrumentation framework
  - Package: `@opentelemetry/api` 1.9.0
  - Implementation details: Not fully configured in codebase
  - Expected for observability layer when deployed

**Application Telemetry:**
- Next.js telemetry: Explicitly disabled
  - Environment variable: `NEXT_TELEMETRY_DISABLED=1` (set in Docker and deployment configs)
  - Privacy requirement per INFR-05

## CI/CD & Deployment

**Hosting:**

**Option 1: Docker Compose (Self-Hosted)**
- Container orchestration: Docker Compose
- Configuration: `docker-compose.yml`
- Services:
  - PostgreSQL 16 with pgvector: `pgvector/pgvector:pg16`
  - Next.js app: Built via `Dockerfile`
- Network: Internal Docker network
- Volumes: PostgreSQL data persistence via `pgdata` volume
- Port mapping: 5432 (Postgres), 3000 (Next.js app)

**Option 2: Vercel + Neon (SaaS)**
- Hosting platform: Vercel
- Database: Neon (serverless PostgreSQL with pgvector support)
- Connection: Via `@neondatabase/serverless` driver
- Database branching: Per-preview-deployment support
- Integration: Vercel Neon marketplace integration (auto-sets `DATABASE_URL`)

**CI Pipeline:**
- Build system: Turborepo 2.9
  - Configuration: `turbo.json`
  - Parallel task execution with dependency graph
  - Remote caching capable
- Vercel-specific: `vercel.json`
  - Build command: `pnpm turbo run build --filter=web`
  - Ignore command: `npx turbo-ignore` for build skipping on non-app changes
  - Framework detection: `nextjs`

**Build Artifacts:**
- Next.js standalone mode: `output: "standalone"` in `apps/web/next.config.ts`
- Docker output: `apps/web/.next/standalone/` directory
- Static assets: `apps/web/.next/static/`
- Docker image based on: `node:20-alpine`

## Environment Configuration

**Required Environment Variables:**

| Variable | Purpose | Docker Compose | Vercel | Notes |
|----------|---------|-----------------|--------|-------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://mindmap:mindmap@postgres:5432/mindmap` | Auto-set by Neon integration | Required for all deployments |
| `AUTH_SECRET` | NextAuth session encryption | `${AUTH_SECRET:-demo-secret-...}` (min 32 chars) | Set in Vercel dashboard | Must be 32+ characters for production |
| `ANTHROPIC_API_KEY` | Claude API credentials | `${ANTHROPIC_API_KEY:-}` (from .env) | Set in Vercel dashboard | Required for AI features |
| `OPENAI_API_KEY` | OpenAI embeddings API | `${OPENAI_API_KEY:-}` (from .env) | Set in Vercel dashboard | Required for concept embeddings |
| `NODE_ENV` | Deployment mode | `production` | Auto-set to `production` | Docker explicitly sets this |
| `NEXT_TELEMETRY_DISABLED` | Disable telemetry | `1` | Not needed (Vercel doesn't send) | Privacy enforcement |

**Secrets Location:**
- **Docker Compose:** `.env` file (required, values from `.env.example` template)
- **Vercel:** Environment variables in project dashboard
- **Neon Integration:** `DATABASE_URL` auto-populated via Vercel marketplace integration

**Development Environment:**
- Local `.env` file: Not committed (in `.gitignore`)
- Example template: `.env.example` (committed)
- Database for local dev: `docker compose up postgres` or local PostgreSQL 16

## Webhooks & Callbacks

**Incoming:**
- Student question submission: `apps/web/app/(student)/ask` (Server Action)
  - Triggers LLM enrichment and concept extraction
  - No external webhook endpoints detected

**Outgoing:**
- No external webhook callbacks detected
- LLM API calls: Synchronous HTTP requests via Vercel AI SDK
- Database: Direct Drizzle ORM queries (no webhooks)

## Data Flow & Integration Points

**Question Answering Flow:**
1. Student submits question → `apps/web/actions/` (Server Action)
2. Query database via Drizzle ORM → `packages/db/src/queries/`
3. Call LLM via AI SDK → `packages/llm/src/adapters/`
4. Extract concepts via `packages/llm/` (Zod-validated)
5. Generate embeddings via OpenAI → `packages/llm/src/embeddings.ts`
6. Store in PostgreSQL + pgvector
7. Deduplicate concepts via semantic similarity search

**Misconception Diagnosis Flow:**
1. Load misconception library → `packages/misconceptions/src/`
2. Route questions via `packages/router/` (decides enrichment vs. diagnosis)
3. Probe student understanding via LLM → `packages/llm/src/prompts/diagnose-probe.ts`
4. Confront misconceptions → `packages/llm/src/prompts/diagnose-confront.ts`
5. Resolve and store session data in PostgreSQL

## Database Schema Dependencies

**Key Tables (Drizzle ORM):**
- Authentication: `packages/db/src/schema/auth.ts` (NextAuth sessions, users, accounts)
- Questions: `packages/db/src/schema/questions.ts` (student questions, LLM responses, concepts)
- Diagnostic Sessions: `packages/db/src/schema/diagnostic-sessions.ts` (misconception probing interactions)
- Classes: `packages/db/src/schema/classes.ts` (teacher classes, enrollments)

**Vector Columns:**
- Concept embeddings: pgvector column in questions schema
- Index type: HNSW (if created via Drizzle or migrations)
- Dimension: Must match embedding model (1536 for OpenAI)

## Provider-Specific Notes

**Anthropic Integration:**
- Model selection: Handled via `@ai-sdk/anthropic`
- Streaming: Supported via Vercel AI SDK
- Structure output: Via Zod schemas with `generateObject`
- Cost: Text embeddings via OpenAI API (separate billing)

**OpenAI Integration:**
- Used exclusively for embeddings: `text-embedding-3-small` (1536 dimensions)
- Not used for primary LLM responses (Anthropic is primary)
- Cost: Per-token embedding generation

**PostgreSQL/Neon:**
- pgvector HNSW index: Created via Drizzle migrations or SQL
- Connection pooling: Built into `@neondatabase/serverless` for Vercel
- For Docker: Standard `pg` driver with connection string

---

*Integration audit: 2026-04-09*
