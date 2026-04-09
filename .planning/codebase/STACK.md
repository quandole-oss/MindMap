# Technology Stack

**Analysis Date:** 2026-04-09

## Languages

**Primary:**
- TypeScript 5.5+ - Used across all packages and apps; strict mode enabled via `compilerOptions.strict: true` in `apps/web/tsconfig.json`

**Secondary:**
- JavaScript - PostCSS configuration files (`.mjs` format)

## Runtime

**Environment:**
- Node.js 20 (Alpine) - Base image in `Dockerfile`: `node:20-alpine`
- Specified in `Dockerfile` stages (base, pruner, installer, runner)

**Package Manager:**
- pnpm 10.30.3
- Lockfile: `pnpm-lock.yaml` present
- Workspaces configured via `pnpm-workspace.yaml` with paths: `apps/*`, `packages/*`

## Frameworks

**Core:**
- Next.js 15.3.0 - Full-stack React framework with App Router
  - Configured in `apps/web/next.config.ts`
  - Output: `standalone` mode for Docker deployments
  - Transpiles internal monorepo packages: `@mindmap/db`, `@mindmap/misconceptions`, `@mindmap/llm`, `@mindmap/router`
  - Server external packages: `pg` (specified in `apps/web/next.config.ts`)

- React 19.0.0 - UI rendering with Server Components support
- React DOM 19.0.0 - DOM rendering

**Testing:**
- Vitest 4.1.3 - Unit and integration tests
  - Config files: `apps/web/vitest.config.ts`, `packages/*/vitest.config.ts`
  - Test pattern: `**/__tests__/**/*.test.ts`
  - Configured with globals enabled in package-level configs

**Build/Dev:**
- Turborepo 2.9 - Monorepo build orchestration
  - Configuration: `turbo.json`
  - Tasks: `build`, `test`, `lint`, `dev`, `seed`
  - Remote caching capable

- Drizzle ORM 0.45.2 - Type-safe database access
  - Config: `packages/db/drizzle.config.ts`
  - Dialect: PostgreSQL
  - Supports pgvector column types for embeddings
  - Migration tools: `drizzle-kit 0.31.10`

## Key Dependencies

**Critical:**
- ai (Vercel AI SDK) 6.0.154 - LLM provider abstraction layer
  - Used in `@mindmap/llm`, `@mindmap/router`, `apps/web`
  - Provides `generateObject`, `generateText` for structured outputs

- @ai-sdk/anthropic 3.0.68 - Anthropic Claude provider
- @ai-sdk/openai 3.0.52 - OpenAI provider (for embeddings)
- @ai-sdk/react 3.0.156 - React hooks for AI SDK (streaming, UI integration)

**Infrastructure:**
- pg 8.20.0 - PostgreSQL client
  - Used in `@mindmap/db` and `apps/web`
  - Serverless driver: `@neondatabase/serverless 1.0.2` (required for Vercel deployments)

- pgvector 0.2.1 - PostgreSQL vector extension bindings
  - Enables semantic similarity searches for concept deduplication
  - Dimension support: configurable at schema creation (typically 1536 for OpenAI embeddings)

- bcryptjs 2.4.3 - Password hashing for authentication

**Authentication:**
- next-auth (beta) - Authentication and session management
  - Adapter: `@auth/drizzle-adapter 1.11.1` - NextAuth integration with Drizzle ORM
  - Config files: `apps/web/lib/auth.config.ts`, `apps/web/lib/auth.ts`
  - Routes: `apps/web/app/api/auth/[...nextauth]`

**Data Validation & Schemas:**
- Zod 3.25.0+ - Runtime schema validation
  - Used across packages for type inference and validation
  - Integrated with `ai` SDK for `generateObject` output validation

**Styling:**
- Tailwind CSS 4.2.2 - Utility-first CSS framework
  - PostCSS plugin: `@tailwindcss/postcss 4.2.2`
  - Config via `postcss.config.mjs`
  - CSS-first configuration (no `tailwind.config.js` file at root)

- shadcn/ui (latest, CLI-based) - Accessible UI components
  - Config: `apps/web/components.json`
  - Components inlined (zero runtime dependency)
  - RSC enabled via `"rsc": true` in components.json
  - Base style: `base-nova`
  - Icon library: lucide-react

**UI Components & Utilities:**
- lucide-react 1.7.0 - Icon library
- @base-ui/react 1.3.0 - Base UI primitives
- class-variance-authority 0.7.1 - Component variant styling utility
- clsx 2.1.1 - Conditional CSS class utility
- tailwind-merge 3.5.0 - Merge Tailwind classes safely
- sonner 2.0.7 - Toast notifications
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub flavored markdown plugin

**3D/Visualization:**
- D3.js 7.9.0 - Data visualization and force-directed graph layout
  - Used for knowledge graph visualization
  - Component isolation: `apps/web/components/graph`

- d3-force-3d 3.0.6 - 3D force simulation

- Three.js 0.183.2 - WebGL 3D library
  - React bindings: `@react-three/fiber 9.5.0`
  - Utilities: `@react-three/drei 10.7.7`
  - Effects: `@react-three/postprocessing 3.0.4`

**Animation:**
- GSAP 3.14.2 - JavaScript animation library
- tw-animate-css 1.4.0 - Tailwind-based animations

**Forms:**
- react-hook-form 7.72.1 - Form state and validation
  - Resolvers: `@hookform/resolvers 5.2.2` (Zod integration)

**Configuration Data:**
- js-yaml 4.1.1 - YAML parsing for misconception library
  - Used in `@mindmap/misconceptions` package

**Observability:**
- @opentelemetry/api 1.9.0 - OpenTelemetry API for instrumentation

## Configuration

**Environment:**
- `.env.example` file present at root with key variables:
  - `DATABASE_URL` - PostgreSQL connection string
  - `AUTH_SECRET` - NextAuth session encryption key (min 32 characters)
  - `ANTHROPIC_API_KEY` - Claude API credentials
  - `OPENAI_API_KEY` - OpenAI API credentials for embeddings
  - `NODE_ENV` - Set to `production` in Docker
  - `NEXT_TELEMETRY_DISABLED` - Set to `1` in Docker (privacy enforcement per INFR-05)

**Build:**
- TypeScript strict mode: `compilerOptions.strict: true` in `apps/web/tsconfig.json`
- Next.js App Router: `output: "standalone"` for Docker compatibility
- Drizzle configuration: `packages/db/drizzle.config.ts` (dialect: postgresql)
- Vercel deployment config: `vercel.json`
  - Build command: `pnpm turbo run build --filter=web`
  - Output directory: `apps/web/.next`
  - Framework: `nextjs`

## Platform Requirements

**Development:**
- pnpm 10.30.3+ (monorepo package manager)
- Node.js 20+ (for build and development)
- PostgreSQL 16 with pgvector extension (via Docker Compose or local installation)
  - Docker image: `pgvector/pgvector:pg16` (in `docker-compose.yml`)

**Production:**
- Docker Compose deployment: PostgreSQL 16 + pgvector + Next.js standalone
- Vercel deployment: Next.js 15 + Neon PostgreSQL (serverless)
  - Database connection via `@neondatabase/serverless` driver
  - Environment variables set via Vercel project dashboard or Neon integration

## Deployment Variants

**Docker Compose (Self-Hosted):**
- Runtime: Node.js 20-Alpine
- Database: PostgreSQL 16 with pgvector extension
- Orchestration: Docker Compose (`docker-compose.yml`)
- Next.js mode: Standalone with non-root user (UID 1001)

**Vercel (SaaS):**
- Framework: Next.js with App Router
- Database: Neon (serverless PostgreSQL with pgvector)
- Connection driver: `@neondatabase/serverless`
- Build integration: `vercel.json` with turbo ignore command

---

*Stack analysis: 2026-04-09*
