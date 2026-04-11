---
status: awaiting_human_verify
trigger: "Log out button in sidebar does nothing from the user's perspective"
created: 2026-04-10
updated: 2026-04-10
---

## Current Focus

hypothesis: CONFIRMED — `signOut({ redirect: false })` clears the session but never throws NEXT_REDIRECT, so no navigation happens.
test: Fix applied (`redirectTo: "/"`). Build + tests passed.
expecting: User confirms logout now navigates to "/" in browser.
next_action: Human verification in real browser.

## Symptoms

expected: Clicking "Log out" in sidebar clears session AND navigates browser to "/" (landing page).
actual: Clicking "Log out" appears to do nothing. User stays on same page. Session IS cleared server-side.
errors: No runtime or console errors.
reproduction: Log in as teacher@demo.mindmap / teacher123 at localhost:3000/login, click "Log out" in sidebar, observe no navigation.
started: Never worked visibly. Introduced in Phase 1 Plan 03 (auth scaffolding).

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-10
  checked: apps/web/actions/auth.ts:90-92
  found: `signOutAction` calls `signOut({ redirect: false })`
  implication: Auth.js v5 clears session but does NOT throw NEXT_REDIRECT, so Next.js server action completes silently with no navigation.

- timestamp: 2026-04-10
  checked: apps/web/package.json
  found: `"next-auth": "beta"` → installed version 5.0.0-beta.30 (from node_modules/next-auth/package.json)
  implication: Supports `redirectTo` option (added in Auth.js v5 beta). Fix is compatible.

- timestamp: 2026-04-10
  checked: grep signOutAction across repo
  found: Three call sites — sidebar.tsx:102, app-shell.tsx:78, app-shell.tsx:126. All are plain `<form action={signOutAction}>` server-action forms with no client-side onClick/navigation fallback.
  implication: Fixing the action itself fixes all three call sites at once. Out-of-scope call sites unaffected.

- timestamp: 2026-04-10
  checked: signInAction in apps/web/actions/auth.ts:65-88
  found: Uses `redirect: false` intentionally — the client form reads the returned `{ success, role }` and navigates based on role. Independent from signOut.
  implication: Fix does not affect signInAction.

## Resolution

root_cause: `signOutAction` used `signOut({ redirect: false })`. In Auth.js v5, `redirect: false` suppresses the NEXT_REDIRECT throw, so the server action returns silently and the browser never navigates. Clicking the button cleared the session but left the user on the same page, making the button appear broken.
fix: Changed `signOut({ redirect: false })` to `signOut({ redirectTo: "/" })`. Auth.js v5 throws NEXT_REDIRECT, which Next.js catches inside the server action and executes a browser navigation to "/".
verification: `pnpm build` in apps/web — passed cleanly (all 17 routes compiled). `pnpm vitest run` — 5 test files, 92 tests, all passed. Fix is one line in one file; affects all three `signOutAction` call sites (sidebar.tsx + app-shell.tsx x2) uniformly. Awaiting human browser verification.
files_changed:
  - apps/web/actions/auth.ts
