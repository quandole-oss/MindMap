# Codebase Structure

**Analysis Date:** 2026-04-09

## Directory Layout

```
mindmap/
├── apps/
│   └── web/                          # Next.js 15 full-stack app
│       ├── app/                      # App Router (pages, layouts, routes)
│       │   ├── (auth)/               # Public auth routes (login, signup)
│       │   ├── api/                  # Route handlers (ask, diagnose, auth, cron)
│       │   ├── student/              # Student role routes (protected)
│       │   ├── teacher/              # Teacher role routes (protected)
│       │   ├── layout.tsx            # Root layout (metadata, fonts, toaster)
│       │   └── page.tsx              # Landing page
│       ├── components/               # React components
│       │   ├── auth/                 # Login/signup forms
│       │   ├── dashboard/            # Teacher dashboard charts
│       │   ├── diagnostic/           # Diagnostic session UI
│       │   ├── graph/                # Knowledge graph D3 components
│       │   ├── layout/               # AppShell, sidebar, nav
│       │   ├── questions/            # Question form, display
│       │   ├── class/                # Class roster, enrollment
│       │   └── ui/                   # shadcn/ui primitives + custom (spiral, animations)
│       ├── actions/                  # Server Actions ("use server")
│       │   ├── auth.ts               # Sign up, password hash validation
│       │   ├── questions.ts          # hasAskedToday, getTodayQuestion, streak
│       │   ├── graph.ts              # getGraphData, getBridgeConnection
│       │   ├── diagnostic.ts         # getDiagnosticSessions, clearSession
│       │   ├── dashboard.ts          # getDashboardData (aggregated stats)
│       │   └── class.ts              # createClass, enrollStudent, getRoster
│       ├── lib/                      # Utilities and configuration
│       │   ├── auth.ts               # NextAuth v5 instance
│       │   ├── auth.config.ts        # Auth providers (Credentials), database adapter
│       │   ├── dashboard-types.ts    # TypeScript types for dashboard data
│       │   ├── utils.ts              # Utility functions (if any)
│       │   └── graph/                # Graph utilities (node coloring, layout)
│       ├── types/                    # TypeScript ambient declarations
│       │   └── d3-force-3d.d.ts      # Type stubs for d3-force-3d
│       ├── middleware.ts             # NextAuth middleware (route protection)
│       ├── next.config.ts            # Next.js config (output: standalone, transpile packages)
│       ├── tsconfig.json             # TypeScript config (paths: "@/*")
│       ├── tailwind.config.ts        # Tailwind v4 config
│       ├── globals.css               # Global styles
│       └── package.json              # Next.js app dependencies
├── packages/
│   ├── db/                           # Drizzle ORM + schema + queries
│   │   ├── src/
│   │   │   ├── schema/               # Drizzle table definitions
│   │   │   │   ├── auth.ts           # users, sessions, accounts, verificationTokens
│   │   │   │   ├── questions.ts      # questions, concepts, conceptEdges, conceptQuestions
│   │   │   │   ├── classes.ts        # classes, classEnrollments
│   │   │   │   ├── diagnostic-sessions.ts  # diagnosticSessions (JSONB messages)
│   │   │   │   └── index.ts          # Schema exports
│   │   │   ├── queries/              # Typed query helpers
│   │   │   │   ├── concepts.ts       # findSimilarConcepts (pgvector ANN), getEdgeCoOccurrences, createConceptEdges
│   │   │   │   └── cleanup.ts        # deleteOldSessions (cron job)
│   │   │   ├── migrations/           # Auto-generated Drizzle migrations
│   │   │   ├── seed.ts               # Dev data seeding
│   │   │   └── index.ts              # Exports: db, schema, query helpers
│   │   ├── drizzle.config.ts         # Drizzle Kit config (schema, migrations dir, DATABASE_URL)
│   │   ├── tsconfig.json             # TypeScript config (strict: true)
│   │   └── package.json              # Dependencies: drizzle-orm, pg, pgvector, bcryptjs
│   │
│   ├── llm/                          # LLM adapters, prompts, embeddings
│   │   ├── src/
│   │   │   ├── adapters/             # LLM provider implementations
│   │   │   │   ├── anthropic.ts      # AnthropicAdapter class (wraps Vercel AI SDK)
│   │   │   │   └── factory.ts        # createLLMAdapter() — provider factory
│   │   │   ├── prompts/              # Prompt engineering
│   │   │   │   ├── enrich.ts         # buildEnrichSystemPrompt(gradeLevel)
│   │   │   │   ├── extract.ts        # extractConcepts(), conceptExtractionSchema (Zod)
│   │   │   │   ├── disambiguate.ts   # disambiguateConcept() — for deduplication
│   │   │   │   ├── diagnose-probe.ts # buildProbeSystemPrompt() — diagnostic stage 1
│   │   │   │   ├── diagnose-confront.ts  # buildConfrontSystemPrompt() — stage 2
│   │   │   │   └── diagnose-resolve.ts   # evaluateResolution(), buildResolveMessage() — stage 3
│   │   │   ├── embeddings.ts         # generateEmbedding(text) — OpenAI text-embedding-3-small
│   │   │   ├── __tests__/            # Vitest unit tests
│   │   │   │   ├── adapter.test.ts
│   │   │   │   └── prompts.test.ts
│   │   │   └── index.ts              # Public API exports
│   │   ├── tsconfig.json             # TypeScript config (strict: true)
│   │   └── package.json              # Dependencies: ai, @ai-sdk/anthropic, @ai-sdk/openai, zod
│   │
│   ├── misconceptions/               # Misconception library (YAML + loader)
│   │   ├── library/                  # Version-controlled YAML misconception entries
│   │   │   ├── physics.yaml          # Physics misconceptions by grade band
│   │   │   ├── biology.yaml          # Biology misconceptions by grade band
│   │   │   ├── math.yaml             # Math misconceptions by grade band
│   │   │   └── history.yaml          # History misconceptions by grade band
│   │   ├── src/
│   │   │   ├── loader.ts             # loadLibrary(), getMisconceptionsByDomainAndBand(), getMisconceptionById()
│   │   │   ├── library.ts            # loadLibrary() wrapper + module export
│   │   │   ├── schema.ts             # Zod schemas for validation
│   │   │   ├── __tests__/            # Vitest unit tests
│   │   │   │   └── loader.test.ts
│   │   │   └── index.ts              # Public API exports
│   │   ├── tsconfig.json             # TypeScript config (strict: true)
│   │   └── package.json              # Dependencies: js-yaml, zod
│   │
│   └── router/                       # Concept routing (enrich vs diagnose)
│       ├── src/
│       │   ├── index.ts              # routeQuestion(), gradeLevelToGradeBand(), semanticFallback()
│       │   ├── semantic-fallback.ts  # LLM-based fallback for unmatched concepts
│       │   ├── utils.ts              # Grade level to band converter
│       │   └── __tests__/            # Vitest unit tests
│       │       └── router.test.ts
│       ├── tsconfig.json             # TypeScript config (strict: true)
│       └── package.json              # Dependencies: @mindmap/misconceptions, ai, zod
│
├── turbo.json                        # Turborepo config (build, test, lint, dev tasks)
├── pnpm-workspace.yaml               # pnpm workspaces definition
├── package.json                      # Root package (scripts: build, dev, test, lint, seed)
├── tsconfig.json                     # Root TypeScript config (base)
├── Dockerfile                        # Multi-stage Docker image (prod deployment)
├── docker-compose.yml                # Local dev: PostgreSQL + pgvector
├── vercel.json                       # Vercel deployment config
├── CLAUDE.md                         # Project specification and tech stack
├── README.md                         # Getting started guide
├── .env.example                      # Environment variables template
└── .planning/                        # GSD planning artifacts
    ├── codebase/                     # This directory (ARCHITECTURE.md, STRUCTURE.md, etc.)
    ├── phases/                       # Planned implementation phases
    └── debug/                        # Investigation logs
```

## Directory Purposes

**`/apps/web`:**
- Purpose: Production Next.js application; user-facing UI and API
- Contains: Page routes, API endpoints, React components, Server Actions, auth config, styling
- Entry point: `next dev` (local), deployed to Vercel

**`/apps/web/app`:**
- Purpose: Next.js App Router (filesystem-based routing)
- Route structure:
  - `(auth)/` — Public routes (login, signup)
  - `/` — Landing page
  - `/student/*` — Student dashboard, questions, graph (auth protected via middleware)
  - `/teacher/*` — Teacher class management, dashboard (auth protected via middleware)
  - `/api/*` — Route handlers (POST `/api/ask`, POST `/api/diagnose`, etc.)

**`/apps/web/components`:**
- Purpose: React component library for pages and layouts
- Organized by domain (auth, graph, dashboard, etc.)
- UI primitives from shadcn/ui (auto-initialized in `/components/ui`)

**`/apps/web/actions`:**
- Purpose: Server Actions ("use server") for RPC-style server calls from client
- Each file groups related actions (questions.ts, graph.ts, etc.)
- Async functions called via `useAction()` hook or direct `import`

**`/apps/web/lib`:**
- Purpose: Utilities, config, auth setup, type definitions
- `auth.ts` — NextAuth v5 instance; exported as `auth()` function for session checks
- `auth.config.ts` — Provider config (email/password), database adapter, callbacks

**`/packages/db`:**
- Purpose: Database abstraction layer (ORM + schema + queries)
- `schema/` — Table definitions via Drizzle; exported as single `schema` namespace
- `queries/` — Query helpers (pgvector ANN search, edge co-occurrence, cleanup)
- Index exports: `db` (Drizzle instance), `schema` (all tables), query helpers
- Never use raw SQL; all queries go through Drizzle type-safe API

**`/packages/db/src/migrations`:**
- Purpose: Auto-generated SQL migration files (do not edit manually)
- Generated by `drizzle-kit generate` from schema changes
- Applied by `drizzle-kit migrate` or `drizzle-kit push`

**`/packages/llm`:**
- Purpose: LLM integration layer (adapters, prompt engineering)
- `adapters/` — Provider implementations; currently only Anthropic
- `prompts/` — Domain-specific system prompts and extraction schemas
- `embeddings.ts` — OpenAI embedding generation for pgvector
- Index exports: factory, adapters, prompt builders, extraction functions

**`/packages/misconceptions`:**
- Purpose: Version-controlled misconception library (YAML registry)
- `library/` — YAML files per domain; one entry per misconception with ID, name, grade_band, probe_questions, confrontation_scenarios
- Loaded at startup via `loadLibrary()`; cached in memory
- Zod validation ensures schema compliance

**`/packages/router`:**
- Purpose: Concept routing logic (enrich vs diagnose decision making)
- `routeQuestion()` — String matching + semantic fallback
- `semanticFallback()` — LLM-powered matching for unmatched concepts
- Stateless functions; depends on misconceptions library + LLM adapter from caller

## Key File Locations

**Entry Points:**

- **Web App:** `/apps/web/app/layout.tsx` (root layout with fonts, metadata)
- **Student Dashboard:** `/apps/web/app/student/page.tsx`
- **Teacher Home:** `/apps/web/app/teacher/page.tsx`
- **Graph Visualization:** `/apps/web/app/student/graph/page.tsx`
- **Auth:** `/apps/web/lib/auth.ts` and `/apps/web/lib/auth.config.ts`

**Configuration:**

- **Next.js:** `/apps/web/next.config.ts` (standalone output, package transpilation)
- **Drizzle ORM:** `/packages/db/drizzle.config.ts` (schema, migrations dir, DATABASE_URL)
- **Database Schema:** `/packages/db/src/schema/index.ts` (exports all tables)
- **Middleware:** `/apps/web/middleware.ts` (NextAuth route protection)
- **Tailwind:** `/apps/web/tailwind.config.ts` (Tailwind v4 CSS-first config)
- **Turbo:** `/turbo.json` (build pipeline, task dependencies)

**Core Logic:**

- **Question Enrichment:** `/apps/web/app/api/ask/route.ts` (POST endpoint, concept extraction, routing, deduplication)
- **Diagnostic Flow:** `/apps/web/app/api/diagnose/route.ts` (POST endpoint, stage machine, resolution evaluation)
- **Graph Queries:** `/apps/web/actions/graph.ts` (getGraphData, concept/edge retrieval)
- **Concept Deduplication:** `/packages/db/src/queries/concepts.ts` (pgvector search, merge logic)
- **Routing Logic:** `/packages/router/src/index.ts` (routeQuestion, semanticFallback)
- **Misconception Loading:** `/packages/misconceptions/src/loader.ts` (YAML → memory cache)

**Testing:**

- **LLM Tests:** `/packages/llm/src/__tests__/` (prompt schemas, adapter behavior)
- **Misconceptions Tests:** `/packages/misconceptions/src/__tests__/` (library loading, validation)
- **Router Tests:** `/packages/router/src/__tests__/` (routing decisions)
- **Web App Tests:** `/apps/web/app/**/*.test.ts` or next to components

## Naming Conventions

**Files:**

- **Routes:** `page.tsx` (pages), `route.ts` (API endpoints), `layout.tsx` (layouts)
- **Components:** PascalCase (`QuestionForm.tsx`, `GraphNode.tsx`)
- **Server Actions:** camelCase (`actions/questions.ts`, function `hasAskedToday()`)
- **Utilities:** camelCase (`lib/utils.ts`, function `gradeLevelToGradeBand()`)
- **Tests:** `*.test.ts` or `*.spec.ts` (co-located with source)
- **Types:** `types/[domain].ts` or inline in files

**Directories:**

- **Feature-based:** `components/[feature]/` (auth, graph, dashboard, etc.)
- **Type-based:** `types/`, `lib/`, `queries/`, `prompts/`
- **Domain-based:** `/packages/[domain]` (db, llm, misconceptions, router)

## Where to Add New Code

**New Feature (e.g., Misconception Export):**

1. Primary code location:
   - If API endpoint: `/apps/web/app/api/[feature]/route.ts`
   - If Server Action: `/apps/web/actions/[feature].ts`
   - If data layer: `/packages/db/src/queries/[feature].ts`
   - If LLM-dependent: `/packages/llm/src/prompts/[feature].ts`

2. Tests:
   - Co-locate with source: `/apps/web/app/api/[feature]/route.test.ts` or `/packages/db/src/queries/[feature].test.ts`
   - Use Vitest as test runner

3. Components:
   - If reusable across pages: `/apps/web/components/[feature]/[Component].tsx`
   - If page-specific: same directory as page, e.g., `/apps/web/app/student/[page-component].tsx`

**New Component/Module:**

1. Implementation:
   - Domain-specific: `/packages/[domain]/src/[module].ts`
   - App-specific: `/apps/web/components/[feature]/[Module].tsx` or `/apps/web/lib/[module].ts`

2. Exports:
   - Always export from `index.ts` of parent directory
   - Example: `/packages/llm/src/index.ts` exports `buildEnrichSystemPrompt`

**Utilities:**

- Shared helpers (used across packages): `/packages/[domain]/src/utils.ts`
- App-specific helpers: `/apps/web/lib/utils.ts`
- Database queries: `/packages/db/src/queries/[feature].ts`

## Special Directories

**`/packages/db/src/migrations`:**
- Purpose: Auto-generated SQL migration files
- Generated: Yes (via `drizzle-kit generate`)
- Committed: Yes (version control DB schema)
- DO NOT edit manually; regenerate from schema changes

**`/packages/misconceptions/library`:**
- Purpose: Version-controlled YAML misconception entries
- Generated: No (human-authored)
- Committed: Yes (part of codebase)
- One YAML file per domain; entries indexed by ID

**`/apps/web/.next`:**
- Purpose: Next.js build output (compiled pages, optimizations)
- Generated: Yes (via `next build`)
- Committed: No (in `.gitignore`)

**`node_modules` (root and per-workspace):**
- Purpose: Installed npm packages
- Generated: Yes (via `pnpm install`)
- Committed: No (in `.gitignore`)
- Managed by pnpm workspaces with `pnpm-lock.yaml`

---

*Structure analysis: 2026-04-09*
