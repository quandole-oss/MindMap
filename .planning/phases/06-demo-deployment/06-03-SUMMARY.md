---
phase: 06-demo-deployment
plan: "03"
subsystem: privacy-compliance
tags: [coppa, priv-01, priv-03, cleanup, cron, data-retention]
dependency_graph:
  requires: []
  provides: [COPPA-TTL-cleanup, PRIV-01-audit-sign-off]
  affects: [packages/db, apps/web/api]
tech_stack:
  added: []
  patterns: [bearer-token-cron-auth, drizzle-delete-returning, cascade-delete-via-fk]
key_files:
  created:
    - apps/web/app/api/cron/cleanup/route.ts
    - packages/db/src/queries/cleanup.ts
  modified:
    - packages/db/src/index.ts
decisions:
  - "CRON_SECRET returns 503 (not 401) when env var is absent — distinguishes misconfiguration from bad auth"
  - "deleteExpiredUsers uses lte + isNotNull rather than raw SQL — type-safe, index-friendly"
  - "PRIV-01 audit: no code changes needed — all LLM call sites were already compliant by design"
metrics:
  duration_seconds: 420
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 06 Plan 03: COPPA TTL Cleanup and PRIV-01 Audit Summary

**One-liner:** COPPA cleanup endpoint deletes expired student records via bearer-token-protected cron route; PRIV-01 audit confirms zero PII reaches LLM providers across all 9 call sites.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement COPPA TTL cleanup query and API endpoint | 41c5837 | packages/db/src/queries/cleanup.ts, packages/db/src/index.ts, apps/web/app/api/cron/cleanup/route.ts |
| 2 | Audit PRIV-01 compliance across all LLM call sites | (no code changes — audit only) | All LLM prompt files + API routes verified |

---

## What Was Built

### Task 1: COPPA TTL Cleanup

**`packages/db/src/queries/cleanup.ts`** — `deleteExpiredUsers()` function:
- Deletes users where `expiresAt IS NOT NULL AND expiresAt <= now()`
- Teacher accounts (null `expiresAt`) are never deleted
- Returns count of deleted users for logging
- Cascading deletes via FK constraints automatically remove: questions, concepts, conceptEdges, conceptQuestions, classEnrollments, diagnosticSessions, sessions, accounts

**`apps/web/app/api/cron/cleanup/route.ts`** — GET /api/cron/cleanup:
- Bearer token auth via `CRON_SECRET` env var
- Returns 503 when `CRON_SECRET` not configured (misconfiguration signal)
- Returns 401 on missing or wrong Authorization header
- Returns 200 `{ ok: true, deletedCount }` on success
- Returns 500 on DB errors
- Callable by Vercel Cron (vercel.json) or system cron via curl

**`packages/db/src/index.ts`** — Re-exports `deleteExpiredUsers` for use by API layer.

### Task 2: PRIV-01 Audit

Verified all 9 LLM call sites. All pass.

| Call Site | Function | Data Sent to LLM | Status |
|-----------|----------|-----------------|--------|
| `/api/ask` | `streamText` | `system=buildEnrichSystemPrompt(gradeLevel)`, `prompt=question` | PASS |
| `/api/ask` | `extractConcepts(question, text)` | question text + AI response text | PASS |
| `/api/ask` | `disambiguateConcept(name, domain, candidates, question)` | concept names, domain strings, question text | PASS |
| `/api/ask` | `generateEmbedding(concept.name)` | concept name only (max 500 chars enforced) | PASS |
| `/api/diagnose` | `buildProbeSystemPrompt(probeQuestion, gradeLevel, originalQuestion)` | library probe text + grade level + original question text | PASS |
| `/api/diagnose` | `buildConfrontSystemPrompt(misconceptionName, probeResponse, confrontationSeed, gradeLevel)` | misconception name (library) + student typed response + confrontation seed (library) + grade level | PASS |
| `/api/diagnose` | `evaluateResolution({misconceptionName, probeResponse, confrontationUsed, studentFinalResponse})` | misconception name (library) + student typed content | PASS |
| `/api/diagnose` | `buildResolveMessage(misconceptionName, resolved)` | misconception name (library) + boolean | PASS |
| `embeddings.ts` | `generateEmbedding(text)` | concept name string only | PASS |

**Verdict:** PRIV-01 COMPLIANT — No student PII (name, email, user ID) crosses the application→LLM API trust boundary at any call site. The `userId` variable in both API routes is used exclusively for DB queries and ownership checks, never passed to any LLM function.

**Note on `studentProbeResponse`:** This is the student's typed answer text (content they authored), not PII. It is categorically equivalent to `question` text — educational content, not identity data.

---

## Threat Model Coverage

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-06-07 | mitigate | Bearer token auth via `CRON_SECRET`; 401 on invalid; 503 when not configured |
| T-06-08 | mitigate | PRIV-01 audit confirms zero PII in any prompt path across 9 call sites |
| T-06-09 | accept | Cleanup runs on schedule, not user-triggered; cascade bounded by per-user data volume |
| T-06-10 | mitigate | WHERE clause enforces `expiresAt IS NOT NULL AND expiresAt <= now`; teacher accounts immune |

---

## Deviations from Plan

None — plan executed exactly as written. Task 2 produced no code changes, as expected (audit-only task, all sites were already PRIV-01 compliant by design from Phase 2).

---

## Known Stubs

None. The cleanup endpoint is fully wired — `deleteExpiredUsers` executes a real DB DELETE with real WHERE logic. The PRIV-01 audit is definitive.

---

## Threat Flags

None. The new endpoint `/api/cron/cleanup` is in the threat model as T-06-07 and is fully mitigated via bearer token auth.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `packages/db/src/queries/cleanup.ts` | FOUND |
| `apps/web/app/api/cron/cleanup/route.ts` | FOUND |
| `packages/db/src/index.ts` (updated with cleanup export) | FOUND |
| `.planning/phases/06-demo-deployment/06-03-SUMMARY.md` | FOUND |
| Commit 41c5837 (feat(06-03): COPPA TTL cleanup) | FOUND |
