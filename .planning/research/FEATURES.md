# Feature Research

**Domain:** AI-powered K-12 educational knowledge graph / misconception diagnostic tool
**Researched:** 2026-04-08
**Confidence:** MEDIUM-HIGH (table stakes from strong ecosystem evidence; differentiators from product-specific research)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or the deployment won't pass institutional review.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Student authentication with role separation (student vs teacher) | Multi-user tools always have roles; teachers need different views than students | MEDIUM | Email/password sufficient for v1; OAuth deferred per PROJECT.md |
| Class management (create, join, roster) | Teachers cannot use a tool that has no concept of their class | MEDIUM | Teachers create class codes; students join; basic CRUD |
| Persistent student session (question history, graph state) | Students expect prior work to survive logout | MEDIUM | PostgreSQL rows keyed to user — not session storage |
| Age-appropriate AI content filtering / guardrails | Required for K-12 deployment; COPPA/FERPA exposure without it | HIGH | Prompt-level constraints on LLM output; no adult content; no PII leakage |
| Data privacy: no third-party data sharing, on-prem option | FERPA/COPPA compliance; schools will not adopt without it | HIGH | MindMap's self-host Docker story directly addresses this; Vercel demo must not retain student PII |
| Responsive design (tablet/phone usable) | Students don't always have desktops; teachers use tablets | MEDIUM | Next.js + Tailwind handles this; no native app needed |
| Readable AI answer output (formatted, grade-appropriate) | Students won't re-read a wall of text | MEDIUM | Markdown rendering, grade-band prompt tuning |
| Teacher visibility into student activity | Teachers won't adopt a tool they're blind to | MEDIUM | At minimum: last active, questions asked, graph size |
| Concept persistence across sessions | The knowledge graph only has value if it accumulates over time | LOW | Core data model requirement — not optional |
| Error handling and graceful LLM failure states | LLM APIs fail; showing a blank screen is unacceptable in a classroom | MEDIUM | Retry logic, user-facing error messages, fallback copy |
| Accessible color/contrast (WCAG AA) | K-12 deployments have IEP/accessibility obligations | MEDIUM | Affects graph node colors, dashboard palette; bake in early |

### Differentiators (Competitive Advantage)

Features that set MindMap apart. Not required by convention, but the source of competitive moat and the reason it gets demoed.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Personal knowledge graph (D3.js force-directed, grows with student) | No competitor visualizes a student's accumulated curiosity as a living network | HIGH | Core differentiator; D3 force simulation with enter/update/exit state management |
| Node health states (healthy / misconception / unprobed / bridge) | Makes latent misconceptions spatially visible; teachers and students see the shape of understanding | HIGH | Requires misconception classification pipeline to feed state transitions |
| Routing engine: enrich mode vs. diagnose mode | System auto-switches based on concept + grade band — no manual teacher trigger needed | HIGH | Hardest algorithmic piece; pgvector similarity + misconception library lookup |
| Research-backed misconception library (YAML, 35+ entries, CI-validated) | Anchors the system in peer-reviewed science (Chi, Vosniadou); not pattern-matched hallucination | HIGH | YAML + Git = low-friction community contribution; this is the moat that deepens over time |
| Socratic diagnostic flow (probe → classify → confront → resolve) | Doesn't just flag wrong answers — actively repairs the mental model through dialogue | HIGH | Four-phase structured prompting; must not collapse into free-form chat |
| Cognitive conflict generation | Confronts the student with a counterexample tailored to their specific misconception type | HIGH | Depends on misconception classification having succeeded first |
| Class-wide misconception heatmap | Shows teachers which concepts are broken across the entire class at a glance — no grading required | HIGH | Aggregates node health across students; visual diff from green to red per concept |
| Curiosity-driven daily question model (one question/day) | Constrains the interaction to something sustainable; prevents the tool from becoming another homework tool | LOW | The "one question" limit is product design, not just a UI choice — it signals what MindMap values |
| Concept deduplication via pgvector semantic similarity | "Gravity in space" and "gravity in baking" don't collide; the graph stays coherent as it grows | HIGH | Core hard problem; pgvector cosine similarity + LLM disambiguation pass |
| Standards alignment via optional YAML config (NGSS/CCSS) | Lets teachers connect curiosity questions to curriculum without forcing it | MEDIUM | YAML tag layer; optional display in teacher dashboard |
| Demo seed data (30-day and 60-day student sessions) | Allows live demo of a mature graph and multi-student heatmap without real users | MEDIUM | Seed scripts; reproducible fixture data |
| Pluggable LLM adapter (Anthropic first, OpenAI/Ollama) | Self-hosters can use local models; no vendor lock-in | MEDIUM | Interface/adapter pattern established at build time |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems — either scope creep, pedagogical harm, or complexity disproportionate to value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time chat / continuous conversation | "Students want to keep talking to the AI" | Destroys the daily-question model's pedagogical intent; turns MindMap into ChatGPT with a graph attached; high infra complexity (WebSockets, session management) | The Socratic diagnostic flow IS a structured dialogue — it just has defined entry/exit conditions |
| Leaderboards and point systems | "Engagement!" | Research shows extrinsic rewards undermine intrinsic curiosity — the exact thing MindMap is trying to cultivate (Deci & Ryan; Hidi & Renninger); students chase points, not understanding | Question streaks (days-in-a-row) are sufficient — they reinforce habit without ranking students against each other |
| Badges and achievement walls | Gamification feels modern | Same problem as leaderboards; creates performance orientation vs. mastery orientation; badges have no pedagogical content | Let the knowledge graph itself be the "achievement" — a visually rich, growing map of a student's mind |
| AI-generated quiz / flashcard auto-creation | "We could auto-generate study materials" | Scope explosion; Quizlet already does this better; dilutes the product identity; students associate it with test prep, not curiosity | Stay in the misconception-repair lane; link out to external tools if needed |
| Video answers / multimedia content generation | "Rich media would help visual learners" | Storage costs, bandwidth, content moderation complexity; LLMs don't generate video; would require third-party services that create data-sharing concerns | Well-formatted markdown answers with structured sections (analogy, example, why-it-matters) are sufficient |
| Parent portal / parent-facing dashboard | "Parents want visibility" | Separate auth persona, different privacy consent flows, COPPA complications for under-13, different UI entirely; doubles the dashboard surface area | Teachers mediate the parent relationship; teacher dashboard exports suffice |
| Peer comparison ("you understand 20% more than your class") | Feels motivating | Humiliates low-performing students; creates anxiety; violates student privacy if not implemented carefully (FERPA) | Teacher heatmap shows class patterns to the teacher — students see only their own graph |
| Native iOS/Android app | "Mobile is the future" | Web is already mobile-responsive; native app requires App Store review, separate update cycle, separate codebase, and MDM profile for school deployment | PWA-ready responsive web; Next.js serves mobile well |
| OAuth (Google, GitHub) login | Reduces friction | Google login sends data to Google; schools with Google Workspace restrictions can't use it; adds OAuth provider dependency | Email/password is universal, works in all district configurations |
| Multi-language misconception library (v1) | Global reach | Misconception research is largely English-language; translating scientific misconceptions requires domain experts per language, not just translation; risks incorrect content | i18n structure in place for community to add languages post-launch; English first |
| LMS deep integration (Canvas, Blackboard grade passback) | "Schools want it in their LMS" | LTI integration is a significant compliance and certification effort; grade passback changes what MindMap is (a curiosity tool → a graded tool); undermines the product philosophy | LMS-agnostic link-in is sufficient; teacher dashboard is the reporting layer |

---

## Feature Dependencies

```
[User Auth]
    └──required by──> [Student Sessions]
    └──required by──> [Teacher Dashboard]
    └──required by──> [Class Management]

[Class Management]
    └──required by──> [Teacher Dashboard]
    └──required by──> [Misconception Heatmap]

[Daily Curiosity Question Interface]
    └──requires──> [User Auth]
    └──requires──> [LLM Adapter Layer]
    └──feeds──> [Concept Extraction Pipeline]

[Concept Extraction Pipeline]
    └──requires──> [LLM Adapter Layer]
    └──feeds──> [Concept Deduplication (pgvector)]
                    └──feeds──> [Knowledge Graph (nodes + edges)]

[Knowledge Graph]
    └──feeds──> [D3.js Force-Directed Visualization]
    └──feeds──> [Node Health State Machine]

[Misconception Library (YAML)]
    └──required by──> [Routing Engine]
    └──required by──> [Misconception Classification]
    └──required by──> [Cognitive Conflict Generation]

[Routing Engine]
    └──requires──> [Concept Extraction Pipeline]
    └──requires──> [Misconception Library]
    └──produces──> [Enrich Mode] or [Diagnose Mode]

[Diagnose Mode]
    └──requires──> [Routing Engine]
    └──executes──> [Socratic Diagnostic Flow (probe/classify/confront/resolve)]
                    └──requires──> [Misconception Classification]
                    └──requires──> [Cognitive Conflict Generation]
                    └──writes to──> [Node Health State Machine]

[Node Health State Machine]
    └──feeds──> [D3.js Visualization (node colors/states)]
    └──feeds──> [Teacher Dashboard]
    └──feeds──> [Misconception Heatmap]

[Standards Alignment YAML] ──enhances──> [Teacher Dashboard] (optional layer)
[Demo Seed Data] ──required for──> [Live Demo]
```

### Dependency Notes

- **Concept Deduplication requires pgvector**: The entire graph coherence story depends on semantic similarity matching; it must be operational before the graph is meaningfully queryable.
- **Routing Engine requires both Misconception Library AND Concept Extraction**: Neither is sufficient alone — the router needs a concept identity AND a library entry to decide enrich vs. diagnose.
- **Socratic Diagnostic Flow requires Misconception Classification to succeed**: If classification fails (no library match), the diagnostic must fall back to enrich mode gracefully, not crash.
- **Teacher Heatmap requires multiple students in a class**: It will look empty in single-student demo; seed data must include class-level data.
- **Node Health State Machine conflicts with static graph rendering**: Cannot use a static layout if nodes need to change color/state reactively; D3's enter/update/exit pattern must handle state transitions from the start.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed for a compelling 5-minute demo and first real classroom use.

- [ ] Student auth + teacher auth with class join — without this, nothing else works in a multi-user context
- [ ] Daily curiosity question interface — the top-of-funnel interaction that defines the product
- [ ] AI answer with concept extraction — the LLM pipeline that turns a question into graph data
- [ ] Concept deduplication (pgvector) — required for graph coherence; skip this and the graph becomes noise
- [ ] Knowledge graph visualization (D3.js force-directed) — the demo-able artifact; the visual payoff
- [ ] Node health states (healthy / misconception / unprobed / bridge) — without states, the graph is just a map, not a diagnostic tool
- [ ] Misconception library (YAML, 35+ entries, 4 domains) — the knowledge base that makes diagnosis possible
- [ ] Routing engine (enrich vs. diagnose mode) — the decision point that activates the product's core value
- [ ] Socratic diagnostic flow (4 phases) — the misconception repair loop; the core pedagogical differentiator
- [ ] Teacher dashboard with heatmap — closes the teacher loop; without it, teachers have no reason to recommend MindMap
- [ ] Demo seed data (30-day + 60-day sessions) — required to demo a mature graph and populated heatmap without real users
- [ ] Docker Compose deployment — the self-host promise; required for the open-source story

### Add After Validation (v1.x)

Features to add once core is working and initial feedback is in.

- [ ] Standards alignment tags (NGSS/CCSS) — add when teachers ask "how does this map to my curriculum?"; low complexity once YAML structure is in
- [ ] OpenAI / Ollama LLM adapters — add when self-hosters request it; adapter pattern already in place
- [ ] Engagement metrics (streak tracking, question frequency) — add when retention data shows drop-off patterns
- [ ] Graph export (PNG/JSON) — add when users ask to share or embed their graphs
- [ ] Community misconception library contributions (PR workflow) — add when early users identify gaps in covered domains

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] International misconception library translations — defer; requires domain experts per language, not just translators
- [ ] LMS integration (LTI, grade passback) — defer; changes the product's identity and requires significant compliance work
- [ ] API for third-party tools — defer; premature until usage patterns are established
- [ ] Student-generated misconception reports — defer; pedagogically interesting but adds moderation complexity
- [ ] Advanced graph analytics (centrality, bridge detection) — defer; technically interesting but users need basic graph value first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Daily curiosity question + AI answer | HIGH | MEDIUM | P1 |
| Concept extraction pipeline | HIGH | MEDIUM | P1 |
| pgvector concept deduplication | HIGH | HIGH | P1 |
| Knowledge graph D3.js visualization | HIGH | HIGH | P1 |
| Node health state machine | HIGH | MEDIUM | P1 |
| Misconception library (YAML) | HIGH | MEDIUM | P1 |
| Routing engine (enrich/diagnose) | HIGH | HIGH | P1 |
| Socratic diagnostic flow (4 phases) | HIGH | HIGH | P1 |
| Teacher dashboard + heatmap | HIGH | HIGH | P1 |
| Student + teacher auth | HIGH | MEDIUM | P1 |
| Class management | MEDIUM | LOW | P1 |
| Demo seed data | HIGH (for demo) | MEDIUM | P1 |
| Docker Compose deployment | MEDIUM | MEDIUM | P1 |
| Standards alignment (NGSS/CCSS) | MEDIUM | LOW | P2 |
| OpenAI/Ollama LLM adapters | MEDIUM | LOW | P2 |
| Streak tracking | LOW | LOW | P2 |
| Graph export | LOW | LOW | P2 |
| Community misconception contributions | MEDIUM | LOW | P2 |
| LMS integration | MEDIUM | HIGH | P3 |
| Parent portal | LOW | HIGH | P3 |
| Native mobile app | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch / demo
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Khanmigo (Khan Academy) | Packback | Socratic (Google) | MindMap Approach |
|---------|------------------------|----------|-------------------|-----------------|
| Curiosity / question-driven | No — exercises-first | Yes — inquiry discussion | Yes — homework questions | Yes — daily question as the core interaction |
| Misconception detection | Yes — identifies common ones | No | No | Yes — structured library + Socratic repair, not just flagging |
| Socratic dialogue | Yes — core pedagogy | No | No | Yes — structured 4-phase flow, not free chat |
| Visual knowledge graph | No | No | No | Yes — primary product artifact |
| Node health / concept states | No | No | No | Yes — differentiator unique to MindMap |
| Teacher heatmap | Limited class view | Participation metrics | No | Yes — misconception-specific, not just engagement |
| Self-host / data privacy | No — SaaS only | No — SaaS only | No — Google cloud | Yes — Docker Compose; data stays on deployer's server |
| Open source | No | No | No | Yes — MIT; misconception library community-extensible |
| LMS integration | Canvas (partial) | Canvas, Blackboard, D2L | No | Out of scope v1 |
| Gamification | Badges, energy points | Curiosity score | No | Deliberate restraint; streaks only |

---

## Sources

- [Knowledge Graph-Powered AI Tools Reflect Learning Science (Chan Zuckerberg Initiative)](https://chanzuckerberg.com/blog/knowledge-graph-ai-education/)
- [SocratiQ: A Generative AI-Powered Learning Companion](https://arxiv.org/html/2502.00341v1)
- [AI Oral Assessment Tool Uses Socratic Method (Georgia Tech)](https://research.gatech.edu/ai-oral-assessment-tool-uses-socratic-method-test-students-knowledge)
- [Generative AI in Education: Socratic Playground for Learning](https://arxiv.org/html/2501.06682v1)
- [Khanmigo Features 2025](https://blog.khanacademy.org/need-to-know-bts-2025/)
- [A Decade Into Gamification, EdTech Rethinks Motivation (EdSurge)](https://www.edsurge.com/news/2023-05-09-a-decade-into-experiments-with-gamification-edtech-rethinks-how-to-motivate-learners)
- [Gamification Has Ruined Education Technology (Mission.io)](https://mission.io/blog/gamification-has-ruined-education-technology)
- [FERPA, COPPA, and Beyond — Bridging the EdTech Compliance Gap](https://aigovernancegroup.com/blog/bridging-edtech-education-compliance-gap)
- [EdTech Service Provider's Guide to Student Privacy (2025)](https://studentprivacycompass.org/wp-content/uploads/2025/09/2025-EdTech-Guide.pdf)
- [CADA: Teacher-Facing Learning Analytics Dashboard (PMC)](https://pmc.ncbi.nlm.wiley.gov/articles/PMC8982662/)
- [Progressive Disclosure in Complex Visualization Interfaces](https://dev3lop.com/progressive-disclosure-in-complex-visualization-interfaces/)
- [Guide to Creating Knowledge Graph Visualizations (yFiles)](https://www.yfiles.com/resources/how-to/guide-to-visualizing-knowledge-graphs)
- [EdTech Trends 2025–2030: The 2026 Tipping Point](https://emerline.com/blog/edtech-trends)
- [Conceptual Change Theory Overview (ScienceDirect)](https://www.sciencedirect.com/topics/psychology/conceptual-change-theory)
- [ACE: AI-Assisted Construction of Educational Knowledge Graphs](https://jedm.educationaldatamining.org/index.php/JEDM/article/view/737)

---
*Feature research for: AI-powered K-12 educational knowledge graph / misconception diagnostic (MindMap)*
*Researched: 2026-04-08*
