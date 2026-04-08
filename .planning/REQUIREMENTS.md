# Requirements: MindMap

**Defined:** 2026-04-08
**Core Value:** Show what students actually believe, why they believe it, and how it connects to everything else they think they know.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Users

- [ ] **AUTH-01**: Student can sign up with email and password
- [ ] **AUTH-02**: Teacher can sign up with email and password with teacher role
- [ ] **AUTH-03**: User can log in and stay logged in across browser refresh
- [ ] **AUTH-04**: User can log out from any page
- [x] **AUTH-05**: Teacher can create a class and receive a join code
- [x] **AUTH-06**: Student can join a class using a join code
- [x] **AUTH-07**: Teacher can view and manage class roster
- [x] **AUTH-08**: Student profile includes grade level (set by teacher or self-reported)

### Curiosity Engine

- [x] **CURI-01**: Student can submit one curiosity question per day via text input
- [x] **CURI-02**: AI responds with a rich, age-appropriate answer based on student grade level
- [x] **CURI-03**: AI asks one Socratic follow-up question after each answer to deepen engagement
- [x] **CURI-04**: Student can view their full question history with timestamps
- [x] **CURI-05**: Daily streak tracking visible to the student (days-in-a-row)
- [x] **CURI-06**: AI extracts underlying concepts from each question/answer exchange
- [x] **CURI-07**: Extracted concepts are added as nodes to the student's knowledge graph

### Knowledge Graph

- [x] **GRPH-01**: Concepts are stored as nodes with embedding vectors in PostgreSQL + pgvector
- [ ] **GRPH-02**: New concepts are deduplicated via two-stage process: pgvector ANN similarity search + LLM disambiguation for ambiguous matches
- [ ] **GRPH-03**: Concept edges are created between related concepts (curiosity link, bridge, misconception cluster)
- [x] **GRPH-04**: Force-directed D3.js graph visualization renders the student's personal knowledge graph
- [x] **GRPH-05**: Node size scales with number of visits to that concept
- [x] **GRPH-06**: Node color encodes health state: teal (healthy), coral (misconception), gray (unprobed), purple (bridge)
- [x] **GRPH-07**: Student can click any node to see the original questions and AI exchanges that created it
- [ ] **GRPH-08**: Weekly "surprise connection" notification surfaces a cross-subject bridge the student may not have noticed

### Misconception System

- [ ] **MISC-01**: YAML misconception library with 35+ entries across 4 domains (physics, biology, math, history/social studies)
- [ ] **MISC-02**: Each library entry includes: id, name, domain, grade_band, description, citation, probe_questions, confrontation scenarios
- [ ] **MISC-03**: Misconception library is validated via CI (schema validation on entries)
- [x] **MISC-04**: Routing engine determines enrich vs. diagnose mode based on extracted concept + grade band + misconception library lookup
- [x] **MISC-05**: Enrich mode: AI gives rich answer, asks Socratic follow-up, adds concept as unprobed node
- [ ] **MISC-06**: Diagnose mode: AI opens with open-ended probe ("Tell me what you think happens when...")
- [ ] **MISC-07**: Diagnose mode: AI classifies student's mental model against misconception library
- [ ] **MISC-08**: Diagnose mode: AI generates targeted confrontation scenario to create cognitive conflict
- [ ] **MISC-09**: Diagnose mode: AI resolves session — node turns from coral to teal after successful repair, stays coral if unresolved
- [ ] **MISC-10**: Student can see the named misconception they held after a diagnostic session

### Teacher Dashboard

- [ ] **DASH-01**: Teacher can view individual student graph thumbnails for each student in their class
- [ ] **DASH-02**: Teacher can view class-wide concept heatmap showing which topics appear across many students
- [ ] **DASH-03**: Teacher can view misconception cluster view showing which misconceptions are widespread
- [ ] **DASH-04**: Teacher can track misconception repair progress (resolved vs. persistent across sessions)
- [ ] **DASH-05**: Teacher can view engagement metrics: streak data, recent inactivity alerts
- [ ] **DASH-06**: Teacher can view curiosity breadth score per student (ranging widely vs. clustering in one domain)

### Deployment & Infrastructure

- [ ] **INFR-01**: Application deploys via Docker Compose with a single command
- [ ] **INFR-02**: Application deploys to Vercel + Neon for cloud hosting
- [x] **INFR-03**: LLM layer uses Anthropic Claude API as primary provider via Vercel AI SDK
- [x] **INFR-04**: LLM adapter pattern supports swapping providers via environment variable
- [ ] **INFR-05**: No telemetry or third-party data sharing — all student data stays on deployer's server
- [x] **INFR-06**: Data model includes COPPA-compliant TTL fields for student data retention

### Data Privacy & Compliance

- [x] **PRIV-01**: No student PII is sent to LLM providers in prompts (anonymized context only)
- [x] **PRIV-02**: Student data is scoped to the deploying instance — no cross-instance data sharing
- [ ] **PRIV-03**: Data retention TTL fields enforce automatic cleanup of expired student data

### Demo & Polish

- [ ] **DEMO-01**: Demo seed data scripts generate a realistic 30-day student session with populated knowledge graph
- [ ] **DEMO-02**: Demo seed data scripts generate a 60-day student session showing graph maturity over time
- [ ] **DEMO-03**: Demo seed data includes a class of 20+ students for teacher dashboard demonstration
- [ ] **DEMO-04**: Accessible color palette meeting WCAG AA contrast requirements for all node health states
- [ ] **DEMO-05**: Responsive design works on tablet and mobile browsers
- [ ] **DEMO-06**: Graceful error handling when LLM API is unavailable or slow

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### LLM Adapters

- **ADPT-01**: OpenAI GPT adapter via Vercel AI SDK
- **ADPT-02**: Ollama local model adapter for offline/self-hosted deployment without API keys

### Standards Alignment

- **STND-01**: Concepts can be tagged to NGSS, CCSS, or custom standards via YAML config
- **STND-02**: Teacher dashboard shows which standards have been touched organically through student curiosity

### Export & Sharing

- **EXPT-01**: Student can export their knowledge graph as PNG image
- **EXPT-02**: Student can export their knowledge graph data as JSON

### Community

- **COMM-01**: Misconception library accepts community contributions via documented PR workflow
- **COMM-02**: UI strings externalized for community localization

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time chat / continuous conversation | Destroys the daily-question model's pedagogical intent; turns MindMap into ChatGPT with a graph |
| Leaderboards and point systems | Research shows extrinsic rewards undermine intrinsic curiosity (Deci & Ryan) |
| Badges and achievement walls | Creates performance orientation vs. mastery orientation; no pedagogical content |
| AI-generated quizzes / flashcards | Scope explosion; Quizlet does this better; dilutes product identity |
| Video / multimedia content generation | Storage costs, content moderation complexity, third-party data-sharing concerns |
| Parent portal / dashboard | Separate auth persona, different privacy consent flows, doubles dashboard surface area |
| Peer comparison metrics | Humiliates low-performing students; violates student privacy (FERPA) |
| Native iOS/Android app | Web is already responsive; native requires App Store review and separate codebase |
| OAuth login (Google, GitHub) | Sends data to third parties; schools with Google Workspace restrictions can't use it |
| Multi-language misconception library (v1) | Requires domain experts per language; risks incorrect content; i18n structure in place for later |
| LMS integration (Canvas, Blackboard) | Significant compliance/certification effort; grade passback changes product philosophy |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| AUTH-08 | Phase 1 | Complete |
| MISC-01 | Phase 1 | Pending |
| MISC-02 | Phase 1 | Pending |
| MISC-03 | Phase 1 | Pending |
| INFR-06 | Phase 1 | Complete |
| PRIV-02 | Phase 1 | Complete |
| CURI-01 | Phase 2 | Complete |
| CURI-02 | Phase 2 | Complete |
| CURI-03 | Phase 2 | Complete |
| CURI-04 | Phase 2 | Complete |
| CURI-05 | Phase 2 | Complete |
| CURI-06 | Phase 2 | Complete |
| CURI-07 | Phase 2 | Complete |
| MISC-04 | Phase 2 | Complete |
| MISC-05 | Phase 2 | Complete |
| INFR-03 | Phase 2 | Complete |
| INFR-04 | Phase 2 | Complete |
| PRIV-01 | Phase 2 | Complete |
| GRPH-01 | Phase 3 | Complete |
| GRPH-02 | Phase 3 | Pending |
| GRPH-03 | Phase 3 | Pending |
| GRPH-04 | Phase 3 | Complete |
| GRPH-05 | Phase 3 | Complete |
| GRPH-06 | Phase 3 | Complete |
| GRPH-07 | Phase 3 | Complete |
| GRPH-08 | Phase 3 | Pending |
| MISC-06 | Phase 4 | Pending |
| MISC-07 | Phase 4 | Pending |
| MISC-08 | Phase 4 | Pending |
| MISC-09 | Phase 4 | Pending |
| MISC-10 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 5 | Pending |
| DASH-06 | Phase 5 | Pending |
| INFR-01 | Phase 6 | Pending |
| INFR-02 | Phase 6 | Pending |
| INFR-05 | Phase 6 | Pending |
| PRIV-03 | Phase 6 | Pending |
| DEMO-01 | Phase 6 | Pending |
| DEMO-02 | Phase 6 | Pending |
| DEMO-03 | Phase 6 | Pending |
| DEMO-04 | Phase 6 | Pending |
| DEMO-05 | Phase 6 | Pending |
| DEMO-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation — all 49 requirements mapped*
