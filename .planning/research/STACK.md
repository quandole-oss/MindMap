# Stack Research

**Domain:** AI-powered K-12 educational knowledge graph tool
**Researched:** 2026-04-08
**Confidence:** HIGH (core stack), MEDIUM (supporting libs), notes per layer

---

## Recommendation Summary

The brief's choices are largely correct. Two changes are worth making:

1. **Replace Prisma with Drizzle ORM** — Drizzle has a ~90% smaller bundle, runs within 10-20% of raw SQL, has first-class pgvector support, and is now the default in create-t3-app. For a Vercel + Neon deployment with serverless cold starts, Drizzle is meaningfully better.
2. **Use Vercel AI SDK (`ai`) as the LLM abstraction layer** — rather than hand-rolling the adapter pattern. It ships first-class providers for Anthropic, OpenAI, and Ollama with a two-line swap interface. This is the standard in 2025; rolling your own adds maintenance burden with no benefit.

Everything else in the brief (Next.js, Turborepo/pnpm, pgvector, D3.js, Docker/Neon, YAML library) is validated.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (stable) | Full-stack React framework | App Router + Server Actions eliminate a separate API layer; Vercel-native; RSC pattern fits K-12 dashboard well. Note: Next.js 16 released but 15.x is production-proven and risk-free for a capstone. |
| React | 19.x | UI rendering | Ships with Next.js 15; Server Components reduce client JS, critical for teacher dashboard page weight |
| TypeScript | 5.5+ | Type safety across monorepo | `strict: true` across all packages; Zod schemas derive from TS types |
| Turborepo | 2.x | Monorepo build orchestration | Remote caching, parallel task execution, dependency graph across `/apps` and `/packages`; `create-turbo` scaffold with pnpm is the standard starting point |
| pnpm | 9.x | Workspace package manager | Symlink-based node_modules saves disk space; workspace protocol (`workspace:*`) enforces local package references; faster than npm/yarn for monorepos |
| PostgreSQL | 16.x | Primary data store | ACID, mature, battle-tested; required host for pgvector; Neon runs Postgres 16 |
| pgvector | 0.8.x | Concept deduplication via embeddings | HNSW indexes for cosine similarity; stores 1536-dim OpenAI embeddings or 768-dim smaller models; enables semantic "is this the same concept?" queries |
| Drizzle ORM | 0.31+ | Type-safe database access + migrations | Code-first TypeScript schema = single source of truth; built-in pgvector column types (`vector`, `halfvec`); ~7.4 KB gzip vs Prisma's ~1.6 MB — critical for Vercel serverless cold starts; replaced Prisma in create-t3-app |
| Vercel AI SDK | 4.x (`ai`) | LLM provider abstraction | Ships `@ai-sdk/anthropic`, `@ai-sdk/openai`, and community `@ai-sdk/ollama` — swap provider in two lines; `generateObject` with Zod schemas is the standard for structured concept extraction; streaming built-in |
| Tailwind CSS | 4.x | Utility-first styling | v4 is stable and production-ready as of 2025; CSS-first config (no `tailwind.config.js`); 5x faster builds; pairs with shadcn/ui |
| shadcn/ui | latest (CLI-based) | Accessible UI component primitives | Not a package dependency — components are inlined (zero runtime overhead); full Server Components support; integrates with Radix UI for accessibility |

### Database Layer Detail

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Neon | serverless | Cloud PostgreSQL host | First-class Vercel integration; per-preview-deployment database branching; native pgvector support; HNSW indexing; 80% storage cost reduction in late 2025 |
| drizzle-kit | 0.22+ | Migration CLI | `drizzle-kit generate` + `drizzle-kit migrate`; works with Neon serverless driver |
| `@neondatabase/serverless` | latest | Neon connection driver | Required for edge/serverless; replaces `pg` in Vercel deployments |
| pgvector-node | 0.2+ | pgvector Node.js bindings | Typed vector arrays for insert/query; works alongside Drizzle |

### LLM Layer

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| `ai` (Vercel AI SDK) | 4.x | Provider-agnostic LLM calls | Core abstraction; `generateObject`, `generateText`, `streamText` |
| `@ai-sdk/anthropic` | latest | Anthropic Claude provider | Primary provider per brief; Claude 3.5 Sonnet recommended for quality/cost |
| `@ai-sdk/openai` | latest | OpenAI adapter | Secondary provider; also used for `text-embedding-3-small` (1536 dims) for pgvector |
| `ollama-ai-provider` | latest | Ollama adapter | Self-hosted LLM for Docker Compose deployment story; air-gap compatible |
| `@anthropic-ai/sdk` | latest | Direct Anthropic SDK | Keep as peer dep in `/packages/llm` for any capabilities not yet in AI SDK |

**Why Vercel AI SDK over hand-rolled adapters:** The brief specifies a pluggable adapter pattern. The AI SDK *is* that pattern, mature and maintained. Rolling a custom `LLMProvider` interface means maintaining provider-specific error handling, streaming formats, token counting, and retry logic — work that AI SDK already does.

**Why Vercel AI SDK over LangChain:** LangChain JS is heavyweight (~2MB), has frequent breaking changes between versions, and edge runtime restrictions. For this project's use case (structured generation + streaming answers), AI SDK is simpler and more appropriate.

### Visualization Layer

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| D3.js | 7.x | Force-directed graph engine | `d3-force` module handles physics simulation; direct DOM manipulation via `useRef` in React; best customization for node health states (healthy/misconception/bridge/unprobed) |
| `d3-force` | 3.x | Standalone physics (within D3) | Can import just the force module if bundle size matters |

**D3.js vs react-force-graph trade-off:**
- `react-force-graph` (vasturiano) is easier to integrate as a React component and handles canvas/WebGL rendering out of the box. It is appropriate if the graph is display-only.
- Raw D3.js is better when you need custom node rendering per state (the 4 health states with custom SVG/colors), drag-to-explore interactions, and animated transitions on node reclassification. For MindMap's use case, D3.js direct manipulation is the right choice — the brief is correct.
- Keep D3 manipulation isolated in a single `<KnowledgeGraph>` component that receives graph data as props; don't mix D3 DOM writes with React's virtual DOM.

### Auth

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Auth.js (NextAuth v5) | 5.0.0-beta.25+ | Email/password auth, session management | Still beta but stable enough for this use case; native App Router support; Credentials provider for email/password; Drizzle adapter available |

**Caveat (MEDIUM confidence):** Auth.js v5 is in extended beta as of April 2026. If instability is a blocker, `lucia-auth` v3 is a well-maintained alternative with simpler session primitives and an explicit Drizzle adapter.

### Validation & Forms

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Zod | 3.x | Schema validation + type inference | Standard for Next.js 15; validates AI SDK `generateObject` output schemas; validates YAML misconception library structure at load time; integrates with react-hook-form |
| react-hook-form | 7.x | Client-side form handling | Works with Next.js 15 Server Actions via `handleSubmit` bridge; required `"use client"` boundary |

### Monorepo Package Structure

Per the brief, the recommended structure is:

```
/apps
  /web              — Next.js 15 app (App Router)
/packages
  /db               — Drizzle schema, migrations, db client
  /llm              — Vercel AI SDK wrapper, provider config
  /misconceptions   — YAML loader, Zod schema, library types
  /router           — Enrich/diagnose routing logic
  /ui               — shadcn/ui components (if shared; optional for solo project)
```

Each package exports TypeScript types consumed by `/apps/web`. The `/packages/db` package exports the Drizzle client configured for both local Docker Postgres and Neon serverless.

### Development & Infrastructure

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker Compose | Local dev + self-host deployment | PostgreSQL 16 + pgvector extension; runs alongside Next.js dev server |
| Vitest | Unit + integration testing | 10-20x faster than Jest in watch mode; built-in TypeScript + ESM; preferred for monorepo packages; replaces Jest for new Next.js projects |
| ESLint | Linting | `@typescript-eslint/eslint-plugin` + `eslint-config-next` |
| Prettier | Formatting | Single config at monorepo root |
| `js-yaml` | YAML parsing | Loads misconception library at build/startup; Zod validates structure |

---

## Installation

```bash
# Scaffold monorepo
npx create-turbo@latest mindmap --package-manager pnpm

# Core app
cd apps/web
npx shadcn@latest init

# Database package
pnpm add drizzle-orm @neondatabase/serverless pgvector
pnpm add -D drizzle-kit

# LLM package
pnpm add ai @ai-sdk/anthropic @ai-sdk/openai @anthropic-ai/sdk

# Auth
pnpm add next-auth@beta @auth/drizzle-adapter

# Validation
pnpm add zod react-hook-form @hookform/resolvers

# Visualization
pnpm add d3
pnpm add -D @types/d3

# YAML + misconceptions package
pnpm add js-yaml
pnpm add -D @types/js-yaml

# Testing
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

---

## Alternatives Considered

| Recommended | Alternative | When Alternative Is Better |
|-------------|-------------|---------------------------|
| Drizzle ORM | Prisma | Team is already deep in Prisma, needs GUI, or build runs only on long-running servers (not serverless). Prisma 7 narrowed the gap with smaller binaries but still ~1.6 MB vs 7.4 KB. |
| Vercel AI SDK | Hand-rolled adapters | Never for this project — AI SDK is the pattern, not a constraint. |
| Vercel AI SDK | LangChain JS | Complex multi-agent orchestration, RAG pipelines with vector store management, or when LangGraph's stateful agent loop is needed. |
| Auth.js v5 | Lucia Auth v3 | Simpler session model, more predictable beta stability, explicit Drizzle adapter. Choose if Auth.js beta instability appears during implementation. |
| D3.js direct | react-force-graph | Display-only graph with no custom node states, or 3D graph needed. react-force-graph is faster to scaffold but harder to customize per-node. |
| Neon | Supabase | When you want a platform layer (Realtime, Storage, Edge Functions) alongside Postgres. For this project, Neon's Vercel integration and database branching are the better fit. |
| Tailwind CSS v4 | Tailwind CSS v3 | Migrating a large existing codebase where v4's CSS-first config is a migration risk. Greenfield: always v4. |
| Vitest | Jest | React Native in the monorepo, or heavy reliance on Jest-specific mocking ecosystem. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma on Vercel/serverless | Rust query engine binary is ~1.6 MB after v7 optimizations; cold starts are meaningfully slower; pgvector support requires manual raw SQL for distance functions | Drizzle ORM — native pgvector column types, ~7.4 KB bundle |
| LangChain JS | ~2 MB bundle, frequent breaking changes (v0.1 → v0.2 → v0.3 all had API rewrites), edge runtime incompatibility, significant complexity overhead for what this project needs | Vercel AI SDK `generateObject` for structured extraction |
| Supabase JS SDK | Adds a platform-level dependency; pgvector support is fine but the RLS/realtime complexity is unnecessary; ties you to Supabase hosting | Drizzle + Neon directly |
| Apollo GraphQL | No client-facing API is needed — Next.js Server Actions + RSC handle data fetching; Apollo adds bundle weight and operational complexity | Server Actions + Drizzle queries directly in RSC |
| Redux / Zustand (heavy) | Knowledge graph state is server-owned; only transient UI state (selected node, zoom level) needs client state | React `useState` / `useReducer` in the graph component; `useContext` for auth session |
| `mongoose` / MongoDB | pgvector is the core technical requirement; splitting concept embeddings from relational data (students, classes, sessions) into two databases adds operational complexity with no benefit | PostgreSQL + pgvector for everything |
| `create-react-app` or Vite standalone | Not applicable to this stack but often suggested in search results — Next.js App Router is the correct choice for SSR teacher dashboard and SEO-friendly student pages | Next.js 15 App Router |

---

## Stack Patterns by Variant

**Docker Compose self-host (no Neon):**
- Use `postgres:16-alpine` image with `ankane/pgvector` extension
- Drizzle connects via `DATABASE_URL=postgresql://user:pass@postgres:5432/mindmap`
- Replace `@neondatabase/serverless` with standard `pg` driver in db package
- Next.js runs in standalone output mode (`output: 'standalone'` in next.config.ts)

**Vercel + Neon cloud deployment:**
- `@neondatabase/serverless` with `neon()` HTTP connection (required for Edge/serverless)
- `AUTH_SECRET` set in Vercel env; Neon integration auto-sets `DATABASE_URL`
- Turborepo's `output: 'standalone'` + `outputFileTracingRoot` for Vercel

**Ollama (local LLM for self-host):**
- Swap `@ai-sdk/anthropic` for `ollama-ai-provider` in `/packages/llm`
- Embedding model: `nomic-embed-text` (768 dims) instead of OpenAI `text-embedding-3-small` (1536 dims)
- HNSW index dimension must match embedding model — set at schema creation time

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.x | React 19.x | Ships together; do not use React 18 with Next.js 15 |
| Auth.js v5 beta | Next.js 15 App Router | Middleware route protection works; use `5.0.0-beta.25+` specifically |
| Drizzle ORM 0.31+ | pgvector 0.8.x | Built-in `vector()` column type; HNSW index creation via `sql` template literal |
| Tailwind CSS v4 | shadcn/ui | shadcn supports v4 as of their 2025 update; run `npx shadcn@latest init` which auto-detects v4 |
| Vercel AI SDK 4.x | Next.js 15 | Full App Router support including streaming RSC |
| Vitest | Turborepo 2.x | Runs per-package; add `test` task to turbo.json pipeline |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Next.js 15 + React 19 | HIGH | Official stable release, October 2024; widely adopted |
| Turborepo 2.x + pnpm | HIGH | Official docs verified; standard pattern for Next.js monorepos |
| PostgreSQL + pgvector 0.8 | HIGH | Production-proven; HNSW indexing stable; Neon ships it natively |
| Drizzle ORM + pgvector | HIGH | Official Drizzle docs confirm built-in pgvector column types since 0.31 |
| Vercel AI SDK 4.x | HIGH | Official Vercel docs; providers for Anthropic/OpenAI/Ollama confirmed |
| D3.js v7 | HIGH | Official d3.js.org; v7 current; no v8 imminent |
| Auth.js v5 | MEDIUM | Beta status; API stable in beta.25+ but not semver-stable |
| Tailwind v4 + shadcn/ui | HIGH | Both officially support each other; stable since early 2025 |
| Neon + Vercel integration | HIGH | Official Vercel marketplace integration; branching confirmed |
| Vitest for monorepo testing | MEDIUM | Strong community signal; Vercel community recommends it for Next.js |

---

## Sources

- [Next.js 15 release blog](https://nextjs.org/blog/next-15) — official stable release confirmation
- [Drizzle ORM pgvector docs](https://orm.drizzle.team/docs/guides/vector-similarity-search) — built-in pgvector support, distance functions
- [pgvector GitHub](https://github.com/pgvector/pgvector) — v0.8.x changelog, HNSW support
- [Vercel AI SDK foundations](https://ai-sdk.dev/docs/foundations/providers-and-models) — provider abstraction model
- [AI SDK 4.2 release blog](https://vercel.com/blog/ai-sdk-4-2) — Anthropic + Ollama provider status
- [Drizzle vs Prisma (makerkit, 2026)](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) — bundle size comparison, serverless trade-offs
- [Neon pgvector docs](https://neon.com/docs/extensions/pgvector) — HNSW indexing, Vercel integration
- [Auth.js v5 migration guide](https://authjs.dev/getting-started/migrating-to-v5) — beta status, App Router support
- [Tailwind CSS v4 release](https://tailwindcss.com/blog/tailwindcss-v4) — stability, Next.js compatibility
- [react-force-graph GitHub](https://github.com/vasturiano/react-force-graph) — canvas/WebGL rendering approach
- WebSearch (multiple queries, April 2026) — MEDIUM confidence for comparative claims

---

*Stack research for: AI-powered K-12 educational knowledge graph (MindMap)*
*Researched: 2026-04-08*
