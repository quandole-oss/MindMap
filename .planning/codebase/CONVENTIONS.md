# Coding Conventions

**Analysis Date:** 2026-04-14

## Naming Patterns

**Files:**
- Component files: kebab-case with `.tsx` extension
  - Feature components: `components/{feature}/{component-name}.tsx` (e.g., `components/graph/solar-graph.tsx`)
  - UI primitives: `components/ui/{component}.tsx` (e.g., `components/ui/button.tsx`, `components/ui/card.tsx`)
- Page files: Next.js App Router convention -- `page.tsx` for routes, `layout.tsx` for layouts
  - Route groups use parentheses: `app/(auth)/login/page.tsx`
  - Dynamic segments: `app/teacher/classes/[classId]/dashboard/page.tsx`
- Server action files: `actions/{domain}.ts` (e.g., `actions/auth.ts`, `actions/graph.ts`, `actions/themes.ts`)
- Library/utility files: kebab-case in `lib/` (e.g., `lib/theme-aggregation.ts`, `lib/theme-cache-hash.ts`)
- Custom hooks: `use-{name}.ts` (e.g., `components/graph/use-graph-filters.ts`, `components/graph/use-graph-layout.ts`)
- Test files: `__tests__/{name}.test.ts` inside the directory of the code they test

**Functions:**
- camelCase for all functions: `hasAskedToday()`, `getTodayQuestion()`, `generateEmbedding()`, `loadLibrary()`
- Server actions follow same convention: `signInAction()`, `signUpAction()`, `signOutAction()`
- Event handlers: `handleSubmit()`, `handleRetry()`, `onSwitchToSignup()`
- Boolean-returning functions prefixed with `is`/`has`/`can`: `hasAskedToday()`, `isInactive`

**Variables:**
- camelCase for all variables: `session`, `gradeLevel`, `todayQuestion`, `misconceptions`
- Boolean names with `is`/`has`/`can` prefix: `isLoading`, `hasAskedToday`, `isInactive`, `mobileOpen`
- Module-level constants in UPPER_SNAKE_CASE: `DOMAINS`, `DOMAIN_HUE_PALETTE`, `DOMAIN_GROUPS`, `THREE_DAYS_MS`

**Types:**
- PascalCase for interfaces and type aliases: `RoutingDecision`, `GraphNode`, `StudentSummary`, `ThemeCluster`
- Component props: `{ComponentName}Props` interface (e.g., `QuestionFormProps`, `KnowledgeGraphProps`, `AppShellProps`)
- Zod schemas: camelCase with `Schema` suffix (e.g., `loginSchema`, `signUpSchema`, `conceptExtractionSchema`, `lessonPlanSchema`)
- Exported types inferred from Zod: `type MisconceptionEntry = z.infer<typeof misconceptionEntrySchema>`

## Code Style

**Formatting:**
- No custom `.prettierrc` at repo root -- relies on Prettier defaults
- 2-space indentation
- Semicolons at end of statements
- Double quotes for strings in most files (TypeScript default with Next.js)
- Trailing commas in multi-line arrays/objects

**Linting:**
- ESLint via `next lint` command (Next.js managed)
- No custom `.eslintrc` files -- relies on `eslint-config-next` defaults
- `strict: true` TypeScript in all packages (enforced via `tsconfig.json`)

**Comment Conventions:**
- JSDoc comments on public functions and exports:
  ```typescript
  /**
   * Generate a 1536-dimension embedding vector for the given text.
   * @param text - The concept name or short phrase to embed.
   * @returns A number array of length 1536.
   * @throws Error if text is empty or exceeds 500 characters.
   */
  ```
- Inline comments for security notes using ticket IDs:
  ```typescript
  // T-03-07: userId from session only -- never from client params
  // T-04-01 mitigation: userId is always taken from the server session
  // PRIV-01 / D-13: no studentId, userId, name, or email
  ```
- Block comment headers using Unicode box-drawing characters for section separation:
  ```typescript
  // --- Streak Helper ---
  // --- Main Server Action ---
  ```
- Comments explain *why*, not *what*

## Import Organization

**Order:**
1. React / built-in modules (`import { useState } from "react"`)
2. Third-party packages (`import { z } from "zod"`, `import { useForm } from "react-hook-form"`)
3. Next.js framework imports (`import { redirect } from "next/navigation"`)
4. Absolute imports using `@/` alias (`import { auth } from "@/lib/auth"`)
5. Monorepo workspace imports (`import { db, schema } from "@mindmap/db"`)
6. Relative imports (`import { computeClusters } from "../clusters"`)

**Example from `apps/web/app/student/graph/page.tsx`:**
```typescript
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getGraphData, getBridgeConnection } from "@/actions/graph";
import { GraphPageClient } from "./graph-page-client";
```

**Path Aliases:**
- `@/*` maps to project root in `apps/web` (configured in `tsconfig.json`)
  - Use for: `@/actions/auth`, `@/components/ui/button`, `@/lib/auth`, `@/lib/utils`
- Monorepo workspace imports use `@mindmap/{package}` names:
  - `import { db, schema } from "@mindmap/db"`
  - `import { loadLibrary } from "@mindmap/misconceptions"`
  - `import { createLLMAdapter } from "@mindmap/llm"`
  - `import { routeQuestion } from "@mindmap/router"`
- Enforced by `workspace:*` in `package.json`

## Component Patterns

**Server Components vs Client Components:**
- Page files (`page.tsx`) are Server Components by default -- fetch data directly with `await`
- 40 of 50 component files (80%) are Client Components (`"use client"` directive)
- 10 components are Server Components (no directive): `overview-tab.tsx`, `concepts-tab.tsx`, `join-code-display.tsx`, and UI primitives like `button.tsx`, `card.tsx`, `badge.tsx`, `table.tsx`
- Pattern: page fetches data server-side, passes to client component as props:
  ```typescript
  // page.tsx (Server Component)
  export default async function GraphPage() {
    const [graphData, bridgeData] = await Promise.all([
      getGraphData(),
      getBridgeConnection(),
    ]);
    return <GraphPageClient nodes={graphData.nodes} edges={graphData.edges} />;
  }
  ```

**Naming:**
- `export function ComponentName()` (named function declaration, not arrow)
- PascalCase for all component names
- Files named in kebab-case matching the component: `question-form.tsx` exports `QuestionForm`

**Props Pattern:**
- Interface defined above component with `{ComponentName}Props`:
  ```typescript
  interface QuestionFormProps {
    hasAskedToday: boolean;
    todayQuestion?: TodayQuestion | null;
    gradeLevel: number;
    todayConcepts?: ConceptLink[];
  }
  export function QuestionForm({ hasAskedToday, todayQuestion, gradeLevel }: QuestionFormProps) {
  ```
- Props destructured in function signature

**Styling:**
- Tailwind CSS v4.x utility classes exclusively (no CSS modules, no styled-components)
- `cn()` utility from `@/lib/utils` for conditional class merging (clsx + tailwind-merge):
  ```typescript
  import { cn } from "@/lib/utils"
  className={cn("base-class", isActive && "active-class", className)}
  ```
- Class Variance Authority (CVA) for component variants in `components/ui/`:
  ```typescript
  const buttonVariants = cva("base-styles", {
    variants: {
      variant: { default: "...", outline: "..." },
      size: { default: "...", lg: "..." },
    },
  });
  ```
- Inline style only for dynamic values that cannot be expressed as Tailwind classes:
  ```typescript
  style={{ height: "calc(100vh - 120px)", background: "#050510" }}
  ```
- Icons: `lucide-react` package with `size-{n}` class for sizing: `<Menu className="size-5" />`

## Data Access Patterns

**Server Actions (`"use server"`):**
- Located in `apps/web/actions/{domain}.ts`
- Begin with `"use server"` directive at file top
- Auth check as first operation using `auth()` from `@/lib/auth`:
  ```typescript
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  ```
- Return `{ error: string }` or `{ success: true, ...data }` for user-facing errors
- Throw for unexpected/programming errors
- Access control pattern: verify ownership before returning data:
  ```typescript
  const targetClass = await db.query.classes.findFirst({
    where: and(eq(schema.classes.id, classId), eq(schema.classes.teacherId, teacherId)),
  });
  if (!targetClass) return { error: "Not authorized" };
  ```

**API Routes (`app/api/`):**
- Located in `apps/web/app/api/{endpoint}/route.ts`
- Export `POST` (or `GET`) async functions
- Set `export const maxDuration = 60` for long-running LLM calls
- Return `new Response(JSON.stringify(...), { status, headers })` for errors
- Use streaming via Vercel AI SDK `streamText()` for LLM responses

**Database Queries (Drizzle ORM):**
- Import `db` and `schema` from `@mindmap/db`
- Relational queries: `db.query.{table}.findFirst()` / `findMany()`
- SQL builder queries: `db.select().from(schema.table).where(...)`
- Batch fetching pattern -- N+1 prevention:
  ```typescript
  // Fetch ALL concepts for ALL students in one query, then partition in JS
  const allConcepts = await db.select(...).from(schema.concepts).where(inArray(schema.concepts.userId, studentIds));
  ```
- Column filtering: `columns: { id: true, name: true }` on findMany

## Error Handling

**Client-side:**
- Error mapping function for user-friendly messages:
  ```typescript
  function getErrorMessage(error: Error | undefined): string {
    const msg = error.message ?? "";
    if (msg.includes("503") || msg.includes("ANTHROPIC_API_KEY")) {
      return "AI features require an API key...";
    }
    return "Something went wrong. Please try again later.";
  }
  ```
- Toast notifications via `sonner` for transient errors:
  ```typescript
  import { toast } from "sonner";
  toast.error("Failed to generate lesson plan");
  ```

**Server-side (Server Actions):**
- Validation-first with Zod `safeParse()` and early returns:
  ```typescript
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  ```
- Auth checks return error objects (not throw) for expected failures
- Ownership checks return error objects for unauthorized access
- Unexpected errors bubble up (thrown)

**API Routes:**
- Return JSON error responses with appropriate HTTP status codes:
  ```typescript
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  ```

## Form Handling

**Pattern: react-hook-form + Zod:**
```typescript
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
  resolver: zodResolver(loginSchema),
});
```

**Server Actions with FormData:**
```typescript
export async function signUpAction(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // ... process
}
```

## Logging

**Framework:** `console` methods only (no external logging library)
- `console.error()` for error conditions visible in server logs
- No info-level logging for normal request flow
- No telemetry or analytics (privacy constraint)
- Validation failures logged with context: `console.error("[diagnose] invalid message structure in DB:", result.error.message)`

## TypeScript

**Strictness:**
- `strict: true` in all `tsconfig.json` files across all packages
- All packages: `noEmit: true`, `esModuleInterop: true`, `isolatedModules: true`
- `apps/web`: `moduleResolution: "bundler"`, `jsx: "preserve"`, `incremental: true`
- Packages: `moduleResolution: "bundler"`, `module: "esnext"`, `lib: ["esnext"]`

**Type exports:**
- Separate type exports: `export type { MyType } from "./module"`
- Re-export via barrel files (`index.ts`) for public package APIs:
  ```typescript
  // packages/llm/src/index.ts
  export { createLLMAdapter } from "./adapters/factory";
  export type { ConceptExtractionResult } from "./prompts/extract";
  export type { LessonPlan } from "./prompts/generate-lesson-plan";
  ```

## Module Design

**Exports:**
- Named exports for functions, types, and constants (no default exports except page components)
- Barrel files (`index.ts`) in each package re-export the public API
- Package entry: `"main": "./src/index.ts"` and `"types": "./src/index.ts"` (source-level, no build step)

**Test-Isolation Pattern:**
- Pure helper functions are extracted from `"use server"` actions into separate files in `lib/`
- These helpers have NO imports of DB, auth, or server-only modules
- Server actions import and call the pure helpers after resolving auth/ownership
- Tests import only the pure helpers, avoiding DB/auth dependencies in Vitest runtime
- Example:
  - Pure helper: `apps/web/lib/theme-aggregation.ts` (exports `buildThemeClusters`, `buildStudentThemeProfile`)
  - Server action: `apps/web/actions/dashboard.ts` calls `buildThemeClusters()` after DB queries
  - Test: `apps/web/__tests__/actions/dashboard.test.ts` imports only from `lib/theme-aggregation`

**Privacy Pattern (PRIV-01):**
- Functions that prepare data for LLM calls return fresh object literals with ONLY anonymized fields
- No studentId, userId, name, or email leaks into LLM-bound payloads
- Structural guard tests enforce this with `Object.keys(result).sort()` assertions
- Serialization paranoia tests verify IDs do not appear in `JSON.stringify()` output

## Common Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `cn()` | `apps/web/lib/utils.ts` | Merge Tailwind classes (clsx + tailwind-merge) |
| `auth()` | `apps/web/lib/auth.ts` | Get current session (NextAuth wrapper) |
| `signIn/signOut` | `apps/web/lib/auth.ts` | Auth primitives (re-exported from NextAuth) |
| `db` / `schema` | `packages/db/src/index.ts` | Drizzle ORM database client and schema |
| `createLLMAdapter()` | `packages/llm/src/adapters/factory.ts` | Factory for LLM provider adapter |
| `loadLibrary()` | `packages/misconceptions/src/loader.ts` | Load and cache misconception YAML data |
| `loadThemes()` | `packages/misconceptions/src/loader.ts` | Load and cache theme YAML data |
| `routeQuestion()` | `packages/router/src/index.ts` | Route concept to enrich or diagnose mode |
| `gradeLevelToGradeBand()` | `packages/router/src/utils.ts` | Map grade number (0-12) to band string |
| `computeDataHash()` | `apps/web/lib/theme-cache-hash.ts` | SHA-256 hash for lesson plan cache keys |
| `buildStudentThemeProfile()` | `apps/web/lib/theme-aggregation.ts` | Build anonymized student theme profile for LLM |
| `buildThemeClusters()` | `apps/web/lib/theme-aggregation.ts` | Aggregate diagnostic sessions into theme clusters |
| `computeClusters()` | `apps/web/lib/graph/clusters.ts` | Union-find graph clustering for knowledge graph |
| `getDomainColor()` | `apps/web/lib/graph/domain-colors.ts` | Assign deterministic colors to domains |

---

*Convention analysis: 2026-04-14*
