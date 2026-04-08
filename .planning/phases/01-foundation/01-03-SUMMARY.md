---
plan: 01-03
phase: 01-foundation
status: complete
started: 2026-04-08
completed: 2026-04-08
---

# Plan 01-03 Summary: Auth.js v5 + Landing Page + App Shell

## What Was Built

- **Auth.js v5** with DrizzleAdapter, database sessions, Credentials provider
- **Server actions**: signUp (bcryptjs hash, role support), signIn, signOut
- **Middleware**: route protection redirecting unauthenticated users, role-based routing (students → /student, teachers → /teacher)
- **Landing page**: hero with "Get Started" and "Log In" CTAs
- **Auth UI**: signup form with student/teacher role toggle, login form
- **App shell**: sidebar navigation with logout, responsive layout
- **Student/teacher dashboards**: empty state shells ready for Phase 2+
- **shadcn/ui**: initialized with Tailwind v4, components installed (button, input, label, card, form, separator, toggle-group)

## Requirements Addressed

- AUTH-01: Student can sign up with email and password ✓
- AUTH-02: Teacher can sign up with teacher role ✓
- AUTH-03: User stays logged in across browser refresh (database sessions) ✓
- AUTH-04: User can log out from any page (sidebar logout button) ✓

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/lib/auth.ts` | Auth.js v5 config with DrizzleAdapter |
| `apps/web/actions/auth.ts` | signUp/signIn/signOut server actions |
| `apps/web/middleware.ts` | Route protection + role-based redirects |
| `apps/web/app/page.tsx` | Landing page |
| `apps/web/app/(auth)/signup/page.tsx` | Signup page |
| `apps/web/app/(auth)/login/page.tsx` | Login page |
| `apps/web/components/layout/app-shell.tsx` | App shell wrapper |
| `apps/web/components/layout/sidebar.tsx` | Sidebar navigation |

## Commits

| Hash | Message |
|------|---------|
| 5ca76ef | feat(01-03): implement Auth.js v5 with landing page and app shell |

## Deviations

- shadcn/ui Button `asChild` prop not available in current version — used Link wrapping Button instead
- Added `@types/node` to misconceptions package (build fix from Wave 1)
- Added `drizzle-orm` as direct dependency of apps/web (needed for `eq` import in server actions)

## Self-Check: PASSED
