# Technology Stack

**Analysis Date:** 2026-04-14

## Languages

**Primary:**
- TypeScript 5.5+ - Used across all packages and apps; `strict: true` in `apps/web/tsconfig.json`
- Target: ES2017, module resolution: `bundler`

**Secondary:**
- JavaScript - PostCSS configuration (`apps/web/postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js 20 (Alpine) - Production image in `Dockerfile`: `node:20-alpine`
- Local development: Node.js 24.13.0 detected on dev machine (no `.nvmrc` or `.node-version` file pins a version)

**Package Manager:**
- pnpm 10.30.3 - Pinned in root `package.json` via `"packageManager": "pnpm@10.30.3"`
- Lockfile: `pnpm-lock.yaml` present (lockfileVersion 9.0)
- Workspaces: `pnpm-workspace.yaml` defines `apps/*` and `packages/*`

## Frameworks

**Core:**
- Next.js ^15.3.0 - Full-stack React framework with App Router
  - Config: `apps/web/next.config.ts`
  - Output: `standalone` mode for Docker deployments
  - `outputFileTracingRoot`: set to monorepo root (`../../`) for proper standalone bundling
  - `serverExternalPackages`: `["pg"]`
  - `transpilePackages`: `["@mindmap/db", "@mindmap/misconceptions", "@mindmap/llm", "@mindmap/router"]`

- React ^19.0.0 - UI rendering with Server Components
- React DOM ^19.0.0 - DOM rendering

**Testing:**
- Vitest ^4.1.3 - Unit and integration tests across `apps/web`, `packages/llm`, `packages/misconceptions`, `packages/router`
  - Test file pattern: `src/__tests__/*.test.ts`
  - Run via `turbo test` at root

**Build/Dev:**
- Turborepo ^2.9 - Monorepo build orchestration
  - Config: `turbo.json`
  - Tasks defined: `build` (cached, depends on `^build`), `test` (cached), `lint` (cached), `dev` (uncached, persistent), `seed` (uncached)
  - Build outputs: `.next/**`, `dist/**` (excludes `.next/cache/**`)

## Key Dependencies

**Critical (AI/LLM):**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `ai` (Vercel AI SDK) | ^6.0.154 | `packages/llm`, `packages/router`, `apps/web` | Core LLM abstraction: `generateText`, `streamText`, `Output.object`, `embed` |
| `@ai-sdk/anthropic` | ^3.0.68 | `packages/llm` | Anthropic Claude provider adapter |
| `@ai-sdk/openai` | ^3.0.52 | `packages/llm` | OpenAI provider adapter (used exclusively for embeddings) |
| `@ai-sdk/react` | ^3.0.156 | `apps/web` | React hooks for AI SDK streaming UI integration |

**Database:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `drizzle-orm` | 0.45.2 (pinned via pnpm override) | `packages/db`, `apps/web` | Type-safe PostgreSQL ORM with native pgvector column types |
| `drizzle-kit` | ^0.31.10 | `packages/db` (dev) | Migration generation and push CLI |
| `pg` | ^8.20.0 | `packages/db`, `apps/web` | Standard Node.js PostgreSQL driver |
| `@neondatabase/serverless` | ^1.0.2 | `packages/db`, `apps/web` | Neon serverless PostgreSQL driver for Vercel/Edge |
| `pgvector` | ^0.2.1 | `packages/db` | pgvector Node.js bindings for vector operations |

**Authentication:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `next-auth` | beta | `apps/web` | Auth.js v5 for NextAuth; JWT session strategy |
| `@auth/drizzle-adapter` | ^1.11.1 | `apps/web` | Drizzle ORM adapter for NextAuth |
| `bcryptjs` | ^2.4.3 | `packages/db`, `apps/web` | Password hashing |

**Validation & Forms:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `zod` | ^3.25.0 | `packages/llm`, `packages/misconceptions`, `packages/router`, `apps/web` | Schema validation; integrated with AI SDK `Output.object` |
| `react-hook-form` | ^7.72.1 | `apps/web` | Client-side form handling |
| `@hookform/resolvers` | ^5.2.2 | `apps/web` | Zod resolver bridge for react-hook-form |

**Styling & UI:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `tailwindcss` | ^4.2.2 | `apps/web` (dev) | Utility-first CSS framework (v4, CSS-first config) |
| `@tailwindcss/postcss` | ^4.2.2 | `apps/web` (dev) | PostCSS plugin for Tailwind v4 |
| `shadcn` | ^4.2.0 | `apps/web` | CLI-based UI components (inlined, zero runtime) |
| `@base-ui/react` | ^1.3.0 | `apps/web` | Base UI primitives |
| `lucide-react` | ^1.7.0 | `apps/web` | Icon library |
| `class-variance-authority` | ^0.7.1 | `apps/web` | Component variant styling |
| `clsx` | ^2.1.1 | `apps/web` | Conditional class joining |
| `tailwind-merge` | ^3.5.0 | `apps/web` | Safe Tailwind class merging |
| `sonner` | ^2.0.7 | `apps/web` | Toast notifications |
| `tw-animate-css` | ^1.4.0 | `apps/web` | Tailwind animation utilities |

**Visualization & 3D:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `d3` | ^7.9.0 | `apps/web` | Force-directed graph engine and data visualization |
| `d3-force-3d` | ^3.0.6 | `apps/web` | 3D force simulation for knowledge graph |
| `three` | ^0.183.2 | `apps/web` | WebGL 3D rendering library |
| `@react-three/fiber` | ^9.5.0 | `apps/web` | React renderer for Three.js |
| `@react-three/drei` | ^10.7.7 | `apps/web` | Helper components for R3F |
| `@react-three/postprocessing` | ^3.0.4 | `apps/web` | Post-processing effects |
| `gsap` | ^3.14.2 | `apps/web` | JavaScript animation library |

**Content:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `react-markdown` | ^10.1.0 | `apps/web` | Markdown rendering for AI responses |
| `remark-gfm` | ^4.0.1 | `apps/web` | GitHub-flavored markdown plugin |
| `js-yaml` | ^4.1.1 | `packages/misconceptions` | YAML parsing for misconception library |

**Observability:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `@opentelemetry/api` | ^1.9.0 | `apps/web` | OpenTelemetry instrumentation API (present as dependency, not fully wired) |

**Dev-only Tools:**

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `tsx` | ^4.19.2 | `packages/db` (dev) | TypeScript execution for seed scripts |
| `@types/d3` | ^7.4.3 | `apps/web` (dev) | D3.js type definitions |
| `@types/three` | ^0.183.1 | `apps/web` (dev) | Three.js type definitions |
| `@types/pg` | ^8.20.0 | `apps/web`, `packages/db` (dev) | PostgreSQL driver type definitions |
| `@types/bcryptjs` | ^2.4.6 | `apps/web`, `packages/db` (dev) | bcryptjs type definitions |
| `@types/react` | ^19.0.0 | `apps/web` (dev) | React type definitions |
| `@types/react-dom` | ^19.0.0 | `apps/web` (dev) | ReactDOM type definitions |
| `@types/node` | ^25.5.2 | `packages/llm`, `packages/misconceptions`, `packages/router` (dev) | Node.js type definitions |
| `@types/js-yaml` | ^4.0.9 | `packages/misconceptions` (dev) | js-yaml type definitions |

## Configuration

**Styling (Tailwind v4 CSS-first):**
- No `tailwind.config.js` or `tailwind.config.ts` - Tailwind v4 uses CSS-first configuration
- Global styles: `apps/web/app/globals.css`
  - Imports: `@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`
  - Dark mode: `@custom-variant dark (&:is(.dark *))`
  - Theme tokens: CSS custom properties via `@theme inline {}`
- PostCSS config: `apps/web/postcss.config.mjs` (uses `@tailwindcss/postcss` plugin)

**TypeScript:**
- Path alias: `@/*` maps to `apps/web/*` (in `apps/web/tsconfig.json`)
- Compiler: `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`, `target: "ES2017"`
- Package entry points: All packages use `"main": "./src/index.ts"` and `"types": "./src/index.ts"` (raw TS, no pre-compilation)

**Monorepo Workspace References:**
- `@mindmap/db: workspace:*`
- `@mindmap/llm: workspace:*`
- `@mindmap/misconceptions: workspace:*`
- `@mindmap/router: workspace:*`

**Environment:**
- `.env.example` at root documents all required variables
- `.env` files present at root and `apps/web/` (gitignored)
- `NEXT_TELEMETRY_DISABLED=1` enforced in Docker (privacy per INFR-05)

**Build:**
- Drizzle: `packages/db/drizzle.config.ts` (dialect: postgresql, schema: `./src/schema/index.ts`, migrations: `./src/migrations`)
- Vercel: `vercel.json` at root
  - `buildCommand`: `pnpm turbo run build --filter=web`
  - `outputDirectory`: `apps/web/.next`
  - `ignoreCommand`: `npx turbo-ignore`

## Platform Requirements

**Development:**
- pnpm 10.30.3+ (corepack enabled)
- Node.js 20+ (Docker uses 20-alpine; local dev uses whatever is installed)
- PostgreSQL 16 with pgvector extension via `docker compose up postgres` (image: `pgvector/pgvector:pg16`)
- Anthropic API key (for AI features)
- OpenAI API key (for concept embeddings)

**Production (Docker Compose / Self-Hosted):**
- Docker + Docker Compose
- PostgreSQL 16 with pgvector (provided by `pgvector/pgvector:pg16` image)
- Next.js standalone mode (`node apps/web/server.js`)
- Non-root user in container (UID 1001, `nextjs` user)
- Port 3000 exposed

**Production (Vercel + Neon / SaaS):**
- Vercel deployment with Next.js framework detection
- Neon serverless PostgreSQL with pgvector support
- `@neondatabase/serverless` driver for edge/serverless connections
- Environment variables configured in Vercel dashboard (DATABASE_URL auto-set by Neon integration)

## Version Constraints / Compatibility Notes

| Constraint | Details |
|------------|---------|
| `drizzle-orm` pinned to 0.45.2 | Root `package.json` uses `pnpm.overrides` to force all packages to `0.45.2`. Known jsonb default bug in this version (see `packages/db/src/schema/diagnostic-sessions.ts` and `theme-lesson-plans.ts`). |
| `next-auth` on beta channel | Using Auth.js v5 beta (`"next-auth": "beta"`). API is stable at beta.25+ but not semver-stable. |
| React 19 required by Next.js 15 | Do not use React 18 with Next.js 15. |
| pgvector dimension must match embedding model | Schema uses 1536 dimensions (OpenAI `text-embedding-3-small`). Changing embedding model requires schema migration. |
| Vercel AI SDK v6 async changes | `convertToModelMessages` is async in AI SDK v6 (must `await`). Used in `apps/web/app/api/diagnose/route.ts`. |
| Node.js 20 in Docker vs local | Dockerfile pins Node 20-alpine. No `.nvmrc` file exists, so local dev may diverge. |
| Claude model ID | Hard-coded to `claude-sonnet-4-20250514` in `packages/llm/src/adapters/anthropic.ts`. |

---

*Stack analysis: 2026-04-14*
