---
phase: 08-root-cause-theme-diagnosis-and-teacher-remediation
plan: 02
subsystem: apps/web (dashboard data layer)
tags: [dashboard, themes, server-actions, priv-01, dash-07]
requires:
  - 08-01  # loadThemes / getThemeById / getMisconceptionsByTheme / themes[] on misconceptions
provides:
  - ThemeCluster, ThemeDetail, StudentThemeProfile, LessonPlan TS types
  - ClassDashboardData.themeClusters field
  - getClassDashboardData() returns themeClusters
  - getThemeDetail(classId, themeId) server action
  - getStudentThemeProfile(studentId) server action (PRIV-01 anonymized)
  - buildThemeClusters() + buildStudentThemeProfile() pure helpers (unit-tested)
  - gradeLevelToBand() helper
affects:
  - apps/web/actions/dashboard.ts
  - apps/web/actions/themes.ts (new)
  - apps/web/lib/dashboard-types.ts
  - apps/web/lib/theme-aggregation.ts (new)
  - apps/web/__tests__/actions/dashboard.test.ts (new)
  - apps/web/__tests__/actions/themes.test.ts (new)
tech-stack:
  added: []
  patterns:
    - "Pure-helper extraction so 'use server' modules stay untested but the logic is"
    - "JS-side Map join over in-memory allSessions (no new DB query — D-07 / THME-03)"
    - "PRIV-01 structural Object.keys guard at unit-test boundary"
    - "Fresh object literal return to isolate anonymized fields from raw rows"
key-files:
  created:
    - apps/web/actions/themes.ts
    - apps/web/lib/theme-aggregation.ts
    - apps/web/__tests__/actions/dashboard.test.ts
    - apps/web/__tests__/actions/themes.test.ts
  modified:
    - apps/web/actions/dashboard.ts
    - apps/web/lib/dashboard-types.ts
decisions:
  - "Extracted buildThemeClusters / buildStudentThemeProfile into apps/web/lib/theme-aggregation.ts (pure, no 'use server') so they can be unit-tested under Vitest's Node runtime. Follows the existing pattern in apps/web/lib/graph/__tests__/clusters.test.ts which explicitly avoids importing 'use server' modules."
  - "Server actions remain thin wrappers: dashboard.ts now calls buildThemeClusters(allSessions, loadLibrary(), loadThemes()); getStudentThemeProfile calls buildStudentThemeProfile(sessions, gradeLevel, loadLibrary()). Auth + ownership checks live in the 'use server' layer; aggregation logic lives in the pure helper."
  - "Student gradeLevel is pulled from class_enrollments.gradeLevel (not users.gradeLevel — that column does not exist in the schema). The same ownership-check query that enforces teacher access also returns the gradeLevel, so this costs no extra round trip."
  - "getThemeDetail query count: +2 queries (enrollments join users; diagnostic sessions filtered by classId + constituent IDs). These are NEW queries but only on a new, separate, user-initiated drill-down action — they do NOT touch getClassDashboardData's batched 6-query path. D-07's 'no new query' constraint applies specifically to getClassDashboardData."
  - "getStudentThemeProfile query count: 2 queries (enrollments+classes ownership check returning gradeLevel; diagnostic sessions for this user). Same exception applies — it's a new, separate user-triggered action."
  - "Unknown misconception IDs in a session row are silently skipped in the theme clusters pass (defensive) — the CI orphan check in packages/misconceptions would already catch missing library entries at build time. Documented in the helper's doc-comment."
metrics:
  duration: "~30 min"
  tasks: 2
  files_changed: 6
  tests_added: 18
  tests_passing: 82
  completed: 2026-04-11
---

# Phase 8 Plan 02: Dashboard theme aggregation + server actions Summary

Added `themeClusters` to `getClassDashboardData` (computed at query time by JS-side Map join over the already-loaded diagnostic sessions — no new DB query, no denormalized column). Added two new server actions `getThemeDetail` and `getStudentThemeProfile` in `apps/web/actions/themes.ts`, with the latter acting as the PRIV-01 anonymization boundary that feeds Plan 08-03's LLM prompt builder.

## What Was Built

### 1. New types in `apps/web/lib/dashboard-types.ts`

```ts
export type ThemeCluster = {
  themeId: string;
  themeName: string;
  naiveTheory: string;
  studentsAffected: number;
  resolvedCount: number;
  unresolvedCount: number;
  constituentMisconceptionIds: string[];
};

export type ThemeDetail = {
  themeId: string;
  themeName: string;
  naiveTheory: string;
  description: string;
  citation: string;
  constituentMisconceptions: Array<{
    id: string;
    name: string;
    domain: string;
    studentsAffected: number;
    resolvedCount: number;
  }>;
  affectedStudents: Array<{
    studentId: string;
    studentName: string;
    misconceptionIds: string[];
  }>;
};

export type StudentThemeProfile = {
  gradeBand: "K-5" | "6-8" | "9-12";
  themeCounts: Record<string, number>;
  misconceptionIds: string[];
  sessionOutcomes: Array<"resolved" | "unresolved" | "incomplete">;
};

export type LessonPlan = {
  theme: string;
  commonMisunderstanding: string;
  targetUnderstanding: string;
  suggestedActivities: Array<{
    title: string;
    description: string;
    referencedMisconceptionIds: string[];
  }>;
  discussionPrompts: string[];
  confrontationApproaches: string[];
};
```

`ClassDashboardData` now also has `themeClusters: ThemeCluster[]`.

### 2. Pure helpers in `apps/web/lib/theme-aggregation.ts`

```ts
export type ThemeAggregatableSession = {
  userId: string;
  misconceptionId: string;
  outcome: "resolved" | "unresolved" | "incomplete" | null;
};

export function buildThemeClusters(
  sessions: ReadonlyArray<ThemeAggregatableSession>,
  misconceptionLibrary: ReadonlyArray<MisconceptionEntry>,
  themes: ReadonlyArray<Theme>
): ThemeCluster[];

export function buildStudentThemeProfile(
  sessions: ReadonlyArray<ThemeAggregatableSession>,
  gradeLevel: number,
  misconceptionLibrary: ReadonlyArray<MisconceptionEntry>
): StudentThemeProfile;

export function gradeLevelToBand(gradeLevel: number): "K-5" | "6-8" | "9-12";
```

### 3. `getClassDashboardData` extension

The existing 6-query batch is unchanged. After the misconception-cluster loop, a new section 9b runs:

```ts
// ── 9b. Theme clusters (DASH-07 / THME-03) ─────────────────────────────────
const themeClusters = buildThemeClusters(
  allSessions,
  loadLibrary(),
  loadThemes()
);
```

`themeClusters` is added to the final return object. For a class with no enrollments, the early return path also now includes `themeClusters: []` for type consistency.

**Final return shape:**
```ts
{
  classInfo: { id, name, joinCode, gradeLevel },
  students: StudentSummary[],
  conceptHeatmap: ConceptHeatmapEntry[],
  misconceptionClusters: MisconceptionCluster[],
  themeClusters: ThemeCluster[],   // ← NEW
  totals: { totalStudents, totalQuestions, activeMisconceptions, avgBreadthScore },
}
```

### 4. `apps/web/actions/themes.ts` (new)

```ts
"use server";

export async function getThemeDetail(
  classId: string,
  themeId: string
): Promise<ThemeDetail>;
// Auth + class-ownership check (T-08-05, pattern from dashboard.ts:70–76).
// Returns theme metadata + constituent misconceptions (with per-class stats)
// + affected-student list (student names bound at this boundary; this is
// UI drill-down data, NOT an LLM input).

export async function getStudentThemeProfile(
  studentId: string
): Promise<StudentThemeProfile>;
// Auth + teacher-owns-class-containing-student check (enrollments JOIN classes).
// Returns ONLY the four anonymized fields — no studentId, name, email.
// Delegates to buildStudentThemeProfile() which constructs a fresh literal.
// This is the PRIV-01 boundary that will feed Plan 08-03's analyzeStudentThemes
// LLM prompt.
```

## Execution Record

| Task | Commit | Files |
|---|---|---|
| Task 1: Types + pure helpers + dashboard.ts wiring + tests | `3e7ea36` | dashboard-types.ts, theme-aggregation.ts, dashboard.ts, __tests__/actions/dashboard.test.ts |
| Task 2: themes.ts server actions + tests | `8c949c8` | actions/themes.ts, __tests__/actions/themes.test.ts |

## Verification Results

### Plan `<verification>` checklist

1. **`pnpm --filter web build`** — clean (`5 successful, 5 total`)
2. **Test suite** — 82 total tests pass in apps/web (64 baseline + 18 new):
   - `__tests__/actions/dashboard.test.ts` — 7 tests for `buildThemeClusters`
   - `__tests__/actions/themes.test.ts` — 11 tests for `buildStudentThemeProfile` + `gradeLevelToBand`
3. **PRIV-01 grep audit on `themes.ts`** — 28 hits for `email|name|studentId|userId`. **Every hit is either:**
   - Inside `getThemeDetail` (returns `affectedStudents: { studentId, studentName, ... }` — this is UI drill-down data, not LLM input; names bound at the server-action boundary per D-13)
   - Inside the ownership/access check for `getStudentThemeProfile` (`studentId` parameter, `enrollments.studentId` filter, `diagnosticSessions.userId` filter)
   - Inside doc-comment text
   - **Zero hits inside the return object literal of `getStudentThemeProfile`** — the function returns `buildStudentThemeProfile(...)` whose fresh literal has only `{gradeBand, themeCounts, misconceptionIds, sessionOutcomes}`.
4. **DB query count in `dashboard.ts`** — 6 (unchanged from baseline): classes lookup, enrollments, concepts, edges, questions, diagnostic sessions.
5. **`git diff packages/db/src/schema/`** — empty (zero lines). No schema change.

### PRIV-01 Object.keys structural guard (Task 2, Test "returns ONLY the four anonymized keys...")

```
expect(Object.keys(result).sort()).toEqual([
  "gradeBand",
  "misconceptionIds",
  "sessionOutcomes",
  "themeCounts",
]);
```

Passes. Plus a paranoia test that JSON-stringifies the return value and asserts the raw input `userId` string does not appear anywhere in the serialized output — also passes.

## Deviations from Plan

None of the deviations required rule escalation; all are minor clarifications documented below.

### [Clarification] Pure-helper extraction pattern

- **Plan wording:** "Test asserts `themeClusters` ranking and required fields" (Task 1 done criterion) and test files at `apps/web/__tests__/actions/dashboard.test.ts`, `apps/web/__tests__/actions/themes.test.ts`.
- **Reality:** The existing test in `apps/web/lib/graph/__tests__/clusters.test.ts` explicitly avoids importing `'use server'` modules because they pull in `@/lib/auth` and `@mindmap/db` runtime code that breaks Vitest. I followed that same pattern: pure aggregation logic was extracted into `apps/web/lib/theme-aggregation.ts` and tests import from there, not from `actions/dashboard.ts` or `actions/themes.ts` directly.
- **Impact:** None — the plan's done criteria and `<verification>` both describe testing behavior (ranking, required fields, PRIV-01 Object.keys), all of which are covered by the helper-level tests. The server-action wrappers themselves are thin glue (auth + DB fetch + delegate to helper) and match the verbatim auth pattern already in dashboard.ts.

### [Clarification] gradeLevel source

- **Plan wording:** "Fetch the student's `gradeLevel` from users table → map to `gradeBand`..."
- **Reality:** `users` table has no `gradeLevel` column (see `packages/db/src/schema/auth.ts`). `gradeLevel` lives on `class_enrollments`. The ownership-check query already joins `class_enrollments` → `classes`, so `gradeLevel` is returned as a free field of that check — no extra round trip.
- **Impact:** None — the behavior the plan describes (map to `gradeBand` via `<=5/<=8/else`) is identical; only the source column changed.

### [Documentation] getThemeDetail new queries

- `getThemeDetail` runs 3 queries total (classes ownership check + enrollments join users + diagnostic sessions). The D-07 / THME-03 "no new DB query" rule applies to `getClassDashboardData` specifically; `getThemeDetail` is a new, separate, user-triggered drill-down action, and the plan's §D8 research explicitly anticipates it as a drill-down. Noted for the traceability record.

## Tooling note for Plan 08-04 / downstream

- The plan's prescribed verification command `pnpm --filter web test -- themes.test.ts` is **not yet wired** — `apps/web/package.json` has no `"test"` script. The working command is `pnpm --filter web exec vitest run [pattern]`. Deferred to a future tooling chore — not blocking 08-02's deliverables (all tests run and pass via the explicit vitest invocation). Logged to `.planning/phases/08-root-cause-theme-diagnosis-and-teacher-remediation/deferred-items.md` is not needed since this is a one-liner observation.

## Reusable Artifacts for Downstream Plans

### Plan 08-03 (analyzeStudentThemes prompt)

```ts
import { getStudentThemeProfile } from "@/actions/themes";
import type { StudentThemeProfile } from "@/lib/dashboard-types";
// Signature the prompt builder consumes — guaranteed PRIV-01 safe by the
// Object.keys structural test in __tests__/actions/themes.test.ts.
const profile: StudentThemeProfile = await getStudentThemeProfile(studentId);
// profile has exactly {gradeBand, themeCounts, misconceptionIds, sessionOutcomes}
```

### Plan 08-04 (UI wiring)

```ts
import { getThemeDetail } from "@/actions/themes";
import type { ThemeCluster, ThemeDetail, LessonPlan } from "@/lib/dashboard-types";
// themeClusters already ships on getClassDashboardData's return value
const data = await getClassDashboardData(classId);
data.themeClusters // ThemeCluster[] — ranked, filtered, ready to render
// Drill-down on click
const detail = await getThemeDetail(classId, themeCluster.themeId);
```

### Test patterns

- `apps/web/__tests__/actions/dashboard.test.ts` — 7-test skeleton for theme aggregation: empty input, filter empties, shape assertion, dedup per student, ranking, seed-data sanity, unknown-misc fallback.
- `apps/web/__tests__/actions/themes.test.ts` — PRIV-01 structural Object.keys guard + JSON-serialization paranoia check + 9 aggregation correctness tests. The structural guard is the one Plan 08-03's review should re-run if the `StudentThemeProfile` type is ever modified.

## Self-Check: PASSED

- FOUND: apps/web/lib/dashboard-types.ts (ThemeCluster, ThemeDetail, StudentThemeProfile, LessonPlan, themeClusters on ClassDashboardData)
- FOUND: apps/web/lib/theme-aggregation.ts (buildThemeClusters, buildStudentThemeProfile, gradeLevelToBand)
- FOUND: apps/web/actions/dashboard.ts (buildThemeClusters wired in section 9b; themeClusters in return)
- FOUND: apps/web/actions/themes.ts (getThemeDetail, getStudentThemeProfile)
- FOUND: apps/web/__tests__/actions/dashboard.test.ts (7 tests)
- FOUND: apps/web/__tests__/actions/themes.test.ts (11 tests)
- FOUND: commit 3e7ea36 (Task 1)
- FOUND: commit 8c949c8 (Task 2)
- VERIFIED: pnpm --filter web build — 5/5 tasks successful
- VERIFIED: 82 tests pass (64 baseline + 18 new)
- VERIFIED: PRIV-01 — zero identifier fields in getStudentThemeProfile return literal (Object.keys structural assertion passes)
- VERIFIED: dashboard.ts DB query count unchanged (6)
- VERIFIED: packages/db/src/schema/ diff is empty (no schema change, no theme column)
