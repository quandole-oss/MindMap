---
status: awaiting_human_verify
trigger: "Nodes render as solid BLACK spheres despite health-status colors being set with high multipliers (3x-6x). meshBasicMaterial with vertexColors and toneMapped=false should render vertex colors directly, but nodes appear completely black."
created: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Focus

hypothesis: The `color_vertex.glsl` shader multiplies `vColor.rgb *= instanceColor.rgb` ONLY when `USE_INSTANCING_COLOR` is defined. `USE_INSTANCING_COLOR` is defined when `parameters.instancingColor` is true (requires `object.instanceColor !== null`). HOWEVER, the fragment shader only applies `diffuseColor *= vColor` when `USE_COLOR` is defined. In the FRAGMENT shader, `USE_COLOR` is defined as `parameters.vertexColors || parameters.instancingColor`. But the VERTEX shader defines `USE_COLOR` only when `parameters.vertexColors` is true — NOT when only instancingColor is set. The vertex shader initializes `vColor = vec4(1.0)` under `USE_COLOR || USE_INSTANCING_COLOR`, then multiplies `vColor.rgb *= instanceColor.rgb` under `USE_INSTANCING_COLOR`. This APPEARS correct. BUT — the real bug is different: `vertexColors: true` on the JSX element sets `material.vertexColors = true`, which does NOT enable USE_COLOR on the geometry's vertex color attribute (there is none), and also the geometry has NO per-vertex color attribute — so when `USE_COLOR` tries to read from a `color` attribute that does not exist on the sphere geometry, the shader falls back to zero/black.

ACTUAL ROOT CAUSE (confirmed by shader code analysis): The `color_vertex.glsl` initializes `vColor = vec4(1.0)` when `USE_COLOR || USE_INSTANCING_COLOR` is defined. It then does `vColor.rgb *= instanceColor.rgb` when `USE_INSTANCING_COLOR`. The fragment does `diffuseColor *= vColor` when `USE_COLOR`. The fragment `USE_COLOR` define (line 735 of WebGLProgram.js) is `parameters.vertexColors || parameters.instancingColor` — so it IS defined when instancingColor is set. The vertex `USE_COLOR` define (line 566) is ONLY `parameters.vertexColors`. Since `vertexColors: true` is set on the material AND `setColorAt()` is being called (so `instanceColor` is non-null), BOTH defines are active. The shader should work. But here is the actual bug: `vertexColors: true` on `<meshBasicMaterial>` means THREE.js looks for a `color` attribute on the geometry. The sphere geometry has NO such attribute. With `USE_COLOR` defined, the vertex shader tries to read `attribute vec3 color` — which is zero/uninitialized — and multiplies vColor by it, producing BLACK. The instanceColor multiplication happens AFTER, but it multiplies into 0.

test: Confirming via color_vertex.glsl logic:
  vColor = vec4(1.0)         // initialized to white
  vColor.rgb *= color        // color attribute = vec3(0,0,0) on sphere = BLACK
  vColor.rgb *= instanceColor.rgb  // black * anything = still black

expecting: Removing `vertexColors` from meshBasicMaterial should fix it — the instanceColor path alone is sufficient and does NOT require vertexColors to be set on the material.

next_action: Remove `vertexColors` from <meshBasicMaterial> in solar-nodes.tsx

## Symptoms

expected: Vivid colored glowing nodes — teal (healthy), red (misconception), gray (unprobed), purple (bridge)
actual: All nodes are solid BLACK. No color at all. Edges render correctly (purple/blue lines visible). Cluster labels visible. Only the node spheres are black.
errors: No console errors. Build passes clean.
reproduction: localhost:3000/student/graph — all nodes are black
started: Nodes went black when we switched from meshStandardMaterial to meshBasicMaterial

## Eliminated

- hypothesis: meshBasicMaterial.color not being white
  evidence: THREE.js source confirms MeshBasicMaterial defaults color to 0xffffff
  timestamp: 2026-04-09

- hypothesis: instanceColor buffer not initialized/flagged for update
  evidence: Code at lines 93-98 of solar-nodes.tsx correctly calls setColorAt() and sets instanceColor.needsUpdate = true
  timestamp: 2026-04-09

- hypothesis: toneMapped=false causing issues
  evidence: This property is independent of vertex colors; only affects output color space mapping
  timestamp: 2026-04-09

## Evidence

- timestamp: 2026-04-09
  checked: THREE.js WebGLProgram.js lines 486, 566, 735
  found: |
    Vertex shader: USE_INSTANCING_COLOR defined when parameters.instancingColor (= instanceColor !== null)
    Vertex shader: USE_COLOR defined when parameters.vertexColors ONLY (NOT instancingColor alone)
    Fragment shader: USE_COLOR defined when parameters.vertexColors OR parameters.instancingColor
  implication: With vertexColors=true on material, USE_COLOR is active in BOTH vertex and fragment shaders

- timestamp: 2026-04-09
  checked: color_vertex.glsl.js
  found: |
    vColor = vec4(1.0)          // if USE_COLOR || USE_INSTANCING_COLOR
    vColor.rgb *= color         // if USE_COLOR (reads geometry color attribute — none on SphereGeometry)
    vColor.rgb *= instanceColor // if USE_INSTANCING_COLOR
  implication: With USE_COLOR active, shader reads `attribute vec3 color` from sphere geometry.
               SphereGeometry has NO color attribute — so GPU reads zeroes.
               vColor starts at 1.0, gets multiplied by 0.0 (the zero attribute), becomes BLACK.
               Then instanceColor multiplies BLACK by the real color = still BLACK.

- timestamp: 2026-04-09
  checked: WebGLProgram.js line 654
  found: |
    '#elif defined( USE_COLOR )',
    '    attribute vec3 color;',
    This declares the geometry color attribute when USE_COLOR is active.
    SphereGeometry does not provide this attribute so WebGL reads attribute as all zeros.
  implication: This is the direct cause of black nodes. vertexColors=true must NOT be set
               when relying purely on InstancedMesh.setColorAt() for per-instance color.

- timestamp: 2026-04-09
  checked: fragment color_fragment.glsl.js
  found: diffuseColor *= vColor only when USE_COLOR || USE_COLOR_ALPHA
         Fragment USE_COLOR (line 735) = vertexColors || instancingColor = true either way
  implication: Fragment will correctly apply vColor once vertex shader produces correct vColor.
               The fix is ONLY needed in the vertex stage: remove vertexColors from material.

## Resolution

root_cause: |
  `vertexColors={true}` on <meshBasicMaterial> activates USE_COLOR in the vertex shader,
  which declares `attribute vec3 color` on the geometry. SphereGeometry has no such
  attribute, so WebGL provides all-zeros. The vertex shader then does:
    vColor = vec4(1.0)
    vColor.rgb *= color          // 1.0 * 0.0 = 0.0 (BLACK)
    vColor.rgb *= instanceColor  // 0.0 * anything = 0.0 (still BLACK)
  resulting in black nodes regardless of what setColorAt() sets.
  
  The instanceColor path (USE_INSTANCING_COLOR) works correctly WITHOUT vertexColors.
  When vertexColors is NOT set, USE_COLOR in the fragment shader is STILL defined via
  `parameters.vertexColors || parameters.instancingColor` (WebGLProgram.js line 735),
  so the fragment correctly applies `diffuseColor *= vColor`. The vertex shader initializes
  vColor=1.0, multiplies by instanceColor, and produces the correct color.

fix: Remove `vertexColors` prop from <meshBasicMaterial> in solar-nodes.tsx.
     The InstancedMesh.setColorAt() / instanceColor path does NOT require vertexColors=true.
     It only needs USE_INSTANCING_COLOR which is automatically set when instanceColor is non-null.

verification: ""
files_changed:
  - apps/web/components/graph/solar-nodes.tsx
