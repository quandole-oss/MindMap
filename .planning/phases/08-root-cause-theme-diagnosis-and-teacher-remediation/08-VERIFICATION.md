---
phase: 08-root-cause-theme-diagnosis-and-teacher-remediation
verified: 2026-04-10T21:25:00Z
status: human_needed
score: 5/5 success criteria automatically verified (5 items require human verification)
re_verification: false
human_verification:
  - test: "Open teacher dashboard → Misconceptions tab → By Root Theme pill → verify ThemesView renders ≥3 ranked theme cards against seed data with correct sort order and drill-down student names"
    expected: "≥3 theme cards visible, sorted by studentsAffected DESC then unresolvedCount DESC; drill-down shows constituent misconceptions + student names; naive_theory text from themes.yaml appears on each card"
    why_human: "Visual correctness of ThemesView rendering requires a running dev server + seeded Postgres database; executor explicitly deferred this to human verification in 08-04-SUMMARY.md"
  - test: "Click Generate Lesson Plan on top theme → read the generated plan end-to-end for pedagogical coherence"
    expected: "suggestedActivities name specific demonstrations/artifacts (not vague 'have a discussion'); referencedMisconceptionIds match constituents; discussionPrompts are open-ended; confrontationApproaches align with naive_theory; content is pedagogically meaningful (not generic filler)"
    why_human: "Content-quality gate — LLM output quality cannot be automated; executor explicitly flagged as CRITICAL gate in 08-04-PLAN.md Task 3 sub-step 4"
  - test: "Open Diagnostic Narrative dialog for a seeded student → evaluate narrative tone and cross-pattern synthesis"
    expected: "narrative names ≥1 dominant theme, cites ≥2 contributing misconceptions, surfaces cross-misconception patterns (not per-misconception enumeration), dialog title shows student name from props, narrative body does NOT contain student name"
    why_human: "Narrative tone and pattern synthesis quality require human reading of LLM output; PRIV-01 body-check needs live LLM response"
  - test: "With LessonPlanCard expanded, press Cmd+P → verify print preview"
    expected: "card renders with no shadow, black border, clean section breaks, no page breaks mid-section, white background, larger text; no dashboard chrome around it"
    why_human: "Print preview visual correctness requires a browser; cannot be automated"
  - test: "Set ANTHROPIC_API_KEY=invalid, restart dev server, click Generate Lesson Plan → verify graceful failure"
    expected: "non-crashing error state ('Couldn't generate a lesson plan right now. Try again.'); no white-screen or stack trace"
    why_human: "End-to-end failure behavior requires a running dev server and environment manipulation"
---

# Phase 8: Root-cause theme diagnosis and teacher remediation — Verification Report

**Phase Goal:** When a teacher opens their class dashboard, they can move from "here are the misconceptions my students hold" to "here is the underlying naive theory driving them" to "here is a structured lesson plan I can run tomorrow." The system groups individual misconceptions into ~10 hand-authored cross-domain root-cause themes, generates a per-student narrative summary of dominant themes, and produces a cached, regeneratable, Zod-validated lesson plan scaffold — all teacher-facing, with no changes to the student experience.

**Verified:** 2026-04-10T21:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Every misconception declares ≥1 theme from registry; CI orphan check fails otherwise; loadThemes() returns registry with citations | VERIFIED | `themes.yaml` has exactly 10 themes (grep `^- id:` count=10); all 40 misconception entries have `themes:` field (12+10+10+8=40); `library.test.ts` includes describe("theme integrity (THME-01, THME-02, D-04)") with three failing-build assertions; `pnpm --filter @mindmap/misconceptions test` → 15/15 pass |
| 2 | Teacher dashboard shows "Root Themes" view aggregating diagnostic_sessions by theme at query time (no denormalized column), ranked by students-affected/unresolved, with drill-down | VERIFIED (code) / HUMAN (visual) | `buildThemeClusters` in `theme-aggregation.ts` (unit tested, 7 tests); `dashboard.ts:373` wires into existing 6-query batch with zero new DB queries; `diagnostic-sessions.ts` has zero matches for "theme" — no denormalized column; `misconceptions-tab.tsx` renders pill toggle; `themes-view.tsx` sorts by studentsAffected DESC, unresolvedCount DESC, renders drill-down with getThemeDetail call |
| 3 | "Generate Lesson Plan" button returns Zod-validated structured object; subsequent opens return cached plan until data changes or teacher regenerates | VERIFIED | `lessonPlanSchema` enforces ≥2 activities/≥1 referencedMisconceptionId/length floors in `generate-lesson-plan.ts`; `getOrGenerateLessonPlan` in `actions/themes.ts:383` reads cache via `findFirst({where: classId+themeId+dataHash, orderBy: desc(generatedAt)})`; CR-01 fix applied (plain index, not unique; line 423 has `orderBy: [desc(schema.themeLessonPlans.generatedAt)]`); inserts new row on miss/force-regenerate; 11 unit tests on computeDataHash cover order-invariance, RFC-6234 reference vector, sensitivity |
| 4 | From student row, teacher can open Diagnostic Narrative dialog with dominant themes + contributing misconceptions, generated live | VERIFIED (code) / HUMAN (visual) | `students-tab.tsx:71` adds "Diagnostic Narrative" TableHead + button; renders `StudentNarrativeDialog`; `student-narrative-dialog.tsx` handles loading/error/result states; server calls `generateStudentNarrative` → `getStudentThemeProfile` → `analyzeStudentThemes`; dialog title binds studentName from props (D-13); no cache (D-19); WR-01 fix confirmed — sessions scoped via enrollments JOIN classes WHERE teacherId (lines 246-266 of themes.ts) |
| 5 | Feature works against existing seed data end-to-end with no migrations to user-facing tables; only new table is theme_lesson_plans; PRIV-01 compliance: no studentId/name/email/userId in LLM prompt inputs | VERIFIED | Migration `0000_abandoned_polaris.sql` adds `theme_lesson_plans` only (no changes to user-facing tables visible in git diff of schema directory); both prompt builder signatures accept only anonymized primitives (gradeBand, themeCounts, misconceptionIds, sessionOutcomes, theme metadata); `scripts/priv-01-audit.sh` exits 0 with strict grep on both prompt files; Object.keys structural test in `themes.test.ts` enforces getStudentThemeProfile returns exactly 4 keys |

**Score:** 5/5 success criteria verified automatically (5 items require human verification for visual/UX/content-quality)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/misconceptions/library/themes.yaml` | 10 hand-authored themes | VERIFIED | 64 lines, exactly 10 `^- id:` entries, kebab-case slugs, citations present |
| `packages/misconceptions/src/schema.ts` | themeSchema, themeLibrarySchema, themes[] on misconceptionEntrySchema | VERIFIED | 34 lines, exports confirmed (plus extended misconception schema) |
| `packages/misconceptions/src/loader.ts` | loadThemes, getThemeById, getMisconceptionsByTheme, resetThemeCache | VERIFIED | 89 lines; CI orphan test passes |
| `packages/misconceptions/src/__tests__/library.test.ts` | THME-01/THME-02/D-04 assertions | VERIFIED | 15/15 tests passing, three new describe blocks confirmed in SUMMARY |
| `apps/web/lib/dashboard-types.ts` | ThemeCluster, ThemeDetail, StudentThemeProfile, LessonPlan types | VERIFIED | Types present; dashboard-types.ts also has themeClusters on ClassDashboardData; IN-01 removed dead LessonPlan duplicate |
| `apps/web/actions/dashboard.ts` | themeClusters in getClassDashboardData return | VERIFIED | Line 14 imports buildThemeClusters; line 373 wires it in; line 400 returns themeClusters; query count unchanged at 6 |
| `apps/web/actions/themes.ts` | getThemeDetail, getStudentThemeProfile, getOrGenerateLessonPlan | VERIFIED | 501 lines; all exports present; WR-01 fix enforces enrollments JOIN classes WHERE teacherId; computeDataHash cache read uses orderBy desc(generatedAt) (CR-01 fix) |
| `packages/llm/src/prompts/analyze-student-themes.ts` | analyzeStudentThemes + Zod schema, PRIV-01 signature | VERIFIED | 116 lines; uses generateText + experimental_output; signature restricted to 4 anonymized fields; 10 fixture tests pass |
| `packages/llm/src/prompts/generate-lesson-plan.ts` | generateLessonPlan + lessonPlanSchema, anti-hallucination | VERIFIED | 125 lines; activityItem schema requires referencedMisconceptionIds; 9 fixture tests pass |
| `packages/db/src/schema/theme-lesson-plans.ts` | themeLessonPlans table with jsonb, composite index | VERIFIED | 121 lines; CR-01 fix applied — `index()` not `uniqueIndex()`; docblock explains rationale; no `.default(...)` on jsonb; FK cascade on classes |
| `packages/db/src/migrations/0000_abandoned_polaris.sql` | CREATE TABLE theme_lesson_plans with FK + indexes | VERIFIED | Migration committed; line 143 `CREATE INDEX` (not UNIQUE) confirms CR-01 fix; both indexes present |
| `apps/web/lib/theme-cache-hash.ts` | sha256Hex + computeDataHash pure helpers | VERIFIED | 69 lines; Web Crypto (no node:crypto); sorts before stringify; 11 unit tests including RFC-6234 vector |
| `apps/web/components/dashboard/themes-view.tsx` | ThemesView card grid | VERIFIED | 265 lines; imports getOrGenerateLessonPlan, getThemeDetail, LessonPlanCard; sorts themes; IN-04 fix — handleRegenerate has try/catch setting errorByTheme |
| `apps/web/components/dashboard/lesson-plan-card.tsx` | LessonPlanCard with print:* utilities | VERIFIED | 199 lines; print:shadow-none/print:border/print:break-inside-avoid/print:bg-white confirmed in SUMMARY; local useState for expand state (Pitfall 6) |
| `apps/web/components/dashboard/student-narrative-dialog.tsx` | StudentNarrativeDialog modal | VERIFIED | 208 lines; imports base-ui Dialog; renders loading/error/result; title uses studentName prop; no cache |
| `apps/web/components/dashboard/misconceptions-tab.tsx` | Pill toggle with "By Root Theme" | VERIFIED | Line 15 imports ThemesView; line 39 viewMode state; line 65 "By Root Theme" label; line 72 conditional `<ThemesView themes={themeClusters} classId={classId} />` |
| `apps/web/components/dashboard/students-tab.tsx` | Diagnostic Narrative trigger on each student row | VERIFIED | Line 17 imports StudentNarrativeDialog; line 34 narrativeStudent state; line 71 TableHead; lines 156-159 render dialog |
| `scripts/priv-01-audit.sh` | Reproducible PRIV-01 audit | VERIFIED | Exits 0; strict scan of both prompt files passes; informational scan of actions/themes.ts flags only expected auth/ownership paths |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `loader.ts` | `themes.yaml` | `themeLibrarySchema.parse` | WIRED | loadThemes() returns 10 themes; loadLibrary excludes themes.yaml from its scan (documented deviation) |
| `library.test.ts` | loadThemes() + loadLibrary() | intersection assertion | WIRED | All three THME-01/THME-02/D-04 assertions present; 15/15 tests pass |
| `dashboard.ts` | `@mindmap/misconceptions::loadThemes/loadLibrary` | JS-side Map aggregation | WIRED | Line 373 calls buildThemeClusters(allSessions, loadLibrary(), loadThemes()); 7 unit tests on the pure helper |
| `themes.ts` | `diagnosticSessions` | Drizzle query filtered by classId/studentId + JS theme projection | WIRED | getThemeFingerprint, getStudentThemeProfile, getThemeDetail all query diagnosticSessions with appropriate scoping |
| `analyze-student-themes.ts`/`generate-lesson-plan.ts` | `createLLMAdapter()` factory | import from ../adapters/factory | WIRED | Both files use generateText + Output.object pattern; no generateObject imports anywhere in prompts directory |
| `lesson-plan-card.tsx` | `getOrGenerateLessonPlan` server action | server action call | WIRED | themes-view.tsx:99,116 invoke the action and pass plan to LessonPlanCard |
| `getOrGenerateLessonPlan` | `computeDataHash` + `db.query.themeLessonPlans.findFirst` + `db.insert` | cache lookup → LLM call on miss → insert new row | WIRED | Lines 408,417,423 (orderBy fix),440+ (insert path); D-18 preserved via non-unique index |
| `student-narrative-dialog.tsx` | `getStudentThemeProfile` + `analyzeStudentThemes` | server action call → LLM call | WIRED | `generateStudentNarrative` wraps both; returns client-safe projection with pre-resolved misconception names |
| `misconceptions-tab.tsx` | `themes-view.tsx` | view-mode pill toggle conditional render | WIRED | Line 69-72: conditional on `viewMode === "theme"` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `themes-view.tsx` | `themes` prop | `data.themeClusters` from getClassDashboardData, flows through dashboard-tabs.tsx:54 → misconceptions-tab.tsx → ThemesView | YES — buildThemeClusters runs over real `allSessions` query result from 6-query batch; unit tests confirm it aggregates non-empty data | FLOWING |
| `themes-view.tsx` | `themeDetails[themeId]` | `getThemeDetail(classId, themeId)` server action | YES — real Drizzle query joining enrollments + diagnostic_sessions | FLOWING |
| `themes-view.tsx` | `lessonPlansByTheme[themeId]` | `getOrGenerateLessonPlan` — reads `theme_lesson_plans` cache or calls real LLM | YES — pipeline reads from DB cache then falls through to `generateLessonPlan` Anthropic call with constituent library data | FLOWING |
| `lesson-plan-card.tsx` | `plan` prop | Received from ThemesView parent which fetched from getOrGenerateLessonPlan | YES | FLOWING |
| `student-narrative-dialog.tsx` | `result` state | `generateStudentNarrative(studentId)` → getStudentThemeProfile → analyzeStudentThemes | YES — real DB query + live LLM call, no caching (D-19) | FLOWING |
| `dashboard.ts` | `themeClusters` in return | `buildThemeClusters(allSessions, loadLibrary(), loadThemes())` with `allSessions` from existing batched query | YES | FLOWING |

No hollow wiring detected. All dynamic data renders from real sources.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Misconceptions package tests | `pnpm --filter @mindmap/misconceptions test` | 15/15 pass in 132ms | PASS |
| LLM package tests (prompts + anti-hallucination) | `pnpm --filter @mindmap/llm test` | 48/48 pass across 4 files | PASS |
| Web app tests (dashboard + themes + cache-hash) | `pnpm --filter web exec vitest run` | 92/92 pass across 5 files | PASS |
| Full monorepo build | `pnpm build` | 5/5 turbo tasks successful (fully cached) | PASS |
| PRIV-01 audit | `bash scripts/priv-01-audit.sh` | exit 0, PASSED, strict scan clean on both prompt files | PASS |
| No generateObject in prompts | `grep generateObject packages/llm/src/prompts/` | 0 matches | PASS |
| experimental_output in new prompts | `grep experimental_output` | 2 matches in analyze-student-themes.ts + generate-lesson-plan.ts | PASS |
| Migration has non-unique index (CR-01) | `grep CREATE INDEX.*theme_lesson_plans` | `CREATE INDEX` at line 143 (NOT `CREATE UNIQUE INDEX`) | PASS |
| Themes count = 10 | `grep -c '^- id:' themes.yaml` | 10 | PASS |
| All 40 misconceptions backfilled | `grep -c 'themes:' library/*.yaml` | 40 (12+10+10+8) | PASS |
| No theme column on diagnostic_sessions | `grep -i theme packages/db/src/schema/diagnostic-sessions.ts` | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| THME-01 | 08-01 | Every misconception declares ≥1 theme from registry | SATISFIED | library.test.ts assertion; 40/40 entries have themes[]; CI test passes |
| THME-02 | 08-01, 08-03 | Every theme ID referenced exists in themes.yaml | SATISFIED | library.test.ts dangling-ID assertion; passes |
| THME-03 | 08-02 | Dashboard aggregation computed at query time, no denormalized theme column | SATISFIED | buildThemeClusters is JS-side join; diagnostic_sessions has zero theme column references |
| DASH-07 | 08-02, 08-04 | Root Themes view on teacher dashboard ranked correctly | SATISFIED (code) / HUMAN (visual) | themeClusters sort verified in unit tests; visual verification pending |
| DASH-08 | 08-02, 08-03, 08-04 | Per-student diagnostic narrative dialog | SATISFIED (code) / HUMAN (content) | Full pipeline wired; narrative tone requires human verification |
| LSPL-01 | 08-03 | Zod-validated lesson plan structure | SATISFIED | lessonPlanSchema with min/max constraints; fixture tests pass |
| LSPL-02 | 08-04 | Cached, regeneratable lesson plan with cache invalidation | SATISFIED | getOrGenerateLessonPlan + theme_lesson_plans table + computeDataHash; CR-01 fix applied so regenerate on unchanged data doesn't crash; integration test deferred to human verify per executor note |

No orphaned requirements. All Phase 8 requirements declared in plan frontmatters are wired to concrete implementations.

### Anti-Patterns Found

No blocking anti-patterns. The SUMMARY notes zero stubs: "Every file committed in Plans 08-01 through 08-04 wires to real data." Deferred items (Task 3 sub-steps 3-7) are explicit human-verify checkpoints, not stubs.

IN-02 (docblock polish) and IN-03 (variable shadowing) from the code review were intentionally skipped per the fix-loop instructions — both are cosmetic and do not affect goal achievement.

### Human Verification Required

See `human_verification` block in frontmatter. Five items require human testing against a running dev server + seeded Postgres. These were explicitly deferred by the executor in 08-04-SUMMARY.md and are not gaps — they are scheduled UX/content checkpoints.

### Gaps Summary

No gaps block goal achievement. The code delivers all five success criteria end-to-end: theme registry with CI enforcement, dashboard theme aggregation at query time, Zod-validated cached lesson plans with append-only history, live per-student narrative dialog, and a single new table (theme_lesson_plans) with PRIV-01 enforced at both the function signature and audit-script levels. Critical review finding CR-01 (force-regenerate unique-constraint crash) and warning WR-01 (cross-class session leak) were both closed in the review-fix pass, verified by re-reading the schema docblock and the getStudentThemeProfile implementation.

The remaining items (visual rendering, lesson plan content quality, narrative tone, print preview, graceful LLM failure) cannot be verified programmatically and are surfaced as human verification tasks in frontmatter.

---

_Verified: 2026-04-10T21:25:00Z_
_Verifier: Claude (gsd-verifier)_
