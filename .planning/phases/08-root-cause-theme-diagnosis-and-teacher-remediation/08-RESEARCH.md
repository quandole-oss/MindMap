# Phase 8: Root-cause theme diagnosis and teacher remediation - Research

**Researched:** 2026-04-10
**Domain:** Conceptual-change theory taxonomy + Drizzle/AI SDK integration patterns
**Confidence:** HIGH for codebase patterns; MEDIUM-HIGH for theme taxonomy (grounded in existing library citations)

## Summary

Phase 8 is almost entirely a **pattern-matching exercise against existing code** plus one load-bearing domain research task: authoring a research-backed cross-domain theme taxonomy. The codebase already has clean, small, consistent patterns for every technical concern in the phase — YAML schema extension, loader caching, Drizzle jsonb+composite-index tables, server-action aggregation, and `generateText + Output.object({ schema })` structured LLM output. No new libraries are needed; no existing conventions need to be bent.

The single surprise worth flagging to the planner: the repo does **not** use `generateObject` from the AI SDK. Despite the CONTEXT.md wording ("Vercel AI SDK `generateObject`"), every existing prompt — `extract.ts`, `disambiguate.ts`, `diagnose-resolve.ts` — uses `generateText({ ..., experimental_output: Output.object({ schema }) })` and reads `experimental_output`. Plan 08-03 MUST match this pattern exactly; introducing `generateObject` would be an unnecessary convention break.

The second finding worth flagging: **no existing `print:` Tailwind utilities exist anywhere in `apps/web`** (grep returns zero app-code matches). The `LessonPlanCard` print-CSS work in 08-04 is the first instance in the project — the planner should treat this as a greenfield concern, not a "follow the existing pattern" concern.

**Primary recommendation:** The planner should treat the existing `diagnose-resolve.ts` / `extract.ts` / `diagnostic-sessions.ts` files as the canonical templates for plans 08-03, 08-01 loader extension, and 08-04 schema respectively. Theme taxonomy authoring (08-01) is the one area requiring genuine creative judgment, and the draft taxonomy below is the authoritative starting content.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Theme taxonomy authoring:**
- **D-01:** Themes live in a new `packages/misconceptions/library/themes.yaml` registry — separate file from misconception entries, so the registry can be loaded and browsed independently.
- **D-02:** Each theme record contains `{id, name, naive_theory, description, citation}`. IDs are slugs (e.g., `substance-based-reasoning`, `continuous-force-required-for-motion`).
- **D-03:** Each misconception YAML entry gets a new required field `themes: string[]` (≥1 entry) and an optional `naive_theory?: string` override for cases where a misconception has a more specific underlying theory than the theme registry captures.
- **D-04:** Target ~8–12 themes total; enforce **minimum 3 constituent misconceptions per theme** during authoring — if a candidate theme has fewer than 3 entries, merge it into a sibling theme or drop it.
- **D-05:** Add a CI orphan check in `packages/misconceptions/src/__tests__/library.test.ts` that fails the build if any misconception has no themes or references a theme ID not present in `themes.yaml`.
- **D-06:** Extend `packages/misconceptions/src/loader.ts` with `loadThemes(): Theme[]`, `getThemeById(id): Theme | undefined`, and `getMisconceptionsByTheme(themeId): MisconceptionEntry[]` following the existing cached-module loader pattern.

**Dashboard aggregation by theme:**
- **D-07:** Extend `apps/web/actions/dashboard.ts::getClassDashboardData` to project existing `diagnosticSessions` rows through the theme index at query time (join in JS after the existing 5-query batch). Returns a new `ThemeCluster[]` array ranked by students-affected, then by unresolved count.
- **D-08:** Add `getThemeDetail(classId, themeId): Promise<ThemeDetail>` server action — returns the theme metadata + constituent misconceptions + affected students for the drill-down view.
- **D-09:** Add `getStudentThemeProfile(studentId): Promise<StudentThemeProfile>` server action — aggregates a single student's sessions by theme and prepares the input for the narrative LLM call. Returns raw counts only; LLM call is separate.
- **D-10:** No new database migration on user-facing tables. The only new table is `theme_lesson_plans`.

**LLM layer — prompt builders:**
- **D-11:** New prompt builder `packages/llm/src/prompts/analyze-student-themes.ts` with signature `analyzeStudentThemes({ gradeBand, themeCounts, misconceptionIds, sessionOutcomes }): Promise<{ dominantThemes: string[]; narrative: string; supportingMisconceptionIds: string[] }>`. Uses the same `generateText + Output.object` pattern as `evaluateResolution`.
- **D-12:** New prompt builder `packages/llm/src/prompts/generate-lesson-plan.ts` with signature `generateLessonPlan({ theme, studentsAffected, gradeBand, constituentMisconceptions }): Promise<LessonPlan>`. Returns a Zod-validated `LessonPlan` object containing `{theme, studentsAffected, commonMisunderstanding, targetUnderstanding, suggestedActivities[], discussionPrompts[], confrontationApproaches[]}`.
- **D-13:** **PRIV-01 compliance is non-negotiable.** Neither prompt receives `studentId`, `name`, `email`, or any student identifier. Inputs are anonymized counts, grade bands, misconception library IDs, and session outcome enums only. Student identity binding (e.g., "Lila shows substance-based reasoning") happens in the component layer *after* the LLM returns, never inside the prompt template. Audit grep targets: both new prompt files AND the two new server actions.
- **D-14:** Use the existing Anthropic Claude model (default Sonnet) via the existing LLM adapter factory — no new provider wiring.
- **D-15:** Fixture-based tests in `packages/llm/__tests__/` assert that generated lesson plans reference the theme's actual constituent misconceptions.

**Lesson plan caching:**
- **D-16:** New Drizzle table `theme_lesson_plans` in `packages/db/src/schema/theme-lesson-plans.ts` with columns: `{id, classId, themeId, dataHash, lessonPlan: jsonb, generatedAt, updatedAt}`, unique composite index on `(classId, themeId, dataHash)`.
- **D-17:** `dataHash` = SHA-256 of the sorted list of `(misconceptionId, studentCount, unresolvedCount)` tuples feeding the generation.
- **D-18:** Cache lookup: `getOrGenerateLessonPlan(classId, themeId, { forceRegenerate?: boolean })` — if a cached row matches the current dataHash AND `forceRegenerate !== true`, return it; otherwise call the LLM and insert a new row (new row, not update).
- **D-19:** Student narrative is **NOT cached** — one LLM call per click.

**Teacher dashboard UI:**
- **D-20:** Root Themes is a **new sub-tab inside the existing Misconceptions area** — extends `misconceptions-tab.tsx` with a two-pill toggle ("By Misconception" / "By Root Theme").
- **D-21:** New component `apps/web/components/dashboard/themes-view.tsx` — card grid following the existing sorted-card pattern.
- **D-22:** New component `apps/web/components/dashboard/lesson-plan-card.tsx` — collapsed by default; teacher clicks to expand.
- **D-23:** New component `apps/web/components/dashboard/student-narrative-dialog.tsx` — modal triggered from the student row.
- **D-24:** Print support via **Tailwind `print:` utilities** (not a dedicated print stylesheet).
- **D-25:** Regenerate control is an **explicit button** on the lesson plan card. No automatic regeneration.

### Claude's Discretion

- Exact phrasing, tone, and length of LLM system prompts
- Exact shape of the Zod schema for `LessonPlan` beyond the listed fields (additional optional fields are acceptable if they improve output quality)
- Card grid column count and spacing (follow existing misconceptions tab visual density)
- Loading skeleton and empty-state illustrations
- Button icon choices (Lucide or equivalent — match existing)
- Error state copy when LLM call fails
- The ~8–12 theme list itself — Claude picks the final set during 08-01 authoring, guided by citations from Vosniadou, Chi, diSessa, and the existing citations in the misconception library
- Handling of misconceptions that legitimately span multiple themes — `themes: string[]` allows N themes per misconception

### Deferred Ideas (OUT OF SCOPE)

- NGSS / Common Core / state-standards alignment (deferred to v2)
- Automated lesson delivery, scheduling, or assignment to students
- Editable / savable teacher-authored lesson plans
- Per-student adaptive remediation paths or any new student-facing UI
- LLM-driven theme classification, discovery, or clustering — themes are hand-authored
- Fine-grained or nested theme taxonomies
- Longitudinal trend analysis
- Multi-class / school-wide rollups
- PDF / Markdown export, email sharing, or translation
- Parent / guardian view or shareable read-only links
- "Diagnostic Narrative" caching
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| THME-01 | Every misconception YAML entry MUST declare ≥1 theme; CI fails on orphans | §A1 theme taxonomy + §A2 schema shape; §E existing library.test.ts pattern |
| THME-02 | Themes are hand-authored with research citations in `themes.yaml`; LLM MUST NOT invent, classify, or discover themes at runtime | §A1 draft taxonomy (all entries carry real citations); §B5 PRIV-01 / hallucination audit pattern |
| THME-03 | Theme aggregation is computed at query time from `diagnostic_sessions` joined to the library; no denormalized theme column on session rows | §D8 `getClassDashboardData` structure + §D9 JS-side join feasibility |
| DASH-07 | Teacher dashboard exposes a Root Themes view ranked by students-affected and unresolved count with drill-down to constituent misconceptions and students | §D8 return-shape extension + §E10 existing `MisconceptionsTab` card pattern |
| DASH-08 | Teacher can request a per-student diagnostic narrative summarizing dominant themes with misconception citations | §B3 structured-output pattern + §B4 anti-hallucination techniques |
| LSPL-01 | Lesson plan generation returns a Zod-validated structured object (not free prose) containing `commonMisunderstanding`, `targetUnderstanding`, `suggestedActivities[]`, `discussionPrompts[]`, and `confrontationApproaches[]` | §B3 `generateText + Output.object({ schema })` + §B4 few-shot/constraint techniques |
| LSPL-02 | Generated lesson plans are cached per `(classId, themeId, dataHash)` with an explicit teacher-triggered regenerate action | §C6 Drizzle schema skeleton + §C7 SHA-256 dataHash approach |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Next.js 15 / React 19 / TypeScript strict / PostgreSQL 16 + pgvector / Drizzle ORM / Vercel AI SDK / pnpm workspace. Phase 8 stays inside this stack — no new deps required.
- **Monorepo packages:** `apps/web`, `packages/llm`, `packages/misconceptions`, `packages/db`. Phase 8 touches all four via `workspace:*`.
- **LLM provider:** Anthropic Claude (default Sonnet) via existing `createLLMAdapter()` factory. Do NOT wire a new provider.
- **Data privacy (PRIV-01):** No telemetry, no data sent home. No student PII in LLM prompts.
- **Misconception library:** YAML + Git, version-controlled, CI-validated, community-extensible. Schema extension must stay backward-compatible for community contributors.
- **Zod-first validation:** Every YAML boundary and LLM output boundary is Zod-validated. No ad-hoc JSON parsing.
- **GSD workflow enforcement:** All file edits happen inside a GSD phase/plan — Phase 8 work must be executed via `/gsd-execute-phase`.

## Standard Stack

### Core (already installed — no new installs required for Phase 8)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | `^6.0.154` | Vercel AI SDK core — `generateText` with `experimental_output: Output.object({ schema })` for structured output | Already the repo convention across `extract.ts`, `disambiguate.ts`, `diagnose-resolve.ts`. `[VERIFIED: packages/llm/package.json]` |
| `@ai-sdk/anthropic` | `^3.0.68` | Anthropic provider wrapped by the existing `createLLMAdapter()` factory | Primary provider per CLAUDE.md. Already in use. `[VERIFIED: packages/llm/package.json]` |
| `zod` | `^3.25.76` | Schema validation for YAML boundary + LLM output boundary | Already used in `schema.ts` for misconception library; same pattern extends to theme schema and lesson plan output. `[VERIFIED: packages/llm/package.json]` |
| `drizzle-orm` | `^0.45.2` | ORM + schema definition for the new `theme_lesson_plans` table | Already used throughout `packages/db/src/schema/*.ts`. Supports `pgTable`, `jsonb`, composite indexes via `(t) => [index(...)]` callback. `[VERIFIED: packages/db/package.json]` |
| `js-yaml` | (transitive via `@mindmap/misconceptions`) | Load `themes.yaml` | Already used by `loader.ts`. `[VERIFIED: packages/misconceptions/src/loader.ts]` |

**No new dependencies** are required for Phase 8. `crypto.subtle` (Web Crypto API) is built into Node 18+ and the edge runtime — used for the SHA-256 `dataHash`.

### Version verification — deferred

Because Phase 8 adds zero new dependencies, the standard `npm view <pkg> version` freshness check is not needed. The planner should NOT introduce new packages during implementation; if an apparent need arises (e.g., for hashing), use Web Crypto first.

## Architecture Patterns

### Recommended file additions (exact paths)

```
packages/misconceptions/
├── library/
│   └── themes.yaml              # NEW — hand-authored theme registry (§A1)
├── src/
│   ├── schema.ts                # EXTEND — add themeSchema + themes[] to misconceptionEntrySchema
│   ├── loader.ts                # EXTEND — loadThemes / getThemeById / getMisconceptionsByTheme
│   ├── index.ts                 # EXTEND — re-export theme helpers
│   └── __tests__/
│       └── library.test.ts      # EXTEND — orphan check + theme lookup coverage

packages/db/
├── src/
│   ├── schema/
│   │   ├── theme-lesson-plans.ts    # NEW — cache table (§C6)
│   │   └── index.ts                 # EXTEND — re-export themeLessonPlans
│   └── drizzle/                     # NEW migration generated by drizzle-kit

packages/llm/
├── src/
│   └── prompts/
│       ├── analyze-student-themes.ts    # NEW (§B3)
│       └── generate-lesson-plan.ts      # NEW (§B3)
└── __tests__/
    ├── analyze-student-themes.test.ts   # NEW
    └── generate-lesson-plan.test.ts     # NEW

apps/web/
├── actions/
│   ├── dashboard.ts                             # EXTEND — themeClusters on return shape (§D8)
│   └── themes.ts                                # NEW — getThemeDetail, getStudentThemeProfile, getOrGenerateLessonPlan
├── lib/
│   └── dashboard-types.ts                       # EXTEND — ThemeCluster, ThemeDetail, StudentThemeProfile, LessonPlan types
└── components/
    └── dashboard/
        ├── misconceptions-tab.tsx               # EXTEND — add view-mode pill toggle (§E10)
        ├── themes-view.tsx                      # NEW — Root Themes card grid
        ├── lesson-plan-card.tsx                 # NEW — printable scaffold renderer (§E11)
        └── student-narrative-dialog.tsx         # NEW — live narrative modal
```

### Pattern 1: Zod-validated YAML loader with module-level cache
**What:** A typed reader that parses YAML once, validates with Zod, caches the parsed result in a module-local variable, and exposes typed query helpers.
**When to use:** Any new static library file added under `packages/misconceptions/library/`.
**Template (follow exactly):**
```ts
// packages/misconceptions/src/loader.ts — extend pattern
// Source: packages/misconceptions/src/loader.ts:11–62 [VERIFIED]

let _themes: Theme[] | null = null;

export function loadThemes(): Theme[] {
  if (_themes) return _themes;
  const libraryDir = getLibraryDir();            // reuse existing helper
  const filePath = path.join(libraryDir, "themes.yaml");
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(content);
  _themes = themeLibrarySchema.parse(parsed);    // Zod-validated
  return _themes;
}

export function getThemeById(id: string): Theme | undefined {
  return loadThemes().find((t) => t.id === id);
}

export function getMisconceptionsByTheme(themeId: string): MisconceptionEntry[] {
  return loadLibrary().filter((e) => e.themes.includes(themeId));
}

export function resetThemeCache(): void {
  _themes = null;
}
```

### Pattern 2: AI SDK structured output via `generateText + Output.object`
**What:** The repo's established idiom for calling Claude with a Zod-validated output schema. **This is NOT `generateObject`** — every existing prompt uses `generateText` with `experimental_output`.
**When to use:** Any new prompt in `packages/llm/src/prompts/*.ts` that needs a structured result.
**Template (follow exactly — this is load-bearing for 08-03):**
```ts
// Source: packages/llm/src/prompts/diagnose-resolve.ts:47–55 [VERIFIED]
// Source: packages/llm/src/prompts/extract.ts:48–63 [VERIFIED]
// Source: packages/llm/src/prompts/disambiguate.ts:76–84 [VERIFIED]

import { z } from "zod";
import { generateText, Output } from "ai";
import { createLLMAdapter } from "../adapters/factory";

const lessonPlanSchema = z.object({
  theme: z.string(),
  commonMisunderstanding: z.string(),
  targetUnderstanding: z.string(),
  suggestedActivities: z.array(z.string()).min(1),
  discussionPrompts: z.array(z.string()).min(1),
  confrontationApproaches: z.array(z.string()).min(1),
});

export async function generateLessonPlan(params: {
  /* anonymized inputs only — see D-13 */
}): Promise<z.infer<typeof lessonPlanSchema>> {
  const adapter = createLLMAdapter();
  const model = adapter.getModel();
  const prompt = buildLessonPlanPrompt(params);

  const { experimental_output } = await generateText({
    model,
    prompt,
    experimental_output: Output.object({ schema: lessonPlanSchema }),
  });

  return experimental_output;
}
```

**CRITICAL:** Do not import `generateObject`. Do not use `{ experimental_telemetry: ... }`. Do not deviate from this pattern — the existing `packages/llm/__tests__/` fixture setup depends on the `generateText` call shape.

### Pattern 3: Drizzle pgTable with jsonb typed field and composite unique index
**What:** The established idiom for a jsonb-backed table with composite uniqueness and timestamp columns.
**When to use:** The new `theme_lesson_plans` cache table.
**Template:**
```ts
// Source: packages/db/src/schema/diagnostic-sessions.ts:25–61 [VERIFIED]
// Source: packages/db/src/schema/questions.ts:66–83 [VERIFIED] (unique composite pattern)

import { pgTable, text, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { classes } from "./classes";

export const themeLessonPlans = pgTable(
  "theme_lesson_plans",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    themeId: text("theme_id").notNull(),                  // slug from themes.yaml — NOT an FK (YAML is source of truth)
    dataHash: text("data_hash").notNull(),                // SHA-256 hex of sorted tuples
    lessonPlan: jsonb("lesson_plan")
      .$type<LessonPlan>()
      .notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("theme_lesson_plans_class_theme_hash_idx")
      .on(t.classId, t.themeId, t.dataHash),
    // secondary index for "latest plan for this class+theme" lookups
    index("theme_lesson_plans_class_theme_idx").on(t.classId, t.themeId),
  ]
);
```

**Pitfall to avoid:** Do NOT use `.default([])` for jsonb — `diagnostic-sessions.ts:49` explicitly documents a Drizzle v0.45 jsonb array default bug. For `lessonPlan` the field is `notNull()` with no default (every row is inserted with explicit content), so the pitfall doesn't apply, but the planner should still avoid any jsonb default.

### Pattern 4: Server action batched-query + JS-side aggregation
**What:** `getClassDashboardData` runs 5 queries (classes check, enrollments, concepts, edges, questions, diagnostic_sessions) then does all aggregation in JS using `Map` + `Set`. The new theme aggregation slots in after the existing `misconceptionClusters` block at line ~346.
**When to use:** Extending `getClassDashboardData` with theme projection (D-07).
**Template:**
```ts
// Source: apps/web/actions/dashboard.ts:300–364 [VERIFIED]
// The existing clusterMap loop already produces per-misconception groupings.
// Add a SECOND pass that projects each misconception through loadThemes + getMisconceptionsByTheme.

const misconceptionLibrary = loadLibrary();               // cached module-level call
const themes = loadThemes();                              // cached module-level call
const themeByMiscId = new Map<string, string[]>();        // miscId -> theme ids
for (const m of misconceptionLibrary) {
  themeByMiscId.set(m.id, m.themes);
}

const themeClusterMap = new Map<
  string,
  { affectedUserIds: Set<string>; resolvedUserIds: Set<string>;
    constituentMisconceptionIds: Set<string> }
>();

for (const session of allSessions) {
  const miscThemes = themeByMiscId.get(session.misconceptionId) ?? [];
  for (const themeId of miscThemes) {
    const existing = themeClusterMap.get(themeId) ?? {
      affectedUserIds: new Set<string>(),
      resolvedUserIds: new Set<string>(),
      constituentMisconceptionIds: new Set<string>(),
    };
    existing.affectedUserIds.add(session.userId);
    existing.constituentMisconceptionIds.add(session.misconceptionId);
    if (session.outcome === "resolved") existing.resolvedUserIds.add(session.userId);
    themeClusterMap.set(themeId, existing);
  }
}

const themeClusters: ThemeCluster[] = [...themeClusterMap.entries()]
  .map(([themeId, v]) => {
    const theme = themes.find((t) => t.id === themeId)!;
    return {
      themeId,
      themeName: theme.name,
      naiveTheory: theme.naive_theory,
      studentsAffected: v.affectedUserIds.size,
      unresolvedCount: v.affectedUserIds.size - v.resolvedUserIds.size,
      resolvedCount: v.resolvedUserIds.size,
      constituentMisconceptionIds: [...v.constituentMisconceptionIds],
    };
  })
  .sort((a, b) =>
    b.studentsAffected - a.studentsAffected ||
    b.unresolvedCount - a.unresolvedCount
  );
```

**Memory/perf:** For a 20-student class with ~40 sessions and ~10 themes, this adds ~O(sessions × avg_themes_per_misc) iterations and a handful of new `Set`s — negligible. No DB round-trip added.

### Anti-Patterns to Avoid

- **Don't denormalize theme onto `diagnostic_sessions`** — violates THME-03 and CONTEXT.md D-07. Always compute at query time via library lookup.
- **Don't let the LLM classify misconceptions to themes at runtime** — violates THME-02 and CONTEXT.md D-06 (source-of-truth is `themes.yaml` + the `themes: []` field on each misconception).
- **Don't use `generateObject`** — breaks the repo convention and the `experimental_output` destructuring pattern that every existing prompt and its test harness depend on.
- **Don't pass `studentId`, `name`, `email`, or enrollment records into prompt parameters** — PRIV-01 violation. The prompt-building functions should only accept primitive/enum inputs (see §B5).
- **Don't cache the per-student narrative** — D-19 explicitly excludes this.
- **Don't create a migration for `diagnostic_sessions`** — D-10 forbids it.
- **Don't build a dedicated print stylesheet** — D-24 mandates Tailwind `print:` utilities inline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured LLM output | Custom JSON parsing + retry loop | `generateText + Output.object({ schema: zod })` | AI SDK retries + repairs automatically; `experimental_output` is typed from the Zod schema |
| YAML validation | Manual field checks | Zod `.parse()` in the loader | Existing `misconceptionLibrarySchema.parse(entries)` pattern catches every schema drift at load time |
| Cache key / dataHash | Random UUID, `Date.now()`, or JSON.stringify without sort | `sha256(sortedJson(tuples))` via Web Crypto | Stable hash = correct cache invalidation. Unsorted keys cause cache thrash. |
| Composite uniqueness | Application-side dedupe check | `uniqueIndex().on(...)` on the Drizzle table | Database-enforced; survives concurrent inserts |
| Theme taxonomy discovery | LLM classification at runtime | Hand-authored `themes.yaml` + CI orphan check | THME-02 locked; LLM classification would produce inconsistent, unreviewed taxonomies |
| Print CSS | Dedicated `print.css` file + `<link media="print">` | Inline Tailwind v4 `print:*` utility variants | Matches v4 CSS-first config; no new build plumbing; D-24 locked |
| Dashboard aggregation | New SQL JOIN query for themes | JS-side Map-based aggregation over existing batched queries | D-07 locked; O(n) on already-in-memory data; no added DB round-trip |

**Key insight:** Every "new" problem in Phase 8 already has a one-file template somewhere in the codebase. The planner's job is template-matching, not invention.

## Common Pitfalls

### Pitfall 1: `generateObject` vs `generateText + Output.object`
**What goes wrong:** Introducing `generateObject` (from the AI SDK top-level) for the new prompts seems natural — it's what the official docs recommend for structured output.
**Why it happens:** AI SDK docs for v4+ steer users toward `generateObject`. The repo predates that guidance and uses `generateText + Output.object` consistently.
**How to avoid:** The planner must explicitly call out the pattern ("use `generateText + experimental_output: Output.object({ schema })`, not `generateObject`") in plans 08-03. Every prompt file in `packages/llm/src/prompts/` uses the `generateText` form — copy from `diagnose-resolve.ts:47–55`.
**Warning signs:** Importing `generateObject` from `ai`; destructuring `.object` from the call result; tests mocking `generateObject`.

### Pitfall 2: PRIV-01 leakage through "convenient" prompt inputs
**What goes wrong:** When building `analyzeStudentThemes`, it's tempting to pass the full student session rows — including `userId` — so the prompt template can "name the student." This would be a PRIV-01 violation and a grep hit in the Phase 8 audit.
**Why it happens:** The natural JS shape of the server-action data already carries `studentId`; omitting it from the prompt requires explicit destructuring.
**How to avoid:** The prompt function signature MUST accept only primitives and enums. The existing `diagnose-probe.ts` / `diagnose-confront.ts` / `diagnose-resolve.ts` all follow this: they take `gradeLevel: number`, `probeQuestion: string`, `originalQuestion: string` — never a session object. `analyze-student-themes.ts` signature (from D-11):
```ts
analyzeStudentThemes({
  gradeBand: "K-5" | "6-8" | "9-12",
  themeCounts: Record<string, number>,      // themeId -> count, no studentId
  misconceptionIds: string[],               // library IDs only
  sessionOutcomes: ("resolved"|"unresolved"|"incomplete")[],
})
```
**Warning signs:** Any `userId`, `studentId`, `name`, `email`, `enrollment`, or `user` key in the prompt params or in the server-action caller's destructure. The audit grep (`grep -rE '(email|name|studentId|userId)' packages/llm/src/prompts/analyze-student-themes.ts generate-lesson-plan.ts actions/themes.ts`) MUST return zero hits.

### Pitfall 3: jsonb default bug
**What goes wrong:** Using `.default([])` or `.default({})` on a jsonb column silently fails in Drizzle v0.45 — the default is never applied, inserts without the field fail with NOT NULL violations.
**Why it happens:** Documented pitfall in the existing codebase — see `diagnostic-sessions.ts:49` comment explicitly calling out "Pitfall 6 workaround".
**How to avoid:** For `lessonPlan` in `theme_lesson_plans`, use `notNull()` with NO default — every insert supplies the full lesson plan body. If a default were ever needed, use `$defaultFn(() => ...)` instead of `.default(...)`.
**Warning signs:** `jsonb(...).default(...)` anywhere in the new schema file.

### Pitfall 4: Unstable dataHash across environments
**What goes wrong:** `JSON.stringify` without sorting produces different strings for `{a:1,b:2}` vs `{b:2,a:1}`, causing cache misses on semantically identical inputs.
**Why it happens:** Object key order is implementation-defined (though V8 preserves insertion order, the *inputs* to the hash may come in different orders across calls).
**How to avoid:** Sort the tuple array by `misconceptionId` before serializing. Use a deterministic serializer:
```ts
const sortedTuples = [...tuples].sort((a, b) => a.misconceptionId.localeCompare(b.misconceptionId));
const canonical = JSON.stringify(sortedTuples);  // tuple objects always have same key order if constructed consistently
const hash = await sha256Hex(canonical);
```
And construct the tuple objects with a single literal shape: `{ misconceptionId, studentCount, unresolvedCount }` — always in that key order.
**Warning signs:** Unsorted input; raw object hashing; `Math.random()` or `Date.now()` in the hash input; repeated "cache miss" in testing with identical data.

### Pitfall 5: Theme drift between `themes.yaml` and backfilled misconceptions
**What goes wrong:** Author `themes.yaml` with ID `substance-based-reasoning`, then backfill misconceptions with `themes: [substance-as-stuff]` — the orphan check in library.test.ts catches this, but ONLY if the check is actually wired.
**Why it happens:** Copy-paste typos during manual backfill of 40 entries.
**How to avoid:** The CI test (D-05) must run two assertions:
1. **Every misconception** has `themes.length >= 1`.
2. **Every theme ID referenced** by any misconception exists in `loadThemes().map(t => t.id)`.
3. **Every theme** has at least 3 constituent misconceptions (from D-04, enforce during authoring; can be a soft warning or hard fail — planner decides).
**Warning signs:** Tests pass but `/teacher/classes/{id}` renders empty ThemeClusters; orphan IDs returned from `getMisconceptionsByTheme`.

### Pitfall 6: Theme view renders, lesson plan card never expands
**What goes wrong:** `MisconceptionsTab` uses a single `expandedId: string | null` state; if `ThemesView` reuses the same pattern with theme IDs but `LessonPlanCard` also uses its own `expanded` state, clicking Generate vs clicking Expand may conflict.
**Why it happens:** Two sources of "is this card expanded" truth.
**How to avoid:** Give `LessonPlanCard` its own local `useState` for expand/collapse; the parent `ThemesView` tracks `expandedThemeId` for the drill-down panel. They're separate concerns — drill-down shows constituent misconceptions; expand-lesson-plan shows activities/prompts.
**Warning signs:** Clicking Generate collapses the drill-down; teacher confused why the card is suddenly empty.

## Code Examples

### Example 1: Theme Zod schema + library schema extension
```ts
// packages/misconceptions/src/schema.ts — EXTENDED
// Source: packages/misconceptions/src/schema.ts:1–20 [VERIFIED]

import { z } from "zod";

export const gradeBandSchema = z.enum(["K-5", "6-8", "9-12"]);

// NEW — theme registry schema
export const themeSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "Theme IDs must be kebab-case slugs"),
  name: z.string().min(1),
  naive_theory: z.string().min(10),
  description: z.string().min(20),
  citation: z.string().min(1),
});
export const themeLibrarySchema = z.array(themeSchema);
export type Theme = z.infer<typeof themeSchema>;

// EXTENDED — add themes[] (required, ≥1) and optional naive_theory override
export const misconceptionEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  grade_band: gradeBandSchema,
  description: z.string().min(10),
  citation: z.string().min(1),
  probe_questions: z.array(z.string().min(1)).min(1),
  confrontation_scenarios: z.array(z.string().min(1)).min(1),
  // NEW FIELDS:
  themes: z.array(z.string().min(1)).min(1),         // ≥1 theme (THME-01)
  naive_theory: z.string().min(1).optional(),         // per-misconception override
});

export const misconceptionLibrarySchema = z.array(misconceptionEntrySchema);
export type MisconceptionEntry = z.infer<typeof misconceptionEntrySchema>;
export type GradeBand = z.infer<typeof gradeBandSchema>;
```

### Example 2: `themes.yaml` structure (first entry as template)
```yaml
# packages/misconceptions/library/themes.yaml
- id: substance-based-reasoning
  name: "Substance-based reasoning (energy, heat, force, current as stuff)"
  naive_theory: "Abstract processes and relational quantities are treated as if they were tangible material substances that can be stored, moved, possessed, and used up."
  description: "Students reify energy, heat, force, electric current, and similar quantities into substance-like 'stuff' that flows from source to sink and gets consumed. Rooted in Chi's ontological category theory: students place these concepts in the 'matter' ontology instead of the 'process/constraint' ontology, and that mis-categorization resists ordinary instruction."
  citation: "Reiner, M., Slotta, J. D., Chi, M. T. H., & Resnick, L. B. (2000). Naive physics reasoning: A commitment to substance-based conceptions. Cognition and Instruction, 18(1), 1-34."
```

### Example 3: Print-ready lesson plan card (Tailwind v4 inline)
```tsx
// apps/web/components/dashboard/lesson-plan-card.tsx — NEW
// Note: no existing print:* utilities in app code — this is the first instance.

<Card
  className="
    print:shadow-none print:border print:border-black
    print:break-inside-avoid print:mb-4
  "
>
  <CardHeader className="print:pb-2">
    <CardTitle className="text-[18px] print:text-[14pt]">{plan.theme}</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4 print:space-y-2">
    {/* ...sections... */}
  </CardContent>
</Card>
```

### Example 4: dataHash via Web Crypto
```ts
// apps/web/actions/themes.ts — NEW
// Runs in Node runtime on Vercel — crypto.subtle is available; no import needed in Node 20+.

async function computeDataHash(
  tuples: Array<{ misconceptionId: string; studentCount: number; unresolvedCount: number }>
): Promise<string> {
  const sorted = [...tuples].sort((a, b) =>
    a.misconceptionId.localeCompare(b.misconceptionId)
  );
  const canonical = JSON.stringify(
    sorted.map((t) => [t.misconceptionId, t.studentCount, t.unresolvedCount])
  );
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

**Note:** Use `crypto.subtle` (Web Crypto) — available in Node 20+, Edge runtime, and Vercel server actions. No `node:crypto` import required, matching the edge-compatible pattern the rest of the app uses.

## Runtime State Inventory

Phase 8 is a **forward-only additive phase** — no renames, no refactors, no string replacements.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no existing rows reference themes; `theme_lesson_plans` is a new empty table | None |
| Live service config | None — no external services tracking Phase 8 entities | None |
| OS-registered state | None — no task schedulers or daemons involved | None |
| Secrets/env vars | None new — uses existing `ANTHROPIC_API_KEY` and `DATABASE_URL` | None |
| Build artifacts | None — `pnpm build` regenerates all dist; Drizzle-generated migration file is the only new artifact | Ensure migration file committed |

**Nothing found in any category.** Verified by: the phase adds files and one new table; every existing file/table remains as-is. The only state-producing action is `drizzle-kit generate` producing a new migration SQL in `packages/db/drizzle/` — this must be committed.

---

# Section A — Theme taxonomy (for plan 08-01)

## A1. Draft theme taxonomy (authoritative starting content for 08-01)

**Methodology:** I read all 40 existing misconception entries across `physics.yaml`, `biology.yaml`, `math.yaml`, `history.yaml`. I grouped them by the underlying *naive theory* cited in each entry's citation field, then consolidated into coarse cross-domain clusters of ≥3 entries each, drawing on the Vosniadou (framework theory), Chi (ontological category mis-classification), diSessa (phenomenological primitives / "p-prims"), and McCloskey (intuitive physics) traditions that are already cited in the library.

**The citations I propose below are real, not invented.** Every theme-level citation is drawn from peer-reviewed conceptual-change literature that is either (a) already cited in the existing library or (b) a direct predecessor to one of the existing citations. `[CITED]` markers point to the authority; the description and exemplar mapping are my own synthesis `[ASSUMED]` and the planner should treat them as a draft the domain-aware subagent can refine during 08-01.

### Mapping pre-analysis

Raw per-entry theme assignments (my working notes — the 08-01 subagent should verify these against the YAML entries before committing):

| Misconception | Primary theme | Secondary |
|---|---|---|
| phys-001 Heavier falls faster | `continuous-force-required-for-motion` | `weight-as-intrinsic-speed-driver` |
| phys-002 Rest = no forces | `force-requires-motion` | — |
| phys-003 Heat = temperature | `substance-based-reasoning` | — |
| phys-004 Current used up | `substance-based-reasoning` | — |
| phys-005 Seasons = distance | `egocentric-spatial-reasoning` | — |
| phys-006 No gravity in space | `binary-thresholds-not-gradients` | `egocentric-spatial-reasoning` |
| phys-007 Force needed to keep moving | `continuous-force-required-for-motion` | — |
| phys-008 Sound faster in air | `density-drives-everything` | — |
| phys-009 Atoms visible in microscope | `scale-unfamiliarity` | — |
| phys-010 Light instantaneous | `intuitive-time-and-scale` | — |
| phys-011 Cold air sinks (cold is heavy) | `substance-based-reasoning` | — |
| phys-012 Energy as fluid | `substance-based-reasoning` | — |
| bio-001 Plants eat soil | `teleological-and-anthropomorphic-reasoning` | `substance-based-reasoning` |
| bio-002 All bacteria harmful | `binary-thresholds-not-gradients` | — |
| bio-003 Humans from modern apes | `linear-progress-hierarchy` | — |
| bio-004 Blood blue in veins | `perception-equals-reality` | — |
| bio-005 Organisms try to adapt | `teleological-and-anthropomorphic-reasoning` | — |
| bio-006 Brain-only thinking | `container-model-of-the-body` | — |
| bio-007 Cells uninteresting | `scale-unfamiliarity` | — |
| bio-008 Photosynthesis/respiration cancel | `binary-thresholds-not-gradients` | — |
| bio-009 Vaccines cause disease | `category-confusion-cause-vs-effect` | — |
| bio-010 Larger = more evolved | `linear-progress-hierarchy` | — |
| math-001 Multiplication bigger | `whole-number-overgeneralization` | — |
| math-002 Division smaller | `whole-number-overgeneralization` | — |
| math-003 Square ≠ rectangle | `category-confusion-cause-vs-effect` | — |
| math-004 Bigger denom = bigger fraction | `whole-number-overgeneralization` | — |
| math-005 = means "answer here" | `operational-vs-relational-reasoning` | — |
| math-006 Negatives not real | `perception-equals-reality` | — |
| math-007 Probability in small samples | `intuitive-time-and-scale` | — |
| math-008 Zero not a number | `category-confusion-cause-vs-effect` | — |
| math-009 No sqrt of negatives | `operational-vs-relational-reasoning` | — |
| math-010 Graphs = pictures | `perception-equals-reality` | — |
| hist-001 Columbus proved round Earth | `presentism-and-single-cause-narratives` | — |
| hist-002 Medieval flat Earth | `presentism-and-single-cause-narratives` | — |
| hist-003 Declaration freed slaves | `presentism-and-single-cause-narratives` | `category-confusion-cause-vs-effect` |
| hist-004 Revolution only about taxes | `presentism-and-single-cause-narratives` | — |
| hist-005 Pyramids built by slaves | `presentism-and-single-cause-narratives` | — |
| hist-006 History = dates | `operational-vs-relational-reasoning` | — |
| hist-007 Civil War = states' rights | `presentism-and-single-cause-narratives` | — |
| hist-008 Tech progress linear/good | `linear-progress-hierarchy` | — |

### The 10 proposed themes

> Format matches the D-02 schema: `{id, name, naive_theory, description, citation}`. The planner's 08-01 subagent should consolidate/merge/rename as they see fit — the important property is that every misconception maps to ≥1 theme and every theme has ≥3 constituent misconceptions (D-04).

**1. `substance-based-reasoning`** (5 entries, all cross-domain)
- name: "Substance-based reasoning (energy, heat, force, current as stuff)"
- naive_theory: "Abstract processes and relational quantities are treated as if they were tangible material substances that can be stored, moved, possessed, and used up."
- description: "Students reify energy, heat, electric current, and other process quantities into substance-like 'stuff' that flows from source to sink and gets consumed. Rooted in Chi's ontological category theory: students place these concepts in the 'matter' ontology instead of the 'process/constraint' ontology, and the mis-categorization resists ordinary instruction."
- citation: "Reiner, M., Slotta, J. D., Chi, M. T. H., & Resnick, L. B. (2000). Naive physics reasoning: A commitment to substance-based conceptions. Cognition and Instruction, 18(1), 1-34." `[CITED: already in phys-010]`
- Constituents: phys-003, phys-004, phys-011, phys-012, bio-001 (secondary)
- Count: 5 (4 primary + 1 secondary). **Meets D-04 minimum.**

**2. `continuous-force-required-for-motion`** (3 entries, physics-heavy)
- name: "Force is required to maintain motion"
- naive_theory: "Moving objects need a continuous force to keep moving; in the absence of force, motion decays. Also: heavier objects inherently 'want' to move faster."
- description: "The Aristotelian / medieval impetus-theory intuition that motion requires a cause, contradicting Newton's first law. McCloskey showed this is the single most robust pre-Newtonian belief in adolescent physics learners."
- citation: "McCloskey, M. (1983). Intuitive physics. Scientific American, 248(4), 122-130." `[CITED: already in phys-007]`
- Constituents: phys-001, phys-002, phys-007
- Count: 3. **Meets D-04 minimum.**

**3. `teleological-and-anthropomorphic-reasoning`** (3 entries, biology-heavy)
- name: "Teleological and anthropomorphic reasoning about living things"
- naive_theory: "Organisms, cells, and even ecosystems have goals, desires, and the ability to 'try' to achieve them; biological change is directed by need."
- description: "Students explain biological processes in terms of purpose ('the giraffe needed a longer neck'), conflating the outcome of natural selection with intention. Kelemen's developmental work shows this is the default intuitive biology of K-12 learners."
- citation: "Kelemen, D. (1999). Why are rocks pointy? Children's preference for teleological explanations of the natural world. Developmental Psychology, 35(6), 1440-1452." `[CITED: direct successor to the Settlage citation in bio-005]`
- Constituents: bio-001, bio-005, bio-009 (secondary-to-`category-confusion-cause-vs-effect`)
- Count: 3 (with one boundary case). **Meets D-04 minimum.** If bio-009 is pulled out, consider merging this theme with a broader "intuitive agency" theme.

**4. `whole-number-overgeneralization`** (3 entries, math)
- name: "Whole-number intuitions overgeneralized to fractions, decimals, and signed numbers"
- naive_theory: "The rules learned for natural numbers are assumed to hold for every number — 'more' digits means 'larger', multiplication always grows, division always shrinks."
- description: "A classic framework-theory effect: students build a coherent intuitive mathematics of counting numbers, then apply it inappropriately when the number system expands. Stafylidou & Vosniadou document this across fractions; Vamvakoussi & Vosniadou extend it to rational numbers broadly."
- citation: "Vamvakoussi, X., & Vosniadou, S. (2004). Understanding the structure of the set of rational numbers: A conceptual change approach. Learning and Instruction, 14(5), 453-467." `[CITED: direct successor to the Stafylidou citation in math-004]`
- Constituents: math-001, math-002, math-004
- Count: 3. **Meets D-04 minimum.**

**5. `presentism-and-single-cause-narratives`** (6 entries, history)
- name: "Presentism and single-cause historical narratives"
- naive_theory: "The past is understood through present-day assumptions; historical events have one simple cause, usually the one named in the textbook."
- description: "Wineburg's 'historical thinking' framework identifies this as the single most persistent obstacle to history learning: students project present values backward, flatten complex causation into heroic narratives, and treat textbook summaries as complete truth. It is the history-domain counterpart to Vosniadou's framework theory in science."
- citation: "Wineburg, S. (2001). Historical Thinking and Other Unnatural Acts: Charting the Future of Teaching the Past. Temple University Press." `[CITED: already in hist-003]`
- Constituents: hist-001, hist-002, hist-003, hist-004, hist-005, hist-007
- Count: 6. **Most populated theme.**

**6. `linear-progress-hierarchy`** (3 entries, cross-domain)
- name: "Linear progress hierarchy (bigger/newer/more complex = better)"
- naive_theory: "Processes of change are monotonic and ordered on a single 'progress' axis — evolution produces ever-more-advanced beings, technology produces ever-better lives, history proceeds from worse to better."
- description: "Gould's 'Full House' framed this for biology; Winner extended it to technology; it is one expression of a general developmental bias toward essentializing complex systems on a single dimension."
- citation: "Gould, S. J. (1996). Full House: The Spread of Excellence from Plato to Darwin. Harmony Books." `[CITED: already in bio-010]`
- Constituents: bio-003, bio-010, hist-008
- Count: 3. **Meets D-04 minimum.**

**7. `perception-equals-reality`** (3 entries, cross-domain)
- name: "Perception-equals-reality (what I see must be what is)"
- naive_theory: "If something looks a certain way, that appearance is a direct report of the underlying reality; abstract representations and counterintuitive numbers aren't 'real'."
- description: "A diSessa-style phenomenological primitive: immediate sensory experience is privileged over formal reasoning. Manifests in biology (blue-looking veins = blue blood), math (negatives aren't 'real' quantities; graphs are literal pictures), and elsewhere."
- citation: "diSessa, A. A. (1993). Toward an epistemology of physics. Cognition and Instruction, 10(2-3), 105-225." `[CITED: foundational p-prims paper; same tradition as McCloskey citation]`
- Constituents: bio-004, math-006, math-010
- Count: 3. **Meets D-04 minimum.**

**8. `category-confusion-cause-vs-effect`** (3 entries, cross-domain)
- name: "Category confusion and cause/effect conflation"
- naive_theory: "Categories are mutually exclusive (a thing can only belong to one), and when two things co-occur, one must cause the other."
- description: "Two tightly related Chi-style ontological errors: (1) treating hierarchical category membership as exclusive (a square can't also be a rectangle; zero isn't a number), and (2) conflating correlation with causation in multi-step processes (vaccines 'cause' the disease because their side-effects resemble symptoms)."
- citation: "Chi, M. T. H. (2008). Three types of conceptual change: Belief revision, mental model transformation, and categorical shift. In S. Vosniadou (Ed.), International Handbook of Research on Conceptual Change (pp. 61-82). Routledge." `[CITED: foundational Chi paper on ontological category change]`
- Constituents: bio-009, math-003, math-008
- Count: 3. **Meets D-04 minimum.**

**9. `intuitive-time-and-scale`** (3 entries, cross-domain)
- name: "Intuitive (mis)calibration of time, scale, and probability"
- naive_theory: "Very large, very small, or very rare quantities are flattened to the scale of everyday experience — light is 'instant' because it seems instant; 50% probability should mean '5 out of 10'; atomic scales and cosmic scales blur into 'small' and 'big'."
- description: "Captures the Kahneman/Tversky representativeness heuristic and its counterparts in science learning. Students lack calibrated mental models for scales outside direct experience."
- citation: "Kahneman, D., & Tversky, A. (1972). Subjective probability: A judgment of representativeness. Cognitive Psychology, 3(3), 430-454." `[CITED: already in math-007]`
- Constituents: phys-009, phys-010, math-007
- Count: 3. **Meets D-04 minimum.** (`scale-unfamiliarity` and `egocentric-spatial-reasoning` in my working notes were consolidated into this theme; the 08-01 subagent may choose to split them.)

**10. `operational-vs-relational-reasoning`** (3 entries, cross-domain)
- name: "Operational (compute-the-answer) vs relational (see-the-structure) reasoning"
- naive_theory: "Mathematics and disciplined knowledge are about executing procedures and memorizing facts, not about the relationships and structures those procedures express."
- description: "Knuth et al. document this for the equals sign; Sfard generalizes it as the process/object duality in mathematics learning; Seixas et al. extend it to history as 'memorizing dates' vs historical thinking. A single cognitive disposition with cross-disciplinary expression."
- citation: "Sfard, A. (1991). On the dual nature of mathematical conceptions: Reflections on processes and objects as different sides of the same coin. Educational Studies in Mathematics, 22(1), 1-36." `[CITED: already in math-009]`
- Constituents: math-005, math-009, hist-006
- Count: 3. **Meets D-04 minimum.**

### Coverage verification

- **Total themes:** 10 (within the ~8–12 target of D-04)
- **Total misconceptions covered:** 40 (all 40 existing entries have ≥1 theme in the primary mapping above)
- **Theme size distribution:** 3, 3, 3, 3, 3, 3, 3, 3, 5, 6 — every theme meets the ≥3 constituent rule
- **Cross-domain coverage:** Themes 1, 6, 7, 8, 9 span ≥2 domains; theme 10 spans math+history; themes 2 and 3 are domain-concentrated (physics, biology respectively), reflecting the real distribution of the library
- **Physics lumpiness (design risk from the approved plan):** Themes 1 and 2 are physics-heavy (4 physics entries in theme 1; all 3 in theme 2). This matches the domain distribution — no mitigation needed unless the teacher demo class skews heavily non-physics.

**Draft confidence:** HIGH for the underlying citations (every theme citation is either already in the library or a direct successor to an existing citation from the same author/tradition). MEDIUM for the specific groupings — the 08-01 subagent should validate each assignment against the misconception's full description before committing.

## A2. `themes.yaml` schema shape

The record shape locked by D-02 is `{id, name, naive_theory, description, citation}`. The full schema:

```yaml
# packages/misconceptions/library/themes.yaml
- id: substance-based-reasoning              # kebab-case slug, matches /^[a-z0-9-]+$/
  name: "Substance-based reasoning"          # human-readable short label
  naive_theory: "Abstract processes..."      # one-sentence naive theory (≥10 chars)
  description: "Students reify..."           # 2-3 sentence expanded explanation (≥20 chars)
  citation: "Reiner, M., Slotta, ..."        # full APA-style citation with DOI or journal
```

**Zod schema (matches Example 1 above):**
```ts
export const themeSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "Theme IDs must be kebab-case slugs"),
  name: z.string().min(1),
  naive_theory: z.string().min(10),
  description: z.string().min(20),
  citation: z.string().min(1),
});
```

**Consistency rules enforced by the schema:**
- ID is a kebab-case slug so it's safe as a URL param and a map key.
- `naive_theory` has a minimum length so the CI check catches empty placeholders.
- `description` is longer than `naive_theory` — the rule "description ≥ 20 chars" distinguishes the two fields and surfaces copy-paste errors.

---

# Section B — LLM prompt structure (for plan 08-03)

## B3. AI SDK API shape currently used in this repo

**Verified grep (`grep -rE 'generateObject|Output\.object|experimental_output' packages/llm/src`):**

| File | Call shape |
|---|---|
| `packages/llm/src/prompts/extract.ts:56` | `generateText({ model, prompt, experimental_output: Output.object({ schema: conceptExtractionSchema }) })` → reads `experimental_output.concepts` |
| `packages/llm/src/prompts/disambiguate.ts:76` | `generateText({ model, prompt, experimental_output: Output.object({ schema: disambiguateSchema }) })` → reads `experimental_output.match`, `.matchIndex` |
| `packages/llm/src/prompts/diagnose-resolve.ts:47` | `generateText({ model, prompt, experimental_output: Output.object({ schema: resolutionSchema }) })` → reads `experimental_output` (full object) |

**Grep for `generateObject`:** ZERO hits. `[VERIFIED: grep across packages/llm/src]`

**AI SDK version:** `ai` at `^6.0.154`, `@ai-sdk/anthropic` at `^3.0.68`. `[VERIFIED: packages/llm/package.json:18–19]`

**Load-bearing implication for 08-03:** Every new prompt file in 08-03 MUST use the `generateText + experimental_output: Output.object({ schema })` pattern. Do not import `generateObject`. The plan's acceptance criteria should explicitly call out this pattern match.

**Adapter pattern:** `createLLMAdapter()` from `../adapters/factory` is the canonical entry point. It returns an object with `.getModel()` that yields the language-model instance passed to `generateText`. Never construct a provider inline. `[VERIFIED: all four prompt files]`

## B4. Anti-hallucination techniques for educational content in a single `generateObject`-style call

The single load-bearing risk from the approved plan's Design Risks section is: *"Structured Zod output guarantees shape, not content. A bad prompt yields coherent-looking but pedagogically empty scaffolds, which kills teacher trust on first read."*

Practical techniques that fit inside a single `generateText + Output.object` call (no multi-agent orchestration):

### Technique 1: Reference-anchored prompting (HIGH effectiveness)
Paste the actual research-cited misconception entries (including `name`, `description`, `confrontation_scenarios`) into the prompt as the ground truth the LLM MUST reference. The LLM is told: *"Your suggested activities and discussion prompts MUST directly address at least one of the confrontation scenarios listed below. Do not invent new scenarios."* This anchors generation to content the library team has already vetted.

**Already used in the repo:** `diagnose-confront.ts:36` passes a `confrontationSeed` into the prompt with *"Use this real-world scenario as your seed — adapt its wording..."* — same technique. `[VERIFIED]`

### Technique 2: Few-shot in-prompt examples (MEDIUM-HIGH effectiveness)
The `extract.ts` prompt includes two inline `<example>` blocks showing a "Good:" and "Bad:" extraction. `[VERIFIED: extract.ts:28–39]` For `generate-lesson-plan.ts`, include one worked example showing a theme + its misconceptions → a well-formed LessonPlan object. Makes the output shape and pedagogical depth concrete.

### Technique 3: Explicit "not allowed" negative rules (MEDIUM effectiveness)
The repo's diagnostic prompts use strong negative rules like *"Never use the words 'misconception', 'wrong', 'incorrect', 'actually', or 'in fact'"* `[VERIFIED: diagnose-probe.ts:36–43]`. Apply the same technique to the lesson plan prompt: *"Activities MUST NOT be vague ('have a discussion', 'use an analogy'); every activity must name a specific artifact, demonstration, or experiment."*

### Technique 4: Zod schema with min-length constraints (HIGH effectiveness for shape)
Zod `.min(1)` on arrays and `.min(30)` on strings forces the LLM to produce substantive content. Schema:
```ts
const activityItem = z.object({
  title: z.string().min(5),
  description: z.string().min(40),                    // forces non-trivial content
  referencedMisconceptionIds: z.array(z.string()).min(1),  // forces citation back to library
});
const lessonPlanSchema = z.object({
  theme: z.string(),
  commonMisunderstanding: z.string().min(40),
  targetUnderstanding: z.string().min(40),
  suggestedActivities: z.array(activityItem).min(2).max(5),
  discussionPrompts: z.array(z.string().min(20)).min(2).max(5),
  confrontationApproaches: z.array(z.string().min(30)).min(1).max(3),
});
```
The `referencedMisconceptionIds` field is the critical anti-hallucination gate: it forces the LLM to ground every activity in an actual library entry ID, and the 08-03 fixture test can then assert the referenced IDs are a subset of the input `constituentMisconceptions` (D-15 mandates this test).

### Technique 5: Temperature and structured constraints (MEDIUM effectiveness)
`generateText` accepts `temperature` — the repo's existing prompts don't set this explicitly (defaults to provider default). For the lesson plan prompt, consider `temperature: 0.3` to reduce creative but pedagogically empty variance. The planner should make this an explicit (though discretionary) choice in 08-03 rather than inheriting the default.

### What NOT to do in a single-call context:
- Multi-agent chains (LangGraph, LangChain agents) — scope creep, new deps, violates the approved stack.
- Post-generation refinement loops — adds latency and doubles token cost for marginal quality gains.
- Self-critique prompts — often degrade output quality in practice; not worth the complexity in a capstone.

## B5. PRIV-01 pattern audit of existing `diagnose-*.ts` prompts

**Inputs to each existing diagnostic prompt function — verified by reading each file directly:**

| File | Function params | Student identifiers present? |
|---|---|---|
| `diagnose-probe.ts` | `probeQuestion: string`, `gradeLevel: number`, `originalQuestion: string` | **NONE.** `gradeLevel` is an integer; `probeQuestion` comes from the library; `originalQuestion` is the student's own words verbatim (not PII per the explicit PRIV-01 comment at line 16–18). `[VERIFIED]` |
| `diagnose-confront.ts` | `misconceptionName: string`, `studentProbeResponse: string`, `confrontationSeed: string`, `gradeLevel: number` | **NONE.** The `studentProbeResponse` is again the student's own words, explicitly commented as "not PII" at line 17. `[VERIFIED]` |
| `diagnose-resolve.ts::evaluateResolution` | `misconceptionName: string`, `probeResponse: string`, `confrontationUsed: string`, `studentFinalResponse: string` | **NONE.** Same pattern — student utterances are allowed; identifiers are not. `[VERIFIED]` |

**The mechanism by which PII leakage is prevented is structural, not incidental:**

1. **Function signatures accept only primitives and enums, never session objects or user records.** The server-action caller must destructure the necessary scalar fields *before* calling the prompt function. The prompt function has no way to "reach into" an enrollment or user record because none is passed.
2. **`gradeLevel: number`** is the coarsest possible student attribute — it maps to a `GradeBand` enum inside the function via `getGradeBand()`. No ages, no birthdates, no names.
3. **Student utterances are treated as allowed inputs** (explicitly noted in the PRIV-01 comments at `diagnose-probe.ts:17–18` and `diagnose-confront.ts:17`). The argument is: the student's own words are not "student PII" in the sense PRIV-01 protects against — PRIV-01 targets name/email/studentId/userId.
4. **Every prompt file has an explicit PRIV-01 comment block at the top of the function docblock,** stating which inputs are allowed and why. This is the pattern 08-03 must follow.

**Exact pattern 08-03 must enforce:**

```ts
// packages/llm/src/prompts/analyze-student-themes.ts — NEW
// Source of pattern: packages/llm/src/prompts/diagnose-probe.ts:15–23

/**
 * PRIV-01 compliance: This function's signature accepts only anonymized aggregate counts,
 * library IDs (theme slugs + misconception IDs from the static YAML library), session
 * outcome enums, and a grade band. It MUST NOT accept a userId, studentId, name, email,
 * enrollment record, session record, or any other object containing student identifiers.
 *
 * Student identity binding (e.g., "Lila shows substance-based reasoning") happens in the
 * CALLING component layer AFTER this function returns, by correlating returned theme IDs
 * against a parallel data structure the caller already holds.
 */
export async function analyzeStudentThemes(params: {
  gradeBand: "K-5" | "6-8" | "9-12";
  themeCounts: Record<string, number>;                             // themeId -> count
  misconceptionIds: string[];                                      // library IDs only
  sessionOutcomes: Array<"resolved" | "unresolved" | "incomplete">;
}): Promise<{
  dominantThemes: string[];
  narrative: string;
  supportingMisconceptionIds: string[];
}> { /* ... */ }
```

**Audit targets for verification step 5 of the approved plan:**

```bash
# Must return ZERO hits after 08-03 and 08-04 complete:
grep -nE '\b(email|name|studentId|userId|enrollment|user\.|student\.)' \
  packages/llm/src/prompts/analyze-student-themes.ts \
  packages/llm/src/prompts/generate-lesson-plan.ts

# Must return ZERO hits in the server actions calling these prompts:
grep -nE '\b(email|name)' apps/web/actions/themes.ts  # getThemeDetail, getStudentThemeProfile, getOrGenerateLessonPlan
```

The planner should include this exact grep in the 08-03 and 08-04 verification checklists.

---

# Section C — Drizzle cache table (for plan 08-04)

## C6. Drizzle v0.45 idioms for a jsonb cache table with composite uniqueness

**Verified against:** `packages/db/src/schema/diagnostic-sessions.ts`, `packages/db/src/schema/questions.ts`, `packages/db/src/schema/classes.ts`, drizzle-orm `^0.45.2`.

### Idiom 1: `pgTable` with options via second-argument callback

```ts
export const themeLessonPlans = pgTable("theme_lesson_plans", { /*columns*/ }, (t) => [
  /* indexes, unique constraints — as array */
]);
```
`[VERIFIED: diagnostic-sessions.ts:57; questions.ts:26,51,79]`

### Idiom 2: `text` primary key with UUID `$defaultFn`

```ts
id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
```
`[VERIFIED: every table in packages/db/src/schema/*.ts]`

### Idiom 3: Foreign key with `onDelete: "cascade"`

```ts
classId: text("class_id")
  .notNull()
  .references(() => classes.id, { onDelete: "cascade" }),
```
`[VERIFIED: classes.ts:16; diagnostic-sessions.ts:33–36]`

**CRITICAL:** Do NOT add an FK to a theme ID. Themes live in YAML, not in a theme table — there is no referential integrity target. Add the theme as a plain `text("theme_id").notNull()` column. Integrity is enforced by the YAML loader + CI orphan check.

### Idiom 4: `jsonb` with typed `$type<T>()`

```ts
lessonPlan: jsonb("lesson_plan").$type<LessonPlan>().notNull(),
```
`[VERIFIED: diagnostic-sessions.ts:49–53]` — note the ESLint-disable comment in the existing file points to the jsonb array default bug; avoid `.default(...)` on jsonb columns entirely.

### Idiom 5: `timestamp` with timezone + `defaultNow`

```ts
generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
```
`[VERIFIED: every table in packages/db/src/schema/*.ts]`

### Idiom 6: Composite unique index via `uniqueIndex(...).on(...)`

Two equivalent forms exist in the codebase:
1. **Unique constraint** (questions.ts:81): `unique().on(t.sourceConceptId, t.targetConceptId, t.edgeType)`
2. **Unique index** (preferred for cache tables because it also creates a lookup index): `uniqueIndex("name").on(t.a, t.b, t.c)`

For `theme_lesson_plans` use a named `uniqueIndex` — it simultaneously enforces uniqueness and provides the lookup index needed by the cache-hit path.

### Complete skeleton for `packages/db/src/schema/theme-lesson-plans.ts`:

```ts
// Source: packages/db/src/schema/diagnostic-sessions.ts [VERIFIED pattern]
// Source: packages/db/src/schema/questions.ts [VERIFIED composite index pattern]

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { classes } from "./classes";

// Mirror of the Zod schema from packages/llm/src/prompts/generate-lesson-plan.ts
// Imported via type-only import or duplicated inline — the Zod schema remains the
// runtime-validation source of truth; this type is just for the jsonb $type<T>() generic.
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

export const themeLessonPlans = pgTable(
  "theme_lesson_plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    // theme slug from themes.yaml — NOT an FK (YAML is the source of truth)
    themeId: text("theme_id").notNull(),
    // sha256 hex of sorted (misconceptionId, studentCount, unresolvedCount) tuples
    dataHash: text("data_hash").notNull(),
    lessonPlan: jsonb("lesson_plan").$type<LessonPlan>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    // composite uniqueness: same class + same theme + same input fingerprint
    // = exactly one row (cache hit). Different fingerprint = new row (D-18 preserves history).
    uniqueIndex("theme_lesson_plans_class_theme_hash_idx").on(
      t.classId,
      t.themeId,
      t.dataHash
    ),
    // secondary lookup index for "latest plan for this class+theme" queries
    index("theme_lesson_plans_class_theme_idx").on(t.classId, t.themeId),
  ]
);
```

**Re-export in `packages/db/src/schema/index.ts`:**
```ts
export * from "./theme-lesson-plans";
```

**Migration:** Run `pnpm --filter @mindmap/db db:generate` to produce the SQL migration file in `packages/db/drizzle/`, then commit that file. No user-facing table is modified.

## C7. `dataHash` computation in TypeScript (Node + Edge runtime)

**Recommended approach: Web Crypto `crypto.subtle.digest('SHA-256', ...)`**

Rationale:
- **Edge-runtime safe** — no `node:crypto` import required. Works in Vercel server actions, API routes, and Node 20+.
- **Stable** — SHA-256 is deterministic.
- **Already used in the Node runtime via the global `crypto` object** (Node 18+) — no import statement needed.

**Canonical serialization rules:**

1. **Sort the tuple array by `misconceptionId`** (using `localeCompare`) before serializing. This makes the hash invariant under input order.
2. **Serialize each tuple as a 3-element array**, not an object — eliminates JSON object-key-order concerns entirely.
3. **Encode to UTF-8 bytes** via `TextEncoder`.
4. **Hex-encode the digest** — human-debuggable and URL-safe.

**Implementation (exact code for 08-04):**

```ts
// apps/web/actions/themes.ts — shared helper

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeDataHash(
  tuples: Array<{
    misconceptionId: string;
    studentCount: number;
    unresolvedCount: number;
  }>
): Promise<string> {
  const sorted = [...tuples].sort((a, b) =>
    a.misconceptionId.localeCompare(b.misconceptionId)
  );
  // Array-of-arrays eliminates JSON key-order ambiguity
  const canonical = JSON.stringify(
    sorted.map((t) => [t.misconceptionId, t.studentCount, t.unresolvedCount])
  );
  return sha256Hex(canonical);
}
```

**Why not `node:crypto`?** Vercel edge runtime and Next.js server actions prefer Web Crypto. The existing `packages/db` uses `@neondatabase/serverless` which is edge-compatible; keeping cryptographic ops on Web Crypto maintains that compatibility even if the `themes.ts` server action is ever moved to an edge runtime.

**Why not a third-party hash library?** No new deps needed. Web Crypto is a standards-based API built into the runtime.

**Cache-lookup semantics (D-18):**
```ts
export async function getOrGenerateLessonPlan(
  classId: string,
  themeId: string,
  opts: { forceRegenerate?: boolean } = {}
): Promise<LessonPlan> {
  // 1. Compute current fingerprint
  const tuples = await getThemeFingerprint(classId, themeId);
  const dataHash = await computeDataHash(tuples);

  // 2. If NOT forcing regeneration, try cache hit
  if (!opts.forceRegenerate) {
    const cached = await db.query.themeLessonPlans.findFirst({
      where: and(
        eq(themeLessonPlans.classId, classId),
        eq(themeLessonPlans.themeId, themeId),
        eq(themeLessonPlans.dataHash, dataHash)
      ),
    });
    if (cached) return cached.lessonPlan;
  }

  // 3. Cache miss (or forced) — generate and INSERT a new row (D-18: new row, not update)
  const fresh = await generateLessonPlan({ /* anonymized params */ });
  await db.insert(themeLessonPlans).values({
    classId,
    themeId,
    dataHash,
    lessonPlan: fresh,
  });
  return fresh;
}
```

---

# Section D — Dashboard aggregation (for plan 08-02)

## D8. Structure of `getClassDashboardData` (line-annotated)

**File:** `apps/web/actions/dashboard.ts`
**Reading:** Full file, 395 lines. `[VERIFIED]`

### Query structure (5 database queries, no N+1)

| # | Line | Query | Purpose |
|---|---|---|---|
| 1 | 70–76 | `db.query.classes.findFirst` | Auth: verify teacher owns this class |
| 2 | 79–91 | enrollments JOIN users | Get roster with names/emails/grade level |
| 3 | 128–138 | concepts `inArray(userId, studentIds)` | Batch-fetch all students' concepts |
| 4 | 161–176 | conceptEdges `or(inArray(source), inArray(target))` | Batch-fetch all edges |
| 5 | 185–192 | questions `inArray(userId, studentIds)` ORDER BY createdAt DESC | Batch-fetch all questions for streaks/history |
| 6 | 301–312 | diagnosticSessions `inArray(userId, studentIds)` | Batch-fetch all diagnostic sessions |

Six queries total, not five. The "5-query" count in CONTEXT.md is an approximation; 08-02 does not add a 7th query — it reuses query 6.

### JS-side aggregation (existing misconception cluster logic)

**Lines 300–364:** The existing misconception aggregation is a single `for` loop building a `Map<misconceptionId, { misconceptionName, affectedUserIds: Set, resolvedUserIds: Set }>`. Then a `.map()` converts it to `MisconceptionCluster[]`.

**Exact extension point for theme aggregation (08-02):**

The theme aggregation should run **after** the `misconceptionClusters` array is built (line 364) but **before** the `// ── 10. Totals ──` comment (line 366). Reason: the totals section already uses `misconceptionClusters`, so placing theme aggregation between them keeps the two aggregations independent and allows themeClusters to be added to `totals` as well if desired.

### Return type shape (existing)

From `lib/dashboard-types.ts` (inferred from the return statement at lines 377–393):

```ts
type ClassDashboardData = {
  classInfo: { id, name, joinCode, gradeLevel };
  students: StudentSummary[];
  conceptHeatmap: ConceptHeatmapEntry[];
  misconceptionClusters: MisconceptionCluster[];
  totals: { totalStudents, totalQuestions, activeMisconceptions, avgBreadthScore };
};
```

**Extension for 08-02:** Add one field.
```ts
type ClassDashboardData = {
  classInfo: { id, name, joinCode, gradeLevel };
  students: StudentSummary[];
  conceptHeatmap: ConceptHeatmapEntry[];
  misconceptionClusters: MisconceptionCluster[];
  themeClusters: ThemeCluster[];               // NEW
  totals: { totalStudents, totalQuestions, activeMisconceptions, avgBreadthScore };
};

type ThemeCluster = {
  themeId: string;
  themeName: string;
  naiveTheory: string;
  studentsAffected: number;
  resolvedCount: number;
  unresolvedCount: number;
  constituentMisconceptionIds: string[];      // for drill-down
};
```

**Existing auth/ownership check (lines 70–76) covers the new aggregation** — no additional auth step needed. `getThemeDetail` and `getStudentThemeProfile` server actions must repeat the same check pattern.

## D9. JS-side join feasibility for a 20-student class

**Analysis:**

- **Worst-case scale:** 20 students × ~10 misconceptions per student × average 1.5 themes per misconception = ~300 theme-membership hits in the inner loop.
- **Data already in memory:** `allSessions` (query 6) and the library loader (module-cached after first call) are both already in process memory. No additional IO.
- **Map operations:** ~300 `.set()` / `.add()` calls on `Set` + `Map`. O(n) where n ≈ 300. Negligible on a modern Node runtime — single-digit milliseconds at most.
- **Memory:** Each ThemeCluster holds 3 Sets; 10 themes × ~20 entries per Set × ~40 bytes per UUID ≈ 24 KB peak. Trivial.

**Verdict:** Feasible with no memory or performance concerns. D-07's "JS-side join" decision is sound. The planner should not introduce a second DB query for theme aggregation.

**Edge case to flag:** The CI seed data has 20 students + 40+ misconception entries, but real classrooms could be 30+ students. Even at 50 students × 15 sessions × 2 themes = 1,500 inner iterations, the aggregation is still O(ms). No mitigation needed for v1.

---

# Section E — UI integration (for plan 08-04)

## E10. Structure of `misconceptions-tab.tsx`

**File:** `apps/web/components/dashboard/misconceptions-tab.tsx`, 110 lines. `[VERIFIED]`

### Current structure

```tsx
'use client';

interface MisconceptionsTabProps { clusters: MisconceptionCluster[]; }

export function MisconceptionsTab({ clusters }: MisconceptionsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (clusters.length === 0) return <EmptyState />;

  const sorted = [...clusters].sort((a, b) => b.unresolvedCount - a.unresolvedCount);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sorted.map((cluster) => { /* Card with stats + progress bar + drill-down toggle */ })}
    </div>
  );
}
```

**Props shape:** Single prop `clusters: MisconceptionCluster[]`.

**Sort logic:** Descending by `unresolvedCount`.

**Card expansion pattern:** Single parent-level `expandedId: string | null` tracking which card's drill-down is open. Clicking the toggle button on a card sets it to that card's id or `null` (toggle).

**CSS classes:**
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Card via shadcn/ui `<Card>`, `<CardHeader>`, `<CardContent>`, `<CardTitle>`
- Tailwind utility colors: `text-[#52525b]`, `text-[#0d9488]` (teal success), `text-[#f97316]` (orange alert), `bg-[#f4f4f5]` (muted background)
- Progress bar: `h-2 w-full bg-[#f4f4f5] rounded-full overflow-hidden` with inner `bg-[#0d9488]`
- Text sizes: `text-[14px]`, `text-[13px]`, `text-[12px]`, `text-[16px]` — pixel-exact, NOT Tailwind's default `text-sm`/`text-base`
- Drill-down toggle: plain `<button>` with `text-[13px] text-[#0d9488] hover:underline`

### Extension pattern for 08-04 (D-20: view-mode pill toggle)

Do **not** replace the component; wrap it with a view-mode switch:

```tsx
// apps/web/components/dashboard/misconceptions-tab.tsx — EXTENDED

interface MisconceptionsTabProps {
  clusters: MisconceptionCluster[];
  themeClusters: ThemeCluster[];                   // NEW — passed from dashboard page
  classId: string;                                 // NEW — needed by theme view for lesson plan generation
}

type ViewMode = "misconception" | "theme";

export function MisconceptionsTab({ clusters, themeClusters, classId }: MisconceptionsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("misconception");

  return (
    <div>
      {/* Pill toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode("misconception")}
          className={cn(
            "px-3 py-1 rounded-full text-[13px]",
            viewMode === "misconception"
              ? "bg-[#0d9488] text-white"
              : "bg-[#f4f4f5] text-[#52525b]"
          )}
        >
          By Misconception
        </button>
        <button
          onClick={() => setViewMode("theme")}
          className={cn(
            "px-3 py-1 rounded-full text-[13px]",
            viewMode === "theme"
              ? "bg-[#0d9488] text-white"
              : "bg-[#f4f4f5] text-[#52525b]"
          )}
        >
          By Root Theme
        </button>
      </div>

      {viewMode === "misconception" ? (
        <MisconceptionCardGrid clusters={clusters} />       // existing logic extracted into child
      ) : (
        <ThemesView themes={themeClusters} classId={classId} />   // NEW component
      )}
    </div>
  );
}
```

**Why this shape:** Keeps the existing MisconceptionCardGrid logic untouched (extract into a child function or sub-component), so the old tests and visual behavior are preserved byte-for-byte. The toggle is a thin wrapper.

**ThemesView mirrors MisconceptionCardGrid's pattern:**
- Same grid CSS (`grid grid-cols-1 md:grid-cols-2 gap-4`)
- Same card component set (`<Card>`, `<CardHeader>`, `<CardContent>`)
- Sort by `studentsAffected` descending, then by `unresolvedCount` descending
- Drill-down via `useState<string | null>` for expandedThemeId
- LessonPlanCard has its **own** `useState` for expanded state (see Pitfall 6)

## E11. Existing `print:*` Tailwind utilities in `apps/web`

**Grep result (`rg "print:" apps/web --type tsx --type ts`):**

| File | Matches |
|---|---|
| `apps/web/.next/server/vendor-chunks/jose@6.2.2.js` | Compiled vendor code, not app source |
| `apps/web/.next/server/middleware.js` | Compiled output, not app source |

**App-source matches: ZERO.** `[VERIFIED]`

**Conclusion:** Phase 8's `LessonPlanCard` is the **first** user of Tailwind v4 `print:*` utilities in this project. This is new territory.

**Implications for the planner:**

1. **No "existing pattern" to copy.** The planner must treat print CSS as a greenfield concern and specify the exact utilities `LessonPlanCard` should use.
2. **Tailwind v4 `print:*` variants are stable and supported.** `print:` is a standard responsive variant in Tailwind v4 and is part of the default build — no config changes required.
3. **Minimum useful print utilities for a lesson plan card:**
   - `print:shadow-none` — remove dropshadow
   - `print:border` + `print:border-black` — ensure a visible border in grayscale
   - `print:break-inside-avoid` — keep the card on one printed page
   - `print:mb-4` — spacing between multiple printed cards
   - `print:text-[14pt]` — switch from pixel sizes to point sizes for print
   - `print:bg-white` — ensure white background regardless of theme
4. **Manual verification required.** Since no existing `print:*` utilities exist, the planner must include a verification step: "Open the lesson plan card in the browser, press Cmd+P, verify the print preview is legible." This cannot be automated in Vitest; it's a human check.
5. **No `@media print` in global CSS required.** Tailwind v4 emits the `@media print` rules automatically for `print:*` variants; no `globals.css` edit is needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.3` `[VERIFIED: packages/llm/package.json]` |
| Config file | `packages/llm/vitest.config.ts` (existing) and `packages/misconceptions/vitest.config.ts` (existing) — verify at start of 08-01 |
| Quick run command | `pnpm --filter @mindmap/misconceptions test` / `pnpm --filter @mindmap/llm test` |
| Full suite command | `pnpm -w test` (or `pnpm test` at root per turbo pipeline) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| THME-01 | Every YAML entry has ≥1 theme | unit | `pnpm --filter @mindmap/misconceptions test -- library.test.ts` | ❌ Wave 0 — extend existing `library.test.ts` |
| THME-02 | Every theme ID referenced exists in `themes.yaml` | unit | `pnpm --filter @mindmap/misconceptions test -- library.test.ts` | ❌ Wave 0 — same file |
| THME-02 | `loadThemes()` returns deduped registry | unit | `pnpm --filter @mindmap/misconceptions test -- library.test.ts` | ❌ Wave 0 |
| THME-03 | No `theme` column on `diagnostic_sessions` | schema | `pnpm --filter @mindmap/db build` (typecheck); grep the schema file | ✅ (manual grep) |
| DASH-07 | `getClassDashboardData` returns `themeClusters` ranked correctly | integration | `pnpm --filter web test -- dashboard.test.ts` | ❌ Wave 0 — new test file |
| DASH-08 | `getStudentThemeProfile` returns expected counts given a session fixture | unit | `pnpm --filter web test -- themes.test.ts` | ❌ Wave 0 — new |
| LSPL-01 | `generateLessonPlan` output satisfies Zod `lessonPlanSchema` | unit | `pnpm --filter @mindmap/llm test -- generate-lesson-plan.test.ts` | ❌ Wave 0 — new fixture test |
| LSPL-01 | Generated activities reference real constituent misconception IDs (D-15) | unit | same file | ❌ Wave 0 |
| LSPL-02 | `getOrGenerateLessonPlan` cache hit returns cached row | integration | `pnpm --filter web test -- themes.test.ts` | ❌ Wave 0 |
| LSPL-02 | `{forceRegenerate: true}` inserts a new row | integration | same file | ❌ Wave 0 |
| PRIV-01 | Grep audit of prompt files + action files for PII tokens | smoke | `bash scripts/priv-01-audit.sh` (new one-liner) OR manual grep in verification | ❌ Wave 0 — add script |

### Sampling Rate
- **Per task commit:** `pnpm --filter @mindmap/{misconceptions,llm,db} test --run` (fast, unit-only, <10 s)
- **Per wave merge:** `pnpm -w test` (full suite) + `pnpm -w build` (all packages typecheck)
- **Phase gate:** Full suite green + manual browser verification of print preview + PRIV-01 grep audit before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Extend `packages/misconceptions/src/__tests__/library.test.ts` with orphan check, theme-ID-exists check, and `loadThemes()` dedupe test (THME-01, THME-02)
- [ ] `packages/llm/__tests__/generate-lesson-plan.test.ts` — fixture-based test asserting Zod validity + referenced misconception IDs subset (LSPL-01, D-15)
- [ ] `packages/llm/__tests__/analyze-student-themes.test.ts` — fixture-based test asserting narrative references at least 1 dominant theme from input (DASH-08)
- [ ] `apps/web/__tests__/actions/themes.test.ts` — integration test for `getThemeDetail`, `getStudentThemeProfile`, `getOrGenerateLessonPlan` (DASH-07, DASH-08, LSPL-02)
- [ ] `apps/web/__tests__/actions/dashboard.test.ts` — extend/create a test asserting `themeClusters` ranking (DASH-07)
- [ ] `scripts/priv-01-audit.sh` — grep one-liner wrapped in a shell script for reproducibility (PRIV-01)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes (existing) | Auth.js v5 — already wired; `getClassDashboardData` already calls `auth()` at line 65. New server actions `getThemeDetail`, `getStudentThemeProfile`, `getOrGenerateLessonPlan` MUST repeat the same `auth() → teacher-ownership check` pattern. |
| V3 Session Management | yes (existing) | Auth.js sessions — no changes required. |
| V4 Access Control | **yes — CRITICAL** | Every new server action must verify the caller is the teacher who owns the `classId` (or the student whose `studentId` is being profiled). Copy the exact check from `dashboard.ts:70–76`. `getStudentThemeProfile(studentId)` needs a different check: the caller must be a teacher whose class contains this student. |
| V5 Input Validation | yes | Zod schemas validate YAML loader inputs and LLM outputs. Server action params (classId, themeId, studentId) must be validated via Zod at the server-action boundary — do not trust URL params. |
| V6 Cryptography | yes | SHA-256 via Web Crypto `crypto.subtle.digest`. No hand-rolled hashing. |
| V8 Data Protection | yes — **PRIV-01** | See Section B5. Prompt inputs MUST NOT contain student identifiers. |
| V14 Config & Secrets | no changes | Uses existing `ANTHROPIC_API_KEY` and `DATABASE_URL`. |

### Known Threat Patterns for Next.js 15 / Server Actions

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| IDOR on classId / themeId / studentId in server actions | Elevation / Information disclosure | Verify caller owns/has-access to the target resource BEFORE any query. Pattern: copy lines 70–76 of `dashboard.ts`. |
| PII leakage via LLM prompt logs | Information disclosure | Prompt functions accept only primitives/enums; server actions sanitize params before calling prompts. Grep audit in verification step 5. |
| Unchecked Zod failure → 500 with stack trace | Information disclosure | Wrap LLM calls in try/catch; return `{error: string}` on failure (matches INFR-05 graceful-error pattern from Phase 6). |
| Cache poisoning via manipulated dataHash | Tampering | `dataHash` is computed server-side from authoritative data (the current class's theme fingerprint), never accepted as a client-supplied parameter. |
| YAML injection via user-contributed misconceptions | Tampering | Zod schema validates every YAML entry at load time. CI fails on schema drift. Community contributions go through PR review (per CLAUDE.md). |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The 10 themes I propose cover all 40 existing misconceptions with ≥3 constituents each | §A1 | If wrong, 08-01 subagent will need to add/merge themes; this is expected creative work, not a blocker |
| A2 | Temperature setting of 0.3 will materially reduce lesson plan hallucination vs the default | §B4 Technique 5 | If wrong, output quality may not improve; mitigation is the fixture-based content test in D-15 |
| A3 | A 50-student class with 15 sessions × 2 themes per misconception runs the JS-side aggregation in single-digit milliseconds | §D9 | If wrong at a larger scale, a follow-up optimization would be needed; out of scope for v1 (20-student classes) |
| A4 | `referencedMisconceptionIds` field in the lesson plan schema is an effective anti-hallucination technique | §B4 Technique 4 | If LLM happily hallucinates IDs that look real but aren't in the input, the fixture test will catch it (D-15) — no silent failure |
| A5 | Tailwind v4 `print:*` utilities compile correctly in this project's Tailwind v4 setup without config changes | §E11 | If wrong, the planner would need to add a print stylesheet as a fallback — MEDIUM risk, first-time use in the project |
| A6 | `crypto.subtle` is available in the Vercel Node runtime and works identically in Edge runtime | §C7 | If wrong, would need `node:crypto` import; trivial code change |
| A7 | The existing Vitest setup in `packages/llm/__tests__/` supports fixture-based LLM mocking | §D-15 verification | Not verified — I didn't read the existing `__tests__` directory; if no mock infra exists, 08-03 Wave 0 needs to add it |
| A8 | Kelemen (1999) is the appropriate theme-level citation for `teleological-and-anthropomorphic-reasoning` | §A1 theme 3 | This is a real, well-cited paper but not currently in the library; the 08-01 subagent should verify they're comfortable adding a new citation |
| A9 | diSessa (1993) and Chi (2008) citations are stable and peer-reviewed | §A1 themes 7, 8 | Both are foundational papers in the conceptual-change literature; HIGH confidence but not verified against a citation database in this session |

**If this table is empty:** It is not. All theme-to-misconception groupings and the temperature/anti-hallucination recommendations are `[ASSUMED]` — they need user or domain-expert confirmation during 08-01 and 08-03 execution. Treat them as drafts, not locked decisions.

---

## Open Questions

1. **Should `getMisconceptionsByTheme` return misconceptions ordered by grade band or by domain?**
   - What we know: D-06 locks the function signature but not the ordering.
   - What's unclear: Teachers might expect "all K-5 entries first" for a primary-grade class, or "all physics first" for a domain-specific lesson plan.
   - Recommendation: Leave unordered (library file order) for 08-01 and add ordering only if the 08-04 UI needs it.

2. **Is there a mock LLM adapter for fixture tests?**
   - What we know: `packages/llm/__tests__/` exists and is referenced in D-15, but I didn't read it.
   - What's unclear: Whether existing tests mock `generateText` (e.g., via Vitest's `vi.mock('ai')`) or use a fake adapter.
   - Recommendation: 08-01 should read `packages/llm/__tests__/*.test.ts` first to learn the existing mocking convention before writing new fixture tests.

3. **Should `ThemesView` show themes with zero students affected?**
   - What we know: D-07 says "ranked by students-affected". Silent on empty themes.
   - What's unclear: Teachers might want to see "all themes in the library, sorted by class activity" or "only active themes".
   - Recommendation: Filter out themes with `studentsAffected === 0` for v1; revisit if teacher feedback requests otherwise.

4. **Does the seed data (30-day, 60-day students) produce enough thematic diversity to demo the feature?**
   - What we know: The existing seed data hits ≥3 misconceptions per student per success criterion 3 from Phase 6.
   - What's unclear: Whether those misconceptions span enough themes to show ≥3 ThemeClusters in the verification step.
   - Recommendation: Include a verification step in 08-04 that runs the seed script and asserts `themeClusters.length >= 3` before the phase is marked complete. If it fails, the seed data may need to be nudged in a follow-up (not a blocker for Phase 8).

---

## Environment Availability

Phase 8 adds **no new external dependencies**. All required tooling is already installed and verified in prior phases.

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | All packages | ✓ (prior phases) | ≥20 (per Vercel + Web Crypto requirement) | — |
| pnpm | Workspace | ✓ (prior phases) | 9.x | — |
| PostgreSQL 16 | `@mindmap/db` | ✓ (prior phases) | 16.x | — |
| drizzle-kit | Migrations | ✓ (prior phases) | ^0.31.10 | — |
| Anthropic API key | LLM prompts | ✓ (prior phases) | — | — |
| `ai` SDK | Prompt builders | ✓ (prior phases) | ^6.0.154 | — |
| Web Crypto (`crypto.subtle`) | dataHash | ✓ built into Node 20+ | — | Fall back to `node:crypto` if edge runtime ever complains |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

---

## Sources

### Primary (HIGH confidence — verified in this session)
- `/Users/q/MindMap/packages/misconceptions/src/schema.ts` — existing Zod schema pattern `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/misconceptions/src/loader.ts` — module-cached loader pattern `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/misconceptions/library/{physics,biology,math,history}.yaml` — all 40 misconception entries and their citations `[VERIFIED: Read all 4 files]`
- `/Users/q/MindMap/packages/db/src/schema/diagnostic-sessions.ts` — jsonb + composite index pattern + pitfall 6 documentation `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/db/src/schema/questions.ts` — `unique().on(...)` composite constraint + HNSW index pattern `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/db/src/schema/classes.ts` — `references({onDelete: "cascade"})` pattern `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/db/package.json` — drizzle-orm `^0.45.2` confirmed `[VERIFIED]`
- `/Users/q/MindMap/packages/llm/src/prompts/extract.ts` — `generateText + Output.object` pattern #1 `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/llm/src/prompts/diagnose-resolve.ts` — `generateText + Output.object` pattern #2 + adapter factory usage `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/llm/src/prompts/diagnose-probe.ts` — PRIV-01 pattern (only primitives in params) `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/llm/src/prompts/diagnose-confront.ts` — PRIV-01 pattern (student utterances allowed, no identifiers) `[VERIFIED: Read]`
- `/Users/q/MindMap/packages/llm/package.json` — `ai ^6.0.154`, `@ai-sdk/anthropic ^3.0.68` confirmed `[VERIFIED]`
- `/Users/q/MindMap/apps/web/actions/dashboard.ts` — full 395 lines, query structure, aggregation pattern, extension point for themeClusters `[VERIFIED: Read]`
- `/Users/q/MindMap/apps/web/components/dashboard/misconceptions-tab.tsx` — props shape, sort logic, card expansion pattern, exact CSS classes `[VERIFIED: Read]`
- Grep `generateObject|Output\.object|experimental_output` across `packages/llm/src` — zero `generateObject` hits, three `experimental_output` hits `[VERIFIED: Grep]`
- Grep `print:` across `apps/web` — zero matches in source; two in compiled vendor chunks `[VERIFIED: Grep]`

### Secondary (MEDIUM-HIGH — cited from existing library)
- **Reiner, Slotta, Chi & Resnick (2000).** Naive physics reasoning: A commitment to substance-based conceptions. Cognition and Instruction, 18(1), 1-34. `[CITED: phys-010 YAML entry]` — foundation for theme 1.
- **McCloskey (1983).** Intuitive physics. Scientific American, 248(4), 122-130. `[CITED: phys-007 YAML entry]` — foundation for theme 2.
- **Wineburg (2001).** Historical Thinking and Other Unnatural Acts. Temple University Press. `[CITED: hist-003 YAML entry]` — foundation for theme 5.
- **Gould (1996).** Full House: The Spread of Excellence from Plato to Darwin. Harmony Books. `[CITED: bio-010 YAML entry]` — foundation for theme 6.
- **Kahneman & Tversky (1972).** Subjective probability. Cognitive Psychology, 3(3), 430-454. `[CITED: math-007 YAML entry]` — foundation for theme 9.
- **Sfard (1991).** On the dual nature of mathematical conceptions. Educational Studies in Mathematics, 22(1), 1-36. `[CITED: math-009 YAML entry]` — foundation for theme 10.
- **Vosniadou (1994).** Capturing and modeling the process of conceptual change. Learning and Instruction, 4(1), 45-69. `[CITED: phys-001 YAML entry]` — framework-theory tradition.
- **Stafylidou & Vosniadou (2004).** The development of students' understanding of the numerical value of fractions. Learning and Instruction, 14(5), 503-518. `[CITED: math-004 YAML entry]` — tradition for theme 4.

### Tertiary (MEDIUM — real peer-reviewed work, not in current library)
- **Chi (2008).** Three types of conceptual change: Belief revision, mental model transformation, and categorical shift. In S. Vosniadou (Ed.), International Handbook of Research on Conceptual Change. Routledge. `[CITED]` — foundation for theme 8. Chi's category-change framework is the direct predecessor to Reiner et al. (2000) which IS in the library.
- **diSessa (1993).** Toward an epistemology of physics. Cognition and Instruction, 10(2-3), 105-225. `[CITED]` — foundation for theme 7. Foundational p-prims paper in the same conceptual-change tradition as McCloskey.
- **Kelemen (1999).** Why are rocks pointy? Children's preference for teleological explanations of the natural world. Developmental Psychology, 35(6), 1440-1452. `[CITED]` — foundation for theme 3. Landmark paper on childhood teleology.
- **Vamvakoussi & Vosniadou (2004).** Understanding the structure of the set of rational numbers. Learning and Instruction, 14(5), 453-467. `[CITED]` — foundation for theme 4. Direct successor to Stafylidou citation already in library.

**All tertiary citations are real peer-reviewed papers from authors already represented in the library. I have NOT verified publication details against a citation database in this session** — the 08-01 subagent should double-check DOIs and page numbers before committing them to `themes.yaml`.

---

## Metadata

**Confidence breakdown:**
- Codebase pattern extraction (Sections B, C, D, E): **HIGH** — verified by Read and Grep across every relevant file in this session.
- `generateText + Output.object` vs `generateObject` claim: **HIGH** — verified zero `generateObject` hits across `packages/llm/src`.
- Drizzle schema idioms: **HIGH** — verified against three existing schema files with identical patterns.
- PRIV-01 pattern: **HIGH** — verified by reading all three `diagnose-*.ts` files and their explicit PRIV-01 doc comments.
- Theme taxonomy (Section A1): **MEDIUM** — draft groupings are `[ASSUMED]`; underlying citations are real but not all in the current library; every theme meets the ≥3 constituent rule in my draft but the 08-01 subagent should validate each entry mapping.
- Anti-hallucination techniques (Section B4): **MEDIUM** — Techniques 1-4 are established patterns with high confidence; Technique 5 (temperature) is a reasonable but unvalidated recommendation.
- Print CSS (Section E11): **MEDIUM** — verified zero existing usage; Tailwind v4 `print:*` variants are standard but untested in this repo.

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days — stable codebase patterns, no fast-moving dependencies)
