---
phase: 07-3d-solar-system-knowledge-graph
plan: "01"
subsystem: graph-rendering
tags:
  - react-three-fiber
  - three.js
  - d3-force-3d
  - instanced-mesh
  - webgl
dependency_graph:
  requires:
    - apps/web/actions/graph.ts
  provides:
    - apps/web/components/graph/use-graph-layout.ts
    - apps/web/components/graph/solar-nodes.tsx
    - apps/web/components/graph/solar-edges.tsx
  affects:
    - apps/web/components/graph/ (future plans 02 and 03 compose these)
tech_stack:
  added:
    - three@0.183.2
    - "@react-three/fiber@9.5.0"
    - "@react-three/drei@10.7.7"
    - d3-force-3d@3.0.6
    - "@react-three/postprocessing@3.0.4"
    - "@types/three@0.183.1"
  patterns:
    - d3-force-3d static layout (tick 300 synchronous convergence)
    - InstancedMesh single-draw-call node rendering
    - drei Line per edge (constellation style)
key_files:
  created:
    - apps/web/components/graph/use-graph-layout.ts
    - apps/web/components/graph/solar-nodes.tsx
    - apps/web/components/graph/solar-edges.tsx
    - apps/web/types/d3-force-3d.d.ts
  modified:
    - apps/web/package.json
decisions:
  - key: d3-force-3d has no @types package — wrote minimal declaration file
    rationale: No @types/d3-force-3d exists on npm; custom .d.ts in apps/web/types/ resolves TypeScript TS7016 error cleanly without disabling strict mode
  - key: dummy Object3D memoized via useMemo in SolarNodes
    rationale: Avoids re-creating Object3D on every render; stable reference across effect runs
metrics:
  duration_seconds: 196
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 07 Plan 01: 3D Package Installation and Core Rendering Primitives Summary

**One-liner:** Three.js/R3F instanced star-node renderer and d3-force-3d 3D layout hook — the data pipeline and rendering primitives for the solar system knowledge graph.

## What Was Built

Established the complete data pipeline and the two core rendering primitives that Plan 02 will compose into a full 3D scene:

1. **`use-graph-layout.ts`** — `useGraphLayout(nodes, edges): LayoutNode[]` hook that runs d3-force-3d synchronously (tick 300) to produce stable `{ x, y, z }` positions without triggering React re-renders. Memoized on `[nodes, edges]`. Deep-clones inputs to prevent D3 mutation of React props.

2. **`solar-nodes.tsx`** — `SolarNodes` component rendering all graph nodes as a single `InstancedMesh` (one WebGL draw call). Each instance has per-node position, scale (from `getNodeRadius`), and color (from `getNodeColor`). Health state colors are identical to the 2D graph. `toneMapped={false}` enables Bloom post-processing. Supports `onClick` (via `instanceId`), `onPointerOver/Out` for hover.

3. **`solar-edges.tsx`** — `SolarEdges` component rendering constellation-style edges using drei `<Line>` per edge. O(1) node lookup via id map. Edge colors and opacities match 2D graph palette (bridge=#7c3aed/0.5, misconception=#dc2626/0.4, default=#4a4a8a/0.35).

4. **`types/d3-force-3d.d.ts`** — Minimal TypeScript declaration file for `d3-force-3d` (no @types package exists on npm). Deviation from plan — required to satisfy TypeScript strict mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] d3-force-3d has no @types package — created custom declaration file**
- **Found during:** Task 1 — TypeScript compile after installing packages
- **Issue:** `d3-force-3d` ships only `.js` source with no bundled types and no `@types/d3-force-3d` on npm. TypeScript TS7016 error blocked compilation.
- **Fix:** Created `apps/web/types/d3-force-3d.d.ts` with minimal typed declarations covering all APIs used in `use-graph-layout.ts`. Generic type parameter changed from `<N extends SimulationNode>` to `<N = SimulationNode>` to avoid index-signature conflict with `GraphNode`.
- **Files created:** `apps/web/types/d3-force-3d.d.ts`
- **Commit:** 45c53be

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 45c53be | feat(07-01): install 3D packages and create d3-force-3d layout hook |
| Task 2 | df04c44 | feat(07-01): create InstancedMesh star node renderer and Line edge renderer |

## Verification

- `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` — PASS (zero errors)
- `pnpm build --filter=web` — PASS (5 tasks successful, no SSR crashes)
- All 4 new files exist with correct exports

## Known Stubs

None — these are pure rendering primitives with no data stubs. They receive real data from `getGraphData()` server action via props.

## Self-Check: PASSED

- `use-graph-layout.ts` FOUND
- `solar-nodes.tsx` FOUND
- `solar-edges.tsx` FOUND
- `d3-force-3d.d.ts` FOUND
- Commit 45c53be FOUND
- Commit df04c44 FOUND
