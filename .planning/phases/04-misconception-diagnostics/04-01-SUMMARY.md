---
phase: 04-misconception-diagnostics
plan: "01"
subsystem: diagnostic-foundation
tags:
  - drizzle
  - postgresql
  - llm-prompts
  - server-actions
  - misconception-detection
dependency_graph:
  requires:
    - "03-04: concepts table with status enum"
    - "02-01: /api/ask route with onFinish callback"
    - "01-01: misconception library with probe_questions/confrontation_scenarios"
    - "01-01: users table for FK references"
  provides:
    - "diagnostic_sessions table in PostgreSQL"
    - "buildProbeSystemPrompt from @mindmap/llm"
    - "buildConfrontSystemPrompt from @mindmap/llm"
    - "evaluateResolution, buildResolveMessage from @mindmap/llm"
    - "getActiveSession, getSessionById, getSessionsForUser server actions"
    - "/api/ask diagnose branch: creates session + sets concept status to misconception"
  affects:
    - "04-02: diagnostic chat API route consumes diagnosticSessions table and prompt builders"
tech_stack:
  added:
    - "jsonb column with $defaultFn workaround for UIMessage[] array type"
    - "pgEnum for diagnostic_stage (probe/classify/confront/resolve)"
    - "pgEnum for diagnostic_outcome (resolved/unresolved/incomplete)"
    - "generateText + Output.object pattern for evaluateResolution structured output"
  patterns:
    - "enrich.ts grade band helper replicated in probe and confront prompt builders"
    - "extract.ts generateText+Output.object pattern reused for evaluateResolution"
    - "questions.ts server action pattern (auth() + userId filter) for diagnostic.ts"
key_files:
  created:
    - packages/db/src/schema/diagnostic-sessions.ts
    - packages/llm/src/prompts/diagnose-probe.ts
    - packages/llm/src/prompts/diagnose-confront.ts
    - packages/llm/src/prompts/diagnose-resolve.ts
    - apps/web/actions/diagnostic.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/llm/src/index.ts
    - apps/web/app/api/ask/route.ts
decisions:
  - "questionId FK uses onDelete: set null (not cascade) — avoids losing diagnostic session when question is deleted"
  - "$defaultFn(() => []) for jsonb messages avoids Drizzle jsonb array default bug; application-level default only"
  - "diagnose branch placed after createConceptEdges in onFinish so all concept IDs are available before session insert"
  - "getActiveSession filters by isNull(outcome) not by stage — outcome=null means session is open regardless of current stage"
metrics:
  duration_seconds: 480
  completed_date: "2026-04-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 3
---

# Phase 4 Plan 1: Diagnostic Foundation Summary

**One-liner:** PostgreSQL `diagnostic_sessions` table with stage/outcome enums + Socratic prompt builders for probe/confront/resolve + `/api/ask` diagnose branch creating sessions on misconception routing.

## What Was Built

### Task 1: diagnostic_sessions Schema

Created `packages/db/src/schema/diagnostic-sessions.ts` with:
- `diagnosticStageEnum`: `probe | classify | confront | resolve`
- `diagnosticOutcomeEnum`: `resolved | unresolved | incomplete`
- `diagnosticSessions` table: id (UUID PK), userId (FK users), conceptId (FK concepts), questionId (FK questions, nullable, onDelete SET NULL), misconceptionId (library ID), misconceptionName (human-readable), stage (enum, default probe), outcome (nullable until resolve), messages (jsonb UIMessage[], $defaultFn workaround), createdAt, updatedAt
- Index on `(userId, createdAt)` for efficient session lookups
- Schema exported from `packages/db/src/schema/index.ts`
- Pushed to PostgreSQL via `drizzle-kit push` — applied successfully

### Task 2: LLM Prompt Builders + Route Modification + Server Actions

**Prompt builders (packages/llm/src/prompts/):**

- `diagnose-probe.ts`: `buildProbeSystemPrompt(probeQuestion, gradeLevel, originalQuestion)` — Socratic probe stage; reuses K-5/6-8/9-12 grade band logic; instructs LLM to ask exactly one question without hints at correctness; T-04-03 compliant (never mentions "misconception"/"wrong"/"incorrect")
- `diagnose-confront.ts`: `buildConfrontSystemPrompt(misconceptionName, studentProbeResponse, confrontationSeed, gradeLevel)` — cognitive conflict stage; misconceptionName in system prompt for LLM context only with explicit instruction never to reveal it; personalized to student's probe response
- `diagnose-resolve.ts`: `evaluateResolution()` using `generateText + Output.object` (same pattern as extract.ts) with generous evaluation criteria; `buildResolveMessage()` for warm final reveal with misconception name

**@mindmap/llm index.ts:** Exported all three new prompt builder functions plus `ResolutionResult` type.

**apps/web/app/api/ask/route.ts:** Added diagnose branch in `onFinish`:
1. Imports `getMisconceptionById` from `@mindmap/misconceptions`
2. After `createConceptEdges`, checks `primaryDecision.mode === "diagnose"`
3. Looks up misconception entry from library
4. Updates concept status to `"misconception"` via Drizzle update
5. Inserts `diagnosticSessions` row with stage=probe, messages=[]
6. Logs session creation; warns if misconception ID not found in library

**apps/web/actions/diagnostic.ts:** Three server actions with `"use server"` + `auth()` userId-from-session protection (T-04-01 mitigation):
- `getActiveSession(conceptId?)`: Most recent open session (outcome IS NULL), optional concept filter
- `getSessionById(sessionId)`: Single session with ownership verification
- `getSessionsForUser()`: Last 20 sessions ordered by createdAt desc

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

All mitigations from the plan's threat register were applied:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-04-01: EoP on server actions | Every action calls `auth()` and filters by `session.user.id` |
| T-04-02: Tampering via onFinish | Session creation runs server-side in onFinish; no client influence |
| T-04-03: Info disclosure in probe prompt | Prompt never includes misconception name; LLM instructed to avoid corrective language |
| T-04-04: Tampering on messages column | Messages only written server-side; client never directly writes to column |

No new threat surface introduced beyond the plan's threat model.

## Self-Check

### Files Created/Modified Exist

- [x] `packages/db/src/schema/diagnostic-sessions.ts` — created
- [x] `packages/db/src/schema/index.ts` — modified (export added)
- [x] `packages/llm/src/prompts/diagnose-probe.ts` — created
- [x] `packages/llm/src/prompts/diagnose-confront.ts` — created
- [x] `packages/llm/src/prompts/diagnose-resolve.ts` — created
- [x] `packages/llm/src/index.ts` — modified (exports added)
- [x] `apps/web/app/api/ask/route.ts` — modified (diagnose branch added)
- [x] `apps/web/actions/diagnostic.ts` — created

### Commits Exist

- Task 1: `8e2d3cd` — feat(04-01): create diagnostic_sessions schema and push to database
- Task 2: `17cc7e7` — feat(04-01): add diagnostic prompt builders, diagnose branch in /api/ask, server actions

## Self-Check: PASSED
