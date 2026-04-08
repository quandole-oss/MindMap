---
phase: "05"
plan: "02"
subsystem: teacher-dashboard
tags: [dashboard, tabs, ui, rsc, navigation, sidebar]
dependency_graph:
  requires:
    - apps/web/actions/dashboard.ts
    - apps/web/lib/dashboard-types.ts
    - apps/web/components/graph/mini-graph-svg.tsx
    - apps/web/actions/class.ts
    - apps/web/components/ui/card.tsx
    - apps/web/components/ui/badge.tsx
    - apps/web/components/ui/table.tsx
  provides:
    - apps/web/app/teacher/classes/[classId]/dashboard/page.tsx
    - apps/web/components/dashboard/dashboard-tabs.tsx
    - apps/web/components/dashboard/overview-tab.tsx
    - apps/web/components/dashboard/students-tab.tsx
  affects:
    - apps/web/components/layout/sidebar.tsx (classes prop added)
    - apps/web/components/layout/app-shell.tsx (classes prop forwarded)
    - apps/web/app/teacher/layout.tsx (fetches getTeacherClasses, passes to AppShell)
    - apps/web/app/teacher/page.tsx (primary nav changed to dashboard, roster as secondary)
tech_stack:
  added: []
  patterns:
    - Custom tab bar via useState (no shadcn Tabs) — avoids extra dependency, matches plan's Claude's Discretion note
    - RSC server component page calls server action, passes typed data to client tab shell
    - Sidebar classes prop: optional array passed server-side through layout -> AppShell -> Sidebar
    - Relative time formatting: pure math (no library) — today/yesterday/N days ago/Never
    - Student sort: inactive-first, then desc by lastQuestionDate
key_files:
  created:
    - apps/web/app/teacher/classes/[classId]/dashboard/page.tsx
    - apps/web/components/dashboard/dashboard-tabs.tsx
    - apps/web/components/dashboard/overview-tab.tsx
    - apps/web/components/dashboard/students-tab.tsx
  modified:
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/layout/app-shell.tsx
    - apps/web/app/teacher/layout.tsx
    - apps/web/app/teacher/page.tsx
decisions:
  - Custom tab bar with useState instead of shadcn Tabs (plan specifies this explicitly)
  - Sidebar classes prop is optional with default empty array — backward compatible with student layout
  - AppShell classes prop forwarded to Sidebar — minimal surface for adding class nav
  - Teacher layout fetches getTeacherClasses server-side to populate sidebar without client-side fetch
  - StudentsTab is a server-renderable component (no use client) — MiniGraphSvg is RSC-compatible
  - Nested anchor fix: outer card changed from Link to div, inner dashboard link wraps content area
metrics:
  duration_seconds: 480
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_created: 4
  files_modified: 4
---

# Phase 05 Plan 02: Dashboard UI — Tabs, Overview, Students, Navigation Summary

**One-liner**: Tab-based class dashboard page with Overview stats cards, Students table (mini graph thumbnails, inactivity badges, breadth bars), and class-specific sidebar navigation links wired through server-side layout.

---

## Objective

Build the dashboard page shell, tab navigation, Overview tab, and Students tab, and wire navigation from the sidebar and class list. Concepts and Misconceptions tabs are placeholder stubs for Plan 03.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Dashboard page, tab component, and Overview tab | 19bb422 | apps/web/app/teacher/classes/[classId]/dashboard/page.tsx, apps/web/components/dashboard/dashboard-tabs.tsx, apps/web/components/dashboard/overview-tab.tsx |
| 2 | Students tab with mini graphs + sidebar and class list navigation updates | 32db14a | apps/web/components/dashboard/students-tab.tsx, apps/web/components/layout/sidebar.tsx, apps/web/components/layout/app-shell.tsx, apps/web/app/teacher/layout.tsx, apps/web/app/teacher/page.tsx |

---

## What Was Built

### `apps/web/app/teacher/classes/[classId]/dashboard/page.tsx`

Server component. Awaits `params.classId`, calls `getClassDashboardData(classId)`. Returns `notFound()` on error. Renders page heading and `<DashboardTabs data={data} />`.

### `apps/web/components/dashboard/dashboard-tabs.tsx`

Client component (`"use client"`). `useState<TabId>` with default "overview". Custom horizontal tab bar with 4 buttons — active state: `bg-[#18181b] text-white`, inactive: `text-[#52525b] hover:bg-[#e4e4e7]`. Conditionally renders:
- overview → `<OverviewTab totals={data.totals} />`
- concepts → Coming-soon paragraph (Plan 03 placeholder)
- misconceptions → Coming-soon paragraph (Plan 03 placeholder)
- students → `<StudentsTab students={data.students} />`

### `apps/web/components/dashboard/overview-tab.tsx`

Pure RSC-compatible component. Renders 4 stat cards in `grid-cols-2 lg:grid-cols-4 gap-4` using the shadcn Card component:
1. Students — `totalStudents` with Users icon
2. Questions Asked — `totalQuestions` with MessageSquare icon
3. Active Misconceptions — `activeMisconceptions` with AlertCircle icon (coral text when > 0)
4. Avg. Breadth — `${Math.round(avgBreadthScore * 100)}%` with Compass icon

### `apps/web/components/dashboard/students-tab.tsx`

Pure RSC-compatible component. Sorts students: inactive first, then descending by lastQuestionDate. Uses shadcn Table. Columns: Graph (MiniGraphSvg 80x60), Student name, Last Active (relative time + amber "Inactive" Badge if isInactive), Streak (flame emoji if > 0), Breadth (percentage + inline teal progress bar), Questions count. Empty state: styled placeholder div.

Relative time helper: pure math, no library. days=0 → "Today", days=1 → "Yesterday", null → "Never", else `N days ago`.

### `apps/web/components/layout/sidebar.tsx`

Added optional `classes?: Array<{ id: string; name: string }>` prop (default `[]`). When `role === "teacher"` and `classes.length > 0`: renders a "Classes" section heading then maps each class to a BookOpen-icon link at `/teacher/classes/${cls.id}/dashboard`. Active state matches other nav items. Nav area changed to `overflow-y-auto` to handle many classes gracefully.

### `apps/web/components/layout/app-shell.tsx`

Added `classes` prop, forwarded to `<Sidebar classes={classes} />`.

### `apps/web/app/teacher/layout.tsx`

Added `getTeacherClasses()` call (server-side). Passes result as `classes` to `<AppShell>`. This is the single place that wires class data to sidebar for all teacher routes.

### `apps/web/app/teacher/page.tsx`

Class cards restructured: outer `<Link>` → `<div>` (fixes nested anchor bug). Left side is a `<Link href="/teacher/classes/${cls.id}/dashboard">` with name, badges, and "Open dashboard" label. Right side is a separate `<Link href="/teacher/classes/${cls.id}/roster">` for "View roster →".

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nested anchor tags in teacher class list**
- **Found during:** Task 2
- **Issue:** The plan spec had "View roster →" as a separate link inside the outer card `<Link>`. Nesting `<a>` inside `<a>` is invalid HTML — browsers produce unpredictable behavior.
- **Fix:** Changed outer `<Link>` to `<div>`. Inner `<Link>` covers the class info area (dashboard href). Roster link is a sibling anchor at card right edge.
- **Files modified:** `apps/web/app/teacher/page.tsx`
- **Commit:** 32db14a

---

## Known Stubs

- `concepts` tab in DashboardTabs renders `<p>Coming soon</p>` — Plan 03 will replace with real concept heatmap component.
- `misconceptions` tab in DashboardTabs renders `<p>Coming soon</p>` — Plan 03 will replace with real misconception clusters component.

These stubs are intentional per the plan spec: "Plan 03 will replace this."

---

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-05-04: Spoofing on dashboard page | Mitigated — page calls getClassDashboardData which enforces teacher session + class ownership |
| T-05-05: Info disclosure in sidebar class links | Accepted — getTeacherClasses already filters by session.user.id |

---

## Threat Flags

None — no new network endpoints or auth paths introduced. Dashboard page reuses existing server action (Plan 01). Sidebar navigation links are client-side only.

---

## Self-Check: PASSED

- `/Users/q/MindMap/apps/web/app/teacher/classes/[classId]/dashboard/page.tsx` — exists, contains getClassDashboardData, DashboardTabs, notFound
- `/Users/q/MindMap/apps/web/components/dashboard/dashboard-tabs.tsx` — exists, "use client", useState, overview/concepts/misconceptions/students tabs, OverviewTab, StudentsTab
- `/Users/q/MindMap/apps/web/components/dashboard/overview-tab.tsx` — exists, OverviewTab, totalStudents, avgBreadthScore, grid-cols-2 lg:grid-cols-4
- `/Users/q/MindMap/apps/web/components/dashboard/students-tab.tsx` — exists, StudentsTab, MiniGraphSvg, isInactive, breadthScore, Inactive badge, formatRelativeTime
- `/Users/q/MindMap/apps/web/components/layout/sidebar.tsx` — exists, classes prop, dashboard links per class, BookOpen icon
- `/Users/q/MindMap/apps/web/components/layout/app-shell.tsx` — exists, classes prop forwarded to Sidebar
- `/Users/q/MindMap/apps/web/app/teacher/layout.tsx` — exists, getTeacherClasses, classes passed to AppShell
- `/Users/q/MindMap/apps/web/app/teacher/page.tsx` — exists, dashboard href as primary, roster as secondary link, no nested anchors
- Commit 19bb422: feat(05-02): dashboard page, tab navigation, and overview stats cards
- Commit 32db14a: feat(05-02): students tab, sidebar class links, teacher page dashboard navigation
