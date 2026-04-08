---
phase: 03-knowledge-graph
verified: 2026-04-08T00:00:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Submitting a question about a concept that already exists (similarity > 0.92) increments visitCount on the existing concept instead of creating a duplicate"
    status: failed
    reason: "apps/web/app/api/ask/route.ts was never updated with the dedup pipeline. The old direct-insert loop (no embedding, no pgvector query, no dedup, no edge creation) is still in production. The dedup helper functions exist in packages/db/src/queries/concepts.ts and packages/llm/src/prompts/disambiguate.ts but are never imported or called by any source file in apps/web."
    artifacts:
      - path: "apps/web/app/api/ask/route.ts"
        issue: "Still contains the original Phase 2 concept insertion loop (lines 126-147). No import of generateEmbedding, findSimilarConcepts, disambiguateConcept, or createConceptEdges. visitCount is never incremented. No auto-merge, LLM-merge, or new-node-with-embedding path exists."
    missing:
      - "Replace the concept insertion loop in onFinish with the two-stage dedup + edge pipeline from Plan 02 Task 2 (already specified line-by-line in the plan)"
      - "Add imports: generateEmbedding, disambiguateConcept from @mindmap/llm; findSimilarConcepts, createConceptEdges from @mindmap/db; sql from drizzle-orm; eq from drizzle-orm"

  - truth: "Concepts in the 0.85-0.92 similarity band are disambiguated by an LLM call that considers domain context"
    status: failed
    reason: "Consequent of the same root cause: the dedup pipeline is never invoked from route.ts. disambiguateConcept() is exported from @mindmap/llm but no call site exists in apps/web source files."
    artifacts:
      - path: "apps/web/app/api/ask/route.ts"
        issue: "No call to disambiguateConcept(). Same root cause as above."
    missing:
      - "Same fix as above — wiring the full dedup pipeline into onFinish resolves this truth"

  - truth: "Concepts below 0.85 similarity create new nodes with embeddings"
    status: failed
    reason: "New concepts are inserted without embeddings (see route.ts lines 133-141: no embedding field in the .values() call). Also consequent of the unwired pipeline."
    artifacts:
      - path: "apps/web/app/api/ask/route.ts"
        issue: "Concept insert at lines 133-141 has no embedding field. visitCount not set. The new-node path from the dedup pipeline (which would include embedding and visitCount: 1) is absent."
    missing:
      - "Same fix as above"

  - truth: "Concepts from the same question are connected by curiosity_link edges"
    status: failed
    reason: "createConceptEdges() exists and is correctly implemented in packages/db/src/queries/concepts.ts but is never called from route.ts. No concept_edges rows will be created for any question."
    artifacts:
      - path: "apps/web/app/api/ask/route.ts"
        issue: "No call to createConceptEdges(). resolvedConceptIds array never accumulated. The concept-question join is created but the concept-concept edge is not."
    missing:
      - "Same fix as above — the plan's Task 2 code block includes the resolvedConceptIds accumulation and the createConceptEdges() call"

deferred: []
human_verification:
  - test: "Verify D3 force graph renders and interactions work in a real browser"
    expected: "Graph shows colored nodes sized by visitCount, force physics settle, hover tooltip appears, node click opens Sheet side panel, drag pins node, double-click releases, scroll-zoom works 0.25x-3x, empty state shown when no concepts exist"
    why_human: "D3 SVG rendering, force simulation feel, and animation cannot be verified programmatically without a browser runtime"
  - test: "Verify bridge toast fires on first weekly page load"
    expected: "Sonner toast with 'Surprise connection' title and correct bridge concept name and domain names appears within 8 seconds. Clicking Explore opens the side panel for the bridge node with purple pulse animation."
    why_human: "localStorage-based cooldown behavior and toast timing require a live browser session to verify"
---

# Phase 3: Knowledge Graph Verification Report

**Phase Goal:** Every extracted concept is correctly deduplicated against the student's existing graph via pgvector semantic search and LLM disambiguation, stored with embedding vectors, and rendered as an interactive force-directed D3.js graph the student can explore
**Verified:** 2026-04-08
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Concepts table has vector(1536) embedding column + HNSW index + visitCount column | VERIFIED | packages/db/src/schema/questions.ts lines 46-57: `vector("embedding", { dimensions: 1536 })`, `integer("visit_count").notNull().default(0)`, `index("concepts_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))` |
| 2 | concept_edges table exists with sourceConceptId, targetConceptId, edgeTypeEnum, unique constraint | VERIFIED | packages/db/src/schema/questions.ts lines 60-83: edgeTypeEnum, conceptEdges table with FKs and unique().on(t.sourceConceptId, t.targetConceptId, t.edgeType) |
| 3 | generateEmbedding() returns 1536-length number array from OpenAI text-embedding-3-small | VERIFIED | packages/llm/src/embeddings.ts: uses openai.embedding("text-embedding-3-small"), exported from packages/llm/src/index.ts line 10 |
| 4 | Submitting a question auto-merges existing concepts (>0.92), LLM-disambiguates borderline (0.85-0.92), and creates new nodes with embeddings (<0.85) | FAILED | apps/web/app/api/ask/route.ts still contains the original Phase 2 direct-insert loop. No call to generateEmbedding, findSimilarConcepts, disambiguateConcept, or createConceptEdges anywhere in apps/web source. All four dedup helper functions exist but are ORPHANED. |
| 5 | Concepts from the same question are connected by curiosity_link edges | FAILED | createConceptEdges() is implemented in packages/db/src/queries/concepts.ts but is never called from route.ts. No concept_edges rows will be created for any question submission. |
| 6 | Student sees an interactive force-directed D3.js graph at /student/graph with their concept nodes and edges | VERIFIED | apps/web/app/student/graph/page.tsx exists with auth guard + getGraphData() call; apps/web/components/graph/knowledge-graph.tsx implements D3 forceSimulation with all required forces, colors, sizes, cleanup |
| 7 | Node size scales with visitCount, node color encodes health state, clicking opens side panel | VERIFIED | knowledge-graph.tsx: getNodeRadius = Math.min(8 + visitCount * 2, 24); NODE_COLORS maps status to exact hex values; click handler calls onNodeClick(d.id); NodeDetailPanel wired via graph-page-client.tsx |
| 8 | Betweenness centrality identifies bridge nodes; weekly toast fires with 7-day cooldown | VERIFIED | apps/web/lib/graph/centrality.ts: full Brandes BFS algorithm; apps/web/components/graph/bridge-toast.tsx: Sonner toast with localStorage cooldown |

**Score:** 3/5 truths verified (treating the 5 must-haves from plans, 2 of which are FAILED)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/questions.ts` | vector(1536) + visitCount + conceptEdges + HNSW | VERIFIED | All schema elements present and correct |
| `packages/llm/src/embeddings.ts` | generateEmbedding() using text-embedding-3-small | VERIFIED | Exists, substantive (42 lines), exported from index.ts |
| `packages/llm/src/index.ts` | Re-exports generateEmbedding, disambiguateConcept | VERIFIED | Lines 10-11 export both functions |
| `packages/db/src/queries/concepts.ts` | findSimilarConcepts(), createConceptEdges() | PARTIAL | Both functions exist and are correct. Plan also required upsertConceptWithDedup() — neither that nor the SUMMARY's deduplicateAndStoreConcepts() exists. The dedup orchestration (calling these functions from route.ts) is MISSING. |
| `packages/llm/src/prompts/disambiguate.ts` | disambiguateConcept() + buildDisambiguatePrompt() | VERIFIED | Both functions present, correct implementation with fail-open behavior |
| `apps/web/app/api/ask/route.ts` | Updated onFinish with embedding + dedup + edge pipeline | FAILED — ORPHANED | File is the original Phase 2 version. Dedup pipeline was never wired in. |
| `apps/web/actions/graph.ts` | getGraphData(), getNodeDetails(), getBridgeConnection() | VERIFIED | All three server actions implemented with correct access control |
| `apps/web/components/graph/knowledge-graph.tsx` | use client D3 force graph with full spec | VERIFIED | 357 lines, d3.forceSimulation, all forces, zoom, drag, tooltip, cleanup, pulse animation |
| `apps/web/components/graph/node-detail-panel.tsx` | Sheet side panel with concept exchanges | VERIFIED | getNodeDetails() called, Sheet/SheetContent rendered, "Questions that shaped this idea" label, collapsible answers |
| `apps/web/components/graph/health-legend.tsx` | Four-state color legend | VERIFIED | Four items with correct labels: Understood, Needs review, Not yet explored, Connects topics |
| `apps/web/app/student/graph/page.tsx` | Server component with auth guard + getGraphData | VERIFIED | Auth redirect, parallel Promise.all([getGraphData(), getBridgeConnection()]), empty state, "My Knowledge Graph" heading |
| `apps/web/components/layout/sidebar.tsx` | My Graph link with Network icon | VERIFIED | Network icon imported, "/student/graph" entry between Dashboard and My Questions |
| `apps/web/lib/graph/centrality.ts` | computeBetweennessCentrality() + findTopBridgeNode() | VERIFIED | 189 lines, Brandes BFS algorithm, cross-domain bridge detection |
| `apps/web/components/graph/bridge-toast.tsx` | Sonner toast with 7-day localStorage cooldown | VERIFIED | "Surprise connection" title, 8000ms duration, Explore action, localStorage timestamp |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| packages/llm/src/embeddings.ts | @ai-sdk/openai | openai.embedding("text-embedding-3-small") | WIRED | Line 14: const embeddingModel = openai.embedding("text-embedding-3-small") |
| packages/db/src/schema/questions.ts | drizzle-orm/pg-core | vector column type | WIRED | Line 10: import { vector } from "drizzle-orm/pg-core" |
| apps/web/app/api/ask/route.ts | packages/llm/src/embeddings.ts | import generateEmbedding from @mindmap/llm | NOT WIRED | No import of generateEmbedding in route.ts; dedup pipeline absent entirely |
| packages/db/src/queries/concepts.ts | drizzle-orm cosineDistance | import cosineDistance from drizzle-orm | WIRED | Line 1: import { cosineDistance, sql, and, eq, isNotNull } from "drizzle-orm" |
| apps/web/app/api/ask/route.ts | packages/db/src/queries/concepts.ts | import findSimilarConcepts, createConceptEdges | NOT WIRED | No import of any dedup query helper in route.ts |
| apps/web/app/student/graph/page.tsx | apps/web/actions/graph.ts | import getGraphData, getBridgeConnection | WIRED | Line 4: import { getGraphData, getBridgeConnection } from "@/actions/graph" |
| apps/web/components/graph/knowledge-graph.tsx | d3 | import * as d3 from 'd3' | WIRED | Line 3: import * as d3 from "d3"; d3.forceSimulation used on line 95 |
| apps/web/components/graph/node-detail-panel.tsx | apps/web/actions/graph.ts | import getNodeDetails | WIRED | Line 6: import { getNodeDetails } from "@/actions/graph" |
| apps/web/actions/graph.ts | apps/web/lib/graph/centrality.ts | import findTopBridgeNode | WIRED | Line 6: import { findTopBridgeNode } from "@/lib/graph/centrality" |
| apps/web/components/graph/bridge-toast.tsx | sonner | import { toast } from sonner | WIRED | Line 4: import { toast } from "sonner" |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| knowledge-graph.tsx | nodes, edges props | getGraphData() server action → DB queries on concepts + concept_edges | Yes — queries real DB via drizzle; node shape mapped from schema | FLOWING |
| node-detail-panel.tsx | details state | getNodeDetails() server action → DB join on conceptQuestions + questions | Yes — real DB query with userId access control | FLOWING |
| apps/web/app/api/ask/route.ts concept pipeline | embedding field | ABSENT — no generateEmbedding() call | No — concepts inserted with no embedding; visitCount not incremented | DISCONNECTED |
| bridge-toast.tsx | bridgeData prop | getBridgeConnection() → findTopBridgeNode() → real concepts+edges from DB | Yes — real data, but will return null until concept_edges are populated | FLOWING (but concept_edges will be empty until gap is fixed) |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| generateEmbedding exported from @mindmap/llm | grep "generateEmbedding" packages/llm/src/index.ts | Found on line 10 | PASS |
| findSimilarConcepts uses cosineDistance ASC (HNSW-safe) | grep "orderBy.*cosineDistance" packages/db/src/queries/concepts.ts | Found on line 45 | PASS |
| Dedup pipeline wired in ask route | grep "generateEmbedding\|findSimilarConcepts" apps/web/app/api/ask/route.ts | No matches | FAIL |
| createConceptEdges called from ask route | grep "createConceptEdges" apps/web/app/api/ask/route.ts | No matches | FAIL |
| KnowledgeGraph cleanup stops simulation | grep "simulation.stop" apps/web/components/graph/knowledge-graph.tsx | Found on line 269 | PASS |
| Bridge toast localStorage cooldown | grep "bridgeLastShown" apps/web/components/graph/bridge-toast.tsx | Found — read before and set before firing | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GRPH-01 | 03-01 | Concepts stored with embedding vectors in PostgreSQL + pgvector | SATISFIED | vector(1536) column on concepts table, HNSW index, generateEmbedding() exported from @mindmap/llm |
| GRPH-02 | 03-02 | Two-stage dedup: pgvector ANN + LLM disambiguation | BLOCKED | Helper functions built (findSimilarConcepts, disambiguateConcept) but the wiring into route.ts onFinish is ABSENT. No dedup occurs on any question submission. REQUIREMENTS.md correctly marks this as Pending. |
| GRPH-03 | 03-02 | Concept edges between related concepts (curiosity_link, bridge, misconception_cluster) | BLOCKED | createConceptEdges() exists and is correct, but is never called from route.ts. No edges will be created. concept_edges table will remain empty. REQUIREMENTS.md correctly marks this as Pending. |
| GRPH-04 | 03-03 | Force-directed D3.js graph visualization | SATISFIED | /student/graph page renders D3 forceSimulation SVG with full force configuration |
| GRPH-05 | 03-03 | Node size scales with visit count | SATISFIED | getNodeRadius = Math.min(8 + visitCount * 2, 24) in knowledge-graph.tsx |
| GRPH-06 | 03-03 | Node color encodes health state | SATISFIED | NODE_COLORS map with exact hex values; isBridge overrides to #a78bfa |
| GRPH-07 | 03-03 | Student can click node to see original questions and AI exchanges | SATISFIED | Click handler → onNodeClick → NodeDetailPanel → getNodeDetails() server action |
| GRPH-08 | 03-04 | Weekly "surprise connection" bridge notification | SATISFIED | BridgeToast with Brandes betweenness centrality, Sonner toast, 7-day localStorage cooldown. Note: will show no bridge until concept_edges are populated (depends on GRPH-03 gap being fixed). |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/web/app/api/ask/route.ts | 133-141 | Concept inserted without embedding field and without visitCount; old direct-insert loop retained | BLOCKER | Every concept submitted after Phase 3 deployment has NULL embedding. Dedup can never fire. concept_edges never created. visitCount always 0. The graph visualization works but shows only unprobed nodes with no edges and no dedup. |

---

### Human Verification Required

#### 1. D3 Force Graph Visual and Interactive Experience

**Test:** Start `pnpm dev` from the repo root, log in as a student, navigate to `/student/graph`. Submit at least one question from the Dashboard to create concept nodes. Return to My Graph.
**Expected:** Circular gray nodes (status: unprobed) rendered as SVG circles sized at radius 8 (visitCount=0). Force physics repel nodes into stable positions. Hovering shows tooltip with concept name after 200ms delay. Clicking a node opens the Sheet side panel from the right showing "Questions that shaped this idea" and the original question text. Dragging pins a node; double-click releases. Scroll-zoom works from 0.25x to 3x. The reset button (Maximize2 icon, top-right) returns to default zoom. Health legend shows four colors with labels.
**Why human:** D3 SVG rendering, force simulation feel, touch/scroll behavior, and animation quality require a live browser runtime.

#### 2. Bridge Toast Weekly Notification

**Test:** With 3+ concepts across 2+ domains and edges between them (requires GRPH-02/GRPH-03 gap to be fixed first), clear localStorage, navigate to `/student/graph`.
**Expected:** A Sonner toast appears within 8 seconds titled "Surprise connection" naming the bridge concept and two domains. Clicking "Explore" opens the side panel for the bridge node and triggers a 3-cycle purple glow pulse animation. Refreshing the page within 7 days shows no toast.
**Why human:** localStorage state, toast timing, and CSS animation require a live browser session. Also blocked by the GRPH-02/GRPH-03 gap until concept_edges are populated.

---

### Gaps Summary

**Root cause:** Plan 03-02 Task 2 was documented in the SUMMARY as complete but the primary deliverable — rewriting the concept insertion loop in `apps/web/app/api/ask/route.ts` — was never executed. The SUMMARY references `deduplicateAndStoreConcepts()` being built, but neither that function nor the plan's specified `upsertConceptWithDedup()` exists anywhere in the codebase.

The result is a split implementation:
- The **infrastructure** (schema, embedding function, pgvector query helpers, LLM disambiguation) is fully built and correct.
- The **wiring** (calling those tools from the HTTP handler) is entirely absent.

All four failed truths share this single root cause and can be resolved by a single fix: replace the concept insertion loop in `onFinish` of `apps/web/app/api/ask/route.ts` with the dedup pipeline specified verbatim in Plan 03-02 Task 2.

**Impact on Phase 3 goal:** The phase goal states "every extracted concept is correctly deduplicated... stored with embedding vectors." This is FALSE for all concepts submitted after Phase 3. Every concept is inserted as a duplicate with no embedding and no edges. The visualization layer (Plans 03-03 and 03-04) is fully built and would work correctly once the dedup gap is closed and real data flows through.

**Impact on GRPH-08 (bridge toast):** The toast mechanism works correctly, but `findTopBridgeNode()` requires `concept_edges` rows to exist. Since GRPH-03 is blocked, the bridge detection will always return null and the toast will never fire until the gap is fixed.

---

_Verified: 2026-04-08_
_Verifier: Claude (gsd-verifier)_
