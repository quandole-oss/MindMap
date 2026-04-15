# Architecture Integration: v1.1 Value Experience Features

**Project:** MindMap v1.1
**Researched:** 2026-04-14
**Scope:** How 3 features integrate with existing architecture, component-level changes, data flow additions, build order

## Feature Integration Map

### Feature 1: Graph-as-Hero (Animate Graph Growth After Question Submission)

**Goal:** After a student submits a question and the AI answers, the student's knowledge graph grows visually on-screen. The graph expansion IS the reward -- the student sees new nodes and edges appear.

#### Current Flow (What Exists)

```
Student submits question
  -> QuestionForm (client) POST /api/ask
    -> streamText() streams answer to QuestionForm
    -> onFinish callback (server):
        extract concepts -> deduplicate -> create edges -> [maybe diagnostic session]
  -> QuestionForm shows "Explore on your graph" button
    -> router.push('/student/graph?node=xxx')
    -> Graph page loads completely fresh (full page navigation)
```

The current experience is **two separate pages with a full navigation break**. The student asks, sees the answer, then clicks a button to visit a completely different page. The graph renders with all nodes already present -- there is no growth animation, no visual moment of "your graph just expanded."

#### Integration Architecture

**Option A: Embed a Mini-Graph in the Student Page (FULL VISION)**

Add an inline, lightweight graph visualization directly in the student question page (`/student`) that shows graph growth in real-time after the `onFinish` callback completes.

**Components Modified:**

| Component | Change Type | What Changes |
|-----------|-------------|-------------|
| `apps/web/app/student/page.tsx` | MODIFIED | Fetch graph data server-side alongside existing data; pass to QuestionForm |
| `components/questions/question-form.tsx` | MODIFIED | After `onFinish`, fetch new graph data, render growth animation inline |
| `actions/graph.ts` | MODIFIED | Add `getGraphDataLight()` -- lighter version returning just nodes/edges without full centrality/betweenness computation |

**New Components:**

| Component | Purpose |
|-----------|---------|
| `components/graph/graph-growth-animation.tsx` | Client component that renders a mini 3D graph and animates new nodes/edges appearing. Uses R3F Canvas (same as solar-graph) but with a smaller viewport and auto-orbit camera. |

**Data Flow Change:**

```
BEFORE:
  student/page.tsx -> QuestionForm -> (answer) -> button -> /student/graph (full nav)

AFTER:
  student/page.tsx (server: fetch initial graphData)
    -> QuestionForm receives initialGraphData prop
    -> User asks question -> stream answer
    -> onFinish fires
    -> QuestionForm calls getTodayQuestionConcepts() (existing)
    -> QuestionForm calls getGraphDataLight() (NEW)
    -> Compare initialGraphData vs newGraphData to identify new nodes/edges
    -> Render GraphGrowthAnimation with { existingNodes, newNodes, existingEdges, newEdges }
    -> Animation: existing graph fades in at 0.3 opacity, then new nodes/edges
       appear one-by-one with scale-up + glow, camera auto-orbits slowly
    -> "Explore full graph" button below animation
```

**Why this approach:**
- No navigation break -- the student stays on one page and sees the reward
- Re-uses the existing R3F + Three.js infrastructure (SolarNodes, SolarEdges patterns)
- `getGraphDataLight()` skips betweenness centrality (O(V*E)) -- only needs node positions and basic data for the mini view
- The animation component is self-contained and does not pollute the existing full graph page

**Server Action Addition:**

```typescript
// actions/graph.ts -- NEW
export async function getGraphDataLight(): Promise<{ nodes: LightGraphNode[]; edges: LightGraphEdge[] }>
```

This returns nodes with `{ id, name, domain, status }` and edges with `{ source, target, edgeType }` -- no centrality, no importance scores, no co-occurrence queries. Fast enough to call in the onFinish polling loop.

**Schema Changes:** None. All data already exists.

**Option B: Navigate to Graph with Growth Animation State (SIMPLER)**

Instead of embedding a mini-graph, pass "new concept IDs" as URL params to the graph page and animate them appearing there.

```
router.push('/student/graph?newNodes=id1,id2,id3&animate=true')
```

The existing `GraphPageClient` would detect `animate=true`, hold new nodes invisible initially, then animate them in with scale+glow over 2 seconds.

**Tradeoff:** Simpler to implement (no new component, no duplicate R3F canvas) but still requires a full page navigation, which weakens the "graph is the reward" emotional punch. The student clicks a button, waits for page load, THEN sees animation -- the dopamine loop is interrupted.

**Recommendation: Start with Option B, upgrade to Option A if time permits.** Option B is a 60% emotional improvement with 30% of the effort. Option A is the full vision but requires more work on the mini-graph component.

---

### Feature 2: Surprising Connections (Bridge Concept Discovery UX)

**Goal:** Bridge concepts (nodes connecting two different knowledge domains) become unmissable "aha!" moments, not just a weekly toast.

#### Current Flow (What Exists)

```
Graph page loads
  -> Server: getBridgeConnection() finds top bridge node
  -> Client: BridgeToast fires a Sonner toast (8s duration, 7-day cooldown via localStorage)
  -> Toast has "Explore" action that flies camera to the bridge node + 1.5s pulse animation
```

**Problems with current UX:**
1. Toast is easy to miss (auto-dismisses in 8s)
2. 7-day cooldown means new bridges discovered mid-week are invisible until next week
3. No context about WHY the connection is surprising (just says "X connects domain A and domain B")
4. No persistent UI -- once toast dismisses, the insight is gone

#### Integration Architecture

**Components Modified:**

| Component | Change Type | What Changes |
|-----------|-------------|-------------|
| `components/graph/bridge-toast.tsx` | REPLACED by new component | Current toast is too ephemeral; replace with a persistent discovery card |
| `components/graph/graph-page-client.tsx` | MODIFIED | Add bridge discovery panel/card instead of just toast; handle "new bridge since last visit" detection |
| `actions/graph.ts` | MODIFIED | Enhance `getBridgeConnection()` to return multiple bridges ranked by betweenness, plus the questions that created the connection |

**New Components:**

| Component | Purpose |
|-----------|---------|
| `components/graph/bridge-discovery-card.tsx` | Persistent card UI (not a toast) that appears at top of graph page when bridge nodes exist. Shows bridge name, connected domains, the question that created the link, and a "Fly there" button. Dismissible but re-accessible via a toolbar icon. |
| `components/graph/bridge-insight-panel.tsx` | Extended panel (Sheet from shadcn/ui) showing all bridge connections with explanations of why each is surprising. LLM-generated one-liner explanation of the cross-domain connection. |

**Data Flow Change:**

```
BEFORE:
  getBridgeConnection() -> single bridge { nodeId, name, domainA, domainB }
  -> BridgeToast (7-day cooldown, auto-dismiss)

AFTER:
  getBridgeConnections() -> Array<BridgeConnection>
    where BridgeConnection = {
      nodeId, name, domainA, domainB,
      betweenness: number,
      connectingQuestions: string[], // question texts that created the link
      isNew: boolean // appeared since user's last graph visit
    }
  -> BridgeDiscoveryCard (persistent, dismissible, for the TOP bridge)
  -> BridgeInsightPanel (Sheet, lists ALL bridges with explanations)
```

**Server Action Changes:**

```typescript
// actions/graph.ts -- MODIFIED (rename + enhance)
export async function getBridgeConnections(): Promise<BridgeConnection[]>
```

The enhanced version:
1. Finds ALL bridge nodes (not just the top one) via `findTopBridgeNode` variant
2. For each bridge, queries `conceptQuestions` join + `questions` table to find the question texts that created the cross-domain link
3. Checks a `lastGraphVisit` timestamp (new field or localStorage comparison) to flag `isNew` bridges

**Schema Changes:**

**Recommended: No schema change.** Track "last graph visit" in `localStorage` on the client. When graph page loads, compare bridge node `createdAt` against stored timestamp. Simple, no migration. The bridge "newness" detection is a UX nicety, not a data integrity concern.

**LLM Integration for Bridge Explanations:**

Add a new prompt in `packages/llm/src/prompts/explain-bridge.ts`:

```typescript
export async function explainBridgeConnection(
  bridgeConceptName: string,
  domainA: string,
  domainB: string,
  connectingQuestions: string[]
): Promise<string>
```

This generates a 1-2 sentence "aha!" explanation like: "You discovered that *photosynthesis* connects biology and chemistry! When you asked about plant food, you were really asking about chemical reactions powered by light."

**Call this lazily** -- only when the student opens the BridgeInsightPanel, not on page load (avoids unnecessary LLM calls).

---

### Feature 3: Teacher Action Loop (Cluster -> Activity -> Mark Done -> Re-Probe)

**Goal:** Teachers see misconception clusters, generate targeted classroom activities, mark them as "addressed," and the system re-probes affected students to measure whether the activity worked.

#### Current Flow (What Exists)

```
Teacher dashboard -> Misconceptions tab -> "By Root Theme" view
  -> ThemesView shows ThemeCluster cards (name, naive theory, stats)
  -> "Drill down" expands: constituent misconceptions + affected students
  -> "Generate Lesson Plan" button -> LLM generates plan -> LessonPlanCard
  -> LessonPlanCard shows: common misunderstanding, target understanding,
     suggested activities, discussion prompts, confrontation approaches
  -> "Regenerate" re-generates the plan
```

**What is missing:**
1. No "Mark as addressed" -- teacher runs the activity but system does not know
2. No re-probe -- after marking addressed, system should re-assess affected students
3. No before/after comparison -- no way to see if the activity actually worked
4. No activity-level tracking -- the lesson plan exists but individual activities are not trackable

#### Integration Architecture

**Schema Changes (REQUIRED):**

```sql
-- NEW TABLE: teacher_interventions
CREATE TABLE teacher_interventions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL,           -- library slug (same as theme_lesson_plans)
  lesson_plan_id TEXT REFERENCES theme_lesson_plans(id),
  activity_title TEXT NOT NULL,     -- which activity from the plan was used
  status TEXT NOT NULL DEFAULT 'planned',  -- 'planned' | 'in_progress' | 'completed'
  addressed_at TIMESTAMPTZ,         -- when teacher marked it complete
  notes TEXT,                       -- optional teacher notes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW TABLE: reprobe_sessions
CREATE TABLE reprobe_sessions (
  id TEXT PRIMARY KEY,
  intervention_id TEXT NOT NULL REFERENCES teacher_interventions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diagnostic_session_id TEXT REFERENCES diagnostic_sessions(id),
  misconception_id TEXT NOT NULL,   -- library slug
  previous_outcome TEXT NOT NULL,   -- 'resolved' | 'unresolved' | 'incomplete'
  reprobe_outcome TEXT NOT NULL DEFAULT 'pending',  -- 'resolved' | 'unresolved' | 'incomplete' | 'pending'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Why two tables:** The intervention tracks the teacher's action. The reprobe sessions track per-student outcomes. Separating them enables "show me the impact of each intervention" queries without complex joins.

**Components Modified:**

| Component | Change Type | What Changes |
|-----------|-------------|-------------|
| `components/dashboard/themes-view.tsx` | MODIFIED | Add intervention tracking UI below each theme card |
| `components/dashboard/lesson-plan-card.tsx` | MODIFIED | Each activity gets a "Plan this activity" button |
| `components/dashboard/dashboard-tabs.tsx` | MODIFIED | Add new tab or sub-view for intervention history |
| `actions/themes.ts` | MODIFIED | Add intervention CRUD actions |

**New Components:**

| Component | Purpose |
|-----------|---------|
| `components/dashboard/intervention-tracker.tsx` | Shows active/completed interventions for a theme. "Mark addressed" button triggers intervention record creation + re-probe scheduling. |
| `components/dashboard/reprobe-results.tsx` | Before/after comparison view: for each affected student, shows previous outcome vs re-probe outcome. "Resolved" count change is the headline metric. |
| `components/dashboard/intervention-history.tsx` | Timeline of all interventions for a class, with impact metrics per intervention. |

**New Server Actions:**

```typescript
// actions/interventions.ts -- NEW FILE
export async function createIntervention(
  classId: string,
  themeId: string,
  activityTitle: string,
  lessonPlanId?: string
): Promise<Intervention>

export async function markInterventionComplete(
  interventionId: string,
  notes?: string
): Promise<void>
// This triggers the re-probe scheduling:
// 1. Find all students affected by this theme's constituent misconceptions
// 2. For each student with unresolved outcomes, create a reprobe_sessions row with status 'pending'
// 3. Create a diagnostic_session at stage 'probe' for each pending reprobe

export async function getInterventionResults(
  interventionId: string
): Promise<InterventionResults>
// Returns before/after comparison for all reprobe sessions

export async function getClassInterventions(
  classId: string
): Promise<Intervention[]>
```

**Data Flow -- Complete Action Loop:**

```
1. Teacher views theme cluster (existing)
2. Teacher generates lesson plan (existing)
3. Teacher picks an activity from the plan
4. Teacher clicks "Plan this activity" -> createIntervention()
   -> Stores intervention with status='planned'
5. Teacher runs the activity in class (real world)
6. Teacher clicks "Mark as addressed" -> markInterventionComplete()
   -> Sets status='completed', addressedAt=now
   -> For each affected student with unresolved misconceptions in this theme:
      a. Snapshot their current diagnostic outcome into reprobe_sessions.previousOutcome
      b. Create a new diagnostic_session at stage='probe' (re-probe)
      c. Link reprobe_sessions.diagnosticSessionId to the new session
7. Students see a new diagnostic probe next time they visit /student
   -> This reuses the EXISTING diagnostic flow completely
   -> The /api/diagnose endpoint already handles probe->classify->confront->resolve
8. As students complete re-probes, their outcomes update
9. Teacher views "Intervention Results" -> getInterventionResults()
   -> Shows: "Before: 8 unresolved / After: 3 unresolved = 62.5% improvement"
```

**Critical Integration Point -- How Re-Probes Reach Students:**

The existing `getTodayDiagnosticSession()` Server Action in `actions/diagnostic.ts` finds active (non-resolved) diagnostic sessions for the logged-in student. When `markInterventionComplete` creates new diagnostic sessions, they automatically appear via the existing code path. **No changes to the student-facing diagnostic flow.**

However, currently diagnostic sessions are only created in `/api/ask` `onFinish` -- tied to a question submission. Re-probe sessions would be created by a teacher action, which is a new creation path. Need to ensure:
1. The new sessions have a valid `conceptId` and `misconceptionId` (use the original from the student's existing diagnostic session)
2. The new sessions have `questionId: null` (no associated question -- this is already nullable in the schema)
3. Student's "active session" detection works with teacher-created sessions (it should -- it queries by userId + stage != 'resolve')

**Schema Compatibility Check:**
- `diagnosticSessions.questionId` is already nullable (FK with `onDelete: "set null"`) -- re-probes with `questionId: null` are safe
- `diagnosticSessions.conceptId` is NOT NULL -- must provide the original concept ID from the student's prior session
- `diagnosticSessions.stage` defaults to `'probe'` -- correct for re-probes
- No `classId` on `diagnosticSessions` -- this is a known limitation (documented in themes.ts). Re-probe sessions are scoped by student, not by class. Acceptable for v1.1.

---

## New Package/File Summary

### New Files

| Path | Type | Purpose |
|------|------|---------|
| `packages/db/src/schema/interventions.ts` | Schema | `teacher_interventions` and `reprobe_sessions` tables |
| `apps/web/actions/interventions.ts` | Server Actions | CRUD for interventions + re-probe scheduling |
| `apps/web/components/graph/graph-growth-animation.tsx` | Client Component | Animated mini-graph showing new nodes appearing |
| `apps/web/components/graph/bridge-discovery-card.tsx` | Client Component | Persistent bridge discovery UI (replaces toast) |
| `apps/web/components/graph/bridge-insight-panel.tsx` | Client Component | Sheet showing all bridge connections with explanations |
| `apps/web/components/dashboard/intervention-tracker.tsx` | Client Component | Intervention creation/status tracking per theme |
| `apps/web/components/dashboard/reprobe-results.tsx` | Client Component | Before/after comparison for re-probe outcomes |
| `apps/web/components/dashboard/intervention-history.tsx` | Client Component | Class-wide intervention timeline |
| `packages/llm/src/prompts/explain-bridge.ts` | LLM Prompt | Generates "aha!" explanation for bridge connections |
| `apps/web/lib/intervention-types.ts` | Types | TypeScript interfaces for intervention data |

### Modified Files

| Path | Change Summary |
|------|---------------|
| `apps/web/app/student/page.tsx` | Add initial graph data fetch for growth animation |
| `components/questions/question-form.tsx` | After onFinish, render graph growth animation inline; add getGraphDataLight call |
| `apps/web/app/student/graph/page.tsx` | Fetch bridge connections (plural), pass to client |
| `components/graph/graph-page-client.tsx` | Replace BridgeToast with BridgeDiscoveryCard; add BridgeInsightPanel |
| `components/graph/bridge-toast.tsx` | DEPRECATED (replaced by bridge-discovery-card.tsx) |
| `actions/graph.ts` | Add getGraphDataLight(); enhance getBridgeConnection -> getBridgeConnections |
| `components/dashboard/themes-view.tsx` | Add intervention tracker below each theme card |
| `components/dashboard/lesson-plan-card.tsx` | Add "Plan this activity" button per activity item |
| `components/dashboard/dashboard-tabs.tsx` | Add interventions/history view (either new tab or sub-view in misconceptions) |
| `actions/themes.ts` | Import intervention actions; wire lesson plan to intervention creation |
| `packages/db/src/schema/index.ts` | Export new intervention tables |
| `packages/llm/src/index.ts` | Export explainBridgeConnection |
| `apps/web/lib/dashboard-types.ts` | Add intervention-related types to ClassDashboardData |
| `actions/dashboard.ts` | Fetch active interventions in getClassDashboardData |
| `actions/diagnostic.ts` | Ensure getTodayDiagnosticSession and getActiveSession work for reprobe sessions |

---

## Dependency Graph (Build Order)

```
                    +---------------------------+
                    |  DB Schema: interventions  |  (Phase A - Foundation)
                    |  + migration               |
                    +-------------+-------------+
                                  |
              +-------------------+-------------------+
              |                   |                    |
              v                   v                    v
    +------------------+  +--------------+  +-------------------+
    |  Feature 2:      |  |  Feature 1:  |  |  Feature 3:       |
    |  Bridge          |  |  Graph-as-   |  |  Teacher Action    |
    |  Discovery UX    |  |  Hero        |  |  Loop              |
    |  (no schema      |  |  (no schema  |  |  (NEEDS schema)    |
    |   dependency)    |  |   dependency)|  |                    |
    +------------------+  +--------------+  +-------------------+
```

### Suggested Build Order

**Phase A: Database Foundation (if doing Feature 3)**
1. Create `packages/db/src/schema/interventions.ts` with both tables
2. Export from `packages/db/src/schema/index.ts`
3. Run migration: `pnpm --filter @mindmap/db db:generate && db:push`
4. Create `apps/web/lib/intervention-types.ts` with TypeScript interfaces

**Phase B: Feature 2 -- Surprising Connections (build first)**
Rationale: Smallest scope, no schema changes, self-contained, delivers visible UX improvement immediately.

1. Enhance `getBridgeConnection` -> `getBridgeConnections` in `actions/graph.ts`
2. Create `bridge-discovery-card.tsx` (persistent card, replaces toast)
3. Create `bridge-insight-panel.tsx` (Sheet with all bridges)
4. Create `packages/llm/src/prompts/explain-bridge.ts` (lazy LLM explanation)
5. Update `graph-page-client.tsx` to use new components
6. Deprecate `bridge-toast.tsx`

**Phase C: Feature 1 -- Graph-as-Hero (build second)**
Rationale: Depends on existing graph infrastructure. Option B (navigate with animation) has no dependencies on other features. Option A (inline mini-graph) is more complex but still independent.

**Option B (simpler, do first):**
1. Add `animate` and `newNodes` search params handling in `graph-page-client.tsx`
2. Modify `SolarScene` to support "appear animation" for nodes flagged as new
3. Update QuestionForm to pass new concept IDs in the router.push URL
4. Add entrance animation (scale from 0, glow burst) for new nodes in SolarNodes

**Option A (full vision, do if time permits):**
1. Create `getGraphDataLight()` in `actions/graph.ts`
2. Modify `student/page.tsx` to fetch initial graph data
3. Pass `initialGraphData` to QuestionForm
4. Create `graph-growth-animation.tsx` component
5. Integrate into QuestionForm's post-onFinish flow
6. Add "Explore full graph" button below animation

**Phase D: Feature 3 -- Teacher Action Loop (build last)**
Rationale: Largest scope, requires schema migration, depends on understanding the re-probe flow, touches the most files. Build last because Phases B and C deliver student-facing value while this is teacher-facing.

1. Create `actions/interventions.ts` with all CRUD operations
2. Create `intervention-tracker.tsx` component
3. Integrate into `themes-view.tsx` (add tracker below each theme card)
4. Add "Plan this activity" button to `lesson-plan-card.tsx` activity items
5. Implement `markInterventionComplete` with re-probe session creation logic
6. Create `reprobe-results.tsx` component
7. Create `intervention-history.tsx` component
8. Wire into dashboard (new tab or sub-view)
9. Test re-probe flow: teacher marks complete -> student sees new diagnostic -> completes -> teacher sees results

---

## Risk Assessment

### High Risk

**Re-probe session creation (Feature 3):** Creating diagnostic sessions from teacher actions (not from `/api/ask`) is a new creation path. The existing `getTodayDiagnosticSession()` and `getActiveSession()` in `actions/diagnostic.ts` must work with these teacher-created sessions. Test thoroughly that:
- Sessions appear for the correct students
- The `conceptId` is valid and belongs to the student
- Multiple active sessions do not conflict (student might have one from today's question AND a re-probe)
- The diagnostic flow (`/api/diagnose`) handles sessions without a `questionId`

### Medium Risk

**R3F mini-graph performance (Feature 1, Option A):** Running two R3F Canvas instances (one on `/student`, one on `/student/graph`) could cause WebGL context issues on mobile. The spec says `dpr={[1, 2]}` -- two canvases means two WebGL contexts. Most mobile browsers support 8-16 contexts, but older devices may struggle. Mitigation: keep the mini-graph canvas small (300x300 px or similar) and dispose it before navigating to the full graph.

**Bridge explanation LLM costs (Feature 2):** Each bridge explanation is an LLM call. If a student has many bridges and opens the insight panel, that is N LLM calls. Mitigation: cache explanations in localStorage (they are student-facing only, no privacy concern). Generate lazily (only when panel opens and explanation not cached).

### Low Risk

**Schema migration (Feature 3):** Two new tables with no changes to existing tables. Clean migration, no data transformation needed. Standard pattern matching existing `theme_lesson_plans` table.

---

## Architecture Principles Preserved

1. **Server-centric:** All new business logic in Server Actions. Client components handle only UI state (selected intervention, animation state, panel open/closed).

2. **Type safety:** New Zod schemas for intervention creation. New TypeScript interfaces in `intervention-types.ts`.

3. **No global state:** Intervention state flows through Server Actions, not client-side stores. Animation state is component-local.

4. **Auth boundary:** All new Server Actions start with `auth()` check. Class ownership verified for all teacher actions. Student data scoped by userId from session.

5. **PRIV-01:** Bridge explanations use only concept name, domain, and question text -- no student PII. Intervention data stays server-side; only anonymized aggregate results shown.

6. **Dependency direction:** `apps/web -> packages/db` (new schema), `apps/web -> packages/llm` (new prompt). No new cross-package dependencies.

---

## Sources

- Direct code analysis of existing codebase (HIGH confidence)
- Existing architecture patterns from `.planning/codebase/ARCHITECTURE.md` (HIGH confidence)
- React Three Fiber multi-canvas considerations (MEDIUM confidence -- based on training data, verify with current R3F docs)
- Sonner toast library API for replacement justification (HIGH confidence -- visible in current bridge-toast.tsx implementation)

---

*Architecture integration analysis: 2026-04-14*
