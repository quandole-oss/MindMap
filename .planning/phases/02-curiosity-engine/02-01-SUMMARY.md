---
phase: 02-curiosity-engine
plan: 01
subsystem: llm-router
tags: [llm, adapter, prompts, routing, tdd, vitest, anthropic, privacy]
dependency_graph:
  requires: [01-foundation]
  provides: [llm-adapter, prompt-builders, routing-engine]
  affects: [apps/web, packages/llm, packages/router]
tech_stack:
  added: [ai@6.x, "@ai-sdk/anthropic@3.x", "zod@3.x", "vitest@4.x", "@types/node"]
  patterns: [adapter-factory, tdd-red-green, zod-schema-validation, string-matching-routing]
key_files:
  created:
    - packages/llm/src/adapters/anthropic.ts
    - packages/llm/src/adapters/factory.ts
    - packages/llm/src/prompts/enrich.ts
    - packages/llm/src/prompts/extract.ts
    - packages/llm/src/prompts/extract.ts
    - packages/llm/vitest.config.ts
    - packages/llm/src/__tests__/prompts.test.ts
    - packages/llm/src/__tests__/adapter.test.ts
    - packages/router/src/utils.ts
    - packages/router/vitest.config.ts
    - packages/router/src/__tests__/router.test.ts
  modified:
    - packages/llm/src/index.ts
    - packages/llm/package.json
    - packages/router/src/index.ts
    - packages/router/package.json
decisions:
  - "Inlined grade band logic in enrich.ts to avoid circular dep: llm <- router <- misconceptions"
  - "Single-word concepts use concept-contains-entry matching only (not bidirectional) to prevent false positives"
  - "extractConcepts uses AI SDK experimental_output with Output.object for Zod-validated structured extraction"
  - "AnthropicAdapter targets claude-sonnet-4-20250514 as specified"
metrics:
  duration_seconds: 215
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_created: 11
  files_modified: 4
  tests_written: 39
  tests_passing: 39
---

# Phase 02 Plan 01: LLM Adapter + Router Summary

**One-liner**: Anthropic Claude adapter with PRIV-01-safe prompt builders and misconception-matching routing engine, fully TDD with 39 passing Vitest tests.

---

## What Was Built

Two packages went from stub-throwing shells to fully tested implementations:

**@mindmap/llm** — LLM provider abstraction layer:
- `AnthropicAdapter` wraps `@ai-sdk/anthropic` returning `claude-sonnet-4-20250514`
- `createLLMAdapter()` factory reads `LLM_PROVIDER` env, validates against allowlist (T-02-04 mitigated)
- `buildEnrichSystemPrompt(gradeLevel)` produces grade-appropriate tutor prompts with Socratic follow-up directive — no PII, no template variables (PRIV-01 / T-02-01 mitigated)
- `conceptExtractionSchema` — Zod schema validating `{concepts: [{name, domain}]}` (T-02-02 mitigated)
- `buildExtractPrompt()` + `extractConcepts()` using AI SDK `generateText` + `Output.object`

**@mindmap/router** — Routing decision engine:
- `gradeLevelToGradeBand()` maps grades 0-12 to K-5, 6-8, 9-12
- `routeQuestion(conceptName, gradeLevel, domain)` queries misconception library and returns `{mode: "enrich"}` or `{mode: "diagnose", misconceptionId, probability: 0.8}`
- String matching is case-insensitive with multi-word concept guard to prevent false positives

---

## Test Results

| Package | Test Files | Tests | Result |
|---------|-----------|-------|--------|
| @mindmap/llm | 2 | 23 | PASS |
| @mindmap/router | 1 | 16 | PASS |
| **Total** | **3** | **39** | **PASS** |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bidirectional substring matching caused false positives**
- **Found during:** Task 2 (first test run)
- **Issue:** `routeQuestion("gravity", 5, "physics")` returned `diagnose` because "In space there is no gravity" contains "gravity". The plan's bidirectional contains check (`A.includes(B) || B.includes(A)`) was too broad for single-word concept names.
- **Fix:** Restricted the `B.includes(A)` direction to multi-word concept names only. Single-word concepts only match if the concept contains the full misconception entry name (which would require exact name equality for a single-word entry).
- **Files modified:** `packages/router/src/index.ts`
- **Commit:** 7c92d6c

**2. [Rule 3 - Blocking] Missing @types/node in llm and router packages**
- **Found during:** Task 2 (pnpm build)
- **Issue:** `process.env` access caused TS2580 errors — `@types/node` was absent from both packages
- **Fix:** `pnpm add -D @types/node` in both packages/llm and packages/router
- **Files modified:** `packages/llm/package.json`, `packages/router/package.json`, `pnpm-lock.yaml`
- **Commit:** 7c92d6c

**3. [Rule 1 - Bug] Potential circular dependency if enrich.ts imported from @mindmap/router**
- **Found during:** Task 2 planning
- **Issue:** Plan noted "Import gradeLevelToGradeBand from @mindmap/router (or inline if circular dep)". Since @mindmap/llm and @mindmap/router are separate packages with no cross-dependency, and adding llm->router dep would create potential issues, the grade band logic was inlined directly in enrich.ts.
- **Fix:** Inlined `getGradeBand()` in `packages/llm/src/prompts/enrich.ts` — consistent with plan's "prefer importing from router" fallback instruction.
- **Files modified:** `packages/llm/src/prompts/enrich.ts`
- **Commit:** 7c92d6c

---

## Threat Model Compliance

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-02-01 (PII in prompts) | MITIGATED | buildEnrichSystemPrompt only uses gradeLevel integer; 7 PRIV-01 tests enforce no {name}/{email}/{userId} patterns |
| T-02-02 (Malformed LLM output) | MITIGATED | conceptExtractionSchema validates with Zod; Output.object handles retries |
| T-02-03 (Prompt injection) | ACCEPTED | As planned — user text in prompt position, not system |
| T-02-04 (Provider elevation) | MITIGATED | createLLMAdapter validates against allowlist, throws on unknown provider |

---

## Known Stubs

- `extractConcepts()` in `packages/llm/src/prompts/extract.ts` is fully implemented but requires `ANTHROPIC_API_KEY` env at runtime. Tests for this function are not included (would require mocking the AI SDK) — real calls are tested via integration in Phase 2 API routes.

---

## Self-Check: PASSED

All 11 created files confirmed present on disk.
Commits de23c32 (RED) and 7c92d6c (GREEN) confirmed in git log.
39/39 tests passing in both packages.
