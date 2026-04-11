---
phase: 08-root-cause-theme-diagnosis-and-teacher-remediation
fixed_at: 2026-04-10T21:18:00Z
review_path: .planning/phases/08-root-cause-theme-diagnosis-and-teacher-remediation/08-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 5
skipped: 2
status: partial
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-04-10
**Source review:** .planning/phases/08-root-cause-theme-diagnosis-and-teacher-remediation/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR:1, WR:2, IN:4)
- Fixed: 5 (CR-01, WR-01, WR-02, IN-01, IN-04)
- Skipped: 2 (IN-02, IN-03) — docblock wording / cosmetic variable shadowing; out of scope per instructions (fix info-level only if trivial)

Verification:
- `pnpm build` — passes (5/5 tasks, web bundle clean)
- `pnpm test` — passes (7/7 tasks)
- `bash scripts/priv-01-audit.sh` — PASSED

## Fixed Issues

### CR-01: `getOrGenerateLessonPlan` force-regenerate unique-constraint crash

**Files modified:**
- `packages/db/src/schema/theme-lesson-plans.ts`
- `packages/db/src/migrations/0000_abandoned_polaris.sql`
- `packages/db/src/migrations/meta/0000_snapshot.json`
- `apps/web/actions/themes.ts`

**Commit:** 7d6e6d0

**Applied fix:** Downgraded `theme_lesson_plans_class_theme_hash_idx` from `uniqueIndex` to plain `index` in the Drizzle schema, updated the generated migration SQL (`CREATE UNIQUE INDEX` -> `CREATE INDEX`), and flipped `isUnique: true` -> `false` in `0000_snapshot.json` to keep drizzle-kit in sync. Added `orderBy: [desc(schema.themeLessonPlans.generatedAt)]` to the cache `findFirst` call so the cache HIT path returns the most-recent plan for a given (class, theme, dataHash) triple. D-18 append-only semantics preserved — force-regenerate now appends a new row even when the data hash matches an existing row. Expanded the schema docblock to explain why the index is deliberately NOT unique.

### WR-01: `getStudentThemeProfile` cross-class session leak

**Files modified:** `apps/web/actions/themes.ts`

**Commit:** 69e39ea

**Applied fix:** Rewrote the session fetch to `selectDistinct` joined through `class_enrollments` -> `classes` with `WHERE classes.teacherId = teacherId AND diagnostic_sessions.userId = studentId`. The inner join is the authorization boundary — sessions belonging to a student enrolled in some other teacher's class are excluded by the join predicate. Added a docblock documenting the remaining single-class assumption: `diagnostic_sessions` still has no `classId` column, so a co-taught student will surface the same rows for both teachers. That is now an explicit documented caveat rather than a silent cross-teacher leak. `DISTINCT` protects against row duplication if a student is enrolled in multiple classes owned by the same teacher.

### WR-02: `phys-001` theme mis-tagging

**Files modified:** `packages/misconceptions/library/physics.yaml`

**Commit:** ec8abe8

**Applied fix:** Updated `phys-001` themes from `[continuous-force-required-for-motion]` to `[substance-based-reasoning, continuous-force-required-for-motion]`. `substance-based-reasoning` is now the primary root ("more matter = falls harder" is a weight-as-stuff intuition), matching the reviewer's categorization. The old `continuous-force-required-for-motion` tag is retained as a secondary to (a) acknowledge the residual impetus-flavored reading of "heavier objects want to fall harder" and (b) preserve D-04: `continuous-force-required-for-motion` only has 3 constituents total (phys-001, phys-002, phys-007), so removing phys-001 would have dropped the theme below the min-3 threshold and broken the `library.test.ts` THME/D-04 test. Added an inline comment on the themes line documenting the reasoning. No sweeping domain-expert pass performed on other entries per the instructions.

### IN-01: Dead duplicate `LessonPlan` type in `dashboard-types.ts`

**Files modified:** `apps/web/lib/dashboard-types.ts`

**Commit:** 841d22d

**Applied fix:** Deleted the unused `export type LessonPlan` declaration (all apps/web callers import from `@mindmap/llm`). Replaced with a short comment block pointing to the authoritative `generate-lesson-plan.ts` Zod schema and the `LessonPlanJson` mirror in `theme-lesson-plans.ts`.

### IN-04: `handleRegenerate` swallows errors silently

**Files modified:** `apps/web/components/dashboard/themes-view.tsx`

**Commit:** 841d22d (same commit as IN-01)

**Applied fix:** Added `setErrorByTheme(... "")` reset at the top of `handleRegenerate` and a `catch` branch that sets `errorByTheme[themeId]` to `"Couldn't regenerate the lesson plan right now. Please try again."`. Matches the existing `handleGenerate` pattern. User now gets explicit feedback when regenerate fails instead of silently reverting to the stale plan.

## Skipped Issues

### IN-02: Inconsistent jsonb-default pattern between `theme-lesson-plans.ts` and `diagnostic-sessions.ts`

**File:** `packages/db/src/schema/theme-lesson-plans.ts:90`
**Reason:** Non-trivial docblock rewrite on a subtle pitfall. Out of scope per instructions ("fix only if trivial; skip otherwise"). Behavior is already correct — this is a documentation polish item for a future contributor.
**Original issue:** The Pitfall 3 docblock describes the jsonb-default bug without explaining why this table sidesteps it via "no default" rather than the `$defaultFn` workaround used in `diagnostic-sessions.ts`. The reviewer suggested a clarifying rewrite of the docblock.

### IN-03: Variable shadowing (`session` auth vs. `session` loop variable)

**File:** `apps/web/actions/dashboard.ts:67, 327`
**Reason:** Cosmetic readability smell with no runtime impact. The reviewer explicitly classifies this as low priority. Skipped per the instructions ("fix only if trivial; skip otherwise"). Renaming the loop variable is trivial in isolation but requires touching multiple files (`dashboard.ts`, `themes.ts`) and is orthogonal to the phase-8 review goals.
**Original issue:** `const session = await auth()` on line 67 and `for (const session of allSessions)` on line 327 shadow the same identifier. Not a bug today but a trap for future edits.

---

_Fixed: 2026-04-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
