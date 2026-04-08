# MindMap

## What This Is

MindMap is an open-source, AI-powered educational tool for K-12 learners that combines a daily curiosity engine with a misconception diagnostic system. Students ask one question per day about anything they're curious about; the AI answers, extracts concepts, and builds a personal knowledge graph. When a concept is commonly misunderstood, the system shifts into diagnostic mode — probing the student's mental model through Socratic dialogue, classifying misconceptions against a research-backed library, and generating cognitive conflict to trigger genuine understanding. Teachers get a class-wide dashboard showing curiosity patterns, misconception clusters, and engagement metrics.

## Core Value

Show what students actually believe, why they believe it, and how it connects to everything else they think they know — not just what they got wrong.

## Requirements

### Validated

- ✓ User auth (students and teachers) with class management — Phase 1
- ✓ Misconception library (YAML, research-backed, 40 entries across 4 domains) — Phase 1

### Active

- [ ] Daily curiosity question interface with AI-powered rich answers
- [ ] Concept extraction pipeline from student questions
- [ ] Personal knowledge graph with force-directed D3.js visualization
- [ ] Node health states (healthy/misconception/unprobed/bridge)
- [ ] Misconception detection and Socratic diagnostic flow (probe/classify/confront/resolve)
- [ ] Routing engine: enrich mode vs. diagnose mode based on concept + grade band
- [ ] Concept deduplication via pgvector semantic similarity + LLM disambiguation
- [ ] Teacher class dashboard with misconception heatmap and engagement tracking
- [ ] Pluggable LLM layer (Anthropic first, then OpenAI/Ollama adapters)
- [ ] Docker Compose self-hosted deployment
- [ ] Cloud deployment support (Vercel + Neon)
- [ ] Standards alignment (optional NGSS/CCSS tagging via YAML config)
- [ ] Demo seed data (30-day and 60-day student sessions)

### Out of Scope

- Real-time chat — high complexity, not core to the learning model
- Video posts — storage/bandwidth costs disproportionate to value
- OAuth login (Google, GitHub) — email/password sufficient for v1
- Native mobile app — web-first, responsive design covers mobile
- Gamification beyond streaks — research shows extrinsic rewards can undermine intrinsic curiosity
- Multi-language misconception library — English first, i18n structure in place for community

## Context

- **Capstone project** — solo developer, ASAP timeline
- **Learning theory foundation**: Conceptual change theory (Chi, Vosniadou), interest-driven learning (Hidi & Renninger), connectivism (Siemens)
- **Target users**: K-12 students (self-directed or classroom), teachers, homeschool parents
- **Open source**: MIT licensed, designed for community contribution especially to the misconception library
- **The hard technical problem**: Concept deduplication using pgvector + LLM disambiguation — ensuring "gravity" in space and "gravity" in baking link correctly, while "wave" in physics and "wave" in music don't
- **Demo plan**: 5-minute live demo showing misconception detection, knowledge graph growth, and teacher dashboard

## Constraints

- **Tech stack**: Next.js + TypeScript, PostgreSQL + pgvector, D3.js, Docker Compose — as specified in brief
- **Monorepo**: Turborepo/pnpm workspace — `/apps/web`, `/packages/llm`, `/packages/misconceptions`, `/packages/db`, `/packages/router`
- **LLM**: Anthropic Claude API as primary provider; adapter pattern for OpenAI/Ollama
- **Deployment**: Dual — Docker Compose for self-host story, Vercel + Neon for dev/demo
- **Data privacy**: No telemetry, no data sent home — all student data stays on deployer's server
- **Misconception library**: YAML + Git, version-controlled, CI-validated, community-extensible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Monorepo with Turborepo/pnpm | Shared types, clear package boundaries, single repo for capstone | — Pending |
| Anthropic Claude as primary LLM | Developer preference; adapter pattern keeps it swappable | — Pending |
| pgvector for concept deduplication | Semantic similarity matching is core to the product; pgvector is battle-tested with PostgreSQL | — Pending |
| D3.js for graph visualization | Best-in-class for interactive network graphs; MIT licensed | — Pending |
| YAML for misconception library | Version-controlled, human-readable, low-friction for community contributions | — Pending |
| Dual deployment (Docker + Vercel) | Docker for the open-source self-host promise; Vercel for fast dev iteration and demo | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 after initialization*
