---
phase: 03-knowledge-graph
plan: 01
subsystem: db-schema, llm-embeddings
tags: [pgvector, embeddings, schema-migration, concept-edges, d3]
dependency_graph:
  requires: [02-curiosity-engine]
  provides: [vector-schema, embedding-function, concept-edges-table]
  affects: [packages/db, packages/llm, apps/web]
tech_stack:
  added: ["@ai-sdk/openai@3.0.52", "d3@7.9.0", "@types/d3"]
  patterns: [pgvector-hnsw, cosine-similarity-index, drizzle-vector-column, ai-sdk-embed]
key_files:
  created:
    - packages/llm/src/embeddings.ts
    - apps/web/components/ui/sheet.tsx
    - apps/web/components/ui/tooltip.tsx
  modified:
    - packages/db/src/schema/questions.ts
    - packages/llm/src/index.ts
    - packages/llm/package.json
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "Sheet component implemented via @base-ui/react Drawer primitives (no Radix UI in project)"
  - "Tooltip component implemented via @base-ui/react Tooltip primitives"
  - "visitCount default set to 0 (not 1) — plan said 1 but 0 is semantically correct for a never-visited concept"
metrics:
  duration_seconds: 225
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 6
---

# Phase 3 Plan 1: pgvector Schema and Embedding Infrastructure Summary

**One-liner:** pgvector vector(1536) column + HNSW index on concepts, concept_edges table with edge_type enum, and generateEmbedding() using OpenAI text-embedding-3-small via @ai-sdk/openai.

---

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Install deps + update Drizzle schema with vector support | `38b1599` | DONE |
| 2 | Create embedding generation function and export from @mindmap/llm | `1dfe7e3` | DONE |

---

## What Was Built

### Task 1: Schema + Dependencies

**`packages/db/src/schema/questions.ts`** updated:
- `embedding: vector("embedding", { dimensions: 1536 })` — nullable column, existing rows remain valid
- `visitCount: integer("visit_count").notNull().default(0)` — tracks concept appearances
- `index("concepts_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))` — HNSW cosine similarity index
- `edgeTypeEnum = pgEnum("edge_type", ["curiosity_link", "bridge", "misconception_cluster"])` — edge type values
- `conceptEdges` table with sourceConceptId, targetConceptId, edgeType FK references and unique constraint on `(sourceConceptId, targetConceptId, edgeType)`

**Dependencies installed:**
- `@ai-sdk/openai@^3.0.52` in `@mindmap/llm` — OpenAI embedding provider
- `d3@^7.9.0` + `@types/d3` in `apps/web` — D3.js graph visualization
- `sheet.tsx` + `tooltip.tsx` shadcn-style components created manually using `@base-ui/react` Drawer and Tooltip primitives (npx shadcn add was not available in this environment)

**Database:** pgvector extension enabled, schema pushed via drizzle-kit push. Verified:
- `concepts` table: `embedding USER-DEFINED (vector)`, `visit_count integer`
- `concept_edges` table: all columns present
- HNSW index: `CREATE INDEX concepts_embedding_hnsw_idx ON public.concepts USING hnsw (embedding vector_cosine_ops)`

### Task 2: Embedding Generation Function

**`packages/llm/src/embeddings.ts`** created:
- `generateEmbedding(text: string): Promise<number[]>` using `embed()` from Vercel AI SDK
- Model: `openai.embedding("text-embedding-3-small")` — 1536 dimensions, locked decision
- Input validation: throws on empty string or text > 500 chars (T-03-01 PII mitigation)
- JSDoc documents OPENAI_API_KEY requirement and PII constraint

**`packages/llm/src/index.ts`** updated:
- Added `export { generateEmbedding } from "./embeddings"`

---

## Verification

```
pnpm build → 5 successful, 5 total (all tasks pass)

concepts table: [id, user_id, name, domain, status, created_at, embedding, visit_count]
concept_edges table: [id, source_concept_id, target_concept_id, edge_type, created_at]
HNSW index: CREATE INDEX concepts_embedding_hnsw_idx ON public.concepts USING hnsw (embedding vector_cosine_ops)
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Sheet/Tooltip created manually instead of via npx shadcn add**
- **Found during:** Task 1 — `npx shadcn@latest add sheet tooltip` required shell cd which was unavailable
- **Fix:** Created `sheet.tsx` using `@base-ui/react` Drawer primitives and `tooltip.tsx` using `@base-ui/react` Tooltip primitives, matching the project's existing component pattern (alert-dialog.tsx uses base-ui)
- **Files modified:** `apps/web/components/ui/sheet.tsx`, `apps/web/components/ui/tooltip.tsx`
- **Commit:** `38b1599`

**2. [Rule 1 - Semantic Accuracy] visitCount default set to 0 instead of plan's "default 1"**
- **Found during:** Task 1 — plan context says "default 1" but the important_context says "default 0" and 0 is semantically correct for a brand-new concept that hasn't been visited yet
- **Fix:** Used `default(0)` — visitCount increments when a concept is linked to a question, so 0 is the correct initial state
- **Files modified:** `packages/db/src/schema/questions.ts`

---

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| (none) | — | No new network endpoints or auth paths introduced. All changes are schema + utility function. |

---

## Known Stubs

None. This plan is infrastructure-only — no UI rendering stubs introduced.

---

## Self-Check: PASSED

- FOUND: packages/llm/src/embeddings.ts
- FOUND: apps/web/components/ui/sheet.tsx
- FOUND: apps/web/components/ui/tooltip.tsx
- FOUND: packages/db/src/schema/questions.ts (modified)
- FOUND commit 38b1599: feat(03-01): add pgvector schema, concept_edges table, and install dependencies
- FOUND commit 1dfe7e3: feat(03-01): add generateEmbedding() to @mindmap/llm using OpenAI text-embedding-3-small
