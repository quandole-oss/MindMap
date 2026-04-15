# Testing Patterns

**Analysis Date:** 2026-04-14

## Test Framework

**Runner:**
- Vitest 4.1.3
- Config files per package: `vitest.config.ts` in each workspace that has tests
- Turbo task: `turbo test` runs all packages in dependency order

**Configuration:**

| Package | Config | Globals | Notes |
|---------|--------|---------|-------|
| `packages/llm` | `packages/llm/vitest.config.ts` | `true` | Minimal config |
| `packages/misconceptions` | `packages/misconceptions/vitest.config.ts` | `true` | Minimal config |
| `packages/router` | `packages/router/vitest.config.ts` | `true` | Minimal config |
| `apps/web` | `apps/web/vitest.config.ts` | not set | Explicit `__tests__/**/*.test.ts` include pattern; `@/` path alias configured |

**Assertion Library:**
- Vitest built-in `expect()` API (Jest-compatible)

**Run Commands:**
```bash
turbo test                     # Run all tests across all packages
turbo test --filter web        # Run tests in web app only
turbo test --filter @mindmap/llm  # Run tests in LLM package only
cd packages/llm && vitest      # Run tests in current package directly
vitest --watch                 # Watch mode (in package dir)
vitest --coverage              # Coverage report (requires @vitest/coverage-*)
```

## Test File Organization

**Location:**
- `__tests__/` subdirectory co-located with the source being tested
- NOT a flat top-level test directory -- tests live near their source

**Naming:**
- `{descriptive-name}.test.ts` suffix (always `.ts`, never `.tsx` -- no component rendering tests)
- Name describes the module or feature tested, not the file being tested

**Directory Structure:**
```
packages/llm/
├── src/
│   ├── adapters/
│   ├── prompts/
│   ├── __tests__/
│   │   ├── adapter.test.ts           (50 lines)
│   │   ├── prompts.test.ts           (155 lines)
│   │   ├── analyze-student-themes.test.ts  (142 lines)
│   │   └── generate-lesson-plan.test.ts    (194 lines)
│   └── index.ts

packages/misconceptions/
├── src/
│   ├── __tests__/
│   │   └── library.test.ts           (125 lines)
│   └── loader.ts

packages/router/
├── src/
│   ├── __tests__/
│   │   └── router.test.ts            (106 lines)
│   └── index.ts

apps/web/
├── __tests__/
│   └── actions/
│       ├── themes.test.ts            (315 lines)
│       └── dashboard.test.ts         (226 lines)
├── components/
│   └── graph/
│       └── __tests__/
│           └── graph-filters.test.ts (397 lines)
├── lib/
│   └── graph/
│       └── __tests__/
│           ├── domain-colors.test.ts (118 lines)
│           └── clusters.test.ts      (273 lines)
```

**Test Count:** 11 test files, 2101 total lines of test code

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Feature or function name", () => {
  beforeEach(() => {
    // Reset caches, mocks, etc.
  });

  it("describes specific behavior in plain English", () => {
    const result = functionUnderTest(input);
    expect(result).toBe(expected);
  });

  describe("sub-feature or edge cases", () => {
    it("handles edge case", () => { /* ... */ });
  });
});
```

**Conventions:**
- Import `describe`, `it`, `expect`, `vi` explicitly from `"vitest"` (even when `globals: true`)
- Test names are descriptive sentences: `"returns a Zod-valid LessonPlan"`, `"matching is case-insensitive"`
- Ticket/requirement IDs included in describe blocks: `describe("generateLessonPlan (LSPL-01, D-15)", () => {`
- One logical assertion per test (multiple `expect` calls only when verifying a single logical property)

**Setup/Teardown:**
- `beforeEach()` for cache resets:
  ```typescript
  // packages/misconceptions/src/__tests__/library.test.ts
  beforeEach(() => {
    resetLibraryCache();
  });
  ```
- `afterEach()` for environment variable restoration:
  ```typescript
  // packages/llm/src/__tests__/adapter.test.ts
  const originalEnv = process.env.LLM_PROVIDER;
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalEnv;
    }
  });
  ```

## Mocking

**Framework:** Vitest built-in `vi` module

**LLM Call Mocking (primary pattern):**
```typescript
// Mock the AI SDK's generateText at module level (hoisted)
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

// Mock the adapter factory to return a fake model
vi.mock("../adapters/factory", () => ({
  createLLMAdapter: () => ({
    getModel: () => ({ __mock: "model" }),
    getModelId: () => "mock-model",
  }),
}));

// In tests: control the mock return value
import { generateText } from "ai";

beforeEach(() => {
  vi.mocked(generateText).mockReset();
});

it("returns valid output", async () => {
  vi.mocked(generateText).mockResolvedValue({
    experimental_output: validFixture,
  } as never);

  const result = await functionUnderTest(params);
  expect(result).toBeDefined();
});
```

Used in: `packages/llm/src/__tests__/analyze-student-themes.test.ts`, `packages/llm/src/__tests__/generate-lesson-plan.test.ts`

**Module Reloading (for module-level mutable state):**
```typescript
// apps/web/lib/graph/__tests__/domain-colors.test.ts
async function freshModule() {
  vi.resetModules();
  return import("../domain-colors");
}

it("assigns distinct colors per domain", async () => {
  const { getDomainColor } = await freshModule();
  // Each test gets a clean module-level Map
});
```

**Environment Variable Mocking:**
```typescript
// packages/llm/src/__tests__/adapter.test.ts
it("returns AnthropicAdapter when LLM_PROVIDER=anthropic", () => {
  process.env.LLM_PROVIDER = "anthropic";
  const adapter = createLLMAdapter();
  expect(adapter).toBeInstanceOf(AnthropicAdapter);
});
```

**What to Mock:**
- LLM SDK calls (`generateText`, `generateObject`) -- always mock, never call real APIs in tests
- Adapter factory (`createLLMAdapter`) -- return lightweight stub
- Module-level singletons when testing state accumulation

**What NOT to Mock:**
- Pure functions -- test the real implementation directly
- Zod schemas -- validate against real schema objects
- Misconception library YAML loading -- tests load and validate real YAML files
- Router logic -- tests run the actual routing algorithm

## Fixtures and Factories

**Inline Fixture Pattern:**
- Fixture objects declared as `const` at describe-block scope
- Named descriptively with `Fixture` or `fixture` suffix:
  ```typescript
  const fixtureParams = {
    gradeBand: "6-8" as const,
    themeCounts: { "substance-based-reasoning": 3 },
    misconceptionIds: ["phys-003", "phys-004"],
    sessionOutcomes: ["unresolved", "resolved"] as Array<"resolved" | "unresolved">,
  };

  const validLessonPlanFixture: LessonPlan = {
    theme: "Substance-based reasoning",
    commonMisunderstanding: "Students treat heat...",
    // ...
  };
  ```

**Helper Factory Functions:**
- Lightweight factory functions defined within test files:
  ```typescript
  // apps/web/lib/graph/__tests__/clusters.test.ts
  function node(id: string, name: string, visitCount = 1, overrides: Partial<GraphNode> = {}): GraphNode {
    return { id, name, domain: "science", status: "unprobed", visitCount, isBridge: false, ...overrides };
  }

  function edge(source: string, target: string, edgeType = "related"): GraphEdge {
    return { source, target, edgeType };
  }
  ```

  ```typescript
  // apps/web/__tests__/actions/themes.test.ts
  function session(userId: string, misconceptionId: string, outcome: ThemeAggregatableSession["outcome"]): ThemeAggregatableSession {
    return { userId, misconceptionId, outcome };
  }
  ```

**Local Type Mirrors:**
- When testing pure helpers that are co-located near `"use server"` code, tests define local type mirrors to avoid importing from server action modules:
  ```typescript
  // Avoids importing the "use server" actions/graph module which pulls in DB/auth
  interface GraphNode {
    id: string;
    name: string;
    domain: string;
    status: "unprobed" | "healthy" | "misconception";
    visitCount: number;
    isBridge: boolean;
  }
  ```

**Location:**
- No `__fixtures__/` directory -- all test data is inline in test files
- No shared test utility package

## Coverage

**Requirements:** Not enforced (no coverage thresholds configured)

**Coverage tooling:** Not installed (`@vitest/coverage-*` not in devDependencies)

**View Coverage:**
```bash
# Would require installing @vitest/coverage-v8 first
pnpm add -D @vitest/coverage-v8 --filter web
vitest --coverage
```

## Test Types

**Unit Tests (all 11 files):**
- Test pure functions in isolation
- No database, no network, no auth
- Fast execution (sub-second per suite)

| Package | File | Tests |
|---------|------|-------|
| `@mindmap/llm` | `adapter.test.ts` | LLM adapter factory, provider selection |
| `@mindmap/llm` | `prompts.test.ts` | Prompt generation, Zod schema validation, PII guard |
| `@mindmap/llm` | `analyze-student-themes.test.ts` | Theme analysis LLM call shape, schema constraints |
| `@mindmap/llm` | `generate-lesson-plan.test.ts` | Lesson plan generation, anti-hallucination checks |
| `@mindmap/misconceptions` | `library.test.ts` | YAML loading, domain coverage, theme integrity |
| `@mindmap/router` | `router.test.ts` | Question routing, grade band mapping, semantic fallback |
| `apps/web` | `themes.test.ts` | Theme profile aggregation, PRIV-01 structural guard, cache hash |
| `apps/web` | `dashboard.test.ts` | Theme cluster building, ranking, edge cases |
| `apps/web` | `graph-filters.test.ts` | Domain group expansion, filter chain logic |
| `apps/web` | `domain-colors.test.ts` | Color assignment determinism, palette cycling |
| `apps/web` | `clusters.test.ts` | Graph clustering (union-find), label generation |

**Integration Tests:** Not present as a separate category. Some tests integrate multiple modules:
- `library.test.ts` loads real YAML files and validates against Zod schemas
- `router.test.ts` calls `routeQuestion()` which loads the misconception library internally

**E2E Tests:** Not implemented. No Playwright, Cypress, or similar framework configured.

**Component Rendering Tests:** Not implemented. No `@testing-library/react` in dependencies.

## Test-Isolation Pattern (Critical)

The codebase uses a deliberate pattern to make server-side logic testable without DB or auth dependencies:

1. **Extract pure logic** into `lib/` files that do NOT import `"use server"`, DB, or auth modules
2. **Server actions** import these pure helpers after resolving auth/ownership
3. **Tests** import only the pure helpers

**Example chain:**
- Pure helper: `apps/web/lib/theme-aggregation.ts` -- exports `buildThemeClusters()`, `buildStudentThemeProfile()`
- Server action: `apps/web/actions/dashboard.ts` -- calls `buildThemeClusters()` after DB query
- Test: `apps/web/__tests__/actions/dashboard.test.ts` -- imports only from `lib/theme-aggregation`

**When adding new server actions:**
1. Extract the pure computation into a `lib/` file
2. Keep DB queries and auth checks in the server action
3. Test the pure computation directly
4. Document the boundary in a comment block at the top of the test file

## Common Test Patterns

**Zod Schema Validation:**
```typescript
it("validates a valid concepts array", () => {
  const result = conceptExtractionSchema.safeParse({
    concepts: [{ name: "gravity", domain: "physics" }],
  });
  expect(result.success).toBe(true);
});

it("rejects a truly invalid domain", () => {
  const result = conceptExtractionSchema.safeParse({
    concepts: [{ name: "sourdough", domain: "cooking" }],
  });
  expect(result.success).toBe(false);
});
```

**PRIV-01 Structural Guard (privacy):**
```typescript
it("returns ONLY the four anonymized keys", () => {
  const result = buildStudentThemeProfile(sessions, 7, library);
  expect(Object.keys(result).sort()).toEqual([
    "gradeBand", "misconceptionIds", "sessionOutcomes", "themeCounts",
  ]);
  // Double-check: no identifier fields
  const asUnknown = result as unknown as Record<string, unknown>;
  expect(asUnknown.studentId).toBeUndefined();
  expect(asUnknown.userId).toBeUndefined();
});

it("does NOT leak userId in serialized output", () => {
  const result = buildStudentThemeProfile(sessions, 7, library);
  expect(JSON.stringify(result)).not.toContain("super-secret-user-id-xyz");
});
```

**Anti-Hallucination Checks (LLM output):**
```typescript
it("every referencedMisconceptionId is in the input (anti-hallucination)", async () => {
  vi.mocked(generateText).mockResolvedValue({ experimental_output: fixture } as never);
  const result = await generateLessonPlan(params);
  const validIds = new Set(params.constituentMisconceptions.map((c) => c.id));
  const referenced = result.suggestedActivities.flatMap((a) => a.referencedMisconceptionIds);
  const hallucinated = referenced.filter((id) => !validIds.has(id));
  expect(hallucinated).toEqual([]);
});
```

**Error/Throw Testing:**
```typescript
it("throws when LLM_PROVIDER is an unknown value", () => {
  process.env.LLM_PROVIDER = "invalid-provider";
  expect(() => createLLMAdapter()).toThrow("Unknown LLM provider: invalid-provider");
});

it("loads without schema errors", () => {
  expect(() => loadLibrary()).not.toThrow();
});
```

**Prompt Content Assertions:**
```typescript
it("prompt includes grade band and anti-hallucination rule", async () => {
  await functionUnderTest(params);
  const call = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string };
  expect(call.prompt).toContain("6-8");
  expect(call.prompt.toLowerCase()).toMatch(/do not invent|must come from/i);
});
```

**PII Guard Assertions:**
```typescript
it("PRIV-01: does NOT contain PII placeholders like {name}", () => {
  const prompt = buildEnrichSystemPrompt(5);
  expect(prompt).not.toMatch(/\{name\}/i);
  expect(prompt).not.toMatch(/\{email\}/i);
  expect(prompt).not.toMatch(/\{userId\}/i);
});
```

**Async Testing:**
```typescript
it("SHA-256 is deterministic", async () => {
  const a = await sha256Hex("canonical-input");
  const b = await sha256Hex("canonical-input");
  expect(a).toBe(b);
});
```

## Coverage Gaps

**Untested server actions:**
- `apps/web/actions/auth.ts` -- signup/login/logout flows (DB writes, password hashing, redirect)
- `apps/web/actions/class.ts` -- class CRUD and enrollment
- `apps/web/actions/diagnostic.ts` -- diagnostic session management
- `apps/web/actions/graph.ts` -- graph data fetching, bridge detection, AI search
- `apps/web/actions/questions.ts` -- streak calculation, question history

**Untested API routes:**
- `apps/web/app/api/ask/route.ts` -- full question->answer pipeline
- `apps/web/app/api/diagnose/route.ts` -- diagnostic chat streaming
- `apps/web/app/api/cron/cleanup/route.ts` -- cleanup cron job

**Untested UI components (no component rendering tests exist):**
- All 50 component files -- no `@testing-library/react` tests
- Form submission flows, error states, loading states, conditional rendering

**Untested database layer:**
- `packages/db/src/queries/concepts.ts` -- query building (would need test DB)
- `packages/db/src/queries/cleanup.ts` -- cleanup queries
- Schema migrations -- no migration tests

**Untested infrastructure:**
- Docker Compose deployment
- Authentication middleware / route protection
- `packages/db` has no test script at all (no vitest dependency)

**Priority recommendations:**
1. **High** -- Add integration tests for `apps/web/actions/questions.ts` streak logic (complex date math, high bug risk)
2. **High** -- Add tests for `apps/web/actions/graph.ts` pure computation (betweenness centrality, importance scoring) by extracting to `lib/`
3. **Medium** -- Add component rendering tests for critical flows (question submission, diagnostic chat)
4. **Medium** -- Add `packages/db` to the test pipeline with a test database
5. **Low** -- Add E2E tests for the full question-to-graph pipeline

---

*Testing analysis: 2026-04-14*
