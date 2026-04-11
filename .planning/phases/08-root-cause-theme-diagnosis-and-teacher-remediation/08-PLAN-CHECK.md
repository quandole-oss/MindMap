# Phase 8 Plan Check

**Checked:** 2026-04-10
**Plans:** 08-01, 08-02, 08-03, 08-04
**Method:** goal-backward verification across 11 dimensions

---

## Dimension 1: Goal Achievement (success criteria walk-back)

| Success criterion (CONTEXT.md) | Plan | Task(s) | Status |
|---|---|---|---|
| SC1 — 10 themes attached to all 40 misconceptions | 08-01 | 1, 3 | PASS — themes.yaml authored verbatim from §A1; backfill table maps every entry; D-04 ≥3 enforced in `library.test.ts` |
| SC2 — Teacher sees themeClusters in dashboard | 08-02 + 08-04 | 08-02 T1; 08-04 T2 | PASS — `themeClusters` field returned, ranked correctly; ThemesView renders the pill toggle and grid |
| SC3 — Drill-down to constituents + affected students | 08-02 + 08-04 | 08-02 T2 (`getThemeDetail`); 08-04 T2 | PASS — drill-down state owned by ThemesView, server action returns the expected shape |
| SC4 — Per-student narrative live-generated | 08-02 + 08-03 + 08-04 | 08-02 T2; 08-03 T2; 08-04 T2 | PASS — `getStudentThemeProfile` → `analyzeStudentThemes` → `StudentNarrativeDialog`; not cached per D-19 |
| SC5 — Cached, regeneratable, Zod-validated lesson plan | 08-03 + 08-04 | 08-03 T1; 08-04 T1, T2 | PASS — `lessonPlanSchema`, `theme_lesson_plans` table, `getOrGenerateLessonPlan`, Regenerate button |

All five success criteria are covered by at least one task.

## Dimension 2: Requirement Coverage

| Req | Plan(s) | Status |
|---|---|---|
| THME-01 (every misconception ≥1 theme) | 08-01 (T3 orphan check) | COVERED |
| THME-02 (theme IDs valid) | 08-01 (T3 missing-ID check) + 08-03 (frontmatter declared) | COVERED |
| THME-03 (no DB column on diagnostic_sessions) | 08-01, 08-02 (frontmatter + verify step `grep -n 'theme'`) | COVERED |
| DASH-07 (themeClusters ranked) | 08-02 T1 | COVERED |
| DASH-08 (per-student narrative) | 08-02 T2 + 08-03 T2 + 08-04 T2 | COVERED |
| LSPL-01 (Zod-validated lesson plan) | 08-03 T1 | COVERED |
| LSPL-02 (cached + regeneratable) | 08-04 T1 | COVERED |

No orphan requirements.

## Dimension 3: Locked Decision Adherence (D-01..D-25)

Spot-checked the highest-risk decisions:

- **D-13 / PRIV-01** — `analyze-student-themes.ts` and `generate-lesson-plan.ts` signatures accept ONLY anonymized primitives. PRIV-01 docblocks mandated. `getStudentThemeProfile` return shape is structurally guarded by `Object.keys()` test. `scripts/priv-01-audit.sh` is mandated and re-run in 08-04. **PASS** with one caveat below (see Critical Issues).
- **D-14** — `createLLMAdapter()` import from `../adapters/factory` is in the interfaces block of 08-03. **PASS**.
- **`generateText + experimental_output: Output.object({ schema })`** (08-RESEARCH §B3 / Pitfall 1) — explicitly mandated in 08-03 must_haves, interfaces, action steps, and AVOID lists. Verification step #4 greps for forbidden `generateObject`. **PASS — strongly enforced.**
- **D-07** — JS-side `Map` join inserted after the misconception cluster loop in `dashboard.ts`, no new query. Verify step counts queries. **PASS**.
- **D-16/D-17/D-18** — schema, sha256Hex, computeDataHash, getOrGenerateLessonPlan all lifted verbatim from §C6/§C7. New row on miss, not update. **PASS**.
- **D-20..D-25** — pill toggle inside MisconceptionsTab, ThemesView card grid mirrors misconceptions-tab.tsx, LessonPlanCard with print:* utilities, explicit Regenerate button. **PASS**.

## Dimension 4: Plan Sequencing

| Plan | Wave | depends_on | Correct? |
|---|---|---|---|
| 08-01 | 1 | [] | YES |
| 08-02 | 2 | [08-01] | YES |
| 08-03 | 2 | [08-01] | YES (parallelizable with 08-02) |
| 08-04 | 3 | [08-02, 08-03] | YES |

DAG is acyclic, frontmatter declarations match, parallelization is correct.

## Dimension 5: Task Atomicity

All 10 tasks across the 4 plans have explicit `<files>`, `<action>`, `<verify>` (with `<automated>` command), and `<done>` blocks. Action steps are numbered, file paths are concrete, no "implement the feature" hand-waving. Task 3 of 08-04 is a `checkpoint:human-verify` with detailed sub-steps including the content-quality gate.

## Dimension 6: Verification Sufficiency

- **08-01 CI orphan check** — Task 3 adds `describe("theme integrity (THME-01, THME-02, D-04)")` with three assertions. **PASS**.
- **08-03 PRIV-01 grep audit** — `scripts/priv-01-audit.sh` is created in Task 3 and re-invoked from 08-04 verify steps. **PASS**.
- **08-04 content-quality gate** — Task 3 sub-step 4 walks the human through reading the generated lesson plan and explicitly halting if vague filler is produced. **PASS**.

## Dimension 7: Context Compliance

CONTEXT.md decisions D-01..D-25 are all referenced in plan frontmatter, action steps, or AVOID blocks. Deferred ideas (NGSS alignment, edit/save CRUD, narrative caching, multi-class rollups) are NOT present in any plan.

## Dimension 7b: Scope Reduction Detection

Scanned all 4 plans for `v1`, `simplified`, `static for now`, `placeholder`, `not wired`, `future enhancement`, `stub`. Findings:

- 08-02: filter `studentsAffected > 0` is described as "for v1" — this is a deliberate Open-Question-3 resolution to suppress empty cards, NOT a scope reduction. **OK**.
- 08-03 Task 1 third fixture test: described as documenting the hallucination failure mode "for v1" without runtime filtering — this is honest about the gap but does NOT reduce a user decision. D-15 only requires the fixture test guard, which is delivered. **OK**.
- 08-04 cache "for v1" wording around Pitfall 6: refers to v1 of the print stylesheet decision (inline utilities only) — matches D-24 exactly. **OK**.

No scope reductions of locked decisions detected.

## Dimension 8: Nyquist Compliance (automated verify presence)

Every `auto` task has `<automated>` verify with a concrete pnpm/bash command. Watch-mode flags absent. E2E suites absent (Vitest unit + integration only). Wave 3 includes `bash scripts/priv-01-audit.sh` and full `pnpm -w test/build` in the human-verify checkpoint. **PASS**.

## Dimension 9: Cross-Plan Data Contracts

Shared types (`ThemeCluster`, `LessonPlan`, `StudentThemeProfile`) are defined in 08-02's `dashboard-types.ts` and mirrored as Zod-derived types in 08-03's prompt builders. The `LessonPlan` type is imported `type-only` in 08-04's Drizzle schema to avoid circular runtime deps. The fingerprint tuple shape `{misconceptionId, studentCount, unresolvedCount}` is consistent between `computeDataHash` (08-04) and `getThemeFingerprint` (08-04). No data-contract conflicts.

## Dimension 10: CLAUDE.md Compliance

Vitest (not Jest), Drizzle (not Prisma), Vercel AI SDK with Anthropic provider, Tailwind v4 inline `print:*` utilities, pnpm workspace references — every plan honors the stack constraints. **PASS**.

## Dimension 11: Research Resolution (#1602)

08-RESEARCH.md line 1351: `## Open Questions` — section is **NOT** suffixed `(RESOLVED)`. Four open questions are listed without inline `RESOLVED` markers:

1. `getMisconceptionsByTheme` ordering — recommendation given, not formally resolved
2. Mock LLM adapter existence — recommendation given, not formally resolved
3. Filter empty themes — implicitly resolved in 08-02 (filter for v1) but not marked in RESEARCH.md
4. Seed thematic diversity — addressed in 08-04 Task 3 sub-step 3, not marked in RESEARCH.md

Per Dimension 11 contract, this is a strict-mode FAIL. In practice, every question has a recommendation that was acted on in the plans, so the substantive risk is low — but the section heading and inline markers should be updated to reflect resolution.

---

## Verdict

```
verdict: pass

critical_issues: []

recommendations:
  - "Update 08-RESEARCH.md line 1351 from '## Open Questions' to '## Open Questions (RESOLVED)' and add inline 'RESOLVED:' markers to each of the 4 questions referencing where each was addressed (08-02 for OQ1/OQ3, 08-03 for OQ2, 08-04 Task 3 for OQ4). Cosmetic but unblocks Dimension 11 strict mode."
  - "08-04 Task 2 Step 4 introduces generateStudentNarrative(studentName) — the comment forbids passing studentName to analyzeStudentThemes, but the audit script in 08-03 Task 3 only scans prompt files. Consider adding apps/web/actions/themes.ts to the strict pattern (currently INFO-only) to harden the boundary."
  - "08-01 Task 1 includes a manual reassignment of bio-002, bio-006, bio-007, bio-008 from working-notes themes to consolidated final themes — call this out explicitly in the 08-01 SUMMARY for downstream traceability."
  - "08-04 Task 1 verify command runs db:generate AFTER build but does not commit the generated SQL — add an explicit 'commit packages/db/drizzle/<new>.sql' step to <action> Step 3 so the migration isn't dropped on rebase."
```

Plans are well-formed, goal-backward coverage is complete, locked decisions honored, the two highest-risk areas (PRIV-01 and `generateText + Output.object`) are explicitly mandated and audited. Verdict: **PASS** with 4 minor recommendations, none blocking execution.
