# Pitfalls Research

**Domain:** AI-powered K-12 educational knowledge graph with misconception detection
**Researched:** 2026-04-08
**Confidence:** HIGH (COPPA/FERPA regulatory specifics), MEDIUM (technical implementation patterns), MEDIUM (LLM pedagogy patterns)

---

## Critical Pitfalls

### Pitfall 1: Concept Deduplication Threshold Miscalibration

**What goes wrong:**
A single cosine similarity threshold is chosen (e.g., 0.85) and applied uniformly across all concept comparisons. "Gravity (physics)" and "gravity (baking)" end up merged because their embeddings are similar enough. Conversely, "photosynthesis" asked by a 5th grader ("how do plants make food?") and a 10th grader ("light-dependent reactions") end up as separate nodes because phrasing diverges. The knowledge graph becomes either a mess of false duplicates or an explosion of orphaned near-duplicate nodes. Either failure mode destroys the graph's value.

**Why it happens:**
Developers test deduplication with clean, well-formed concept names during development. Real student questions are messy, domain-crossing, and grade-band-dependent. A single threshold value that works for a test corpus of 20 concepts silently fails at 200. The LLM disambiguation step (second-pass after pgvector shortlisting) gets skipped or under-prompt-engineered because it seems like gold-plating at the time.

**How to avoid:**
- Build a two-stage pipeline from day one: pgvector shortlist (broad threshold ~0.7–0.8 cosine similarity) then LLM disambiguation pass with domain-context-aware prompting
- Create a golden test set of 50+ concept pairs (true duplicates, true distincts, and ambiguous cross-domain cases) before writing deduplication code
- Test threshold values against the golden set; do not pick a threshold by intuition
- Include domain/subject field in concept records and pass it to the LLM disambiguation prompt: "Are 'gravity' in the context of [PHYSICS] and 'gravity' in the context of [COOKING] the same concept?"
- pgvector's `<=>` operator returns cosine *distance* (0 = identical, 2 = opposite) — verify you are not accidentally treating it as similarity (1 = identical). This is a confirmed production bug in the Supabase/pgvector ecosystem.

**Warning signs:**
- During testing, you see the same concept appearing twice on a student's graph
- Graph node count grows faster than expected relative to unique question count
- Teacher dashboard shows suspiciously diverse misconception clusters (deduplication collapsed unrelated concepts)
- Students see a "You already learned X" message but the X doesn't match their mental model

**Phase to address:** Concept extraction and deduplication pipeline phase (before or early in knowledge graph build phase)

---

### Pitfall 2: LLM Delivers Adult-Calibrated Socratic Probing to Young Children

**What goes wrong:**
The Socratic diagnostic prompts are written for a generic student. A 7-year-old is asked: "Can you articulate what you understand about the relationship between force and acceleration in Newtonian mechanics?" The student is confused, gives up, and the system logs a non-response as a misconception. Alternatively, a 10th-grader receives baby-talk probing that feels condescending; engagement collapses.

**Why it happens:**
Developers prototype with adult-level examples. Grade band is passed as a metadata field to the LLM but the system prompt doesn't structurally enforce age-appropriate vocabulary and question complexity. Research (documented in the ACL 2025 multi-agent Socratic teaching paper) shows that LLMs exhibit "asymmetric feedback" — they fail to adjust question difficulty based on implicit cognitive state signals from students.

**How to avoid:**
- Define 3–4 grade bands (K-2, 3-5, 6-8, 9-12) with explicit vocabulary constraints and reading level targets in the system prompt, not just as a passed variable
- Include concrete examples of acceptable and unacceptable probe phrasing for each grade band in the prompt (few-shot examples, not just instructions)
- Add a post-generation validation step: call the LLM again with a simple "Is this question appropriate for a [GRADE_BAND] student? Rate 1-5." — reject and regenerate anything below 4
- Test every prompt template with representative students from each grade band before shipping the diagnostic flow
- Never use technical jargon in probe questions without first checking whether the concept record's grade band includes that vocabulary

**Warning signs:**
- Student session transcripts show repeated "I don't know" or one-word answers in diagnostic mode (may indicate overload, not ignorance)
- Short diagnostic sessions with no resolved misconception — students are disengaging, not learning
- The "probe" question text contains words not in the Flesch-Kincaid grade level for the target band

**Phase to address:** Misconception diagnostic / Socratic dialogue phase; re-validated when misconception library is populated

---

### Pitfall 3: COPPA Violations from Incidental Data Collection or Retention

**What goes wrong:**
Student questions and dialogue are stored indefinitely in PostgreSQL. The LLM API is called with full conversation history as context. A third-party analytics SDK is added to the Next.js frontend to understand usage. Any of these creates a COPPA violation: the FTC's 2025 rule amendments (effective June 2025, full compliance April 2026) mandate strict data retention limits, prohibit third-party data sharing for targeted advertising, and require a published written data retention policy. Violations are now $51,744 per affected child.

**Why it happens:**
COPPA compliance is deferred as a "legal concern" until later. Developers think "school consent covers everything" — but the 2025 rule makes clear that school consent only covers educational purpose use; any incidental commercial use (even analytics) voids it. Open-source self-hosted tools often assume the deployer handles compliance, but the operator (you, for the Vercel demo instance) is also liable.

**How to avoid:**
- Build data retention limits into the schema from day one: add `created_at` and `delete_after` to all student data tables; run a scheduled job to purge expired records
- Write and publish the data retention policy before launching the demo deployment (it's a COPPA 2025 requirement, not just good practice)
- Zero third-party analytics SDKs — not Mixpanel, not Vercel Analytics in its default form, not Google Fonts loaded from CDN (which leaks IP addresses to Google). Self-host fonts.
- Route all LLM API calls through a server-side proxy that strips student PII before constructing context (student ID → session token; no names in prompts)
- Add a COPPA compliance section to the self-hosting README so deployers understand their obligations

**Warning signs:**
- Any third-party script tag in `_document.tsx` or `layout.tsx`
- Student records with no `delete_after` or `retention_policy` field
- Raw student names or email addresses appearing in LLM prompt logs
- Vercel deployment with default analytics enabled

**Phase to address:** Auth and data model phase (schema level); verified again before any public/demo deployment

---

### Pitfall 4: Knowledge Graph Visualization Freezes on Mobile at ~200 Nodes

**What goes wrong:**
D3.js force-directed graph using SVG works perfectly in development with 20–30 nodes. By week 8 of the demo (60-day session), a student has 200+ concept nodes. SVG performance degrades severely: every DOM mutation triggers reflow, the force simulation ticks cause jank, mobile browsers (especially iOS Safari) become unresponsive. The demo crashes at the worst possible moment.

**Why it happens:**
D3.js SVG is the natural default. The performance cliff is not visible during feature development — it only appears with realistic data volume. The force simulation runs every tick against all nodes (O(n²) naive repulsion), and SVG keeps every node as a live DOM element. Research confirms SVG handles ~1,000 nodes adequately on desktop but degrades sharply on mobile below that threshold.

**How to avoid:**
- Set SVG as the initial renderer but architect for a Canvas fallback: separate the data model from the render layer so swapping renderers doesn't require rewriting graph logic
- Freeze/pause the force simulation after it stabilizes (use `simulation.stop()` after alpha < 0.001) — do not let it run indefinitely
- Implement a node budget: cluster small related nodes below a "zoom threshold" (show the cluster, not individual nodes); expand on click
- Cap the default viewport at 150 visible nodes; add pagination or time-based filtering ("Show last 30 days")
- Test visualization with the 60-day seed data on a real mobile device before any demo

**Warning signs:**
- Force simulation never appears to fully settle (alpha threshold not set)
- Node count in seed data exceeds 150 but no clustering strategy is implemented
- No mobile performance test in the test plan
- SVG element count in the DOM exceeds 500 during a test session

**Phase to address:** Knowledge graph visualization phase; tested explicitly with maximum seed data volume

---

### Pitfall 5: Misconception Library Becomes a Bottleneck and Then Stagnates

**What goes wrong:**
The 35-entry misconception library is hand-curated before launch. The routing engine does a substring or exact-match lookup against this library to decide whether to enter diagnostic mode. Over time, the library isn't maintained; students encounter misconceptions not in the library, the system silently falls back to enrich mode, and teachers stop seeing diagnostic data. Alternatively, the YAML schema is underdocumented, community contributions are low-quality, and merging them manually becomes a maintenance burden.

**Why it happens:**
The library is treated as a static asset. No contribution pipeline is built. The routing engine logic isn't tested against edge cases (concept in library but grade-band mismatch; concept close but not matching; synonym not captured). CI validation is "I'll add it later."

**How to avoid:**
- Define the YAML schema strictly (JSON Schema validation in CI from phase 1, not after the library is populated)
- Build the routing engine to use pgvector similarity against library entries, not exact string match — this makes the library more robust to paraphrasing
- Add a "confidence" field to each library entry; low-confidence entries trigger enrich mode by default
- Create a `CONTRIBUTING.md` for the misconception library with explicit research citation requirements (e.g., "must cite Chi or equivalent peer-reviewed source")
- Add a GitHub Actions workflow that validates YAML syntax, checks required fields, and runs a semantic duplicate check against existing entries on every PR

**Warning signs:**
- Routing engine uses `indexOf` or `===` to check concept against library entries
- Library YAML has no schema validation in CI
- Library entries lack research citations (anyone can submit anything)
- No process for retiring or updating entries as educational research evolves

**Phase to address:** Misconception library and routing engine phase; CI validation before community contributions are opened

---

### Pitfall 6: Dual Deployment (Docker + Vercel) Creates Silent Behavior Differences

**What goes wrong:**
The application works on Vercel but not in Docker Compose. Or it works in Docker but fails silently on Vercel. Common failure modes: environment variables injected at build time on Vercel are not available at runtime in Docker; Next.js serverless function timeouts (10s default on Vercel hobby, 60s on pro) are insufficient for LLM + pgvector disambiguation pipeline; file system writes work in Docker but fail on Vercel (no persistent file system); Neon connection pooling required for serverless is not needed for Docker but misconfigured for one target.

**Why it happens:**
Vercel does not support Docker images — these are fundamentally different runtime architectures. Developers build on one target, assume parity, and discover differences during demo prep. The serverless vs. long-running process distinction is particularly sharp: a Vercel function that times out during a concept disambiguation chain silently fails with a 504 that looks like a network error.

**How to avoid:**
- Define deployment targets as explicit test environments: `pnpm dev:docker` and `pnpm dev:vercel` (using `vercel dev`) — test against both regularly, not just before demo
- Never write to the filesystem in application code; use the database for all persistence from day one
- Set all Next.js route timeouts explicitly: `export const maxDuration = 30` in every API route that calls the LLM, and design the pipeline to complete within that limit
- Use separate `.env.docker` and `.env.vercel` files (gitignored) and document every variable that differs between them
- Keep the pgvector disambiguation pipeline under 8 seconds end-to-end; if it exceeds this, return a "processing" state and poll — do not rely on a single long-running serverless request

**Warning signs:**
- Any `fs.writeFile` or `fs.readFile` in application code outside of build-time scripts
- LLM + disambiguation pipeline has no timeout handling
- API routes lack explicit `maxDuration` export
- "Works on my machine (Docker)" but 504 errors on Vercel during testing

**Phase to address:** Infrastructure and deployment phase; enforced in both Docker and Vercel integration tests

---

### Pitfall 7: LLM Concept Extraction Hallucinates or Over-Extracts Concepts

**What goes wrong:**
A student asks "Why is the sky blue?" The LLM extracts: "sky", "blue", "color", "light scattering", "Rayleigh scattering", "atmosphere", "wavelength", "optics". Seven concepts are added to the graph from a single question. Over 30 sessions, the graph has 300 nodes, many of which are trivially common words or fragments ("blue", "color") that pollute the misconception matching pipeline. Alternatively, the LLM extracts the wrong canonical form: "Rayleigh Scattering" vs. "rayleigh scattering" vs. "Rayleigh scattering" become three separate nodes.

**Why it happens:**
Concept extraction prompts are under-constrained. Without explicit instructions about granularity, the LLM defaults to over-extraction. Canonical form normalization is skipped because it seems like a polish item.

**How to avoid:**
- Constrain extraction prompts: "Extract 1-3 core scientific or mathematical concepts only. Exclude common words, adjectives, and vague terms. Return concepts in Title Case canonical form."
- Define a "concept quality rubric" in the prompt: a concept must be a noun phrase representing a specific, learnable idea (not "sky", not "blue" — yes to "Rayleigh scattering", "atmospheric optics")
- Run canonical normalization on extracted concept names (lowercase comparison for deduplication; display in Title Case)
- Add a minimum concept "weight" threshold: concepts appearing in fewer than N student queries don't generate graph nodes — they stay as raw extractions pending confirmation
- Log all extraction outputs for the first 100 queries and manually audit; tune the prompt before scaling

**Warning signs:**
- Graph nodes include single common English words ("light", "color", "force")
- Graph node count grows by 5+ per question on average
- Multiple nodes for the same concept with different capitalization or punctuation

**Phase to address:** Concept extraction pipeline phase; audited before knowledge graph visualization is built

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single exact-match against misconception library | Fast to implement | Misses paraphrased or synonym concepts; library never scales | Never — use pgvector similarity from the start |
| Hardcode Anthropic API key in `.env.local` without token budget limits | Saves time on auth flow | Uncontrolled API spend; a misbehaving loop drains budget overnight | Development only; add per-student daily budget cap before any user access |
| Skip the LLM disambiguation pass in deduplication pipeline | Faster concept ingestion | Concept graph becomes meaningless after ~100 nodes | Never for the core deduplication path; optional for low-confidence fast path |
| SVG-only graph renderer | Easier to implement | Freezes at 150+ nodes on mobile | MVP only with explicit node cap enforced server-side |
| No data retention TTL on student records | Simpler schema | COPPA violation on first real student | Never — add TTL fields in the initial schema migration |
| In-memory rate limiting (no Redis) | No Redis dependency | Rate limits reset on server restart; Vercel serverless creates multiple instances so in-memory limits don't work | Docker Compose local dev only; must use DB-backed rate limiting on Vercel |
| `turbo prune` skipped in Dockerfile | Simpler Dockerfile | Every dependency installed even for single-app builds; Docker images are 3–5x larger; CI is slow | Never for production Docker images |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| pgvector `<=>` operator | Treating cosine distance as cosine similarity (0 = identical vs. 1 = identical) | Verify: `1 - (embedding <=> query_embedding)` gives similarity; `<=>` alone gives distance |
| Neon serverless on Vercel | Using standard `pg` driver without connection pooling; each serverless invocation opens a new connection | Use `@neondatabase/serverless` driver or PgBouncer connection string for all Vercel deployments |
| Anthropic Claude API in monorepo | Importing the SDK directly in `apps/web` — breaks Docker isolation | All LLM calls must go through `packages/llm` adapter; never import `@anthropic-ai/sdk` outside that package |
| Turborepo Docker builds | Not using `turbo prune --scope=web` before `npm install` in Dockerfile | Use `turbo prune` in a separate Docker build stage to produce a minimal workspace before install |
| D3.js + React | Mixing D3 DOM mutation and React state; React re-renders trash D3's simulation state | Use D3 for math/simulation only; let React own the DOM; sync via `useEffect` with stable refs |
| pgvector HNSW index | Building HNSW index before inserting data; re-indexing is extremely slow (32x slower than IVFFlat at build time) | Use IVFFlat for initial development; migrate to HNSW only after data volume justifies it and during a maintenance window |
| Next.js App Router + serverless LLM | Default function timeout (10s on Vercel hobby plan) is too short for LLM + pgvector disambiguation | Set `export const maxDuration = 30` on LLM routes; architect pipeline to fail gracefully under time pressure |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Force simulation running indefinitely | CPU pegged in browser; battery drain on mobile; UI unresponsive | Call `simulation.stop()` when `alpha < 0.001`; add `simulation.alphaDecay(0.05)` | At any scale on low-end mobile devices |
| Exact-string concept matching against growing library | Routing decisions take linearly longer as library grows | Use indexed pgvector similarity from day one | ~500 library entries |
| N+1 queries for knowledge graph fetch | Loading each concept's connections in separate queries; API latency spikes on large graphs | Single CTE or JOIN query to fetch all nodes and edges for a student in one round trip | ~50 concept nodes |
| SVG node count explosion | Browser tab becomes unresponsive; forced reload | Implement node clustering below zoom threshold; hard cap at 150 visible nodes | ~300 SVG elements on mobile iOS Safari |
| LLM disambiguation on every concept extraction | API costs blow up; latency unacceptable | Only invoke LLM disambiguation when pgvector returns candidates above a similarity floor (e.g., 0.70–0.90 band); skip if no candidates in range | Any scale — this is a design issue, not a scale issue |
| Full conversation history as LLM context | Token costs grow quadratically per session; context window exceeded after 20+ turns | Use a sliding window (last 5 exchanges) + a compressed summary for Socratic dialogue; never send full history | ~15 dialogue turns |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Student PII (name, email) included in LLM prompts | Data sent to Anthropic servers; violates COPPA data minimization; potential FERPA breach | Map student identity to session token at API boundary; only pass anonymized session ID and grade band to LLM |
| No per-student LLM rate limiting | A student can spam questions; API costs grow unbounded; a loop in client code drains budget | Enforce 1 question/day at database level (unique constraint on student_id + date); secondary rate limit of 10 API calls/hour per student |
| Teacher dashboard exposes other classes' data | FERPA violation: teachers can only see their own students | Row-level security policies in PostgreSQL: all dashboard queries must include `WHERE class.teacher_id = :current_teacher_id` |
| Self-hosted deployment ships with debug logging enabled | Student questions logged to stdout, which may be captured by cloud logging services | Disable debug logging by default in Docker image; document how to enable for troubleshooting |
| YAML misconception library includes community-contributed malicious content | LLM is prompted with attacker-controlled text (prompt injection via library entries) | Sanitize all library strings before interpolation into prompts; validate library entries in CI against a character allowlist; treat library content as untrusted user input |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Entering diagnostic mode without explaining why | Student is suddenly asked probing questions without context; feels interrogated, not curious | Display a brief "I noticed something interesting about how you think about [concept]..." transition screen before diagnostic flow |
| Showing all graph nodes at once on first visit | Overwhelming; student sees a blob of nodes with no clear meaning | Progressive reveal: show only the last 7 days by default; let student expand to full graph |
| Socratic probe questions that reveal the answer | Student is told the misconception rather than confronting it themselves; no cognitive conflict achieved | Probe questions must be answered by the student; never include the correct answer in the question itself; test each prompt template for this anti-pattern |
| "No misconceptions detected" shown as a positive | Students with unprobed concepts are not told their knowledge is unvalidated | Use "Not yet explored" state for unprobed concepts; only "Healthy" after successful probe resolution |
| Generic error messages when LLM fails | Student sees "Something went wrong" and gets no learning value | LLM failures should degrade gracefully to enrich mode (not diagnostic); never show a blank graph or error state without a recovery path |
| Teacher dashboard uses misconception jargon | Teachers unfamiliar with conceptual change theory are confused by "probe/classify/confront" language | Use plain English in the dashboard: "Common misunderstanding", "Students who think X but it's actually Y" |

---

## "Looks Done But Isn't" Checklist

- [ ] **Concept deduplication:** pgvector threshold is set — but has it been validated against a golden test set of domain-crossing concepts (gravity/physics vs. gravity/baking)?
- [ ] **Socratic probing:** Prompts return age-appropriate text — but have they been tested against all 4 grade bands with a post-generation validation pass?
- [ ] **COPPA compliance:** No third-party analytics — but have all CDN-loaded fonts, images, and external script tags been audited? Is the data retention policy published?
- [ ] **Knowledge graph:** Renders correctly in dev — but has it been tested with 200-node seed data on a mobile device?
- [ ] **Misconception library:** YAML files are valid — but does CI run JSON Schema validation on every PR? Are all entries research-cited?
- [ ] **Docker deployment:** `docker compose up` works — but does the production Dockerfile use `turbo prune`? Are all environment variables documented?
- [ ] **Vercel deployment:** Deployed successfully — but are LLM routes setting `maxDuration`? Is the Neon serverless driver in use (not standard `pg`)?
- [ ] **Teacher dashboard:** Shows student data — but does every query enforce `teacher_id` row-level security? Is there a test for cross-class data leakage?
- [ ] **Rate limiting:** Daily question cap implemented — but does it work across multiple Vercel serverless instances (not in-memory)?
- [ ] **LLM context:** Diagnostic dialogue works — but is conversation history bounded to a sliding window to prevent token cost blowup?

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Concept deduplication threshold wrong — graph is polluted | HIGH | Data migration to re-run deduplication pipeline on all existing concepts; manual review of merged/split nodes; rebuild embeddings if model changed |
| COPPA violation discovered post-launch | CRITICAL | Immediate data deletion of affected records; legal review; notification to school administrators; FTC voluntary disclosure (reduces penalty exposure) |
| SVG graph freezes in live demo | LOW | Switch to filtered view (last 7 days); add node count cap as hotfix; Canvas migration deferred |
| LLM delivers age-inappropriate content to a student | HIGH | Immediate disable of diagnostic mode; manual review of all sessions; prompt re-engineering with post-generation validation; incident log for deployers |
| Misconception library schema change breaks YAML files | MEDIUM | Version the schema; write a migration script; add backward-compatibility to the validator before deploying schema changes |
| Docker and Vercel behavior diverge discovered late | MEDIUM | Prioritize Docker parity fixes (self-host promise); document Vercel-specific limitations explicitly in README; add both targets to CI |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Concept deduplication threshold miscalibration | Concept extraction pipeline phase | Golden test set of 50+ concept pairs passes with < 5% false merge/split rate |
| LLM age-inappropriate Socratic probing | Misconception diagnostic / Socratic dialogue phase | Manual review of 20+ probe questions across all 4 grade bands; Flesch-Kincaid check passes |
| COPPA data retention / third-party leakage | Auth and data model phase | Schema has `delete_after` on all student tables; zero external script tags in audit; retention policy document published |
| Knowledge graph SVG performance degradation | Knowledge graph visualization phase | 200-node seed data renders at > 30fps on a mid-range mobile device |
| Misconception library becoming a bottleneck | Misconception library and routing engine phase | CI validates YAML schema; routing engine uses pgvector similarity (not string match); all entries have research citations |
| Docker/Vercel deployment behavior drift | Infrastructure and deployment phase | Automated integration test suite runs against both `docker compose` and `vercel dev` targets in CI |
| LLM over-extraction / hallucinated concepts | Concept extraction pipeline phase | Manual audit of 100 extraction outputs; node count per question averages ≤ 2.5; no common English words in graph nodes |
| Student PII in LLM prompts | Auth and data model phase | Code review confirms no `student.name` or `student.email` fields in any LLM prompt template |
| D3 / React state mutation conflict | Knowledge graph visualization phase | Graph simulation does not flicker on React re-render; force simulation alpha decays to zero |
| LLM context window cost blowup | Misconception diagnostic / Socratic dialogue phase | Dialogue context tested at 30 turns; token count stays under 4,000 input tokens per request |

---

## Sources

- FTC COPPA 2025 Final Rule: https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- COPPA 2025 compliance guide for EdTech: https://blog.promise.legal/startup-central/coppa-compliance-in-2025-a-practical-guide-for-tech-edtech-and-kids-apps/
- EdTech student privacy compass guide: https://studentprivacycompass.org/wp-content/uploads/2025/09/2025-EdTech-Guide.pdf
- pgvector cosine distance vs. similarity bug (Supabase issue): https://github.com/supabase/supabase/issues/12244
- pgvector HNSW vs IVFFlat index performance: https://www.tembo.io/blog/vector-indexes-in-pgvector
- pgvector vector search filter performance (Achilles heel): https://yudhiesh.github.io/2025/05/09/the-achilles-heel-of-vector-search-filters/
- Why pgvector benchmarks lie (The New Stack): https://thenewstack.io/why-pgvector-benchmarks-lie/
- D3.js SVG performance cliff (~1000 nodes): https://graphaware.com/visualization/2019/09/05/scale-up-your-d3-graph-visualisation-webgl-canvas-with-pixi-js.html
- SVG vs Canvas for large graphs: https://medium.com/neo4j/scale-up-your-d3-graph-visualisation-part-2-2726a57301ec
- LLM entity extraction brittleness (GDELT experiments): https://blog.gdeltproject.org/experiments-in-entity-extraction-using-llms-hallucination-how-a-single-apostrophe-can-change-the-results/
- Socratic LLM asymmetric feedback / cognitive state failure: https://aclanthology.org/2025.findings-emnlp.888.pdf
- LLM hallucination in educational contexts: https://www.facultyfocus.com/articles/teaching-with-technology-articles/mitigating-hallucinations-in-llms-for-community-college-classrooms-strategies-to-ensure-reliable-and-trustworthy-ai-powered-learning-tools/
- Turborepo Docker with pnpm — turbo prune: https://turbo.build/repo/docs/handbook/deploying-with-docker
- Neon serverless connection pooling: https://neon.com/docs/connect/choose-connection
- Vercel does not support Docker images: https://vercel.com/kb/guide/does-vercel-support-docker-deployments
- Solo developer project failure modes: https://preview.app.daily.dev/posts/this-is-why-most-solo-dev-projects-fail-dpb5hfvxa

---
*Pitfalls research for: AI-powered K-12 educational knowledge graph with misconception detection (MindMap)*
*Researched: 2026-04-08*
