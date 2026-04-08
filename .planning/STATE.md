---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-04-08T21:34:36.718Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 12
  completed_plans: 11
  percent: 92
---

# State: MindMap

*Project memory. Updated by GSD workflow commands.*

---

## Project Reference

**Core Value**: Show what students actually believe, why they believe it, and how it connects to everything else they think they know.

**Current Focus**: Phase 3 — Knowledge Graph

**One-liner**: AI-powered K-12 curiosity engine with personal knowledge graph and misconception diagnostics.

---

## Current Position

Phase: 03 (Knowledge Graph) — EXECUTING
Plan: 4 of 4
**Milestone**: v1 — Initial Release
**Current Phase**: 3 (Knowledge Graph)
**Current Plan**: 4 (03-04) — NEXT
**Phase Status**: In Progress

```
Progress: [█████████░] 92%

Phase 1: Foundation          [ COMPLETE — 4/4 plans done ]
Phase 2: Curiosity Engine    [ COMPLETE — 4/4 plans done ]
Phase 3: Knowledge Graph     [ IN PROGRESS — 3/4 plans done ]
Phase 4: Misconception Diag  [ Not started ]
Phase 5: Teacher Dashboard   [ Not started ]
Phase 6: Demo & Deployment   [ Not started ]
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 11 |
| Plans attempted | 11 |
| Phases completed | 2 |
| Requirements mapped | 49/49 |
| Node repairs used | 0 |

### Execution History

| Plan | Duration (s) | Tasks | Files |
|------|-------------|-------|-------|
| Phase 01-foundation P01 | 220 | 2 tasks | 29 files |
| Phase 01-foundation P01-04 | 900 | 2 tasks | 13 files |
| Phase 02-curiosity-engine P01 | 215 | 2 tasks | 15 files |
| Phase 02-curiosity-engine P03 | 494 | 2 tasks | 11 files |
| Phase 02-curiosity-engine P04 | 137 | 3 tasks | 7 files |
| Phase 03-knowledge-graph P01 | 225 | 2 tasks | 9 files |
| Phase 03-knowledge-graph P02 | — | 1 task | 3 files |
| Phase 03-knowledge-graph P03 | 279 | 2 tasks | 7 files |

## Accumulated Context

### Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| 6 phases (standard granularity) | Requirements cluster naturally into foundation → curiosity → graph → diagnostics → dashboard → deploy |
| Phase 3 before Phase 4 | pgvector dedup is hardest problem; must work before diagnostic flow references graph node states |
| COPPA TTL in Phase 1 schema | Cannot retroactively migrate a multi-tenant schema; must be baked in from first migration |
| PRIV-01 (no PII in prompts) in Phase 2 | Prompt construction happens in the curiosity engine; privacy constraint applies at point of LLM call |
| MISC-01/02/03 in Phase 1 | Router (Phase 2) depends on misconception library; library must exist and validate before routing code |
| INFR-03/04 (LLM layer) in Phase 2 | First real LLM calls happen in the curiosity engine; adapter pattern built when first used |
| pgvector/pgvector:pg16 Docker image | pgvector pre-installed; avoids manual extension init vs postgres:16-alpine |
| Packages export TypeScript source directly | Next.js transpiles workspace packages; no compile step needed in packages |
| pgvector extension deferred to Phase 3 | No vector columns in Phase 1; premature init causes confusion |
| Two-query pattern in removeStudentAction | Fetch enrollment then verify class ownership — avoids needing Drizzle relation config |
| @base-ui/react AlertDialogTrigger has no asChild | Apply button styles directly via className — base-ui Trigger does not support asChild like Radix UI |
| Join code charset excludes 0,O,1,I | ABCDEFGHJKLMNPQRSTUVWXYZ23456789 for classroom dictation readability (AUTH-05) |
| Grade band inlined in enrich.ts | Avoided circular dep: @mindmap/llm importing @mindmap/router which imports @mindmap/misconceptions |
| Single-word concept matching is one-directional | Bidirectional substring match caused false positives (e.g. "gravity" matching "In space there is no gravity") |
| extractConcepts uses experimental_output + Output.object | AI SDK v6 pattern for Zod-validated structured LLM output |
| toTextStreamResponse() for useCompletion | toUIMessageStreamResponse() is for useChat; useCompletion expects text stream protocol |
| Peer deps unified in apps/web for drizzle-orm | @neondatabase/serverless + pg + @opentelemetry/api + @types/pg added to apps/web so drizzle-orm resolves to single instance matching @mindmap/db |
| createLLMAdapter().getModel() in API route | Avoids adding @ai-sdk/anthropic as apps/web direct dep; keeps adapter factory pattern consistent |
| getStreak() allows yesterday as streak start | Streak doesn't break until the day passes without a question; if today has no question yet, yesterday is a valid streak start |
| StreakBadge student-only in sidebar | Streak is a student feature; conditional on role === "student" to avoid showing in teacher sidebar |
| Sheet/Tooltip use @base-ui/react Drawer+Tooltip primitives | npx shadcn add unavailable in execution environment; components written manually matching existing alert-dialog.tsx pattern |
| visitCount defaults to 0 on concepts table | 0 is semantically correct for an unvisited concept; increments on first question link |
| GraphPageClient in separate file (graph-page-client.tsx) | Cleaner than inlining in page.tsx; NodeDetailPanel created in Task 1 since GraphPageClient imports it |
| D3 deep-clone nodes+links before forceSimulation | D3 mutates objects passed to simulation; cloning prevents React prop mutation bugs |
| D3 cleanup: simulation.stop() + svg.selectAll("*").remove() | Prevents memory leaks and React Strict Mode double-mount artifacts in useEffect |

### Open Questions

- What grade-band boundaries should the router use? (K-2, 3-5, 6-8, 9-12 suggested)
- Should the D3 graph have a node limit before pagination/clustering kicks in, or graceful degradation only?
- Weekly "surprise connection" (GRPH-08) — cron job or triggered on session end?

### Blockers

None.

### Todos

- Run `/gsd-plan-phase 1` to create the Phase 1 execution plan

---

## Session Continuity

**Last updated**: 2026-04-08
**Last action**: Completed 03-03 — D3 force-directed graph at /student/graph, getGraphData()/getNodeDetails() server actions, KnowledgeGraph SVG component, NodeDetailPanel Sheet, HealthLegend, sidebar "My Graph" link; awaiting human-verify checkpoint
**Next action**: Human verifies /student/graph visual interactions; then execute 03-04 (bridge detection)

**Stack snapshot**:

- Monorepo: Turborepo + pnpm (DONE — all 5 packages scaffolded)
- Packages: `@mindmap/db`, `@mindmap/misconceptions`, `@mindmap/llm`, `@mindmap/router`, `apps/web`
- DB: PostgreSQL 16 + pgvector running in Docker, Drizzle ORM schema pushed (8 tables — concepts now has embedding vector(1536) + visitCount; concept_edges added)
- Frontend: Next.js 15.5.14, D3.js v7 installed, Sheet + Tooltip shadcn components added
- LLM: Vercel AI SDK, Anthropic Claude primary (Phase 2)
- Deployment: Docker Compose + Vercel/Neon

---
*State initialized: 2026-04-08*
*Last updated: 2026-04-08 after 01-01 plan completion*
