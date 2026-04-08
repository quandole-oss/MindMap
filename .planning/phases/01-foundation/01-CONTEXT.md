# Phase 1: Foundation - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the Turborepo/pnpm monorepo with all packages, set up PostgreSQL + pgvector with Drizzle ORM, implement student/teacher authentication with class management, create the misconception library package with YAML validation, and establish the Next.js app shell with Tailwind + shadcn/ui.

</domain>

<decisions>
## Implementation Decisions

### Authentication & Sessions
- Use Auth.js v5 with Drizzle adapter for authentication
- Database sessions (not JWT) — more secure, revocable, COPPA-friendly with server-side TTL enforcement
- Teacher role selected at signup via student/teacher toggle — no admin approval needed
- Grade level set by teacher for class; students inherit class grade level — consistent, teacher-controlled

### UI Foundation
- Tailwind v4 + shadcn/ui for styling and components — copy-paste ownership, research validated
- Landing page with hero + login/signup — needed for the open-source story (visitors understand MindMap before signing up)
- Light mode only for v1 — ship faster, add dark mode in polish phase
- Sidebar nav for dashboard views, full-width for graph view — standard EdTech pattern

### Data Model & Misconception Library
- 6-character alphanumeric class join codes (e.g., `ABC123`) — easy to dictate in classroom, collision-resistant
- `expires_at` timestamp column on student records + scheduled cleanup job for COPPA TTL — explicit, auditable
- Integer 1-12 grade level (K=0) — simple, sortable, maps directly to misconception library grade bands
- Zod schema validates misconception YAML at build time + runtime parser in `@mindmap/misconceptions` — type-safe, catches errors early

### Claude's Discretion
- Specific Drizzle migration strategy and pgvector extension initialization sequence
- Auth.js v5 session/account table schema details
- Turborepo pipeline configuration and build ordering
- shadcn/ui component selection for initial shell

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield project — no existing code to reuse

### Established Patterns
- Stack decided: Next.js 15 + TypeScript, Drizzle ORM, PostgreSQL + pgvector, Tailwind v4 + shadcn/ui
- Monorepo structure: Turborepo/pnpm with /apps/web, /packages/db, /packages/llm, /packages/misconceptions, /packages/router
- Research recommended Drizzle over Prisma (smaller bundle, native pgvector types, better serverless cold starts)
- Research recommended Vercel AI SDK over hand-rolled LLM adapters

### Integration Points
- `@mindmap/db` exports schema and Drizzle client used by all other packages
- `@mindmap/misconceptions` exports typed misconception library used by `@mindmap/router`
- `apps/web` imports from all packages

</code_context>

<specifics>
## Specific Ideas

- Remote repo: https://labs.gauntletai.com/quanle/mindmap
- Misconception library covers 4 domains: physics (10-12 entries), biology (8-10), math (8-10), history/social studies (6-8) — 35+ total
- Each misconception entry: id, name, domain, grade_band, description, citation, probe_questions, confrontation scenarios
- Research flagged: pgvector `<=>` operator returns cosine DISTANCE not similarity — use `1 - (a <=> b)` for similarity
- Research flagged: Auth.js v5 still in extended beta — Lucia Auth v3 is documented fallback if instability appears

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
