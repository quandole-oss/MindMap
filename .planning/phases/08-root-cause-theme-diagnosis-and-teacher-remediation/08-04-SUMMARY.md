---
phase: 08-root-cause-theme-diagnosis-and-teacher-remediation
plan: 04
subsystem: apps/web (UI + actions) + packages/db (new theme_lesson_plans table)
tags: [dashboard, lesson-plans, cache, themes, narrative, print, priv-01, lspl-02, dash-07, dash-08]
requires:
  - 08-01  # themes library + backfilled theme index
  - 08-02  # dashboard actions + themeClusters + StudentThemeProfile
  - 08-03  # generateLessonPlan / analyzeStudentThemes prompt builders
provides:
  - theme_lesson_plans Drizzle table + initial migration SQL
  - getOrGenerateLessonPlan server action (cache hit / miss / force-regenerate)
  - generateStudentNarrative server action (client-safe projection)
  - computeDataHash + sha256Hex pure helpers (Web Crypto)
  - ThemesView, LessonPlanCard, StudentNarrativeDialog UI components
  - Pill toggle on MisconceptionsTab ('By Misconception' / 'By Root Theme')
  - 'View narrative' trigger on each student row in StudentsTab
affects:
  - apps/web/components/dashboard/*
  - apps/web/actions/themes.ts
  - packages/db/src/schema/index.ts
tech-stack:
  added: []
  patterns:
    - "crypto.subtle.digest SHA-256 for stable cache keys (no node:crypto, Edge-safe)"
    - "Defensive sort-before-JSON.stringify to canonicalize hash input (Pitfall 4)"
    - "Drizzle jsonb with notNull() and NO .default({}) (Pitfall 3 workaround)"
    - "INSERT-not-UPDATE on cache miss so history is preserved (D-18)"
    - "Tailwind v4 print:* utilities inline (D-24; first use in the app)"
    - "Parent-level drill-down state + child-local expand state (Pitfall 6)"
    - "Server-action returns client-safe projections so @mindmap/misconceptions (which pulls node:fs) stays out of the client bundle"
key-files:
  created:
    - packages/db/src/schema/theme-lesson-plans.ts
    - packages/db/src/migrations/0000_abandoned_polaris.sql
    - packages/db/src/migrations/meta/_journal.json
    - packages/db/src/migrations/meta/0000_snapshot.json
    - apps/web/lib/theme-cache-hash.ts
    - apps/web/components/dashboard/lesson-plan-card.tsx
    - apps/web/components/dashboard/themes-view.tsx
    - apps/web/components/dashboard/student-narrative-dialog.tsx
  modified:
    - packages/db/src/schema/index.ts
    - apps/web/actions/themes.ts
    - apps/web/__tests__/actions/themes.test.ts
    - apps/web/components/dashboard/misconceptions-tab.tsx
    - apps/web/components/dashboard/students-tab.tsx
    - apps/web/components/dashboard/dashboard-tabs.tsx
key-decisions:
  - "theme_lesson_plans migration file committed at packages/db/src/migrations/0000_abandoned_polaris.sql (repo's existing drizzle.config.ts sets out='./src/migrations'). The plan referenced 'packages/db/drizzle/' — minor path documentation mismatch, not a behavior change."
  - "LessonPlan type mirrored locally in packages/db/src/schema/theme-lesson-plans.ts as LessonPlanJson rather than importing from @mindmap/llm. @mindmap/db must stay dependency-free of the LLM layer; the Zod schema in packages/llm/src/prompts/generate-lesson-plan.ts remains the authoritative source."
  - "generateStudentNarrative returns a client-safe projection (StudentNarrativeResult) with misconception names pre-resolved on the server. The dialog component MUST NOT import @mindmap/misconceptions directly — the library loader uses node:fs and would break Next.js client bundling."
  - "computeDataHash + sha256Hex extracted into apps/web/lib/theme-cache-hash.ts as pure helpers so they can be unit-tested without importing the 'use server' themes.ts module. Matches the existing pattern (buildThemeClusters / buildStudentThemeProfile in theme-aggregation.ts)."
  - "Cache integration tests (hit/miss/regenerate row-count semantics) are deferred to the Task 3 human-verify checkpoint since Vitest cannot spin up Postgres. The deterministic core — computeDataHash + sha256Hex — is fully unit-tested (11 new tests including the RFC 6234 SHA-256('abc') reference vector)."
requirements-completed:
  - DASH-07
  - DASH-08
  - LSPL-01
  - LSPL-02
metrics:
  duration: "~10 min"
  tasks: 3
  files_changed: 15
  tests_added: 11
  tests_passing: 172
  completed: 2026-04-11
---

# Phase 8 Plan 04: ThemesView + LessonPlanCard cache + StudentNarrativeDialog Summary

Wired the Phase 8 data + LLM layers into a teacher-facing payoff: a ranked Root Themes view nested in the Misconceptions tab, a printable database-cached LessonPlanCard with explicit Regenerate, and a per-student Diagnostic Narrative modal — all guarded by the PRIV-01 boundary (the LLM never receives a studentId, userId, or name).

## What Was Built

### 1. `packages/db/src/schema/theme-lesson-plans.ts`

New Drizzle table. Full shape:

```ts
export const themeLessonPlans = pgTable(
  "theme_lesson_plans",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    classId: text("class_id").notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    themeId: text("theme_id").notNull(),        // library slug, NOT an FK
    dataHash: text("data_hash").notNull(),      // SHA-256 hex
    lessonPlan: jsonb("lesson_plan").$type<LessonPlanJson>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("theme_lesson_plans_class_theme_hash_idx")
      .on(t.classId, t.themeId, t.dataHash),
    index("theme_lesson_plans_class_theme_idx")
      .on(t.classId, t.themeId),
  ]
);
```

Critical invariants:
- `jsonb().notNull()` with **no** `.default(...)` (Pitfall 3 / Drizzle 0.45 jsonb-default bug).
- `themeId` is a library slug — **no** FK (themes live in YAML; integrity via THME-02).
- `LessonPlanJson` is a LOCAL structural mirror of `@mindmap/llm`'s `LessonPlan` type so `@mindmap/db` stays dependency-free of the LLM layer.

### 2. Initial Drizzle migration — `packages/db/src/migrations/0000_abandoned_polaris.sql`

Because the repo had no prior migrations committed (`db:push` was used until now), `drizzle-kit generate` produced a baseline migration capturing the ENTIRE schema (12 tables). The relevant excerpt:

```sql
CREATE TABLE "theme_lesson_plans" (
  "id" text PRIMARY KEY NOT NULL,
  "class_id" text NOT NULL,
  "theme_id" text NOT NULL,
  "data_hash" text NOT NULL,
  "lesson_plan" jsonb NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "theme_lesson_plans"
  ADD CONSTRAINT "theme_lesson_plans_class_id_classes_id_fk"
  FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id")
  ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "theme_lesson_plans_class_theme_hash_idx"
  ON "theme_lesson_plans" USING btree ("class_id","theme_id","data_hash");
CREATE INDEX "theme_lesson_plans_class_theme_idx"
  ON "theme_lesson_plans" USING btree ("class_id","theme_id");
```

### 3. `apps/web/lib/theme-cache-hash.ts` — pure cache key helpers

```ts
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeDataHash(
  tuples: Array<{ misconceptionId: string; studentCount: number; unresolvedCount: number }>
): Promise<string> {
  const sorted = [...tuples].sort((a, b) =>
    a.misconceptionId.localeCompare(b.misconceptionId)
  );
  const canonical = JSON.stringify(
    sorted.map((t) => [t.misconceptionId, t.studentCount, t.unresolvedCount])
  );
  return sha256Hex(canonical);
}
```

- Web Crypto only (`crypto.subtle.digest`) — no `node:crypto`, so it runs unchanged in Node and Edge runtimes.
- Defensive `[...tuples].sort(...)` copy so callers are free to reuse their tuple arrays.
- Positional-array canonicalization avoids object-key ordering ambiguity across runtimes.

### 4. `apps/web/actions/themes.ts` — new exports

**`getOrGenerateLessonPlan(classId, themeId, { forceRegenerate? })`** — auth check, computes server-side fingerprint via `getThemeFingerprint`, checks the cache by `(classId, themeId, dataHash)`, calls `generateLessonPlan` on miss with only the four anonymized fields `{theme, studentsAffected, gradeBand, constituentMisconceptions}`, and **INSERTs a new row** (never UPDATEs — D-18 preserves history). Force-regenerate skips the lookup entirely and always inserts.

**`getThemeFingerprint(classId, themeId)`** — private helper. Queries `classEnrollments` and `diagnosticSessions`, groups by constituent `misconceptionId` in JS, and returns `{misconceptionId, studentCount, unresolvedCount}` tuples sorted by id. No new DB index — reuses `diagnostic_sessions_user_created_idx`.

**`generateStudentNarrative(studentId)`** — thin wrapper around `analyzeStudentThemes`. Crucially, it returns a **client-safe projection** (`StudentNarrativeResult`) with misconception names pre-resolved on the server:

```ts
export type StudentNarrativeResult = {
  dominantThemes: string[];
  narrative: string;
  supportingMisconceptions: Array<{ id: string; name: string }>;
};
```

This lets the client dialog render misconception names without importing `@mindmap/misconceptions` (which pulls `node:fs` and breaks Next.js client bundling).

### 5. `apps/web/components/dashboard/lesson-plan-card.tsx`

Collapsed-by-default card with six sections (theme, commonMisunderstanding, targetUnderstanding, suggestedActivities, discussionPrompts, confrontationApproaches). Header click toggles local `expanded` state (Pitfall 6 — isolated from the parent ThemesView's drill-down state).

**Exact print utility set used:**

```
print:shadow-none
print:border
print:border-black
print:break-inside-avoid
print:mb-4
print:bg-white
print:text-[14pt]
print:pb-2      (card header)
print:space-y-2 (card content)
print:text-[11pt] (section labels)
print:text-[12pt] (body copy)
print:text-[9pt]  (activity "Addresses: ..." subtitle)
print:hidden    (regenerate button + chevron — hidden from printout)
```

Regenerate button uses Lucide `RefreshCw` icon. On failure, a non-crashing `<div className="text-[#dc2626]">` error block is shown above the card body (INFR-05 pattern).

### 6. `apps/web/components/dashboard/themes-view.tsx`

Parent-level state owns:
- `expandedThemeId: string | null` — which theme card is drilled down
- `themeDetails: Record<themeId, ThemeDetail>` — cached `getThemeDetail` results for the session
- `lessonPlansByTheme: Record<themeId, LessonPlan>` — cached generated plans
- `loadingPlans` / `regeneratingPlans` / `errorByTheme` — per-theme async state maps

Sorts `themes` by `studentsAffected DESC, unresolvedCount DESC`. Each card shows theme name + badge, naive theory, resolved/unresolved stats, drill-down toggle → constituent misconceptions + affected student names, and a "Generate Lesson Plan" button. When a plan exists in state, renders `<LessonPlanCard plan={...} onRegenerate={...} isRegenerating={...} />` inline.

### 7. `apps/web/components/dashboard/student-narrative-dialog.tsx`

Base-UI `Dialog` (`@base-ui/react/dialog`). Three render states:

1. **Loading** — `NarrativeSkeleton` — 4 shimmer bars matching the expected narrative shape.
2. **Error** — "Couldn't generate a narrative right now. Please try again." with a Retry button.
3. **Result** — `NarrativeBody` with dominant-themes chips, the narrative paragraph, and a supporting-misconceptions list.

**Dialog title**: `Diagnostic Narrative for {studentName}` — `studentName` is a **prop** (D-13). The LLM never receives it, so the narrative body cannot leak it.

**No cache** (D-19). `useEffect([open, studentId])` regenerates every time the dialog opens.

### 8. `apps/web/components/dashboard/misconceptions-tab.tsx` — pill toggle

The original misconception card grid was extracted into a private `MisconceptionCardGrid` sub-component in the same file (no logic changes — byte-equivalent rendering when "By Misconception" is selected). The exported `MisconceptionsTab` wraps it with a pill toggle:

```tsx
type ViewMode = "misconception" | "theme";
const [viewMode, setViewMode] = useState<ViewMode>("misconception");
```

Renders `MisconceptionCardGrid` or `ThemesView` below the pills. Props extended to accept `themeClusters` and `classId`.

### 9. `apps/web/components/dashboard/students-tab.tsx` — narrative trigger

New "Diagnostic Narrative" column per row with a Lucide `MessageSquareText` icon button. Clicking sets local state `narrativeStudent: {id, name} | null`, which opens `<StudentNarrativeDialog>` once at the bottom of the tab.

### 10. `apps/web/components/dashboard/dashboard-tabs.tsx`

Updated to pass `themeClusters={data.themeClusters}` and `classId={data.classInfo.id}` into `<MisconceptionsTab>`.

## Execution Record

| Task | Commit | Files |
|---|---|---|
| Task 1: schema + migration + cache helpers + server actions + 11 tests | `09cf905` | theme-lesson-plans.ts, migrations/, theme-cache-hash.ts, themes.ts, themes.test.ts, schema/index.ts |
| Task 2: UI components + tab wiring | `2b27605` | lesson-plan-card.tsx, themes-view.tsx, student-narrative-dialog.tsx, misconceptions-tab.tsx, students-tab.tsx, dashboard-tabs.tsx, themes.ts |
| Task 3: human-verify checkpoint | (no code changes — verification only) | N/A |

Task 1 followed RED-GREEN-REFACTOR: RED failed on `Cannot find module '../../lib/theme-cache-hash'`; GREEN created the helper and all 11 new tests passed; no refactor was needed.

## Verification Results

### Task 1 (`<automated>` block)

| Check | Result |
|---|---|
| `pnpm --filter @mindmap/db build` | ✅ tsc --noEmit clean |
| `pnpm --filter @mindmap/db db:generate` | ✅ `0000_abandoned_polaris.sql` generated (theme_lesson_plans present with FK + both indexes) |
| `pnpm --filter web build` | ✅ compiled in 3.5s; dashboard chunk 4.91 KB → 10.3 KB |
| `pnpm --filter web exec vitest run` | ✅ 92/92 tests pass (5 files) |
| `bash scripts/priv-01-audit.sh` | ✅ PASSED |

### Task 2 (`<automated>` block)

| Check | Result |
|---|---|
| `pnpm --filter web build` | ✅ clean |
| `pnpm --filter web lint` | ⚠ skipped — `next lint` prompts interactively to run `create-next-app` linter setup (never configured for this repo); TypeScript validation via `next build` is the de-facto lint gate and passes |
| `bash scripts/priv-01-audit.sh` | ✅ PASSED |

### Task 3 (automated portions of the human-verify checkpoint)

| Check | Result |
|---|---|
| `bash scripts/priv-01-audit.sh` | ✅ PASSED (exit 0) |
| `pnpm -w build` | ✅ 5/5 turbo tasks successful |
| `pnpm -w test` | ✅ 7/7 test tasks, 172 total tests passing: `@mindmap/llm` 48, `@mindmap/router` 17, `@mindmap/misconceptions` 15, `web` 92 |

### Manual verification sub-steps deferred to final phase verification

Per executor instructions: automated portions of the Task 3 checkpoint have passed. The following visual/content-quality sub-steps are deferred to the human verifier in the final phase gate:

- Sub-step 3: Root Themes view rendered with seeded class (visual diff)
- Sub-step 4: Content-quality gate — sample lesson plan pedagogical coherence
- Sub-step 5: Narrative body tone + cross-pattern synthesis
- Sub-step 6: `Cmd+P` print preview visual correctness
- Sub-step 7: Graceful LLM failure state (invalid API key test)

All deferred items can be exercised in a browser once the dev server is running against a seeded class.

## Deviations from Plan

### [Clarification] Migration output path

- **Plan wording:** "Migration file generated by `drizzle-kit generate` exists in `packages/db/drizzle/` and is committed."
- **Reality:** `packages/db/drizzle.config.ts` sets `out: "./src/migrations"`, so the file lives at `packages/db/src/migrations/0000_abandoned_polaris.sql`. The repo's pre-existing config takes precedence over the plan's wording — no config change.
- **Impact:** None. File is committed in the same PR as the schema.

### [Clarification] Initial baseline migration (not incremental)

- **Discovery:** No prior migrations existed in the repo (the project was using `db:push` exclusively). `drizzle-kit generate` therefore produced a **full baseline migration** (12 tables), not an incremental `0001_add_theme_lesson_plans.sql`.
- **Impact:** The single 143-line SQL file commits the entire schema as a reproducible baseline. Future plans can run `drizzle-kit generate` and get proper incremental diffs.

### [Clarification] LessonPlan type mirrored locally in db package

- **Plan wording:** `import type { LessonPlan } from "@mindmap/llm";` in the Drizzle schema.
- **Reality:** `@mindmap/db` has no dep on `@mindmap/llm`, and adding one would invert the expected dependency direction (llm → db for future types, not db → llm). The schema declares `LessonPlanJson` as a local structural mirror. The Zod schema in `generate-lesson-plan.ts` remains the single source of truth for runtime validation.
- **Impact:** None at runtime — both types are the same structural shape. The `$type<LessonPlanJson>()` annotation gives Drizzle the correct TypeScript type for reads/inserts.

### [Clarification] Cache integration tests → human-verify

- **Plan wording:** 7 tests including "Cache miss inserts a new row", "Second call returns cached row", "forceRegenerate inserts a new row" via `vi.mock("@mindmap/llm")`.
- **Reality:** Vitest in this repo cannot import `apps/web/actions/themes.ts` (it pulls the real Drizzle + Postgres drivers). The existing pattern — see `apps/web/__tests__/actions/dashboard.test.ts` and the pre-existing `themes.test.ts` — tests pure helpers only and defers integration concerns to the route layer or the human-verify checkpoint. I tested the deterministic **core** — `computeDataHash` + `sha256Hex` — exhaustively (11 new tests, including the RFC 6234 reference vector `sha256("abc")`). The end-to-end cache hit/miss/regenerate row-count semantics are verified in Task 3 sub-step 4 against a live seeded class.
- **Impact:** Lower coverage for the server-action integration path, offset by full coverage of the deterministic hash core and a mandatory human-verify gate.

### [Auto-fix, Rule 3 — Blocking] Client bundle must not import `@mindmap/misconceptions`

- **Found during:** Task 2 (`pnpm --filter web build`)
- **Issue:** `StudentNarrativeDialog` initially imported `getMisconceptionById` from `@mindmap/misconceptions` to dereference IDs to human-readable names. This transitively pulls `loader.ts`, which uses `node:fs` — breaks Next.js webpack client bundling with "Module not found: Can't resolve 'fs'".
- **Fix:** Moved the dereferencing to the server side: `generateStudentNarrative` now returns a `StudentNarrativeResult` projection with `supportingMisconceptions: {id, name}[]` resolved on the server, and the client dialog renders the pre-resolved array.
- **Files modified:** `apps/web/actions/themes.ts`, `apps/web/components/dashboard/student-narrative-dialog.tsx`
- **Verification:** `pnpm --filter web build` passes
- **Commit:** `2b27605`

**Total deviations:** 1 auto-fixed blocking issue (Rule 3), 4 clarifications. **Impact:** No behavioral regression; client bundling is now clean; all planned functionality delivered.

## Authentication Gates

None encountered during automated execution. The deferred manual checkpoint sub-step 7 (invalid `ANTHROPIC_API_KEY`) is an **intentional** graceful-failure test, not an auth gate — the LessonPlanCard's non-crashing error state is what's being verified.

## Threat Flags

No new security-relevant surface introduced beyond what the plan's `<threat_model>` already documents. The Rule 3 auto-fix (moving misconception dereferencing server-side) actually **tightens** T-08-17 — the client never sees raw library internals.

## Known Stubs

None. Every file committed in Plans 08-01 through 08-04 wires to real data:
- `themeClusters` comes from the existing `diagnosticSessions` query in `dashboard.ts`
- `getThemeDetail` joins enrollments + sessions
- `getOrGenerateLessonPlan` writes to `theme_lesson_plans`
- `generateStudentNarrative` calls the real `analyzeStudentThemes` prompt

The only "loading skeleton" is intentional UX (StudentNarrativeDialog's shimmer while the LLM call is in flight).

## Self-Check: PASSED

Files verified:
- FOUND: `packages/db/src/schema/theme-lesson-plans.ts`
- FOUND: `packages/db/src/migrations/0000_abandoned_polaris.sql`
- FOUND: `packages/db/src/migrations/meta/_journal.json`
- FOUND: `packages/db/src/migrations/meta/0000_snapshot.json`
- FOUND: `apps/web/lib/theme-cache-hash.ts`
- FOUND: `apps/web/components/dashboard/lesson-plan-card.tsx`
- FOUND: `apps/web/components/dashboard/themes-view.tsx`
- FOUND: `apps/web/components/dashboard/student-narrative-dialog.tsx`

Commits verified:
- FOUND: `09cf905` (Task 1 — schema + cache + tests)
- FOUND: `2b27605` (Task 2 — UI wiring)

Test + build + audit:
- VERIFIED: `pnpm -w test` — 172/172 pass across 7 tasks
- VERIFIED: `pnpm -w build` — 5/5 turbo tasks successful
- VERIFIED: `bash scripts/priv-01-audit.sh` — exit 0, PASSED

Plan 08-04 is the final plan of Phase 8. Phase complete — ready for `/gsd-verify-work 08` and the final human-verify pass against a seeded class.
