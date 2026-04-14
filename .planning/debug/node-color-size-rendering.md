---
status: awaiting_human_verify
trigger: "3D knowledge graph nodes render as uniform gray/white spheres with no color differentiation and insufficient size variation"
created: 2026-04-09T00:00:00Z
updated: 2026-04-09T01:00:00Z
---

## Current Focus

hypothesis: Four compounding issues cause the gray wash: (1) meshStandardMaterial has a gray emissive uniform applied to ALL instances overriding vertex colors, (2) ambient-only lighting flattens diffuse contribution, (3) Bloom threshold too low + intensity too high blooms the gray out further, (4) getNodeColor() blends 70% health-status color (67% of nodes are "unprobed" = #71717a gray) with only 30% domain color — domain color never has a chance.
test: Fix all four issues in solar-nodes.tsx, solar-graph.tsx, and solar-scene.tsx in one pass; then visually verify at localhost:3000/student/graph.
expecting: After fix, nodes show distinct domain colors as the primary visual signal; size range is noticeably differentiated (small to large); bloom produces colored glow rather than gray wash.
next_action: Await human verification at localhost:3000/student/graph

## Symptoms

expected: Nodes colored by DOMAIN/SUBJECT with 10-color palette from domain-colors.ts. Node sizes show 4-5x ratio. Star-like glow aesthetic maintained.
actual: All nodes render as uniform gray/white spheres. No domain colors. Size differences minimal. Bloom washes everything to gray.
errors: No runtime errors. Visual rendering bug only.
reproduction: localhost:3000/student/graph as any student with seed data.
started: Always broken — since 3D graph inception in Phase 7.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-09T00:00:00Z
  checked: solar-nodes.tsx line 174-181 — meshStandardMaterial props
  found: emissive={new THREE.Color(0.08, 0.08, 0.12)} with emissiveIntensity={1.8}. This adds (0.144, 0.144, 0.216) gray to every pixel uniformly, washing out vertex color contributions.
  implication: Root cause #1 — uniform gray emissive overrides per-instance vertex colors

- timestamp: 2026-04-09T00:00:00Z
  checked: solar-nodes.tsx lines 31-40 — getNodeColor()
  found: Blends 70% NODE_COLORS[node.status] + 30% domainHue. NODE_COLORS.unprobed = #71717a (gray). Most seed nodes are "unprobed" → 70% gray dominates every node color.
  implication: Root cause #4 — health-status color buries domain color; user wants domain-only coloring

- timestamp: 2026-04-09T00:00:00Z
  checked: solar-scene.tsx line 300 — lighting
  found: <ambientLight intensity={3} /> is the ONLY light source. meshStandardMaterial diffuse response requires at least one directional light; ambient-only lighting makes all colors flat/washed.
  implication: Root cause #2 — ambient-only lighting prevents color differentiation

- timestamp: 2026-04-09T00:00:00Z
  checked: solar-graph.tsx lines 65-72 — Bloom effect settings
  found: luminanceThreshold={0.6}, intensity={2.0}. Low threshold causes nearly all surfaces to bloom including gray ones. High intensity amplifies the bloom wash.
  implication: Root cause #3 — aggressive bloom amplifies gray wash

- timestamp: 2026-04-09T00:00:00Z
  checked: domain-colors.ts — palette
  found: 10 vivid colors (cyan, violet, pink, orange, green, yellow, blue, fuchsia, emerald, red-light). getDomainColor() assigns colors deterministically by domain string. The infrastructure is correct; it's just not being used as the primary color source.
  implication: Fix just needs to use getDomainHue() as 100% color source, not blended

- timestamp: 2026-04-09T00:00:00Z
  checked: solar-nodes.tsx lines 47-51 — getNodeRadius()
  found: Range [3..22]. With sparse graph data, importance values cluster near 0 → most nodes get radius near 3. The formula is correct but seed data may not have enough variance.
  implication: Secondary issue — importance compression. Range already wide (7x ratio); seed data variance is the limiting factor.

## Resolution

root_cause: Four compounding issues: (1) meshStandardMaterial uniform gray emissive {0.08,0.08,0.12} at intensity 1.8 washes vertex colors; (2) ambient-only lighting flattens diffuse; (3) Bloom luminanceThreshold=0.6 + intensity=2.0 blooms gray surfaces; (4) getNodeColor() 70% health-status (mostly gray "unprobed") drowns 30% domain color.
fix: (1) Remove emissive uniform gray — use meshBasicMaterial OR change emissive to derive from domain color, not constant gray; (2) Add directional light to solar-scene.tsx; (3) Raise bloom luminanceThreshold to 0.85, lower intensity to 1.3; (4) Change getNodeColor() to use 100% domain color as base, optionally add health-status as a secondary signal (saturation/brightness modifier).
verification: empty
files_changed: []
