# Phase 1: Foundation - Research

**Researched:** 2026-04-08
**Domain:** Turborepo/pnpm monorepo scaffold, PostgreSQL + pgvector schema, Auth.js v5 with Drizzle adapter, YAML misconception library with Zod validation, Next.js 15 app shell with Tailwind v4 + shadcn/ui
**Confidence:** HIGH (core stack verified via npm registry; architecture patterns from existing STACK.md and ARCHITECTURE.md research)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use Auth.js v5 with Drizzle adapter for authentication
- Database sessions (not JWT) — more secure, revocable, COPPA-friendly with server-side TTL enforcement
- Teacher role selected at signup via student/teacher toggle — no admin approval needed
- Grade level set by teacher for class; students inherit class grade level — consistent, teacher-controlled
- Tailwind v4 + shadcn/ui for styling and components — copy-paste ownership, research validated
- Landing page with hero + login/signup — needed for the open-source story
- Light mode only for v1 — ship faster, add dark mode in polish phase
- Sidebar nav for dashboard views, full-width for graph view — standard EdTech pattern
- 6-character alphanumeric class join codes (e.g., `ABC123`) — easy to dictate in classroom, collision-resistant
- `expires_at` timestamp column on student records + scheduled cleanup job for COPPA TTL — explicit, auditable
- Integer 1-12 grade level (K=0) — simple, sortable, maps directly to misconception library grade bands
- Zod schema validates misconception YAML at build time + runtime parser in `@mindmap/misconceptions` — type-safe, catches errors early

### Claude's Discretion
- Specific Drizzle migration strategy and pgvector extension initialization sequence
- Auth.js v5 session/account table schema details
- Turborepo pipeline configuration and build ordering
- shadcn/ui component selection for initial shell

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Student can sign up with email and password | Auth.js v5 Credentials provider; Drizzle adapter; bcrypt password hashing |
| AUTH-02 | Teacher can sign up with email and password with teacher role | `role` enum column on users table; same Credentials provider, role persisted to DB |
| AUTH-03 | User can log in and stay logged in across browser refresh | Database sessions via Auth.js; session token in HTTP-only cookie; `session` table persisted in Postgres |
| AUTH-04 | User can log out from any page | Auth.js `signOut()` action deletes session row from DB |
| AUTH-05 | Teacher can create a class and receive a join code | `classes` table; 6-char alphanumeric code generation; Server Action |
| AUTH-06 | Student can join a class using a join code | `class_enrollments` table; join code lookup + insert; Server Action |
| AUTH-07 | Teacher can view and manage class roster | Drizzle join query: `classes` + `class_enrollments` + `users`; remove student Server Action |
| AUTH-08 | Student profile includes grade level (set by teacher or self-reported) | `grade_level` integer column on `class_enrollments`; teacher sets at enrollment or after |
| MISC-01 | YAML misconception library with 35+ entries across 4 domains | `packages/misconceptions/library/*.yaml`; js-yaml loader; 4 domain files |
| MISC-02 | Each entry includes id, name, domain, grade_band, description, citation, probe_questions, confrontation scenarios | Zod schema enforces all fields; TypeScript type exported from package |
| MISC-03 | Misconception library validated via CI | Vitest test in `packages/misconceptions`; runs `loadLibrary()` and asserts no schema errors |
| INFR-06 | Data model includes COPPA-compliant TTL fields | `expires_at timestamptz` on `users`/`class_enrollments`; scheduled cleanup via `pg_cron` or application-level cron |
| PRIV-02 | Student data scoped to the deploying instance — no cross-instance data sharing | Architecture is self-contained; no external calls except LLM (Phase 2); all data in deployer's Postgres |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield monorepo scaffold: all packages initialized, schema migrated, auth working end-to-end, and the misconception library loading and validating. There is no existing code to migrate or refactor — every file is net new.

The research-validated stack (Turborepo 2.x + pnpm 9.x, Next.js 15, Drizzle ORM 0.45, Auth.js v5 beta, Tailwind v4, shadcn/ui) is confirmed against the npm registry as of 2026-04-08. Version numbers below supersede the training-data estimates in STACK.md. The primary risk area is Auth.js v5 beta — it is now at `5.0.0-beta.30` and the Drizzle adapter is `1.11.1`; both are used in production projects but remain pre-1.0.

The Docker environment has PostgreSQL 16 running but without pgvector extension. The project needs a pgvector-enabled container (`pgvector/pgvector:pg16` image is already pulled locally). The misconception library (MISC-01/02/03) is a pure YAML + Zod problem with no external dependencies — it is the lowest-risk deliverable in the phase. The COPPA TTL fields (INFR-06) must land in the first migration; retrofitting them into an existing schema is painful.

**Primary recommendation:** Initialize packages in dependency order — `@mindmap/misconceptions` and `@mindmap/db` first (no internal deps), then `apps/web` which depends on both. Run pgvector initialization as the first SQL migration, before any table definitions.

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `CLAUDE.md` — planner must verify compliance:

| Directive | Enforcement |
|-----------|-------------|
| Tech stack: Next.js + TypeScript, PostgreSQL + pgvector, D3.js, Docker Compose | Every package must use these; no substitutions |
| Monorepo: Turborepo/pnpm — `/apps/web`, `/packages/llm`, `/packages/misconceptions`, `/packages/db`, `/packages/router` | All 5 packages must be scaffolded in Phase 1 (even if mostly stub) |
| LLM: Anthropic Claude API as primary; adapter pattern for OpenAI/Ollama | `@mindmap/llm` stub with interface defined; full implementation Phase 2 |
| Deployment: Dual — Docker Compose + Vercel/Neon | `docker-compose.yml` with pgvector image; Drizzle client supports both drivers |
| Data privacy: No telemetry, no data sent home | No analytics libraries, no third-party scripts; all data stays in deployer's Postgres |
| Misconception library: YAML + Git, CI-validated | CI validation is MISC-03; Vitest test must run in `pnpm build` or `pnpm test` pipeline |
| GSD workflow: Use `/gsd-execute-phase` for planned work | Do not make direct repo edits outside GSD workflow |

---

## Standard Stack

### Core (verified against npm registry 2026-04-08)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.2 | Full-stack React framework | Latest stable; App Router + Server Actions; Vercel-native |
| `react` / `react-dom` | 19.x | UI rendering | Ships with Next.js 15/16; Server Components reduce client JS |
| `typescript` | 5.5+ | Type safety across monorepo | `strict: true` required; Zod types derive from TS |
| `turbo` | 2.9.5 | Monorepo build orchestration | Remote caching, parallel tasks, dependency graph |
| `pnpm` | 10.30.3 (installed) | Workspace package manager | Symlink-based node_modules; workspace protocol |
| `drizzle-orm` | 0.45.2 | Type-safe DB access + migrations | Built-in pgvector types; ~7.4KB gzip; replaced Prisma in create-t3-app |
| `drizzle-kit` | 0.31.10 | Migration CLI | `drizzle-kit generate` + `drizzle-kit migrate` |
| `next-auth` (beta) | 5.0.0-beta.30 | Auth with email/password, DB sessions | Native App Router support; Drizzle adapter available |
| `@auth/drizzle-adapter` | 1.11.1 | Drizzle adapter for Auth.js | Connects Auth.js session tables to Drizzle schema |
| `zod` | 4.3.6 | Schema validation + type inference | Validates YAML, AI SDK outputs, form data |
| `react-hook-form` | 7.72.1 | Form handling | Works with Server Actions; requires `"use client"` |
| `@hookform/resolvers` | 5.2.2 | Zod resolver for react-hook-form | Bridges Zod schema to form validation |
| `js-yaml` | 4.1.1 | YAML parser | Loads misconception library files; typed with `@types/js-yaml` |
| `tailwindcss` | 4.2.2 | Utility-first styling | CSS-first config; 5x faster builds; pairs with shadcn |
| `vitest` | 4.1.3 | Testing framework | 10-20x faster than Jest; built-in TypeScript + ESM |
| `pg` | 8.x | PostgreSQL driver (Docker Compose path) | Standard node-postgres; used when not on Neon serverless |
| `@neondatabase/serverless` | 1.0.2 | Neon connection driver | Required for Vercel edge/serverless deployments |
| `pgvector` (npm) | 0.2.1 | pgvector Node.js bindings | Typed vector arrays; works alongside Drizzle |

[VERIFIED: npm registry — all versions confirmed via `npm view` on 2026-04-08]

### Note on Next.js version

The npm registry shows `next@16.2.2` as latest. STACK.md recommended `15.x`. The planner should default to Next.js 15.x (stable, production-proven) unless the user confirms they want to use 16.x. Next.js 16 may have different App Router API surfaces. [ASSUMED: Next.js 16 is stable/compatible — not verified against Next.js 16 docs as of this research]

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | latest | Icon library | Bundled with shadcn init; use for all UI icons |
| `@neondatabase/serverless` | 1.0.2 | Neon HTTP driver | Replace standard `pg` when deploying to Vercel/Neon |
| `bcryptjs` | latest | Password hashing | Hash passwords before storing; use `bcryptjs` not `bcrypt` (pure JS, no native dep) |
| `@types/js-yaml` | latest | TypeScript types for js-yaml | Dev dependency for misconceptions package |
| `@types/d3` | latest | TypeScript types for D3 | Dev dep in apps/web (D3 used in Phase 3) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js v5 beta | Lucia Auth v3 | Lucia has simpler session primitives and more predictable stability; use if Auth.js beta instability blocks progress |
| `js-yaml` | `yaml` (npm) | `yaml` is more spec-compliant (YAML 1.2); both work; `js-yaml` is the ecosystem default and more examples exist |
| `bcryptjs` | `bcrypt` (native) | `bcrypt` is faster but requires native build tools; `bcryptjs` is safer in serverless/edge environments |
| `next@16.2.2` | `next@15.x` | 15.x is explicitly tested and documented in the research; 16.x may introduce breaking changes — safer to pin 15.x |

**Installation:**
```bash
# From repo root
npx create-turbo@latest . --package-manager pnpm  # or manual scaffold

# In packages/db
pnpm add drizzle-orm pg @neondatabase/serverless pgvector
pnpm add -D drizzle-kit @types/pg

# In packages/misconceptions
pnpm add zod js-yaml
pnpm add -D @types/js-yaml vitest

# In apps/web
pnpm add next react react-dom typescript
pnpm add next-auth@beta @auth/drizzle-adapter
pnpm add zod react-hook-form @hookform/resolvers
pnpm add -D tailwindcss vitest @vitejs/plugin-react

# shadcn init (run from apps/web)
npx shadcn@latest init
npx shadcn@latest add button input label card badge table alert-dialog separator toggle-group form
```

---

## Architecture Patterns

### Recommended Project Structure

```
mindmap/
├── apps/
│   └── web/                         # Next.js App Router
│       ├── app/
│       │   ├── (auth)/              # login / signup routes (route group, no layout nesting)
│       │   │   ├── login/page.tsx
│       │   │   └── signup/page.tsx
│       │   ├── student/             # student dashboard stub
│       │   │   ├── page.tsx
│       │   │   └── join/page.tsx    # join class page
│       │   ├── teacher/             # teacher dashboard
│       │   │   ├── page.tsx
│       │   │   ├── classes/
│       │   │   │   ├── new/page.tsx
│       │   │   │   └── [classId]/
│       │   │   │       └── roster/page.tsx
│       │   └── api/
│       │       └── auth/[...nextauth]/route.ts   # Auth.js route handler
│       ├── components/
│       │   ├── ui/                  # shadcn components (auto-generated)
│       │   ├── auth/                # LoginForm, SignupForm, RoleToggle
│       │   └── class/               # ClassRoster, JoinCodeDisplay, JoinClassForm
│       ├── lib/
│       │   └── auth.ts              # Auth.js config (providers, adapter, callbacks)
│       └── actions/                 # Server Actions
│           ├── auth.ts              # signUpStudent, signUpTeacher
│           └── class.ts             # createClass, joinClass, removeStudent
├── packages/
│   ├── db/                          # @mindmap/db
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts          # Auth.js tables (users, sessions, accounts)
│   │   │   │   ├── classes.ts       # classes, class_enrollments
│   │   │   │   └── index.ts         # re-exports all schema
│   │   │   ├── migrations/          # generated by drizzle-kit
│   │   │   └── index.ts             # db client + connection factory
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── misconceptions/              # @mindmap/misconceptions
│   │   ├── library/
│   │   │   ├── physics.yaml
│   │   │   ├── biology.yaml
│   │   │   ├── math.yaml
│   │   │   └── history.yaml
│   │   ├── src/
│   │   │   ├── schema.ts            # Zod MisconceptionEntry schema
│   │   │   ├── loader.ts            # loadLibrary() function
│   │   │   └── index.ts             # public API
│   │   └── package.json
│   ├── llm/                         # @mindmap/llm (stub in Phase 1)
│   │   ├── src/
│   │   │   └── index.ts             # LLMAdapter interface (no implementation yet)
│   │   └── package.json
│   └── router/                      # @mindmap/router (stub in Phase 1)
│       ├── src/
│       │   └── index.ts             # RoutingDecision type + stub export
│       └── package.json
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

### Pattern 1: Auth.js v5 with Credentials Provider + Drizzle Adapter

**What:** Auth.js v5 in Next.js App Router uses a `auth.ts` config file at the root of `apps/web`. The Credentials provider handles email/password. The Drizzle adapter connects Auth.js session/account tables to the same Postgres database as app data.

**When to use:** All authentication flows — signup, login, session check, logout.

**Key implementation details:**
- Auth.js v5 exports `auth`, `signIn`, `signOut`, `handlers` from a single config
- The `handlers` export provides `GET` and `POST` for the catch-all route
- Database sessions require `@auth/drizzle-adapter` and the Auth.js table schema (users, sessions, accounts, verification_tokens)
- Role must be stored as a custom field and surfaced via `callbacks.session`

```typescript
// apps/web/lib/auth.ts
// Source: https://authjs.dev/getting-started/adapters/drizzle
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@mindmap/db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "database" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Fetch user from DB, verify bcrypt hash
        // Return user object or null
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Attach role and userId to session
      session.user.role = user.role;
      return session;
    },
  },
});
```

```typescript
// apps/web/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

[CITED: https://authjs.dev/getting-started/adapters/drizzle]

### Pattern 2: Drizzle Schema with Auth.js Tables + App Tables

**What:** Auth.js Drizzle adapter requires specific table shapes. These must be defined in the Drizzle schema and must match exactly — the adapter generates SQL from these definitions.

**When to use:** In `@mindmap/db` schema; Auth.js tables live alongside app tables in the same database.

```typescript
// packages/db/src/schema/auth.ts
// Source: https://authjs.dev/getting-started/adapters/drizzle (PostgreSQL schema)
import {
  pgTable, text, timestamp, integer, primaryKey
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // App-specific additions:
  role: text("role", { enum: ["student", "teacher"] }).notNull().default("student"),
  passwordHash: text("passwordHash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // COPPA TTL (INFR-06)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const accounts = pgTable("accounts", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const verificationTokens = pgTable("verificationTokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));
```

[CITED: https://authjs.dev/getting-started/adapters/drizzle]

### Pattern 3: Class Management Schema (COPPA TTL included)

**What:** The classes and enrollments tables store the class join code and support the grade level per student. The `expires_at` field satisfies INFR-06.

```typescript
// packages/db/src/schema/classes.ts
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const classes = pgTable("classes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(), // 6-char alphanumeric
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const classEnrollments = pgTable("class_enrollments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gradeLevel: integer("grade_level").notNull(), // 0=K, 1-12
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // COPPA TTL
});
```

### Pattern 4: Misconception YAML Schema (Zod)

**What:** The Zod schema for a single misconception entry. This schema runs at both build time (CI validation) and runtime (when the library first loads). Loading fails fast if any YAML entry is malformed.

```typescript
// packages/misconceptions/src/schema.ts
import { z } from "zod";

export const gradeBandSchema = z.enum(["K-5", "6-8", "9-12"]);

export const misconceptionEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.enum(["physics", "biology", "math", "history"]),
  grade_band: gradeBandSchema,
  description: z.string().min(10),
  citation: z.string().min(1),
  probe_questions: z.array(z.string()).min(1),
  confrontation_scenarios: z.array(z.string()).min(1),
});

export const misconceptionLibrarySchema = z.array(misconceptionEntrySchema);

export type MisconceptionEntry = z.infer<typeof misconceptionEntrySchema>;
export type GradeBand = z.infer<typeof gradeBandSchema>;
```

```typescript
// packages/misconceptions/src/loader.ts
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { misconceptionLibrarySchema, type MisconceptionEntry } from "./schema";

let _library: MisconceptionEntry[] | null = null;

export function loadLibrary(): MisconceptionEntry[] {
  if (_library) return _library;

  const domains = ["physics", "biology", "math", "history"];
  const entries: unknown[] = [];

  for (const domain of domains) {
    const filePath = path.join(__dirname, "../library", `${domain}.yaml`);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = yaml.load(content);
    if (Array.isArray(parsed)) entries.push(...parsed);
  }

  _library = misconceptionLibrarySchema.parse(entries);
  return _library;
}

export function getMisconceptionsByDomainAndBand(
  domain: string,
  gradeBand: string
): MisconceptionEntry[] {
  return loadLibrary().filter(
    (e) => e.domain === domain && e.grade_band === gradeBand
  );
}
```

[ASSUMED: File path resolution with `__dirname` works in the Turborepo build output — needs verification if ESM-only packages are used]

### Pattern 5: Turborepo Pipeline Configuration

**What:** `turbo.json` declares task dependencies so `pnpm build` from the repo root builds packages in the correct order.

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

[CITED: https://turbo.build/repo/docs — `^build` means "build all packages this depends on first"]

### Pattern 6: Join Code Generation

**What:** 6-character alphanumeric join codes must be collision-resistant and URL-safe. Naive random generation needs a uniqueness check against the database.

```typescript
// apps/web/actions/class.ts
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude 0,O,1,I to avoid confusion
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((n) => chars[n % chars.length])
    .join("");
}

async function createUniqueJoinCode(db: Database): Promise<string> {
  let code: string;
  let attempts = 0;
  do {
    code = generateJoinCode();
    attempts++;
    if (attempts > 10) throw new Error("Failed to generate unique join code");
  } while (await db.query.classes.findFirst({ where: eq(classes.joinCode, code) }));
  return code;
}
```

[ASSUMED: Collision probability is negligible at small scale (~10k classes), but the loop guard is good practice]

### Anti-Patterns to Avoid

- **Storing role in JWT / client state:** Role must live in the database session, not a JWT claim — database sessions are the locked decision. Auth.js `callbacks.session` attaches role from the DB user record at session read time.
- **Creating pgvector extension inline in migrations:** The `CREATE EXTENSION IF NOT EXISTS vector` must run as the very first migration (migration 0000) before any table with `vector()` columns. Drizzle cannot auto-detect this dependency — it must be placed manually as the first file.
- **Running Auth.js Credentials provider without custom signup:** Auth.js Credentials does NOT create users automatically. The signup Server Action must call `bcryptjs.hash()` and insert into the `users` table manually before the first `signIn()` call.
- **Importing `@mindmap/db` in packages that should be DB-free:** `@mindmap/misconceptions` must NOT import the db package. The YAML library is a pure data package — keeping it DB-free allows CI validation without a database connection.
- **Using `require()` to load YAML in ESM packages:** If any package is configured as `"type": "module"`, use `fs.readFileSync` + `yaml.load()` rather than a dynamic `require()`. This avoids ESM/CJS interop issues.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management | Custom cookie logic, JWT refresh, session expiry | Auth.js v5 database sessions | Session rotation, CSRF protection, token expiry — each has subtle bugs; Auth.js handles all of them |
| Password hashing | `crypto.createHash('sha256', ...)` | `bcryptjs.hash()` with salt rounds ≥ 12 | SHA-256 is fast (bad for passwords); bcrypt is intentionally slow with per-password salt |
| YAML schema validation | Manual field presence checks | Zod `z.object()` schema with `.parse()` | Zod gives typed output, detailed error messages, and runtime safety in one call |
| Monorepo build ordering | Custom shell scripts with explicit build order | `turbo.json` `dependsOn: ["^build"]` | Turborepo handles dependency graph, parallelization, and caching automatically |
| Join code uniqueness | Time-based or sequential codes | Random alphanumeric + DB uniqueness check | Sequential codes leak class count; time-based codes are predictable |
| Database migrations | Manual `ALTER TABLE` SQL | `drizzle-kit generate` + `drizzle-kit migrate` | Schema drift, ordering bugs, missing rollbacks — migration tools handle all of these |

**Key insight:** Auth and session management are COPPA-sensitive surfaces. Custom implementations consistently miss edge cases (session fixation, CSRF, token rotation). Auth.js is the correct level of abstraction for this project.

---

## Common Pitfalls

### Pitfall 1: Auth.js Drizzle Adapter Table Mismatch

**What goes wrong:** Adding custom columns (like `role`, `passwordHash`, `expires_at`) to the `users` table can cause the adapter to fail if the column names don't match Auth.js's expected shape exactly.

**Why it happens:** The `@auth/drizzle-adapter` maps specific column names from the Drizzle schema to Auth.js internal user/session objects. Extra columns are fine, but the required columns (`id`, `email`, `emailVerified`, `name`, `image`) must match exactly — including camelCase vs snake_case distinction in the column definition.

**How to avoid:** Use the official Auth.js Drizzle adapter schema as the base (linked in Code Examples below) and extend it. Do not rename required columns. Add custom fields (`role`, `passwordHash`) as additional columns only.

**Warning signs:** Auth.js throws `Cannot read properties of undefined reading 'id'` or similar errors during signin; user is created but session lookup fails.

### Pitfall 2: pgvector Extension Not Initialized Before First Migration

**What goes wrong:** `drizzle-kit migrate` runs all migrations in filename order. If migration 0001 tries to create a table with `vector(1536)` column type, but `CREATE EXTENSION vector` is in migration 0002, the migration fails with "type vector does not exist."

**Why it happens:** Drizzle Kit generates migration files but doesn't know about PostgreSQL extension dependencies. The extension initialization is not a table schema change, so it doesn't appear in generated migrations automatically.

**How to avoid:** Manually create migration file `0000_init_extensions.sql` with `CREATE EXTENSION IF NOT EXISTS vector;` as the very first migration. Subsequent generated migrations will be numbered 0001+.

**Warning signs:** `ERROR: type "vector" does not exist` during `drizzle-kit migrate`.

### Pitfall 3: Auth.js Credentials Provider Doesn't Auto-Create Users

**What goes wrong:** Calling `signIn("credentials", { email, password })` for a new user returns an error — the user doesn't exist in the database yet.

**Why it happens:** The Credentials provider's `authorize()` function is for verifying credentials against an existing user. It does not create users. The signup flow requires a separate Server Action that creates the user row first.

**How to avoid:** Create a `signUpAction` Server Action that: (1) validates input with Zod, (2) checks email uniqueness, (3) hashes password with bcryptjs, (4) inserts user row, (5) calls `signIn("credentials", ...)` to create the session. The sign-in form and sign-up form are separate flows.

**Warning signs:** New user signup works but returns "CredentialsSignin" error even with valid data.

### Pitfall 4: `__dirname` Unavailable in ESM Packages

**What goes wrong:** `packages/misconceptions/src/loader.ts` uses `__dirname` to construct YAML file paths. If the package is compiled as ESM (`"type": "module"` in `package.json`), `__dirname` is not defined.

**Why it happens:** `__dirname` is a CommonJS global. ESM uses `import.meta.url` instead.

**How to avoid:** Use `fileURLToPath(new URL('../library', import.meta.url))` for ESM, or configure the misconceptions package as CJS. The simplest solution: keep `packages/misconceptions` as CJS (no `"type": "module"`) for Phase 1.

**Warning signs:** `ReferenceError: __dirname is not defined` in build or test output.

### Pitfall 5: Turborepo `workspace:*` Protocol Requires Build Before Dev

**What goes wrong:** Starting `pnpm dev` on `apps/web` before running `pnpm build` in packages causes "Cannot find module '@mindmap/db'" errors.

**Why it happens:** `workspace:*` references the package's built output (typically `dist/`), not the TypeScript source. Until a package is built, its exports are unavailable to consumers.

**How to avoid:** In `turbo.json`, ensure `dev` depends on `^build`. Alternatively, configure packages to export TypeScript source directly via `"exports"` pointing to `.ts` files and use `ts-node` or Next.js's TypeScript transpilation. For monorepos with Next.js, the simplest setup is to have packages export from `src/index.ts` directly with TypeScript path resolution.

**Warning signs:** Module not found errors only in `dev` mode, not after `pnpm build`.

### Pitfall 6: Tailwind v4 Has No `tailwind.config.js`

**What goes wrong:** Following Tailwind v3 documentation and creating a `tailwind.config.js` or running `npx tailwindcss init` produces a config file that v4 ignores entirely.

**Why it happens:** Tailwind v4 switched to CSS-first configuration. All customization happens in the main CSS file via `@theme` directive, not in a JS config.

**How to avoid:** Run `npx shadcn@latest init` which auto-detects v4 and sets up the CSS correctly. Do not create a separate `tailwind.config.js`. Custom theme tokens go in the CSS file under `@theme`.

**Warning signs:** Custom colors defined in `tailwind.config.js` don't appear in the compiled output.

---

## Code Examples

### pgvector Extension Migration (must be first)

```sql
-- packages/db/src/migrations/0000_init_extensions.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

[ASSUMED: This must be created as a manual SQL file; drizzle-kit will not generate it automatically]

### Drizzle Client Factory (dual-driver support)

```typescript
// packages/db/src/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Supports both Docker Compose (pg) and Neon (@neondatabase/serverless)
// Switch by changing the driver import and DATABASE_URL format
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
```

For Neon serverless deployment, swap `drizzle/node-postgres` for `drizzle/neon-http`:

```typescript
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

[ASSUMED: Dual-driver support via environment-based import switching — one approach is a runtime check on `DATABASE_URL` format]

### Misconception YAML Entry Format

```yaml
# packages/misconceptions/library/physics.yaml
- id: phys-001
  name: "Heavier objects fall faster"
  domain: physics
  grade_band: "K-5"
  description: "Students believe that heavier objects fall faster than lighter ones, contrary to Galileo's findings about free fall in a vacuum."
  citation: "Vosniadou, S. (1994). Capturing and modeling the process of conceptual change. Learning and Instruction, 4(1), 45–69."
  probe_questions:
    - "If I drop a bowling ball and a tennis ball from the same height, which hits the ground first?"
    - "Why do you think heavier things might fall faster?"
  confrontation_scenarios:
    - "In 1971, astronaut David Scott dropped a hammer and a feather on the Moon (no air). They hit the ground at exactly the same time. How does this change your thinking?"
    - "Parachutists use parachutes to slow down — but their weight hasn't changed. What is actually slowing them down?"
```

[ASSUMED: YAML structure — matches MISC-02 requirements; exact field names are Claude's discretion per CONTEXT.md]

### Vitest Test for Misconception Library CI Validation (MISC-03)

```typescript
// packages/misconceptions/src/__tests__/library.test.ts
import { describe, it, expect } from "vitest";
import { loadLibrary } from "../loader";

describe("misconception library", () => {
  it("loads without schema errors", () => {
    expect(() => loadLibrary()).not.toThrow();
  });

  it("has at least 35 entries", () => {
    const library = loadLibrary();
    expect(library.length).toBeGreaterThanOrEqual(35);
  });

  it("covers all 4 required domains", () => {
    const library = loadLibrary();
    const domains = new Set(library.map((e) => e.domain));
    expect(domains).toContain("physics");
    expect(domains).toContain("biology");
    expect(domains).toContain("math");
    expect(domains).toContain("history");
  });

  it("each entry has at least one probe question", () => {
    const library = loadLibrary();
    for (const entry of library) {
      expect(entry.probe_questions.length).toBeGreaterThan(0);
    }
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth v4 (JWT by default) | Auth.js v5 (database sessions, App Router native) | 2024 | Session management is now server-authoritative; easier to add TTL enforcement |
| Prisma ORM | Drizzle ORM | 2024-2025 | Smaller bundle, native pgvector, better serverless cold starts |
| Tailwind v3 JS config | Tailwind v4 CSS-first config | Early 2025 | No `tailwind.config.js`; customization via `@theme` in CSS |
| `create-react-app` + separate Express API | Next.js 15 App Router (RSC + Server Actions) | 2024 | Single codebase; no separate API server needed for this project's use case |
| Jest | Vitest | 2023-2024 | 10-20x faster; native TypeScript + ESM; preferred for Turborepo |

**Deprecated/outdated:**
- `NextAuth v4`: Still documented but superseded by Auth.js v5 for App Router projects. v4 requires manual API routes and lacks the new `auth()` server-side helper.
- `tailwind.config.js`: Ignored by Tailwind v4. Only relevant if maintaining a v3 project.
- `pages/api/auth/[...nextauth].ts`: Auth.js v5 uses App Router route handler at `app/api/auth/[...nextauth]/route.ts`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next.js 16.2.2 is production-stable and API-compatible with Next.js 15.x patterns | Standard Stack | Planner pins `next@15.x` instead; minor version choice, low execution risk |
| A2 | `__dirname` unavailable in ESM packages — suggest keeping misconceptions package as CJS | Common Pitfalls / Code Examples | If package must be ESM, need `import.meta.url` alternative — medium fix |
| A3 | Dual-driver support (pg vs neon-http) via conditional import based on DATABASE_URL | Code Examples | May need a build-time env flag instead of runtime switch; minor architectural decision |
| A4 | pgvector manual extension migration must be created by hand as `0000_init_extensions.sql` | Architecture Patterns / Pitfalls | If drizzle-kit supports `sql` migration prefix, approach differs slightly — low risk |
| A5 | YAML field names match MISC-02 requirements (probe_questions, confrontation_scenarios snake_case) | Code Examples | YAML schema is Claude's discretion; planner should verify against MISC-02 wording |
| A6 | Join code generation using `crypto.getRandomValues` works in Next.js Server Actions without special polyfill | Code Examples | May need `node:crypto` import in Node.js runtime; low risk |

---

## Open Questions

1. **Which Next.js version to pin?**
   - What we know: npm registry shows `next@16.2.2` as latest; STACK.md recommended `15.x`; both are stable
   - What's unclear: Whether Next.js 16 has breaking API changes that affect App Router patterns documented in the research
   - Recommendation: Pin `next@15.x` (last 15 stable) until the planner or user confirms 16.x compatibility

2. **pgvector Docker image: use `pgvector/pgvector:pg16` or `ankane/pgvector`?**
   - What we know: Both images are available locally; `pgvector/pgvector:pg16` is the official image maintained by the pgvector project; `ankane/pgvector` is an older community image
   - What's unclear: Version of pgvector extension in each image
   - Recommendation: Use `pgvector/pgvector:pg16` (official; confirmed available locally)

3. **COPPA TTL cleanup mechanism**
   - What we know: `expires_at` column on `users` and `class_enrollments` is locked (INFR-06); a "scheduled cleanup job" was decided
   - What's unclear: Whether this is a `pg_cron` SQL job, a Next.js API route cron (Vercel cron), or an application-level interval
   - Recommendation: For Phase 1, add the `expires_at` column and a commented-out seed example; defer the actual cleanup scheduler to Phase 6 (deployment phase). The schema commitment is what Phase 1 requires — the execution can be deferred.

4. **`@mindmap/llm` and `@mindmap/router` stub scope**
   - What we know: Both packages are part of the required monorepo structure but not needed until Phase 2
   - What's unclear: Whether Phase 1 requires anything beyond `package.json` + empty `src/index.ts` for these stubs
   - Recommendation: Create both packages with typed interface stubs (`LLMAdapter` interface, `RoutingDecision` type) but no implementation. This ensures `apps/web` can import types from them even if the implementations are empty.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All packages | ✓ | v24.13.0 | — |
| pnpm | Workspace management | ✓ | 10.30.3 | — |
| Docker | pgvector database | ✓ | 29.2.0 | — |
| Docker Compose | DB orchestration | ✓ | v5.0.2 | — |
| PostgreSQL 16 (Docker) | Database layer | ✓ | 16.13 (existing container) | — |
| pgvector extension | DB schema (Phase 3) | ✗ on existing container | — | Use `pgvector/pgvector:pg16` image (already pulled) |
| psql CLI | DB verification | ✗ (not in PATH) | — | Use `docker exec` to run psql |

**Missing dependencies with no fallback:**
- None that block Phase 1 execution

**Missing dependencies with fallback:**
- **pgvector on existing Postgres container:** The `upstream-pg` container (postgres:16) does NOT have the pgvector extension installed. The project must use `pgvector/pgvector:pg16` image in its own `docker-compose.yml`. This image is confirmed pulled locally. The existing `upstream-pg` container is unrelated (another project) and must NOT be used for MindMap.

**Important:** Port 5432 may be occupied if the existing `upstream-pg` container is remapped. `upstream-pg` runs on host port 5433. The MindMap `docker-compose.yml` should use the default 5432 mapping (no conflict).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 |
| Config file | `vitest.config.ts` per package (none exists — Wave 0 gap) |
| Quick run command | `pnpm --filter @mindmap/misconceptions test` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MISC-01 | Library has 35+ entries across 4 domains | unit | `pnpm --filter @mindmap/misconceptions test` | ❌ Wave 0 |
| MISC-02 | Each entry has required fields (Zod schema) | unit | `pnpm --filter @mindmap/misconceptions test` | ❌ Wave 0 |
| MISC-03 | CI schema validation passes | unit | `pnpm turbo test` | ❌ Wave 0 |
| AUTH-01 | Student signup creates user in DB | integration | manual or e2e only (requires running DB) | ❌ manual-only |
| AUTH-02 | Teacher signup creates user with teacher role | integration | manual or e2e only | ❌ manual-only |
| AUTH-03 | Session persists across browser refresh | e2e | manual browser test | manual-only |
| AUTH-04 | Logout deletes session from DB | integration | manual | manual-only |
| AUTH-05 | Class created with unique join code | unit (code gen) | `pnpm --filter apps/web test -- class` | ❌ Wave 0 |
| AUTH-06 | Student joins class via valid code | integration | manual | manual-only |
| AUTH-07 | Teacher views roster | integration | manual | manual-only |
| AUTH-08 | Grade level stored and readable | integration | manual | manual-only |
| INFR-06 | `expires_at` column exists on users + enrollments | unit (schema) | Drizzle schema type check | ❌ Wave 0 |
| PRIV-02 | No external HTTP calls from DB/misconceptions packages | unit | inspect imports / no fetch in these packages | manual review |

### Sampling Rate
- **Per task commit:** `pnpm --filter @mindmap/misconceptions test`
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full Vitest suite green + manual login/logout/join flow verified in browser before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/misconceptions/src/__tests__/library.test.ts` — covers MISC-01, MISC-02, MISC-03
- [ ] `packages/misconceptions/vitest.config.ts` — Vitest config for the package
- [ ] `apps/web/src/__tests__/class-code.test.ts` — covers join code generation logic (AUTH-05)
- [ ] Root `vitest.config.ts` or `turbo.json` test pipeline — enables `pnpm turbo test`
- [ ] Framework install: All packages need `vitest` as devDependency; run `pnpm add -D vitest` per package

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth.js v5 Credentials provider; bcryptjs with salt rounds ≥ 12 |
| V3 Session Management | yes | Auth.js database sessions; HTTP-only cookie; `session.strategy: "database"` |
| V4 Access Control | yes | `auth()` middleware in Next.js; role check (`session.user.role`) before class management actions |
| V5 Input Validation | yes | Zod schema on all Server Actions and YAML loader |
| V6 Cryptography | partial | bcryptjs for password hashing; Auth.js generates session tokens via `crypto.randomUUID()` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password brute force | Elevation of Privilege | bcryptjs hash with ≥12 rounds (intentional slowness); no rate limiting in Phase 1 (add in polish phase) |
| Session fixation | Elevation of Privilege | Auth.js rotates session token on login by default with database sessions |
| Insecure direct object reference (student accessing another student's data) | Information Disclosure | Server Actions check `session.user.id` matches requested resource owner; middleware protects `/student/*` and `/teacher/*` routes |
| YAML injection | Tampering | YAML is loaded from local filesystem (not user input); Zod validates structure; no dynamic YAML from user data |
| Join code enumeration | Information Disclosure | Codes are 6-char alphanumeric = 32^6 = ~1 billion combinations; invalid code returns generic "code not found" error (no timing difference) |
| Student accessing teacher routes | Elevation of Privilege | Role check in Server Actions: `if (session.user.role !== "teacher") throw new Error("Unauthorized")` |
| COPPA: Storing student data beyond TTL | Compliance | `expires_at` column on users + enrollments; cleanup scheduler (deferred to Phase 6) |

---

## Sources

### Primary (HIGH confidence)
- npm registry — all package versions verified via `npm view` on 2026-04-08
- Docker environment — confirmed via `docker ps` on 2026-04-08
- `STACK.md` and `ARCHITECTURE.md` in `.planning/research/` — project-level research completed prior to this phase
- `01-UI-SPEC.md` in `.planning/phases/01-foundation/` — UI design contract from gsd-ui-researcher

### Secondary (MEDIUM confidence)
- [Auth.js v5 Drizzle adapter docs](https://authjs.dev/getting-started/adapters/drizzle) — table schema shapes, adapter usage
- [Auth.js v5 Credentials provider](https://authjs.dev/getting-started/authentication/credentials) — signup flow pattern
- [Turbo.build task configuration](https://turbo.build/repo/docs/reference/configuration) — `dependsOn`, `^build` semantics
- [Drizzle ORM pgvector guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) — extension initialization, column types

### Tertiary (LOW confidence / ASSUMED)
- Next.js 16.2.2 API compatibility — not verified against Next.js 16 docs; flagged in Assumptions Log

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-04-08
- Architecture: HIGH — patterns derived from existing STACK.md/ARCHITECTURE.md (prior research), Auth.js official docs
- Auth.js specifics: MEDIUM — beta library; API stable but not semver-guaranteed
- Pitfalls: HIGH — specific, reproducible failure modes from the implementation domain
- Validation architecture: HIGH — Vitest is confirmed installed; test gaps are clearly documented

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (30 days for stable packages; Auth.js beta may update sooner)
