# Phase 6: Demo & Deployment - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Finalize Docker Compose for one-command self-hosting, prepare Vercel + Neon deployment config, create seed data scripts (30-day, 60-day student sessions + 20+ student class), ensure WCAG AA accessibility, add graceful LLM error handling, enforce PRIV-01 (no PII in prompts), and implement COPPA TTL data cleanup.

</domain>

<decisions>
## Implementation Decisions

### Deployment
- Docker Compose: multi-stage Dockerfile for Next.js with turbo prune, pgvector PostgreSQL, env vars only configuration needed
- Vercel: vercel.json with build settings, Neon serverless PostgreSQL for production
- Seed data scripts run via `pnpm seed` command

### Seed Data
- 30-day student: ~30 questions across multiple domains, realistic concept graph with dedup merges
- 60-day student: ~60 questions, more mature graph with bridge nodes and misconception repairs
- 20+ student class: teacher + students with varied engagement levels, some inactive, some with misconceptions
- Seed script inserts directly via Drizzle ORM — no API calls needed

### Privacy & Compliance
- PRIV-01 audit: verify no student PII reaches LLM prompts (already implemented, needs verification)
- PRIV-03: COPPA TTL cleanup job — cron or scheduled function that deletes expired student records
- INFR-05: no telemetry, no third-party scripts — audit existing code

### Polish
- WCAG AA: audit color contrast for all node health colors and UI elements
- Responsive: test at 375px viewport width
- Error handling: graceful fallback when ANTHROPIC_API_KEY or OPENAI_API_KEY missing/invalid

### Claude's Discretion
- Dockerfile optimization (multi-stage build, layer caching)
- Seed data content (specific questions and concepts)
- COPPA cleanup scheduling mechanism
- Vercel deployment configuration details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- docker-compose.yml already exists (pgvector PostgreSQL)
- .env.example with DATABASE_URL
- All Drizzle schema and queries
- All UI components built in Phases 1-5

### Integration Points
- Dockerfile needs to be created for the Next.js app
- Seed script needs access to all DB schema + misconception library
- COPPA cleanup needs access to users table expires_at column
- Vercel config needs environment variable setup

</code_context>

<specifics>
## Specific Ideas

- Use turbo prune for minimal Docker image
- Seed script as packages/db/src/seed.ts executable via tsx
- COPPA cleanup as a Next.js API route callable by external cron (Vercel Cron or system cron in Docker)

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase

</deferred>
