# State: MindMap

*Project memory. Updated by GSD workflow commands.*

---

## Project Reference

**Core Value**: Show what students actually believe, why they believe it, and how it connects to everything else they think they know.

**Current Focus**: Phase 1 — Foundation

**One-liner**: AI-powered K-12 curiosity engine with personal knowledge graph and misconception diagnostics.

---

## Current Position

**Milestone**: v1 — Initial Release
**Current Phase**: 1 (Foundation)
**Current Plan**: None started
**Phase Status**: Not started

```
Progress: [··········] 0%

Phase 1: Foundation          [ Not started ]
Phase 2: Curiosity Engine    [ Not started ]
Phase 3: Knowledge Graph     [ Not started ]
Phase 4: Misconception Diag  [ Not started ]
Phase 5: Teacher Dashboard   [ Not started ]
Phase 6: Demo & Deployment   [ Not started ]
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 0 |
| Plans attempted | 0 |
| Phases completed | 0 |
| Requirements mapped | 49/49 |
| Node repairs used | 0 |

---

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
**Last action**: Roadmap created — 6 phases, 49/49 requirements mapped
**Next action**: Plan Phase 1 (Foundation)

**Stack snapshot**:
- Monorepo: Turborepo + pnpm
- Packages: `@mindmap/db`, `@mindmap/misconceptions`, `@mindmap/llm`, `@mindmap/router`, `apps/web`
- DB: PostgreSQL + pgvector, Drizzle ORM
- Frontend: Next.js 15, D3.js v7
- LLM: Vercel AI SDK, Anthropic Claude primary
- Deployment: Docker Compose + Vercel/Neon

---
*State initialized: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
