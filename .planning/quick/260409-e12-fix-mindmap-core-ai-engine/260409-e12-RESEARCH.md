# Quick Task 260409-e12: Fix MindMap Core AI Engine — Research

**Researched:** 2026-04-09
**Domain:** LLM pipeline, routing logic, misconception detection
**Confidence:** HIGH (all findings verified directly against codebase source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Route ALL concepts for misconception detection, not just the first
- When multiple concepts match misconceptions, diagnose the highest-confidence match
- Create one diagnostic session for the best match (not multiple sessions)
- Expand from 5 to 15 domains: physics, biology, chemistry, math, computer-science, earth-science, astronomy, history, literature, social-studies, art, music, health, engineering, general
- "general" remains the catch-all
- When string matching fails, use LLM semantic fallback — ask Claude with misconception list as context
- Accepts ~1s additional latency; falls back gracefully to enrich mode if LLM call fails
- Add few-shot examples to extraction prompt; prefer 2-4 focused concepts
- Include domain guidance with the 15-domain list in the prompt

### Claude's Discretion
- Specific extraction prompt wording and examples
- Similarity thresholds for semantic fallback
- How to handle edge cases (cross-domain concepts, ambiguous domains)

### Deferred Ideas (OUT OF SCOPE)
- None specified
</user_constraints>

---

## Summary

Four distinct bugs/gaps exist in the AI pipeline, each in a well-isolated location. The fixes are surgical — no architectural changes required.

**Bug 1 (routing):** `route.ts` lines 119–123 use `routingDecisions[0]` (first concept only) as the primary decision. All concepts are already iterated in the `for` loop below, but the `diagnose` branch still triggers only on `primaryDecision`. Fix: collect all `diagnose` results, pick highest-confidence, use that as `primaryDecision`.

**Bug 2 (domain enum):** The Zod enum in `extract.ts` has 5 values. The DB `concepts.domain` column is plain `text` (not a DB enum), so adding domains to the Zod schema requires no migration. The misconceptions library schema in `packages/misconceptions/src/schema.ts` has its own 4-domain enum — this only needs expanding if new YAML files are added for new domains (not required for the current 4-domain YAML set).

**Bug 3 (extraction prompt):** The current prompt is bare — no examples, no domain guidance, permits up to 6 concepts. Few-shot examples in Anthropic prompts reliably improve output granularity [ASSUMED based on Anthropic documentation best practices].

**Bug 4 (LLM fallback):** The router has no fallback. The pattern is: gather all concepts with no string match, send a single batched `generateObject` call to Claude asking which (if any) relate to known misconceptions, return a list of `{ conceptName, misconceptionId, confidence }` tuples.

**Primary recommendation:** Fix in order — domain enum first (unblocks extraction test), then routing loop, then semantic fallback, then extraction prompt. Each is independently testable.

---

## Findings by Problem

### 1. Routing All Concepts — What Currently Happens

**Verified against `apps/web/app/api/ask/route.ts` lines 114–127:** [VERIFIED: codebase]

```
const routingDecisions = concepts.map((c) => ({ concept: c, decision: routeQuestion(...) }));
const primaryDecision = routingDecisions[0].decision;   // ← BUG: index 0 always
```

The `routingDecisions` array correctly contains a decision per concept, but `primaryDecision` is always `[0]`. The diagnose branch at line 249 checks only `primaryDecision.mode === "diagnose"`, so only the first concept ever triggers a diagnostic session.

**Fix pattern:**

```typescript
// After building routingDecisions array:
const diagnoseDecisions = routingDecisions
  .map(({ concept, decision }) => ({ concept, decision }))
  .filter((r): r is { concept: typeof r.concept; decision: Extract<RoutingDecision, { mode: "diagnose" }> } =>
    r.decision.mode === "diagnose"
  )
  .sort((a, b) => b.decision.probability - a.decision.probability);

const primaryDecision = diagnoseDecisions.length > 0
  ? diagnoseDecisions[0].decision
  : { mode: "enrich" as const };

const primaryConceptForDiagnosis = diagnoseDecisions.length > 0
  ? diagnoseDecisions[0].concept
  : null;
```

The diagnose branch then uses `primaryConceptForDiagnosis` to find the `resolvedConceptId` — this requires tracking which resolved concept ID corresponds to which extracted concept. The existing loop at line 140 iterates `routingDecisions`, so the resolved IDs come out in the same order. A `Map<string, string>` keyed by concept name → resolvedConceptId is the cleanest way to wire this up.

**Confidence score:** The current `routeQuestion` always returns `probability: 0.8` for a string match. With the semantic fallback returning actual confidence floats, sorting by probability becomes meaningful. For now, string match = 0.8, LLM semantic match = LLM-returned confidence.

---

### 2. Domain Expansion — What Needs Changing and What Doesn't

**Verified against codebase:** [VERIFIED: codebase]

| File | Current State | Change Required |
|------|--------------|-----------------|
| `packages/llm/src/prompts/extract.ts` | `z.enum(["physics", "biology", "math", "history", "general"])` | Replace with 15-domain enum |
| `packages/db/src/schema/questions.ts` | `domain: text("domain").notNull()` — plain text, no DB enum | **No migration needed** |
| `packages/misconceptions/src/schema.ts` | `z.enum(["physics", "biology", "math", "history"])` | Only needs updating if new YAML domain files are added; existing 4-domain YAML files are unaffected |
| `packages/misconceptions/src/loader.ts` | `const DOMAINS = ["physics", "biology", "math", "history"]` | Only needs updating if new YAML domain files are added |
| `packages/router/src/index.ts` | Calls `getMisconceptionsByDomainAndBand(domain, gradeBand)` — filters by domain string | No change needed; new domains simply return empty array (no misconceptions) → enrich mode |

**Key finding:** The DB `domain` column is `text` — not a `pgEnum`. This means adding 10 more valid domain strings to the Zod extraction schema costs zero DB migration. Existing records with old domain values ("general", "physics", etc.) remain valid. [VERIFIED: codebase — `packages/db/src/schema/questions.ts` line 39: `domain: text("domain").notNull()`]

**Existing concept rows with domain "general"** are safe — they keep their value. No data migration is needed or warranted.

**The 15-domain enum to use:**

```typescript
z.enum([
  "physics", "biology", "chemistry", "math", "computer-science",
  "earth-science", "astronomy", "history", "literature", "social-studies",
  "art", "music", "health", "engineering", "general"
])
```

---

### 3. Extraction Prompt — Current State and Improvement Pattern

**Current prompt** (verified, `extract.ts` lines 17–23): [VERIFIED: codebase]

```
Extract the 2-6 core educational concepts from the following student question and answer.
For each concept, identify the most relevant domain.
...
Return a JSON object with a "concepts" array...
```

Problems:
- "2-6" encourages 5-6 vague concepts; guidance should push toward 2-4 focused ones
- No examples showing what "focused" means vs. "vague"
- Domain list not shown in the prompt (LLM guesses from training, often picks "general" when it shouldn't)
- No instruction to prefer specific over generic (e.g., "photosynthesis" not "biology processes")

**Recommended few-shot structure** (Claude-native pattern — XML-tagged examples work well with Claude): [ASSUMED — Anthropic few-shot best practices from training knowledge]

```
Extract 2-4 core educational concepts from this student question and answer.
Prefer specific, named concepts (e.g., "photosynthesis", "Newton's first law", "plate tectonics")
over vague category labels (e.g., "biology", "science processes", "physics concepts").
Each concept needs a domain from this list: [15 domains].

<examples>
<example>
Question: Why do leaves change color in autumn?
Answer: [answer text]
Good: [{ name: "chlorophyll breakdown", domain: "biology" }, { name: "anthocyanin pigments", domain: "biology" }, { name: "photoperiodism", domain: "biology" }]
Bad: [{ name: "plants", domain: "biology" }, { name: "seasons", domain: "general" }, { name: "colors", domain: "general" }, { name: "nature", domain: "general" }]
</example>
<example>
Question: Why does the moon have phases?
Answer: [answer text]
Good: [{ name: "lunar phases", domain: "astronomy" }, { name: "Earth-Moon orbital geometry", domain: "astronomy" }]
Bad: [{ name: "moon", domain: "general" }, { name: "space", domain: "astronomy" }, { name: "light reflection", domain: "physics" }, { name: "night sky", domain: "general" }]
</example>
</examples>

Student question: ${question}
Answer: ${answer}
```

**Domain guidance note:** Including the 15-domain list verbatim in the prompt directly reduces "general" overuse. When the model sees "computer-science" as an option it will use it for questions about algorithms, not default to "general". [ASSUMED — training knowledge on prompt engineering]

---

### 4. LLM Semantic Fallback — Architecture

**Decision: one batched call, not N calls.** Sending one LLM call for all unmatched concepts keeps the latency addition to ~1s regardless of concept count.

**Where to add it:** New function in `packages/router/src/index.ts` (or a new file `packages/router/src/llm-fallback.ts`). The router package already imports from `@mindmap/misconceptions` — the fallback just needs access to the full misconception list.

**Input shape:**
- `unmatched`: `Array<{ name: string; domain: string }>` — concepts with no string match
- `gradeBand`: `GradeBand` — for library filtering
- `model`: the LLM model instance — must be passed in (router has no LLM adapter currently)

**Dependency concern:** `packages/router` currently has no dependency on `@mindmap/llm`. Adding one creates a new package dependency. Options:
1. Add `@mindmap/llm` as a dependency of `@mindmap/router` — clean but adds a package link
2. Accept the model as a parameter in the fallback function — keeps router stateless, caller (route.ts) passes the model
3. Move the semantic fallback to `apps/web/app/api/ask/route.ts` directly — no new package deps

**Recommendation:** Option 2. The fallback function accepts the model as a parameter. `route.ts` already has the model instance; it calls `routeQuestionBatch(concepts, gradeLevel, model)` instead of the per-concept loop.

**Output schema for the LLM call:**

```typescript
const semanticRouteSchema = z.object({
  matches: z.array(z.object({
    conceptName: z.string(),
    misconceptionId: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  })),
});
```

**Prompt structure:**

```
You are a K-12 educational misconception detector.
Given a list of concepts a student just asked about, identify which (if any) relate to
well-documented student misconceptions.

Known misconceptions (grade band: ${gradeBand}):
${misconceptions.map(m => `- ID: ${m.id} | "${m.name}" | ${m.description}`).join('\n')}

Concepts to check:
${unmatched.map(c => `- "${c.name}" (domain: ${c.domain})`).join('\n')}

For each concept that semantically matches a known misconception, return the match.
Only include high-confidence matches (> 0.6). Return empty array if none match.
```

**Latency profile:**
- String match: ~0ms (synchronous loop)
- LLM semantic fallback: ~800-1200ms for a single call [ASSUMED — typical Claude API response time for short structured output]
- Total pipeline: existing pipeline already has `extractConcepts` (~1.5s) + embedding generation per concept (~300ms each) + pgvector queries. The semantic fallback adds ~1s but runs only when string matching fails — it does not add to the happy path when string matching succeeds.

**Graceful failure:** Wrap in try/catch, return `{ matches: [] }` on any error. This ensures the fallback always produces enrich mode, never throws.

---

### 5. Integration Risks

**Risk 1: Zod enum mismatch between extract.ts and misconceptions/schema.ts**

The extraction schema will have 15 domains. The misconception entry schema has 4 domains. These are separate Zod schemas and do not need to match. The router's `getMisconceptionsByDomainAndBand(domain, gradeBand)` filters by string equality — passing "computer-science" as domain simply returns an empty array (no misconceptions in that domain), so string matching gracefully degrades. [VERIFIED: codebase — `loader.ts` line 50: `e.domain === domain`]

**Risk 2: Concept deduplication loop order vs. primary diagnosis concept**

Currently `resolvedConceptIds` is built in the same order as `routingDecisions`. After the fix, we need to know which resolved ID belongs to the primary diagnosis concept. The safest approach: build a `Map<string, string>` from `concept.name → resolvedConceptId` during the loop, then look up `primaryConceptForDiagnosis.concept.name` after the loop completes.

**Risk 3: Existing DB rows with 5-domain values**

No risk. The DB column is plain `text`. Old rows with "physics", "biology", "math", "history", "general" remain valid. The domain field has no FK constraint and no DB-level enum. [VERIFIED: codebase]

**Risk 4: Misconception library YAML domain enum**

`packages/misconceptions/src/schema.ts` line 8: `domain: z.enum(["physics", "biology", "math", "history"])`. If a new YAML file with domain "chemistry" is added without updating this enum, `loadLibrary()` will throw a Zod parse error at startup. Since the task does not include adding new YAML files, this enum does not need changing. But if new YAML files are ever added later, this schema must be updated simultaneously.

**Risk 5: router loop vs. single diagnose session**

After the fix, the primary diagnose decision may correspond to a concept at index 3, but `resolvedConceptIds[0]` (current code) would create the session for the wrong concept. The name→id map approach above resolves this correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Structured LLM output for semantic fallback | Custom JSON parsing | `Output.object({ schema })` with `generateText` — already the project pattern in `extract.ts` |
| Confidence scoring logic | Custom heuristics | Return confidence float from LLM, sort by it |
| Domain validation | Runtime string checks | Zod enum in extraction schema — Zod throws on invalid domain |

---

## Code Patterns Already in Codebase

**Structured output (existing pattern in extract.ts):**
```typescript
const { experimental_output } = await generateText({
  model,
  prompt,
  experimental_output: Output.object({ schema: mySchema }),
});
```
Use this same pattern for the semantic fallback call. [VERIFIED: codebase]

**Router `RoutingDecision` type** already supports probability:
```typescript
| { mode: "diagnose"; misconceptionId: string; probability: number }
```
The probability field is there — just hardcoded to `0.8` today. The LLM fallback will return real floats. [VERIFIED: codebase]

---

## Files to Change (Complete List)

| File | Change | Risk |
|------|--------|------|
| `packages/llm/src/prompts/extract.ts` | Expand Zod enum to 15 domains; rewrite prompt with few-shot examples | LOW — schema change only, no DB migration |
| `packages/router/src/index.ts` | Add `routeQuestionBatch()` accepting model param; return all matches with confidence | LOW — additive |
| `apps/web/app/api/ask/route.ts` | Fix `primaryDecision` to use highest-confidence match; add name→id map; call semantic fallback for unmatched concepts | MEDIUM — logic change in critical path |
| `packages/llm/src/index.ts` | Export any new semantic fallback types if they live in llm package | LOW |

**Not needed:**
- No DB migration
- No schema changes in `packages/misconceptions/src/schema.ts` (unless adding new YAML files)
- No changes to `packages/db/src/queries/concepts.ts`
- No changes to enrich.ts, diagnose prompts, or teacher dashboard

---

## Open Questions

1. **Should `routeQuestion` (single-concept, sync) be kept alongside the new batch function?**
   - It's used directly in `route.ts` line 114 (`concepts.map(...)`)
   - Option A: Replace the `.map()` with a single batch call that handles both string matching and LLM fallback
   - Option B: Keep `routeQuestion` for string matching, add a separate `semanticFallback()` for unmatched concepts
   - Recommendation: Option B — cleaner separation, string matching remains synchronous and fast

2. **What is the correct `misconceptionId` when the LLM returns a semantic match but the misconception name differs slightly from the library entry name?**
   - The LLM is given the actual `id` field from the library and instructed to return it verbatim
   - `getMisconceptionById(id)` lookup will confirm validity before session creation
   - Invalid IDs fall through to enrich mode (safe)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Few-shot XML examples improve Claude concept extraction granularity | Extraction Prompt | Minor — prompt can be adjusted without code changes |
| A2 | LLM semantic fallback adds ~800-1200ms latency | LLM Fallback | Low — actual latency depends on Claude response time; the batch approach is still correct regardless |
| A3 | Including the 15-domain list in the extraction prompt reduces "general" overuse | Extraction Prompt | Low — easy to test empirically |
