# Project Structure

**Analysis Date:** 2026-04-14

## Root Layout

```
mindmap/
├── apps/
│   └── web/                              # Next.js 15 full-stack application
├── packages/
│   ├── db/                               # Drizzle ORM schema, queries, migrations
│   ├── llm/                              # LLM adapters, prompt builders, embeddings
│   ├── misconceptions/                   # YAML misconception library + Zod loader
│   └── router/                           # Concept routing engine (enrich vs diagnose)
├── scripts/                              # Maintenance scripts (PRIV-01 audit)
├── .planning/                            # GSD planning artifacts (not app code)
│   ├── codebase/                         # Architecture/structure/convention docs
│   ├── phases/                           # Phase implementation plans (01-08)
│   ├── debug/                            # Debug session logs
│   ├── quick/                            # Quick task logs
│   └── research/                         # Research notes
├── turbo.json                            # Turborepo task config
├── pnpm-workspace.yaml                   # Workspace: apps/*, packages/*
├── package.json                          # Root scripts: build, dev, test, lint, seed
├── Dockerfile                            # Multi-stage production image
├── docker-compose.yml                    # Local dev: PostgreSQL 16 + pgvector
├── .env.example                          # Environment variable template
└── CLAUDE.md                             # Project spec and tech stack reference
```

## App Router Route Structure

```
apps/web/app/
├── layout.tsx                            # Root layout (Inter font, metadata, Toaster)
├── page.tsx                              # Landing page (client component: login/signup/hero)
├── globals.css                           # Tailwind v4 global styles
├── (auth)/                               # Auth route group (public)
│   ├── layout.tsx                        # Auth layout (SpiralBackground, centered card)
│   ├── login/page.tsx                    # Login page
│   └── signup/page.tsx                   # Signup page
├── api/                                  # Route Handlers
│   ├── ask/route.ts                      # POST — question enrichment + concept extraction
│   ├── diagnose/route.ts                 # POST — diagnostic conversation state machine
│   ├── auth/[...nextauth]/route.ts       # GET|POST — NextAuth endpoints
│   └── cron/cleanup/route.ts             # GET — COPPA TTL user deletion (bearer token)
├── student/                              # Student routes (auth protected)
│   ├── layout.tsx                        # Student AppShell with sidebar + streak
│   ├── page.tsx                          # Daily question prompt (Server Component)
│   ├── questions/page.tsx                # Question history
│   ├── graph/page.tsx                    # Knowledge graph visualization
│   ├── join/page.tsx                     # Join class by code
│   └── diagnose/[sessionId]/page.tsx     # Active diagnostic session
└── teacher/                              # Teacher routes (auth protected)
    ├── layout.tsx                        # Teacher AppShell with sidebar + class list
    ├── page.tsx                          # Class listing (Server Component)
    └── classes/
        ├── new/page.tsx                  # Create class form
        └── [classId]/
            ├── dashboard/page.tsx        # Full class dashboard (tabs)
            └── roster/page.tsx           # Student roster management
```

## Component Directory

```
apps/web/components/
├── auth/
│   ├── login-form.tsx                    # Email/password login with react-hook-form
│   └── signup-form.tsx                   # Registration with role selection
├── class/
│   ├── class-roster.tsx                  # Student list with remove action
│   ├── create-class-form.tsx             # Class creation form
│   ├── join-class-form.tsx               # Join code input form
│   └── join-code-display.tsx             # Display join code to teacher
├── dashboard/
│   ├── dashboard-tabs.tsx                # Tab container (overview/students/concepts/misconceptions/themes)
│   ├── overview-tab.tsx                  # Summary stats cards
│   ├── students-tab.tsx                  # Student table with streaks, breadth scores
│   ├── concepts-tab.tsx                  # Concept heatmap
│   ├── misconceptions-tab.tsx            # Misconception clusters
│   ├── themes-view.tsx                   # Theme clusters with lesson plan buttons
│   ├── lesson-plan-card.tsx              # Generated lesson plan display
│   └── student-narrative-dialog.tsx      # Per-student AI narrative dialog
├── diagnostic/
│   ├── diagnostic-chat.tsx               # Streaming diagnostic conversation UI
│   ├── diagnostic-bubble.tsx             # Chat message bubble
│   └── misconception-reveal.tsx          # Resolution outcome reveal
├── graph/
│   ├── knowledge-graph.tsx               # D3.js 2D force-directed graph (main)
│   ├── solar-graph.tsx                   # Three.js 3D solar system wrapper
│   ├── solar-scene.tsx                   # Three.js scene setup (camera, lighting)
│   ├── solar-nodes.tsx                   # Three.js node spheres
│   ├── solar-edges.tsx                   # Three.js edge lines
│   ├── graph-filter-bar.tsx              # Domain/status filter controls
│   ├── use-graph-filters.ts             # Filter state hook
│   ├── use-graph-layout.ts              # D3 force layout hook
│   ├── node-detail-panel.tsx            # Selected node info panel
│   ├── health-legend.tsx                # Node status color legend
│   ├── bridge-toast.tsx                 # "Surprise connection" bridge notification
│   ├── mini-graph-svg.tsx               # Small SVG graph for teacher dashboard
│   └── __tests__/
│       └── graph-filters.test.ts        # Graph filter unit tests
├── layout/
│   ├── app-shell.tsx                    # Main layout shell (sidebar + content)
│   └── sidebar.tsx                      # Navigation sidebar
├── questions/
│   ├── question-form.tsx                # Daily question input with streaming answer display
│   ├── answer-display.tsx               # Markdown-rendered AI response
│   ├── question-history.tsx             # Past questions list
│   └── streak-badge.tsx                 # Consecutive-day streak display
└── ui/                                  # shadcn/ui primitives + custom components
    ├── alert-dialog.tsx
    ├── badge.tsx
    ├── button.tsx
    ├── card.tsx
    ├── form.tsx
    ├── input.tsx
    ├── label.tsx
    ├── separator.tsx
    ├── sheet.tsx
    ├── skeleton.tsx
    ├── sonner.tsx                       # Toast notifications (sonner wrapper)
    ├── spiral-animation.tsx             # WebGL spiral canvas animation
    ├── spiral-background.tsx            # Full-viewport spiral background
    ├── table.tsx
    ├── textarea.tsx
    ├── toggle-group.tsx
    └── tooltip.tsx
```

## Server Actions Directory

```
apps/web/actions/
├── auth.ts              # signUpAction, signInAction, signOutAction
├── questions.ts         # hasAskedToday, getTodayQuestion, getStudentGradeLevel,
│                        # getQuestionHistory, getTodayQuestionConcepts, getStreak
├── graph.ts             # getGraphData, getNodeDetails, getBridgeConnection, searchNodes
├── diagnostic.ts        # getActiveSession, getSessionById, getTodayDiagnosticSession,
│                        # getSessionsForUser
├── dashboard.ts         # getClassDashboardData (single aggregated query)
├── class.ts             # createClassAction, joinClassAction, removeStudentAction,
│                        # getClassRoster, getTeacherClasses, getStudentEnrollments
└── themes.ts            # getThemeDetail, getStudentNarrative, getLessonPlan,
                         # regenerateLessonPlan
```

## Package: @mindmap/db

```
packages/db/
├── src/
│   ├── index.ts                         # Exports: db, schema, query helpers
│   ├── schema/
│   │   ├── index.ts                     # Re-exports all schema modules
│   │   ├── auth.ts                      # Tables: users, sessions, accounts, verificationTokens
│   │   ├── questions.ts                 # Tables: questions, concepts, conceptEdges, conceptQuestions
│   │   │                                # Enums: edgeTypeEnum (curiosity_link, bridge, misconception_cluster)
│   │   ├── classes.ts                   # Tables: classes, classEnrollments
│   │   ├── diagnostic-sessions.ts       # Tables: diagnosticSessions
│   │   │                                # Enums: diagnosticStageEnum, diagnosticOutcomeEnum
│   │   └── theme-lesson-plans.ts        # Tables: themeLessonPlans + LessonPlanJson type
│   ├── queries/
│   │   ├── concepts.ts                  # findSimilarConcepts (pgvector), getEdgeCoOccurrences,
│   │   │                                # createConceptEdges
│   │   └── cleanup.ts                   # deleteExpiredUsers (COPPA TTL)
│   ├── migrations/                      # Auto-generated Drizzle SQL migrations (DO NOT edit)
│   │   └── meta/                        # Migration metadata
│   └── seed.ts                          # Development seed data (students, questions, concepts)
├── drizzle.config.ts                    # Drizzle Kit config: schema path, migrations dir, DATABASE_URL
├── tsconfig.json
└── package.json                         # main: ./src/index.ts (no build step — transpiled by Next.js)
```

## Package: @mindmap/llm

```
packages/llm/
├── src/
│   ├── index.ts                         # Public API: all adapters, prompts, embeddings
│   ├── adapters/
│   │   ├── factory.ts                   # createLLMAdapter() — reads LLM_PROVIDER env
│   │   └── anthropic.ts                 # AnthropicAdapter (claude-sonnet-4-20250514)
│   ├── prompts/
│   │   ├── enrich.ts                    # buildEnrichSystemPrompt(gradeLevel)
│   │   ├── extract.ts                   # extractConcepts(), conceptExtractionSchema
│   │   ├── disambiguate.ts              # disambiguateConcept() — dedup disambiguation
│   │   ├── diagnose-probe.ts            # buildProbeSystemPrompt() — diagnostic stage 1
│   │   ├── diagnose-confront.ts         # buildConfrontSystemPrompt() — diagnostic stage 2
│   │   ├── diagnose-resolve.ts          # evaluateResolution(), buildResolveMessage() — stage 3
│   │   ├── generate-lesson-plan.ts      # generateLessonPlan(), lessonPlanSchema
│   │   └── analyze-student-themes.ts    # analyzeStudentThemes(), studentThemeAnalysisSchema
│   ├── embeddings.ts                    # generateEmbedding() — OpenAI text-embedding-3-small (1536 dims)
│   └── __tests__/                       # Vitest unit tests
├── tsconfig.json
└── package.json                         # main: ./src/index.ts
```

## Package: @mindmap/misconceptions

```
packages/misconceptions/
├── library/                             # Version-controlled YAML files
│   ├── physics.yaml                     # Physics misconceptions (15 KB, all grade bands)
│   ├── biology.yaml                     # Biology misconceptions (12 KB)
│   ├── math.yaml                        # Math misconceptions (12 KB)
│   ├── history.yaml                     # History misconceptions (11 KB)
│   └── themes.yaml                      # Root-cause theme definitions (7 KB)
├── src/
│   ├── index.ts                         # Public API: loader functions + schema types
│   ├── loader.ts                        # loadLibrary(), loadThemes(), getMisconception*(), in-memory cache
│   ├── schema.ts                        # Zod schemas: misconceptionEntrySchema, themeSchema, etc.
│   └── __tests__/                       # Vitest unit tests
├── tsconfig.json
└── package.json                         # main: ./src/index.ts
```

## Package: @mindmap/router

```
packages/router/
├── src/
│   ├── index.ts                         # routeQuestion(), gradeLevelToGradeBand(), semanticFallback export
│   ├── semantic-fallback.ts             # LLM-based misconception matching (batched single call)
│   ├── utils.ts                         # gradeLevelToGradeBand() helper
│   └── __tests__/                       # Vitest unit tests
├── tsconfig.json
└── package.json                         # main: ./src/index.ts
```

## Utility & Lib Files

```
apps/web/lib/
├── auth.ts                              # NextAuth v5 instance (providers, callbacks, adapter)
├── auth.config.ts                       # Edge-safe auth config (no Node imports — for middleware)
├── utils.ts                             # cn() utility (clsx + tailwind-merge)
├── dashboard-types.ts                   # TypeScript interfaces: ClassDashboardData, StudentSummary,
│                                        # ConceptHeatmapEntry, MisconceptionCluster, ThemeCluster,
│                                        # ThemeDetail, StudentThemeProfile
├── theme-aggregation.ts                 # buildThemeClusters(), buildStudentThemeProfile(), gradeLevelToBand()
├── theme-cache-hash.ts                  # computeDataHash() — SHA-256 for lesson plan cache key
└── graph/
    ├── centrality.ts                    # computeBetweennessCentrality() (Brandes algorithm),
    │                                    # findTopBridgeNode()
    ├── clusters.ts                      # Graph clustering utilities
    ├── domain-colors.ts                 # Domain → color mapping for graph nodes
    └── __tests__/                       # Vitest unit tests for graph algorithms
```

## Key File Locations

**Entry Points:**
- `apps/web/app/layout.tsx`: Root layout (Inter font, Toaster, metadata)
- `apps/web/app/page.tsx`: Landing page (client component: hero + auth forms)
- `apps/web/app/student/page.tsx`: Student dashboard (daily question prompt)
- `apps/web/app/teacher/page.tsx`: Teacher home (class listing)
- `apps/web/app/student/graph/page.tsx`: Knowledge graph visualization
- `apps/web/middleware.ts`: NextAuth route protection for `/student/*` and `/teacher/*`

**Configuration:**
- `apps/web/next.config.ts`: standalone output, outputFileTracingRoot, transpilePackages, serverExternalPackages
- `apps/web/tsconfig.json`: paths alias `@/*` → `./*`
- `apps/web/lib/auth.ts`: NextAuth v5 setup (JWT strategy, Credentials provider, DrizzleAdapter)
- `apps/web/lib/auth.config.ts`: Edge-safe auth config (for middleware — no pg, bcrypt, drizzle imports)
- `packages/db/drizzle.config.ts`: Schema path, migrations dir, DATABASE_URL
- `turbo.json`: Task pipeline (build depends on ^build, test depends on ^build, dev is persistent/uncached)
- `pnpm-workspace.yaml`: Workspaces definition (`apps/*`, `packages/*`)

**Core Business Logic:**
- `apps/web/app/api/ask/route.ts`: Question enrichment pipeline (346 lines — largest single file)
- `apps/web/app/api/diagnose/route.ts`: Diagnostic conversation state machine (339 lines)
- `apps/web/actions/dashboard.ts`: Class dashboard data aggregation (409 lines)
- `apps/web/actions/themes.ts`: Theme drill-down, lesson plan generation/caching (large)
- `apps/web/actions/graph.ts`: Knowledge graph data computation (426 lines)
- `packages/db/src/queries/concepts.ts`: pgvector ANN search, edge creation, co-occurrence counting
- `packages/router/src/index.ts`: Concept routing decision engine

**Database Schema:**
- `packages/db/src/schema/auth.ts`: users, sessions, accounts, verificationTokens
- `packages/db/src/schema/questions.ts`: questions, concepts (with 1536-dim vector), conceptEdges, conceptQuestions
- `packages/db/src/schema/classes.ts`: classes, classEnrollments
- `packages/db/src/schema/diagnostic-sessions.ts`: diagnosticSessions (JSONB messages, stage enum, outcome enum)
- `packages/db/src/schema/theme-lesson-plans.ts`: themeLessonPlans (JSONB lesson plan, data hash cache key)

**Testing:**
- `packages/llm/src/__tests__/`: LLM adapter and prompt tests
- `packages/misconceptions/src/__tests__/`: Library loader validation tests
- `packages/router/src/__tests__/`: Routing decision tests
- `apps/web/components/graph/__tests__/`: Graph filter tests
- `apps/web/lib/graph/__tests__/`: Graph algorithm tests (centrality, clustering)
- `apps/web/__tests__/actions/`: Server action tests

## Naming Conventions

**Files:**
- Routes: `page.tsx` (pages), `route.ts` (API handlers), `layout.tsx` (layouts) — Next.js App Router convention
- Components: `kebab-case.tsx` (e.g., `question-form.tsx`, `diagnostic-chat.tsx`, `bridge-toast.tsx`)
- Server Actions: `kebab-case.ts` grouped by domain (e.g., `actions/questions.ts`, `actions/graph.ts`)
- Hooks: `use-kebab-case.ts` (e.g., `use-graph-filters.ts`, `use-graph-layout.ts`)
- Schema: `kebab-case.ts` grouped by domain (e.g., `schema/diagnostic-sessions.ts`)
- Tests: `*.test.ts` in `__tests__/` directories (co-located with source)
- Types: Inline in files or in `lib/dashboard-types.ts` for shared types

**Exports:**
- Components: PascalCase named exports (e.g., `export function QuestionForm()`)
- Functions: camelCase named exports (e.g., `export function getGraphData()`)
- Types: PascalCase (e.g., `export type RoutingDecision`, `export interface GraphNode`)
- Schemas: camelCase with `Schema` suffix (e.g., `conceptExtractionSchema`, `lessonPlanSchema`)

**Directories:**
- Feature-based component grouping: `components/[feature]/` (auth, graph, dashboard, diagnostic, class, questions)
- Type-based in packages: `schema/`, `queries/`, `prompts/`, `adapters/`, `library/`
- Domain-based packages: `packages/[domain]` (db, llm, misconceptions, router)

## Where to Add New Code

**New Server Action (data-reading operation):**
- Create or add to: `apps/web/actions/[domain].ts`
- Pattern: `"use server"` pragma, start with `auth()` check, use `db` and `schema` from `@mindmap/db`
- Example: New class analytics → `apps/web/actions/class.ts`

**New API Route (streaming or webhook):**
- Create: `apps/web/app/api/[feature]/route.ts`
- Use Route Handlers for: streaming LLM responses, webhook endpoints, bearer-token-protected endpoints
- Use Server Actions for everything else (simpler, no manual Response construction)

**New React Component:**
- Feature component: `apps/web/components/[feature]/[component-name].tsx`
- Page-specific component used only once: can live in the same dir as the page, but prefer `components/`
- UI primitive: `apps/web/components/ui/[component-name].tsx` (use shadcn CLI: `npx shadcn@latest add [name]`)

**New Database Table:**
- Schema: `packages/db/src/schema/[domain].ts` — add table definition, export from `schema/index.ts`
- Migration: Run `pnpm --filter @mindmap/db db:generate` then `pnpm --filter @mindmap/db db:push`
- Queries: If complex, add helper to `packages/db/src/queries/[domain].ts`, export from `packages/db/src/index.ts`

**New LLM Prompt:**
- Create: `packages/llm/src/prompts/[feature].ts`
- Pattern: Export `buildXxxSystemPrompt()` function + Zod schema for structured output
- Export from: `packages/llm/src/index.ts`
- Test: `packages/llm/src/__tests__/[feature].test.ts`

**New Misconception Domain:**
- Create: `packages/misconceptions/library/[domain].yaml`
- Loader auto-discovers new YAML files (scans directory, excludes `themes.yaml`)
- No code changes needed — just add the YAML file

**New LLM Provider:**
- Create: `packages/llm/src/adapters/[provider].ts`
- Register in: `packages/llm/src/adapters/factory.ts` switch statement
- Set via: `LLM_PROVIDER` environment variable

**New Page Route:**
- Student route: `apps/web/app/student/[feature]/page.tsx` (auto-protected by middleware + layout auth check)
- Teacher route: `apps/web/app/teacher/[feature]/page.tsx` (same protection)
- Public route: `apps/web/app/(auth)/[feature]/page.tsx` or `apps/web/app/[feature]/page.tsx`

**Shared Types:**
- Cross-component types: `apps/web/lib/[domain]-types.ts`
- Package types: Export from package's `src/index.ts`
- Ambient declarations: `apps/web/types/[library].d.ts`

**Utility Functions:**
- App-specific: `apps/web/lib/[domain].ts` or `apps/web/lib/[domain]/[feature].ts`
- Package-specific: `packages/[pkg]/src/utils.ts`
- Graph algorithms: `apps/web/lib/graph/[algorithm].ts`

## Special Directories

**`packages/db/src/migrations/`:**
- Purpose: Auto-generated Drizzle SQL migration files
- Generated: Yes (via `drizzle-kit generate`)
- Committed: Yes (tracks schema evolution)
- Rule: Never edit manually; regenerate from schema changes

**`packages/misconceptions/library/`:**
- Purpose: Version-controlled YAML misconception entries and theme definitions
- Generated: No (human-authored, community-extensible)
- Committed: Yes (core content of the application)
- Format: One YAML file per domain; entries have ID, name, description, grade_band, probe_questions, confrontation_scenarios, themes

**`apps/web/.next/`:**
- Purpose: Next.js build output
- Generated: Yes (via `next build`)
- Committed: No (in `.gitignore`)

**`.planning/`:**
- Purpose: GSD workflow artifacts (plans, debug logs, codebase analysis)
- Generated: By GSD commands
- Committed: Yes (documentation trail)
- Subdirs: `codebase/` (this file), `phases/` (01-08), `debug/`, `quick/`, `research/`

**`scripts/`:**
- Purpose: Maintenance and audit scripts
- Contains: `priv-01-audit.sh` — scans codebase for PII leakage into LLM prompts
- Committed: Yes

**`apps/web/components/ui/`:**
- Purpose: shadcn/ui component primitives (copied into repo, not a package dependency)
- Generated: Via `npx shadcn@latest add [component]`
- Committed: Yes (source-owned, customizable)
- Rule: Do not import shadcn from npm; components live in this directory

**`node_modules/` (root + per-workspace):**
- Purpose: Installed packages
- Generated: Via `pnpm install`
- Committed: No (in `.gitignore`)
- Managed by pnpm workspaces; lockfile: `pnpm-lock.yaml`

---

*Structure analysis: 2026-04-14*
