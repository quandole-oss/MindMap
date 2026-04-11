---
phase: 08-root-cause-theme-diagnosis-and-teacher-remediation
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - packages/misconceptions/library/themes.yaml
  - packages/misconceptions/library/physics.yaml
  - packages/misconceptions/src/schema.ts
  - packages/misconceptions/src/loader.ts
  - packages/misconceptions/src/index.ts
  - packages/misconceptions/src/__tests__/library.test.ts
  - packages/db/src/schema/theme-lesson-plans.ts
  - packages/db/src/schema/index.ts
  - packages/db/src/migrations/0000_abandoned_polaris.sql
  - packages/llm/src/prompts/generate-lesson-plan.ts
  - packages/llm/src/prompts/analyze-student-themes.ts
  - packages/llm/src/__tests__/generate-lesson-plan.test.ts
  - packages/llm/src/__tests__/analyze-student-themes.test.ts
  - packages/llm/src/index.ts
  - apps/web/lib/theme-aggregation.ts
  - apps/web/lib/theme-cache-hash.ts
  - apps/web/lib/dashboard-types.ts
  - apps/web/actions/themes.ts
  - apps/web/actions/dashboard.ts
  - apps/web/components/dashboard/lesson-plan-card.tsx
  - apps/web/components/dashboard/themes-view.tsx
  - apps/web/components/dashboard/student-narrative-dialog.tsx
  - apps/web/components/dashboard/misconceptions-tab.tsx
  - apps/web/components/dashboard/students-tab.tsx
  - apps/web/components/dashboard/dashboard-tabs.tsx
  - apps/web/__tests__/actions/themes.test.ts
  - apps/web/__tests__/actions/dashboard.test.ts
  - scripts/priv-01-audit.sh
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** standard
**Files Reviewed:** 27 (24 listed + 3 spot-checked)
**Status:** issues_found

## Summary

Phase 8 ships the root-cause theme diagnosis system plus the teacher-facing lesson-plan and student-narrative features. Overall the implementation is disciplined: the PRIV-01 boundary is enforced at both audit-script and unit-test level; prompt builders correctly use `generateText + experimental_output: Output.object({ schema })`; the pure-helper test-isolation pattern (theme-aggregation, theme-cache-hash) is clean; and YAML loader imports are cleanly quarantined to server actions so no `node:fs` leaks into the client bundle.

Verification of the review focus items:

1. **PRIV-01** — `scripts/priv-01-audit.sh` exits 0; both prompt builders accept only anonymized primitives; `buildStudentThemeProfile` is guarded by a structural `Object.keys` test plus a paranoia "userId does not appear in serialized output" test.
2. **`generateText + experimental_output`** — confirmed in both new prompt files; `generateObject` does not appear in any `packages/llm/src/prompts/*` file.
3. **Cache hash stability** — `computeDataHash` sorts before `JSON.stringify` (localeCompare on misconceptionId), is covered by order-invariance + mutation + sensitivity tests, and uses positional arrays to avoid key-order ambiguity.
4. **Drizzle jsonb default** — the `lessonPlan` column intentionally has NO default, which is a valid alternative to `$defaultFn` (the bug only triggers when `.default(...)` is used). Callers always supply the value.
5. **SSR safety** — all theme/LLM-touching components are correctly `"use client"`; `@mindmap/misconceptions` (which imports `node:fs`) is imported only by server actions.
6. **Test quality** — tests assert real behavior: `Object.keys` guard for PRIV-01, theme-integrity tests (THME-01/02/D-04), order-invariance and RFC-6234 reference-vector tests for the hash, anti-hallucination guards for the lesson-plan prompt.
7. **Standard checks** — one critical bug identified (see CR-01); minor issues noted below.

The one **critical** finding is a **latent DB runtime crash** when a teacher clicks "Regenerate" on a class whose underlying data has not changed: the force-regenerate path always INSERTs without `onConflict*`, but the unique index `(classId, themeId, dataHash)` will reject the duplicate row. Fix required before shipping the UI regenerate button.

## Critical Issues

### CR-01: `getOrGenerateLessonPlan` force-regenerate will throw a unique-constraint error when data has not changed

**File:** `apps/web/actions/themes.ts:380-418`
**Also affects:** `packages/db/src/schema/theme-lesson-plans.ts:100-104` (the unique index it violates)

**Issue:** The cache-miss branch always runs `db.insert(schema.themeLessonPlans).values({ classId, themeId, dataHash, lessonPlan: fresh })` with no `onConflictDo*`. When `opts.forceRegenerate` is `true`, the cache lookup in step 4 is skipped, but the INSERT still uses the same `classId + themeId + dataHash` tuple. If the class data has not changed since the last plan was generated, `dataHash` is identical to an existing row's `dataHash`, and the unique index `theme_lesson_plans_class_theme_hash_idx` on `(class_id, theme_id, data_hash)` will reject the INSERT with a Postgres unique-constraint violation. This surfaces to the user as the catch-all "Couldn't generate a lesson plan right now" in `ThemesView.handleRegenerate`, even though the LLM call succeeded.

This directly contradicts the documented intent on `theme-lesson-plans.ts:52-55`:

> - Force regenerate: skip the lookup, always INSERT a new row. Previous rows remain so a teacher can compare plans over time.

With the current schema, that path cannot be "always INSERT a new row" when the dataHash is unchanged. The reviewer can reproduce this by calling `getOrGenerateLessonPlan(classId, themeId, { forceRegenerate: true })` twice in a row on a class whose sessions have not changed between the two calls — the second call will throw.

This is a pure runtime bug, not caught by the existing unit tests because the tests exercise `computeDataHash` / `buildStudentThemeProfile` in isolation and defer the full insert path to "Plan 08-04 human-verify checkpoint (Task 3) since the test runtime cannot spin up Postgres" (see the comment in `apps/web/__tests__/actions/themes.test.ts:30-34`).

**Fix:** The cleanest fix is to acknowledge that force-regenerate with unchanged data is conceptually an UPDATE of the historical row (or a no-op that returns the existing cached plan and forces a new LLM call into a different identity key). Three options, in preference order:

```ts
// Option A (preferred, minimal change): include generatedAt in the unique key
// by swapping to a non-unique index + treating (classId, themeId, dataHash)
// as a "current plan" lookup key on the read side. Store plan history under
// the plain (classId, themeId) index.
//
// packages/db/src/schema/theme-lesson-plans.ts:
(t) => [
  // No longer UNIQUE — just a lookup index. Multiple rows per
  // (classId, themeId, dataHash) are allowed; the newest one wins.
  index("theme_lesson_plans_class_theme_hash_idx").on(
    t.classId, t.themeId, t.dataHash
  ),
  index("theme_lesson_plans_class_theme_idx").on(t.classId, t.themeId),
]
// And in themes.ts cache lookup, orderBy(desc(generatedAt)).limit(1):
const cached = await db.query.themeLessonPlans.findFirst({
  where: and(
    eq(schema.themeLessonPlans.classId, classId),
    eq(schema.themeLessonPlans.themeId, themeId),
    eq(schema.themeLessonPlans.dataHash, dataHash)
  ),
  orderBy: [desc(schema.themeLessonPlans.generatedAt)],
});
```

```ts
// Option B: keep the unique index and add onConflictDoUpdate — but this
// violates D-18 "never UPDATE, preserve history".
await db.insert(schema.themeLessonPlans)
  .values({ classId, themeId, dataHash, lessonPlan: fresh })
  .onConflictDoUpdate({
    target: [schema.themeLessonPlans.classId,
             schema.themeLessonPlans.themeId,
             schema.themeLessonPlans.dataHash],
    set: { lessonPlan: fresh, updatedAt: new Date() },
  });
```

```ts
// Option C: catch the unique-constraint error and return fresh anyway.
// Correct only if you're OK with forceRegenerate silently discarding the
// history row when data has not changed. Not recommended — breaks audit trail.
```

Option A is the intended D-18 semantics (append-only history) and requires a migration + adding `orderBy` to the cache read. After the fix, add a unit test that regenerates twice with unchanged data and asserts a new row is written each time.

## Warnings

### WR-01: `getStudentThemeProfile` leaks cross-class diagnostic sessions into a narrative for a teacher who does not own the other class

**File:** `apps/web/actions/themes.ts:194-239`

**Issue:** The teacher-ownership check fetches `ownedEnrollments` (line 204) via a join that filters by `teacherId` — confirming the calling teacher owns *at least one* class containing this student. However, the subsequent session fetch on line 227 uses `eq(schema.diagnosticSessions.userId, studentId)` with no class filter. If the student is enrolled in two classes (one taught by Teacher A, one by Teacher B), Teacher A's narrative will include sessions that originated from Teacher B's class — which Teacher A has no right to see.

This is not a PRIV-01 leak into the LLM (the prompt only receives aggregate counts), but it IS an authorization boundary gap: aggregate counts are still data about a student's behavior in another teacher's classroom, and the narrative that results may surface themes that the other teacher was diagnosing.

**Fix:** Constrain the session fetch to sessions that occurred in the context of a class the calling teacher owns. Either:

```ts
// Option A: filter by classId via the enrollments join.
const ownedClassIds = await db.select({ classId: schema.classEnrollments.classId })
  .from(schema.classEnrollments)
  .innerJoin(schema.classes,
    eq(schema.classEnrollments.classId, schema.classes.id))
  .where(and(
    eq(schema.classEnrollments.studentId, studentId),
    eq(schema.classes.teacherId, teacherId)
  ));
if (ownedClassIds.length === 0) throw new Error(...);
// Then fetch sessions scoped to those classes. Requires either a classId
// column on diagnostic_sessions (new migration) OR a time-window filter by
// enrollment.enrolledAt.
```

For v1 — if the data model does not yet carry `classId` on `diagnostic_sessions` — document this limitation explicitly in the function docblock as "single-teacher assumption" so the leak is a known constraint rather than a silent bug. But the current code neither enforces nor documents the assumption, which is worse than either alternative.

### WR-02: `phys-001` theme assignment is likely mis-categorized

**File:** `packages/misconceptions/library/physics.yaml:15` (confirmed via spot-check)

**Issue:** `phys-001` is "Heavier objects fall faster" and is tagged with `themes: [continuous-force-required-for-motion]`. Conceptually, "heavier falls faster" is an Aristotelian intuition rooted in treating gravity / weight as a proportional push — it fits better under `substance-based-reasoning` (weight as "amount of heaviness stuff") or a standalone "gravity as proportional force" theme, not "force required to maintain motion". The research citation on this misconception in `themes.yaml:13-14` (McCloskey's impetus theory) is about moving objects, not falling objects.

This is a domain-expertise issue rather than a code bug, but it matters because the `buildThemeClusters` and lesson-plan pipelines propagate this misclassification into teacher-facing UI. A teacher viewing the "continuous-force-required-for-motion" theme cluster will see falling-object sessions that don't match the theme's naive-theory statement.

**Fix:** Review the theme assignments in each domain YAML with a subject-matter reference. At minimum, re-tag `phys-001` to a better-fitting theme (or add a new theme for "gravity as weight-proportional"). Consider auditing the other 34+ entries for similar misclassifications. This is Warning-level (not Critical) because the system still functions; it just produces low-quality teacher-facing analysis for affected themes.

## Info

### IN-01: Duplicate `LessonPlan` type declaration in `apps/web/lib/dashboard-types.ts` is dead code

**File:** `apps/web/lib/dashboard-types.ts:102-113`

**Issue:** `LessonPlan` is declared three times across the monorepo: (1) the Zod-inferred authoritative type in `packages/llm/src/prompts/generate-lesson-plan.ts:36`, (2) the hand-mirrored `LessonPlanJson` in `packages/db/src/schema/theme-lesson-plans.ts:21-32` (intentionally decoupled to avoid a db→llm import cycle, documented), and (3) a third hand-mirrored copy in `apps/web/lib/dashboard-types.ts:102-113`. Grep shows the web-app copy is not imported anywhere — every caller in `apps/web` imports `LessonPlan` from `@mindmap/llm` directly (see `lesson-plan-card.tsx:5`, `themes-view.tsx:4`, `actions/themes.ts:14`).

**Fix:** Delete the duplicate in `dashboard-types.ts:102-113`. The comment that references it ("mirror of the Zod schema built in Plan 08-03 … so Plan 08-04's jsonb `$type<T>()` on theme_lesson_plans can reference a single source of truth") is inaccurate — `theme-lesson-plans.ts` defines its own `LessonPlanJson` type and does not import from `dashboard-types`.

### IN-02: `diagnostic-sessions.ts` uses `$defaultFn(() => [])` but `theme-lesson-plans.ts` uses no default — inconsistent pattern

**File:** `packages/db/src/schema/theme-lesson-plans.ts:90`

**Issue:** The review focus item 4 asked whether the table uses the `$defaultFn(() => ...)` workaround "mirroring diagnostic-sessions.ts". `theme-lesson-plans.ts` instead uses `jsonb(...).notNull()` with NO default (every caller must supply `lessonPlan`). This is a valid alternative — the Drizzle jsonb bug only triggers when `.default(...)` is used — but it is an inconsistent pattern across the two tables and the in-file docblock (lines 66-73) goes into extensive detail about the bug without explaining why this particular column chose "no default" over the workaround. A future contributor may see the docblock and assume the workaround was missed.

**Fix:** Tighten the docblock wording. Something like:

```ts
/**
 * PITFALL 3 — JSONB DEFAULT BUG
 *
 * This column is `jsonb().notNull()` with NO default. Unlike diagnostic-sessions.ts
 * which stores a per-row mutable message list (and so needs `$defaultFn(() => [])`),
 * every caller of theme_lesson_plans MUST supply the full LessonPlan body — there
 * is no sensible server-side fallback. We therefore sidestep the Drizzle 0.45
 * jsonb-default bug by omitting the default entirely rather than reaching for the
 * $defaultFn workaround.
 */
```

### IN-03: Variable shadowing — `session` (auth) and `session` (loop variable over sessions) in `dashboard.ts`

**File:** `apps/web/actions/dashboard.ts:67, 327`

**Issue:** Line 67 declares `const session = await auth();` and line 327 declares `for (const session of allSessions)` — the loop variable shadows the outer auth session. Not a bug (the auth session is not referenced inside the loop), but it is a readability smell, and if a future edit adds an auth check inside the loop body the bug is easy to miss. Also appears in `themes.ts:124-128` and `themes.ts:152-156` where `s` is used as a short alias but `session` is still the outer auth variable — consistent pattern.

**Fix:** Rename the loop variable (e.g. `for (const dxSession of allSessions)` or the `s` alias already used elsewhere in the file). Low priority.

### IN-04: "Couldn't generate" catch in `themes-view.tsx:handleRegenerate` swallows the error without setting an error message

**File:** `apps/web/components/dashboard/themes-view.tsx:112-122`

**Issue:** `handleRegenerate` wraps the `getOrGenerateLessonPlan` call in a try/finally but has no catch block. If regenerate throws (e.g. the CR-01 constraint error or an LLM failure), the finally clears the spinner but the UI state still shows the stale lesson plan with no error feedback. By contrast, `handleGenerate` on line 95-110 correctly uses try/catch/finally and sets `errorByTheme`.

**Fix:**

```ts
async function handleRegenerate(themeId: string) {
  setErrorByTheme((prev) => ({ ...prev, [themeId]: "" }));
  setRegeneratingPlans((prev) => ({ ...prev, [themeId]: true }));
  try {
    const fresh = await getOrGenerateLessonPlan(classId, themeId, {
      forceRegenerate: true,
    });
    setLessonPlansByTheme((prev) => ({ ...prev, [themeId]: fresh }));
  } catch {
    setErrorByTheme((prev) => ({
      ...prev,
      [themeId]: "Couldn't regenerate the lesson plan. Please try again.",
    }));
  } finally {
    setRegeneratingPlans((prev) => ({ ...prev, [themeId]: false }));
  }
}
```

Note: `LessonPlanCard` itself has a local error-state fallback (`lesson-plan-card.tsx:41-53`), which partially mitigates this — but only if the card's `onRegenerate` prop rejects. Looking at `themes-view.tsx:244`, the passed-in `onRegenerate` is `() => handleRegenerate(theme.themeId)` which catches internally and returns `undefined`, so the card's error path never fires. Recommend fixing at the `handleRegenerate` level per the snippet above.

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
