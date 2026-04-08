---
phase: 06-demo-deployment
plan: 02
subsystem: infrastructure
tags: [docker, vercel, deployment, telemetry, infr-01, infr-02, infr-05]
dependency_graph:
  requires: []
  provides: [docker-compose-full-stack, vercel-deployment, telemetry-disabled]
  affects: [apps/web, Dockerfile, docker-compose.yml, vercel.json]
tech_stack:
  added: []
  patterns:
    - turbo-prune-docker-multi-stage
    - next-standalone-output
    - non-root-docker-user
    - docker-healthcheck-depends-on
key_files:
  created:
    - Dockerfile
    - .dockerignore
    - vercel.json
  modified:
    - docker-compose.yml
    - apps/web/next.config.ts
    - .env.example
decisions:
  - pnpm@10.30.3 pinned in Dockerfile corepack (matches root package.json packageManager field)
  - Non-root nextjs user added in runner stage (T-06-06 threat mitigation)
  - apps/web/public omitted from Dockerfile COPY — directory does not exist in this project
  - next/font/google self-hosts fonts via Next.js; no external tracking despite the import name
metrics:
  duration_seconds: ~300
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_changed: 6
---

# Phase 6 Plan 2: Docker Compose + Vercel Deployment Configuration Summary

**One-liner**: Multi-stage Dockerfile with turbo prune, full-stack docker-compose, Vercel monorepo config, and confirmed zero-telemetry layout for INFR-01/02/05.

---

## What Was Built

### Task 1 — Dockerfile, .dockerignore, docker-compose.yml, next.config.ts

**Dockerfile** (4-stage multi-stage build at repo root):
- `base`: `node:20-alpine` with corepack + pnpm@10.30.3
- `pruner`: Copies full repo, runs `pnpm turbo prune web --docker` to generate minimal `out/json/` and `out/full/` trees
- `installer`: Installs from pruned lockfile + package.jsons (cache layer), then copies source and runs `pnpm turbo run build --filter=web`
- `runner`: Minimal `node:20-alpine` production image; runs as non-root `nextjs` user; serves `apps/web/server.js` from standalone output

**apps/web/next.config.ts** updated with:
- `output: "standalone"` — Next.js standalone mode for Docker
- `outputFileTracingRoot: path.join(__dirname, "../../")` — monorepo root for correct file tracing

**docker-compose.yml** updated with:
- postgres service now has a `healthcheck` (`pg_isready -U mindmap`)
- New `web` service: builds from `Dockerfile`, depends on postgres `condition: service_healthy`, sets `NEXT_TELEMETRY_DISABLED: "1"`, passes `AUTH_SECRET` and API keys from host environment

**.dockerignore** created excluding: `node_modules`, `.next`, `.git`, `.env`, `.env.local`, `*.md`, `.planning`, `.turbo`

### Task 2 — vercel.json, .env.example, INFR-05 telemetry audit

**vercel.json** created with:
- `buildCommand`: `pnpm turbo run build --filter=web`
- `outputDirectory`: `apps/web/.next`
- `framework`: `nextjs`
- `ignoreCommand`: `npx turbo-ignore`

**.env.example** expanded with full documentation covering DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY, OPENAI_API_KEY, deployment notes for both Docker Compose and Vercel+Neon paths, and INFR-05 privacy section.

**INFR-05 telemetry audit**: `apps/web/app/layout.tsx` confirmed clean — no `<Script>` tags, no analytics imports. `next/font/google` is used for Inter font but Next.js self-hosts the font files at build time; no external requests are made at runtime. No telemetry of any kind exists in the application.

---

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 | b6be21e | Dockerfile, .dockerignore, docker-compose.yml, apps/web/next.config.ts |
| 2 | 01f999e | vercel.json, .env.example |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Non-root Docker user added**
- **Found during**: Task 1
- **Issue**: Threat model T-06-06 requires running as non-root user; plan body mentioned `USER nextjs` but did not make it explicit in the action steps
- **Fix**: Added `addgroup`/`adduser` commands in runner stage and `USER nextjs` before `CMD`
- **Files modified**: Dockerfile
- **Commit**: b6be21e

**2. [Rule 2 - Correctness] Skipped apps/web/public COPY**
- **Found during**: Task 1
- **Issue**: Plan said "check first with `ls apps/web/public` — if it doesn't exist, skip this COPY"; the directory does not exist in this project
- **Fix**: Omitted the COPY line entirely rather than adding a conditional that would fail at build time
- **Files modified**: Dockerfile
- **Commit**: b6be21e

**3. [Rule 1 - Bug] pnpm version pinned to actual packageManager version**
- **Found during**: Task 1
- **Issue**: Plan specified `corepack prepare pnpm@9 --activate` but root `package.json` declares `"packageManager": "pnpm@10.30.3"`; mismatched version would cause build failures
- **Fix**: Used `pnpm@10.30.3` in Dockerfile corepack line
- **Files modified**: Dockerfile
- **Commit**: b6be21e

---

## Known Stubs

None — all deployment configuration is complete and wired to real values.

---

## Threat Surface Scan

No new trust boundaries or security-relevant surfaces introduced beyond what the plan's threat model covered. Mitigations applied:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-06-03 | .dockerignore excludes .env; no secrets COPYed into image; runtime env vars only |
| T-06-04 | .env.example documents that API keys go in Vercel project settings, not committed |
| T-06-05 | NEXT_TELEMETRY_DISABLED=1 in docker-compose.yml; layout.tsx audit confirmed no analytics |
| T-06-06 | Non-root nextjs user in runner stage with addgroup/adduser |

---

## Self-Check: PASSED

All files verified present via Read tool:
- FOUND: Dockerfile
- FOUND: .dockerignore
- FOUND: docker-compose.yml
- FOUND: vercel.json
- FOUND: .env.example
- FOUND: apps/web/next.config.ts
- FOUND: .planning/phases/06-demo-deployment/06-02-SUMMARY.md

Commits b6be21e and 01f999e confirmed in git log (verified during execution).
