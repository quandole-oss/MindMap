---
phase: 02-curiosity-engine
plan: 04
subsystem: question-history-streak
tags: [question-history, streak-badge, sidebar-nav, server-actions, lucide-react]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [question-history-page, streak-badge, sidebar-my-questions-nav]
  affects:
    - apps/web/app/student/questions/page.tsx
    - apps/web/components/questions/question-history.tsx
    - apps/web/components/questions/streak-badge.tsx
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/layout/app-shell.tsx
    - apps/web/app/student/layout.tsx
    - apps/web/actions/questions.ts
tech_stack:
  added: []
  patterns: [server-component-page, client-component-expand-collapse, streak-prop-drilling, date-grouping-utc]
key_files:
  created:
    - apps/web/app/student/questions/page.tsx
    - apps/web/components/questions/question-history.tsx
    - apps/web/components/questions/streak-badge.tsx
  modified:
    - apps/web/actions/questions.ts
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/layout/app-shell.tsx
    - apps/web/app/student/layout.tsx
decisions:
  - "Fix getStreak() to allow streak continuation when today has no question yet — check yesterday as valid starting point before returning 0"
  - "StreakBadge rendered conditionally only for student role in sidebar (not teacher)"
  - "Date grouping uses UTC comparison throughout — consistent with server-side UTC date handling"
  - "Task 3 human-verify checkpoint auto-approved per orchestrator instruction (autonomous execution context)"
metrics:
  duration_seconds: 137
  completed_date: "2026-04-08"
  tasks_completed: 3
  files_created: 3
  files_modified: 4
---

# Phase 02 Plan 04: Question History and Streak UI Summary

**One-liner**: `/student/questions` history page with UTC date-grouped entries and expand/collapse answers, plus a `StreakBadge` component (Flame + count, hidden at 0) wired through the student layout into the sidebar, and a "My Questions" nav link added to sidebar navigation.

---

## What Was Built

**`apps/web/actions/questions.ts`** (extended):
- `getQuestionHistory()`: added explicit `limit: 30` per UI-SPEC ("render up to 30 entries")
- `getStreak()`: rewrote streak logic to correctly handle the case where today has no question yet — the streak doesn't break until the day *passes* without a question. If the most recent question was yesterday (and today is not yet done), the streak still counts backward from yesterday. Previous logic returned 0 in this valid streak scenario.

**`apps/web/app/student/questions/page.tsx`** (server component):
- Auth gate: redirects to `/login` if no session
- Calls `getQuestionHistory()` and normalizes `createdAt` to `Date` objects
- Renders "My Questions" heading (20px/600 per UI-SPEC)
- Renders `<QuestionHistory>` client component with question data

**`apps/web/components/questions/question-history.tsx`** (client component):
- Groups questions by UTC date header: "Today", "Yesterday", or "{Month D, YYYY}"
- Each group has a sticky `<h2>` date header with muted background, label size (14px/400)
- Each question renders in a `<Card>` with:
  - Question text in heading style (20px/600)
  - Timestamp — time-only for today/yesterday, full date+time otherwise
  - "See answer" / "Hide answer" toggle button with `aria-expanded` state
  - Collapsed by default; expanding shows `aiResponse` as pre-wrapped text
- Empty state: "No questions yet" heading + instructional body text
- Phase 3+ virtualization note in code comment (list capped at 30 entries)

**`apps/web/components/questions/streak-badge.tsx`** (client component):
- Returns `null` when `streak === 0` — badge hidden per UI-SPEC
- Renders shadcn `<Badge variant="secondary">` with:
  - Lucide `Flame` icon at `size-3.5` (14px), orange tint
  - Text: `{streak} day streak`
  - `h-7` height (28px per UI-SPEC)
  - Container `aria-label="Current streak: {N} days"` for accessibility

**`apps/web/components/layout/sidebar.tsx`** (updated):
- Added `MessageSquare` import from lucide-react
- Added `StreakBadge` import from `@/components/questions/streak-badge`
- Added `streak?: number` to `SidebarProps`
- Added "My Questions" nav item `{ href: "/student/questions", label: "My Questions", icon: MessageSquare }` — inserted as second item between Dashboard and Join a Class
- Renders `<StreakBadge streak={streak ?? 0} />` below userName, above logout button — student role only

**`apps/web/components/layout/app-shell.tsx`** (updated):
- Added `streak?: number` to `AppShellProps`
- Passes `streak` through to `<Sidebar>`

**`apps/web/app/student/layout.tsx`** (updated):
- Imports `getStreak` from `@/actions/questions`
- Calls `await getStreak()` after auth check
- Passes `streak` to `<AppShell>` — streak is server-rendered on every student page load, no real-time sync needed (per UI-SPEC)

---

## Threat Model Compliance

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-02-13 (Spoofing) | MITIGATED | `getQuestionHistory()` and `getStreak()` both check `auth()` session; userId from session only |
| T-02-14 (Information Disclosure) | MITIGATED | `/student/questions` server component redirects if no session; `getQuestionHistory` filters by `session.user.id` |
| T-02-15 (DoS) | ACCEPTED | `getQuestionHistory` limit 30, `getStreak` limit 365 — no unbounded queries |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getStreak() didn't handle "no question today but streak intact" case**
- **Found during:** Task 1 (code review of existing implementation)
- **Issue:** The existing `getStreak()` started `checkDate` from today and broke immediately if today had no question (any past date < today triggers break). Students with a valid streak who haven't asked yet today would see streak = 0.
- **Fix:** Check if the most recent question date is today or yesterday before starting streak count. If neither, return 0. Otherwise start counting backward from the most recent question date.
- **Files modified:** `apps/web/actions/questions.ts`
- **Commit:** 1891912

**2. [Rule 2 - Missing] getQuestionHistory() had no row limit**
- **Found during:** Task 1 (comparing implementation to UI-SPEC)
- **Issue:** UI-SPEC explicitly states "render up to 30 entries" and notes Phase 3+ may need virtualization. The existing implementation had no limit.
- **Fix:** Added `limit: 30` to the `findMany` query.
- **Files modified:** `apps/web/actions/questions.ts`
- **Commit:** 1891912

**3. Task 3 checkpoint auto-approved**
- Orchestrator instructed to auto-approve the human-verify checkpoint in this execution context.
- Build was verified passing before approval.

---

## Known Stubs

None. All data flows are wired:
- `getQuestionHistory()` is a live DB query filtered by session user
- `getStreak()` is a live DB query with correct UTC streak calculation
- `StreakBadge` receives streak from server via layout → AppShell → Sidebar prop chain
- `QuestionHistory` receives real question data from server component page

---

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced beyond what the plan's threat model covers.

---

## Self-Check: PASSED

Files confirmed present:
- apps/web/app/student/questions/page.tsx: FOUND
- apps/web/components/questions/question-history.tsx: FOUND
- apps/web/components/questions/streak-badge.tsx: FOUND
- apps/web/components/layout/sidebar.tsx: MODIFIED (My Questions + StreakBadge)
- apps/web/components/layout/app-shell.tsx: MODIFIED (streak prop)
- apps/web/app/student/layout.tsx: MODIFIED (getStreak call)

Commits confirmed:
- 1891912 feat(02-04): add question history page and fix streak logic
- e9aebb8 feat(02-04): add streak badge and update sidebar navigation

Build: PASSED (5 successful, 0 failed, 10.4s)
