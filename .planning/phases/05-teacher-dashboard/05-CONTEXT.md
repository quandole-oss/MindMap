# Phase 5: Teacher Dashboard - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the teacher class dashboard with tab-based navigation (Overview, Concepts, Misconceptions, Students), student graph thumbnails, concept heatmap, misconception cluster view with repair progress, curiosity breadth scores, and engagement alerts for inactive students.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Views & Layout
- Tab-based navigation within /teacher/classes/[classId] — tabs for Overview, Concepts, Misconceptions, Students
- Student graph thumbnails as static SVG snapshots (server-rendered mini graphs) — fast, no D3 per student
- Concept heatmap as table with color-coded cells (frequency → color intensity) — simple, accessible
- Misconception cluster view as grouped cards by misconception name showing affected student count + resolution rate

### Metrics & Engagement
- Curiosity breadth score: count of unique subject domains explored / total domains — percentage
- Inactivity alert threshold: no question in 3+ days — shown as amber badge on student row
- Repair progress: progress bar per misconception showing resolved/total students affected
- Data aggregation via server actions with Drizzle aggregate queries — run on page load

### Claude's Discretion
- Tab component implementation (shadcn Tabs or custom)
- Mini graph SVG generation approach
- Color intensity scale for heatmap cells
- Specific Drizzle aggregate query patterns
- Dashboard page layout responsive breakpoints

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Teacher dashboard shell at /teacher with class list
- Class roster page at /teacher/classes/[classId]/roster
- All DB schema: concepts (with status, visitCount, domain), questions, diagnostic_sessions (with outcome), class_enrollments
- shadcn/ui components: Card, Badge, Table, Button, etc.
- Graph server actions in actions/graph.ts (getGraphData pattern)

### Established Patterns
- Server actions in apps/web/actions/
- Drizzle queries with aggregates (count, groupBy)
- Next.js dynamic routes with [classId]
- App shell with sidebar

### Integration Points
- New /teacher/classes/[classId]/dashboard page with tabs
- New server actions for dashboard aggregation queries
- Teacher sidebar needs "Class Dashboard" links per class
- Mini graph thumbnails need simplified version of graph data

</code_context>

<specifics>
## Specific Ideas

- Overview tab: class stats (total students, total questions, active misconceptions, avg breadth score)
- Concepts tab: heatmap table with concept names as rows, frequency as color intensity
- Misconceptions tab: cards grouped by misconception name, each with progress bar (resolved/total)
- Students tab: table with name, last active, streak, breadth score, inactivity badge
- Click student thumbnail → navigate to detailed student view (or expand inline)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
