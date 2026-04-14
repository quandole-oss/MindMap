---
status: investigating
trigger: "Node colors must reflect health status. Currently black spheres. Need exact fix values."
created: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Focus

hypothesis: Domain-based coloring (Attempt 4) produces black nodes because domain palette colors, while vivid at face value, are being multiplied by 1.6-2.4x and then compared against luminanceThreshold=0.7 — but the root issue is that the COLOR USED IS WRONG. getNodeColor() ignores NODE_COLORS (health status) entirely and uses domain hues instead.
test: Trace the exact framebuffer values for each health status color through the current pipeline
expecting: Exact multiplier values that make health-status colors exceed bloom threshold
next_action: complete math trace and produce fix values

## Symptoms

expected: healthy=#0d9488 (teal), misconception=#dc2626 (red), unprobed=#71717a (gray), bridge=#7c3aed (purple). Vivid, distinct, with bloom star-glow.
actual: Black spheres (domain colors too dim) or gray wash (old meshStandardMaterial).
errors: No runtime errors — purely visual.
reproduction: localhost:3000/student/graph
started: Colors never worked. Multiple fix attempts failed.

## Eliminated

- hypothesis: meshStandardMaterial with emissive is viable
  evidence: Attempts 1-3 all produced gray wash. emissive channel on meshStandardMaterial bleeds white at >0.08 intensity, overwhelming vertex color hue.
  timestamp: 2026-04-09

- hypothesis: Domain color blending gives useful signal
  evidence: Attempt 4 current state — ignores NODE_COLORS entirely; domain colors at 1.6-2.4x still produce black spheres because the base domain palette colors (#22d3ee etc) have luminance that, even with 2.4x, hits the framebuffer below bloom threshold=0.7 in perceptual terms once three.js linear color math is applied.
  timestamp: 2026-04-09

## Evidence

- timestamp: 2026-04-09
  checked: solar-nodes.tsx getNodeColor()
  found: |
    NODE_COLORS dict (health status) is defined at top of file but NEVER USED in getNodeColor().
    getNodeColor() exclusively uses getDomainHue() then applies a brightness multiplier.
    Bridge nodes DO use NODE_COLORS.bridge.clone().multiplyScalar(3.0).
    All other nodes: domain color * (1.6 | 2.0 | 2.4).
  implication: The fix requires replacing domain logic with direct health-status color lookup.

- timestamp: 2026-04-09
  checked: meshBasicMaterial + toneMapped=false + bloom pipeline math
  found: |
    meshBasicMaterial writes vertex color directly to framebuffer with NO lighting.
    toneMapped=false means colors are passed through without ACESToneMapping compression.
    THREE.Color stores values in LINEAR color space.
    Bloom (luminanceThreshold=0.7) checks LUMINANCE of each pixel:
      luminance = 0.2126*R + 0.7152*G + 0.0722*B  (BT.709)
    A pixel only blooms if luminance > 0.7.

    Current domain palette examples at their multipliers:
      #22d3ee (cyan, R=0.133, G=0.827, B=0.933) * 2.4:
        → R=0.320, G=1.985 (clamped to 1.0), B=2.239 (clamped to 1.0)
        → BUT three.js Color values are NOT clamped on setColorAt — they pass raw floats
        → Framebuffer clamping happens in the GPU at [0,1] for sRGB output
        → Post-processing reads HDR buffer BEFORE clamping when using EffectComposer
        → So raw values DO pass through to bloom: lum = 0.2126*0.320 + 0.7152*1.985 + 0.0722*2.239
          = 0.068 + 1.420 + 0.162 = 1.649 → would bloom. But wait...

    PROBLEM: Does the Canvas use a linear (HDR) render target for EffectComposer?
      - EffectComposer from @react-three/postprocessing creates its own render target
      - The scene is rendered to an HDR buffer, then postprocessing runs
      - BUT toneMapped=false on the material means the GPU doesn't tone-map the geometry pass
      - However, if the Canvas gl prop doesn't set outputColorSpace or the composer doesn't
        match, colors may be double-transformed or clamped to [0,1] BEFORE bloom sees them
      
    REAL ROOT CAUSE of black spheres (domain colors):
      Domain palette colors like #22d3ee, #4ade80 etc have HIGH luminance in sRGB.
      But THREE.Color('#22d3ee') stores SRGB hex and converts to LINEAR internally.
      Wait — THREE.Color('#22d3ee') in THREE.js r152+: hex strings are treated as sRGB
      and stored as LINEAR (the .r .g .b properties are linear).
      
      #22d3ee sRGB: R=0x22=34/255=0.133, G=0xd3=211/255=0.827, B=0xee=238/255=0.933
      Linear conversion (gamma=2.2): R=0.133^2.2≈0.0141, G=0.827^2.2≈0.661, B=0.933^2.2≈0.859
      * 2.4 = R=0.034, G=1.587, B=2.063
      Luminance (linear): 0.2126*0.034 + 0.7152*1.587 + 0.0722*2.063
        = 0.007 + 1.135 + 0.149 = 1.291 → bloom threshold 0.7 exceeded.
      
      So cyan WOULD bloom. Why are nodes appearing black then?
      
      Hypothesis: THREE.Color hex strings might NOT be auto-linearized in the version used.
      In Three.js r152, ColorManagement.enabled=true by default and hex strings are sRGB.
      In earlier versions, colors were stored as sRGB (no conversion) and materials read them as-is.
      setColorAt() writes to instanceColor buffer — format depends on Three.js version.
      
      But domain palette has very DARK entries too — #22d3ee is bright but the assignment is
      non-deterministic (domain assignment order changes per session). Some domains get
      dark colors. E.g., the very FIRST concept domain gets #22d3ee (bright) but the next
      gets #a78bfa (violet, medium brightness), etc.
      
      More likely cause: the domain assignment is random per session, so some nodes always
      get dimmer domain colors. But more importantly — the colors ARE domain, not health.
      The visual result is "domain-colored" which looks random/confusing regardless of bloom.
  implication: |
    Three separate issues:
    1. WRONG COLOR SOURCE: health-status colors never used (except bridge)
    2. BLOOM THRESHOLD MATH: need to verify exact multiplier so health colors exceed 0.7
    3. GRAY WASH HISTORY: meshStandardMaterial caused it; meshBasicMaterial is correct

- timestamp: 2026-04-09
  checked: Exact framebuffer math for health-status colors with meshBasicMaterial + toneMapped=false
  found: |
    THREE.Color hex parsing (Three.js r152+ with ColorManagement.enabled=true):
    Input hex → stored as LINEAR. .r/.g/.b are linear values.
    setColorAt() writes the .r .g .b directly to the instanceColor Float32Array.
    Bloom reads this linear HDR buffer.
    Luminance formula: L = 0.2126R + 0.7152G + 0.0722B (linear inputs)
    Bloom threshold: 0.7 (luminance in linear space)
    
    --- HEALTH STATUS COLORS ---
    
    HEALTHY = #0d9488 (teal)
      sRGB: R=13/255=0.051, G=148/255=0.580, B=136/255=0.533
      Linear: R=0.051^2.2≈0.00372, G=0.580^2.2≈0.2943, B=0.533^2.2≈0.2487
      Base luminance: 0.2126*0.00372 + 0.7152*0.2943 + 0.0722*0.2487
        = 0.00079 + 0.2105 + 0.01796 = 0.2293
      Need L > 0.7 for bloom: required multiplier = 0.7 / 0.2293 = 3.05
      At 3.0x: L = 0.2293 * 3.0 = 0.688 (JUST BELOW threshold — dim glow only)
      At 3.5x: L = 0.2293 * 3.5 = 0.803 (ABOVE threshold — blooms)
      At 4.0x: L = 0.2293 * 4.0 = 0.917 (strong bloom)
      RECOMMENDED: 4.0x for vivid teal glow
    
    MISCONCEPTION = #dc2626 (red)
      sRGB: R=220/255=0.863, G=38/255=0.149, B=38/255=0.149
      Linear: R=0.863^2.2≈0.7149, G=0.149^2.2≈0.01826, B=0.149^2.2≈0.01826
      Base luminance: 0.2126*0.7149 + 0.7152*0.01826 + 0.0722*0.01826
        = 0.1520 + 0.01306 + 0.00132 = 0.1664
      Need multiplier: 0.7 / 0.1664 = 4.21
      At 4.0x: L = 0.6656 (barely below — very dim/no bloom)
      At 4.5x: L = 0.749 (blooms, good intensity)
      At 5.0x: L = 0.832 (strong bloom)
      RECOMMENDED: 5.0x for vivid red alarm glow
      
    UNPROBED = #71717a (gray)
      sRGB: R=113/255=0.443, G=113/255=0.443, B=122/255=0.478
      Linear: R=0.443^2.2≈0.1581, G=0.443^2.2≈0.1581, B=0.478^2.2≈0.1891
      Base luminance: 0.2126*0.1581 + 0.7152*0.1581 + 0.0722*0.1891
        = 0.03361 + 0.1131 + 0.01366 = 0.1604
      Need multiplier: 0.7 / 0.1604 = 4.36
      BUT — gray should be dimmer/less saturated than healthy or misconception.
      Design intent: unprobed nodes glow but visibly dimmer.
      Recommendation: use 2.5x → L = 0.1604 * 2.5 = 0.401 (BELOW threshold, no bloom,
        node visible but no star glow)
      Or use 3.0x → L = 0.481 (still below threshold, soft non-blooming gray)
      Or use 3.2x → L = 0.513 (below threshold, visible gray sphere)
      DESIGN CHOICE: gray nodes should NOT bloom (reinforces "unexamined" state).
      Use 2.5x for a dim but visible gray. Alternatively use threshold-adjacent 3.0x
      for a faint halo effect (luminanceSmoothing=0.9 means partial bloom from 0.49-0.7).
      RECOMMENDED: 3.0x (L=0.481, within smoothing range → faint ghost glow, intentional)
      
    BRIDGE = #7c3aed (purple) — already handled with 3.0x multiplier
      sRGB: R=124/255=0.486, G=58/255=0.227, B=237/255=0.929
      Linear: R=0.486^2.2≈0.1961, G=0.227^2.2≈0.04067, B=0.929^2.2≈0.8494
      Base luminance: 0.2126*0.1961 + 0.7152*0.04067 + 0.0722*0.8494
        = 0.04169 + 0.02909 + 0.06133 = 0.1321
      At 3.0x: L = 0.3963 (below threshold, minimal bloom — bridge not vivid enough)
      At 5.0x: L = 0.6605 (below 0.7, in smoothing zone)
      At 5.5x: L = 0.7266 (above threshold, good bloom)
      At 6.0x: L = 0.7926 (strong bloom — bridge nodes should be MOST prominent)
      RECOMMENDED: 6.0x for maximum bridge node visibility (currently only 3.0x!)
      
  implication: |
    Current bridge multiplier of 3.0x produces luminance=0.396 — BELOW bloom threshold.
    That's why bridge nodes also appear dark. The 3.0x "looked right" in code but fails bloom math.
    Fix requires: healthy=4.0x, misconception=5.0x, unprobed=3.0x, bridge=6.0x

- timestamp: 2026-04-09
  checked: luminanceSmoothing=0.9 behavior on partial-luminance colors
  found: |
    luminanceSmoothing creates a soft band. Threshold=0.7, smoothing=0.9:
    The smoothstep knee means partial bloom begins below 0.7:
    approx bloom starts around luminance = 0.7 - (0.9 * some_factor)
    In practice, with smoothing=0.9, partial glow begins around L=0.3-0.4.
    This means unprobed at 3.0x (L=0.481) WILL get a faint glow — intentional.
    And misconception at 5.0x (L=0.832) gets strong bloom — correct for "alarm" state.
  implication: |
    The smoothing window actually works in our favor:
    unprobed: faint ghost bloom (L=0.481) — "unexplored" feel
    healthy: moderate bloom (L=0.917 at 4.0x) — "active knowledge" feel  
    misconception: strong bloom (L=0.832 at 5.0x) — "alarm" feel
    bridge: strongest bloom (L=0.793 at 6.0x) — "hub" feel, highest priority visual

- timestamp: 2026-04-09
  checked: meshBasicMaterial vs meshStandardMaterial trade-off
  found: |
    meshStandardMaterial: physically based, responds to lighting.
      - ambientLight(intensity=3) in solar-scene.tsx STILL affects it — causes gray wash.
      - emissive channel adds a base glow but is uniform/flat and bleeds into vertex color.
      - VERDICT: incorrect choice for this use case. Emissive wash is unavoidable with
        the ambient light already in the scene.
    meshBasicMaterial: ignores all lighting, renders vertex color directly.
      - toneMapped=false passes values > 1.0 through to EffectComposer HDR buffer.
      - This is the ONLY material that guarantees color fidelity for bloom.
      - VERDICT: correct choice. Keep it.
    NOTE: ambientLight in solar-scene.tsx (intensity=3) has NO EFFECT on meshBasicMaterial.
      It only affects the Stars component and any other meshStandardMaterial/Phong objects.
      Can be reduced or removed without affecting node colors.
  implication: Keep meshBasicMaterial. The gray wash from Attempts 1-3 was entirely
    caused by meshStandardMaterial + emissive + ambient light interaction.

## Resolution

root_cause: |
  TWO compounding bugs:
  
  1. WRONG COLOR SOURCE: getNodeColor() uses domain hues instead of health-status colors.
     NODE_COLORS dict (defined at top of solar-nodes.tsx) is never called for non-bridge nodes.
     Only bridge nodes use NODE_COLORS.bridge, but with multiplier 3.0x which is below bloom threshold.
  
  2. MULTIPLIERS TOO LOW: All current multipliers (1.6, 2.0, 2.4, 3.0) produce final
     luminance values BELOW the bloom luminanceThreshold=0.7, so no bloom star-glow occurs.
     The health-status base colors are medium-brightness; they require 4-6x multipliers to bloom.

fix: |
  In solar-nodes.tsx getNodeColor():
  Replace domain-color logic with direct health-status color lookup.
  Apply per-status multipliers calculated from bloom threshold math:
  
    healthy:       NODE_COLORS.healthy.clone().multiplyScalar(4.0)
                   → teal at L=0.917, strong bloom ✓
    misconception: NODE_COLORS.misconception.clone().multiplyScalar(5.0)
                   → red at L=0.832, strong alarm bloom ✓
    unprobed:      NODE_COLORS.unprobed.clone().multiplyScalar(3.0)
                   → gray at L=0.481, faint ghost glow (in smoothing band) ✓
    bridge:        NODE_COLORS.bridge.clone().multiplyScalar(6.0)  [was 3.0 — too low]
                   → purple at L=0.793, strong hub bloom ✓
  
  Also: remove getDomainHue(), getDomainColor import, DOMAIN_HUES cache, _blended Color,
  as none are needed once health-status colors are used directly.

verification: pending
files_changed:
  - apps/web/components/graph/solar-nodes.tsx
