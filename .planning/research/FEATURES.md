# Feature Landscape: v1.1 Value Experience

**Domain:** Graph animation, connection surfacing, and teacher action loops in K-12 education / knowledge-graph tools
**Researched:** 2026-04-14
**Confidence:** MEDIUM-HIGH (animation patterns from well-documented R3F/UX ecosystem; teacher action loop from MTSS/RTI industry patterns; connection surfacing from education knowledge graph research)

---

## Context: What Exists Today

Before defining features, here is what the codebase already has:

| Existing Feature | Implementation | Relevance to v1.1 |
|-----------------|----------------|-------------------|
| 3D solar system graph (React Three Fiber) | `solar-graph.tsx`, `solar-scene.tsx` with InstancedMesh, Bloom post-processing, OrbitControls | Direct target for Feature 1 (graph-as-hero animation) |
| Bridge toast (Sonner, 8s, dismissable) | `bridge-toast.tsx` with 7-day localStorage cooldown | Must be replaced by Feature 2 (prominent insight moment) |
| Camera fly-to on node click | `solar-scene.tsx` useFrame lerp loop | Reusable for Feature 1 and Feature 2 animations |
| Node pulse animation | `solar-scene.tsx` sine-wave scale pulse on InstancedMesh | Template for new node birth animation |
| Misconception clusters + themes | `misconceptions-tab.tsx`, `themes-view.tsx` with drill-down, affected students | Foundation for Feature 3 (teacher action loop) |
| Lesson plan generation | `lesson-plan-card.tsx` with generate/regenerate, cached in `theme_lesson_plans` table | Extends into classroom activity suggestions |
| "Explore on graph" button | `question-form.tsx` post-answer CTA | Must be replaced by Feature 1 (auto-navigate to graph) |
| Graph data: nodes, edges, betweenness centrality | `actions/graph.ts` with importance scoring | Provides data needed for bridge detection and new-node identification |

---

## Feature 1: Graph-as-Hero (Animated Graph Growth)

### What This Means

After a student asks their daily question and the AI responds, instead of showing "Explore on graph" as a secondary button, the experience transitions to the knowledge graph automatically and animates the new nodes and edges growing into existence. The visual expansion of the student's knowledge universe IS the reward -- not the text answer.

### Table Stakes for Graph Animation

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| New nodes scale up from zero | Every graph tool that adds nodes animates them in. Instant pop-in feels broken. Research (NNGroup): animations 200-500ms for element appearance. | LOW | Existing InstancedMesh + useFrame loop |
| New edges draw in progressively | Edges that snap into existence break spatial continuity. Line-draw animation from source to target is standard. | LOW | Existing `SolarEdges` component |
| Camera auto-frames to show new content | User should not have to manually pan to find what changed. Obsidian graph view, InfraNodus, and Neo4j all auto-center on changes. | LOW | Existing fly-to lerp in `solar-scene.tsx` |
| Staggered reveal (not simultaneous) | Cognitive load research: sequential animation prevents overwhelm. Animate primary node first, then edges, then connected nodes. 100-200ms stagger. | LOW | Ordering logic only; no new tech |
| Accessible: respect prefers-reduced-motion | WCAG 2.1 requirement for K-12. If `prefers-reduced-motion`, skip animation and show nodes immediately. | LOW | CSS media query check in JS |

### Differentiators for Graph Animation

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Auto-transition from answer to graph | After streaming completes, the page auto-navigates to the graph view (or the graph rises into the answer area). No manual "Explore" click. The graph IS the primary response. | MEDIUM | Requires rethinking the post-answer flow in `question-form.tsx`; may need graph inline on question page OR router.push with animation state |
| Particle birth effect on new node | New node appears with a brief particle emission (like a star forming) before settling into its final glow. Duolingo uses celebration animations at achievement moments; this is MindMap's equivalent for "your knowledge grew." | MEDIUM | @react-three/drei `Sparkles` or custom particle shader; 0.5s effect duration |
| Edge "energy flow" animation | When a new edge connects to an existing node, a brief light pulse travels along the edge from new to old, visually demonstrating the connection being made. | MEDIUM | Custom shader or animated line opacity; needs careful perf testing with many edges |
| Before/after count display | Brief overlay showing "+2 concepts, +3 connections" that fades after the animation completes. Gives the student a quantitative sense of growth alongside the visual. | LOW | Compare pre/post node counts; overlay component |
| Sound design (optional) | Subtle ambient tone when nodes appear. Duolingo and Brilliant use audio feedback for completion. Must be toggleable and off by default (classroom setting). | LOW | HTML5 Audio API; user preference in localStorage |

### Anti-Features for Graph Animation

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full-screen celebration modal | Blocks the graph view. Duolingo's celebrations work because the lesson IS over; MindMap's moment IS the graph. A modal hiding the graph defeats the purpose. | Let the graph animation BE the celebration. The visual expansion is the reward. |
| Automatic replay / "watch again" | Students will click it once for novelty, then find it annoying. Wastes time in classroom settings. | One-shot animation; student can ask tomorrow for the next one. |
| Animation longer than 3 seconds total | NNGroup research: animations over 1 second feel like delays in task-oriented contexts. Total sequence (node appear + edges + camera move) must be under 3s. | Keep individual animations 200-500ms with 100ms stagger between elements. Total sequence ~1.5-2.5s. |
| Forced sequential page: answer then graph | "First read the answer, then see the graph" creates friction. The graph growth should be visible AS the answer streams, or immediately after. | Consider split layout (answer left, graph right) or inline mini-graph that expands. |
| Gamified counter ("Level up! 42 concepts!") | Per PROJECT.md anti-features and research (Deci & Ryan): extrinsic reward framing undermines intrinsic curiosity. The visual growth is intrinsically rewarding. | The "+2 concepts" overlay is informational, not celebratory. No levels, no scores, no badges. |

### Expected User Behavior

1. Student types question, clicks "Ask"
2. AI answer streams in (existing behavior)
3. As stream completes, the view transitions: graph appears showing the student's existing knowledge
4. New nodes animate in: scale from 0 to full size with brief glow burst (200-400ms per node, staggered)
5. New edges draw from new nodes to existing nodes (100-200ms per edge)
6. Camera smoothly repositions to frame the new growth area (~800ms lerp)
7. Brief overlay: "+2 concepts, +3 connections" fades after 2s
8. Student can immediately interact with graph (click nodes, orbit, zoom)
9. The text answer is still accessible (collapsed panel or secondary tab) but is NOT the hero

**Emotional target:** "My universe just got bigger." Not "I got the right answer."

---

## Feature 2: Surprising Connections (Bridge Insight Moments)

### What This Means

When a new concept bridges two previously unconnected knowledge domains, the system creates an unmissable "insight moment." Not a dismissable toast -- a prominent, in-context visual event that helps the student understand WHY this connection matters.

### Current State (What Needs to Change)

The existing `bridge-toast.tsx` is a Sonner toast that:
- Fires once per 7-day window
- Shows for 8 seconds then auto-dismisses
- Has an "Explore" button that opens the node detail panel
- Is literally defined as "fire-and-forget" in its own docblock

This is precisely the anti-pattern the milestone wants to fix. A dismissable toast for a bridge concept is like celebrating a scientific discovery with a sticky note.

### Table Stakes for Connection Surfacing

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Visual highlight on the bridge node itself | The node that creates the bridge should be visually distinct in the graph. Current pulse animation (3 cycles over 1.5s) is a start but fires only on explicit highlight. | LOW | Extend existing pulse logic to trigger automatically on bridge detection |
| Camera fly-to the bridge area | When a bridge forms, the camera should automatically navigate to show both connected domains with the bridge node centered. | LOW | Existing fly-to mechanism; need to compute framing for two domain clusters |
| Explanatory text: what connects what | "Evaporation connects your Water Cycle knowledge to your Cooking knowledge." Plain language, not data jargon. | LOW | Already have `domainA`, `domainB`, and `bridgeNodeName` in bridge data |
| Persistent until acknowledged | The insight does not auto-dismiss after 8 seconds. It stays visible until the student interacts with it (clicks to explore, or explicitly closes). | LOW | Replace Sonner toast with in-graph overlay component |

### Differentiators for Connection Surfacing

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Bridge reveal animation sequence | When bridge detected: (1) camera pulls back to show both domains, (2) glow path traces from domain A through bridge node to domain B, (3) bridge node pulses larger than normal, (4) overlay card appears with explanation. 2-3 second choreographed sequence. | HIGH | Custom animation orchestration; needs state machine for sequence stages |
| "Why this matters" AI-generated insight | Instead of just "X connects Y and Z", generate a 1-2 sentence explanation of WHY the connection is intellectually interesting. "Did you know evaporation is why both weather happens AND why your cookies dry out? The same physics drives both!" | MEDIUM | LLM call with bridge context; can be async/cached; must be age-appropriate |
| Bridge edge visual distinction | Bridge edges rendered differently from normal edges -- brighter, animated particle flow, or different color. Makes bridges always visible in the graph, not just during the reveal moment. | LOW | Edge type already tracked as `bridge` in schema; modify `SolarEdges` rendering |
| Insight history / collection | Students can revisit past bridge discoveries in a "Connections" journal. Builds a portfolio of interdisciplinary thinking over time. | MEDIUM | New DB query; UI component for history list; low priority for v1.1 |

### Anti-Features for Connection Surfacing

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Blocking modal over the graph | "AMAZING CONNECTION FOUND!" modals feel like ads. They interrupt the flow and train students to click "dismiss" reflexively. | Overlay card that floats near the bridge node in 3D space (or a sidebar panel). Does not block graph interaction. |
| Every-time notification for returning bridge | If the same bridge was shown before, do not re-trigger the full animation on every graph visit. | Track shown bridges per student; only trigger for NEW bridges. Show existing bridges with persistent visual distinction (glowing edge). |
| Confetti / particle explosion | Overblown celebration for what should be an intellectual "hmm, interesting" moment. Confetti is for achievements; bridge detection is for curiosity. | Subtle glow expansion + camera choreography. The visual language should say "look at this connection" not "YOU WON." |
| Automatic social sharing prompt | "Share this connection with your class!" -- no. This is a personal learning moment, not a social media event. | If sharing is desired later, it belongs in the connection history, not in the reveal moment. |

### Expected User Behavior

1. Student asks a question whose answer extracts a concept that bridges two existing domains
2. Graph growth animation plays (Feature 1), with the bridge node appearing last in the stagger sequence
3. After the growth animation completes, a 500ms pause
4. Bridge reveal sequence begins:
   a. Camera pulls back smoothly to frame both connected domain clusters (~800ms)
   b. A glow path traces through the bridge node connecting the two domains (~600ms)
   c. Bridge node pulses 1.5x normal size with intensified glow
   d. Insight card slides in from the side: "Evaporation connects your Water Cycle knowledge to your Cooking knowledge. The same process that makes rain also dries your cookies!"
5. Insight card stays visible until student clicks "Got it" or clicks elsewhere on the graph
6. Bridge node retains subtle visual distinction (brighter glow, different edge rendering) permanently
7. Student clicks the bridge node to explore its connections in the node detail panel

**Emotional target:** "Oh wow, I didn't realize those were connected." Intellectual surprise, not achievement dopamine.

---

## Feature 3: Teacher Action Loop

### What This Means

The existing teacher dashboard shows misconception clusters and can generate lesson plans, but the loop is open-ended: there is no way for a teacher to say "I did this activity" and have the system check whether it worked. The action loop closes that gap: misconception cluster detection leads to specific classroom activity suggestions, the teacher marks an activity as done, and the system re-probes affected students to measure whether the intervention shifted their understanding.

### How Education Software Handles This (Industry Patterns)

The MTSS (Multi-Tiered System of Supports) / RTI (Response to Intervention) pattern is the established model:

1. **Screen** -- identify students who need support (MindMap: misconception detection)
2. **Plan** -- select an intervention (MindMap: lesson plan generation)
3. **Implement** -- execute the intervention in class (MindMap: teacher marks activity done)
4. **Monitor** -- measure whether it worked (MindMap: re-probe affected students)
5. **Adjust** -- continue, intensify, or change approach (MindMap: updated dashboard data)

Platforms like Branching Minds, Panorama Education, and MTSS Edge all implement this cycle. The key insight from research: in a survey of 400+ educators, 8 in 10 said tracking interventions is important, but only 3 in 10 said they do it effectively. The software must make the tracking frictionless.

### Table Stakes for Teacher Action Loop

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Activity status tracking (not started / in progress / done) | Teachers need to know which lesson plan activities they have and have not done. Without status, the dashboard is a suggestion machine with no memory. | LOW | New `intervention_status` enum + column on a new `interventions` or `activity_completions` table |
| "Mark done" button on each activity | One-click action. Must be as easy as checking a box. Teachers will not fill out forms to log an activity. | LOW | Button on `LessonPlanCard` activities; server action to persist |
| Timestamp of when activity was completed | Teachers and admins need to know WHEN an intervention happened to correlate with student data changes. | LOW | `completedAt` timestamp column |
| Per-cluster resolution progress (already exists) | The misconception card already shows "X resolved / Y unresolved" with a progress bar. This is the baseline measurement. | ALREADY BUILT | `misconceptions-tab.tsx` already renders this |

### Differentiators for Teacher Action Loop

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Automatic re-probe trigger | After a teacher marks an activity done, the system queues affected students for re-probing: next time those students ask a question touching the relevant concept domain, the router preferentially routes to diagnose mode to check if the misconception persists. | HIGH | Modify routing engine to check for pending re-probes; new `pending_reprobes` table or flag on `diagnostic_sessions`; must not override student agency (they still choose their question) |
| Before/after comparison view | Dashboard shows misconception resolution rates BEFORE the intervention vs. AFTER, with a clear visual (e.g., progress bar snapshot at time of "mark done" vs. current). "You ran this activity on April 10. Since then, 3 of 5 students have resolved this misconception." | MEDIUM | Store snapshot of resolution counts at mark-done time; diff against current counts |
| Suggested next step based on re-probe results | If re-probing shows the intervention did not work (students still hold the misconception), suggest a different approach: "This misconception persists for 3 students. Consider trying the discussion-based approach instead." | HIGH | Requires LLM call analyzing which activities were tried and their outcomes; complex prompt engineering |
| Class-wide intervention timeline | Visual timeline showing when interventions were applied and how resolution rates changed over time. Gives teachers a longitudinal view of their impact. | MEDIUM | Chart component (could use simple bar/line chart); query intervention timestamps + resolution snapshots |
| Intervention effectiveness score | Numeric metric: "This activity resolved the misconception for 60% of affected students within 2 weeks." Gives teachers actionable data on which activities work best. | MEDIUM | Calculation based on before/after resolution counts and time window; displayed on activity card |

### Anti-Features for Teacher Action Loop

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Mandatory activity logging / compliance tracking | Turns the tool into an admin accountability system. Teachers will resent it and stop using it. | Logging is optional and frictionless. The tool is helpful, not mandatory. |
| Automatic grade impact / LMS grade passback | Changes MindMap from a curiosity/understanding tool to a grading tool. Per PROJECT.md: out of scope, undermines product philosophy. | Resolution rates are visible to teachers for professional judgment, not automated grading. |
| Teacher performance scoring | "Your intervention effectiveness is 72%." Weaponizes the tool against teachers. Education research is clear: punitive accountability reduces teacher engagement with data tools. | Show student outcome data, never teacher performance metrics. Frame as "what worked" not "how well you did." |
| Forced re-probe (overriding student's question) | "Today you MUST answer a question about gravity." Destroys the daily curiosity model. Students choose their own questions. | Re-probe is opportunistic: IF the student's chosen question touches a relevant domain, THEN route to diagnose. If not, honor their curiosity. |
| Complex activity forms (duration, materials, notes) | Teachers have 3 minutes between classes. A form with 8 fields will never get filled out. | One-click "Mark done." Optional notes field that collapses. That's it. |

### Expected User Behavior

**Teacher Flow:**
1. Teacher opens class dashboard, sees Misconceptions tab
2. Notices "Forces are properties of objects" theme with 5 students affected, 1 resolved
3. Clicks "Drill down" to see constituent misconceptions and affected students
4. Clicks "Generate Lesson Plan" (existing feature)
5. Reviews suggested activities, decides to run Activity 2 ("Gravitational Tug-of-War Discussion") in class tomorrow
6. **NEW:** After running the activity in class, returns to dashboard and clicks "Mark done" on Activity 2
7. System records completion timestamp and takes a snapshot of current resolution state (1/5 resolved)
8. Over the next 1-2 weeks, affected students ask questions. When a question touches the forces domain, the routing engine preferentially routes to diagnose mode
9. Some students resolve the misconception through the diagnostic flow
10. Teacher revisits the dashboard and sees: "Activity completed April 10. Since then: 3 of 5 students resolved (was 1 of 5). +2 resolved after intervention."
11. For the 2 remaining students, teacher can generate a new lesson plan or try a different approach

**Student Flow (mostly invisible):**
1. Student asks their daily question as usual (unchanged)
2. If the student's question touches a domain where their teacher ran an intervention AND the student has a pending re-probe flag, the routing engine slightly increases the probability of diagnose mode
3. Student goes through the Socratic diagnostic flow as normal
4. If misconception is now resolved, the node health changes from red to green
5. The teacher dashboard updates automatically

**Key design constraint:** The student experience does NOT change. Students never know they are being re-probed. The action loop is entirely teacher-facing. Student autonomy (choosing their own question) is preserved.

---

## Feature Dependencies

```
[Feature 1: Graph-as-Hero]
    depends on: existing solar-graph.tsx, solar-scene.tsx, useFrame animation loop
    depends on: concept extraction pipeline (to know which nodes are new)
    depends on: question-form.tsx post-answer flow (to trigger transition)
    no dependency on: Feature 2 or Feature 3

[Feature 2: Surprising Connections]
    depends on: Feature 1 (new node animation should precede bridge reveal)
    depends on: existing bridge detection (centrality.ts, getBridgeConnection)
    depends on: existing camera fly-to mechanism
    replaces: bridge-toast.tsx (Sonner toast)

[Feature 3: Teacher Action Loop]
    depends on: existing lesson-plan-card.tsx and themes-view.tsx
    depends on: existing misconception clusters and resolution tracking
    depends on: existing diagnostic_sessions table (for re-probe logic)
    depends on: routing engine (for opportunistic re-probe routing)
    no dependency on: Feature 1 or Feature 2

[Feature 1] + [Feature 2] are tightly coupled (both graph-side, same animation system)
[Feature 3] is independent (teacher dashboard, different page, different data flow)
```

### Build Order Recommendation

1. **Feature 1 first** -- it establishes the animation infrastructure (node birth, edge draw, camera choreography) that Feature 2 builds on
2. **Feature 2 second** -- extends Feature 1's animation system with bridge-specific choreography
3. **Feature 3 independently** -- can be built in parallel with Features 1+2 since it touches different code (teacher dashboard, routing engine, DB schema)

---

## Complexity Assessment

| Feature | Estimated Complexity | Rationale |
|---------|---------------------|-----------|
| Feature 1: Graph-as-Hero | MEDIUM | Animation primitives exist (useFrame, InstancedMesh, camera lerp). Main work is: (a) identifying which nodes are new after a question, (b) orchestrating the auto-transition from answer to graph, (c) staggered animation sequence. No new libraries needed -- @react-spring/three is optional but not required. |
| Feature 2: Surprising Connections | MEDIUM | Bridge detection exists. Camera fly-to exists. Main work is: (a) replacing toast with in-graph overlay, (b) multi-step animation choreography (needs a small state machine), (c) optional AI-generated insight text. The bridge reveal sequence is choreography, not new tech. |
| Feature 3: Teacher Action Loop (basic) | LOW-MEDIUM | "Mark done" + timestamp is trivial. Before/after comparison needs a snapshot mechanism (store counts at mark-done time). The real complexity is in the re-probe routing. |
| Feature 3: Re-probe Routing | HIGH | Modifying the routing engine to check pending re-probes, deciding when to preferentially route to diagnose mode without overriding student choice, and ensuring the flag clears appropriately after re-probing. Touches core routing logic. |

---

## MVP Recommendation for v1.1

### Must Build

1. **Graph-as-Hero: Auto-transition + node/edge animation** -- This is the milestone's thesis. Without it, there is no "value experience" upgrade.
2. **Surprising Connections: Bridge overlay replacing toast** -- The current toast is explicitly called out as the anti-pattern. Replace it with a persistent, in-graph insight card.
3. **Teacher Action Loop: Mark done + before/after** -- Closes the most obvious gap in the teacher workflow. Without measurement, lesson plans are suggestions into the void.

### Should Build (if time permits)

4. **Particle birth effect on new nodes** -- Elevates the animation from "functional" to "delightful." Low-medium complexity, high demo impact.
5. **Bridge reveal camera choreography** -- The full sequence (pull back, glow path, pulse, card) vs. just a highlight + card. Higher polish, higher demo impact.
6. **Opportunistic re-probe routing** -- The "intelligent" part of the action loop. Without it, re-probing only happens if the student happens to ask a relevant question naturally.

### Defer to v1.2+

7. **AI-generated "why this matters" bridge insight** -- Nice but not essential for the insight moment. The domain-connection text ("X connects Y and Z") is sufficient.
8. **Intervention effectiveness score** -- Requires enough time to pass between intervention and re-probe to be meaningful. Better to ship mark-done now and add scoring when there is real data.
9. **Class-wide intervention timeline** -- Longitudinal view is valuable but requires multiple intervention cycles to be useful. Ship the point-in-time before/after first.
10. **Insight history / connections journal** -- Portfolio feature that adds value over months. Not needed for initial demo.

---

## Sources

### Graph Animation and UX

- [NNGroup: Animation Duration and Motion Characteristics](https://www.nngroup.com/articles/animation-duration/) -- animation timing guidance (100-500ms)
- [Cambridge Intelligence: Graph Visualization UX](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/) -- progressive disclosure, node emphasis
- [Cambridge Intelligence: 10 Rules of Great Graph Design](https://cambridge-intelligence.com/10-rules-great-graph-design/) -- animation and visual weight
- [React Spring + React Three Fiber Guide](https://react-spring.dev/docs/guides/react-three-fiber) -- spring-physics animations in R3F
- [R3F Basic Animations Tutorial](https://r3f.docs.pmnd.rs/tutorials/basic-animations) -- useFrame patterns
- [Maxime Heckel: Particles with R3F and Shaders](https://blog.maximeheckel.com/posts/the-magical-world-of-particles-with-react-three-fiber-and-shaders/) -- particle birth effects

### Education and Learning

- [Duolingo: Streak Milestone Design and Animation](https://blog.duolingo.com/streak-milestone-design-animation/) -- celebration design patterns
- [Duolingo: Gamification as Design Language](https://blakecrosley.com/guides/design/duolingo) -- state-driven animation, not decorative
- [Gamification Meta-Analysis: Intrinsic Motivation](https://link.springer.com/article/10.1007/s11423-023-10337-7) -- gamification enhances intrinsic motivation but minimal competency impact
- [Knowledge Visualization in Education: Complete Guide 2026](https://www.x-pilot.ai/blog/knowledge-visualization-education-complete-guide) -- progressive disclosure, cognitive load
- [Knowledge Graphs in Education: Systematic Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10847940/) -- bridge concepts, interdisciplinary learning
- [Chan Zuckerberg: Knowledge Graph AI in Education](https://chanzuckerberg.com/blog/knowledge-graph-ai-education/) -- learning science alignment

### Teacher Action Loops and Intervention Tracking

- [EEF: Feedback Toolkit](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/feedback) -- formative assessment impact
- [SchoolAI: Faster Feedback Loops](https://schoolai.com/blog/classroom-technology-faster-feedback-loops) -- real-time misconception detection
- [Branching Minds: Intervention Data Tracking](https://www.branchingminds.com/intervention-data-tracking-software) -- MTSS workflow pattern
- [Panorama Education: MTSS Software](https://www.panoramaed.com/solutions/mtss-software-platform) -- intervention management
- [Frontline Education: Monitor Tier 1 Interventions](https://www.frontlineeducation.com/blog/monitor-progress-tier-1-classroom-interventions/) -- 7-step progress monitoring
- [Digital Promise: Feedback Loops for Instruction](https://digitalpromise.org/2024/01/25/impacting-instructional-strategies-using-feedback-loops/) -- close-the-loop pattern

### Knowledge Graph Tools and Connection Discovery

- [Obsidian Graph View](https://obsidian.md/help/plugins/graph) -- time-lapse animation, connection visualization
- [InfraNodus: AI-Enhanced Knowledge Graph](https://infranodus.com/use-case/visualize-knowledge-graphs-pkm) -- structural gap detection = insight opportunities
- [GraphTide: Progressive Nested Graph Display](https://arxiv.org/html/2604.12624v1) -- animation synced with reading flow
- [yFiles: Guide to Visualizing Knowledge Graphs](https://www.yfiles.com/resources/how-to/guide-to-visualizing-knowledge-graphs) -- animation and interaction patterns

### UX and Microinteractions

- [UXmatters: Designing Aha Moments](https://www.uxmatters.com/mt/archives/2024/08/designing-aha-moments-for-better-product-activation.php) -- insight moment design
- [UX Magazine: Rewarding Interactions](https://uxmag.com/articles/increasing-user-engagement-with-rewarding-interactions) -- visual reward patterns
- [Framer: Animation Techniques for Engagement](https://www.framer.com/blog/website-animation-examples/) -- strategic animation placement
- [Smashing Magazine: Animated Microinteractions in Mobile Apps](https://www.smashingmagazine.com/2016/08/experience-design-essentials-animated-microinteractions-in-mobile-apps/) -- microinteraction principles

---
*Feature research for: MindMap v1.1 Value Experience milestone*
*Researched: 2026-04-14*
