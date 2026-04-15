# Technology Stack Additions for v1.1 Value Experience

**Project:** MindMap v1.1
**Researched:** 2026-04-14
**Focus:** Stack additions/changes for 3 new features (graph animation, bridge discovery UX, teacher action loop)

## Executive Summary

After analyzing the existing codebase, the v1.1 features require **zero new npm dependencies**. The project already has every tool needed: GSAP for timeline-based 2D animations, `useFrame` for per-frame R3F InstancedMesh manipulation, Sonner for notifications, Drei's Sparkles for particle effects, and React 19's `useOptimistic` (built-in) for teacher workflow state. Adding libraries would introduce compatibility risk and bundle bloat for no gain.

## Existing Stack Assets (Already Installed)

These are the tools that cover all v1.1 requirements:

| Already Installed | Version | Covers Feature | How |
|-------------------|---------|----------------|-----|
| `@react-three/fiber` useFrame | ^9.5.0 | Graph growth animation | Per-frame InstancedMesh matrix/color manipulation (already used for bridge pulse in solar-scene.tsx) |
| `@react-three/drei` Sparkles | ^10.7.7 | Bridge discovery visual effect | Floating particle burst at bridge node position |
| `@react-three/postprocessing` Bloom | ^3.0.4 | Bridge discovery glow emphasis | Temporarily boost emissive intensity on bridge node |
| `gsap` | ^3.14.2 | 2D overlay animations (celebration, timeline) | Already used in spiral-animation.tsx for canvas particle depth animation |
| `sonner` | ^2.0.7 | Upgraded bridge notification | Custom toast with richer content, action buttons |
| `three` (THREE.Color, THREE.Vector3) | ^0.183.2 | Color lerp animation for new nodes | Color.lerp, Vector3.lerp in useFrame loop |
| React 19 `useOptimistic` | built-in | Teacher mark-done optimistic UI | Native React hook, no library needed |
| Next.js `revalidatePath` | ^15.3.0 | Teacher action server-side cache bust | Built into Next.js App Router |
| Drizzle ORM | 0.45.2 | Teacher action persistence (new columns) | Schema migration for action status tracking |

## Feature-by-Feature Stack Analysis

### Feature 1: Graph-as-Hero (Animate Graph Growth)

**What it needs:** After a student asks a question, new nodes should appear with a scale-up animation, new edges should draw in, and the camera should fly to the new region.

**Stack decision: useFrame + manual InstancedMesh matrix manipulation. No new library.**

**Rationale:**
- The graph already uses InstancedMesh with `setMatrixAt()` for all node rendering (solar-nodes.tsx)
- The bridge pulse animation in solar-scene.tsx already demonstrates the exact pattern: `useFrame` reads clock, computes scale factor, updates matrix, sets `needsUpdate = true`
- Neither `@react-spring/three` nor `framer-motion-3d` can animate individual instances within an InstancedMesh -- they operate on React component props, not on per-instance matrix buffers
- `@react-spring/three` (v10.0.3) is React 19 compatible but adds ~40KB for a capability that `useFrame` + `THREE.MathUtils.lerp` already provides
- `framer-motion-3d` (v12.4.13) requires `@react-three/fiber: 8.2.2` -- incompatible with the project's R3F v9

**Implementation pattern (no new deps):**
```typescript
// In useFrame callback:
// 1. Track "new node" IDs and their birth timestamps
// 2. For each new node, compute scale: lerp(0, targetRadius, easeOutElastic(elapsed / DURATION))
// 3. Update InstancedMesh matrix via setMatrixAt()
// 4. Optionally boost emissive color temporarily (birth glow)
// 5. Camera fly-to already exists in solar-scene.tsx (reuse flyToNode)
```

**Edge drawing animation:**
- Current edges use `<Line>` from Drei (solar-edges.tsx) -- these are individual R3F components
- Animate by lerping the second point from source position to target position over ~0.5s
- No new library needed -- `useFrame` + `THREE.Vector3.lerp`

**Alternatives rejected:**

| Library | Why Rejected |
|---------|-------------|
| `@react-spring/three` v10 | Cannot animate individual InstancedMesh instances; would require restructuring to individual `<mesh>` elements (destroying the single-draw-call performance). The existing graph can have 100+ nodes. |
| `framer-motion-3d` v12 | Peer dep requires R3F ^8.2.2 and React 18 only. Incompatible with project's React 19 + R3F ^9.5.0. |
| `motion` v12 (main package) | R3F support only via `framer-motion-3d` sub-package, which has the same compat issue. The main `motion` package has no R3F exports. |
| `drei` Float/Trail | Float is constant bobbing (wrong UX for one-shot growth), Trail requires attaching to a moving mesh ref (wrong for appearing nodes). |

### Feature 2: Surprising Connections (Bridge Discovery UX)

**What it needs:** When a bridge concept is discovered, make it an unmissable "aha moment" instead of a dismissible toast. The current implementation is a Sonner toast with 7-day cooldown (bridge-toast.tsx).

**Stack decision: Combine existing tools. No new library.**

**Components of the new experience:**

1. **3D graph effect (already have tools):**
   - Camera fly-to bridge node (already implemented: `flyToNode` in solar-scene.tsx)
   - Pulse animation on bridge node (already implemented: `pulseRef` in solar-scene.tsx)
   - `<Sparkles>` from `@react-three/drei` -- already installed, renders floating particles around a position. Add sparkles at bridge node position during discovery moment
   - Temporarily boost Bloom intensity on the bridge node by increasing emissive multiplier (existing pattern in solar-nodes.tsx: `multiplyScalar(6.0)`)

2. **2D overlay (already have tools):**
   - Replace toast with a modal/card overlay using existing shadcn/ui `Dialog` or custom overlay
   - GSAP (already installed) for entrance animation of the overlay card
   - Show bridge node name, the two domains it connects, and a "Why this matters" explanation

3. **Edge highlight (already have tools):**
   - Flash the bridge edges brighter by temporarily overriding opacity/lineWidth in SolarEdges
   - Use `useFrame` time-based lerp to animate edge brightness, same pattern as pulse

**Alternatives rejected:**

| Library | Why Rejected |
|---------|-------------|
| `canvas-confetti` | Renders on a separate 2D canvas layer, would fight with the R3F WebGL canvas. Also wrong aesthetic -- this is an insight moment, not a game reward. |
| `react-confetti-explosion` | Same canvas-layer issue. Also, confetti is extrinsic reward -- conflicts with project's anti-gamification stance (see PROJECT.md Out of Scope). |

### Feature 3: Teacher Action Loop

**What it needs:** Cluster view -> Generate activity -> Mark done -> Re-probe students to measure impact. This is a workflow state machine, not an animation problem.

**Stack decision: React 19 useOptimistic + Next.js Server Actions + Drizzle schema additions. No new library.**

**Rationale:**
- The teacher dashboard already uses client-side state management with `useState` for expand/collapse, loading states, and lesson plan caching (themes-view.tsx, lesson-plan-card.tsx)
- "Mark done" is a simple boolean status toggle -- `useOptimistic` (React 19 built-in) handles the instant UI feedback, Server Action persists to DB, `revalidatePath` refreshes the page data
- No state machine library needed: the workflow has exactly 3 states (pending -> activity_assigned -> completed), which is trivially managed with an enum column in the database and a switch statement in the UI
- Zustand, XState, or Jotai would be overkill for a 3-state workflow in a single page component

**Schema additions needed (Drizzle migration, no new package):**
```typescript
// New columns on theme_lesson_plans table OR new table:
// - status: enum('pending', 'assigned', 'completed')
// - assignedAt: timestamp
// - completedAt: timestamp
// - reprobeTriggeredAt: timestamp (when teacher requests re-probe)
```

**Re-probe mechanism:**
- Server Action marks affected students' diagnostic sessions for re-evaluation
- Uses existing `@mindmap/router` package to trigger diagnostic mode on next student visit
- No new infrastructure -- the routing engine already decides enrich vs. diagnose

**Alternatives rejected:**

| Library | Why Rejected |
|---------|-------------|
| `zustand` | Global state management for what is page-local UI state. The teacher dashboard is a single route with no cross-page state sharing needs. React useState + useOptimistic covers this. |
| `xstate` | Formal state machine library. The workflow has 3 states and 2 transitions. A `switch` statement with TypeScript discriminated unions is clearer and has zero bundle cost. |
| `@tanstack/react-query` | Server Actions with revalidatePath already handle cache invalidation. TanStack Query would duplicate Next.js's built-in data fetching/caching layer and add ~40KB. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@react-spring/three` | Cannot animate InstancedMesh instances; adds 40KB for capability already covered by useFrame | `useFrame` + `THREE.MathUtils.lerp` |
| `framer-motion-3d` | Incompatible (requires R3F ^8.2.2 + React 18) | Not applicable |
| `motion` (framer-motion v12) | R3F support broken for React 19; 2D animations covered by existing GSAP + CSS | GSAP (already installed) or Tailwind CSS transitions |
| `zustand` / `jotai` | Teacher workflow is page-local, 3 states. No cross-component state sharing needed. | `useState` + `useOptimistic` (React 19 built-in) |
| `xstate` | Over-engineered for a 3-state linear workflow | TypeScript enum + switch |
| `@tanstack/react-query` | Duplicates Next.js Server Actions + revalidatePath caching | Server Actions + revalidatePath |
| `canvas-confetti` / `react-confetti-*` | 2D canvas conflicts with R3F; confetti is gamification (explicitly out of scope per PROJECT.md) | `@react-three/drei` Sparkles (already installed) |
| `lottie-react` | Heavy (~300KB), wrong tool for procedural 3D animations | useFrame procedural animation |
| `anime.js` | Overlaps with GSAP which is already installed | GSAP |

## New Capabilities from Existing Packages (Not Yet Used)

These are features of already-installed packages that v1.1 should leverage:

| Package | Unused Capability | v1.1 Use Case |
|---------|-------------------|---------------|
| `@react-three/drei` Sparkles | Floating particle effect | Sparkle burst around newly discovered bridge node |
| `@react-three/drei` Html | Already used for labels | Rich HTML overlay at bridge node position for inline discovery card |
| `@react-three/postprocessing` Bloom | Already used globally | Temporarily increase per-node emissive for "birth glow" effect |
| `three` MathUtils.lerp | Not used directly yet | Smooth easing for scale, position, color transitions in useFrame |
| `three` MathUtils.smoothstep | Not used yet | Non-linear easing for more organic animation curves |
| `three` Color.lerpColors | Not used yet | Smooth color transitions for node state changes |
| React 19 `useOptimistic` | Not used yet | Instant UI feedback for teacher "mark done" action |
| React 19 `useTransition` | Already in use (question form) | Wrap server action calls for non-blocking UI updates |
| `sonner` custom components | Only using basic toast | Rich toast with embedded graph preview for bridge discovery |

## Installation

```bash
# No new packages to install.
# All v1.1 features use existing dependencies.
```

## Schema Migration (Drizzle)

The only infrastructure change is a Drizzle schema addition for teacher workflow state:

```bash
# After adding new columns/table to packages/db/src/schema/:
pnpm --filter @mindmap/db drizzle-kit generate
pnpm --filter @mindmap/db drizzle-kit migrate
```

## Animation Technique Reference

For implementers, here are the specific patterns to use with existing tools:

### Scale-up animation (useFrame)
```typescript
// Easing function (no library needed)
function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// In useFrame:
const elapsed = clock.elapsedTime - birthTime;
const t = Math.min(elapsed / GROW_DURATION, 1);
const scale = targetRadius * easeOutElastic(t);
dummy.scale.setScalar(scale);
```

### Color birth glow (useFrame)
```typescript
// Bright white -> normal color over 1 second
const birthColor = new THREE.Color(1, 1, 1); // white
const targetColor = getNodeColor(node);
const lerpedColor = birthColor.clone().lerp(targetColor, t);
meshRef.current.setColorAt(instanceIndex, lerpedColor);
meshRef.current.instanceColor!.needsUpdate = true;
```

### Edge draw-in (component-level)
```typescript
// In SolarEdges, for new edges:
const drawProgress = Math.min((elapsed) / EDGE_DRAW_DURATION, 1);
const currentEnd = new THREE.Vector3().lerpVectors(srcPos, tgtPos, drawProgress);
// Pass [srcPos, currentEnd] to <Line> points prop
```

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| No new deps needed for graph animation | HIGH | Verified: InstancedMesh requires useFrame matrix manipulation; react-spring/motion cannot address this; existing pulse animation proves pattern works |
| framer-motion-3d incompatibility | HIGH | npm peer dep check: requires `@react-three/fiber: 8.2.2`, project uses ^9.5.0 |
| @react-spring/three React 19 compat | HIGH | npm peer dep check: `react: ^19.0.0` listed; compatible but unnecessary |
| React 19 useOptimistic availability | HIGH | Built into React 19; project already on React ^19.0.0 |
| GSAP already sufficient for 2D overlays | HIGH | Already installed and used in spiral-animation.tsx |
| Drei Sparkles for bridge discovery | MEDIUM | Feature exists in installed @react-three/drei ^10.7.7 but not yet used in codebase; needs integration testing with InstancedMesh scene |
| Teacher workflow via Server Actions | HIGH | Pattern matches existing themes-view.tsx architecture exactly |

## Sources

- Codebase analysis: `apps/web/components/graph/solar-scene.tsx` (existing useFrame animation patterns)
- Codebase analysis: `apps/web/components/graph/solar-nodes.tsx` (InstancedMesh rendering)
- Codebase analysis: `apps/web/components/graph/bridge-toast.tsx` (current bridge notification)
- Codebase analysis: `apps/web/components/dashboard/themes-view.tsx` (teacher dashboard state management)
- npm registry: `@react-spring/three@10.0.3` peer deps (React 19 compatible, R3F >=6.0)
- npm registry: `framer-motion-3d@12.4.13` peer deps (R3F 8.2.2 only -- incompatible)
- npm registry: `motion@12.38.0` (no R3F exports in main package)
- [React Three Fiber basic animations](https://r3f.docs.pmnd.rs/tutorials/basic-animations)
- [React Spring R3F guide](https://react-spring.dev/docs/guides/react-three-fiber)
- [Motion for R3F docs](https://motion.dev/docs/react-three-fiber) -- "currently only compatible with React 18"
- [Drei Sparkles docs](https://drei.docs.pmnd.rs/staging/sparkles)
- [R3F InstancedMesh + react-spring discussion](https://github.com/pmndrs/react-spring/discussions/1539)
- [Next.js Server Actions docs](https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations)

---

*Stack research for v1.1 Value Experience milestone*
*Researched: 2026-04-14*
