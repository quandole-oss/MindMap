---
phase: "07"
plan: "02"
subsystem: "3d-graph-scene"
tags: [react-three-fiber, drei, bloom, postprocessing, SSR, dynamic-import, webgl]
dependency_graph:
  requires: [07-01]
  provides: [3d-solar-graph-rendered, ssr-safe-knowledge-graph]
  affects: [apps/web/app/student/graph]
tech_stack:
  added: []
  patterns:
    - "next/dynamic with ssr: false for WebGL SSR guard"
    - "useFrame lerp for smooth camera fly-to animation"
    - "Html tooltip from drei — rendered only for hovered node (not all nodes)"
    - "OrbitControls makeDefault to expose controls to useThree in child components"
    - "EffectComposer + Bloom for star glow post-processing"
key_files:
  created:
    - apps/web/components/graph/solar-scene.tsx
    - apps/web/components/graph/solar-graph.tsx
  modified:
    - apps/web/components/graph/knowledge-graph.tsx
decisions:
  - "Html hover label rendered only for hovered node (not all nodes) — avoids 250 Html portals in DOM"
  - "Double-click detected via 300ms time+same-node gate on single click handler — avoids separate event listener"
  - "OrbitControls makeDefault required for useThree state.controls access in SolarScene fly-to"
  - "next/dynamic ssr:false in knowledge-graph.tsx preserves existing import path for graph-page-client.tsx"
metrics:
  duration_seconds: 132
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
  completed_date: "2026-04-09"
---

# Phase 7 Plan 02: 3D Scene Composition and SSR Bridge Summary

**One-liner:** Full R3F 3D scene assembled from Plan 01 primitives — SolarScene + SolarGraph Canvas wrapper + SSR-safe dynamic import — replacing the 2D D3.js graph at `/student/graph`.

---

## What Was Built

This plan composes the rendering primitives from Plan 01 (SolarNodes, SolarEdges, useGraphLayout) into a complete, interactive 3D solar system visualization and wires it into the Next.js app via an SSR-safe dynamic import.

### Task 1: SolarScene + SolarGraph

**`solar-scene.tsx`** — Inner R3F scene:
- Calls `useGraphLayout` to get 3D positions, then renders `<SolarNodes>` and `<SolarEdges>`
- `<Stars>` background (radius=300, depth=60, 3000 particles) for space atmosphere
- Hover label via `<Html>` from drei — positioned above the hovered node, rendered only when a node is hovered (never all 250 at once)
- Camera fly-to on double-click: `useFrame` lerp loop moves `camera.position` and `controls.target` toward target at 0.06 factor per frame; stops when distance < 0.5 units
- Double-click detection via 300ms + same-node gate on the shared `handleClick` callback

**`solar-graph.tsx`** — Canvas wrapper:
- `<Canvas>` with `camera={{ position: [0, 0, 200], fov: 60 }}`, `dpr={[1, 2]}`, `gl={{ antialias: true }}`
- `<OrbitControls makeDefault enableDamping dampingFactor={0.05} />` — exposes controls to `useThree()` in SolarScene, handles mouse/touch rotate/zoom/pan
- `<EffectComposer><Bloom luminanceThreshold={0.8} luminanceSmoothing={0.9} intensity={1.5} mipmapBlur /></EffectComposer>` — produces star glow effect paired with `toneMapped={false}` on node material

### Task 2: SSR-Safe KnowledgeGraph Wrapper

**`knowledge-graph.tsx`** (replaced):
- Entire 2D D3.js implementation (356 lines) replaced with a 48-line thin wrapper
- `next/dynamic(() => import('./solar-graph').then(m => m.SolarGraph), { ssr: false })`
- `ssr: false` prevents server-side evaluation of three.js (no "window is not defined" crash)
- Loading fallback matches `#050510` dark background for seamless visual transition
- Export name `KnowledgeGraph` and props interface preserved exactly — `graph-page-client.tsx` unchanged

---

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (pre-task) | PASSED — 0 errors |
| `tsc --noEmit` (post-task) | PASSED — 0 errors |
| `pnpm build --filter=web` | PASSED — 5/5 tasks successful, no SSR errors |
| `graph-page-client.tsx` unmodified | CONFIRMED — file untouched |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. The 3D graph renders from the same `getGraphData()` server action that powered the 2D graph. No placeholder data.

---

## Threat Flags

No new security-relevant surface introduced beyond what was listed in the plan's threat model.

---

## Self-Check: PASSED

Files created/modified:
- `apps/web/components/graph/solar-scene.tsx` — FOUND
- `apps/web/components/graph/solar-graph.tsx` — FOUND
- `apps/web/components/graph/knowledge-graph.tsx` — FOUND (modified)

Commits:
- `da285a9` — Task 1: SolarScene + SolarGraph — FOUND
- `fdf90ae` — Task 2: SSR-safe KnowledgeGraph — FOUND
