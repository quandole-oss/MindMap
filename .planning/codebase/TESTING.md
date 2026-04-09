# Testing Patterns

**Analysis Date:** 2026-04-09

## Test Framework

**Runner:**
- Vitest 4.1.3
- Config files per package: `vitest.config.ts` in each workspace
- Turbo task: `turbo test` runs all packages in dependency order

**Configuration:**
- Minimal config: `globals: true` enables describe/it without imports in most packages
- Web app config allows test discovery in `__tests__/**/*.test.ts` pattern
- Path aliases configured to match app tsconfig.json (e.g., `@/*` → project root)

**Assertion Library:**
- Vitest built-in `expect()` API (compatible with Jest)
- No additional assertion library needed

**Run Commands:**
```bash
turbo test              # Run all tests across all packages
turbo test --filter web # Run tests in web app only
vitest                  # Run tests in current package (when in package dir)
vitest --watch         # Watch mode
vitest --coverage      # Coverage report (if configured)
```

## Test File Organization

**Location:**
- Co-located with source files in `__tests__/` subdirectory within `src/`
- Example: `src/__tests__/adapter.test.ts` sits next to `src/adapters/`

**Naming Convention:**
- Filename matches source being tested with `.test.ts` suffix
- Example: `adapter.test.ts` tests the adapter factory / adapter classes
- Example: `prompts.test.ts` tests prompt generation functions
- Example: `library.test.ts` tests misconception library loading

**Directory Structure:**
```
packages/llm/
├── src/
│   ├── adapters/
│   ├── prompts/
│   ├── __tests__/
│   │   ├── adapter.test.ts
│   │   └── prompts.test.ts
│   └── index.ts

apps/web/
├── components/
│   ├── graph/
│   │   └── __tests__/
│   │       └── graph-filters.test.ts
├── lib/
│   └── graph/
│       └── __tests__/
│           ├── domain-colors.test.ts
│           └── clusters.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Feature or function name", () => {
  // Setup
  beforeEach(() => {
    // Reset state before each test
  });

  // Cleanup
  afterEach(() => {
    // Restore mocks, clean up side effects
  });

  // Individual test cases
  it("should do something specific", () => {
    // Arrange
    const input = "test input";
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe("expected output");
  });

  // Nested describe blocks for related functionality
  describe("edge cases", () => {
    it("should handle empty input", () => {
      // ...
    });
  });
});
```

**Patterns observed:**

**Setup/Teardown:**
- `beforeEach()` for test isolation (e.g., resetting library cache before each test)
  - Example from `library.test.ts`:
    ```typescript
    beforeEach(() => {
      resetLibraryCache();  // Fresh cache for each test
    });
    ```

- `afterEach()` for cleanup (e.g., restoring environment variables)
  - Example from `adapter.test.ts`:
    ```typescript
    const originalEnv = process.env.LLM_PROVIDER;
    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.LLM_PROVIDER;
      } else {
        process.env.LLM_PROVIDER = originalEnv;
      }
    });
    ```

**Assertion Pattern:**
- Single assertion per test, or related assertions for one logical check
- Test name describes the expected behavior, not the implementation
- Example: `it("returns an adapter when LLM_PROVIDER is not set (defaults to anthropic)")`

## Mocking

**Framework:** Vitest's built-in `vi` module

**Patterns:**

**Environment variables:**
- Save original, modify in test, restore in afterEach
  - Example from `adapter.test.ts`:
    ```typescript
    beforeEach(() => {
      const originalEnv = process.env.LLM_PROVIDER;
    });

    it("test case", () => {
      process.env.LLM_PROVIDER = "anthropic";
      // ... test assertions
    });

    afterEach(() => {
      // Restore original
    });
    ```

**Module reloading:**
- Use `vi.resetModules()` when module-level state needs reset
- Import module dynamically in test after reset
  - Example from `domain-colors.test.ts`:
    ```typescript
    async function freshModule() {
      vi.resetModules();
      return import("../domain-colors");
    }

    it("test with fresh module state", async () => {
      const { getDomainColor } = await freshModule();
      // ... use function with clean state
    });
    ```

**What to Mock:**
- Environment variables (for conditional behavior)
- Module-level state when testing state mutations
- File system operations (if reading real files in tests)
- External API calls (not done yet in codebase, but pattern would be: `vi.mock("ai", { ... })`)

**What NOT to Mock:**
- Pure functions — call them directly
- Database queries — use actual test database or fixtures
- Validation schemas (Zod) — validate real data
- Routes/logic of internal modules — test the real implementation

## Fixtures and Factories

**Test Data:**
- No dedicated fixture factory pattern found yet
- Test data embedded inline within test blocks
- Example from `router.test.ts`:
  ```typescript
  it('returns "enrich" for a concept with no misconception match', () => {
    const result = routeQuestion("gravity", 5, "physics");
    expect(result.mode).toBe("enrich");
  });
  ```

**Location:**
- No `__fixtures__/` directory; test data created in describe blocks or test functions
- Reusable test helpers defined in test files (e.g., `freshModule()` helper in `domain-colors.test.ts`)

## Coverage

**Requirements:** Not enforced (no coverage config in vitest files)

**Current State:**
- No coverage threshold configured
- Packages have varying test coverage (observed: good coverage for core library, llm, router; missing for some web components)

**View Coverage:**
```bash
vitest --coverage              # Generate coverage report (if configured)
# Note: Requires @vitest/coverage-* package to be installed
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and modules in isolation
- Examples:
  - `adapter.test.ts`: Tests LLM adapter factory and adapter classes
  - `prompts.test.ts`: Tests prompt generation (text output validation)
  - `library.test.ts`: Tests YAML loading and schema validation
  - `router.test.ts`: Tests question routing logic

- Approach:
  - Call function with test input
  - Assert output matches expected behavior
  - Test both happy path and edge cases

**Integration Tests:**
- Scope: Multiple modules working together, data flow across layers
- Example: None explicitly named, but `library.test.ts` validates full YAML parsing + schema
- Example: `router.test.ts` integrates with loaded misconception library

**E2E Tests:**
- Status: Not implemented
- Would cover: Student question → AI response → concept extraction → routing → graph update
- Likely would test API endpoints and full request/response cycle

## Common Patterns

**Parameterized tests (mapped):**
- Test loop over multiple inputs
  - Example from `router.test.ts`:
    ```typescript
    for (const level of [0, 1, 5, 6, 8, 9, 12]) {
      // Test grade level mapping
      expect(gradeLevelToGradeBand(level)).toBe(...);
    }
    ```

**Async testing:**
- Used for async functions and server actions
- `async/await` in test body
  - Example from `domain-colors.test.ts`:
    ```typescript
    it("test async function", async () => {
      const { getDomainColor } = await freshModule();
      const color = await getDomainColor("physics");
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
    ```

**Error testing:**
- Check that functions throw with specific error messages
  - Example from `adapter.test.ts`:
    ```typescript
    it("throws when LLM_PROVIDER is an unknown value", () => {
      process.env.LLM_PROVIDER = "invalid-provider";
      expect(() => createLLMAdapter()).toThrow("Unknown LLM provider: invalid-provider");
    });
    ```

- Validation with `expect().not.toThrow()`
  - Example from `library.test.ts`:
    ```typescript
    it("loads without schema errors", () => {
      expect(() => loadLibrary()).not.toThrow();
    });
    ```

**Regex matching in assertions:**
- Used for pattern validation (e.g., hex colors, format validation)
  - Example from `prompts.test.ts`:
    ```typescript
    expect(prompt.toLowerCase()).toMatch(/follow.up|thought.provoking|question/i);
    expect(prompt).not.toMatch(/\{name\}|\{email\}/i);
    ```

**Type safety in tests:**
- Test code is TypeScript; caught by compiler
- Example: `type LoginFormValues = z.infer<typeof loginSchema>` ensures test data matches schema

## Testing Patterns by Feature

**Schema validation (Zod):**
- Load YAML, parse with schema, validate all entries
  - Example from `library.test.ts`:
    ```typescript
    it("covers all 4 required domains", () => {
      const library = loadLibrary();
      const domains = new Set(library.map((e) => e.domain));
      expect(domains).toEqual(new Set(["physics", "biology", "math", "history"]));
    });
    ```

**Adapter pattern (LLM providers):**
- Test factory returns correct adapter for each provider
- Test adapter has required methods/interfaces
  - Example from `adapter.test.ts`:
    ```typescript
    it("returns an AnthropicAdapter when LLM_PROVIDER=anthropic", () => {
      process.env.LLM_PROVIDER = "anthropic";
      const adapter = createLLMAdapter();
      expect(adapter).toBeInstanceOf(AnthropicAdapter);
    });
    ```

**String matching and normalization:**
- Test case-insensitivity and whitespace handling
  - Example from `router.test.ts`:
    ```typescript
    it("matching is case-insensitive", () => {
      const lower = routeQuestion("heavier objects fall faster", 5, "physics");
      const upper = routeQuestion("HEAVIER OBJECTS FALL FASTER", 5, "physics");
      const mixed = routeQuestion("Heavier Objects Fall Faster", 5, "physics");
      expect(lower.mode).toBe("diagnose");
      expect(upper.mode).toBe("diagnose");
      expect(mixed.mode).toBe("diagnose");
    });
    ```

**Component filters and grouping:**
- Test domain grouping expansion and filter logic
  - Example from `graph-filters.test.ts`:
    ```typescript
    it("expands 'science' to a Set containing its seven child domains", () => {
      const result = expandDomainQuery("science");
      expect(result).toEqual(new Set([...]));
    });
    ```

## Coverage Gaps

**Identified untested areas:**

**Web app components:**
- `login-form.tsx`: Component rendering, form submission, error handling not tested
- `question-form.tsx`: Streaming response, error message generation not tested
- `spiral-background.tsx`: Canvas animation logic untested
- Graph visualization components: D3.js rendering untested
- Dashboard pages: Server-side data fetching untested

**Server actions:**
- `auth.ts` actions: Password hashing, database writes, redirect behavior untested
- `questions.ts` streak calculation: Complex date logic has potential edge cases (untested)
- `graph.ts` graph operations: Node/edge creation and updates untested
- `class.ts` class management: Untested

**Database layer:**
- `queries/concepts.ts`: Query building and filtering untested
- Schema migrations: No test coverage
- Database transactions: No integration tests

**Recommendation:** Add integration tests for:
1. Full request cycle (question → response → graph update)
2. Database operations (CRUD, constraints)
3. Authentication flow (signup, login, session)
4. Server action error scenarios

---

*Testing analysis: 2026-04-09*
