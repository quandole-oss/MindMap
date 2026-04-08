---
phase: 03-knowledge-graph
plan: 04
subsystem: graph-visualization, server-actions, notifications
tags: [betweenness-centrality, brandes-algorithm, bridge-detection, sonner-toast, localStorage, d3-animation]
dependency_graph:
  requires: [03-02, 03-03]
  provides: [bridge-detection, bridge-toast, centrality-algorithm]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [brandes-bfs-centrality, fire-and-forget-toast, localStorage-cooldown, css-keyframe-animation]
key_files:
  created:
    - apps/web/lib/graph/centrality.ts
    - apps/web/components/graph/bridge-toast.tsx
  modified:
    - apps/web/actions/graph.ts
    - apps/web/app/student/graph/page.tsx
    - apps/web/app/student/graph/graph-page-client.tsx
    - apps/web/components/graph/knowledge-graph.tsx
decisions:
  - "Brandes BFS algorithm chosen for O(V*E) betweenness centrality — correct for sparse per-student graphs (<500 nodes)"
  - "Bridge defined as highest-centrality node with neighbors in 2+ domains — not just high centrality within one domain"
  - "localStorage timestamp set before toast fires — prevents React Strict Mode double-mount from showing toast twice"
  - "data-node-id attribute added to SVG g elements so highlightNodeId querySelector can find them after D3 renders"
  - "Bridge pulse uses CSS @keyframes inside <style> tag in the SVG container — avoids Tailwind arbitrary value complexity"
  - "getBridgeConnection() fetches concepts independently of getGraphData() — called in parallel via Promise.all in page.tsx"
metrics:
  duration_seconds: 480
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 4
---

# Phase 3 Plan 4: Bridge Node Detection and Weekly Surprise Connection Summary

**One-liner:** Brandes' betweenness centrality identifies cross-domain bridge concepts, marks them purple on the graph, and fires a weekly Sonner toast on first page load with a 7-day localStorage cooldown.

---

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Implement betweenness centrality and bridge node detection | `d8188b0` | DONE |
| 2 | Implement weekly bridge toast notification | `5f18ca6` | DONE |

---

## What Was Built

### Task 1: Betweenness Centrality Algorithm

**`apps/web/lib/graph/centrality.ts`** (new):
- `computeBetweennessCentrality(nodeIds, edges)`: Brandes' BFS algorithm for unweighted undirected graphs. Builds adjacency list, runs BFS from each source, back-propagates delta dependency, divides by 2 for undirected. Returns `Map<string, number>` of node ID → centrality score.
- `findTopBridgeNode(nodes, edges)`: Filters to nodes whose neighbors span at least 2 different domains; returns the highest-centrality such node with its two most prominent connected domain names, or null if no cross-domain bridge exists (or fewer than 3 nodes / 2 edges).

**`apps/web/actions/graph.ts`** (modified):
- Added `import { findTopBridgeNode } from "@/lib/graph/centrality"`
- `getGraphData()` now calls `findTopBridgeNode()` after fetching concepts + edges, and sets `isBridge: true` on the matching node (existing color logic in KnowledgeGraph renders it purple via `#a78bfa`)
- Added `getBridgeConnection()`: independent server action that fetches the student's concepts + edges, calls `findTopBridgeNode()`, looks up the bridge node name, and returns `{ bridgeNodeId, bridgeNodeName, domainA, domainB }` or null.

### Task 2: Weekly Bridge Toast

**`apps/web/components/graph/bridge-toast.tsx`** (new):
- Client component, returns null (no DOM render)
- `useEffect` with empty deps: checks `localStorage.bridgeLastShown` — if within 7 days, silently skips
- Sets timestamp before firing (prevents React Strict Mode double-fire)
- Fires `toast("Surprise connection", { description: "...", duration: 8000, action: { label: "Explore", onClick } })`
- "Explore" calls `onExplore(bridgeNodeId)` which opens the side panel and triggers the pulse

**`apps/web/app/student/graph/graph-page-client.tsx`** (modified):
- Added `bridgeData: BridgeData | null` prop
- Added `highlightNodeId` state; `handleExplore` sets `selectedNodeId` + `highlightNodeId`, clears highlight after 1500ms
- Renders `<BridgeToast>` when bridge data exists, passes `handleExplore` as `onExplore`

**`apps/web/components/graph/knowledge-graph.tsx`** (modified):
- Added optional `highlightNodeId?: string | null` prop
- Added `data-node-id` attribute to each SVG node `<g>` element (enables querySelector from outside D3)
- Added second `useEffect` for `highlightNodeId`: finds the matching `g[data-node-id]`, adds `animate-bridge-pulse` class, removes after 1500ms
- Added `<style>` block with `@keyframes bridge-pulse` (drop-shadow 0→8px→0 at `#a78bfa`) and `.animate-bridge-pulse { animation: bridge-pulse 500ms ease-in-out 3 }` — 3 cycles = 1.5s total

**`apps/web/app/student/graph/page.tsx`** (modified):
- Added `getBridgeConnection` import
- Replaced sequential `getGraphData()` call with `Promise.all([getGraphData(), getBridgeConnection()])` for parallel fetch
- Passes `bridgeData` to `<GraphPageClient>`

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Surface Scan

No new unmitigated threat surfaces introduced.

| Boundary | Implementation | Disposition |
|----------|----------------|-------------|
| T-03-11: getBridgeConnection auth | `userId` sourced from `auth()` session only (line 1: `const session = await auth()`) | Mitigated |
| T-03-12: localStorage tampering | Client can clear `bridgeLastShown` to see toast again — accepted per threat model | Accepted |
| T-03-13: centrality computation DoS | O(V*E) runs server-side in getGraphData() on per-student graph; rate-limited by page loads | Accepted |

---

## Known Stubs

None. All data flows from server actions to components. Bridge detection returns real graph data; toast fires with actual concept and domain names.

---

## Self-Check: PASSED

- FOUND: apps/web/lib/graph/centrality.ts
- FOUND: apps/web/components/graph/bridge-toast.tsx
- FOUND: apps/web/actions/graph.ts (modified — getBridgeConnection, findTopBridgeNode)
- FOUND: apps/web/app/student/graph/page.tsx (modified — getBridgeConnection parallel fetch)
- FOUND: apps/web/app/student/graph/graph-page-client.tsx (modified — BridgeToast, highlightNodeId)
- FOUND: apps/web/components/graph/knowledge-graph.tsx (modified — highlightNodeId prop, pulse animation)
- FOUND commit d8188b0: feat(03-04): implement betweenness centrality and bridge node detection
- FOUND commit 5f18ca6: feat(03-04): implement weekly bridge toast and pulse animation
