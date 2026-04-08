---
plan: 02-02
phase: 02-curiosity-engine
status: complete
started: 2026-04-08
completed: 2026-04-08
---

# Plan 02-02 Summary: DB Schema for Curiosity Engine

## What Was Built

Three new Drizzle schema tables pushed to PostgreSQL:
- **questions**: id, userId (FK users), text, aiResponse, routingMode (enrich/diagnose enum), routingMisconceptionId, createdAt. Index on (userId, createdAt) for one-per-day queries.
- **concepts**: id, userId (FK users), name, domain, status (unprobed/healthy/misconception), createdAt
- **concept_questions**: id, conceptId (FK concepts), questionId (FK questions) — many-to-many join

Schema exported from `@mindmap/db` via `packages/db/src/schema/index.ts`.

## Requirements Addressed

- CURI-01: Index on userId + createdAt enables efficient one-per-day enforcement ✓
- CURI-04: Questions table stores full history with timestamps ✓
- CURI-07: Concepts table stores extracted concepts as graph nodes ✓

## Key Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/questions.ts` | questions, concepts, conceptQuestions tables |
| `packages/db/src/schema/index.ts` | Updated exports |

## Commits

| Hash | Message |
|------|---------|
| ffaeb62 | feat(02-02): add questions, concepts, concept_questions tables |

## Deviations

- Changed from `uniqueIndex` with `sql\`DATE()\`` expression (drizzle-kit push error 42P17) to regular `index` on (userId, createdAt). One-per-day enforcement remains at application level via date-range query in server action.

## Self-Check: PASSED
