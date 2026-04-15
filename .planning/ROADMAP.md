# Roadmap: MindMap

## Milestones

- **v1.0 Initial Release** - Phases 1-8 (shipped 2026-04-13)
- **v1.1 Value Experience** - Phases 9-11 (in progress)

---

<details>
<summary>v1.0 Initial Release (Phases 1-8) - SHIPPED</summary>

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
**Plans**: 4 plans
Plans:
- [x] 03-01-PLAN.md — Schema migration (vector column, concept_edges table, HNSW index) + embedding infrastructure
- [x] 03-02-PLAN.md — Two-stage dedup pipeline (pgvector ANN + LLM disambiguation) + edge creation in onFinish
- [x] 03-03-PLAN.md — D3.js force-directed graph page, node detail side panel, health legend, sidebar link
- [x] 03-04-PLAN.md — Bridge node detection (betweenness centrality) + weekly surprise connection toast

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
**Plans**: 2 plans
Plans:
- [x] 04-01-PLAN.md — Diagnostic sessions schema, LLM prompt builders, /api/ask diagnose branch, server actions
- [x] 04-02-PLAN.md — Multi-turn /api/diagnose route, diagnostic chat UI, misconception reveal, student page integration

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
**Plans**: 3 plans
Plans:
- [x] 05-01-PLAN.md — Dashboard server actions, TypeScript types, and mini graph SVG component
- [x] 05-02-PLAN.md — Dashboard page, tab navigation, Overview tab, Students tab, sidebar updates
- [x] 05-03-PLAN.md — Concepts heatmap tab and Misconceptions cluster tab with repair progress

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
**Plans**: 4 plans
Plans:
- [x] 06-01-PLAN.md — Seed data scripts (30-day, 60-day students + 20-student class)
- [x] 06-02-PLAN.md — Docker Compose full-stack + Vercel deployment config + telemetry audit
- [x] 06-03-PLAN.md — COPPA TTL cleanup endpoint + PRIV-01 audit
- [x] 06-04-PLAN.md — WCAG AA color fixes + responsive design + graceful LLM error handling

### Phase 7: 3D Solar System Knowledge Graph
**Goal**: Replace the existing 2D D3.js SVG knowledge graph with an immersive 3D WebGL solar system visualization using react-three-fiber, where concept nodes appear as glowing stars in space with constellation-style edges, OrbitControls navigation, and all existing graph functionality preserved
**Requirements**: Enhancement phase — tracked via CONTEXT.md decisions (D-01 through D-16)
**Depends on**: Phase 6
**Plans**: 3 plans
Plans:
- [x] 07-01-PLAN.md — Install 3D packages, d3-force-3d layout hook, InstancedMesh nodes, Line edges
- [x] 07-02-PLAN.md — SolarScene + SolarGraph Canvas wrapper + SSR-safe KnowledgeGraph replacement
- [x] 07-03-PLAN.md — LOD rendering, bridge highlight integration, visual verification

### Phase 8: Root-Cause Theme Diagnosis & Teacher Remediation
**Goal**: When a teacher opens their class dashboard, they can move from "here are the misconceptions my students hold" to "here is the underlying naive theory driving them" to "here is a structured lesson plan I can run tomorrow"
**Requirements**: THME-01, THME-02, THME-03, DASH-07, DASH-08, LSPL-01, LSPL-02
**Depends on**: Phase 7
**Plans**: 4 plans
Plans:
- [x] 08-01-PLAN.md — Theme taxonomy authoring (themes.yaml + schema/loader extension + library backfill + CI orphan check)
- [x] 08-02-PLAN.md — Dashboard aggregation by theme (getClassDashboardData themeClusters + getThemeDetail + getStudentThemeProfile)
- [x] 08-03-PLAN.md — LLM prompt builders (analyze-student-themes + generate-lesson-plan with PRIV-01 audit)
- [x] 08-04-PLAN.md — Teacher UI + theme_lesson_plans cache table + getOrGenerateLessonPlan + ThemesView/LessonPlanCard/StudentNarrativeDialog

</details>

---

## v1.1 Value Experience

**Milestone Goal:** Make the core learning experience emotionally resonant -- the graph is the reward, connections feel surprising, and teachers get actionable next steps.

## Phases

- [ ] **Phase 9: Graph Animation** - Animate graph growth after asking a question so the visual expansion is the reward
- [ ] **Phase 10: Bridge Discovery** - Surface surprising cross-domain connections with cinematic reveal and persistent insight cards
- [ ] **Phase 11: Teacher Action Loop** - Close the loop from misconception cluster to classroom intervention to measurable impact

---

## Phase Details

### Phase 9: Graph Animation
**Goal**: After a student submits a curiosity question and receives an answer, they are automatically transitioned to their knowledge graph where new concepts animate into existence -- scaling up, drawing edges, and framing the camera -- making graph growth the emotional reward for asking
**Depends on**: Phase 8
**Requirements**: GANIM-01, GANIM-02, GANIM-03, GANIM-04, GANIM-05, GANIM-06, GANIM-07
**Success Criteria** (what must be TRUE):
  1. After the AI answer finishes streaming, the student is automatically transitioned to the graph view and new concept nodes animate in with a visible scale-up stagger (not instant appearance)
  2. New edges draw progressively from source to target after nodes have settled, and the camera auto-frames to include all new content
  3. New nodes spawn with a particle birth effect (sparkles) that transitions into their final health-state appearance
  4. A growth summary overlay appears after animation completes showing how many concepts and connections were added (e.g., "+3 concepts, +2 connections")
  5. When the user has `prefers-reduced-motion` enabled, all new content appears instantly with no animation or motion effects (WCAG 2.1 compliance)
**Plans**: TBD
**UI hint**: yes

### Phase 10: Bridge Discovery
**Goal**: When a bridge concept is detected connecting two different knowledge domains, the student experiences a cinematic reveal -- the camera pulls back, highlights the connecting path, flies to the bridge node, and displays a persistent AI-generated insight card explaining why the connection matters
**Depends on**: Phase 9
**Requirements**: BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05
**Success Criteria** (what must be TRUE):
  1. Bridge concepts display a persistent visual highlight on the graph (distinct from the transient toast used in v1.0) that remains visible during normal graph exploration
  2. When a new bridge is discovered, a camera fly-to choreography plays: pull back to show both domains, highlight the connecting path with glowing edges, then fly to the bridge node
  3. A persistent insight card appears showing an AI-generated explanation of why the bridge connection matters, and the card stays visible until the student explicitly dismisses it
  4. The bridge explanation is generated once by the LLM and cached -- subsequent views load the cached text without an additional LLM call
**Plans**: TBD
**UI hint**: yes

### Phase 11: Teacher Action Loop
**Goal**: A teacher can move from seeing a misconception cluster on their dashboard to marking a classroom intervention as done, which triggers automatic re-probing of affected students, and then see before/after resolution rates showing whether the intervention worked
**Depends on**: Phase 8
**Requirements**: TLOOP-01, TLOOP-02, TLOOP-03, TLOOP-04
**Success Criteria** (what must be TRUE):
  1. Teacher can mark a lesson plan activity as "done" with a single click from the dashboard, and the UI updates immediately to reflect the completed status
  2. When a teacher marks an activity done, re-probe diagnostic sessions are automatically created for all students who still hold the targeted misconception
  3. The dashboard displays before/after misconception resolution rates for completed interventions, showing the percentage of students who resolved the misconception after the teacher's intervention
  4. The routing engine biases toward diagnose mode for students whose teacher has completed a relevant intervention, increasing the likelihood that affected students are re-probed on their next question
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-04-08 |
| 2. Curiosity Engine | v1.0 | 4/4 | Complete | 2026-04-08 |
| 3. Knowledge Graph | v1.0 | 4/4 | Complete | 2026-04-08 |
| 4. Misconception Diagnostics | v1.0 | 2/2 | Complete | 2026-04-08 |
| 5. Teacher Dashboard | v1.0 | 3/3 | Complete | 2026-04-08 |
| 6. Demo & Deployment | v1.0 | 4/4 | Complete | 2026-04-08 |
| 7. 3D Solar System | v1.0 | 3/3 | Complete | 2026-04-10 |
| 8. Theme Diagnosis | v1.0 | 4/4 | Complete | 2026-04-13 |
| 9. Graph Animation | v1.1 | 0/? | Not started | - |
| 10. Bridge Discovery | v1.1 | 0/? | Not started | - |
| 11. Teacher Action Loop | v1.1 | 0/? | Not started | - |

---

## Coverage Map

<details>
<summary>v1.0 Coverage (49/49 mapped)</summary>

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

</details>

### v1.1 Coverage (16/16 mapped)

| Requirement | Phase |
|-------------|-------|
| GANIM-01 | Phase 9 |
| GANIM-02 | Phase 9 |
| GANIM-03 | Phase 9 |
| GANIM-04 | Phase 9 |
| GANIM-05 | Phase 9 |
| GANIM-06 | Phase 9 |
| GANIM-07 | Phase 9 |
| BRIDGE-01 | Phase 10 |
| BRIDGE-02 | Phase 10 |
| BRIDGE-03 | Phase 10 |
| BRIDGE-04 | Phase 10 |
| BRIDGE-05 | Phase 10 |
| TLOOP-01 | Phase 11 |
| TLOOP-02 | Phase 11 |
| TLOOP-03 | Phase 11 |
| TLOOP-04 | Phase 11 |

**Total: 16/16 v1.1 requirements mapped**

---
*Roadmap created: 2026-04-08*
*v1.1 phases added: 2026-04-14*
