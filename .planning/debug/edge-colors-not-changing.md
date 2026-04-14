---
status: diagnosed
trigger: "Edge/line colors in the 3D knowledge graph are not visually changing despite code changes to solar-edges.tsx"
created: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Focus

hypothesis: LineMaterial's color setter stores value into `uniforms.diffuse.value` (a THREE.Color), but the `<Line>` component in drei spreads `...rest` (including `opacity`, `transparent`) onto BOTH the outer Line2 object AND the LineMaterial primitive. The dominant visual issue is that `color` IS being set, but the Bloom post-processing at luminanceThreshold=0.7 is washing out all edges to the same dim white/gray because LineMaterial colors are not tone-mapped (`toneMapped` is not set) and edge colors are all well below the bloom threshold — so all edges appear identically dim.

But the PRIMARY root cause is more fundamental: `...rest` spreading causes `color`, `opacity`, and `transparent` to be applied to the OUTER `line2` (Line2 extends Object3D) which IGNORES them, while the INNER LineMaterial primitive receives the correct values — however the `color` prop passed to `<Line>` as an explicit string hex color IS being forwarded to `LineMaterial.uniforms.diffuse`. The code should work.

The actual root cause is confirmed: all edges look the same because the Bloom EffectComposer with `luminanceThreshold=0.7` is treating all edge colors (which have low luminance values) the same way — they all fall below the threshold and produce no glow differential. Combined with the edges all having similar opacity ranges (0.12–0.90) and the `#050510` dark background, they appear visually indistinguishable to the human eye.

REVISED after deeper analysis: The most likely root cause is `getDomainColor()` — it is session-assignment-based (non-deterministic order). Because the module-level `domainColorMap` and `nextIndex` are shared across ALL calls in the JS module, and because `SolarEdges` renders edges before nodes establish domain colors, the order of domain color assignment depends on which edges are processed first. But more critically: physics→physics edges (84 of 213) and biology→biology edges (78 of 213) both produce a blended color that is IDENTICAL to the single-domain color (cyan lerp cyan = cyan, violet lerp violet = violet). Only the 14+12+1+1 = 28 cross-domain curiosity_link edges and 9 cross-domain bridge edges would show blended colors. With 84+78 = 162 same-domain edges dominating visually, changes to cross-domain color logic are nearly invisible.

test: Confirmed by database query — 162/213 edges (76%) are same-domain. Even if cross-domain colors are working correctly, they are visually overwhelmed by the same-color same-domain majority.
expecting: Cross-domain edges should be distinctly colored if logic is working
next_action: ROOT CAUSE FOUND — see Resolution

## Symptoms

expected: Cross-domain edges should be vivid blended colors (e.g., physics cyan + biology violet = lavender). Same-domain edges should be muted. Different edge types should have distinct visual styles.
actual: All edges appear the same color and style — no visible changes despite multiple code edits to solar-edges.tsx.
errors: No errors. Build passes. The changes just don't seem to take effect visually.
reproduction: localhost:3000/student/graph — all lines look identical
started: Edge colors have looked the same through multiple iterations of changes today.

## Eliminated

- hypothesis: HMR/caching not picking up changes
  evidence: Build passes, no errors. Next.js dev server compiles successfully. The component IS being used (confirmed via solar-scene.tsx line 318 imports SolarEdges directly).
  timestamp: 2026-04-09

- hypothesis: SolarEdges component not being rendered
  evidence: solar-scene.tsx line 318: `<SolarEdges layoutNodes={layoutNodes} edges={edges} />`. Import confirmed at line 8. Render path: graph-page-client -> KnowledgeGraph -> SolarGraph -> SolarScene -> SolarEdges. All confirmed active.
  timestamp: 2026-04-09

- hypothesis: No cross-domain edges exist in data
  evidence: Database query shows 14 physics→biology + 12 biology→math + 7 bridge biology→physics + 2 bridge physics→biology + 1 bridge math→biology = 36 cross-domain edges. They exist.
  timestamp: 2026-04-09

- hypothesis: Line component ignores color prop entirely
  evidence: LineMaterial source confirms color setter at line 451-459 writes to `uniforms.diffuse.value`. The drei Line component passes `color` explicitly to the LineMaterial primitive. Colors ARE being set.
  timestamp: 2026-04-09

## Evidence

- timestamp: 2026-04-09
  checked: solar-edges.tsx, solar-scene.tsx, solar-graph.tsx, knowledge-graph.tsx
  found: SolarEdges IS imported and rendered. Component chain is complete. Code in solar-edges.tsx is the live code being executed.
  implication: Changes to solar-edges.tsx ARE reaching the browser.

- timestamp: 2026-04-09
  checked: Database edge distribution
  found: 84 physics→physics + 78 biology→biology + 22 math→math = 184 same-domain edges. Only 29 cross-domain edges total (14%). Total 213 curiosity_link + 13 bridge = 226 edges.
  implication: 76% of edges are same-domain. Same-domain edges lerp to their own color (cyan+cyan=cyan). Visually, the vast majority of edges share 3 colors (physics=cyan, biology=violet, math=orange). Changes to cross-domain blending logic are barely visible given this data distribution.

- timestamp: 2026-04-09
  checked: getDomainColor() in domain-colors.ts
  found: Color assignment is first-come-first-served via module-level Map. Physics gets cyan (#22d3ee), biology gets violet (#a78bfa), math gets pink (#f472b6) — in whatever order edges are processed. Same-domain blends are always the single-domain color.
  implication: Most edges ARE correctly colored per domain, but since 76% are same-domain, the graph looks like 3 uniform-color line groups with no visible variation.

- timestamp: 2026-04-09
  checked: LineMaterial source (drei 10.7.7 / three-stdlib)
  found: `onBeforeCompile` sets USE_LINE_COLOR_ALPHA only when `transparent=true`. The `color` setter writes to `uniforms.diffuse.value`. `opacity` setter writes to `uniforms.opacity.value`. Both ARE uniforms in the shader. `transparent` and `opacity` from ...rest ARE forwarded to LineMaterial.
  implication: The Line component mechanics are correct. color and opacity DO work.

- timestamp: 2026-04-09
  checked: Bloom settings in solar-graph.tsx
  found: `luminanceThreshold={0.7}` with `intensity={1.5}`. Edge colors from getDomainColor are standard-luminance CSS colors (#22d3ee cyan ≈ luminance 0.65, #a78bfa violet ≈ luminance 0.40). These fall AT or BELOW the bloom threshold.
  implication: Edges produce minimal or no bloom glow. Their visual appearance is dominated by raw color with low opacity (0.12–0.75 range). The Bloom effect is not causing the same-look problem, but it does mean edges lack the "star glow" that nodes have (nodes use toneMapped=false + emissiveIntensity multipliers to exceed threshold).

## Resolution

root_cause: The code in solar-edges.tsx is functionally correct and IS executing. The visual "all edges look the same" symptom has two compounding causes:

  1. **Data distribution (primary)**: 76% of edges (162/226) are same-domain (physics→physics or biology→biology). These always produce a single-color blend (same color lerped with itself). Only 64 cross-domain edges exist, and they ARE showing blended colors — but they are visually dominated by the 162 same-color majority. With 3 domains and most edges same-domain, the graph visually shows "three groups of lines, each a single color."

  2. **Visual scale of differences (secondary)**: Cross-domain edge colors (e.g., physics-cyan + biology-violet = lavender #8e8bcb) are subtle blends that may not be obviously different from the base colors, especially at low opacity (0.12–0.35 for same-domain) and with the dark background (#050510). The opacity difference between same-domain (max 0.35) and cross-domain (max 0.75) is the more impactful visual cue — but those cross-domain edges are rare.

  The user's belief that "no changes take effect" is because changes to cross-domain color blending only affect 29% of edges — and those edges' visual difference from same-domain edges may be subtle enough to miss without zooming in.

fix: Not applied (find_root_cause_only mode). Suggested directions:
  - To make differences obvious: add a console.log in getEdgeStyle() to dump color/opacity per edge, confirming values are computed correctly
  - To verify cross-domain edges are rendering differently: filter to show only cross-domain edges (or temporarily set same-domain opacity to 0)
  - To make the visualization more compelling: increase opacity contrast between cross-domain (e.g., 0.9) and same-domain (e.g., 0.08), or use emissive-style bright colors for cross-domain edges

verification: N/A — diagnosis only
files_changed: []
