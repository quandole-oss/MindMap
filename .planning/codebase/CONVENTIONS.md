# Coding Conventions

**Analysis Date:** 2026-04-09

## Naming Patterns

**Files:**
- Component files: kebab-case ending in `.tsx` or `.ts`
  - Example: `login-form.tsx`, `spiral-background.tsx`, `question-form.tsx`
  - UI primitives in `components/ui/`: `alert-dialog.tsx`, `button.tsx`
  - Feature components: `components/{feature}/{component-name}.tsx`

- Page files: lowercase with route-based naming
  - Example: `app/student/page.tsx`, `app/teacher/page.tsx`, `app/(auth)/layout.tsx`
  - Next.js App Router convention: `page.tsx` for routes, `layout.tsx` for layouts

- Server actions: lowercase with action type
  - Example: `actions/auth.ts`, `actions/questions.ts`, `actions/graph.ts`

- Library/utility files: camelCase or descriptive names
  - Example: `embeddings.ts`, `schema.ts`, `loader.ts`, `domain-colors.ts`

- Test files: `__tests__/` directory with `*.test.ts` suffix
  - Example: `src/__tests__/adapter.test.ts`, `components/graph/__tests__/graph-filters.test.ts`

**Functions:**
- camelCase for all functions (server actions, utilities, React hooks)
  - Example: `hasAskedToday()`, `getTodayQuestion()`, `generateEmbedding()`, `loadLibrary()`
  - Server actions follow same convention: `signInAction()`, `signUpAction()`, `signOutAction()`
  - Component event handlers: `handleSubmit()`, `handleRetry()`, `onSwitchToSignup()`

- Leading underscore for private/internal functions (module-level scope)
  - Example: `_library` (private module state in `loader.ts`)

**Variables:**
- camelCase for all variables (const, let, var)
  - Example: `session`, `gradeLevel`, `todayQuestion`, `embedding`, `misconceptions`

- Descriptive boolean names with `is`, `has`, or `can` prefix
  - Example: `isLoading`, `isAlreadyAsked`, `hasAskedToday`, `canEdit`

- Constant names: UPPER_SNAKE_CASE for module-level constants
  - Example: `const DOMAINS = ["physics", "biology", "math", "history"]`
  - Example: `const embeddingModel = openai.embedding("text-embedding-3-small")`

**Types:**
- PascalCase for all type names, interfaces, and type aliases
  - Example: `type LoginFormValues`, `interface QuestionFormProps`, `type RoutingDecision`
  - Component prop types: `{ComponentName}Props`
  - Example: `interface QuestionFormProps`, `interface ParticleProps`

- Zod schema names: camelCase with `Schema` suffix
  - Example: `loginSchema`, `signUpSchema`, `misconceptionEntrySchema`

- Exported types from Zod: PascalCase, inferred with `z.infer<>`
  - Example: `type MisconceptionEntry = z.infer<typeof misconceptionEntrySchema>`
  - Example: `type GradeBand = z.infer<typeof gradeBandSchema>`

## Code Style

**Formatting:**
- Prettier with default configuration (no custom `.prettierrc` at repo root)
- 2-space indentation (standard for Next.js / TypeScript projects)
- Semicolons at end of statements
- Single quotes for strings (Prettier default)
- No trailing commas in function parameters, commas in arrays/objects

**Linting:**
- ESLint via `next lint` command (managed by Next.js)
- `typescript: "strict: true"` enforced across all packages
- No custom eslint config files present; relies on Next.js ESLint defaults

**Comments style:**
- Multi-line JSDoc comments for public functions and exports
  - Example from `embeddings.ts`:
    ```typescript
    /**
     * Generate a 1536-dimension embedding vector for the given text.
     *
     * @param text - The concept name or short phrase to embed.
     *   Must be non-empty and no longer than 500 characters.
     * @returns A number array of length 1536.
     * @throws Error if text is empty or exceeds 500 characters.
     */
    ```

- Inline comments for business logic and security notes
  - Example: `// Security note (T-03-01): Only concept names should be passed to generateEmbedding()`
  - Example: `// Redirect based on role returned from server action`
  - Example: `// Deduplicate to unique UTC dates (one question per day max anyway, but be safe)`

- No trailing comments on the same line as code
- Comments explain *why*, not *what* (code already shows what it does)

## Import Organization

**Order (strict):**
1. Built-in Node.js modules (e.g., `import * as fs from "fs"`)
2. Third-party packages (e.g., `import { z } from "zod"`, `import { useForm } from "react-hook-form"`)
3. Absolute imports using `@/` alias (internal app code)
4. Relative imports (same package or monorepo)

**Example from `login-form.tsx`:**
```typescript
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";

import { signInAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

**Path Aliases:**
- `@/*` maps to project root in `/apps/web` (tsconfig.json)
  - Allows `@/actions/auth`, `@/components/ui/button`, `@/lib/auth`

- Monorepo workspace imports use package names
  - Example: `import { db, schema } from "@mindmap/db"`
  - Example: `import { loadLibrary } from "@mindmap/misconceptions"`
  - Enforced by `workspace:*` in package.json

## Error Handling

**Pattern: Validation-first with early returns**
- Use Zod for input validation in server actions
- Return error objects instead of throwing (when appropriate for user-facing errors)
- Distinguish between validation errors and unexpected errors

**Example from `auth.ts` (server action):**
```typescript
const parsed = signUpSchema.safeParse(raw);
if (!parsed.success) {
  return { error: parsed.error.issues[0].message };
}
// ... proceed with validated data
```

**Pattern: Try-catch for external service calls**
- Wrap API/database calls in try-catch
- Map specific error types to user-facing messages
- Re-throw unexpected errors

**Example from `question-form.tsx`:**
```typescript
function getErrorMessage(error: Error | undefined): string {
  if (!error) return "Something went wrong. Please try again later.";
  const msg = error.message ?? "";
  if (msg.includes("503") || msg.includes("ANTHROPIC_API_KEY")) {
    return "AI features require an API key...";
  }
  if (msg.includes("504") || msg.includes("timeout")) {
    return "The AI is taking longer than expected...";
  }
  return "Something went wrong. Please try again later.";
}
```

**Pattern: Database queries with existence checks**
- Use `db.query.{table}.findFirst()` / `findMany()` for reads
- Return early if critical data is missing (null checks)
- Example from `questions.ts`:
  ```typescript
  const session = await auth();
  if (!session?.user?.id) return false;  // Early return on auth failure
  ```

## Logging

**Framework:** `console` methods (no external logging package)

**Patterns:**
- Console logging used for:
  - Development debugging (temporary during feature work)
  - Error conditions that should be visible in server logs
  - No telemetry or production analytics logging (privacy constraint)

- Typical usage: errors, warnings, and exceptional conditions
  - No info-level logging for normal request flow (too noisy)

## React Components

**Naming Convention:**
- Export as `export function ComponentName()` or `export const ComponentName = ()`
- Always PascalCase component names
- Props interface follows `{ComponentName}Props` pattern

**Structure:**
- "use client" directive at top of file for client components
  - Example: first line of `login-form.tsx` is `"use client";`

- Props defined as interface above component function
  - Example:
    ```typescript
    interface QuestionFormProps {
      hasAskedToday: boolean;
      todayQuestion?: TodayQuestion | null;
      gradeLevel: number;
    }
    ```

- Destructure props in function signature
  - Example: `export function LoginForm({ onSwitchToSignup }: { onSwitchToSignup?: () => void } = {})`

- State declared with `useState` hooks at component top
- Effects (if used) declared after state
- Event handlers as arrow functions prefixed with `handle` or `on`

**Styling:**
- Tailwind CSS utility classes (v4.x)
- Combine classes with `cn()` utility from `clsx`
  - Example from `button.tsx`:
    ```typescript
    import { cn } from "@/lib/utils"
    className={cn("base-class", className)}
    ```

- Class Variance Authority (CVA) for component variants
  - Example:
    ```typescript
    const buttonVariants = cva(
      "base-styles",
      {
        variants: {
          variant: { default: "...", outline: "..." },
          size: { default: "...", lg: "..." },
        },
      }
    )
    ```

- No inline styles; all styling via classes

## Form Handling

**Pattern: react-hook-form + Zod**
- Define Zod schema first
- Use `useForm` hook with `zodResolver`
- Extract form state: `{ register, handleSubmit, formState: { errors, isSubmitting } }`
- Render error messages from `errors.{fieldName}.message`

**Example from `login-form.tsx`:**
```typescript
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
  resolver: zodResolver(loginSchema),
});

async function onSubmit(values: LoginFormValues) {
  // ... handle submission
}
```

## Server Actions

**Directive:** `"use server"` at top of file

**Pattern:**
- Async functions that handle FormData or parsed input
- Validate input with Zod before processing
- Return success/error object instead of throwing for user-facing errors
- Use database queries inside server actions (no direct imports in client code)

**Example structure:**
```typescript
"use server";

export async function actionName(formData: FormData) {
  const raw = {
    field1: formData.get("field1") as string,
    // ...
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Process validated data
  try {
    // Database/external calls here
  } catch (error) {
    return { error: "User-facing message" };
  }

  return { success: true, /* ...data */ };
}
```

## TypeScript

**Strict mode:**
- `strict: true` in all `tsconfig.json` files
- No implicit `any` types
- All function parameters and returns typed (except obvious React props)

**Type inference:**
- Use type inference where obvious (e.g., `const name = "John"`)
- Always annotate public function signatures and server actions
- Annotate useState initial values if not obvious: `useState<boolean>(false)`

**Type exports:**
- Export types separately: `export type { MyType } from "./module"`
- Re-export via barrel files (`index.ts`) for public APIs
- Example from `/packages/llm/src/index.ts`:
  ```typescript
  export type { ConceptExtractionResult } from "./prompts/extract";
  export type { ResolutionResult } from "./prompts/diagnose-resolve";
  ```

## Module Design

**Exports:**
- Named exports for functions, types, and constants
- Single default export only if component is sole export of file
- Most files use named exports + barrel file re-exports

**Barrel files (`index.ts`):**
- Re-export public API from directories
- One barrel file per package/feature directory
- Example from `/packages/misconceptions/src/index.ts`:
  ```typescript
  export { loadLibrary, getMisconceptionsByDomainAndBand } from "./loader";
  export { misconceptionEntrySchema } from "./schema";
  export type { MisconceptionEntry, GradeBand } from "./schema";
  ```

**Private modules:**
- Module-level private state prefixed with underscore: `let _library: ... = null`
- Functions that are not exported are private to the module
- Example from `loader.ts`: `_library` cache is private, `loadLibrary()` is public

---

*Convention analysis: 2026-04-09*
