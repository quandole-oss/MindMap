---
phase: "05"
plan: "01"
subsystem: teacher-dashboard
tags: [dashboard, server-action, data-layer, svg, rsc]
dependency_graph:
  requires:
    - packages/db/src/schema/questions.ts
    - packages/db/src/schema/diagnostic-sessions.ts
    - packages/db/src/schema/classes.ts
    - apps/web/lib/auth.ts
    - apps/web/actions/class.ts
  provides:
    - apps/web/actions/dashboard.ts
    - apps/web/lib/dashboard-types.ts
    - apps/web/components/graph/mini-graph-svg.tsx
  affects:
    - apps/web/app/teacher/* (Plans 02-03 consume getClassDashboardData)
tech_stack:
  added: []
  patterns:
    - Batch Drizzle queries via inArray to avoid N+1 per-student database calls
    - Server action ownership verification: and(eq(table.id, id), eq(table.teacherId, userId))
    - RSC-compatible SVG component via pure function of props (no hooks, no D3)
    - Circular layout for mini graph thumbnails using trigonometric node positioning
key_files:
  created:
    - apps/web/actions/dashboard.ts
    - apps/web/lib/dashboard-types.ts
    - apps/web/components/graph/mini-graph-svg.tsx
  modified: []
decisions:
  - Batch all per-student concept/question/edge fetches via inArray (5 total DB queries, not O(N))
  - Breadth score denominator = unique domains across ALL class students (not global domain list)
  - Edge partitioning done in JS after single batch fetch (filter by student concept ID sets)
  - Streak logic allows yesterday as valid start to match existing student dashboard behavior
  - Circular SVG layout chosen over force-directed: deterministic, server-renderable, no JS runtime
  - Comment distinguishes no-use-client intent from pragma (comment text vs directive)
metrics:
  duration_seconds: 130
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 05 Plan 01: Dashboard Data Layer and Mini Graph Summary

**One-liner**: Batch server action returning all teacher dashboard data (student graphs, concept heatmap, misconception clusters, engagement stats) plus RSC-compatible SVG graph thumbnails using circular node layout with health-state color coding.

---

## Objective

Build the data layer and mini graph component for the teacher class dashboard. Creates a single server action fetching all dashboard data in one call, plus a static SVG thumbnail component for student graph previews.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Dashboard types and getClassDashboardData server action | 9c59e7b | apps/web/lib/dashboard-types.ts, apps/web/actions/dashboard.ts |
| 2 | MiniGraphSvg RSC-compatible static SVG thumbnail | ec394bc | apps/web/components/graph/mini-graph-svg.tsx |

---

## What Was Built

### `apps/web/lib/dashboard-types.ts`

Five TypeScript interfaces:
- `StudentGraphData` — nodes + edges for one student's knowledge graph
- `StudentSummary` — per-student engagement data including streak, breadthScore, isInactive, lastQuestionDate, plus graph data
- `ConceptHeatmapEntry` — class-wide concept frequency with studentCount and totalVisits
- `MisconceptionCluster` — grouped misconceptions with resolved/unresolved counts and affected student names
- `ClassDashboardData` — root type combining classInfo, students, conceptHeatmap, misconceptionClusters, totals

### `apps/web/actions/dashboard.ts`

`getClassDashboardData(classId)` server action:

1. **Auth + ownership**: Verifies teacher session, then queries `classes` with `and(eq(classes.id, classId), eq(classes.teacherId, userId))` — same pattern as `getClassRoster` (T-05-01/T-05-02 mitigations)
2. **Enrolled students**: Single JOIN query of `classEnrollments` + `users`
3. **Batch concepts**: One `inArray(concepts.userId, studentIds)` query, partitioned in JS
4. **Batch edges**: One `inArray` on both sourceConceptId and targetConceptId across all student concept IDs
5. **Batch questions**: One `inArray(questions.userId, studentIds)` ordered by createdAt desc, partitioned in JS
6. **Per-student metrics**: streak (consecutive-day count from today/yesterday), breadthScore (uniqueDomains/totalDomains), isInactive (3+ days without question)
7. **Concept heatmap**: JS aggregation by lowercased concept name, sorted by studentCount desc
8. **Misconception clusters**: One `inArray` query on `diagnosticSessions`, grouped by misconceptionId with Set-based dedup for resolved/total counts

Total DB queries: ~5 regardless of class size.

### `apps/web/components/graph/mini-graph-svg.tsx`

`MiniGraphSvg` — pure React function, no `"use client"` directive, RSC-compatible:
- Circular layout: nodes at evenly-spaced angles on radius = `min(width,height) * 0.35`
- Colors match `knowledge-graph.tsx`: `#14b8a6` (healthy), `#f87171` (misconception), `#a1a1aa` (unprobed)
- Node radius: `4 + Math.min(visitCount, 10) * 0.3` (4–7px range)
- Edges: `<line>` elements, `stroke="#e4e4e7"`, `strokeWidth=0.5`
- Empty state: renders "No data" centered text
- `role="img"` + `aria-label="{N} concepts"` for accessibility

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-05-01: EoP on getClassDashboardData | Mitigated — and(eq(classes.id, classId), eq(classes.teacherId, teacherId)) |
| T-05-02: Info disclosure — student data for other classes | Mitigated — studentIds derived from classEnrollments after ownership check |
| T-05-03: Student PII exposure to teacher | Accepted — teacher is authorized per product design |

---

## Known Stubs

None — all data flows are fully wired from DB queries to typed return values.

---

## Threat Flags

None — no new network endpoints or auth paths introduced beyond the documented server action.

---

## Self-Check: PASSED

- `/Users/q/MindMap/apps/web/actions/dashboard.ts` — exists, contains getClassDashboardData, "use server", auth(), teacherId, inArray, breadthScore, isInactive, misconceptionClusters
- `/Users/q/MindMap/apps/web/lib/dashboard-types.ts` — exists, exports ClassDashboardData, StudentSummary, ConceptHeatmapEntry, MisconceptionCluster
- `/Users/q/MindMap/apps/web/components/graph/mini-graph-svg.tsx` — exists, exports MiniGraphSvg, has #14b8a6, #f87171, aria-label, no "use client" directive
- Commit 9c59e7b: feat(05-01): dashboard types and getClassDashboardData server action
- Commit ec394bc: feat(05-01): MiniGraphSvg RSC-compatible static SVG thumbnail component
