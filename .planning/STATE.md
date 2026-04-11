---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-04-11T01:36:45.444Z"
last_activity: 2026-04-11
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 28
  completed_plans: 26
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

Phase: 07 (3d-solar-system-knowledge-graph) — EXECUTING
Plan: 3 of 3
**Milestone**: v1 — Initial Release
**Current Phase**: 6 (Demo & Deployment) — COMPLETE
**Current Plan**: 4 (06-04) — DONE
**Phase Status**: Phase 6 complete — 4/4 plans done

```
Progress: [██████████] 100%

Phase 1: Foundation          [ COMPLETE — 4/4 plans done ]
Phase 2: Curiosity Engine    [ COMPLETE — 4/4 plans done ]
Phase 3: Knowledge Graph     [ COMPLETE — 4/4 plans done ]
Phase 4: Misconception Diag  [ COMPLETE — 2/2 plans done ]
Phase 5: Teacher Dashboard   [ COMPLETE — 3/3 plans done ]
Phase 6: Demo & Deployment   [ COMPLETE — 4/4 plans done ]
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 14 |
| Plans attempted | 14 |
| Phases completed | 4 |
| Requirements mapped | 49/49 |
| Node repairs used | 0 |
| Phase 05 P01 | 130 | 2 tasks | 3 files |
| Phase 05 P02 | 480 | 2 tasks | 8 files |
| Phase 05 P03 | 240 | 2 tasks | 3 files |
| Phase 06 P02 | 300 | 2 tasks | 6 files |
| Phase 06 P03 | 420 | 2 tasks | 3 files |
| Phase 06 P04 | 360 | 2 tasks | 17 files |
| Phase 07 P01 | 196 | 2 tasks | 5 files |
| Phase 07 P02 | 132 | 2 tasks | 3 files |
| Phase 08 P01 | 5m 39s | 3 tasks | 9 files |
| Phase 08 P02 | 30m | 2 tasks | 6 files |

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
| Phase 04-misconception-diagnostics P02 | 1800 | 2 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- Phase 8 added: Root-cause theme diagnosis and teacher remediation — surfaces hand-authored cross-domain themes, per-student narratives, and cached LLM lesson plan scaffolds in the teacher dashboard. Independent of in-progress Phase 7. See `/Users/q/.claude/plans/snug-greeting-nygaard.md` for the approved phase design.

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
| onFinish on toUIMessageStreamResponse not streamText | UIMessageStreamOnFinishCallback receives { messages: UI_MESSAGE[] } for persistence; StreamTextOnFinishCallback receives OnFinishEvent (token/step data) — wrong callback for saving updated conversation |
| Auto-init probe via sendMessage({ text: '__init__' }) | Reuses useChat transport for probe generation; __init__ sentinel filtered from display; probeInitiated ref prevents Strict Mode double-send |
| Client stage tracking uses initialStage prop only | Stage advances server-side; client trusts server props for terminal detection to avoid client-server drift |
| Batch all per-student queries via inArray (05-01) | 5 total DB queries regardless of class size; concepts/edges/questions/sessions all fetched in single batch then partitioned in JS |
| Breadth score denominator = unique domains across all class students (05-01) | Measures how much of the class's collective knowledge space each student has explored |
| Circular SVG layout for MiniGraphSvg (05-01) | Deterministic, server-renderable, no JS runtime needed; avoids D3 force simulation in RSC context |
| Custom tab bar with useState instead of shadcn Tabs (05-02) | Plan specifies this explicitly to avoid extra dependency; matches existing sidebar active/inactive styling |
| Teacher layout fetches getTeacherClasses server-side for sidebar (05-02) | Single fetch point for all teacher routes; no client-side data fetching needed for nav |
| Nested anchor fix in teacher class list (05-02) | Outer Link changed to div; dashboard link wraps content area, roster link is sibling — valid HTML, no onClick stopPropagation hacks |
| ConceptsTab is RSC-compatible (no use client) (05-03) | Only receives props, no interaction needed; MisconceptionsTab uses use client for drill-down toggle via useState |
| Heatmap and progress bar widths use inline styles for dynamic values (05-03) | Tailwind cannot express arbitrary runtime percentages/opacities; rgba opacity and percentage widths must be inline |
| pnpm@10.30.3 pinned in Dockerfile corepack (06-02) | Matches root packageManager field; mismatched version would cause build failures |
| Non-root nextjs user in Docker runner stage (06-02) | T-06-06 threat mitigation — elevation of privilege; addgroup/adduser + USER nextjs before CMD |
| next/font/google self-hosts fonts at build time (06-02) | No external tracking despite import name; Next.js downloads and serves font files statically |
| CRON_SECRET returns 503 when env var absent (06-03) | Distinguishes misconfiguration from bad auth token — 503 signals "not configured", 401 signals "wrong token" |
| PRIV-01 audit (06-03): all 9 LLM call sites confirmed compliant | No PII crosses application→LLM boundary; userId used only for DB ownership checks, never in prompts |
| WCAG AA colors via CSS custom props (06-04) | globals.css --color-* update propagates to health-legend.tsx via var() automatically; no direct component change needed |
| 503 for missing ANTHROPIC_API_KEY (06-04) | Returns generic JSON message; does not leak env var values (T-06-11); placed after auth check, before LLM calls |
| AppShell use client for mobile drawer (06-04) | Sidebar hidden below lg: breakpoint; hamburger triggers full-screen overlay drawer; main content px-4 sm:px-6 lg:px-8 |
| d3-force-3d has no @types package (07-01) | Created apps/web/types/d3-force-3d.d.ts with minimal declarations; generic type param changed from `<N extends SimulationNode>` to `<N = SimulationNode>` to avoid index-signature conflict with GraphNode |
| Html hover label rendered only for hovered node (07-02) | Avoids mounting 250 Html portals in DOM; <Html> only rendered when hoveredNode state is non-null |
| next/dynamic ssr:false in knowledge-graph.tsx (07-02) | Preserves existing import path for graph-page-client.tsx while preventing WebGL SSR crash; loading fallback matches #050510 background |
| OrbitControls makeDefault in solar-graph.tsx (07-02) | Required for useThree state.controls access in SolarScene camera fly-to useFrame loop |
| semanticFallback accepts model as parameter (e12) | Keeps @mindmap/router stateless — no circular dep on @mindmap/llm; caller (route.ts) already has the model instance |
| conceptNameToResolvedId Map in route.ts (e12) | diagnose branch looks up correct concept by name not resolvedConceptIds[0]; safe when best-match concept is not first in array |
| DOMAINS constant exported from extract.ts (e12) | Reused in semantic-fallback.ts prompt; single source of truth for 15-domain list |

### Open Questions

- What grade-band boundaries should the router use? (K-2, 3-5, 6-8, 9-12 suggested)
- Should the D3 graph have a node limit before pagination/clustering kicks in, or graceful degradation only?

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260409-cxq | Add spiral animation background to login/signup and student dashboard | 2026-04-09 | 31bcd75 | Done | [260409-cxq](./quick/260409-cxq-add-spiral-animation-background-to-login/) |
| 260409-e12 | Fix MindMap core AI engine | 2026-04-09 | 4552c79 | Verified | [260409-e12](./quick/260409-e12-fix-mindmap-core-ai-engine/) |

### Blockers

None.

### Todos

- Run `/gsd-plan-phase 1` to create the Phase 1 execution plan

---

## Session Continuity

**Last updated**: 2026-04-09
Last activity: 2026-04-11
**Last action**: Completed quick task 260409-e12 — fixed 4 AI pipeline bugs: 15-domain extraction enum with few-shot prompt, batched LLM semantic fallback in @mindmap/router, all-concepts routing with best-match selection, name-keyed concept ID map replacing resolvedConceptIds[0]
**Next action**: Phase 7 Plan 3 — final plan in phase

**Stack snapshot**:

- Monorepo: Turborepo + pnpm (DONE — all 5 packages scaffolded)
- Packages: `@mindmap/db`, `@mindmap/misconceptions`, `@mindmap/llm`, `@mindmap/router`, `apps/web`
- DB: PostgreSQL 16 + pgvector running in Docker, Drizzle ORM schema pushed (9 tables — diagnostic_sessions added with stage enum, outcome enum, jsonb messages)
- Frontend: Next.js 15.5.14, D3.js v7 installed, Sheet + Tooltip shadcn components added
- LLM: Vercel AI SDK, Anthropic Claude primary (Phase 2); diagnose-probe/confront/resolve prompt builders added
- Deployment: Docker Compose + Vercel/Neon
- Dashboard: getClassDashboardData() + all types + MiniGraphSvg (05-01); dashboard page + DashboardTabs + OverviewTab + StudentsTab + sidebar nav (05-02); ConceptsTab + MisconceptionsTab wired into all 4 tabs (05-03)

---
*State initialized: 2026-04-08*
*Last updated: 2026-04-08 after 05-01 plan completion*
