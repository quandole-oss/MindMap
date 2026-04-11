---
phase: 08-root-cause-theme-diagnosis-and-teacher-remediation
plan: 03
subsystem: packages/llm (prompt builders) + scripts (PRIV-01 audit)
tags: [llm, prompts, priv-01, thme-02, lspl-01, dash-08, anti-hallucination]
requires:
  - 08-01  # themes library + naive_theory field
  - 08-02  # StudentThemeProfile shape (matches analyzeStudentThemes signature 1:1)
provides:
  - analyzeStudentThemes() prompt builder (PRIV-01 anonymized)
  - generateLessonPlan() prompt builder (D-15 anti-hallucination)
  - lessonPlanSchema (Zod) + LessonPlan type
  - studentThemeAnalysisSchema (Zod) + StudentThemeAnalysis type
  - scripts/priv-01-audit.sh (reproducible CI-ready audit)
affects:
  - packages/llm/src/prompts/
  - packages/llm/src/index.ts (new exports)
  - scripts/ (new directory at repo root)
tech-stack:
  added: []
  patterns:
    - "generateText + experimental_output: Output.object({ schema }) — NEVER generateObject"
    - "Zod schema with min/max constraints as the primary anti-hallucination shape guard"
    - "PRIV-01 enforced at the TypeScript parameter signature (no studentId/userId/email/enrollment)"
    - "Fixture-based tests mock ai.generateText and vi.mock('../adapters/factory', ...)"
    - "temperature 0.3 for structured lesson plans (D-15), 0.4 for narrative synthesis"
    - "try/catch wrap with descriptive re-throw matching phase-6 INFR-05"
key-files:
  created:
    - packages/llm/src/prompts/generate-lesson-plan.ts
    - packages/llm/src/prompts/analyze-student-themes.ts
    - packages/llm/src/__tests__/generate-lesson-plan.test.ts
    - packages/llm/src/__tests__/analyze-student-themes.test.ts
    - scripts/priv-01-audit.sh
  modified:
    - packages/llm/src/index.ts
decisions:
  - "Placed new test files at packages/llm/src/__tests__/ (repo convention) instead of the packages/llm/__tests__/ path the plan suggests. The existing prompts.test.ts and adapter.test.ts both live in src/__tests__/; Vitest auto-discovers either location, so this aligns with the established pattern."
  - "Kept the misconception library `name` field on the constituentMisconceptions parameter shape of generateLessonPlan, per the plan's interface. The PRIV-01 audit pattern intentionally excludes `name` (only email|studentId|userId|enrollment are strict) because legitimate theme/misconception labels are public library data."
  - "The lesson plan function does NOT post-filter the LLM's referencedMisconceptionIds against the input set in v1. The Zod schema enforces shape (min 1 per activity) and the fixture test documents the hallucination failure mode. Adding a runtime filter is a deferred enhancement once real Claude output is observed."
  - "temperature 0.3 for generateLessonPlan (structured, concrete) and 0.4 for analyzeStudentThemes (narrative, cross-pattern synthesis). Both are within Claude's recommended structured-output band."
metrics:
  duration: "~10 min"
  tasks: 3
  files_changed: 5
  tests_added: 19   # 9 generate-lesson-plan + 10 analyze-student-themes
  tests_passing: 48 # 29 baseline LLM tests + 19 new = 48 total, 4 files
  completed: 2026-04-11
---

# Phase 8 Plan 03: LLM prompt builders + PRIV-01 audit Summary

Added two LLM prompt builders (`generateLessonPlan`, `analyzeStudentThemes`) wired to the repo's existing `generateText + experimental_output: Output.object({ schema })` pattern, with Zod schemas enforcing structural shape and anti-hallucination guards, plus a reusable PRIV-01 audit shell script that verifies no student identifiers leak into prompt builder source files.

## What Was Built

### 1. `packages/llm/src/prompts/generate-lesson-plan.ts`

**Signature (PRIV-01 clean):**
```ts
export async function generateLessonPlan(params: {
  theme: { id: string; name: string; naive_theory: string; description: string; citation: string };
  studentsAffected: number;
  gradeBand: "K-5" | "6-8" | "9-12";
  constituentMisconceptions: Array<{
    id: string;
    name: string;
    description: string;
    confrontation_scenarios: string[];
  }>;
}): Promise<LessonPlan>;
```

**Zod schema:**
```ts
const activityItem = z.object({
  title: z.string().min(5),
  description: z.string().min(40),
  referencedMisconceptionIds: z.array(z.string()).min(1),
});
export const lessonPlanSchema = z.object({
  theme: z.string(),
  commonMisunderstanding: z.string().min(40),
  targetUnderstanding: z.string().min(40),
  suggestedActivities: z.array(activityItem).min(2).max(5),
  discussionPrompts: z.array(z.string().min(20)).min(2).max(5),
  confrontationApproaches: z.array(z.string().min(30)).min(1).max(3),
});
```

The prompt cites Vosniadou framework theory + Chi ontological category framing, lists the constituent misconceptions as the ONLY valid `referencedMisconceptionIds`, and explicitly forbids vague activities ("have a discussion", "use an analogy") per 08-RESEARCH.md §B4 Technique 1. `temperature: 0.3`. Errors are re-thrown with a descriptive message so the Plan 08-04 UI can render a graceful error state.

### 2. `packages/llm/src/prompts/analyze-student-themes.ts`

**Signature (PRIV-01 locked to four anonymized fields, matches `getStudentThemeProfile` return from Plan 08-02 1:1):**
```ts
export async function analyzeStudentThemes(params: {
  gradeBand: "K-5" | "6-8" | "9-12";
  themeCounts: Record<string, number>;
  misconceptionIds: string[];
  sessionOutcomes: Array<"resolved" | "unresolved" | "incomplete">;
}): Promise<StudentThemeAnalysis>;
```

**Zod schema:**
```ts
export const studentThemeAnalysisSchema = z.object({
  dominantThemes: z.array(z.string()).min(1).max(3),
  narrative: z.string().min(60),
  supportingMisconceptionIds: z.array(z.string()).min(1),
});
```

The prompt explicitly forbids per-misconception enumeration and demands cross-misconception pattern surfacing so the narrative does not duplicate the knowledge-graph drill-down. It also commands the LLM not to mention any individual student by name (the function has not been given one). `temperature: 0.4`.

### 3. `scripts/priv-01-audit.sh`

Reusable bash script that:
- Strictly greps `\b(email|studentId|userId|enrollment)\b` across both new prompt builder files, skipping comment lines via a sed strip. Any match is a hard failure.
- Informationally greps `\b(email|studentId|userId)\b` against `apps/web/actions/themes.ts` — matches are expected in the auth/ownership-check paths and are surfaced for reviewer attention but do not fail the audit. Authoritative structural guard for action return literals is the `Object.keys` test added in Plan 08-02.
- Executable (`chmod +x`), runnable from any directory (auto-cds to repo root), 0/1 exit codes for CI wiring.

The `name` token is intentionally excluded from the strict pattern because `theme.name` / `misconception.name` are legitimate public library fields.

### 4. Re-exports in `packages/llm/src/index.ts`

```ts
export { generateLessonPlan, lessonPlanSchema } from "./prompts/generate-lesson-plan";
export type { LessonPlan } from "./prompts/generate-lesson-plan";
export {
  analyzeStudentThemes,
  studentThemeAnalysisSchema,
} from "./prompts/analyze-student-themes";
export type { StudentThemeAnalysis } from "./prompts/analyze-student-themes";
```

## Execution Record

| Task | Commit | Files |
|---|---|---|
| Task 1: generate-lesson-plan.ts + Zod schema + 9 fixture tests | `e472750` | prompts/generate-lesson-plan.ts, __tests__/generate-lesson-plan.test.ts, index.ts |
| Task 2: analyze-student-themes.ts + Zod schema + 10 fixture tests | `52670c0` | prompts/analyze-student-themes.ts, __tests__/analyze-student-themes.test.ts, index.ts |
| Task 3: scripts/priv-01-audit.sh | `4d98d12` | scripts/priv-01-audit.sh |

Both Task 1 and Task 2 followed the TDD cycle: RED (test file written first, confirmed failing with "Cannot find module"), GREEN (implementation written, 9/9 and 10/10 pass), no REFACTOR needed.

## Verification Results

### Plan `<verification>` checklist

1. **`pnpm --filter @mindmap/llm build`** — clean (`tsc --noEmit` exit 0)
2. **`pnpm --filter @mindmap/llm test`** — 48 tests pass across 4 files (29 baseline + 19 new)
3. **`bash scripts/priv-01-audit.sh`** — exit 0, PASSED
4. **Manual: `grep -n "generateObject" packages/llm/src/prompts/{analyze-student-themes,generate-lesson-plan}.ts`** — zero matches
5. **Manual: `grep -n "experimental_output" packages/llm/src/prompts/{analyze-student-themes,generate-lesson-plan}.ts`** — 2+ matches per file (import + call site)
6. **`packages/llm/src/index.ts`** — both prompts and schemas re-exported
7. **`pnpm build` (full monorepo)** — 5/5 turbo tasks successful

### PRIV-01 audit output (verbatim)

```
PRIV-01 audit: scanning prompt builders (strict)...
  OK:   packages/llm/src/prompts/analyze-student-themes.ts
  OK:   packages/llm/src/prompts/generate-lesson-plan.ts

PRIV-01 audit: scanning server actions for identifier leaks (informational)...
  INFO: apps/web/actions/themes.ts references identifiers (must only be in auth/ownership checks):
    58:      studentId: schema.classEnrollments.studentId,
    60:      studentEmail: schema.users.email,
    ... (21 hits total, all inside auth/ownership checks or doc-comments, as documented in 08-02-SUMMARY.md)

PRIV-01 audit PASSED.
```

All 21 action-file INFO hits were already audited and accepted in Plan 08-02 — every one is inside an auth/ownership query, inside a doc comment referencing PRIV-01, or inside `getThemeDetail`'s drill-down return (UI data, not an LLM input). The structural `Object.keys` test in `apps/web/__tests__/actions/themes.test.ts` is the authoritative guard that `getStudentThemeProfile` returns only the four anonymized fields.

### Anti-hallucination verification

Three fixture tests in `generate-lesson-plan.test.ts` demonstrate the D-15 guard mechanism:

1. Test 2 asserts that every `referencedMisconceptionIds` element in a valid fixture is a subset of the input `constituentMisconceptions`.
2. Test 3 feeds a hallucinated `phys-999` id and asserts the test-level subset check catches it — documenting the v1 gap that post-filtering is NOT performed at the function level.
3. Test 5 (prompt content) asserts the prompt includes "do not invent" / "must come from" language so the LLM is instructed in-band.

## Deviations from Plan

### [Clarification] Test file location

- **Plan wording:** `packages/llm/__tests__/generate-lesson-plan.test.ts` and `packages/llm/__tests__/analyze-student-themes.test.ts`
- **Reality:** Placed at `packages/llm/src/__tests__/`, matching the established repo convention (existing `adapter.test.ts` and `prompts.test.ts` both live there). Vitest auto-discovers either location, so this is purely a convention alignment — no functional impact.
- **Impact:** None. All tests run and pass.

No rule-escalation deviations. No auto-fixes beyond the trivial `m.label` → `m.name` rename during Task 1 (fixed in the same task before any commit).

## Manual verification commands (re-runnable by reviewers)

```bash
# Zero-match: no generateObject import in either new prompt file
grep -n "generateObject" packages/llm/src/prompts/analyze-student-themes.ts packages/llm/src/prompts/generate-lesson-plan.ts

# 2+ matches per file: experimental_output import and call site
grep -n "experimental_output" packages/llm/src/prompts/analyze-student-themes.ts packages/llm/src/prompts/generate-lesson-plan.ts

# Strict PRIV-01 audit on prompt builder files
grep -nE '\b(email|studentId|userId|enrollment)\b' \
  packages/llm/src/prompts/analyze-student-themes.ts \
  packages/llm/src/prompts/generate-lesson-plan.ts
# (expected: only the PRIV-01 docblock comment lines mentioning "userId, studentId, email, enrollment"
#  as forbidden tokens — the audit script's sed strip filters these; raw grep will show them)

# Full audit pipeline
bash scripts/priv-01-audit.sh && echo "EXIT 0 — PASSED"

# Test suite
pnpm --filter @mindmap/llm test
```

## Reusable Artifacts for Plan 08-04

```ts
import {
  analyzeStudentThemes,
  generateLessonPlan,
  lessonPlanSchema,
  type LessonPlan,
  type StudentThemeAnalysis,
} from "@mindmap/llm";
import { getStudentThemeProfile, getThemeDetail } from "@/actions/themes";

// Student narrative (live, one-call-per-click per D-19)
const profile = await getStudentThemeProfile(studentId);
const analysis = await analyzeStudentThemes(profile); // 1:1 shape match

// Lesson plan (cached per D-19)
const detail = await getThemeDetail(classId, themeId);
const plan = await generateLessonPlan({
  theme: { id: detail.themeId, name: detail.themeName, naive_theory: detail.naiveTheory, description: detail.description, citation: detail.citation },
  studentsAffected: detail.affectedStudents.length,
  gradeBand, // from enrollment lookup in 08-02
  constituentMisconceptions: detail.constituentMisconceptions.map((c) => ({
    id: c.id,
    name: c.name,
    description: /* from library */,
    confrontation_scenarios: /* from library */,
  })),
});
```

## Self-Check: PASSED

- FOUND: packages/llm/src/prompts/generate-lesson-plan.ts
- FOUND: packages/llm/src/prompts/analyze-student-themes.ts
- FOUND: packages/llm/src/__tests__/generate-lesson-plan.test.ts
- FOUND: packages/llm/src/__tests__/analyze-student-themes.test.ts
- FOUND: scripts/priv-01-audit.sh (executable)
- FOUND: commit e472750 (Task 1)
- FOUND: commit 52670c0 (Task 2)
- FOUND: commit 4d98d12 (Task 3)
- VERIFIED: pnpm --filter @mindmap/llm build — typecheck clean
- VERIFIED: pnpm --filter @mindmap/llm test — 48/48 tests pass
- VERIFIED: pnpm build (full monorepo) — 5/5 turbo tasks successful
- VERIFIED: bash scripts/priv-01-audit.sh — exit 0, PASSED
- VERIFIED: zero `generateObject` imports in new prompt files
- VERIFIED: `experimental_output` used in both new prompt files
- VERIFIED: both new files re-exported from packages/llm/src/index.ts
