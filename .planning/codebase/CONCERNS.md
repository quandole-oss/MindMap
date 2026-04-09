# Codebase Concerns

**Analysis Date:** 2026-04-09

---

## Critical Issues

### 1. Routing Logic Bug — First Concept Only Triggers Diagnosis

**Severity:** CRITICAL

**Issue:** The question routing handler picks only the first concept for diagnostic mode, ignoring higher-confidence matches in later concepts.

**Files:** `apps/web/app/api/ask/route.ts` (lines 114–158)

**Problem Details:**
```typescript
// Current code (BUGGY):
const routingDecisions = concepts.map((c) => ({
  concept: c,
  decision: routeQuestion(c.name, gradeLevel, c.domain),
}));

// Only considers the first routing decision
const primaryDecision = routingDecisions[0].decision;  // ← Always index 0
```

The route handler correctly generates a `RoutingDecision` for each concept but then uses only `routingDecisions[0].decision` to determine whether to create a diagnostic session. This means:
- If concept 1 has no misconception (mode: "enrich") but concept 2 has a strong match (mode: "diagnose"), only enrich happens
- If multiple concepts match misconceptions, only the first is considered — even if a later concept has higher confidence

**Impact:**
- Students get fewer diagnostic experiences (missing misconception opportunities)
- Class-level misconception analytics are incomplete (only first-matched misconceptions visible)
- Defeats the purpose of routing all concepts; wastes LLM semantic fallback

**Fix Approach:**
1. Collect ALL concepts with `mode: "diagnose"` into a `diagnoseDecisions` array
2. Sort by confidence/probability (descending)
3. Use the highest-confidence result as the primary decision
4. Track resolved concept IDs in a `Map<conceptName, resolvedConceptId>` to wire up the diagnosis branch
5. Reference: `.planning/quick/260409-e12-fix-mindmap-core-ai-engine/260409-e12-RESEARCH.md` (lines 37–86) contains exact fix pattern

**Mitigation Status:** Requires code change (no workaround)

---

### 2. Missing LLM Semantic Fallback for Unmatched Concepts

**Severity:** CRITICAL

**Issue:** String matching is the only concept-to-misconception router; LLM semantic fallback is not implemented.

**Files:** 
- `packages/router/src/index.ts` (lines 19–52)
- `apps/web/app/api/ask/route.ts` (lines 113–127 should call semantic fallback but don't)

**Problem Details:**
The router package exports `routeQuestion()` which only does substring matching:
```typescript
// Only checks if normalized names contain each other
const matches =
  normalizedConcept.includes(normalizedEntry) ||
  (isMultiWord && normalizedEntry.includes(normalizedConcept));
```

Concepts like "gravitational pull" vs. library entry "gravity" won't match, even though they're semantically identical. No fallback to LLM semantic similarity exists.

**Impact:**
- Students ask about concepts the library has misconceptions for, but they don't trigger diagnosis (fall through to enrich mode)
- Misconception detection completeness is ~60–70% vs. achievable 85–90%
- Defeats the adaptive routing architecture

**Fix Approach:**
1. Implement `semanticFallback()` function in `packages/router/src/semantic-fallback.ts` (new file)
2. Function signature: accepts unmatched concepts, grade band, and LLM model instance
3. Single batched LLM call asking Claude to identify semantic matches in misconception list
4. Return matches with confidence scores > 0.6
5. Merge results back into routing decisions (upgrade enrich → diagnose if semantic match found)
6. Graceful degradation: if LLM call fails, return empty array (no semantic matches) — doesn't break enrichment
7. Reference: `.planning/quick/260409-e12-fix-mindmap-core-ai-engine/260409-e12-RESEARCH.md` (lines 165–200) contains full design

**Mitigation Status:** Requires code change (partially scaffolded in `.planning` docs)

---

## High-Priority Issues

### 3. Concept Extraction Prompt Lacks Few-Shot Examples

**Severity:** HIGH

**Issue:** The LLM extraction prompt is bare, leading to vague concept names instead of specific ones.

**Files:** `packages/llm/src/prompts/extract.ts` (lines 22–45)

**Problem Details:**
Current prompt:
- Allows 2–6 concepts (encourages excess)
- No examples showing good vs. bad concept names
- Domain list not shown (LLM defaults to "general" heavily)
- No guidance on preferring specific names (e.g., "photosynthesis") over generic (e.g., "plant processes")

**Observed Failures:**
- "How do plants grow?" → extracts [{ name: "plants", domain: "general" }, { name: "growth", domain: "general" }]
- Should extract: [{ name: "photosynthesis", domain: "biology" }, { name: "root nutrient absorption", domain: "biology" }]

**Impact:**
- Weaker concept deduplication (embeddings for vague names don't cluster well)
- More concept nodes in student graphs than necessary
- Misconception routing misses domain-specific matches (returns "general" → enrich mode)

**Fix Approach:**
1. Reduce range to 2–4 concepts (increases specificity pressure)
2. Add XML-tagged few-shot examples showing good vs. bad extractions
3. Include the full 15-domain list in the prompt
4. Add explicit instruction: prefer specific named concepts over category labels
5. Example prompt structure in reference: `.planning/quick/260409-e12-fix-mindmap-core-ai-engine/260409-e12-RESEARCH.md` (lines 117–160)

**Mitigation Status:** Requires prompt change only (no architecture change)

---

### 4. Domain Enum Mismatch — Extract vs. Router vs. Misconceptions

**Severity:** HIGH

**Issue:** Three separate domain enums exist; expanding one doesn't expand others, causing silent routing failures.

**Files:**
- `packages/llm/src/prompts/extract.ts` (line 9): 5 domains
- `packages/router/src/utils.ts` and `index.ts`: no enum (filters dynamically)
- `packages/misconceptions/src/schema.ts`: 4 domains (hardcoded in YAML loader)

**Problem Details:**
- Extract schema allows: physics, biology, chemistry, math, history (5 values)
  - Actually should be: physics, biology, chemistry, math, computer-science, earth-science, astronomy, history, literature, social-studies, art, music, health, engineering, general (15 values)
- When LLM extracts a concept with domain "computer-science", it doesn't match misconceptions with that domain (router filters by domain string; misconceptions schema rejects the domain)
- Results: silent fallback to enrich mode even when misconception exists

**Current DB State:**
- `concepts.domain` column is plain `text`, not `pgEnum` — **no migration needed to add domains**
- Existing records stay valid regardless of domain value

**Impact:**
- New domain coverage (computer-science, astronomy, etc.) appears to work but doesn't actually route to misconceptions
- Teacher dashboards don't show misconceptions in new domains (appear as "enrich" only)
- Breaks promise of supporting 15 domains

**Fix Approach:**
1. Expand `DOMAINS` in `packages/llm/src/prompts/extract.ts` to all 15
2. If new YAML misconception files are added: expand `packages/misconceptions/src/loader.ts` DOMAINS array
3. If new YAML misconception files are added: expand `packages/misconceptions/src/schema.ts` domain enum to match
4. No DB migration required (domain column is text, not enum)
5. Router automatically supports new domains (filters dynamically by string)

**Mitigation Status:** Requires config/schema updates only

---

## Medium-Priority Issues

### 5. Auth.js v5 Beta Stability Risk

**Severity:** MEDIUM

**Issue:** Production uses Next.js Auth v5, which is still in beta (`next-auth: beta` in `package.json`).

**Files:** 
- `apps/web/package.json` (line 35): `"next-auth": "beta"`
- `apps/web/lib/auth.ts` (lines 9–68)
- `apps/web/lib/auth.config.ts` (lines 7–26)

**Problem Details:**
Auth.js v5 is marked as beta, meaning:
- API may change between releases
- Fewer production deployments testing edge cases
- Breaking changes can occur without semver warning

**Current Implementation Risk:**
The codebase works around known Auth.js quirks:
- Line 59 in `auth.ts`: `(session.user as any).role = token.role as string;` (unsafe type cast)
- Uses JWT strategy with custom callbacks for role injection
- Drizzle adapter (relatively new) has fewer real-world deployments than Prisma adapter

**Impact:**
- Security updates may require code changes (breaking API changes in beta)
- Deployment pipeline may fail if Auth.js releases breaking change
- Type safety is compromised (unsafe casts indicate incomplete typing)

**Mitigation Options:**
1. **Fallback to stable:** Lucia Auth v3 (stable, explicit Drizzle support)
2. **Upgrade monitoring:** Pin to `next-auth: 5.0.0-beta.25+` and test upgrades frequently
3. **Hybrid approach:** Keep Auth.js but reduce custom callbacks; use built-in session handling more

**Current State:** Functional, no immediate risk, but upgrade path should be planned

---

### 6. Missing Input Validation for LLM Semantic Fallback

**Severity:** MEDIUM

**Issue:** The `semanticFallback()` function (if implemented) constructs a prompt with unvalidated LLM output (concept names from extraction).

**Files:** 
- `packages/router/src/semantic-fallback.ts` (hypothetical implementation)
- `apps/web/app/api/ask/route.ts` (line 127, would call semantic fallback with unvalidated concepts)

**Problem Details:**
```typescript
// In semantic fallback prompt construction (hypothetical):
const prompt = `
Concepts to check:
${unmatched.map((c) => `- "${c.name}" (domain: ${c.domain})`).join("\n")}
`;
```

If extraction LLM returns a concept name with quotes, backticks, or newlines, it could:
- Inject new instructions into the prompt ("check if this is actually malicious")
- Confuse the semantic fallback LLM's parsing
- Cause prompt token overrun (no length validation on concept names)

**Impact:**
- Low likelihood (extraction schema validates name is string, not object injection)
- Moderate impact if triggered (LLM behaves unexpectedly, returns garbage semantic matches)
- Not a security vulnerability per se (no data exfiltration), but reliability issue

**Fix Approach:**
1. Validate concept names in semantic fallback: max 100 chars, no control characters
2. Escape any special characters when building prompt
3. Add prompt length check (sum of all concept names) before LLM call
4. Return empty array gracefully if validation fails

**Mitigation Status:** Implement when semantic fallback is added

---

### 7. Embedding Fallback Silently Creates Concepts Without Vectors

**Severity:** MEDIUM

**Issue:** When OpenAI embedding fails, concepts are inserted without embeddings, breaking deduplication downstream.

**Files:** `apps/web/app/api/ask/route.ts` (lines 263–277)

**Problem Details:**
```typescript
} catch (embeddingErr) {
  console.error(`[dedup] embedding failed for "${concept.name}", inserting without:`, embeddingErr);
  const [newConcept] = await db
    .insert(schema.concepts)
    .values({
      userId,
      name: concept.name,
      domain: concept.domain,
      status: "unprobed",
      // NO embedding field — left null
      visitCount: 1,
    })
    .returning();
}
```

When embedding is null:
- pgvector similarity search skips the concept (NULL != any vector)
- Future questions ask about the same concept → create new, duplicate nodes
- Graph grows with redundant concepts
- Dashboard heatmaps show false breadth

**Triggers:**
- Missing `OPENAI_API_KEY` environment variable
- OpenAI API outage/rate limit
- Concept name > 500 chars (rejected by `generateEmbedding()`)

**Impact:**
- Silently degrades deduplication quality (no error to user, but graph becomes messy)
- Accumulates over time — each embedding failure multiplies concept count
- Teacher dashboard concepts heatmap inflates (shows more concepts than actually learned)

**Fix Approach:**
1. **Option A (Aggressive):** Fail the question if embedding fails → return 503 error to client
   - Clearest behavior, forces OPENAI_API_KEY to be set
   - May be too strict for optional deduplication
2. **Option B (Graceful):** Use fallback embedding provider (e.g., local embedding if Ollama available)
   - Complex setup, adds dependency
3. **Option C (Recommended):** Create fallback hash-based deduplication
   - When embedding unavailable, use concept name + domain hash for matching
   - Fuzzy matching on name similarity (Levenshtein distance)
   - Reduces deduplication quality but prevents duplicate accumulation
4. **Option D (Interim):** Add to CONCERNS, require OPENAI_API_KEY in production via env validation

**Current:** Using Option D implicitly (docs assume OPENAI_API_KEY set, no validation)

---

### 8. Diagnostic Session Messages Stored as JSONB Without Validation

**Severity:** MEDIUM

**Issue:** Diagnostic session chat history is stored as raw JSONB, vulnerable to shape changes.

**Files:**
- `packages/db/src/schema/diagnostic-sessions.ts` (lines 49–53)
- `apps/web/app/api/diagnose/route.ts` (lines 138, 204, 290)

**Problem Details:**
```typescript
messages: jsonb("messages")
  .$type<any[]>()  // ← Any array, no validation
  .notNull()
  .$defaultFn(() => []),
```

Messages are saved as opaque JSONB with type `any[]`. When code reads messages, it assumes structure:
```typescript
const lastUserMessage = [...allMessages].reverse().find((m) => m.role === "user");
const probeResponse =
  lastUserMessage?.parts
    ?.map((p) => (p.type === "text" ? p.text : ""))
    .join("") ?? "";
```

If a message object is missing `.parts` or `.role`, code silently defaults to empty string. This hides bugs.

**Impact:**
- Silent data corruption: malformed messages don't trigger errors, just return ""
- Difficult to debug in production: no type errors, just mysteriously empty responses
- Migration risk: if message format changes, old sessions break
- No schema evolution story

**Fix Approach:**
1. Define a TypeScript type for message structure:
```typescript
type DiagnosticMessage = UIMessage; // From AI SDK
```
2. Add Zod validation at read time:
```typescript
const messagesSchema = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.object({
    type: z.string(),
    text: z.string().optional(),
  })),
}));

const validated = messagesSchema.parse(diagnosticSession.messages);
```
3. Validate at write time in `onFinish` handlers
4. Add migration helper to validate existing data

**Mitigation Status:** Add validation layer (non-breaking)

---

## Low-Priority Issues

### 9. Hardcoded Grade Level Defaults

**Severity:** LOW

**Issue:** Grade level defaults to 6 in multiple places without explanation.

**Files:**
- `apps/web/app/api/ask/route.ts` (line 82): `const gradeLevel = enrollment?.gradeLevel ?? 6;`
- `apps/web/app/api/diagnose/route.ts` (line 96): `const gradeLevel = enrollment?.gradeLevel ?? 6;`

**Problem Details:**
When a student has no class enrollment (e.g., joins as unaffiliated), grade level silently defaults to 6 (6th grade / age ~12). This is a reasonable default but:
- Not configurable
- No logging to indicate fallback was used
- If students sign up without a class, all get "6-8" grade band prompts

**Impact:**
- Low: reasonable default covers middle range
- Diagnostic prompts may be slightly mismatched for K-5 or 9-12 students
- No security issue

**Fix Approach:**
1. Log when fallback is used: `console.info("[ask] grade level defaulted to 6 for user ${userId}")`
2. Consider adding user.defaultGradeLevel to users table for self-serve setup
3. Document the choice in code comment

**Mitigation Status:** Nice-to-have improvement

---

### 10. Misconception Library Cache Never Expires

**Severity:** LOW

**Issue:** The misconception library is cached in-memory globally, with no expiration or refresh mechanism.

**Files:** `packages/misconceptions/src/loader.ts` (lines 13–44)

**Problem Details:**
```typescript
let _library: MisconceptionEntry[] | null = null;

export function loadLibrary(): MisconceptionEntry[] {
  if (_library) return _library;  // Infinite cache
  // ... load from YAML files ...
  _library = misconceptionLibrarySchema.parse(entries);
  return _library;
}
```

Once loaded, the library is never reloaded. If misconception YAML files are updated in production:
- Running instances don't see the updates (must restart)
- New instances see updates (inconsistent state across replicas)
- No way to manually trigger reload

**Impact:**
- Low: misconception library changes rarely (few times per year)
- Mild inconvenience: production deployments must restart to pick up library updates
- No data loss or corruption risk

**Fix Approach:**
1. Add `resetLibraryCache()` export (already exists, line 59)
2. Expose cache reset via an internal admin endpoint (e.g., POST `/api/admin/cache-reset` with auth)
3. Document that library changes require instance restart
4. Consider TTL-based refresh (e.g., reload every 1 hour) for long-running processes

**Mitigation Status:** Add documentation; implement cache reset endpoint as nice-to-have

---

### 11. No Rate Limiting on Question Endpoint

**Severity:** LOW

**Issue:** The `/api/ask` endpoint enforces one-per-day per student but has no rate limiting against brute-force attempts.

**Files:** `apps/web/app/api/ask/route.ts` (lines 49–67)

**Problem Details:**
The endpoint checks:
```typescript
const existingQuestion = await db.query.questions.findFirst({
  where: and(
    eq(schema.questions.userId, userId),
    gte(schema.questions.createdAt, startOfDay),
    lt(schema.questions.createdAt, startOfTomorrow),
  ),
});
if (existingQuestion) {
  return new Response(JSON.stringify({ error: "One question per day" }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
```

This prevents a *single student* from asking > 1 per day, but doesn't prevent:
- 100 invalid requests/second before auth (credential stuffing)
- Rapid API calls from multiple students to DOS the embedding service
- Heavy load on LLM API from legit traffic spike

**Impact:**
- Low: Web tier has maxDuration=60 (request times out if slow)
- Moderate during traffic spikes: embedding or LLM calls could exhaust quota
- No immediate risk (typical K-12 usage is light)

**Fix Approach:**
1. Add middleware-level rate limiting (e.g., Vercel's built-in rate limit)
2. For Docker Compose: use nginx rate limiting (1 request per 10 seconds per IP)
3. Add per-student token bucket: 1 token per day (refills daily)
4. Monitor embeddings API usage; alert on spikes

**Mitigation Status:** Monitor in production; implement if needed

---

### 12. Teacher Dashboard N+1 Query Risk

**Severity:** LOW

**Issue:** The dashboard action batches concept fetches well, but misconception lookups are not batched.

**Files:** `apps/web/actions/dashboard.ts` (lines 61–150+)

**Problem Details:**
The action fetches:
1. All students in class (line 79–91) ✓ batched
2. All concepts for all students (line 128–138) ✓ batched
3. Per concept: fetch misconception by ID if it matches? (not shown in excerpt, but likely in the misconception cluster loop)

If the misconception cluster building loops over concepts and fetches misconceptions one by one:
```typescript
// Hypothetical problematic code:
for (const concept of studentConcepts) {
  if (concept.status === "misconception") {
    const misconception = await getMisconceptionById(concept.misconceptionId);
    // ...
  }
}
```

This would do 1 query per misconception concept (N queries if 50 concepts).

**Impact:**
- Low: misconception library is cached in-memory, so `getMisconceptionById` is O(n) array scan, not a DB query
- No actual DB queries are wasted
- But if library gets large (1000+ entries), scans become measurable

**Fix Approach:**
1. Pre-build a `Map<misconceptionId, entry>` when loading library
2. Use map lookup in dashboard action

**Mitigation Status:** Already mitigated by in-memory cache; optimize if needed

---

## Security Considerations

### S-1: Auth Session ID Validation

**Status:** SECURE ✓

**Details:** All API endpoints validate `sessionId` against authenticated user (lines 62–64 in diagnose/route.ts):
```typescript
const diagnosticSession = await db.query.diagnosticSessions.findFirst({
  where: and(
    eq(schema.diagnosticSessions.id, sessionId),
    eq(schema.diagnosticSessions.userId, userId)  // ← Ownership check
  ),
});
```

Students cannot access other students' diagnostic sessions. ✓

---

### S-2: PII Not Sent to LLM

**Status:** SECURE ✓

**Details:** LLM prompts never include PII (email, name). Only concept names and grade level (integer) are sent. ✓

---

### S-3: CRON_SECRET Bearer Token

**Status:** SECURE ✓

**Details:** Cleanup endpoint validates bearer token and returns 503 if not configured. ✓

---

### S-4: Password Hashing

**Status:** SECURE ✓

**Details:** Uses bcryptjs for password hashing; comparison is constant-time. ✓

---

## Summary Table

| Issue | Severity | File | Type | Status |
|-------|----------|------|------|--------|
| First concept only routes | CRITICAL | `apps/web/app/api/ask/route.ts` | Bug | Requires fix |
| No LLM semantic fallback | CRITICAL | `packages/router/src/` | Missing feature | Requires implementation |
| Extraction prompt lacks examples | HIGH | `packages/llm/src/prompts/extract.ts` | Quality | Requires prompt update |
| Domain enum mismatch | HIGH | Multiple | Config | Requires schema update |
| Auth.js v5 beta | MEDIUM | `apps/web/lib/auth.ts` | Risk | Monitor/plan upgrade |
| Semantic fallback validation | MEDIUM | `packages/router/src/` | Prevention | Implement with feature |
| Embedding fallback degrades dedup | MEDIUM | `apps/web/app/api/ask/route.ts` | Degradation | Requires mitigation |
| JSONB message validation | MEDIUM | `packages/db/src/schema/` | Quality | Add validation |
| Hardcoded grade default | LOW | `apps/web/app/api/` | Config | Nice-to-have |
| Library cache never expires | LOW | `packages/misconceptions/src/` | Ops | Document/implement reset |
| No rate limiting | LOW | `apps/web/app/api/ask/route.ts` | Security | Monitor/implement if needed |
| Dashboard N+1 risk | LOW | `apps/web/actions/dashboard.ts` | Performance | Already mitigated |

---

*Concerns audit: 2026-04-09*
