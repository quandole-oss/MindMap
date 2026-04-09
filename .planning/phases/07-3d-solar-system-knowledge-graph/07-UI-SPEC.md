---
phase: 7
phase_name: 3D Solar System Knowledge Graph
status: draft
created: 2026-04-08
design_system: shadcn/ui (base-nova, Tailwind v4, cssVariables)
---

# UI-SPEC: Phase 7 — 3D Solar System Knowledge Graph

Visual and interaction contract for replacing the 2D D3.js SVG knowledge graph with an immersive 3D WebGL solar system visualization using react-three-fiber.

---

## 1. Design System

**Tool:** shadcn/ui (base-nova style, Tailwind v4, CSS variables)
**Config:** `apps/web/components.json` — `style: base-nova`, `baseColor: neutral`, `cssVariables: true`
**Icon library:** Lucide React (existing)
**Registry:** shadcn official only — no third-party registries declared; safety gate not applicable

Source: `apps/web/components.json` + `apps/web/app/globals.css`

---

## 2. Spacing Scale

8-point scale applies to all UI chrome surrounding the canvas. The WebGL canvas itself uses 3D units (not CSS pixels) for node layout.

| Step | Value | Use in this phase |
|------|-------|-------------------|
| xs   | 4px   | Icon gap, legend dot spacing |
| sm   | 8px   | Tooltip padding, legend item gap |
| md   | 16px  | Canvas overlay button positioning (top: 16px, right: 16px) |
| lg   | 24px  | Page header vertical padding |
| xl   | 32px  | — |
| 2xl  | 48px  | — |
| 3xl  | 64px  | — |

**Touch targets:** All overlay buttons (reset zoom, fullscreen) minimum 44x44px — matches existing 2D graph button at `width: 44px; height: 44px`.

**Canvas height:** `calc(100vh - 120px)` — identical to existing 2D graph container. Do not change.

Source: existing `knowledge-graph.tsx` overlay button styles; confirmed by 2D precedent.

---

## 3. Typography

Three sizes, two weights. No changes from the existing graph UI chrome.

| Role | Size | Weight | Line-height | Use |
|------|------|--------|-------------|-----|
| Node label (3D Html overlay) | 12px | 400 | 1.4 | Concept name rendered via drei Html |
| Tooltip body | 14px | 400 | 1.4 | Hover label: name + visit count |
| Legend label | 14px | 400 | 1.5 | Health state legend items |

**Font family:** `Inter, ui-sans-serif, system-ui, sans-serif` — matches existing tooltip and label styles in `knowledge-graph.tsx`.

**Node labels in 3D space:**
- Rendered via `@react-three/drei` `<Html>` component
- Font: 12px / weight 400 / color `#ffffff` with `text-shadow: 0 1px 3px rgba(0,0,0,0.8)` for legibility against dark space background
- Hidden when node is farther than 150 3D units from camera (LOD cutoff)
- Appear on hover (`onPointerOver`) only — not always-visible, to reduce clutter at scale

Source: existing `knowledge-graph.tsx` label styles; CONTEXT.md decision on hover-reveal labels.

---

## 4. Color Contract

### 4.1 App Shell (60/30/10)

The app shell surrounding the canvas is unchanged from the existing student graph page.

| Role | Value | Coverage |
|------|-------|----------|
| Dominant background | `oklch(1 0 0)` (`--background`) | Sidebar, page chrome |
| Secondary surface | `oklch(0.985 0 0)` (`--sidebar`) | Sidebar panel |
| Accent | `oklch(0.205 0 0)` (`--primary`) | Active nav items, CTA buttons |

Source: `apps/web/app/globals.css` CSS custom properties.

### 4.2 Canvas Background (3D Scene)

| Element | Value | Rationale |
|---------|-------|-----------|
| Canvas background | `#050510` (near-black deep navy) | Space environment; not pure black to avoid crushing shadow detail |
| Ambient light | `#1a1a2e` at intensity 0.3 | Subtle cool fill; prevents unlit sides going full black |
| Background star field | `#ffffff` particles at opacity 0.6–0.9 | `@react-three/drei` Stars component; random brightness variation |

Source: CONTEXT.md "space background: dark"; RESEARCH.md canvas background `#050510`.

### 4.3 Node Health State Colors (Star Glow)

**Locked by CONTEXT.md and existing CSS custom properties in globals.css.**

| Health State | Hex | CSS Custom Property | THREE.Color |
|-------------|-----|--------------------|----|
| Healthy (understood) | `#0d9488` | `--color-healthy` | `new THREE.Color("#0d9488")` |
| Misconception (needs review) | `#dc2626` | `--color-misconception` | `new THREE.Color("#dc2626")` |
| Unprobed (not yet explored) | `#71717a` | `--color-unprobed` | `new THREE.Color("#71717a")` |
| Bridge (connects topics) | `#7c3aed` | `--color-bridge` | `new THREE.Color("#7c3aed")` |

These are the ONLY node colors. No additional states in this phase.

**WCAG note:** These four colors were audited and confirmed WCAG AA compliant in Phase 6 (06-04). The legend labels ("Understood", "Needs review", "Not yet explored", "Connects topics") are unchanged in `health-legend.tsx`.

### 4.4 Edge Colors (Constellation Lines)

| Edge Type | Color | Opacity | Thickness |
|-----------|-------|---------|-----------|
| `curiosity_link` (default) | `#6b7280` | 0.25 | 1px |
| `bridge` | `#7c3aed` | 0.5 | 1.5px |
| `misconception_cluster` | `#dc2626` | 0.4 | 1px |

Source: existing `getEdgeColor()` in `knowledge-graph.tsx`, adapted for 3D Line component.

### 4.5 Accent Reserved-For List

The purple `#7c3aed` accent is reserved exclusively for:
1. Bridge node star glow color
2. Bridge-type constellation edges
3. Bridge pulse animation ring (see Section 7.3)
4. Sidebar "Connects topics" legend dot

No other UI element uses this purple in Phase 7.

---

## 5. Node Visual Specification

### 5.1 Geometry

| Property | Value | Source |
|----------|-------|--------|
| Geometry | `SphereGeometry(1, 16, 16)` — radius 1, scaled per instance | RESEARCH.md Pattern 4 |
| Rendering | `InstancedMesh` — single draw call for all nodes | RESEARCH.md; CONTEXT.md decision |
| Material | `MeshStandardMaterial` with `vertexColors`, `emissive`, `toneMapped: false` | RESEARCH.md; `toneMapped: false` required for Bloom |
| Emissive | `new THREE.Color(1, 1, 1)` at `emissiveIntensity: 0.8` | RESEARCH.md Pattern 4 |
| Roughness | 0.3 | RESEARCH.md Pattern 4 |
| Metalness | 0.1 | RESEARCH.md Pattern 4 |

### 5.2 Node Size Formula

```
sphereRadius = Math.min(3 + visitCount * 0.8, 10)
```

Minimum radius: 3 (unvisited). Maximum radius: 10 (capped at ~9 visits). Applied as per-instance scale via `Object3D.scale.setScalar(radius)`.

Source: CONTEXT.md "node size scales with visitCount (same formula as 2D but as sphere radius)"; RESEARCH.md `getNodeRadius()`.

### 5.3 LOD (Level of Detail)

| Distance from camera | Render mode |
|---------------------|------------|
| 0–150 units | Full sphere geometry (16-segment, emissive, Bloom-eligible) |
| 150+ units | Simple point sprite — `Points` geometry at fixed 2px size in node color |

Label visibility also cuts off at 150 units (drei Html hidden beyond threshold).

Source: CONTEXT.md "LOD: distant nodes render as simple points, close nodes as detailed spheres".

---

## 6. Edge Visual Specification

| Property | Value |
|----------|-------|
| Component | `@react-three/drei` `<Line>` |
| Points | `[srcPosition, tgtPosition]` as `Vector3` tuples |
| Thickness | See Section 4.4 |
| Line cap | `round` (THREE.Line2 default) |
| Dashed | No — solid constellation lines |

Edges are rendered after nodes (z-order: edges behind nodes in 3D space via render order).

---

## 7. Interaction Contract

### 7.1 Camera & Navigation

| Interaction | Behavior | Implementation |
|-------------|----------|---------------|
| Mouse drag | Rotate around graph center | `@react-three/drei` `<OrbitControls makeDefault enableDamping dampingFactor={0.05} />` |
| Scroll wheel | Zoom in/out | OrbitControls default |
| Two-finger pinch (mobile) | Zoom in/out | OrbitControls default touch handling |
| One-finger drag (mobile) | Rotate | OrbitControls default touch handling |
| Initial camera position | `[0, 0, 200]`, fov 60 | RESEARCH.md Canvas setup |

**Camera limits:** No hard min/max distance — OrbitControls default. The space metaphor benefits from free exploration.

**Reset button:** Positioned at `top: 16px; right: 16px` within the canvas wrapper div. 44x44px button with Lucide `Maximize2` icon (16px). Clicking resets camera to initial position `[0, 0, 200]` via a smooth lerp animation over 600ms.

Source: CONTEXT.md "OrbitControls for rotate/zoom/pan"; RESEARCH.md Canvas setup; existing 2D reset button pattern.

### 7.2 Node Click (Open Side Panel)

| Trigger | Effect |
|---------|--------|
| Single click on star node | Opens `NodeDetailPanel` Sheet component with concept details |
| Implementation | `onClick` on `instancedMesh`; `event.instanceId` maps to `layoutNodes[instanceId]` |
| Side panel | `NodeDetailPanel` component — unchanged from Phase 3 |
| State management | `useState<string | null>(selectedNodeId)` in `GraphPageClient` — unchanged |

Source: CONTEXT.md "click a star node → same side panel opens"; existing `GraphPageClient` state pattern.

### 7.3 Bridge Node Pulse Highlight

When `highlightNodeId` prop is set (from BridgeToast "Explore" click):

- The target star pulses with a Bloom-intensified purple ring
- Animation: increase `emissiveIntensity` from 0.8 to 3.0 and back, 3 cycles, 500ms per cycle (1.5s total)
- Uses `useFrame` + `useRef` to track animated instance without React re-renders
- After 1.5s, `emissiveIntensity` returns to 0.8; `GraphPageClient` clears `highlightNodeId`

Source: existing bridge pulse in 2D (`animate-bridge-pulse`, 500ms × 3 cycles, 1.5s total); CONTEXT.md "keep existing highlight/pulse for bridge nodes".

### 7.4 Hover Label

| Trigger | Behavior |
|---------|----------|
| `onPointerOver` on InstancedMesh instance | Show drei `<Html>` label near node position |
| Label content | `"{concept name} · {visitCount} visit(s)"` |
| Label style | 12px / white / `bg-black/70 rounded px-2 py-1` (Tailwind) |
| `onPointerOut` | Hide label |
| Delay | 150ms debounce before showing (avoids flicker during fast traversal) |

Source: CONTEXT.md "hover a star → label appears with concept name + visit count"; existing tooltip content from `knowledge-graph.tsx`.

### 7.5 Double-Click Fly-To

| Trigger | Behavior |
|---------|----------|
| Double-click on star node | Camera smoothly animates to face that node at distance 40 units |
| Animation | Linear lerp over 800ms using `useFrame` + `useRef` target position |
| After animation | OrbitControls target updates to node position so subsequent orbit centers on it |

Source: CONTEXT.md "double-click to fly-to/focus on a specific node (smooth camera animation)".

### 7.6 Empty State

When `nodes.length === 0`:

The Canvas does not render. Instead, show a centered message within the canvas wrapper div:

```
Your knowledge universe is empty.
Ask your first curiosity question to plant a star.
```

- Font: 16px / weight 400 / color `#71717a` (`--muted-foreground`)
- Canvas background `#050510` still shown (the dark space creates atmosphere)
- No graph, no legend, no reset button

Source: empty state copy decided here (no prior spec); consistent with existing empty states in the app.

### 7.7 Loading State

During SSR guard / dynamic import resolution (`ssr: false` + `next/dynamic`):

```
Loading 3D graph...
```

- Font: 14px / weight 400 / color `#71717a`
- Positioned at center of canvas wrapper div
- Canvas wrapper at full height `calc(100vh - 120px)` with background `#050510`

Source: RESEARCH.md Pattern 1 loading fallback.

---

## 8. Post-Processing

| Effect | Config | Rationale |
|--------|--------|-----------|
| Bloom | `luminanceThreshold: 0.8`, `luminanceSmoothing: 0.9`, `intensity: 1.5`, `mipmapBlur: true` | Star glow bleeding into surrounding space; only activates on emissive values above threshold |
| Implementation | `<EffectComposer><Bloom /></EffectComposer>` from `@react-three/postprocessing` inside Canvas | RESEARCH.md Pattern 2 |

No other post-processing effects in this phase. No vignette, no depth-of-field, no color grading.

**Performance note:** Bloom adds ~20% GPU overhead (acceptable per RESEARCH.md). `dpr={[1, 2]}` on Canvas limits resolution scaling on high-DPI mobile to prevent GPU overload.

---

## 9. Background Star Field

| Property | Value |
|----------|-------|
| Component | `@react-three/drei` `<Stars>` |
| Count | 2000 particles |
| Radius | 400 3D units (beyond the graph cluster) |
| Depth | 100 (star distribution depth) |
| Factor | 4 (point size multiplier) |
| Saturation | 0 (white stars, no color tint) |
| Fade | true (edge fade to avoid hard cutoff) |

Source: CONTEXT.md "space background: dark with subtle star field particle system"; RESEARCH.md "drei's Stars component for instant star field"; density left to Claude's discretion per CONTEXT.md.

---

## 10. Copywriting Contract

| Element | Copy |
|---------|------|
| Page title | "My Knowledge Universe" (replaces "My Knowledge Graph") |
| Page subtitle / description | "Your concepts as stars in space. Click any star to explore it." |
| Empty state headline | "Your knowledge universe is empty." |
| Empty state body | "Ask your first curiosity question to plant a star." |
| Loading state | "Loading 3D graph..." |
| Canvas aria-label | `"3D knowledge graph showing {n} concept{s}"` |
| Reset camera button aria-label | "Reset camera view" |
| Node hover label format | `"{name} · {n} visit"` / `"{name} · {n} visits"` |
| Health legend labels | Unchanged: "Understood", "Needs review", "Not yet explored", "Connects topics" |
| Bridge toast | Unchanged from Phase 3 |

**No destructive actions in this phase.** No confirmations required.

Source: page title/subtitle decided here (enhancement phase copywriting); all other copy preserved from existing components.

---

## 11. Accessibility Contract

| Requirement | Implementation |
|-------------|---------------|
| Canvas fallback | `<Canvas>` wraps a `<CanvasText>` fallback (aria-hidden canvas; separate accessible list of nodes below fold) — OR — `aria-label` on the canvas wrapper div describing node count |
| Keyboard navigation | Not applicable to WebGL canvas (pointer-only interaction); `NodeDetailPanel` Sheet retains full keyboard focus management |
| `prefers-reduced-motion` | If `window.matchMedia('(prefers-reduced-motion: reduce)').matches`: disable Bloom, disable OrbitControls damping, skip fly-to animation (instant position set), skip bridge pulse animation |
| Color not sole indicator | Health state communicated via node aria-label in accessible list AND legend — not color alone |
| WCAG AA colors | All four health state colors confirmed compliant from Phase 6 audit |
| Touch target (overlay buttons) | 44x44px minimum for reset camera button |

---

## 12. Component Inventory

| Component | File | Action | Notes |
|-----------|------|--------|-------|
| `KnowledgeGraph` | `apps/web/components/graph/knowledge-graph.tsx` | REPLACE | Thin wrapper with `next/dynamic` + `ssr: false` |
| `SolarGraph` | `apps/web/components/graph/solar-graph.tsx` | CREATE | Canvas + OrbitControls + EffectComposer |
| `SolarScene` | `apps/web/components/graph/solar-scene.tsx` | CREATE | Inner scene: nodes, edges, labels, Stars background |
| `SolarNodes` | `apps/web/components/graph/solar-nodes.tsx` | CREATE | InstancedMesh star nodes |
| `SolarEdges` | `apps/web/components/graph/solar-edges.tsx` | CREATE | `<Line>` constellation edges |
| `NodeDetailPanel` | `apps/web/components/graph/node-detail-panel.tsx` | KEEP | Unchanged |
| `HealthLegend` | `apps/web/components/graph/health-legend.tsx` | KEEP | Unchanged — same 4 health states |
| `BridgeToast` | `apps/web/components/graph/bridge-toast.tsx` | KEEP | Unchanged |
| `GraphPageClient` | `apps/web/app/student/graph/graph-page-client.tsx` | MODIFY | Update import of KnowledgeGraph; title copy update |
| `graph.ts` (server action) | `apps/web/actions/graph.ts` | KEEP | Same `getGraphData()` → `{ nodes, edges }` |

---

## 13. 3D Layout Parameters

Force simulation runs synchronously to convergence before first render (static layout — no live simulation updates).

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Simulation dimensions | 3 | `forceSimulation(nodes, 3)` |
| Link distance | 60 3D units | Looser than 2D (80px) to reduce edge overlap in 3D |
| Many-body strength | -200 | Stronger repulsion than 2D (-120) to spread nodes in 3D volume |
| Collision radius | 12 3D units | Prevents node overlap |
| Center force | `forceCenter(0, 0, 0)` | Graph centered at world origin |
| Tick count | 300 | Standard alpha-decay convergence |

Source: RESEARCH.md Pattern 3; values in Claude's discretion per CONTEXT.md.

---

## 14. Package Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-three/fiber` | 9.5.0 | React renderer for three.js |
| `@react-three/drei` | 10.7.7 | Stars, Html, Line, OrbitControls |
| `three` | 0.183.2 | WebGL 3D engine |
| `d3-force-3d` | 3.0.6 | 3D force layout |
| `@react-three/postprocessing` | 3.0.4 | Bloom effect |
| `@types/three` | 0.183.1 | TypeScript types (dev) |

Source: RESEARCH.md Standard Stack (all versions npm-verified 2026-04-08).

---

## 15. Pre-Population Sources

| Field | Source |
|-------|--------|
| Health state colors | `apps/web/app/globals.css` CSS custom properties |
| Health legend labels | `apps/web/components/graph/health-legend.tsx` |
| Canvas container height | `apps/web/components/graph/knowledge-graph.tsx` |
| Node size formula | CONTEXT.md + RESEARCH.md Pattern 4 |
| Node interaction (click/hover/double-click) | CONTEXT.md decisions |
| Bloom configuration | RESEARCH.md Pattern 2 |
| Force parameters | RESEARCH.md Pattern 3 |
| File structure | RESEARCH.md recommended file structure |
| Package versions | RESEARCH.md Standard Stack |
| Deferred items (VR, sound, particle trails) | CONTEXT.md deferred section — not in this spec |

---

*UI-SPEC created: 2026-04-08*
*Status: draft — awaiting gsd-ui-checker validation*
