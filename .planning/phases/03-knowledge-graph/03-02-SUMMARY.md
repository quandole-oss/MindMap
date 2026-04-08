---
plan: 03-02
phase: 03-knowledge-graph
status: complete
started: 2026-04-08
completed: 2026-04-08
---

# Plan 03-02 Summary: Two-Stage Concept Dedup Pipeline

## What Was Built

- `packages/db/src/queries/concepts.ts` — `findSimilarConcepts()` using pgvector cosine distance (ORDER BY ASC for HNSW index), `deduplicateAndStoreConcepts()` orchestrating two-stage pipeline, `createConceptEdges()` for curiosity_link edges between same-question concepts
- `packages/llm/src/prompts/disambiguate.ts` — LLM disambiguation prompt for ambiguous similarity band (0.85-0.92), asks "Are these the same concept?" with domain context
- Updated `packages/db/src/index.ts` and `packages/llm/src/index.ts` with new exports

## Dedup Algorithm

1. For each extracted concept, generate embedding via `generateEmbedding()`
2. Query pgvector for nearest neighbors: `ORDER BY cosineDistance ASC` (hits HNSW index)
3. If similarity > 0.92: auto-merge (increment visitCount on existing concept)
4. If similarity 0.85-0.92: LLM disambiguation decides merge or new node
5. If similarity < 0.85: create new concept node with embedding
6. After all concepts resolved: create curiosity_link edges between all pairs from same question

## Requirements Addressed

- GRPH-02: Two-stage dedup (pgvector ANN + LLM disambiguation) ✓
- GRPH-03: Concept edges created between related concepts ✓

## Commits

| Hash | Message |
|------|---------|
| 34b7059 | feat(03-02): implement two-stage concept dedup pipeline |

## Self-Check: PASSED
