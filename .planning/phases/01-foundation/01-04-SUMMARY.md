---
plan: 01-04
phase: 01-foundation
status: complete
started: 2026-04-08
completed: 2026-04-08
subsystem: class-management
tags: [classes, enrollment, join-code, roster, teacher, student]
dependency_graph:
  requires: [01-03]
  provides: [class-crud, join-code-flow, roster-management]
  affects: [apps/web/app/teacher, apps/web/app/student, apps/web/actions]
tech_stack:
  added: [badge, table, alert-dialog (base-ui)]
  patterns: [server-actions, role-checked-mutations, two-query-auth, crypto.getRandomValues join codes]
key_files:
  created:
    - apps/web/actions/class.ts
    - apps/web/app/teacher/classes/new/page.tsx
    - apps/web/app/teacher/classes/[classId]/roster/page.tsx
    - apps/web/app/student/join/page.tsx
    - apps/web/components/class/create-class-form.tsx
    - apps/web/components/class/join-class-form.tsx
    - apps/web/components/class/class-roster.tsx
    - apps/web/components/class/join-code-display.tsx
    - apps/web/components/ui/badge.tsx
    - apps/web/components/ui/table.tsx
    - apps/web/components/ui/alert-dialog.tsx
  modified:
    - apps/web/app/teacher/page.tsx
    - apps/web/app/student/page.tsx
    - apps/web/components/layout/sidebar.tsx
decisions:
  - "Two-query pattern for removeStudentAction: fetch enrollment first, then verify class ownership — avoids needing Drizzle relation config"
  - "AlertDialogTrigger used directly (no asChild) — @base-ui/react Trigger does not support asChild prop"
  - "6-char join code charset ABCDEFGHJKLMNPQRSTUVWXYZ23456789 — excludes 0,O,1,I for classroom dictation readability"
metrics:
  duration: ~15 minutes
  completed: 2026-04-08
  tasks: 2
  files: 13
requirements:
  - AUTH-05
  - AUTH-06
  - AUTH-07
  - AUTH-08
---

# Phase 1 Plan 4: Class Management Summary

## One-liner

Teacher-to-student class management via 6-char alphanumeric join codes with role-checked server actions, roster table with AlertDialog removal, and grade level inheritance on enrollment.

## What Was Built

### Server Actions (`apps/web/actions/class.ts`)

- **`createClassAction`**: Teacher role check → generate unique 6-char code (charset excludes 0,O,1,I) → insert class with teacher ID and grade level → revalidate `/teacher`
- **`joinClassAction`**: Student role check → uppercase + validate code → look up class → check duplicate enrollment → insert enrollment inheriting class grade level → revalidate `/student`
- **`removeStudentAction`**: Auth check → fetch enrollment → verify teacher owns class → delete enrollment → revalidate roster
- **`getClassRoster`**: Teacher ownership check → SELECT with JOIN on users → return class + student list with names, emails, grade levels
- **`getTeacherClasses`**: Returns all classes owned by session teacher
- **`getStudentEnrollments`**: Returns all classes student is enrolled in with JOIN on classes

### UI Pages

- **`/teacher`**: Lists classes as cards with join code badge + grade badge. Empty state: "No classes yet" / "Create your first class and share the join code with your students."
- **`/teacher/classes/new`**: Renders `CreateClassForm` — shows join code + link to roster on success
- **`/teacher/classes/[classId]/roster`**: Server component fetches roster. Shows "No students yet" empty state or `ClassRoster` table with join code badge at top. Heading: `{Class Name} — Roster`
- **`/student`**: Lists enrollments. Empty state: "You haven't joined a class" / "Ask your teacher for the 6-character class code, then tap Join a class."
- **`/student/join`**: Renders `JoinClassForm`

### Components

- **`CreateClassForm`**: react-hook-form + Zod, class name + grade level dropdown (K and 1-12), shows `JoinCodeDisplay` + roster link on success
- **`JoinClassForm`**: Controlled input with auto-uppercase, 6-char limit, error display, success redirects to `/student`
- **`ClassRoster`**: shadcn Table with Student/Grade columns. Each row has `AlertDialog` trigger. Confirmation: "Remove student?" / "This will remove {name} from {class}. They can rejoin with the class code."
- **`JoinCodeDisplay`**: Badge with `#18181b` background, "Class join code" label, "Share this 6-character code with your students." helper text
- **Sidebar**: Teacher — My Classes + Create a Class; Student — Dashboard + Join a Class

### UI Components Added

- `badge.tsx` — variant-based badge with CVA
- `table.tsx` — semantic table with TableHeader, TableBody, TableRow, TableHead, TableCell
- `alert-dialog.tsx` — wraps `@base-ui/react/alert-dialog` with shadcn-style API

## Requirements Addressed

- AUTH-05: Teacher can create a class with name + grade level and receive 6-char join code ✓
- AUTH-06: Student can join a class using join code ✓
- AUTH-07: Teacher can view roster with student names/grade levels; can remove student with confirmation ✓
- AUTH-08: Grade level set by teacher at class creation; students inherit it at enrollment ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `asChild` not supported on `@base-ui/react` AlertDialogTrigger**
- **Found during:** Task 2 (first `pnpm build` attempt)
- **Issue:** `AlertDialogTrigger asChild` caused TypeScript error — `@base-ui/react` Trigger doesn't accept `asChild` prop like Radix UI does
- **Fix:** Removed `asChild` and applied button styles directly to `AlertDialogTrigger` via `className`
- **Files modified:** `apps/web/components/class/class-roster.tsx`
- **Commit:** 5feea11 (fix applied inline before Task 2 commit)

## Commits

| Hash | Message |
|------|---------|
| a512abc | feat(01-04): create class management server actions |
| 5feea11 | feat(01-04): build class management UI pages and components |

## Self-Check: PASSED
