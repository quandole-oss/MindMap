# Domain Pitfalls: v1.1 Value Experience

**Domain:** Adding graph animation, bridge discovery UX, and teacher action loop to existing R3F + Next.js education app
**Researched:** 2026-04-14
**Milestone:** v1.1 Value Experience
**Confidence:** HIGH (R3F/Three.js pitfalls verified against official docs + codebase), MEDIUM (Next.js real-time patterns), MEDIUM (teacher workflow state machines)

---

## Critical Pitfalls

These cause rewrites, broken features, or unfixable performance regressions if not addressed upfront.

---

### Pitfall 1: InstancedMesh Count Cannot Grow — Graph Animation Requires Mesh Recreation

**What goes wrong:**
The "graph-as-hero" feature needs to animate new nodes flying into the graph after a question is asked. The current `SolarNodes` component uses `THREE.InstancedMesh` with `args={[undefined, undefined, layoutNodes.length]}` and a `key={layoutNodes.length}` prop. When new concepts arrive, `layoutNodes.length` increases, but Three.js `InstancedMesh.count` cannot be increased beyond the buffer size allocated at construction time. You can decrease `count` (hide instances), but increasing it requires destroying and recreating the entire mesh with a larger buffer. The current `key={layoutNodes.length}` actually does force remounting on count change — but remounting destroys ALL animation state (positions, colors, matrices) and causes a visible flash/reset of the entire graph.

**Why it happens:**
Three.js allocates fixed-size `Float32Array` buffers (`instanceMatrix`, `instanceColor`) at construction based on the initial count. These WebGL buffer objects cannot be resized in-place. The R3F community documents this as a fundamental constraint, not a bug.

**Consequences:**
- Naive approach: change `layoutNodes.length` prop, mesh remounts, entire graph pops/flickers
- Students see the "reward" animation as a jarring reset instead of smooth growth
- On mobile (375px viewport, limited GPU), the mesh recreation + re-upload of all matrices causes a frame budget spike

**Prevention:**
1. **Over-allocate the InstancedMesh buffer.** Set `args` to `[undefined, undefined, layoutNodes.length + GROWTH_BUFFER]` where `GROWTH_BUFFER` is 20-50. Set `mesh.count = layoutNodes.length` (the visible count). When new nodes arrive, increment `count` and set the new instance matrices — no mesh recreation needed.
2. **Remove the `key={layoutNodes.length}` pattern** once over-allocation is in place. The key-based remount is currently the only thing that "works" but it defeats animation.
3. **When buffer is exhausted** (more than `GROWTH_BUFFER` new nodes at once), recreate the mesh with a larger buffer and cross-fade: render both old and new meshes for 2-3 frames, then dispose the old one. This should be rare (students add 2-5 concepts per question, not 50).
4. **Initialize new instance matrices at the camera position** (not at origin) and lerp them to their layout target over 30-60 frames. This produces the "fly-in" effect.

**Detection:**
- Flash/flicker when graph updates after asking a question
- New nodes appear at origin (0,0,0) then jump to position
- Frame rate drops on mesh recreation (profile with `r3f-perf`)

**Codebase locations:** `apps/web/components/graph/solar-nodes.tsx:117` (key prop), `solar-nodes.tsx:80-96` (matrix initialization)

**Phase to address:** Graph Animation phase (first)

---

### Pitfall 2: useFrame setState Loop Kills Frame Rate During Animation

**What goes wrong:**
To animate new nodes flying in, a developer calls `useState` or `useReducer` to track animation progress, then reads that state in `useFrame`. Each `setState` call triggers a full React reconciliation — at 60fps, this means 60 React renders per second across the entire `SolarScene` component tree. The graph drops from 60fps to 15-20fps during animation, exactly when smooth motion matters most.

**Why it happens:**
This is the #1 documented pitfall in the official React Three Fiber documentation. The pattern feels natural to React developers: "I need to track animation state, so I use React state." But Three.js mutations (position, scale, color, matrix) bypass React entirely — they write directly to GPU buffers. Routing these through React's scheduler adds 5-15ms per frame of pure overhead.

**Consequences:**
- Janky animation during the "hero moment" (new nodes flying in)
- Bloom postprocessing amplifies frame drops (each dropped frame is visible as stuttering glow)
- Mobile devices (the 375px target) hit GPU thermal throttling

**Prevention:**
1. **All animation state must live in `useRef`, not `useState`.** Current code already does this correctly for `pulseRef`, `isFlying`, `targetPosition` — extend this pattern to new-node fly-in animation.
2. **Use delta-based animation:** `position.lerp(target, delta * speed)` not `position.lerp(target, 0.06)` (the current camera lerp uses a fixed 0.06 factor, which is refresh-rate-dependent — works on 60Hz, too fast on 120Hz, too slow on 30Hz).
3. **Batch InstancedMesh updates.** Call `meshRef.current.setMatrixAt(i, matrix)` for all animating nodes in a single `useFrame` callback, then set `instanceMatrix.needsUpdate = true` once. Do NOT set `needsUpdate` per-node.
4. **Do not use `setNearbyNodes()` (the current proximity label update) during active animation.** The existing code already throttles to every 10 frames, but during a fly-in animation, even this triggers React re-renders that interrupt the animation. Add a `isAnimating.current` ref guard.

**Detection:**
- Use `r3f-perf` or browser performance panel during graph updates
- Watch for `React.setState` calls in the flame chart during animation frames
- Proximity labels flickering during node fly-in

**Codebase locations:** `solar-scene.tsx:260-275` (setNearbyNodes in useFrame), `solar-scene.tsx:277-293` (camera lerp with fixed factor)

**Phase to address:** Graph Animation phase (first)

---

### Pitfall 3: d3-force-3d Layout Recomputes Entire Graph on New Nodes — Destroys Existing Positions

**What goes wrong:**
The current `useGraphLayout` hook runs `simulation.tick(300)` synchronously inside `useMemo` on every change to the `nodes` or `edges` arrays. When new concepts are added, the entire force simulation re-runs from scratch with fresh random initial positions for ALL nodes. Every existing node jumps to a new position because the simulation converges to a different local minimum. The "graph-as-hero" animation becomes "graph-as-earthquake."

**Why it happens:**
d3-force-3d mutates node objects in place, setting `x`, `y`, `z` during simulation. The current code deep-clones nodes before simulation (`nodes.map((n) => ({ ...n }))`), which means existing node positions are lost between renders. The simulation starts every node from scratch each time.

**Consequences:**
- After asking a question, the entire graph reshuffles — existing nodes jump to random new positions
- The student loses spatial memory ("my chemistry concepts were over there")
- Bridge connections visually break and reform in different orientations
- Animation of "new nodes flying in" is impossible if existing nodes are also moving

**Prevention:**
1. **Preserve existing node positions across layout runs.** Before running the simulation, copy `x`, `y`, `z` from the previous layout result onto matching nodes (by id). Only new nodes get random initial positions.
2. **Pin existing nodes during the initial simulation phase.** Set `fx`, `fy`, `fz` (fixed position) on existing nodes for the first ~50 ticks, then release them and run 50 more ticks. This lets new nodes settle into the existing structure without disrupting it.
3. **Run the simulation incrementally.** Instead of `tick(300)` synchronously, run `tick(50)` initially, then use `requestAnimationFrame` or `useFrame` to tick 1-2 steps per frame for the "settling" animation. This makes layout changes visible as smooth motion rather than an instant jump.
4. **Separate "initial layout" (first render) from "incremental layout" (new nodes added).** Initial layout runs the full 300 ticks. Incremental layout pins existing nodes and runs 100 ticks.

**Detection:**
- After asking a question, all nodes jump to new positions
- Spatial clusters (domain galaxies) rearrange on every page refresh
- The `useMemo` dependency on `[nodes, edges]` fires on every graph data change

**Codebase locations:** `apps/web/components/graph/use-graph-layout.ts:72-116` (entire layout hook)

**Phase to address:** Graph Animation phase (first — must be solved before any fly-in animation work)

---

### Pitfall 4: onFinish Silent Failure Creates "Ghost Animations" — Graph Updates Without Data

**What goes wrong:**
The "graph-as-hero" feature needs the client to know when new concepts have been persisted so it can animate them flying in. But the current `/api/ask` route streams the answer immediately via `streamText`, then runs ALL concept extraction and persistence in an `onFinish` callback (lines 93-341). This callback: (a) has no mechanism to notify the client when it completes, (b) silently swallows all errors in a single try/catch, and (c) takes 2-8 seconds to complete after the stream ends.

If you implement optimistic graph animation based on the stream ending, the new nodes don't exist in the database yet. If you poll for them, you race against the 2-8 second pipeline. If the pipeline fails silently, you animate "phantom nodes" that don't exist.

**Why it happens:**
The `onFinish` pattern was designed for fire-and-forget background processing. The original design didn't need the client to know when processing completed — the student navigated to the graph page later. But "graph-as-hero" requires real-time coordination between the background pipeline and the client animation.

**Consequences:**
- Student sees "New concepts added" toast but graph shows no new nodes (pipeline still running or failed)
- Graph animation triggers before data is persisted, then nodes vanish on next data fetch
- Silent failures mean concepts are never extracted but the student thinks they were
- Race condition: polling fetches stale data, animation never fires

**Prevention:**
1. **Do NOT try to make onFinish notify the client.** The streaming response is already closed when onFinish runs. Instead:
2. **Option A (Recommended): Two-phase response.** Stream the answer text, then after the stream, return a structured JSON epilogue with the new concept IDs. Requires switching from `useCompletion` (text-only) to `useChat` with tool calls or a custom streaming protocol that appends a JSON trailer.
3. **Option B: Server-Sent Events (SSE) sidecar.** After the stream completes, open a separate SSE connection that listens for a "concepts-ready" event. The onFinish callback publishes to a lightweight pub/sub (even a database polling row works for single-server deployments).
4. **Option C: Smart polling with exponential backoff.** The current code already polls 3 times at 2-second intervals for diagnostic sessions (question-form.tsx:88-99). Extend this pattern: after stream ends, poll `getTodayQuestionConcepts()` every 1.5s, up to 5 attempts. Trigger animation when new concepts appear. This is the simplest change but adds 1.5-7.5 seconds of delay.
5. **Whichever approach: handle the failure case.** If concepts don't appear after timeout, show a subtle "Your concepts are still processing" message, not a broken empty animation.

**Detection:**
- "Explore on your graph" button navigates to graph with no new nodes visible
- Console shows `[onFinish] concept extraction failed` but student sees success UI
- New concepts appear on graph only after a manual page refresh

**Codebase locations:** `apps/web/app/api/ask/route.ts:89-342` (onFinish), `apps/web/components/questions/question-form.tsx:69-111` (onFinish client handler, polling)

**Phase to address:** Graph Animation phase (must be solved before animation — you need to know WHAT to animate)

---

### Pitfall 5: Drei `<Line>` Per-Edge Renders Create O(N) Draw Calls — Blocks Edge Animation at Scale

**What goes wrong:**
The current `SolarEdges` component renders each edge as a separate `<Line>` component from `@react-three/drei`. Each `<Line>` is a separate Three.js `Line2` object with its own material and geometry — meaning each edge is a separate GPU draw call. With 50 edges this is fine. With 200+ edges (a student with 100+ concepts), the scene hits 200+ draw calls just for edges, plus the InstancedMesh draw call for nodes, plus the bloom postprocessing pass. GPU frame budget is blown.

Adding animation (edges growing/fading in) to individual `<Line>` components means mutating 200+ separate objects per frame, which cannot be batched.

**Why it happens:**
`<Line>` from drei is designed for convenience, not performance at scale. It wraps `Line2` which supports variable-width lines (the current code uses `lineWidth` per edge type). But each instance is a separate draw call because Three.js has no "InstancedLine" equivalent to InstancedMesh.

**Consequences:**
- Edge animation (grow-in, fade-in) is janky with 100+ edges
- Mobile GPU budget exceeded — frame drops below 30fps
- Adding new edges during fly-in animation compounds the problem

**Prevention:**
1. **For static edges (existing before the question), use a single `BufferGeometry` with `LineSegments`.** Merge all edge positions into one `Float32Array`. This is ONE draw call for all edges. Color per-edge via vertex colors.
2. **For animated edges (new edges forming), use a small set of individual `<Line>` components** (typically 3-8 new edges per question). Animate these with opacity 0 -> 1 and length 0 -> full over 500ms. Once animation completes, merge them into the static buffer.
3. **Accept losing variable `lineWidth` on static edges.** `LineSegments` uses `linewidth` which is GPU-capped at 1px on most hardware. For static edges this is acceptable — the visual difference between 0.5px and 2.5px edges is minimal at the scale of a 200-node graph. Keep variable width only for the few animated edges.
4. **Alternative: keep `<Line>` but limit edge count.** If the graph has 200+ edges, show only the top-N by weight (e.g., top 100 edges + all bridge/misconception edges). This is a product decision but may be acceptable.

**Detection:**
- GPU profiler shows 100+ draw calls from edge rendering
- Frame rate drops as student accumulates more concepts
- Edge animation stutters while node animation is smooth

**Codebase locations:** `apps/web/components/graph/solar-edges.tsx:77-101` (individual Line render)

**Phase to address:** Graph Animation phase (optimize before adding animation, or animation will be DOA)

---

## Moderate Pitfalls

These cause visible quality issues, wasted effort, or tech debt that blocks future work.

---

### Pitfall 6: Bridge Toast Dismissal Means Students Miss the "Surprise Connection" Moment Entirely

**What goes wrong:**
The current bridge detection surfaces discoveries via a `sonner` toast that auto-dismisses after 8 seconds, with a 7-day cooldown stored in localStorage. The v1.1 goal is to make bridge discoveries "prominent" and "unmissable." But if the toast fires while the student is reading their answer (the first 8 seconds after asking), they never see it. The 7-day cooldown means they won't see it again for a week. The entire "surprise connection" feature is invisible to most students.

**Why it happens:**
Toasts are designed for transient, non-critical notifications. Bridge discovery is a core value moment — treating it as a toast was appropriate for v1.0 (better than nothing) but is architecturally wrong for v1.1.

**Consequences:**
- Most students never notice bridge connections
- The "surprise" is anti-climactic even when noticed (8-second auto-dismiss, small text)
- Teacher value proposition weakened ("students don't seem to care about connections")

**Prevention:**
1. **Replace toast with an in-graph visual event.** When a bridge is detected after a question: (a) camera automatically flies to the bridge node, (b) a brief "connection discovered" animation plays (particles, glow pulse, or edge highlight), (c) a persistent but dismissible overlay shows the connection explanation.
2. **Time the bridge reveal to happen AFTER the graph fly-in animation.** First animate new nodes appearing, then pause 500ms, then reveal the bridge connection. This creates a narrative arc: "You learned new things -> and they connect to something unexpected!"
3. **Remove the localStorage cooldown** for the new surface. The old cooldown was to prevent toast fatigue. An in-graph event is not fatiguing — it's the reward.
4. **Keep the toast as a fallback** for when the student is NOT on the graph page (e.g., on the questions page). But the graph page should use the full visual treatment.

**Detection:**
- Analytics/observation shows students clicking "Explore on graph" but never interacting with bridge nodes
- Teacher feedback: "students don't mention connections"

**Codebase locations:** `apps/web/components/graph/bridge-toast.tsx` (entire component), `apps/web/app/student/graph/graph-page-client.tsx:97-105` (BridgeToast mount)

**Phase to address:** Bridge Discovery phase (second)

---

### Pitfall 7: Teacher "Mark Done" Without Re-probe Creates False Resolution Signal

**What goes wrong:**
The teacher action loop is: cluster -> activity -> mark done -> re-probe. If "mark done" simply sets `outcome: 'resolved'` on diagnostic sessions without re-probing the students, the teacher dashboard shows improvement that hasn't been verified. The misconception may still be present. Teachers lose trust in the system when "resolved" students demonstrate the same misconception again later.

**Why it happens:**
"Mark done" is the easy part to implement. Re-probe (creating new diagnostic sessions that test whether the classroom activity actually changed student understanding) requires: (a) a mechanism to create diagnostic sessions without a student question trigger, (b) determining WHICH students to re-probe (all affected? only unresolved?), (c) waiting for students to complete re-probe sessions before updating the dashboard. Developers implement "mark done" first and defer re-probe "for later" — but without re-probe, "mark done" is meaningless.

**Consequences:**
- Teacher dashboard shows false positives (misconceptions marked resolved without evidence)
- System credibility erodes when "resolved" misconceptions reappear
- The action loop becomes "cluster -> activity -> click button -> forget about it"

**Prevention:**
1. **Design "mark done" as a two-step process from the start.** Step 1: Teacher marks activity as "delivered" (a teaching event). Step 2: System creates re-probe diagnostic sessions for affected students. Step 3: As students complete re-probes, outcomes update automatically.
2. **"Mark done" should change the activity status, NOT the diagnostic session outcomes.** Introduce a `teacher_activities` table that tracks: theme/misconception, classId, status (planned/delivered/verified), deliveredAt, verifiedAt. Diagnostic session outcomes should only change when students complete re-probe conversations.
3. **Show the teacher a clear distinction:** "Activity delivered (3 students re-probed, 2 resolved, 1 still struggling)" vs the current binary resolved/unresolved.
4. **Make re-probe opt-in for students** (not forced). Show a prompt on their next visit: "Your teacher did an activity about X — want to explore your understanding?" This respects student agency and avoids forced testing.

**Detection:**
- Dashboard shows 100% resolution rate after teacher clicks "mark done" (too good to be true)
- No new diagnostic sessions created after activity delivery
- Students never see re-probe prompts

**Phase to address:** Teacher Action Loop phase (third)

---

### Pitfall 8: Graph Animation + Bloom Postprocessing = Mobile Frame Budget Exceeded

**What goes wrong:**
The current scene runs `EffectComposer > Bloom` with `intensity={1.5}` and `mipmapBlur`. Bloom is a multi-pass shader effect: it extracts bright pixels, downsamples through a mip chain, blurs each level, then composites back. This is already expensive on mobile GPUs (fills the entire framebuffer 6-8 times per frame). Adding per-frame animation (node position lerps, edge fading, camera movement) on top pushes the GPU past its frame budget. On a 375px viewport, even with `dpr={[1, 2]}`, the bloom pass renders at device resolution.

**Why it happens:**
Bloom looks spectacular on desktop but is disproportionately expensive on mobile. The `mipmapBlur` option trades quality for some performance, but the fundamental cost is multi-pass fullscreen rendering. Developers test on MacBook Pro GPUs and don't notice the problem until testing on actual mobile devices.

**Consequences:**
- Animation stutters on mobile during graph updates
- Battery drain accelerates (GPU at sustained high load)
- Thermal throttling kicks in after 30 seconds, making subsequent interactions worse

**Prevention:**
1. **Disable or reduce Bloom during active animation.** When `isAnimating.current` is true, either remove the `<Bloom>` effect entirely or reduce `intensity` to 0.3 and set `luminanceThreshold` to 0.95 (barely visible). Restore full bloom after animation settles.
2. **Use `dpr={1}` on mobile during animation.** The `Canvas` already has `dpr={[1, 2]}` which lets R3F choose. During animation, force `dpr={1}` via `gl.setPixelRatio(1)` to halve the pixel count for bloom passes.
3. **Test on actual mobile hardware.** Use Chrome DevTools mobile throttling (4x CPU, slow 3G) as a minimum, but actual device testing is irreplaceable. iOS Safari has different WebGL limits than Chrome.
4. **Consider `frameloop="demand"` when the graph is idle.** Only render frames when the user interacts or animation is active. The current setup renders 60fps continuously even when the student is just reading.

**Detection:**
- FPS drops below 30 on mobile during graph updates
- `r3f-perf` shows bloom pass taking >8ms per frame
- Device feels hot during graph page usage

**Codebase locations:** `apps/web/components/graph/solar-graph.tsx:65-70` (EffectComposer + Bloom)

**Phase to address:** Graph Animation phase (first — profile before adding animation)

---

### Pitfall 9: teacher_activities Table Missing — No Schema for Activity Tracking

**What goes wrong:**
The teacher action loop requires tracking: which misconceptions/themes the teacher addressed, when they delivered classroom activities, which students were targeted, and whether re-probing has been scheduled/completed. None of this exists in the current schema. The closest is `themeLessonPlans` (stores generated lesson plans) and `diagnosticSessions` (stores individual student diagnostic outcomes). There is no table for teacher-initiated classroom activities.

**Why it happens:**
v1.0 was read-only for teachers — they viewed data but never wrote actions back. The action loop introduces teacher WRITE operations for the first time. This requires new tables, new server actions, and new authorization patterns (teacher writes that affect student data).

**Consequences:**
- Without proper schema design upfront, the action loop devolves into ad-hoc state scattered across multiple tables
- "Mark done" becomes a flag on `themeLessonPlans` (wrong abstraction — a lesson plan is not an activity record)
- Re-probe tracking has nowhere to live
- Multiple teachers in future (if the same student is in two classes) have no isolation

**Prevention:**
1. **Design the `teacher_activities` table before writing any UI code.** Suggested schema:
   - `id`, `classId`, `themeId` (or `misconceptionId`), `teacherId`
   - `status` enum: `planned | delivered | re_probing | verified`
   - `affectedStudentIds` (array or join table)
   - `deliveredAt`, `verifiedAt`
   - `lessonPlanId` (FK to `themeLessonPlans`, nullable)
2. **Add a `teacher_re_probes` table** (or join to `diagnostic_sessions`):
   - `activityId`, `studentId`, `diagnosticSessionId`, `outcome`
   - This links the teacher's activity to individual student re-probe results
3. **Migration-first development.** Write the Drizzle schema + migration before any server action code. The current codebase has only one migration file and uses `drizzle-kit push` — this is fine for development but the schema must be right before pushing.

**Detection:**
- Developer finds themselves adding columns to `themeLessonPlans` for activity tracking
- "Mark done" has no persistent state beyond the client
- Re-probe sessions cannot be distinguished from organic diagnostic sessions

**Phase to address:** Teacher Action Loop phase (third — schema design first task)

---

### Pitfall 10: Camera Lerp Fixed Factor Breaks on High Refresh Rate Displays

**What goes wrong:**
The current camera fly-to uses `camera.position.lerp(targetPosition.current, 0.06)` inside `useFrame`. On a 60Hz display, this produces a ~1 second fly animation. On a 120Hz display (iPad Pro, modern iPhones, gaming monitors), the lerp runs twice as many frames at the same factor, completing in ~0.5 seconds (too fast, feels abrupt). On a 30Hz throttled mobile device, it takes ~2 seconds (too slow, feels broken).

**Why it happens:**
Linear interpolation with a fixed factor per-frame is refresh-rate-dependent. The official R3F documentation specifically warns about this: "Use deltas instead of fixed values so that your app is refresh-rate independent."

**Consequences:**
- Animation feels different on every device
- On high-refresh-rate displays, the camera snap looks jarring
- On throttled mobile, the camera crawl feels sluggish during the "hero moment"

**Prevention:**
1. **Replace fixed-factor lerp with delta-based damping.** Instead of `lerp(target, 0.06)`, use:
   ```typescript
   const dampingFactor = 1 - Math.pow(0.001, delta); // delta from useFrame
   camera.position.lerp(targetPosition.current, dampingFactor);
   ```
   This produces consistent-duration animation regardless of refresh rate.
2. **Apply the same fix to the bridge pulse animation** and any new fly-in animations.
3. **Test on multiple refresh rates.** Chrome DevTools allows setting custom refresh rates in the rendering panel.

**Codebase locations:** `apps/web/components/graph/solar-scene.tsx:278` (camera lerp), `solar-scene.tsx:282` (controls target lerp)

**Phase to address:** Graph Animation phase (fix during animation work)

---

## Minor Pitfalls

These cause confusion, wasted debugging time, or small UX issues.

---

### Pitfall 11: Missing DB Indexes Will Make Dashboard Slow During Re-probe Queries

**What goes wrong:**
The existing CONCERNS.md documents missing indexes on `concepts.userId` and `conceptQuestions` join columns. These are already a performance issue for v1.0. The teacher action loop adds MORE queries against these tables: "find all diagnostic sessions for students in class X who were affected by misconception Y" requires joining `classEnrollments`, `diagnosticSessions`, and `concepts`. Without indexes, these queries degrade as class sizes grow.

**Prevention:**
Add the three missing indexes documented in CONCERNS.md BEFORE building any new teacher query actions:
1. `concepts.userId` index
2. `conceptQuestions.conceptId` and `conceptQuestions.questionId` indexes
3. `classEnrollments.studentId` standalone index

**Phase to address:** Any phase (standalone migration, do first)

---

### Pitfall 12: Graph Page SSR Fetch Defeats Animation — Data is Stale on Mount

**What goes wrong:**
The current graph page (`/student/graph/page.tsx`) fetches data at server render time via `getGraphData()` and `getBridgeConnection()`. The data is passed as props to `GraphPageClient`. When a student asks a question and then clicks "Explore on your graph," the navigation triggers a full server render with the LATEST data. There is no "before" state to animate FROM — the graph mounts already showing the new nodes in their final positions.

**Why it happens:**
Server-side rendering provides fresh data on every navigation. For static display, this is ideal. For animation ("show me what changed"), you need both the before-state and after-state, which requires client-side state management that persists across navigations or a diff mechanism.

**Prevention:**
1. **Client-side graph data management.** Instead of fetching in the server component, fetch via a client-side hook (`useSWR` or manual `useEffect`). Store the previous graph data in a ref. When new data arrives, diff to find new nodes/edges and animate those.
2. **Alternative: pass "new concept IDs" via URL params.** When navigating from question page to graph, include `?newConcepts=id1,id2,id3`. The graph page mounts with all data but marks those IDs as "animate-in." No need for before/after diff.
3. **Alternative: use `router.push` with shallow routing + `revalidatePath`.** Keep the graph data in client state, use `revalidatePath('/student/graph')` from the question submission, and detect changes client-side.

**Detection:**
- Graph always mounts showing all nodes in final positions, no fly-in animation visible
- No way to distinguish "new" nodes from "existing" ones at mount time

**Codebase locations:** `apps/web/app/student/graph/page.tsx:16-19` (server-side fetch), `graph-page-client.tsx:27` (receives data as props)

**Phase to address:** Graph Animation phase (fundamental architecture decision)

---

### Pitfall 13: Proximity Labels (`<Html>`) During Animation Create DOM Thrash

**What goes wrong:**
The current `SolarScene` renders up to 12 proximity labels using drei's `<Html>` component, which creates real DOM elements overlaid on the WebGL canvas. During node fly-in animation, node positions change every frame. The proximity label update (every 10 frames) recalculates which nodes are "nearby" and triggers React re-renders to mount/unmount `<Html>` elements. Each mount/unmount is a DOM operation that competes with the GPU for the main thread.

**Prevention:**
1. Suppress proximity label updates entirely during active animation (check `isAnimating.current` ref).
2. Resume proximity labels only after animation settles.
3. Consider using Three.js `TextGeometry` or SDF text (via troika-three-text) for labels that live entirely in the WebGL context, avoiding DOM/WebGL synchronization overhead.

**Codebase locations:** `apps/web/components/graph/solar-scene.tsx:253-275` (proximity label update logic), `solar-scene.tsx:413-437` (Html label rendering)

**Phase to address:** Graph Animation phase

---

### Pitfall 14: `experimental_output` Throughout LLM Layer — Breaking Change Risk During v1.1

**What goes wrong:**
The CONCERNS.md documents that every structured output call in the LLM layer uses `experimental_output: Output.object(...)` instead of the stable `generateObject` API. During v1.1 development (which will take weeks), a Vercel AI SDK update could deprecate or change the `experimental_output` API, breaking the concept extraction pipeline that feeds the graph animation feature.

**Prevention:**
Migrate all `experimental_output` calls to `generateObject` before starting v1.1 feature work. This is a low-risk, high-value cleanup that prevents mid-milestone breakage. The migration is mechanical — `generateObject` with a Zod schema is the stable replacement.

**Codebase locations:** Listed in CONCERNS.md: `packages/llm/src/prompts/extract.ts`, `disambiguate.ts`, `diagnose-resolve.ts`, `generate-lesson-plan.ts`, `analyze-student-themes.ts`, `packages/router/src/semantic-fallback.ts`

**Phase to address:** Pre-work before any v1.1 phase (housekeeping)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Graph Animation: Node Fly-in | InstancedMesh buffer cannot grow (Pitfall 1) | CRITICAL | Over-allocate buffer, remove key-based remount |
| Graph Animation: Node Fly-in | d3-force-3d resets all positions (Pitfall 3) | CRITICAL | Preserve existing positions, pin nodes during incremental layout |
| Graph Animation: Node Fly-in | No client notification when concepts ready (Pitfall 4) | CRITICAL | Polling or two-phase response |
| Graph Animation: Node Fly-in | Graph page SSR defeats animation (Pitfall 12) | MODERATE | Client-side data management or URL-param approach |
| Graph Animation: Performance | setState in useFrame (Pitfall 2) | CRITICAL | All animation state in refs, not React state |
| Graph Animation: Performance | Bloom + animation on mobile (Pitfall 8) | MODERATE | Reduce bloom during animation |
| Graph Animation: Performance | Per-edge Line components (Pitfall 5) | MODERATE | Batch into LineSegments or limit count |
| Graph Animation: Performance | Camera lerp refresh-rate dependent (Pitfall 10) | MINOR | Delta-based damping |
| Graph Animation: Performance | Proximity label DOM thrash (Pitfall 13) | MINOR | Suppress during animation |
| Bridge Discovery | Toast is wrong surface (Pitfall 6) | MODERATE | In-graph visual event, not toast |
| Teacher Action Loop | Mark done without re-probe (Pitfall 7) | MODERATE | Design two-step process upfront |
| Teacher Action Loop | No schema for activities (Pitfall 9) | MODERATE | Design table before UI |
| Teacher Action Loop | Missing DB indexes (Pitfall 11) | MINOR | Add indexes in migration first |
| All Phases | experimental_output breaking change (Pitfall 14) | MINOR | Migrate before starting features |

---

## Sources

- [R3F Performance Pitfalls (official)](https://r3f.docs.pmnd.rs/advanced/pitfalls) — setState in useFrame, delta-based animation, mount/unmount costs
- [R3F Scaling Performance (official)](https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance) — instancing, draw call reduction
- [Three.js InstancedMesh.count docs](https://threejs.org/docs/#api/en/objects/InstancedMesh.count) — count can decrease but buffer is fixed
- [R3F Discussion #1576](https://github.com/pmndrs/react-three-fiber/discussions/1576) — dynamic InstancedMesh count challenges
- [Three.js forum: dynamic instancecount](https://discourse.threejs.org/t/modified-three-instancedmesh-dynamically-instancecount/18124) — buffer reallocation requirements
- [Vercel AI SDK useCompletion docs](https://ai-sdk.dev/docs/ai-sdk-ui/completion) — onFinish callback behavior
- [Next.js SSE in API routes](https://github.com/vercel/next.js/discussions/48427) — SSE streaming patterns
- [Building Efficient Three.js Scenes (Codrops, Feb 2025)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/) — mobile GPU optimization
- [React Postprocessing Bloom docs](https://react-postprocessing.docs.pmnd.rs/effects/bloom) — selective bloom, performance tradeoffs
- MindMap codebase analysis (CONCERNS.md, component source) — HIGH confidence, direct code inspection

---

*Pitfalls audit: 2026-04-14 — v1.1 Value Experience milestone*
