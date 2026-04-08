# Roadmap: MindMap

**Milestone:** v1 — Initial Release
**Created:** 2026-04-08
**Granularity:** Standard (6 phases)
**Coverage:** 49/49 requirements mapped

---

## Phases

- [x] **Phase 1: Foundation** - Monorepo scaffold, database schema, misconception library package, and authentication (completed 2026-04-08)
- [x] **Phase 2: Curiosity Engine** - Daily question submission, AI-powered answers, concept extraction, and routing logic (completed 2026-04-08)
- [ ] **Phase 3: Knowledge Graph** - pgvector concept deduplication, graph storage, and D3.js force-directed visualization
- [ ] **Phase 4: Misconception Diagnostics** - Full probe/classify/confront/resolve diagnostic flow with node state management
- [ ] **Phase 5: Teacher Dashboard** - Class management, misconception heatmap, engagement analytics, and curiosity metrics
- [ ] **Phase 6: Demo & Deployment** - Seed data generation, Docker Compose, Vercel deployment, privacy hardening, and polish

---

## Phase Details

### Phase 1: Foundation
**Goal**: The monorepo builds cleanly, the database schema is fully migrated with COPPA TTL fields, the misconception library package loads and validates, and students and teachers can create accounts and log in
**Depends on**: Nothing
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, MISC-01, MISC-02, MISC-03, INFR-06, PRIV-02
**Success Criteria** (what must be TRUE):
  1. Student can sign up with email/password, log in, refresh the browser, and remain authenticated
  2. Teacher can sign up with teacher role, create a class, and share the join code with students who successfully join
  3. Teacher can view their class roster including each student's grade level
  4. The YAML misconception library loads from `@mindmap/misconceptions`, passes CI schema validation, and returns probe questions for a given concept + grade band lookup
  5. Running `pnpm build` from the repo root completes without errors across all packages in dependency order
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold, Docker Compose, Drizzle schema with COPPA TTL
- [x] 01-02-PLAN.md — Misconception library package (YAML + Zod + Vitest)
- [x] 01-03-PLAN.md — Auth.js v5 authentication, landing page, app shell UI
- [x] 01-04-PLAN.md — Class management (create, join, roster, grade levels)
**UI hint**: yes

### Phase 2: Curiosity Engine
**Goal**: A student can submit a daily curiosity question, receive an age-appropriate AI answer with a Socratic follow-up, and watch concepts automatically appear as nodes on their graph — and the routing engine correctly decides enrich vs. diagnose mode
**Depends on**: Phase 1
**Requirements**: CURI-01, CURI-02, CURI-03, CURI-04, CURI-05, CURI-06, CURI-07, MISC-04, MISC-05, INFR-03, INFR-04, PRIV-01
**Success Criteria** (what must be TRUE):
  1. Student can submit exactly one curiosity question per day; a second submission on the same day is blocked with a clear message
  2. Student receives an AI answer calibrated to their grade level with one Socratic follow-up question appended
  3. Student can view their complete question history with timestamps and the AI response for each entry
  4. Student's daily streak counter increments correctly and is visible on their profile
  5. After submitting a question, new concept nodes appear in the student's knowledge graph, and the routing engine logs whether enrich or diagnose mode was selected for each concept
**Plans**: 4 plans
Plans:
- [x] 02-01-PLAN.md — LLM adapter (Anthropic Claude via AI SDK v6) + routing engine with tests
- [x] 02-02-PLAN.md — Database schema (questions, concepts, concept_questions) + drizzle-kit push
- [x] 02-03-PLAN.md — Streaming API route + question form UI + concept extraction pipeline
- [x] 02-04-PLAN.md — Question history page + streak tracking + sidebar navigation update
**UI hint**: yes

### Phase 3: Knowledge Graph
**Goal**: Every extracted concept is correctly deduplicated against the student's existing graph via pgvector semantic search and LLM disambiguation, stored with embedding vectors, and rendered as an interactive force-directed D3.js graph the student can explore
**Depends on**: Phase 2
**Requirements**: GRPH-01, GRPH-02, GRPH-03, GRPH-04, GRPH-05, GRPH-06, GRPH-07, GRPH-08
**Success Criteria** (what must be TRUE):
  1. Submitting questions about "gravity in space" and "gravity in baking" results in one shared node; "wave in physics" and "wave in music" result in two distinct nodes
  2. The force-directed D3.js graph renders all concept nodes with size scaled to visit count and color encoding health state (teal/coral/gray/purple)
  3. Student can click any node and see the original questions and AI exchanges that created it
  4. Graph renders without performance degradation on a mobile browser with up to ~250 nodes visible
  5. The "weekly surprise connection" surfaces a cross-subject bridge node the student has not explicitly linked
**Plans**: TBD
**UI hint**: yes

### Phase 4: Misconception Diagnostics
**Goal**: When the routing engine selects diagnose mode, the student experiences a complete Socratic diagnostic session — open probe, mental model classification, targeted confrontation scenario, and resolution — with the node health state updating to reflect the outcome
**Depends on**: Phase 3
**Requirements**: MISC-06, MISC-07, MISC-08, MISC-09, MISC-10
**Success Criteria** (what must be TRUE):
  1. When a student question matches a known misconception for their grade band, the AI opens with an open-ended probe question rather than directly answering
  2. After the student responds, the AI classifies the student's mental model against the misconception library and logs the matched misconception id
  3. The AI generates a targeted confrontation scenario presenting a counterexample that creates cognitive conflict for the specific classified misconception
  4. After a successful repair exchange the concept node turns from coral to teal; if the session ends unresolved the node remains coral
  5. After a diagnostic session the student can see the named misconception they held (e.g., "You were thinking about heat flow as a fluid — this is called the Caloric Theory misconception")
**Plans**: TBD

### Phase 5: Teacher Dashboard
**Goal**: A teacher can open their class dashboard and immediately see which concepts are widespread across students, which misconceptions are persistent, which students are disengaging, and each student's individual curiosity breadth — all derived from live student data
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Teacher can view a thumbnail knowledge graph for each student in their class from a single dashboard view
  2. Teacher can view a class-wide concept heatmap showing which topics appear across multiple students, with frequency encoding
  3. Teacher can view a misconception cluster view showing which misconceptions from the library are widespread, and drill down to see affected students
  4. Teacher can track misconception repair progress — seeing how many students have resolved a misconception vs. how many still carry it as coral nodes
  5. Teacher can see each student's curiosity breadth score and identify students who have been inactive recently via engagement alerts
**Plans**: TBD
**UI hint**: yes

### Phase 6: Demo & Deployment
**Goal**: Anyone can deploy MindMap with a single Docker Compose command or to Vercel + Neon, student data never leaves the deployer's server, and the demo seed data produces a live 5-minute showcase of misconception detection, graph growth, and teacher dashboard analytics
**Depends on**: Phase 5
**Requirements**: INFR-01, INFR-02, INFR-05, PRIV-01, PRIV-03, DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` on a clean machine starts the full application with seeded data and no manual configuration beyond env vars
  2. Deploying to Vercel + Neon succeeds and the application is fully functional at the deployed URL
  3. Seed data scripts produce a 30-day and 60-day student session and a 20+ student class that populates every teacher dashboard view meaningfully
  4. The knowledge graph and all UI elements pass WCAG AA color contrast checks and render correctly on a 375px-wide mobile viewport
  5. When the LLM API is unavailable, the application shows a graceful error state rather than crashing, and normal LLM calls never transmit student PII in prompts
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-04-08 |
| 2. Curiosity Engine | 4/4 | Complete   | 2026-04-08 |
| 3. Knowledge Graph | 0/? | Not started | - |
| 4. Misconception Diagnostics | 0/? | Not started | - |
| 5. Teacher Dashboard | 0/? | Not started | - |
| 6. Demo & Deployment | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| AUTH-01 | Phase 1 |
| AUTH-02 | Phase 1 |
| AUTH-03 | Phase 1 |
| AUTH-04 | Phase 1 |
| AUTH-05 | Phase 1 |
| AUTH-06 | Phase 1 |
| AUTH-07 | Phase 1 |
| AUTH-08 | Phase 1 |
| MISC-01 | Phase 1 |
| MISC-02 | Phase 1 |
| MISC-03 | Phase 1 |
| INFR-06 | Phase 1 |
| PRIV-02 | Phase 1 |
| CURI-01 | Phase 2 |
| CURI-02 | Phase 2 |
| CURI-03 | Phase 2 |
| CURI-04 | Phase 2 |
| CURI-05 | Phase 2 |
| CURI-06 | Phase 2 |
| CURI-07 | Phase 2 |
| MISC-04 | Phase 2 |
| MISC-05 | Phase 2 |
| INFR-03 | Phase 2 |
| INFR-04 | Phase 2 |
| PRIV-01 | Phase 2 |
| GRPH-01 | Phase 3 |
| GRPH-02 | Phase 3 |
| GRPH-03 | Phase 3 |
| GRPH-04 | Phase 3 |
| GRPH-05 | Phase 3 |
| GRPH-06 | Phase 3 |
| GRPH-07 | Phase 3 |
| GRPH-08 | Phase 3 |
| MISC-06 | Phase 4 |
| MISC-07 | Phase 4 |
| MISC-08 | Phase 4 |
| MISC-09 | Phase 4 |
| MISC-10 | Phase 4 |
| DASH-01 | Phase 5 |
| DASH-02 | Phase 5 |
| DASH-03 | Phase 5 |
| DASH-04 | Phase 5 |
| DASH-05 | Phase 5 |
| DASH-06 | Phase 5 |
| INFR-01 | Phase 6 |
| INFR-02 | Phase 6 |
| INFR-05 | Phase 6 |
| PRIV-03 | Phase 6 |
| DEMO-01 | Phase 6 |
| DEMO-02 | Phase 6 |
| DEMO-03 | Phase 6 |
| DEMO-04 | Phase 6 |
| DEMO-05 | Phase 6 |
| DEMO-06 | Phase 6 |

**Total: 49/49 requirements mapped**

---
*Roadmap created: 2026-04-08*
