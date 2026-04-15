# Phase 9: Graph Animation - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

After a student submits a curiosity question and receives an answer, they are automatically transitioned to their knowledge graph where new concepts animate into existence — scaling up, drawing edges, and framing the camera — making graph growth the emotional reward for asking. Respects `prefers-reduced-motion`.

</domain>

<decisions>
## Implementation Decisions

### Transition Timing
- **D-01:** Auto-navigate to `/student/graph` ~2s after answer finishes streaming. No manual "Explore on graph" click needed for the primary flow (button remains as fallback).
- **D-02:** Show a brief "Your graph is growing..." transition message during the 2s delay before navigation.
- **D-03:** Pass new concept IDs and `animate=true` via URL search params so the graph page knows what to animate.

### Concept Readiness
- **D-04:** Poll `getTodayQuestionConcepts()` every 2s (reuses existing polling pattern from diagnostic session detection) with "Preparing your graph..." state.
- **D-05:** Max 5 poll attempts (10s total). If no concepts found, navigate to graph without animation — silent failure, graph shows normally.
- **D-06:** Start polling immediately in `onFinish` (don't wait for the 2s transition delay — poll and delay run in parallel).

### Animation Choreography
- **D-07:** Staggered node scale-up: each new node scales from 0 to final radius over 500ms, with 300ms stagger between nodes. Use existing `pulseDummy + setMatrixAt` pattern.
- **D-08:** Edge draw-in: after all nodes have settled (~1s after last node starts), edges draw progressively from source to target over 400ms each.
- **D-09:** Camera sequence: pull back to frame all new + nearby nodes, then smoothly frame to include new content. Reuse existing `targetPosition/targetLookAt` lerp pattern.
- **D-10:** Particle birth effect: Drei Sparkles at each new node position during scale-up, fading as node reaches final size.
- **D-11:** Full animation sequence duration: ~2-3s from first node appearing to camera settling.

### Growth Summary Overlay
- **D-12:** Floating card at bottom center (same position as existing HealthLegend), shows "+N concepts, +N connections" after animation completes.
- **D-13:** Card visible for 4s then fades out. Uses existing `bg-black/50 backdrop-blur-md border border-white/10` styling.
- **D-14:** Dismissed immediately on any graph interaction (click, drag, filter).

### InstancedMesh Buffer Management
- **D-15:** Over-allocate InstancedMesh buffer by 20 instances beyond current count (2-5 concepts per question). Set `mesh.count` to visible count. Remove `key={layoutNodes.length}` remount.
- **D-16:** Track new node birth timestamps in a `Map<number, number>` ref. useFrame checks age to interpolate scale from 0 → final.

### Force Layout Stability
- **D-17:** When new nodes arrive, preserve existing node positions. Pin existing nodes with `fx/fy/fz` for the first 50 ticks, then release. Only new nodes float into position via force simulation.
- **D-18:** Separate "incremental layout" mode from "initial layout" — initial does 300 ticks from scratch, incremental does 50 ticks with pinned existing nodes.

### Accessibility
- **D-19:** Check `prefers-reduced-motion` media query. When enabled: skip all animation, place nodes instantly at final positions, skip sparkles, show growth summary immediately. Camera jumps to final position instead of lerping.

### Claude's Discretion
- Exact easing curves for node scale-up (linear, ease-out, spring)
- Sparkles particle count and color
- Growth summary card exact layout and typography
- Camera pull-back distance calculation
- Whether to reduce Bloom intensity during animation for mobile performance
- Edge draw-in easing (linear progress or ease-in)

</decisions>

<specifics>
## Specific Ideas

- The graph growing should feel like "planting stars" — each new concept appearing as a point of light expanding into its full form
- The transition from answer page to graph should feel seamless, not like a page load — minimize flash of empty state
- Research flagged: d3-force-3d resets all positions on re-run. This MUST be solved (D-17/D-18) or existing nodes will scatter when new ones arrive.
- Research flagged: setState in useFrame kills FPS. All animation state must live in refs (D-16).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Graph rendering system
- `apps/web/components/graph/solar-scene.tsx` — useFrame loop, pulse animation pattern, camera fly-to
- `apps/web/components/graph/solar-nodes.tsx` — InstancedMesh rendering, getNodeRadius, getNodeColor
- `apps/web/components/graph/solar-edges.tsx` — Per-edge Line components, weight-based styling
- `apps/web/components/graph/solar-graph.tsx` — Canvas setup, Bloom postprocessing, OrbitControls

### Layout engine
- `apps/web/components/graph/use-graph-layout.ts` — d3-force-3d simulation, 300-tick sync, domain galaxies

### Data flow
- `apps/web/components/questions/question-form.tsx` — onFinish callback, concept polling, router.push
- `apps/web/app/student/graph/graph-page-client.tsx` — ?node= URL param handling, state management
- `apps/web/actions/graph.ts` — getGraphData server action
- `apps/web/actions/questions.ts` — getTodayQuestionConcepts server action

### Research
- `.planning/research/PITFALLS.md` — Critical pitfalls for graph animation (InstancedMesh buffer, force layout, FPS)
- `.planning/research/ARCHITECTURE.md` — Integration approach, Option B (page transition with params)
- `.planning/research/STACK.md` — No new deps needed, existing useFrame/Drei patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Pulse animation pattern** (`solar-scene.tsx`): `pulseDummy + setMatrixAt + elapsed-time tracking` — directly reusable for scale-up animation
- **Camera fly-to** (`solar-scene.tsx`): `targetPosition.lerp(target, 0.06)` — reusable for framing new content
- **meshRef callback pattern**: Parent↔Child animation sync via ref — reusable for coordinating multi-component animation
- **URL param handling** (`graph-page-client.tsx`): `useSearchParams().get("node")` already wired — extend for `animate` and `newNodes` params
- **Concept polling** (`question-form.tsx`): Dynamic import + retry loop — reusable pattern for concept readiness

### Established Patterns
- All animation state in refs, never useState (FPS critical)
- InstancedMesh with Object3D dummy for per-instance transforms
- Bloom with luminance threshold 0.7, color multipliers 3-6x for glow
- 10-frame throttle for non-critical per-frame updates (proximity labels)

### Integration Points
- `question-form.tsx` onFinish → auto-navigate with params
- `graph-page-client.tsx` → parse new URL params, pass animation state to KnowledgeGraph
- `solar-scene.tsx` → extend useFrame loop for birth animations
- `solar-nodes.tsx` → over-allocate buffer, track birth timestamps
- `use-graph-layout.ts` → add incremental layout mode

</code_context>

<deferred>
## Deferred Ideas

- Inline mini-graph on the student page (Option A) — evaluate after page-transition approach ships
- Sound effects for node births — accessibility concerns, investigate later
- Graph growth replay ("watch your graph grow over 30 days") — separate feature

</deferred>

---

*Phase: 09-graph-animation*
*Context gathered: 2026-04-15*
