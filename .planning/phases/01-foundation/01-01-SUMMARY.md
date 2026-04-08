---
phase: 01-foundation
plan: 01
subsystem: infrastructure
tags: [monorepo, turborepo, pnpm, postgresql, pgvector, drizzle, docker, coppa, schema]
dependency_graph:
  requires: []
  provides:
    - Turborepo/pnpm monorepo structure with 5 packages
    - Docker Compose PostgreSQL 16 with pgvector
    - Drizzle ORM schema (6 tables) with COPPA TTL fields
    - Build pipeline (turbo build) across all packages
  affects:
    - All subsequent plans depend on this foundation
tech_stack:
  added:
    - turbo@2.9.5 (monorepo build orchestration)
    - pnpm@10.30.3 (workspace package manager)
    - next@15.5.14 (full-stack React framework)
    - drizzle-orm@0.45.2 (type-safe DB access)
    - drizzle-kit@0.31.10 (migration CLI)
    - pg@8.x (PostgreSQL node driver)
    - pgvector@0.2.1 (vector bindings)
    - "@neondatabase/serverless@1.0.2 (Neon/serverless driver)"
    - zod@3.x (schema validation)
    - js-yaml@4.1.1 (YAML parser for misconceptions)
    - vitest@4.x (testing framework)
  patterns:
    - Workspace packages export TypeScript source directly (no build step); Next.js transpiles
    - pgvector/pgvector:pg16 Docker image (pgvector pre-installed)
    - Drizzle schema-first with drizzle-kit push for local dev
key_files:
  created:
    - pnpm-workspace.yaml
    - turbo.json
    - package.json
    - docker-compose.yml
    - .env.example
    - .gitignore
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/tsconfig.json
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - apps/web/next-env.d.ts
    - packages/db/package.json
    - packages/db/tsconfig.json
    - packages/db/drizzle.config.ts
    - packages/db/src/index.ts
    - packages/db/src/schema/auth.ts
    - packages/db/src/schema/classes.ts
    - packages/db/src/schema/index.ts
    - packages/llm/package.json
    - packages/llm/tsconfig.json
    - packages/llm/src/index.ts
    - packages/router/package.json
    - packages/router/tsconfig.json
    - packages/router/src/index.ts
    - packages/misconceptions/package.json
    - packages/misconceptions/tsconfig.json
    - packages/misconceptions/src/index.ts
    - packages/misconceptions/src/library.ts
  modified: []
decisions:
  - "Used pgvector/pgvector:pg16 Docker image (not postgres:16-alpine) so pgvector extension is pre-installed"
  - "Packages export TypeScript source directly; no compile step needed since Next.js transpiles workspace packages"
  - "drizzle-kit push used for local dev schema deployment (no migration files needed in Phase 1)"
  - "role column defaults to 'student' with enum constraint — matches T-01-03 threat mitigation"
  - "pgvector extension NOT initialized in Phase 1 (no vector columns yet); deferred to Phase 3"
metrics:
  duration: "3m 40s"
  completed: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 29
  files_modified: 0
---

# Phase 1 Plan 1: Monorepo Scaffold + Database Schema Summary

**One-liner:** Turborepo/pnpm monorepo with 5 typed packages, Docker PostgreSQL 16+pgvector, and Drizzle schema with COPPA TTL fields pushed to database.

## What Was Built

Scaffolded the complete MindMap monorepo from scratch with all 5 packages (`apps/web`, `@mindmap/db`, `@mindmap/llm`, `@mindmap/router`, `@mindmap/misconceptions`), Docker Compose running pgvector-enabled PostgreSQL 16, and all 6 database tables with COPPA TTL `expires_at` columns on both `users` and `class_enrollments`.

## Tasks Completed

### Task 1: Scaffold Turborepo monorepo (commit: c36ad5b)

Created the complete monorepo structure manually (no `create-turbo` boilerplate):
- Root `package.json` with `pnpm@10.30.3` and turbo build scripts
- `pnpm-workspace.yaml` with `apps/*` and `packages/*` globs
- `turbo.json` with `dependsOn: ["^build"]` pipeline for correct dependency order
- `docker-compose.yml` using `pgvector/pgvector:pg16` (not `postgres:16-alpine`) so pgvector is pre-installed
- `apps/web` with Next.js 15, Auth.js beta, workspace deps on `@mindmap/db` and `@mindmap/misconceptions`
- `next.config.ts` with `serverExternalPackages: ["pg"]` and `transpilePackages` for all workspace packages
- Stub packages: `@mindmap/llm` (LLMAdapter interface), `@mindmap/router` (RoutingDecision type), `@mindmap/misconceptions` (Zod-validated Misconception type)
- `.gitignore` excluding `node_modules/`, `.next/`, `dist/`, `.env`, `.turbo/`
- `.env.example` with `DATABASE_URL` and `AUTH_SECRET` placeholders (real `.env` gitignored per T-01-01)

Verified: `pnpm install` completed, `pnpm build` passed all 5 packages, Docker container running.

### Task 2: Drizzle schema with COPPA TTL fields (commit: 1a65a73)

Created the full Drizzle ORM schema following Auth.js adapter requirements:

**`packages/db/src/schema/auth.ts`:**
- `users`: id, name, email, emailVerified, image (Auth.js required) + `role` enum["student","teacher"], `password_hash`, `expires_at` (COPPA TTL, INFR-06), `created_at`
- `sessions`: sessionToken, userId (FK cascade), expires
- `accounts`: userId (FK cascade), provider, providerAccountId, OAuth fields; composite PK on (provider, providerAccountId)
- `verificationTokens`: identifier, token, expires; composite PK

**`packages/db/src/schema/classes.ts`:**
- `classes`: id, name, join_code (unique), teacher_id (FK cascade), grade_level (integer, 0=K), created_at
- `class_enrollments`: id, class_id (FK cascade), student_id (FK cascade), grade_level, enrolled_at, `expires_at` (COPPA TTL, INFR-06); unique constraint on (class_id, student_id)

**Schema pushed** with `drizzle-kit push` — all 6 tables verified in PostgreSQL.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm install` | Passed |
| `pnpm build` (all 5 packages) | Passed |
| `docker compose ps` (postgres running) | Passed |
| `drizzle-kit push` | Applied |
| `psql \dt` shows 6 tables | Passed |
| `expires_at` in users | Confirmed (timestamptz) |
| `expires_at` in class_enrollments | Confirmed (timestamptz) |
| `.env` gitignored | Confirmed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] db package had no src/*.ts files during build**
- **Found during:** Task 1 build verification
- **Issue:** `@mindmap/db#build` failed with "No inputs were found" because schema files hadn't been created yet — Task 1 and Task 2 schema files are interdependent for the build to pass
- **Fix:** Created all Task 2 schema files before committing Task 1, then committed in task order
- **Files modified:** `packages/db/src/schema/auth.ts`, `packages/db/src/schema/classes.ts`, `packages/db/src/schema/index.ts`, `packages/db/src/index.ts`, `packages/db/drizzle.config.ts`
- **Commit:** 1a65a73

**2. [Rule 2 - Missing] Removed obsolete `version:` field from docker-compose.yml**
- **Found during:** Task 1 Docker startup
- **Issue:** Docker Compose showed warning `version attribute is obsolete` — modern Compose files don't use it
- **Fix:** Removed the `version: "3.8"` line from docker-compose.yml
- **Files modified:** `docker-compose.yml`

**3. [Rule 3 - Generated] next-env.d.ts created by Next.js build**
- **Found during:** Task 1 build
- **Issue:** `apps/web/next-env.d.ts` was generated by `next build` and left untracked
- **Fix:** Committed it (Next.js expects it to be in source control)
- **Commit:** 87b56e7

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `createLLMAdapter()` throws | `packages/llm/src/index.ts` | Phase 2 (Curiosity Engine) will implement; interface defined |
| `routeQuestion()` throws | `packages/router/src/index.ts` | Phase 2 will implement; type defined |
| `loadLibrary()` is functional but no YAML files yet | `packages/misconceptions/src/library.ts` | Phase 1 Plan 2 will add the 35+ YAML entries |

These stubs are intentional — packages export their interfaces for type safety. Implementations follow in their respective plans.

## Threat Surface Scan

No new threat surfaces beyond those documented in the plan's threat model. `.env` is gitignored (T-01-01 mitigated), role column defaults to "student" with enum constraint (T-01-03 mitigated), no external network calls in schema layer (PRIV-02 satisfied).

## Self-Check: PASSED
