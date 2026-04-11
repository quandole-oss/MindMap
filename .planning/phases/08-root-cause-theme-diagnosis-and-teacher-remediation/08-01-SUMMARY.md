---
phase: 08-root-cause-theme-diagnosis-and-teacher-remediation
plan: 01
subsystem: misconceptions
tags: [taxonomy, themes, schema, loader, ci]
requires: []
provides:
  - themeSchema
  - themeLibrarySchema
  - Theme (TS type)
  - themes[] field on every misconception entry
  - loadThemes()
  - getThemeById(id)
  - getMisconceptionsByTheme(themeId)
  - resetThemeCache()
  - CI orphan/missing-ID/min-constituents checks
affects:
  - packages/misconceptions
tech-stack:
  added: []
  patterns:
    - "Module-level lazy cache mirroring loadLibrary pattern"
    - "Zod-validated YAML registry loaded at first access"
    - "Dedicated test describe block per requirement (THME-01, THME-02, D-04)"
key-files:
  created:
    - packages/misconceptions/library/themes.yaml
  modified:
    - packages/misconceptions/src/schema.ts
    - packages/misconceptions/src/loader.ts
    - packages/misconceptions/src/index.ts
    - packages/misconceptions/src/__tests__/library.test.ts
    - packages/misconceptions/library/physics.yaml
    - packages/misconceptions/library/biology.yaml
    - packages/misconceptions/library/math.yaml
    - packages/misconceptions/library/history.yaml
decisions:
  - "Adopted 10 themes verbatim from 08-RESEARCH.md §A1 (substance-based-reasoning, continuous-force-required-for-motion, teleological-and-anthropomorphic-reasoning, whole-number-overgeneralization, presentism-and-single-cause-narratives, linear-progress-hierarchy, perception-equals-reality, category-confusion-cause-vs-effect, intuitive-time-and-scale, operational-vs-relational-reasoning)."
  - "Excluded themes.yaml from loadLibrary()'s YAML scan (different schema). Loaded separately via loadThemes()."
  - "Kept the optional naive_theory override unused in v1 — every misconception inherits its naive_theory from the theme registry."
metrics:
  duration: "5m 39s"
  tasks: 3
  files_changed: 9
  tests_added: 3
  tests_passing: 15
  completed: 2026-04-11
---

# Phase 8 Plan 01: Theme Taxonomy Authoring Summary

Hand-authored a 10-theme cross-domain root-theme registry, extended the misconception Zod schema with a required `themes: string[]`, backfilled all 40 misconception YAML entries, added four loader helpers (`loadThemes`, `getThemeById`, `getMisconceptionsByTheme`, `resetThemeCache`), and added three CI integrity tests that fail on any future taxonomy drift.

## What Was Built

### Theme registry (`packages/misconceptions/library/themes.yaml`)

10 themes, each with `{id, name, naive_theory, description, citation}` verbatim from 08-RESEARCH.md §A1. Final constituent counts (meets D-04's ≥3 minimum on all 10):

| Theme ID | Constituents |
|---|---|
| substance-based-reasoning | 6 |
| continuous-force-required-for-motion | 3 |
| teleological-and-anthropomorphic-reasoning | 3 |
| whole-number-overgeneralization | 3 |
| presentism-and-single-cause-narratives | 6 |
| linear-progress-hierarchy | 3 |
| perception-equals-reality | 4 |
| category-confusion-cause-vs-effect | 5 |
| intuitive-time-and-scale | 6 |
| operational-vs-relational-reasoning | 3 |

Total theme assignments: 42 (40 misconceptions, 2 cross-listings — bio-001 and bio-009).

### Schema extension (`packages/misconceptions/src/schema.ts`)

```ts
export const themeSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "Theme IDs must be kebab-case slugs"),
  name: z.string().min(1),
  naive_theory: z.string().min(10),
  description: z.string().min(20),
  citation: z.string().min(1),
});
export const themeLibrarySchema = z.array(themeSchema);
export type Theme = z.infer<typeof themeSchema>;
```

`misconceptionEntrySchema` now requires `themes: z.array(z.string().min(1)).min(1)` and accepts optional `naive_theory: z.string().min(1).optional()`.

### Loader helpers (for plans 08-02, 08-03, 08-04)

```ts
export function loadThemes(): Theme[]
export function getThemeById(id: string): Theme | undefined
export function getMisconceptionsByTheme(themeId: string): MisconceptionEntry[]
export function resetThemeCache(): void
```

All four are re-exported from `@mindmap/misconceptions` and ready for import by downstream plans.

### CI integrity tests (`packages/misconceptions/src/__tests__/library.test.ts`)

New `describe("theme integrity (THME-01, THME-02, D-04)")` block with three assertions:
1. Every misconception declares ≥1 theme (THME-01)
2. Every referenced theme ID exists in themes.yaml (THME-02)
3. Every theme has ≥3 constituent misconceptions (D-04)

All three pass; 15/15 tests pass overall.

## Execution Record

| Task | Commit | Files |
|---|---|---|
| Task 1: Schema + themes.yaml + backfill 40 entries | `0f9a8bf` | schema.ts, loader.ts, themes.yaml, physics.yaml, biology.yaml, math.yaml, history.yaml |
| Task 2: Loader helpers + index re-exports | `8f7e4ed` | loader.ts, index.ts |
| Task 3: CI integrity tests | `1166352` | library.test.ts |

## Verification Results

- `pnpm --filter @mindmap/misconceptions test` → **15 passed (15)** in 107ms
- `pnpm --filter @mindmap/misconceptions build` → **typecheck clean**
- `pnpm build` (full monorepo) → **5 successful, 5 total** (22.7s)
- Inline smoke test: `loadThemes()` → 10 themes; `getMisconceptionsByTheme("substance-based-reasoning")` → 6 entries

## Deviations from Plan

### [Rule 3 — Blocking issue] Excluded `themes.yaml` from `loadLibrary()` scan

- **Found during:** Task 1 (after schema + themes.yaml were in place and backfill completed)
- **Issue:** The existing `loadLibrary()` dynamically scans all `*.yaml` files in `library/`. Once `themes.yaml` was added, it was pulled into the misconception array and immediately failed `misconceptionLibrarySchema.parse()` (theme records lack `domain`, `grade_band`, etc.). Running tests produced a ZodError on entry index 40.
- **Fix:** Added an explicit `f !== "themes.yaml"` exclusion to the `readdirSync` filter in `loader.ts`. themes.yaml is loaded separately by the new `loadThemes()`.
- **Files modified:** `packages/misconceptions/src/loader.ts`
- **Commit:** `0f9a8bf` (rolled into Task 1 commit since the discovery happened before commit time)

No other deviations. Plan executed as written.

## Reusable Artifacts for Downstream Plans

### Imports plans 08-02, 08-03, 08-04 should use

```ts
import {
  loadThemes,
  getThemeById,
  getMisconceptionsByTheme,
  resetThemeCache,
  type Theme,
  type MisconceptionEntry,
} from "@mindmap/misconceptions";
```

### CI test command for downstream drift-guard

```
pnpm --filter @mindmap/misconceptions test
```

This command now also enforces theme integrity — downstream plans adding new misconceptions or themes MUST keep it green.

### Exact loader signatures

```ts
loadThemes(): Theme[]
// Returns all 10 themes (cached after first call).

getThemeById(id: string): Theme | undefined
// Theme lookup by kebab-case ID.

getMisconceptionsByTheme(themeId: string): MisconceptionEntry[]
// Returns all misconceptions referencing this theme (filters the library).
```

## Self-Check: PASSED

- FOUND: packages/misconceptions/library/themes.yaml
- FOUND: packages/misconceptions/src/schema.ts (themeSchema, themeLibrarySchema, Theme, themes field)
- FOUND: packages/misconceptions/src/loader.ts (loadThemes, getThemeById, getMisconceptionsByTheme, resetThemeCache)
- FOUND: packages/misconceptions/src/index.ts (all new symbols re-exported)
- FOUND: packages/misconceptions/src/__tests__/library.test.ts (theme integrity describe block)
- FOUND: commit 0f9a8bf (Task 1)
- FOUND: commit 8f7e4ed (Task 2)
- FOUND: commit 1166352 (Task 3)
- VERIFIED: 15/15 tests pass
- VERIFIED: full monorepo build succeeds
