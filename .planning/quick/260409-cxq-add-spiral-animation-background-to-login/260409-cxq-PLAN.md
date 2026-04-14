---
phase: quick
plan: 260409-cxq
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/components/ui/spiral-animation.tsx
  - apps/web/app/(auth)/layout.tsx
  - apps/web/app/student/page.tsx
autonomous: true
requirements: []
user_setup: []

must_haves:
  truths:
    - "Login and signup pages have a full-screen dark spiral animation background"
    - "Auth form card appears overlaid on the spiral with a semi-transparent dark background and blur"
    - "Student dashboard has a spiral hero section behind the greeting/question area"
    - "Dashboard content below the hero remains readable on a light background"
    - "SpiralAnimation component cleans up canvas on unmount (no memory leaks)"
  artifacts:
    - path: "apps/web/components/ui/spiral-animation.tsx"
      provides: "Canvas 2D + GSAP spiral particle animation, SSR-safe, fills parent"
      exports: ["SpiralAnimation"]
    - path: "apps/web/app/(auth)/layout.tsx"
      provides: "Dark full-screen spiral auth layout with overlaid card"
      contains: "SpiralAnimation"
    - path: "apps/web/app/student/page.tsx"
      provides: "Hero section with spiral behind greeting"
      contains: "SpiralAnimation"
  key_links:
    - from: "apps/web/app/(auth)/layout.tsx"
      to: "apps/web/components/ui/spiral-animation.tsx"
      via: "next/dynamic ssr:false import"
      pattern: "dynamic.*spiral-animation"
    - from: "apps/web/app/student/page.tsx"
      to: "apps/web/components/ui/spiral-animation.tsx"
      via: "next/dynamic ssr:false import"
      pattern: "dynamic.*spiral-animation"
---

<objective>
Add a Canvas 2D spiral particle animation (5000 particles, GSAP-driven, 3D projection) as a visual background to the auth pages (login/signup) and the student dashboard hero section.

Purpose: Elevate visual polish — auth pages go from plain gray card to an immersive full-screen dark spiral; the student dashboard gets an engaging hero header without sacrificing content readability.
Output: Three modified/created files. No new routes, no DB changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key facts:
- apps/web uses Next.js 15 App Router with Tailwind CSS v4
- `gsap` is NOT yet in apps/web/package.json — must be installed via `pnpm add gsap --filter apps/web`
- Auth layout currently: `min-h-screen bg-[#f4f4f5]` gray bg, centered card in white rounded box
- Student page is an RSC wrapped by AppShell (student/layout.tsx); page content starts at `pt-8`
- All Canvas/WebGL components use `next/dynamic` with `ssr: false` (see 07-02 decision: `next/dynamic ssr:false in knowledge-graph.tsx`)
- `"use client"` components with useRef/useEffect are standard pattern in this codebase
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create SpiralAnimation component and install gsap</name>
  <files>apps/web/components/ui/spiral-animation.tsx</files>
  <action>
Install gsap in the web app:
```
pnpm add gsap --filter apps/web
```

Create `apps/web/components/ui/spiral-animation.tsx` as a `"use client"` component:

```tsx
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface Particle {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  color: string;
}

export function SpiralAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PARTICLE_COUNT = 5000;
    const particles: Particle[] = [];
    let animationId: number;
    let tl: gsap.core.Timeline;

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Build spiral particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const angle = t * Math.PI * 2 * 20; // 20 full rotations
      const radius = t * Math.min(canvas.width, canvas.height) * 0.45;
      const z = (1 - t) * 600 + 100;
      particles.push({
        ox: Math.cos(angle) * radius,
        oy: Math.sin(angle) * radius,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z,
        color: `rgba(255,255,255,${0.1 + t * 0.6})`,
      });
    }

    // GSAP: animate particles from z=0 spread to final positions
    tl = gsap.timeline({ repeat: -1 });
    particles.forEach((p, i) => {
      tl.to(
        p,
        {
          z: p.z + 200,
          duration: 8 + Math.random() * 4,
          ease: "power1.inOut",
          yoyo: true,
          repeat: -1,
          delay: (i / PARTICLE_COUNT) * 2,
        },
        0
      );
    });

    function project(x: number, y: number, z: number, w: number, h: number) {
      const fov = 500;
      const scale = fov / (fov + z);
      return {
        sx: x * scale + w / 2,
        sy: y * scale + h / 2,
        scale,
      };
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.fillStyle = "rgba(0,0,0,0.18)";
      ctx!.fillRect(0, 0, w, h);

      for (const p of particles) {
        const { sx, sy, scale } = project(p.ox, p.oy, p.z, w, h);
        const size = Math.max(0.5, scale * 2);
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(sx, sy, size, 0, Math.PI * 2);
        ctx!.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      tl.kill();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
```

Key implementation notes:
- `"use client"` required — uses useRef/useEffect/canvas
- `canvas.offsetWidth/Height` for sizing (not `window.innerWidth` to avoid SSR mismatch; the canvas is sized by its CSS container)
- `requestAnimationFrame` loop with trail fade via semi-transparent black fill (rgba 0,0,0,0.18) — creates the comet-tail effect
- GSAP animates the `z` depth of each particle producing a pulsing 3D fly-through feel
- Cleanup: `cancelAnimationFrame` + `tl.kill()` + `removeEventListener` — prevents memory leaks on unmount and React Strict Mode double-mount
- `aria-hidden="true"` — decorative, not meaningful to screen readers
  </action>
  <verify>
    <automated>cd /Users/q/MindMap && pnpm --filter apps/web exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep spiral || echo "no type errors in spiral"</automated>
  </verify>
  <done>File exists at apps/web/components/ui/spiral-animation.tsx, gsap is in apps/web/package.json, TypeScript compiles without errors for the component.</done>
</task>

<task type="auto">
  <name>Task 2: Restyle auth layout with spiral background and update student dashboard hero</name>
  <files>apps/web/app/(auth)/layout.tsx, apps/web/app/student/page.tsx</files>
  <action>
**Part A — Auth layout (`apps/web/app/(auth)/layout.tsx`):**

Replace current gray-bg centered card layout with a full-screen dark spiral background and an overlaid glass-effect card. Import SpiralAnimation via `next/dynamic` with `ssr: false`.

```tsx
import type { ReactNode } from "react";
import dynamic from "next/dynamic";

const SpiralAnimation = dynamic(
  () => import("@/components/ui/spiral-animation").then((m) => m.SpiralAnimation),
  { ssr: false }
);

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      {/* Spiral background — fills entire viewport */}
      <SpiralAnimation />

      {/* Content layer — above the canvas */}
      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="mb-6">
          <span className="text-[20px] font-semibold text-white">MindMap</span>
        </div>
        <div className="w-full max-w-[400px] bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
```

Key changes vs current:
- `bg-[#f4f4f5]` → `bg-black` (dark canvas base)
- Added `overflow-hidden` (prevents canvas overflow scrollbars)
- SpiralAnimation positioned `absolute inset-0` (from component itself) filling the `relative` parent
- Content wrapped in `relative z-10` to sit above canvas
- "MindMap" logo text: `text-[#18181b]` → `text-white` (readable on dark bg)
- Card: `bg-white rounded-xl shadow-sm` → `bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl` (glassmorphism)
- Children (login/signup pages) render inside the glass card — their form fields and text colors may need adjustment for dark background context. Check: login/signup page text should use light-on-dark or keep existing (white card interior made dark by bg-black/60 + backdrop-blur).

NOTE: If login/signup page text is currently `text-[#18181b]` (near-black) it will still be legible against the semi-transparent dark card. If any text becomes illegible, apply `text-white` or `text-[#e4e4e7]` to those elements. The executor should open the login and signup pages and scan for any hardcoded dark text that may need updating, but avoid changing business logic.

**Part B — Student dashboard hero (`apps/web/app/student/page.tsx`):**

Add a spiral hero section at the top of the student page — a fixed-height banner (h-48 or h-56) with the spiral animation behind a greeting, sitting above the existing dashboard content. The spiral does NOT go full-page here; the rest of the dashboard remains on a light background.

Add the dynamic import at the top of the file:
```tsx
import dynamic from "next/dynamic";

const SpiralAnimation = dynamic(
  () => import("@/components/ui/spiral-animation").then((m) => m.SpiralAnimation),
  { ssr: false }
);
```

Insert a hero banner as the first child inside the outer `<div className="pt-8 pb-8">`:

```tsx
{/* Hero banner — spiral background with greeting */}
<div className="relative h-48 -mx-4 sm:-mx-6 lg:-mx-8 mb-10 overflow-hidden rounded-none">
  <SpiralAnimation />
  <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
    <h1 className="text-[28px] font-bold text-white leading-tight">
      What are you curious about today?
    </h1>
    <p className="text-[14px] text-white/70 mt-2">
      Ask your one question and explore your knowledge map.
    </p>
  </div>
</div>
```

Layout logic:
- `-mx-4 sm:-mx-6 lg:-mx-8` bleeds the hero to the AppShell padding edges (matches standard Next.js dashboard bleed pattern) — full-width within the content column without overflowing the page
- `overflow-hidden` keeps the canvas clipped to the banner bounds
- `relative h-48` gives the canvas its height (canvas fills via `absolute inset-0 w-full h-full`)
- `relative z-10` on inner content sits above canvas
- Existing `pt-8 pb-8` on outer div: remove `pt-8` since the hero replaces the top spacing, or keep it — executor judgment
- All existing content (diagnostic session, question panel, classes) remains unchanged below the hero
  </action>
  <verify>
    <automated>cd /Users/q/MindMap && pnpm --filter apps/web exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -E "layout|student/page" || echo "no type errors in modified files"</automated>
  </verify>
  <done>
Auth layout renders spiral full-screen with glass card overlay. Student page has a h-48 spiral hero banner. Both pages build without TypeScript errors. `next build` (or `next dev`) shows no compilation errors.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - SpiralAnimation Canvas 2D component with GSAP 3D particle spiral (5000 particles)
    - Auth layout: full-screen dark spiral background with glassmorphism card
    - Student dashboard: h-48 spiral hero banner above question panel
  </what-built>
  <how-to-verify>
    1. Start dev server: `pnpm dev` from repo root (or `pnpm --filter apps/web dev`)
    2. Visit http://localhost:3000/login — verify full-screen black background with animated white spiral particles, "MindMap" logo in white, form card with dark glass effect + blur
    3. Visit http://localhost:3000/signup — same spiral background, different form content
    4. Log in as a student, visit http://localhost:3000/student — verify a ~192px tall dark spiral hero banner at the top with "What are you curious about today?" text, then normal dashboard content below on light background
    5. Resize the browser window — verify canvas fills its container at all sizes without overflow scrollbars
    6. Confirm no console errors related to canvas, GSAP, or SSR
  </how-to-verify>
  <resume-signal>Type "approved" or describe any visual issues to fix</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client canvas | Pure client-side rendering; no data crosses boundaries |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-cxq-01 | D (Denial of Service) | SpiralAnimation canvas loop | accept | requestAnimationFrame is browser-throttled; cleanup on unmount prevents accumulation; 5000 particles is within browser canvas budget on modern hardware |
| T-cxq-02 | T (Tampering) | next/dynamic ssr:false | accept | Client-only rendering is intentional; no server data involved; standard pattern for canvas components in this codebase |
</threat_model>

<verification>
- `pnpm --filter apps/web exec tsc --noEmit` passes with no new errors
- Auth pages render on dark background with visible spiral animation
- Student dashboard hero banner displays without obscuring dashboard content
- No hydration errors (SSR-safe via `next/dynamic ssr:false`)
- Canvas cleanup fires on route navigation (no memory leak on back/forward)
</verification>

<success_criteria>
- Login and signup pages display full-screen spiral animation background with glass card overlay
- Student dashboard has a contained spiral hero banner (h-48) that does not affect readability of content below
- TypeScript compiles clean across all modified files
- Animation runs smoothly (60fps target) on a modern laptop
- No accessibility regressions (canvas is aria-hidden; form labels/inputs unchanged)
</success_criteria>

<output>
After completion, create `.planning/quick/260409-cxq-add-spiral-animation-background-to-login/260409-cxq-SUMMARY.md`
</output>
