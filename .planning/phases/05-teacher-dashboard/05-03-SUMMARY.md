---
phase: "05"
plan: "03"
subsystem: teacher-dashboard
tags: [dashboard, concepts, misconceptions, heatmap, progress-bar, drill-down, ui]
dependency_graph:
  requires:
    - apps/web/lib/dashboard-types.ts
    - apps/web/components/ui/table.tsx
    - apps/web/components/ui/card.tsx
    - apps/web/components/ui/badge.tsx
    - apps/web/components/dashboard/dashboard-tabs.tsx
  provides:
    - apps/web/components/dashboard/concepts-tab.tsx
    - apps/web/components/dashboard/misconceptions-tab.tsx
  affects:
    - apps/web/components/dashboard/dashboard-tabs.tsx (placeholders replaced with real components)
tech_stack:
  added: []
  patterns:
    - Heatmap color encoding via inline rgba style (teal 5-25% opacity based on studentCount/maxStudentCount ratio)
    - Controlled expand/collapse drill-down via useState<string | null> tracking expanded cluster ID
    - Sort-before-render: sorted copy via [...arr].sort() to avoid mutating props
    - Zero-division guard for progress bar (totalAffected=0 → 0%)
key_files:
  created:
    - apps/web/components/dashboard/concepts-tab.tsx
    - apps/web/components/dashboard/misconceptions-tab.tsx
  modified:
    - apps/web/components/dashboard/dashboard-tabs.tsx
decisions:
  - ConceptsTab is a pure server-renderable component (no use client) — only receives props, no interaction
  - MisconceptionsTab uses use client for useState drill-down toggle — single expandedId string tracks which card is open
  - Heatmap color uses rgba(20, 184, 166, opacity) on the entire TableRow via inline style — Tailwind can't express dynamic opacity values
  - Progress bar width uses inline style for dynamic percentage — same reason as heatmap
  - Clusters sorted by unresolvedCount descending so most urgent misconceptions appear first
metrics:
  duration_seconds: 240
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 05 Plan 03: Concepts and Misconceptions Tabs Summary

**One-liner**: Concept heatmap table with teal color-intensity encoding by studentCount and misconception cluster cards with resolution progress bars and student drill-down.

---

## Objective

Replace the "Coming soon" placeholder tabs with real ConceptsTab and MisconceptionsTab components, completing all four dashboard tabs with live data.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Concepts heatmap tab and Misconceptions cluster tab | 0992c5f | apps/web/components/dashboard/concepts-tab.tsx, apps/web/components/dashboard/misconceptions-tab.tsx |
| 2 | Wire Concepts and Misconceptions tabs into DashboardTabs | 38bb1ae | apps/web/components/dashboard/dashboard-tabs.tsx |

---

## What Was Built

### `apps/web/components/dashboard/concepts-tab.tsx`

Pure RSC-compatible component (no `"use client"`). Props: `{ heatmap: ConceptHeatmapEntry[] }`.

Renders a shadcn Table sorted by `studentCount` descending. Each row has an inline `backgroundColor: rgba(20, 184, 166, ${0.05 + intensity * 0.2})` teal gradient — lighter rows have fewer students, darker rows appear for the most widespread concepts. Intensity computed as `studentCount / maxStudentCount`. Domain column uses `<Badge variant="secondary">`. Empty state: "No concepts recorded yet across this class."

### `apps/web/components/dashboard/misconceptions-tab.tsx`

Client component (`"use client"`). Props: `{ clusters: MisconceptionCluster[] }`. Uses `useState<string | null>` to track which cluster ID is expanded for drill-down.

Renders a `grid grid-cols-1 md:grid-cols-2 gap-4` of shadcn Cards. Each card:
1. **Title**: `cluster.misconceptionName` at 16px font-semibold
2. **Stats row**: total affected, resolved count (teal), unresolved count (coral)
3. **Progress bar**: teal fill `width: ${resolvedCount/totalAffected * 100}%` with `${pct}% resolved` label; zero-division guarded
4. **Drill-down toggle**: "Show affected students" / "Hide" button that expands to comma-separated `affectedStudentNames`

Clusters sorted by `unresolvedCount` descending (most urgent first). Empty state: "No misconceptions detected in this class yet."

### `apps/web/components/dashboard/dashboard-tabs.tsx`

Two imports added (`ConceptsTab`, `MisconceptionsTab`). The two "Coming soon" placeholder paragraphs replaced with `<ConceptsTab heatmap={data.conceptHeatmap} />` and `<MisconceptionsTab clusters={data.misconceptionClusters} />`. All four tabs now render real content.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all tabs now render real data from `ClassDashboardData`. No placeholders remain.

---

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-05-06: affectedStudentNames disclosure | Accepted — teacher is authorized for enrolled student data; server action verifies class ownership |
| T-05-07: heatmap color tampering | Accepted — purely visual, no security impact |

---

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Components are display-only, receiving pre-validated data from the server action established in Plan 01.

---

## Self-Check: PASSED

- `/Users/q/MindMap/apps/web/components/dashboard/concepts-tab.tsx` — exists, exports ConceptsTab, imports ConceptHeatmapEntry, uses rgba heatmap coloring, sorted by studentCount desc
- `/Users/q/MindMap/apps/web/components/dashboard/misconceptions-tab.tsx` — exists, exports MisconceptionsTab, "use client", useState drill-down, progress bar, sorted by unresolvedCount desc
- `/Users/q/MindMap/apps/web/components/dashboard/dashboard-tabs.tsx` — exists, imports ConceptsTab + MisconceptionsTab, no "Coming soon" text, passes conceptHeatmap + misconceptionClusters
- Commit 0992c5f: feat(05-03): concept heatmap tab and misconception cluster tab
- Commit 38bb1ae: feat(05-03): wire ConceptsTab and MisconceptionsTab into DashboardTabs
