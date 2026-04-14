---
phase: quick
plan: 260409-cxq
subsystem: ui/visual
tags: [animation, canvas, gsap, auth, student-dashboard]
dependency_graph:
  requires: []
  provides: [spiral-animation-component, dark-auth-layout, student-hero-banner]
  affects: [apps/web/app/(auth)/layout.tsx, apps/web/app/student/page.tsx]
tech_stack:
  added: [gsap@3.14.2]
  patterns: [next/dynamic ssr:false for canvas components, glassmorphism card overlay]
key_files:
  created:
    - apps/web/components/ui/spiral-animation.tsx
  modified:
    - apps/web/app/(auth)/layout.tsx
    - apps/web/app/student/page.tsx
decisions:
  - SpiralAnimation uses parentElement.offsetWidth/Height for sizing to avoid SSR window reference
  - GSAP timeline animates z-depth per-particle; yoyo:true + repeat:-1 creates perpetual pulse
  - Auth layout uses bg-black/60 backdrop-blur-md glassmorphism card over full-screen spiral
  - Student hero uses -mx bleed pattern to fill AppShell padding edges (-mx-4 sm:-mx-6 lg:-mx-8)
  - Hero removes pt-8 top padding since 192px hero replaces the top spacing
metrics:
  duration_seconds: ~180
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_changed: 3
---

# Quick Task 260409-cxq: Spiral Animation Background for Auth and Student Dashboard

**One-liner**: Canvas 2D + GSAP 3D particle spiral (5000 particles, 20-rotation path, perspective projection) added as full-screen auth background and h-48 student dashboard hero banner.

## Tasks Completed

### Task 1: Create SpiralAnimation component and install gsap
**Commit**: ae53b59

- Installed `gsap@3.14.2` in `apps/web` (`pnpm add gsap --filter web`)
- Created `apps/web/components/ui/spiral-animation.tsx` as `"use client"` component
- 5000 particles laid out along a 20-rotation Archimedean spiral
- GSAP timeline animates each particle's z-depth (yoyo + repeat:-1) for pulsing 3D fly-through effect
- `requestAnimationFrame` draw loop with trail fade via `rgba(0,0,0,0.18)` fill
- 3D perspective projection: `scale = fov / (fov + z)`, `fov = 500`
- SSR-safe sizing via `canvas.parentElement.offsetWidth/Height`
- Cleanup: `cancelAnimationFrame` + `tl.kill()` + `window.removeEventListener` — safe for React Strict Mode double-mount
- `aria-hidden="true"` — decorative, no screen reader impact

### Task 2: Restyle auth layout and add student dashboard hero
**Commit**: 31bcd75

**Auth layout (`apps/web/app/(auth)/layout.tsx`):**
- Background changed from `bg-[#f4f4f5]` to `bg-black` with `overflow-hidden`
- `SpiralAnimation` imported via `next/dynamic` with `ssr: false` (consistent with existing `knowledge-graph.tsx` pattern)
- Canvas fills viewport via `absolute inset-0` (from component) inside `relative` container
- "MindMap" logo text updated from `text-[#18181b]` to `text-white`
- Card updated to glassmorphism: `bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl`
- Form children (login/signup) remain in card — dark text still legible against semi-transparent dark card

**Student dashboard (`apps/web/app/student/page.tsx`):**
- Added `SpiralAnimation` dynamic import at top of file
- 192px hero banner (`h-48`) inserted as first child in outer div
- `-mx-4 sm:-mx-6 lg:-mx-8` bleeds to AppShell padding edges for full-width banner
- `overflow-hidden` clips canvas to banner bounds
- Greeting text in hero: "What are you curious about today?" (`text-white`) + subtext (`text-white/70`)
- Removed top `pt-8` since hero replaces the top spacing; kept `pb-8`
- All existing content (diagnostic session, question panel, classes) unchanged below hero

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — animation is fully wired, no placeholder data.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Canvas animation is pure client-side.

## Self-Check

### Files Created/Modified

- `apps/web/components/ui/spiral-animation.tsx` — FOUND
- `apps/web/app/(auth)/layout.tsx` — FOUND (modified)
- `apps/web/app/student/page.tsx` — FOUND (modified)

### Commits

- ae53b59 — FOUND (Task 1: SpiralAnimation + gsap install)
- 31bcd75 — FOUND (Task 2: auth layout + student hero)

### TypeScript

`pnpm --filter web exec tsc --noEmit` — PASSED (no errors in spiral, layout, or student page)

## Self-Check: PASSED
