---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | — | Password hashed with bcrypt | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-02 | — | Teacher role stored in DB | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-03 | — | Session persists across refresh | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | AUTH-04 | — | Logout clears session | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | AUTH-05 | — | Join code is 6-char alphanumeric | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | AUTH-06 | — | Student joins class via code | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | AUTH-07 | — | Teacher sees roster | integration | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | AUTH-08 | — | Grade level stored as integer | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | MISC-01 | — | YAML loads 35+ entries | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 1 | MISC-02 | — | Each entry has required fields | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 1 | MISC-03 | — | CI validates schema | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 1 | INFR-06 | — | expires_at column exists | unit | `pnpm test` | ❌ W0 | ⬜ pending |
| 1-04-02 | 04 | 1 | PRIV-02 | — | Data scoped to instance | unit | `pnpm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` installed in workspace root
- [ ] `vitest.workspace.ts` configured for monorepo packages
- [ ] `packages/misconceptions/__tests__/` — stubs for MISC-01, MISC-02, MISC-03
- [ ] `packages/db/__tests__/` — stubs for schema validation (INFR-06, PRIV-02)
- [ ] `apps/web/__tests__/` — stubs for auth flows (AUTH-01 through AUTH-08)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser refresh preserves session | AUTH-03 | Requires actual browser session | Log in, close tab, reopen — should remain logged in |
| Join code dictation in classroom | AUTH-05 | UX verification | Verify code is readable/speakable (no ambiguous chars) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
