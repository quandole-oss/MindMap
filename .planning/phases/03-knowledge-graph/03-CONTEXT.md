# Phase 3: Knowledge Graph - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement pgvector-based concept deduplication (two-stage: ANN search + LLM disambiguation), add embedding vectors to the concepts table, create concept edges with typed relationships, build the interactive force-directed D3.js knowledge graph visualization, and implement weekly bridge node detection for cross-subject surprise connections.

</domain>

<decisions>
## Implementation Decisions

### Concept Deduplication
- Embedding model: OpenAI `text-embedding-3-small` (1536 dimensions) — best quality/cost ratio, well-documented with pgvector
- Two-stage deduplication thresholds: >0.92 cosine similarity = auto-merge, 0.85-0.92 = LLM disambiguate ("Are these the same concept?" with domain context), <0.85 = new node
- Embeddings generated in `onFinish` callback alongside concept extraction — already in the pipeline, no async queue needed
- "Same word, different domain" handled by LLM disambiguation in the 0.85-0.92 band with domain context

### D3.js Graph Visualization
- SVG rendering with `useRef` + `useEffect` — full control over node styling, health state colors, click handlers
- Graph data from server action returning nodes + edges JSON — client-only D3 rendering
- Node click opens a side panel showing original questions/exchanges — keeps graph visible
- Mobile performance: zoom-based clustering at ~250+ nodes to avoid SVG performance cliff (~300 nodes on mobile Safari)

### Graph Edges & Bridge Detection
- Auto-create edges between concepts from the same question (curiosity_link type)
- Bridge node detection via betweenness centrality — identifies nodes connecting different domain clusters
- Weekly surprise connection: server-side action computes top bridge node, shown as toast/card on student login
- Edge types enum: "curiosity_link" (same question), "bridge" (cross-domain), "misconception_cluster" (shared misconception)

### Claude's Discretion
- pgvector HNSW vs IVFFlat index type (research suggests HNSW for this scale)
- D3.js force simulation parameters (charge, link distance, alpha decay)
- Side panel layout and animation
- Bridge detection scheduling (cron vs on-demand)
- Embedding generation error handling and retry strategy

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/schema/questions.ts` — concepts table already exists (needs embedding column added)
- `packages/llm/src/prompts/extract.ts` — extractConcepts() returns {name, domain} per concept
- `packages/llm/src/adapters/factory.ts` — createLLMAdapter() for LLM disambiguation calls
- `packages/router/src/index.ts` — routeQuestion() already matches concepts to misconception library
- `apps/web/app/api/ask/route.ts` — onFinish pipeline where dedup + embedding need to be inserted
- shadcn/ui components installed

### Established Patterns
- Server actions in apps/web/actions/
- Drizzle queries with db.insert(), db.query()
- AI SDK v6: generateText + Output.object() for structured extraction
- D3.js must be "use client" with useEffect — server-rendering D3 produces dead static images

### Integration Points
- concepts table needs: embedding vector(1536) column, visitCount integer
- New concept_edges table: id, sourceConceptId, targetConceptId, edgeType enum
- onFinish pipeline: after concept extraction → generate embedding → dedup against existing → insert/merge
- New /student/graph page with D3.js component
- Sidebar needs "My Graph" link

</code_context>

<specifics>
## Specific Ideas

- pgvector cosine distance operator `<=>` returns DISTANCE not similarity — use `1 - (a <=> b)` for similarity
- HNSW index recommended over IVFFlat for <10K concepts per student
- D3 force simulation must explicitly stop when alpha decays (d3.forceSimulation().stop())
- Node colors from UI-SPEC Phase 1: teal (#14b8a6 healthy), coral (#f87171 misconception), gray (#a1a1aa unprobed), purple (#a78bfa bridge)
- Node size = 8 + (visitCount * 2) capped at 24px radius
- Research flagged: test dedup against "gravity in space" vs "gravity in baking" (should merge) and "wave in physics" vs "wave in music" (should split)

</specifics>

<deferred>
## Deferred Ideas

- Ollama embedding adapter for self-hosted — v2 (ADPT-02)
- Advanced graph analytics (centrality scores displayed to user) — v2
- Graph export as PNG/JSON — v2 (EXPT-01, EXPT-02)

</deferred>
