---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-04-08T22:11:27.052Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 14
  completed_plans: 13
  percent: 93
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

Phase: 04 (Misconception Diagnostics) — EXECUTING
Plan: 2 of 2
**Milestone**: v1 — Initial Release
**Current Phase**: 4 (Misconception Diagnostics) — IN PROGRESS
**Current Plan**: 2 (04-02) — NEXT
**Phase Status**: Phase 4 in progress; 04-01 complete

```
Progress: [█████████░] 93%

Phase 1: Foundation          [ COMPLETE — 4/4 plans done ]
Phase 2: Curiosity Engine    [ COMPLETE — 4/4 plans done ]
Phase 3: Knowledge Graph     [ COMPLETE — 4/4 plans done ]
Phase 4: Misconception Diag  [ IN PROGRESS — 1/2 plans done ]
Phase 5: Teacher Dashboard   [ Not started ]
Phase 6: Demo & Deployment   [ Not started ]
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 13 |
| Plans attempted | 13 |
| Phases completed | 3 |
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
| Phase 03-knowledge-graph P04 | 480 | 2 tasks | 6 files |
| Phase 04-misconception-diagnostics P01 | 480 | 2 tasks | 8 files |

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
| Bridge defined as highest-centrality node with neighbors in 2+ domains | Brandes BFS algorithm; pure centrality alone doesn't guarantee cross-domain bridge |
| localStorage timestamp set before toast fires | Prevents React Strict Mode double-mount from showing toast twice on dev |
| data-node-id on SVG g elements | Enables external querySelector for pulse animation without D3 selection context |
| getBridgeConnection() fetches independently of getGraphData() | Called in parallel via Promise.all; avoids recomputing bridge in two server actions |
| questionId FK in diagnostic_sessions uses onDelete:set null | Preserves diagnostic session history when original question is deleted |
| jsonb messages uses $defaultFn(() => []) | Avoids Drizzle jsonb array default bug; application-level default only |
| diagnose branch in onFinish runs after createConceptEdges | All resolvedConceptIds available before session insert; first concept gets the session |

### Open Questions

- What grade-band boundaries should the router use? (K-2, 3-5, 6-8, 9-12 suggested)
- Should the D3 graph have a node limit before pagination/clustering kicks in, or graceful degradation only?

### Blockers

None.

### Todos

- Run `/gsd-plan-phase 1` to create the Phase 1 execution plan

---

## Session Continuity

**Last updated**: 2026-04-08
**Last action**: Completed 04-01 — diagnostic_sessions table (stage/outcome enums, jsonb messages), probe/confront/resolve prompt builders in @mindmap/llm, /api/ask diagnose branch creating sessions + setting concept status to misconception, getActiveSession/getSessionById/getSessionsForUser server actions
**Next action**: Execute 04-02 — multi-turn diagnostic chat API route

**Stack snapshot**:

- Monorepo: Turborepo + pnpm (DONE — all 5 packages scaffolded)
- Packages: `@mindmap/db`, `@mindmap/misconceptions`, `@mindmap/llm`, `@mindmap/router`, `apps/web`
- DB: PostgreSQL 16 + pgvector running in Docker, Drizzle ORM schema pushed (9 tables — diagnostic_sessions added with stage enum, outcome enum, jsonb messages)
- Frontend: Next.js 15.5.14, D3.js v7 installed, Sheet + Tooltip shadcn components added
- LLM: Vercel AI SDK, Anthropic Claude primary (Phase 2); diagnose-probe/confront/resolve prompt builders added
- Deployment: Docker Compose + Vercel/Neon

---
*State initialized: 2026-04-08*
*Last updated: 2026-04-08 after 01-01 plan completion*
