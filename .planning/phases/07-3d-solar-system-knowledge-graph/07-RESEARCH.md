# Phase 7: 3D Solar System Knowledge Graph - Research

**Researched:** 2026-04-08
**Domain:** react-three-fiber, d3-force-3d, drei, @react-three/postprocessing, Next.js 15 WebGL
**Confidence:** HIGH (core stack verified against npm registry and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use react-three-fiber (@react-three/fiber) + @react-three/drei for three.js integration in React
- 3D force simulation via d3-force-3d (extends d3-force to 3 dimensions)
- Canvas-based WebGL rendering (not SVG) — handles hundreds of nodes smoothly
- Nodes rendered as glowing spheres (stars) with point lights
- Node size scales with visitCount (same formula as 2D but as sphere radius)
- Node health state colors become star glow colors: teal (healthy), coral (misconception), gray (unprobed), purple (bridge)
- Edges rendered as thin glowing lines connecting stars (like constellation lines)
- Space background: dark with subtle star field particle system
- OrbitControls for rotate/zoom/pan (mouse drag + scroll)
- Click a star node → same side panel opens with question history (Sheet component)
- Hover a star → label appears with concept name + visit count
- Double-click to fly-to/focus on a specific node (smooth camera animation)
- Mobile: touch gestures for orbit/zoom
- Instanced meshes for nodes (single draw call for all stars)
- LOD (level of detail): distant nodes render as simple points, close nodes as detailed spheres
- Same ~250 node mobile target as 2D version
- Files to REPLACE: `apps/web/components/graph/knowledge-graph.tsx`
- Files to MODIFY: `apps/web/app/student/graph/graph-page-client.tsx`
- Files to KEEP: `health-legend.tsx`, `node-detail-panel.tsx`, `actions/graph.ts`
- Same data structure from getGraphData() — just render in 3D

### Claude's Discretion
- Specific star/glow shader or material (MeshStandardMaterial with emissive vs custom shader)
- Particle system density for background stars
- Camera animation easing
- Bloom/glow post-processing approach (drei's Bloom vs custom)
- Force simulation parameters for 3D layout

### Deferred Ideas (OUT OF SCOPE)
- VR/AR support (WebXR) — future enhancement
- Sound effects for navigation — not in scope
- Animated particle trails along edges — polish later
</user_constraints>

---

## Summary

This phase replaces the existing D3.js SVG knowledge graph with a WebGL 3D visualization using react-three-fiber (R3F) v9. The core technical challenge is integrating three distinct systems: (1) d3-force-3d for physics layout, (2) R3F/drei for rendering, and (3) Next.js 15 App Router with its SSR constraints. The data layer stays entirely unchanged — `getGraphData()` returns the same `{ nodes, edges }` structure that feeds the 3D scene.

The primary SSR risk is that `three.js` uses browser APIs unavailable in Node.js. The solution is a `"use client"` directive plus `next/dynamic` with `ssr: false` wrapping the Canvas component. All three.js code must be isolated in a client-only file. This is a well-documented pattern in the R3F community and straightforward to implement.

For 250 nodes, the correct performance path is `InstancedMesh` (single draw call) over individual `<mesh>` components. Click/hover detection works natively via R3F's raycasting — the `onClick` and `onPointerOver` event handlers on `instancedMesh` provide `event.instanceId`, which maps back to the node array. Edge rendering uses drei's `<Line>` component (backed by THREE.Line2), or for better batching of all edges, a single `<Segments>` component.

**Primary recommendation:** Build a client-only `SolarGraph.tsx` (Canvas + R3F scene) dynamically imported with `ssr: false` from `knowledge-graph.tsx`. Run d3-force-3d to convergence synchronously before first render (static layout), then use R3F's instanced mesh pattern to render nodes and drei's `<Line>` for edges. Add `<EffectComposer><Bloom /></EffectComposer>` inside Canvas for glow.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-three/fiber | 9.5.0 | React renderer for three.js | Pairs with React 19; JSX three.js syntax; built-in event system |
| @react-three/drei | 10.7.7 | Helper components (Stars, Html, Line, OrbitControls) | Official R3F companion; provides all needed abstractions |
| three | 0.183.2 | WebGL 3D engine | Core dependency; required by R3F |
| d3-force-3d | 3.0.6 | 3D force-directed layout | Drop-in replacement for d3-force with numDimensions(3) |
| @react-three/postprocessing | 3.0.4 | Bloom/glow post-processing | Official R3F postprocessing wrapper |

[VERIFIED: npm registry — all versions checked 2026-04-08]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/three | 0.183.1 | TypeScript types for three.js | Required for type-safe R3F code |
| postprocessing | 6.39.0 | Peer dep of @react-three/postprocessing | Auto-installed as peer |

[VERIFIED: npm registry 2026-04-08]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-force-3d | react-force-graph (vasturiano) | react-force-graph wraps d3-force-3d/three-forcegraph and easier to set up, but harder to customize node rendering and integrate custom R3F scene elements. Since we need custom InstancedMesh + Bloom, direct integration is cleaner. |
| @react-three/postprocessing Bloom | Custom emissive-only glow | emissive + high emissiveIntensity without Bloom gives glow within toned range; Bloom makes it bleed into surrounding space for the "star" effect. Bloom is worth the ~20% GPU overhead for this visual. |
| drei `<Line>` per edge | Single merged BufferGeometry | Merged geometry has slightly fewer draw calls but is harder to maintain; Line per edge is fine for <500 edges. |

**Installation:**
```bash
pnpm add three @react-three/fiber @react-three/drei d3-force-3d @react-three/postprocessing
pnpm add -D @types/three
```

**Peer dependency compatibility verified:**
- `@react-three/fiber@9.5.0` requires `react >= 19 < 19.3` — project uses React 19.x [VERIFIED: npm peerDependencies]
- `@react-three/drei@10.7.7` requires `react ^19`, `three >= 0.159`, `@react-three/fiber ^9.0.0` [VERIFIED: npm peerDependencies]
- `@react-three/postprocessing@3.0.4` requires `@react-three/fiber ^9.0.0`, `three >= 0.156` [VERIFIED: npm peerDependencies]
- `d3-force-3d@3.0.6` has no peer deps blocking installation [VERIFIED: npm registry]

---

## Architecture Patterns

### Recommended File Structure
```
apps/web/components/graph/
├── knowledge-graph.tsx          # MODIFIED: thin wrapper — dynamic import SolarGraph, "use client"
├── solar-graph.tsx              # NEW: Canvas + full R3F scene, "use client"
├── solar-scene.tsx              # NEW: inner scene (nodes, edges, labels, background)
├── solar-nodes.tsx              # NEW: InstancedMesh for star nodes
├── solar-edges.tsx              # NEW: Line/Segments for constellation edges
├── node-detail-panel.tsx        # KEPT unchanged
├── health-legend.tsx            # KEPT unchanged
├── bridge-toast.tsx             # KEPT unchanged
└── mini-graph-svg.tsx           # KEPT unchanged
```

### Pattern 1: Next.js SSR Guard — Dynamic Import with ssr: false

**What:** Canvas from react-three-fiber uses browser globals (`window`, `WebGLRenderingContext`). Running it in Next.js SSR (Node.js) crashes. The guard is `next/dynamic` with `ssr: false`.

**When to use:** Always, for any component containing `<Canvas>` from R3F.

**Example:**
```typescript
// knowledge-graph.tsx — thin wrapper (replaces the 2D component at same import path)
"use client";
import dynamic from "next/dynamic";
import type { GraphNode, GraphEdge } from "@/actions/graph";

// Dynamically import the actual Canvas component — no SSR
const SolarGraph = dynamic(
  () => import("./solar-graph").then((m) => m.SolarGraph),
  {
    ssr: false,
    loading: () => (
      <div className="relative w-full flex items-center justify-center"
           style={{ height: "calc(100vh - 120px)" }}>
        <p className="text-sm text-[#71717a]">Loading 3D graph...</p>
      </div>
    ),
  }
);

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (nodeId: string) => void;
  highlightNodeId?: string | null;
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return <SolarGraph {...props} />;
}
```

[CITED: community pattern verified via multiple Next.js + R3F discussions, 2025 — MEDIUM confidence from multiple corroborating sources]

**Critical detail:** The `"use client"` directive must be on the wrapper file. The `SolarGraph` itself must also have `"use client"` since it uses hooks. Do NOT put `"use client"` on server components — the dynamic import is the boundary.

**Known issue:** Next.js 15 has a reported edge case where `ssr: false` inside an already-`"use client"` component can sometimes not suppress hydration warnings. The fix is to wrap the dynamic import itself in a client component (which is what this pattern does). [CITED: github.com/vercel/next.js/discussions/72236]

### Pattern 2: Canvas Setup

**What:** The R3F Canvas creates the WebGL context and controls the render loop.

**Example:**
```typescript
// solar-graph.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { SolarScene } from "./solar-scene";

export function SolarGraph({ nodes, edges, onNodeClick, highlightNodeId }: KnowledgeGraphProps) {
  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 120px)", background: "#050510" }}>
      <Canvas
        camera={{ position: [0, 0, 200], fov: 60, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        frameloop="always"   // change to "demand" once OrbitControls settled
      >
        <SolarScene nodes={nodes} edges={edges} onNodeClick={onNodeClick} highlightNodeId={highlightNodeId} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.8}
            luminanceSmoothing={0.9}
            intensity={1.5}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
```

[CITED: r3f.docs.pmnd.rs + react-postprocessing.docs.pmnd.rs — verified 2026-04-08]

**`dpr={[1, 2]}`** — lets R3F pick device pixel ratio between 1 and 2, balancing sharpness vs GPU load. [VERIFIED: R3F docs]

### Pattern 3: d3-force-3d Static Layout

**What:** Run the force simulation synchronously to convergence before first render. Nodes get `x, y, z` positions added in-place. This avoids needing per-frame simulation updates and React re-renders.

**When to use:** Graph data is server-side-fetched, stable for the session — static layout is appropriate and much simpler than live simulation.

**Example:**
```typescript
// inside solar-scene.tsx or a custom hook
import * as d3 from "d3-force-3d";

interface Sim3DNode { id: string; x: number; y: number; z: number; [k: string]: unknown; }

function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): Sim3DNode[] {
  // Deep clone — d3 mutates objects (same lesson learned in 2D graph)
  const simNodes = nodes.map((n) => ({ ...n }));
  const simLinks = edges.map((e) => ({ ...e }));

  const simulation = d3
    .forceSimulation(simNodes, 3)           // numDimensions = 3
    .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(60))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(0, 0, 0))
    .force("collide", d3.forceCollide().radius(12))
    .stop();

  // Tick to convergence — 300 is the default alpha-decay convergence point
  simulation.tick(300);

  return simNodes as Sim3DNode[];
}
```

[CITED: github.com/vasturiano/d3-force-3d/blob/master/README.md — verified 2026-04-08]

**Key API difference from d3-force:** Pass `numDimensions` as second arg to `forceSimulation(nodes, 3)`, OR chain `.numDimensions(3)`. After tick, each node has `.x`, `.y`, `.z`. [VERIFIED: d3-force-3d README]

**`useMemo` pattern:** Wrap `computeLayout()` in `useMemo([nodes, edges])` inside the React component so it only re-runs when graph data changes, not on every render.

### Pattern 4: InstancedMesh for Star Nodes

**What:** A single `instancedMesh` renders all star nodes in one WebGL draw call. Each instance has its own matrix (position + scale) and color set imperatively.

**Why important:** At 250 nodes, 250 individual `<mesh>` components = 250 draw calls. One `instancedMesh` = 1 draw call. On mobile, draw call count is the primary bottleneck.

**Example:**
```typescript
// solar-nodes.tsx
"use client";
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode } from "@/actions/graph";

const NODE_COLORS = {
  healthy:      new THREE.Color("#0d9488"),
  misconception: new THREE.Color("#dc2626"),
  unprobed:     new THREE.Color("#71717a"),
  bridge:       new THREE.Color("#7c3aed"),
} as const;

function getNodeColor(node: GraphNode): THREE.Color {
  if (node.isBridge) return NODE_COLORS.bridge;
  return NODE_COLORS[node.status] ?? NODE_COLORS.unprobed;
}

function getNodeRadius(node: GraphNode): number {
  return Math.min(3 + node.visitCount * 0.8, 10);  // sphere radius in 3D units
}

interface SolarNodesProps {
  layoutNodes: Array<GraphNode & { x: number; y: number; z: number }>;
  onNodeClick: (nodeId: string) => void;
  highlightNodeId?: string | null;
}

export function SolarNodes({ layoutNodes, onNodeClick, highlightNodeId }: SolarNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = new THREE.Object3D();
  const count = layoutNodes.length;

  useEffect(() => {
    if (!meshRef.current) return;
    layoutNodes.forEach((node, i) => {
      const r = getNodeRadius(node);
      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, getNodeColor(node));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [layoutNodes]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      onClick={(e) => {
        e.stopPropagation();
        const node = layoutNodes[e.instanceId!];
        if (node) onNodeClick(node.id);
      }}
    >
      <sphereGeometry args={[1, 16, 16]} />  {/* radius=1, scaled per-instance */}
      <meshStandardMaterial
        vertexColors
        emissive={new THREE.Color(1, 1, 1)}
        emissiveIntensity={0.8}
        toneMapped={false}   // CRITICAL for Bloom to work
        roughness={0.3}
        metalness={0.1}
      />
    </instancedMesh>
  );
}
```

[CITED: r3f.docs.pmnd.rs/advanced/scaling-performance + R3F discussion #761 — verified pattern]

**Critical details:**
1. `toneMapped={false}` is REQUIRED for Bloom to treat emissive values above 1.0 as bright — otherwise tone-mapping clamps them. [VERIFIED: react-postprocessing Bloom docs]
2. `setColorAt` populates `instanceColor` buffer; call `instanceColor.needsUpdate = true` after. [VERIFIED: R3F discussions]
3. `e.instanceId` in onClick gives the array index into `layoutNodes`. [VERIFIED: R3F events docs + discussion #2085]
4. `<sphereGeometry args={[1, 16, 16]} />` uses radius=1; scale is applied per-instance via the matrix.

### Pattern 5: Edge Rendering with drei Line

**What:** Render constellation-style edges between nodes. Each edge is a `<Line>` from `@react-three/drei`.

**Example:**
```typescript
// solar-edges.tsx
import { Line } from "@react-three/drei";

interface SolarEdgesProps {
  layoutNodes: Array<GraphNode & { x: number; y: number; z: number }>;
  edges: GraphEdge[];
}

export function SolarEdges({ layoutNodes, edges }: SolarEdgesProps) {
  const nodeIndex = Object.fromEntries(layoutNodes.map((n, i) => [n.id, i]));

  return (
    <>
      {edges.map((edge, i) => {
        const src = layoutNodes[nodeIndex[edge.source]];
        const tgt = layoutNodes[nodeIndex[edge.target]];
        if (!src || !tgt) return null;
        return (
          <Line
            key={i}
            points={[[src.x, src.y, src.z], [tgt.x, tgt.y, tgt.z]]}
            color="#4a4a8a"
            lineWidth={0.5}
            transparent
            opacity={0.35}
          />
        );
      })}
    </>
  );
}
```

[CITED: drei.docs.pmnd.rs/shapes/line — verified 2026-04-08]

**Performance note:** For 250 edges this is acceptable (250 Line2 draw calls). If edges grow to 500+, batch into a single `<Segments>` component or hand-build a merged LineSegments BufferGeometry. At the expected graph size this is not a bottleneck. [ASSUMED based on three.js draw call guidance; no benchmark for this exact count]

### Pattern 6: Background Star Field

**What:** drei's `<Stars>` component renders a particle-based space background in one draw call.

**Example:**
```typescript
import { Stars } from "@react-three/drei";

// Inside Canvas scene:
<Stars
  radius={300}
  depth={60}
  count={3000}
  factor={4}
  saturation={0}
  fade
  speed={0.3}
/>
```

[VERIFIED: npm community docs + R3F discussion #2972 — Stars props confirmed 2026-04-08]

### Pattern 7: Hover Labels with drei Html

**What:** `<Html>` from drei renders a DOM element at a 3D position. Used for concept name tooltip on hover.

**Performance warning:** Each `<Html>` instance adds a DOM element. Do NOT render all 250 labels simultaneously — only render for the hovered node.

**Example:**
```typescript
import { Html } from "@react-three/drei";

// In SolarScene, track hoveredIndex state
{hoveredNode && (
  <Html
    position={[hoveredNode.x, hoveredNode.y + getNodeRadius(hoveredNode) + 2, hoveredNode.z]}
    center
    distanceFactor={80}
  >
    <div style={{
      background: "#18181b",
      color: "#fff",
      padding: "4px 10px",
      borderRadius: "6px",
      fontSize: "13px",
      whiteSpace: "nowrap",
      pointerEvents: "none",
    }}>
      {hoveredNode.name} · {hoveredNode.visitCount} visit{hoveredNode.visitCount !== 1 ? "s" : ""}
    </div>
  </Html>
)}
```

[CITED: drei.docs.pmnd.rs/misc/html — verified 2026-04-08]

**Key details:** `distanceFactor` scales the HTML element by camera distance so it doesn't get huge when camera is close. `center` applies -50%/-50% transform. High-DPI caveat: width/height must be whole numbers to avoid position jitter. [CITED: drei Html docs + R3F discussion #796]

### Pattern 8: Camera Fly-To on Double-Click

**What:** Smoothly animate camera toward a clicked node. OrbitControls' target must move together with camera position or the orbit center will be wrong.

**Why it's tricky:** OrbitControls continually overwrites camera transform. Animation must update BOTH camera position and the controls target simultaneously.

**Recommended approach:** Use `useFrame` with lerp/damp, or switch to `drei`'s `CameraControls` which has a built-in `setLookAt` animation API. [MEDIUM confidence — camera animation with OrbitControls is a known tricky area]

**Simple lerp approach (useFrame):**
```typescript
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// In scene component:
const targetPosition = useRef(new THREE.Vector3(0, 0, 200));
const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
const { camera } = useThree();

// On double-click of node:
function flyToNode(node: { x: number; y: number; z: number }) {
  targetPosition.current.set(node.x + 30, node.y + 20, node.z + 60);
  targetLookAt.current.set(node.x, node.y, node.z);
}

useFrame(() => {
  camera.position.lerp(targetPosition.current, 0.05);
  // Also update OrbitControls target if using makeDefault
  // state.controls?.target.lerp(targetLookAt.current, 0.05)
});
```

**Better alternative:** Use `CameraControls` from drei instead of `OrbitControls` — it supports `setLookAt(pos, target, enableTransition: true)` for built-in smooth animation. The tradeoff is a slightly larger dependency (`camera-controls` npm package). [CITED: wawasensei.dev/courses/react-three-fiber/lessons/camera-controls — MEDIUM confidence]

### Pattern 9: Bloom Glow for Stars

**What:** Materials with `toneMapped={false}` and `emissiveIntensity > 1` trigger the Bloom pass. The Bloom spreads glow into surrounding space, creating the "glowing star" effect.

**Example material setup:**
```typescript
// Different emissive intensities per node health state
function getEmissiveIntensity(node: GraphNode): number {
  if (node.isBridge) return 2.5;     // brightest — bridge is special
  if (node.status === "healthy") return 2.0;
  if (node.status === "misconception") return 1.8;
  return 1.0;                          // unprobed — dim
}

// Material must have toneMapped={false} and emissiveIntensity > luminanceThreshold
<meshStandardMaterial
  vertexColors       // drives the color from setColorAt
  emissive={new THREE.Color(1, 1, 1)}   // white emissive, tinted by vertex color
  emissiveIntensity={1.5}               // per-node, set via instanceColor intensity indirectly
  toneMapped={false}
/>
```

**Note:** InstancedMesh shares one material for all instances. Per-node emissive intensity requires a custom shader or workaround. A simpler approach: set uniform emissiveIntensity at ~1.5 (all nodes glow), and vary apparent brightness via Bloom's luminanceThreshold. Bridge/healthy nodes use brighter colors that naturally exceed threshold more. [ASSUMED — emissive intensity per-instance requires shader knowledge; recommend uniform intensity to start]

### Anti-Patterns to Avoid

- **Rendering 250 individual `<mesh>` components:** One draw call per mesh = 250 draw calls. Use `<instancedMesh>` instead.
- **All 250 `<Html>` labels rendered simultaneously:** DOM overhead causes 5-15fps drop. Only render label for hovered node.
- **Putting Canvas in a Server Component:** Will crash with `document is not defined`. Must be behind `"use client"` + dynamic `ssr: false`.
- **Forgetting `toneMapped={false}`:** Bloom won't work — tone-mapping clamps emissive values, Bloom threshold never triggers. [VERIFIED: react-postprocessing docs]
- **Not deep-cloning nodes before d3-force-3d:** d3 mutates the objects in-place (adds x/y/z/vx/vy/vz). Same pattern burned the 2D graph — React props would be mutated. [VERIFIED: existing codebase comment "D3 deep-clone nodes+links before forceSimulation"]
- **Running d3-force-3d simulation live in useFrame:** Re-triggering React state on every tick will cause 300 re-renders. Run to convergence with `.stop().tick(300)` before mounting.
- **Using d3's `forceSimulation` from plain `d3` package:** Plain `d3` has no 3D support. Must import from `d3-force-3d`. The API is backwards-compatible but you must import from `d3-force-3d`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Star field background | Custom particle shader | `<Stars>` from drei | drei Stars is optimized Points geometry with fade shader; done in 1 line |
| OrbitControls (drag/zoom/pan/touch) | Custom pointer event handlers | `<OrbitControls>` from drei | Handles all edge cases: touch, momentum damping, min/max polar angle, mobile |
| Bloom glow effect | Custom render target pipeline | `<EffectComposer><Bloom /></EffectComposer>` | Proper multi-pass bloom with mipmap optimization |
| 3D label overlays | CSS absolute positioning math | `<Html>` from drei | Handles 3D→2D projection, occlusion, distanceFactor scaling |
| Raycasting / click detection | Manual THREE.Raycaster | R3F built-in event system | R3F handles raycasting natively; `onClick`, `onPointerOver` just work on any mesh including `instancedMesh` |
| 3D force layout | Custom spring simulation | `d3-force-3d` | Battle-tested Barnes-Hut approximation in 3D; identical API to d3-force the project already knows |
| SSR WebGL suppression | `typeof window !== "undefined"` guards | `next/dynamic` with `ssr: false` | Clean, idiomatic Next.js pattern; avoids runtime guard complexity |

---

## Common Pitfalls

### Pitfall 1: Bloom is Invisible
**What goes wrong:** Stars have color but no glow bleeds into surrounding space. Scene looks flat.
**Why it happens:** Material is using default `toneMapped={true}`, which clamps emissive output to [0,1]. Bloom's luminanceThreshold finds nothing bright enough.
**How to avoid:** Add `toneMapped={false}` to all star materials. Set `emissiveIntensity > 1.0` (1.5-2.5 range).
**Warning signs:** Stars look solid/flat; changing Bloom `intensity` prop has no visible effect.

### Pitfall 2: d3-force-3d Mutations Break React Props
**What goes wrong:** After the first render, node objects have been modified with `x, y, z, vx, vy` properties. On re-render (e.g., parent state change), React passes already-mutated nodes, simulation gets corrupted state, positions are wrong.
**Why it happens:** d3-force-3d mutates node objects in-place.
**How to avoid:** Always deep-clone: `const simNodes = nodes.map(n => ({ ...n }))` before passing to simulation. This is already done in the 2D graph — preserve the pattern.
**Warning signs:** Graph layout shifts on unrelated state changes (panel open/close).

### Pitfall 3: SSR Crash with three.js
**What goes wrong:** Build or page load fails with `ReferenceError: window is not defined` or `WebGLRenderingContext is not defined`.
**Why it happens:** three.js accesses browser APIs at module evaluation time; Next.js evaluates all imports in Node.js during SSR.
**How to avoid:** Wrap `<Canvas>` in a component imported via `next/dynamic({ ssr: false })`. The `"use client"` directive alone is NOT sufficient — it prevents SSR of the component tree, but the module itself still gets evaluated.
**Warning signs:** Error during `next build` or initial page load in production.

### Pitfall 4: InstancedMesh Click Returns Wrong Node
**What goes wrong:** Clicking a star opens the wrong node's detail panel.
**Why it happens:** `e.instanceId` is the index into the instance array, which must match the order of `layoutNodes`. If layoutNodes and the InstancedMesh setup loop use different orderings, they'll be misaligned.
**How to avoid:** Use a single `layoutNodes` array as the source of truth for both the `useEffect` that calls `setMatrixAt(i, ...)` and the `onClick` handler that reads `layoutNodes[e.instanceId!]`.
**Warning signs:** Clicking one star opens a different concept's panel.

### Pitfall 5: Html Labels Cause Frame Rate Drop
**What goes wrong:** Graph renders at 15fps on mobile.
**Why it happens:** Rendering 250 `<Html>` elements adds 250 DOM nodes and forces layout recalculation every frame.
**How to avoid:** Only render label for hovered node. Use `useState<number | null>(null)` for `hoveredInstanceId`, set via `onPointerMove` on the instancedMesh.
**Warning signs:** FPS drops by 30-50% after adding labels.

### Pitfall 6: OrbitControls + Camera Animation Conflict
**What goes wrong:** Camera flies to node but immediately snaps back, or fly-to and orbit fight each other.
**Why it happens:** OrbitControls reads its own saved target/position each frame and overwrites camera. Directly setting `camera.position` via lerp works only if OrbitControls' internal target is also updated.
**How to avoid:** When animating, update both `camera.position` AND `controls.target` in `useFrame`. Access controls via `useThree((s) => s.controls)` when `makeDefault` is set. Alternatively use `CameraControls` from drei which has a proper animation API.
**Warning signs:** Camera snaps back after fly-to, or smooth animation is interrupted by orbit drag.

### Pitfall 7: `d3-force-3d` Type Conflicts with `d3` Package
**What goes wrong:** TypeScript errors because project already has `d3` (v7) and `@types/d3` installed; importing `d3-force-3d` conflicts.
**Why it happens:** `d3-force-3d` is a standalone module, not part of the `d3` bundle. They can coexist. Import specifically from `d3-force-3d`, not from `d3`.
**How to avoid:** `import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force-3d";` — never `import * as d3 from "d3-force-3d"` in files that also import from `d3`.
**Warning signs:** TypeScript errors about duplicate declarations or version mismatches.

---

## Code Examples

### Complete minimal working scene
```typescript
// Source: pattern derived from r3f.docs.pmnd.rs + drei.docs.pmnd.rs
"use client";
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense } from "react";

export function SolarGraph({ nodes, edges, onNodeClick }: SolarGraphProps) {
  return (
    <div style={{ width: "100%", height: "calc(100vh - 120px)", background: "#050510" }}>
      <Canvas
        camera={{ position: [0, 0, 200], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.1} />
        <Stars radius={300} depth={60} count={3000} factor={4} saturation={0} fade />
        <Suspense fallback={null}>
          <SolarScene nodes={nodes} edges={edges} onNodeClick={onNodeClick} />
        </Suspense>
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.8} intensity={1.5} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
```

### d3-force-3d layout computation
```typescript
// Source: github.com/vasturiano/d3-force-3d README
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force-3d";

export function compute3DLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Array<GraphNode & { x: number; y: number; z: number }> {
  const simNodes = nodes.map((n) => ({ ...n }));  // Deep clone — d3 mutates
  const simLinks = edges.map((e) => ({ ...e }));

  forceSimulation(simNodes, 3)
    .force("link", forceLink(simLinks).id((d: any) => d.id).distance(60))
    .force("charge", forceManyBody().strength(-180))
    .force("center", forceCenter(0, 0, 0))
    .force("collide", forceCollide().radius(14))
    .stop()
    .tick(300);

  return simNodes as Array<GraphNode & { x: number; y: number; z: number }>;
}
```

### InstancedMesh setup and click handling
```typescript
// Source: r3f.docs.pmnd.rs/advanced/scaling-performance
const meshRef = useRef<THREE.InstancedMesh>(null!);
const dummy = useMemo(() => new THREE.Object3D(), []);

useEffect(() => {
  layoutNodes.forEach((node, i) => {
    dummy.position.set(node.x, node.y, node.z);
    dummy.scale.setScalar(getNodeRadius(node));
    dummy.updateMatrix();
    meshRef.current.setMatrixAt(i, dummy.matrix);
    meshRef.current.setColorAt(i, getNodeColor(node));
  });
  meshRef.current.instanceMatrix.needsUpdate = true;
  if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
}, [layoutNodes]);

// In JSX:
<instancedMesh
  ref={meshRef}
  args={[undefined, undefined, layoutNodes.length]}
  onClick={(e) => onNodeClick(layoutNodes[e.instanceId!].id)}
  onPointerOver={(e) => setHoveredIdx(e.instanceId ?? null)}
  onPointerOut={() => setHoveredIdx(null)}
>
  <sphereGeometry args={[1, 16, 16]} />
  <meshStandardMaterial vertexColors emissiveIntensity={1.8} toneMapped={false} />
</instancedMesh>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three.js v0.1xx with manual imports | Three.js 0.183 — tree-shakeable, ESM | Ongoing | No change needed; R3F handles imports |
| @react-three/fiber v8 (React 18) | v9 (React 19) | Dec 2025 | This project uses React 19 — v9 is correct |
| @react-three/drei v9 | v10 (matches fiber v9) | 2025 | Must match fiber version; v10 required |
| Bloom via UnrealBloomPass directly | @react-three/postprocessing EffectComposer | ~2021 | Simpler API, merged passes, better perf |
| Individual mesh per node | InstancedMesh | Three.js best practice | Required for 250+ nodes at 60fps |

**Deprecated/outdated:**
- `@react-three/fiber` v8 with React 18: Do not use — project is React 19, v8 is incompatible
- `drei` v9: Requires fiber v8; do not mix versions
- `BoxBufferGeometry` / `SphereBufferGeometry`: Renamed to `BoxGeometry` / `SphereGeometry` in three.js r125; avoid the `Buffer` suffix forms

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rendering 250 edges as individual `<Line>` components is acceptable performance at typical graph sizes | Architecture Patterns (Pattern 5) | If edges exceed ~500, may need to batch into `<Segments>` or merged BufferGeometry |
| A2 | Uniform `emissiveIntensity` on InstancedMesh material is sufficient for visual differentiation; per-instance emissive requires custom shader | Pattern 4 (InstancedMesh) | Bridge nodes may not look visually distinct enough; fix: use SelectiveBloom on bridge nodes, or increase their sphere scale more aggressively |
| A3 | `CameraControls` from drei is the better choice for fly-to animation vs OrbitControls + lerp | Pattern 8 (Camera) | If CameraControls adds unexpected complexity, lerp-in-useFrame with OrbitControls target update is viable fallback |
| A4 | Static layout (tick to convergence before render) looks good for this graph's structure | Pattern 3 (d3-force-3d) | If layout quality is poor, may need live simulation or pre-warming with more ticks (600+) |

---

## Open Questions

1. **InstancedMesh emissive color per-instance**
   - What we know: `setColorAt` sets vertex color per instance; material uses `vertexColors: true` and `emissive: white`. The actual visible color is the product of `emissiveIntensity * vertexColor`.
   - What's unclear: Whether the Bloom luminance threshold applies correctly when emissive color is white-tinted by vertexColor at emissiveIntensity 1.5. Some nodes may not glow as expected.
   - Recommendation: Test empirically. If glow doesn't work per-instance, use `SelectiveBloom` from `@react-three/postprocessing` which targets specific mesh refs, OR render bridge nodes as a separate non-instanced glowing `<mesh>` on top of the main InstancedMesh.

2. **d3-force-3d TypeScript types**
   - What we know: `d3-force-3d` ships its own types. Peer `d3` package v7 is also installed with `@types/d3`.
   - What's unclear: Whether there are namespace conflicts between `d3-force-3d` types and `@types/d3` force types when imported in the same file.
   - Recommendation: Import exclusively from `d3-force-3d` in the layout file; never mix with `d3` imports in the same file. Use explicit named imports to avoid namespace collisions.

3. **Mobile WebGL context limits**
   - What we know: iOS Safari and Android Chrome limit WebGL contexts per page; if multiple canvases exist, some may be skipped.
   - What's unclear: Whether the existing app has any other Canvas/WebGL usage that would conflict.
   - Recommendation: The graph page has only one Canvas — low risk. But verify with iOS testing post-implementation.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | Available | v24.13.0 | — |
| pnpm | Package install | Available | (via pnpm in monorepo) | — |
| WebGL (browser) | three.js / R3F | Available on target browsers | WebGL2 on Chrome/Firefox/Safari/Edge | None — WebGL is required |
| @react-three/fiber | Not yet installed | Not installed | — | — |
| @react-three/drei | Not yet installed | Not installed | — | — |
| three | Not yet installed | Not installed | — | — |
| d3-force-3d | Not yet installed | Not installed | — | — |
| @react-three/postprocessing | Not yet installed | Not installed | — | — |

[VERIFIED: apps/web/package.json — none of the 3D packages are currently installed]

**Wave 0 task:** Install all 5 packages before any component work.

---

## Validation Architecture

> nyquist_validation is enabled (not false in config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework detected in apps/web |
| Config file | None found |
| Quick run command | N/A — no tests exist for this phase |
| Full suite command | N/A |

### Phase Requirements → Test Map

This phase is a pure visual/rendering replacement. Automated unit tests for WebGL rendering are impractical (require browser context). The validation strategy is smoke-test / visual:

| Behavior | Test Type | How to Verify |
|----------|-----------|---------------|
| 3D graph renders without SSR crash | Manual smoke | `next build` succeeds + page loads in browser |
| 250 nodes render as instanced spheres | Manual visual | Check browser devtools Renderer panel: draw calls ~5 |
| Click node → side panel opens | Manual interaction | Click any sphere → NodeDetailPanel appears with correct concept |
| Force layout distributes nodes in 3D | Manual visual | Nodes spread in 3D space, not collapsed to plane |
| Bloom glow visible on stars | Manual visual | Stars have visible glow corona, not flat circles |
| Star background renders | Manual visual | Dark space background with particle stars |
| OrbitControls works on mobile | Manual touch | Pinch zoom, drag orbit on iOS/Android |
| Old 2D graph import path unchanged | Integration | `knowledge-graph.tsx` export name `KnowledgeGraph` unchanged; `graph-page-client.tsx` requires no import change |

### Wave 0 Gaps
- [ ] Install packages: `pnpm add three @react-three/fiber @react-three/drei d3-force-3d @react-three/postprocessing && pnpm add -D @types/three`
- [ ] No test files to create (visual rendering phase)

---

## Security Domain

> security_enforcement not explicitly disabled — applying baseline review.

### Applicable ASVS Categories

| ASVS Category | Applies | Assessment |
|---------------|---------|------------|
| V2 Authentication | No — pure rendering; no auth changes | N/A |
| V3 Session Management | No | N/A |
| V4 Access Control | No — data still flows through existing `getGraphData()` server action | No change |
| V5 Input Validation | Low risk | Node IDs passed to `onNodeClick()` come from the server-fetched node array, not user input |
| V6 Cryptography | No | N/A |

**Security verdict:** This phase is a rendering replacement. The data layer (`getGraphData()`, `getNodeDetails()`) is unchanged and already validated. The only new user interaction is clicking/hovering 3D nodes; node IDs are derived from the server-side dataset, not constructed from user input. No new security surface introduced. [ASSUMED — no new API routes, no new data flows]

---

## Sources

### Primary (HIGH confidence)
- npm registry (2026-04-08) — all package versions and peer dependencies verified
- [r3f.docs.pmnd.rs](https://r3f.docs.pmnd.rs/getting-started/introduction) — Canvas setup, useFrame, instancing, frameloop
- [r3f.docs.pmnd.rs/advanced/scaling-performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) — InstancedMesh, performance patterns
- [react-postprocessing.docs.pmnd.rs/effects/bloom](https://react-postprocessing.docs.pmnd.rs/effects/bloom) — Bloom API, toneMapped requirement
- [github.com/vasturiano/d3-force-3d](https://github.com/vasturiano/d3-force-3d/blob/master/README.md) — numDimensions, static layout tick pattern
- [drei.docs.pmnd.rs/misc/html](https://drei.docs.pmnd.rs/misc/html) — Html props, occlusion, distanceFactor
- [drei.docs.pmnd.rs/shapes/line](https://drei.docs.pmnd.rs/shapes/line) — Line props, points format, lineWidth
- [drei.docs.pmnd.rs/controls/introduction](https://drei.docs.pmnd.rs/controls/introduction) — OrbitControls makeDefault, controls store
- Existing codebase: `apps/web/components/graph/knowledge-graph.tsx` — 2D implementation patterns to preserve

### Secondary (MEDIUM confidence)
- WebSearch: Next.js 15 + R3F SSR pattern — multiple sources agree on `next/dynamic ssr: false`
- WebSearch: OrbitControls + camera animation conflict — community discussions corroborate lerp approach
- WebSearch: drei Stars props — multiple tutorial sources agree on radius/depth/count/factor/saturation/fade API
- [github.com/pmndrs/react-postprocessing](https://github.com/pmndrs/react-postprocessing) — EffectComposer + Bloom minimal example

### Tertiary (LOW confidence)
- Performance of 250 `<Line>` edges — no direct benchmark found; extrapolated from three.js draw call guidance
- Per-instance emissive intensity behavior — not directly documented; inferred from material + bloom interaction

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions npm-verified, peer deps checked
- Architecture: HIGH — SSR pattern, InstancedMesh, d3-force-3d API verified from official docs
- Pitfalls: HIGH — most derived from existing codebase learnings + verified R3F docs
- Performance at 250 nodes: MEDIUM — InstancedMesh principle verified; exact mobile numbers unverified
- Camera fly-to: MEDIUM — multiple approaches documented; best one needs validation

**Research date:** 2026-04-08
**Valid until:** 2026-07-08 (90 days — R3F v9 is recent/stable; drei v10 is current major)
