---
phase: 06-demo-deployment
plan: "04"
subsystem: accessibility, responsive-design, error-handling
tags: [wcag, responsive, mobile, llm-errors, color-contrast]
dependency_graph:
  requires: []
  provides:
    - WCAG AA compliant node health colors across all graph components
    - Responsive layout (375px+) with mobile sidebar drawer
    - Graceful LLM error handling with 503 detection and retry UI
  affects:
    - apps/web/components/graph/knowledge-graph.tsx
    - apps/web/components/graph/mini-graph-svg.tsx
    - apps/web/components/graph/health-legend.tsx
    - apps/web/components/graph/node-detail-panel.tsx
    - apps/web/components/layout/app-shell.tsx
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/dashboard/dashboard-tabs.tsx
    - apps/web/components/dashboard/concepts-tab.tsx
    - apps/web/components/dashboard/students-tab.tsx
    - apps/web/components/dashboard/misconceptions-tab.tsx
    - apps/web/components/dashboard/overview-tab.tsx
    - apps/web/components/questions/question-form.tsx
    - apps/web/components/diagnostic/diagnostic-chat.tsx
    - apps/web/app/api/ask/route.ts
    - apps/web/app/api/diagnose/route.ts
    - apps/web/app/globals.css
    - apps/web/app/teacher/page.tsx
tech_stack:
  added: []
  patterns:
    - WCAG AA 3:1 minimum contrast for graphical objects on white background
    - CSS custom property update propagates to all var() consumers (health-legend)
    - Mobile-first responsive layout with lg: breakpoint sidebar reveal
    - 503 API response for missing ANTHROPIC_API_KEY (T-06-12 mitigation)
    - getErrorMessage() pattern for distinguishing HTTP error types in client
key_files:
  created: []
  modified:
    - apps/web/app/globals.css
    - apps/web/components/graph/knowledge-graph.tsx
    - apps/web/components/graph/mini-graph-svg.tsx
    - apps/web/components/graph/node-detail-panel.tsx
    - apps/web/components/layout/app-shell.tsx
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/dashboard/dashboard-tabs.tsx
    - apps/web/components/dashboard/concepts-tab.tsx
    - apps/web/components/dashboard/students-tab.tsx
    - apps/web/components/dashboard/misconceptions-tab.tsx
    - apps/web/components/dashboard/overview-tab.tsx
    - apps/web/components/questions/question-form.tsx
    - apps/web/components/diagnostic/diagnostic-chat.tsx
    - apps/web/app/api/ask/route.ts
    - apps/web/app/api/diagnose/route.ts
    - apps/web/app/teacher/page.tsx
decisions:
  - "WCAG AA color update via CSS custom properties in globals.css propagates automatically to health-legend.tsx via var() — no direct change to that file needed"
  - "AppShell converted to use client for mobile hamburger state; sidebar hidden below lg: breakpoint, full overlay drawer on mobile"
  - "503 API key check placed after auth check but before any LLM calls — returns generic JSON message that does not leak env var values (T-06-11)"
  - "getErrorMessage() matches on HTTP status codes and error text fragments to classify 503/401/504 separately"
  - "Old #14b8a6/#f87171/#a1a1aa colors auto-fixed across 6 additional files discovered during full-codebase scan (Rule 1)"
metrics:
  duration_seconds: 360
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_modified: 17
---

# Phase 06 Plan 04: Accessibility, Responsive Design & LLM Error Resilience Summary

**One-liner:** WCAG AA node health colors (teal-600/red-600/zinc-500/violet-600), mobile-first sidebar drawer at 375px, and 503-aware LLM error handling with retry UI.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | WCAG AA color audit and fix | `59107b4` | knowledge-graph.tsx, mini-graph-svg.tsx, globals.css |
| 2 | Responsive design + graceful LLM error handling | `c0cb067` | app-shell.tsx, question-form.tsx, diagnostic-chat.tsx, /api/ask, /api/diagnose |

---

## What Was Built

### Task 1 — WCAG AA Color Audit (DEMO-04)

All four node health state colors were darkened to pass WCAG AA 3:1 minimum contrast ratio against white background (required for graphical UI objects):

| State | Old Color | New Color | Contrast vs #fff |
|-------|-----------|-----------|-----------------|
| healthy | `#14b8a6` (teal-500) | `#0d9488` (teal-600) | ~4.0:1 |
| misconception | `#f87171` (red-400) | `#dc2626` (red-600) | ~4.6:1 |
| unprobed | `#a1a1aa` (zinc-400) | `#71717a` (zinc-500) | ~4.7:1 |
| bridge | `#a78bfa` (violet-400) | `#7c3aed` (violet-600) | ~5.4:1 |

Changes applied to:
- `knowledge-graph.tsx` — NODE_COLORS constant, edge color fallbacks, bridge pulse animation keyframes
- `mini-graph-svg.tsx` — NODE_COLORS constant, empty state text fill
- `globals.css` — CSS custom properties (`--color-healthy` etc.) — health-legend.tsx picks these up via `var()` automatically

### Task 2 — Responsive Design + LLM Error Handling (DEMO-05, DEMO-06)

**Responsive (DEMO-05):**
- `AppShell` converted to `"use client"` to support mobile menu toggle state
- Sidebar now `hidden lg:block` — invisible below 1024px breakpoint
- Mobile drawer: full-screen overlay with backdrop + slide-in sidebar panel, triggered by hamburger button in mobile header
- Main content: `px-4 sm:px-6 lg:px-8` padding, `overflow-x-hidden` to prevent horizontal scroll
- `DashboardTabs`: tab bar has `overflow-x-auto flex-nowrap` so tabs scroll horizontally on narrow viewports
- `ConceptsTab` and `StudentsTab`: Table components wrapped in `overflow-x-auto` container

**LLM Error Handling (DEMO-06):**
- `/api/ask/route.ts`: 503 check for missing `ANTHROPIC_API_KEY` placed after auth, before any LLM call
- `/api/diagnose/route.ts`: same 503 check
- `question-form.tsx`: `getErrorMessage()` function distinguishes 503/API-key-missing, 504/timeout, and generic errors. Added `pendingQuestion` state and "Try again" `<Button>` that re-submits the last question
- `diagnostic-chat.tsx`: `error` and `reload` extracted from `useChat`; inline error block with `AlertCircle` icon, specific message for 503, and "Retry" button calling `reload()`

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Old colors found in 6 additional files during full-codebase scan**
- **Found during:** Task 2 verification scan
- **Issue:** After updating the 3 primary graph files in Task 1, a codebase scan revealed `#14b8a6`, `#f87171`, and `#a1a1aa` still present in: `node-detail-panel.tsx`, `misconceptions-tab.tsx`, `overview-tab.tsx`, `students-tab.tsx`, `sidebar.tsx`, `teacher/page.tsx`
- **Fix:** Updated all occurrences to their WCAG AA compliant equivalents (`#0d9488`, `#dc2626`, `#71717a`)
- **Files modified:** 6 additional files
- **Commit:** `c0cb067`

---

## Known Stubs

None — all data is wired to real DB queries and LLM endpoints.

---

## Threat Surface Scan

No new network endpoints or auth paths introduced. The 503 response from `/api/ask` and `/api/diagnose` returns only a generic error message — no env var values, no stack traces, no internal paths (T-06-11 compliant).

---

## Self-Check: PASSED

- `apps/web/app/globals.css` — updated CSS variables present
- `apps/web/components/graph/knowledge-graph.tsx` — NODE_COLORS uses #0d9488, #dc2626, #71717a, #7c3aed
- `apps/web/components/graph/mini-graph-svg.tsx` — NODE_COLORS uses #0d9488, #dc2626, #71717a
- `apps/web/components/layout/app-shell.tsx` — mobile drawer and lg:ml-[240px] present
- `apps/web/app/api/ask/route.ts` — ANTHROPIC_API_KEY check returns 503
- `apps/web/app/api/diagnose/route.ts` — ANTHROPIC_API_KEY check returns 503
- `apps/web/components/questions/question-form.tsx` — getErrorMessage() and Try again button present
- `apps/web/components/diagnostic/diagnostic-chat.tsx` — error/reload from useChat, Retry button present
- Commits `59107b4` and `c0cb067` exist in git log
