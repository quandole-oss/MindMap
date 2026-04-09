# Phase 7: 3D Solar System Knowledge Graph - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing 2D D3.js SVG knowledge graph with an immersive 3D visualization using three.js / react-three-fiber. Concept nodes appear as glowing stars in a solar system-like space environment. Students navigate through 3D space to explore their knowledge. Edges appear as light connections between stars. Node health states are represented by star color/glow. The side panel detail view and all existing graph functionality must be preserved.

</domain>

<decisions>
## Implementation Decisions

### 3D Engine & Library
- Use react-three-fiber (@react-three/fiber) + @react-three/drei for three.js integration in React
- 3D force simulation via d3-force-3d (extends d3-force to 3 dimensions)
- Canvas-based WebGL rendering (not SVG) — handles hundreds of nodes smoothly

### Visual Design — Solar System Metaphor
- Nodes rendered as glowing spheres (stars) with point lights
- Node size scales with visitCount (same formula as 2D but as sphere radius)
- Node health state colors become star glow colors: teal (healthy), coral (misconception), gray (unprobed), purple (bridge)
- Edges rendered as thin glowing lines connecting stars (like constellation lines)
- Space background: dark with subtle star field particle system
- Camera orbits around the graph center — students feel like they're floating through space

### Navigation & Interaction
- OrbitControls for rotate/zoom/pan (mouse drag + scroll)
- Click a star node → same side panel opens with question history (Sheet component)
- Hover a star → label appears with concept name + visit count
- Double-click to fly-to/focus on a specific node (smooth camera animation)
- Mobile: touch gestures for orbit/zoom

### Performance
- Instanced meshes for nodes (single draw call for all stars)
- LOD (level of detail): distant nodes render as simple points, close nodes as detailed spheres
- Same ~250 node mobile target as 2D version

### Claude's Discretion
- Specific star/glow shader or material (MeshStandardMaterial with emissive vs custom shader)
- Particle system density for background stars
- Camera animation easing
- Bloom/glow post-processing approach (drei's Bloom vs custom)
- Force simulation parameters for 3D layout

</decisions>

<code_context>
## Existing Code Insights

### Files to Replace/Modify
- `apps/web/components/graph/knowledge-graph.tsx` — REPLACE: 2D D3 SVG → 3D three.js Canvas
- `apps/web/app/student/graph/graph-page-client.tsx` — MODIFY: wire new 3D component
- `apps/web/components/graph/health-legend.tsx` — KEEP: still shows 4 health state colors
- `apps/web/components/graph/node-detail-panel.tsx` — KEEP: side panel unchanged
- `apps/web/actions/graph.ts` — KEEP: same data structure (nodes + edges)

### Reusable Assets
- getGraphData() server action returns { nodes: [], edges: [] } — same data feeds 3D
- Node health colors already defined as CSS custom properties
- Sheet side panel for node details
- Bridge detection + toast notification

### Integration Points
- Replace KnowledgeGraph component import in graph-page-client.tsx
- Install @react-three/fiber, @react-three/drei, three, d3-force-3d
- Keep existing node click → panel open flow
- Keep existing highlight/pulse for bridge nodes

</code_context>

<specifics>
## Specific Ideas

- Star glow effect: emissive material + optional Bloom post-processing from @react-three/postprocessing
- Background: drei's Stars component for instant star field
- Node labels: drei's Html component overlays text labels in 3D space
- Edges: drei's Line component with thin glowing material
- Force layout: d3-force-3d with forceCenter, forceManyBody, forceLink in 3D
- Camera fly-to: drei's useCamera or manual lerp on click

</specifics>

<deferred>
## Deferred Ideas

- VR/AR support (WebXR) — future enhancement
- Sound effects for navigation — not in scope
- Animated particle trails along edges — polish later

</deferred>
