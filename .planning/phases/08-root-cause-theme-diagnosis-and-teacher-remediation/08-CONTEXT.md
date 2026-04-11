# Phase 8: Root-cause theme diagnosis and teacher remediation - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning
**Mode:** --auto (gray areas resolved using approved plan file `/Users/q/.claude/plans/snug-greeting-nygaard.md` and recommended defaults)

<domain>
## Phase Boundary

When a teacher opens their class dashboard, they can move from "here are the misconceptions my students hold" to "here is the underlying naive theory driving them" to "here is a structured lesson plan I can run tomorrow." The phase delivers three capabilities layered on top of existing Phase 4/5 infrastructure:

1. A hand-authored cross-domain theme taxonomy (~8–12 coarse themes) attached to every existing misconception entry in the YAML library.
2. Teacher dashboard aggregation by theme (Root Themes view) with drill-down to constituent misconceptions and affected students, and a per-student "Diagnostic Narrative" live-generated from that student's diagnostic sessions.
3. A cached, regeneratable, Zod-validated lesson plan scaffold generated per theme, rendered as a printable card in the teacher dashboard.

**Fixed constraints (locked):**
- Teacher-only — no student-facing UI changes.
- Read-only lesson plan scaffold — no edit/save CRUD.
- Coarse, cross-domain theme taxonomy — no fine-grained or nested taxonomies.
- Themes are hand-authored with research citations — LLM MUST NOT invent, classify, or discover themes at runtime.
- No denormalized theme column on `diagnostic_sessions`; aggregation is computed at query time via library lookup.

</domain>

<decisions>
## Implementation Decisions

### Theme taxonomy authoring
- **D-01:** Themes live in a new `packages/misconceptions/library/themes.yaml` registry — separate file from misconception entries, so the registry can be loaded and browsed independently.
- **D-02:** Each theme record contains `{id, name, naive_theory, description, citation}`. IDs are slugs (e.g., `substance-based-reasoning`, `continuous-force-required-for-motion`).
- **D-03:** Each misconception YAML entry gets a new required field `themes: string[]` (≥1 entry) and an optional `naive_theory?: string` override for cases where a misconception has a more specific underlying theory than the theme registry captures.
- **D-04:** Target ~8–12 themes total; enforce **minimum 3 constituent misconceptions per theme** during authoring — if a candidate theme has fewer than 3 entries, merge it into a sibling theme or drop it.
- **D-05:** Add a CI orphan check in `packages/misconceptions/src/__tests__/library.test.ts` that fails the build if any misconception has no themes or references a theme ID not present in `themes.yaml`.
- **D-06:** Extend `packages/misconceptions/src/loader.ts` with `loadThemes(): Theme[]`, `getThemeById(id): Theme | undefined`, and `getMisconceptionsByTheme(themeId): MisconceptionEntry[]` following the existing cached-module loader pattern.

### Dashboard aggregation by theme
- **D-07:** Extend `apps/web/actions/dashboard.ts::getClassDashboardData` to project existing `diagnosticSessions` rows through the theme index at query time (join in JS after the existing 5-query batch). Returns a new `ThemeCluster[]` array ranked by students-affected, then by unresolved count.
- **D-08:** Add `getThemeDetail(classId, themeId): Promise<ThemeDetail>` server action — returns the theme metadata + constituent misconceptions + affected students for the drill-down view.
- **D-09:** Add `getStudentThemeProfile(studentId): Promise<StudentThemeProfile>` server action — aggregates a single student's sessions by theme and prepares the input for the narrative LLM call. Returns raw counts only; LLM call is separate.
- **D-10:** No new database migration on user-facing tables. The only new table is `theme_lesson_plans` (see LLM layer decisions).

### LLM layer — prompt builders
- **D-11:** New prompt builder `packages/llm/src/prompts/analyze-student-themes.ts` with signature `analyzeStudentThemes({ gradeBand, themeCounts, misconceptionIds, sessionOutcomes }): Promise<{ dominantThemes: string[]; narrative: string; supportingMisconceptionIds: string[] }>`. Uses Vercel AI SDK `generateObject` + Zod — same pattern as existing `evaluateResolution` in `packages/llm/src/prompts/diagnose-resolve.ts`.
- **D-12:** New prompt builder `packages/llm/src/prompts/generate-lesson-plan.ts` with signature `generateLessonPlan({ theme, studentsAffected, gradeBand, constituentMisconceptions }): Promise<LessonPlan>`. Returns a Zod-validated `LessonPlan` object containing `{theme, studentsAffected, commonMisunderstanding, targetUnderstanding, suggestedActivities[], discussionPrompts[], confrontationApproaches[]}`.
- **D-13:** **PRIV-01 compliance is non-negotiable.** Neither prompt receives `studentId`, `name`, `email`, or any student identifier. Inputs are anonymized counts, grade bands, misconception library IDs, and session outcome enums only. Student identity binding (e.g., "Lila shows substance-based reasoning") happens in the component layer *after* the LLM returns, never inside the prompt template. Audit grep targets: both new prompt files AND the two new server actions `getThemeDetail` / `getStudentThemeProfile`.
- **D-14:** Use the existing Anthropic Claude model (default Sonnet) via the existing LLM adapter factory — no new provider wiring. Matches the existing `diagnose-*.ts` pattern.
- **D-15:** Fixture-based tests in `packages/llm/__tests__/` assert that generated lesson plans reference the theme's actual constituent misconceptions — guards against LLM hallucinating unrelated activities.

### Lesson plan caching
- **D-16:** New Drizzle table `theme_lesson_plans` in `packages/db/src/schema/theme-lesson-plans.ts` with columns: `{id, classId, themeId, dataHash, lessonPlan: jsonb, generatedAt, updatedAt}`, unique composite index on `(classId, themeId, dataHash)`.
- **D-17:** `dataHash` = SHA-256 of the sorted list of `(misconceptionId, studentCount, unresolvedCount)` tuples feeding the generation. Any change to the class's theme fingerprint invalidates the cache naturally.
- **D-18:** Cache lookup behavior: `getOrGenerateLessonPlan(classId, themeId, { forceRegenerate?: boolean })` — if a cached row matches the current dataHash AND `forceRegenerate !== true`, return it; otherwise call the LLM and upsert a new row (new row, not update — preserves history for debugging and lets us compare generations).
- **D-19:** Student narrative is **NOT cached** — it's one LLM call per click, changes as new sessions are added, and avoids schema growth. Runtime cost is acceptable.

### Teacher dashboard UI
- **D-20:** Root Themes is rendered as a **new sub-tab inside the existing Misconceptions area** — extends `apps/web/components/dashboard/misconceptions-tab.tsx` with a two-pill toggle ("By Misconception" / "By Root Theme") instead of creating an entirely new top-level tab. Keeps the tab bar uncluttered and discoverable.
- **D-21:** New component `apps/web/components/dashboard/themes-view.tsx` — card grid following the existing `misconceptions-tab.tsx` sorted-card pattern (props `{ themes: ThemeCluster[] }`, sort by unresolved count descending, expanded state via `useState`).
- **D-22:** New component `apps/web/components/dashboard/lesson-plan-card.tsx` — renders the Zod-validated lesson plan with clearly sectioned fields. Collapsed by default; teacher clicks to expand.
- **D-23:** New component `apps/web/components/dashboard/student-narrative-dialog.tsx` — modal triggered from the student row in the Students tab. Shows loading skeleton → narrative text → supporting misconception list. Live-generated via the `analyzeStudentThemes` prompt on open.
- **D-24:** Print support via **Tailwind `print:` utilities** (not a dedicated print stylesheet) — matches existing Tailwind v4 stack. `LessonPlanCard` uses `print:shadow-none print:border print:break-inside-avoid` etc.
- **D-25:** Regenerate control is an **explicit button** on the lesson plan card labeled "Regenerate" with a subtle refresh icon. No automatic regeneration on data change — teachers keep control (matches LSPL-02).

### Claude's Discretion
- Exact phrasing, tone, and length of LLM system prompts in `analyze-student-themes.ts` and `generate-lesson-plan.ts`
- Exact shape of the Zod schema for `LessonPlan` beyond the listed fields (additional optional fields are acceptable if they improve output quality)
- Card grid column count and spacing (follow existing misconceptions tab visual density)
- Loading skeleton and empty-state illustrations
- Button icon choices (Lucide or equivalent — match existing)
- Error state copy when LLM call fails
- The ~8–12 theme list itself (taxonomy authoring is a research + domain exercise; Claude picks the final set during 08-01 authoring, guided by citations from Vosniadou, Chi, diSessa, and the existing citations in the misconception library)
- Handling of misconceptions that legitimately span multiple themes — `themes: string[]` allows N themes per misconception; Claude decides which ones qualify during backfill

</decisions>

<specifics>
## Specific Ideas

- User's verbatim framing: *"diagnosing why the student/user has misconceptions and relating them to something … so if a guide or a teacher were to look at the mind map (or a summary of some kind) they could create a lesson plan to 'right' the students way of interpretation."*
- The "aha" moment the feature must deliver: a teacher seeing three disconnected misconceptions ("heavier objects fall faster", "heat is a substance", "continuous force needed for motion") grouped under one naive theory ("substance-based / force-as-stuff reasoning") and realizing they can fix all three with one lesson.
- Student narrative must surface **patterns across misconceptions**, not per-misconception summaries. Good: "Lila conflates heat, mass, and chemical reactions — all stem from substance-as-stuff thinking." Bad: "Lila holds the 'heat is a substance' misconception and the 'mass vs weight' misconception."
- Reference prompts for lesson plan generation should cite Vosniadou (framework theory) and Chi (ontological category misclassification) — the existing misconception library already cites these researchers.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Approved phase design
- `/Users/q/.claude/plans/snug-greeting-nygaard.md` — Full approved phase plan: goal, 5 success criteria, 4-plan breakdown (08-01..08-04), 7 new requirements (THME-01..03, DASH-07..08, LSPL-01..02), touchpoints, design risks, verification plan. **This is the authoritative source for Phase 8 scope and success criteria.**

### Project specs
- `.planning/PROJECT.md` — Project vision, core value proposition, tech stack constraints (Next.js 15, Drizzle, Vercel AI SDK, pnpm monorepo)
- `.planning/REQUIREMENTS.md` — Acceptance criteria, privacy constraint (PRIV-01)
- `.planning/ROADMAP.md` — Phase 8 entry (currently `[To be planned]`, will be filled in by `/gsd-plan-phase 8`)

### Codebase maps (read for existing conventions)
- `.planning/codebase/ARCHITECTURE.md` — System architecture
- `.planning/codebase/CONVENTIONS.md` — Code conventions
- `.planning/codebase/STACK.md` — Tech stack details
- `.planning/codebase/STRUCTURE.md` — File structure

### Existing phase artifacts (reuse patterns from)
- `.planning/phases/04-misconception-diagnostics/` — Misconception diagnostic flow, PRIV-01 pattern for LLM prompts
- `.planning/phases/05-teacher-dashboard/` — Dashboard aggregation patterns, `getClassDashboardData` extension pattern

### Reference code (read for patterns — do not modify during 08-01)
- `packages/misconceptions/src/schema.ts` — Zod schema to extend with `themes[]`
- `packages/misconceptions/src/loader.ts` — Loader pattern to extend with `loadThemes()`
- `packages/misconceptions/library/{physics,biology,math,history}.yaml` — 40 entries to backfill with themes
- `packages/db/src/schema/diagnostic-sessions.ts` — Drizzle schema pattern for the new `theme_lesson_plans` table
- `packages/llm/src/prompts/diagnose-resolve.ts` — Prompt builder pattern (generateObject + Zod) for new prompts
- `apps/web/actions/dashboard.ts` — Dashboard server action pattern (~lines 301–338 contain the misconception aggregation to extend)
- `apps/web/components/dashboard/misconceptions-tab.tsx` — Sorted card grid pattern for the new themes view

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`@mindmap/misconceptions` YAML library + Zod loader** — already handles the 40-entry misconception library with grade-band + domain lookup. Extending is backward-compatible.
- **`evaluateResolution` pattern in `packages/llm/src/prompts/diagnose-resolve.ts`** — Vercel AI SDK `generateObject` + Zod. New prompts follow this exact signature style.
- **`getClassDashboardData` batched-query pattern in `apps/web/actions/dashboard.ts`** — 5 DB queries then JS-side aggregation. New theme aggregation slots in after the existing misconception aggregation without adding a query.
- **`MisconceptionsTab` sorted-card component pattern in `apps/web/components/dashboard/misconceptions-tab.tsx`** — card grid sorted by unresolved count, expand-on-click via `useState`. Exact pattern to follow for `themes-view.tsx`.
- **Drizzle schema pattern with composite indexes** — `diagnostic_sessions.ts` demonstrates pgEnum + jsonb + composite indexes. `theme_lesson_plans` follows the same style.
- **Tailwind v4 print utilities** — already in use throughout `apps/web`; `LessonPlanCard` uses `print:*` variants inline.
- **Seed data script `packages/db/src/seed.ts`** — produces 30-day/60-day/20-student seed data that will drive the Phase 8 end-to-end verification unchanged.

### Established Patterns
- **PRIV-01 pattern** — grade band + student's own words + library text only; never studentId/name/email in prompt inputs. Existing prompts in `packages/llm/src/prompts/diagnose-*.ts` demonstrate the pattern.
- **Monorepo workspace references** — Phase 8 touches all 4 internal packages (`misconceptions`, `llm`, `db`, `apps/web`) via `workspace:*` — no new inter-package wiring required.
- **Drizzle migrations via drizzle-kit generate + push** — standard for this project.
- **Vitest fixture-based tests** — used throughout `packages/llm/__tests__/`. New prompt tests follow the same structure.
- **Server actions over API routes** — dashboard already uses `'use server'` server actions (e.g., `getClassDashboardData`). New actions follow the same convention.

### Integration Points
- `packages/misconceptions/src/index.ts` — re-export new loader functions
- `apps/web/actions/dashboard.ts` — extend existing `getClassDashboardData` return shape with a new `themeClusters` field
- `apps/web/components/dashboard/misconceptions-tab.tsx` — add the view-mode toggle to render the new `ThemesView` child component
- `apps/web/components/dashboard/students-tab.tsx` (existing) — add the "Diagnostic Narrative" trigger on each student row
- `packages/db/src/schema/index.ts` — re-export new `themeLessonPlans` table
- `packages/db/drizzle/` — new migration file for `theme_lesson_plans`

</code_context>

<deferred>
## Deferred Ideas

The following surfaced during planning but are explicitly out of scope for Phase 8 (per the approved plan file and user decisions):

- **NGSS / Common Core / state-standards alignment** — deferred to v2 per REQUIREMENTS.md.
- **Automated lesson delivery, scheduling, or assignment to students** — out of scope.
- **Editable / savable teacher-authored lesson plans** — Phase 8 is read-only scaffold + regenerate per user decision. Future phase could add CRUD.
- **Per-student adaptive remediation paths or any new student-facing UI** — student experience is unchanged per user decision.
- **LLM-driven theme classification, discovery, or clustering** — themes are hand-authored; any future "dynamic theme" work would be its own phase.
- **Fine-grained or nested theme taxonomies** — coarse, flat, cross-domain only per user decision.
- **Longitudinal trend analysis** ("is this theme fading week-over-week") — belongs to a future analytics phase.
- **Multi-class / school-wide rollups** — everything is scoped to one `classId`.
- **PDF / Markdown export, email sharing, or translation of lesson plans** — printable HTML via Tailwind print utilities is sufficient for this phase.
- **Parent / guardian view or shareable read-only links** — introduces auth/sharing work out of scope.
- **"Diagnostic Narrative" caching** — kept live per D-19; future phase could add if cost becomes a concern.

</deferred>

---

*Phase: 08-root-cause-theme-diagnosis-and-teacher-remediation*
*Context gathered: 2026-04-10*
*Mode: --auto (gray areas resolved with recommended defaults backed by approved plan file)*
