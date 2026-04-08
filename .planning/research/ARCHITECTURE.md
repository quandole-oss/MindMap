# Architecture Research

**Domain:** AI-powered K-12 educational knowledge graph tool
**Researched:** 2026-04-08
**Confidence:** HIGH (primary choices well-established; routing/diagnostic state machine is novel synthesis)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Presentation Layer                           │
│  ┌──────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │  Daily Input │  │  D3 Knowledge Graph   │  │ Teacher Dashboard│  │
│  │  (question)  │  │  (force-directed SVG) │  │ (heatmap, stats) │  │
│  └──────┬───────┘  └──────────┬────────────┘  └────────┬─────────┘  │
└─────────┼────────────────────┼─────────────────────────┼────────────┘
          │                    │ (graph JSON)             │
          │ (POST /api/ask)    │                          │ (GET /api/teacher/*)
┌─────────▼────────────────────▼─────────────────────────▼────────────┐
│                         API / Server Actions Layer                   │
│  ┌──────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │  /api/ask    │  │  /api/graph/[userId]  │  │  /api/teacher/*  │  │
│  │  (main flow) │  │  (graph queries)      │  │  (class metrics) │  │
│  └──────┬───────┘  └───────────────────────┘  └──────────────────┘  │
└─────────┼────────────────────────────────────────────────────────────┘
          │
┌─────────▼────────────────────────────────────────────────────────────┐
│                       @mindmap/router Package                        │
│                                                                      │
│   Input: { concept, gradeband, questionText }                        │
│   Logic: misconception YAML lookup → probability score               │
│   Output: { mode: "enrich" | "diagnose", misconceptionId? }          │
└─────────┬──────────────────────┬───────────────────────────────────  ┘
          │ enrich               │ diagnose
┌─────────▼──────────┐  ┌───────▼──────────────────────────────────┐
│ @mindmap/llm       │  │ @mindmap/llm (Diagnostic flow)           │
│ Enrich adapter     │  │ probe → classify → confront → resolve    │
│ (rich answer +     │  │ (Socratic state machine, multi-turn)     │
│  concept list)     │  └───────┬──────────────────────────────────┘
└─────────┬──────────┘          │ classified misconception
          │                     │
┌─────────▼─────────────────────▼──────────────────────────────────┐
│                  Concept Extraction Pipeline                       │
│  1. Raw concept list from LLM response                            │
│  2. Embed each concept → pgvector (text-embedding-3-small)        │
│  3. Similarity search: cosine > 0.92 threshold → candidate match  │
│  4. LLM disambiguation if borderline (0.85-0.92 band)            │
│  5. Upsert canonical concept / create new node                    │
└─────────┬──────────────────────────────────────────────────────── ┘
          │
┌─────────▼────────────────────────────────────────────────────────┐
│                    @mindmap/db Package                             │
│  PostgreSQL + pgvector (Neon / Docker Compose)                    │
│                                                                   │
│  Tables: users, students, teachers, classes                       │
│          concepts (embedding vector<1536>)                        │
│          concept_connections (source, target, strength)           │
│          daily_questions, answers                                 │
│          misconception_events                                     │
│          node_health_states                                       │
│                                                                   │
│  Indexes: HNSW on concepts.embedding                              │
└───────────────────────────────────────────────────────────────── ┘
          ↑
┌─────────┴────────────────────────────────────────────────────────┐
│               @mindmap/misconceptions Package                     │
│  YAML files (35+ entries, 4 domains)                              │
│  Loader: validates schema, exports typed MisconceptionLibrary     │
│  Used by: router (routing rules) + llm (prompt injection)         │
└───────────────────────────────────────────────────────────────── ┘
```

### Component Responsibilities

| Component | Responsibility | Package |
|-----------|----------------|---------|
| `apps/web` | Next.js app: UI, API routes, server actions, auth | `apps/web` |
| `@mindmap/llm` | LLM adapter abstraction, prompt templates, response parsers | `packages/llm` |
| `@mindmap/router` | Decides enrich vs. diagnose mode; reads misconception YAML routing rules | `packages/router` |
| `@mindmap/misconceptions` | YAML library loader, schema validation, typed exports | `packages/misconceptions` |
| `@mindmap/db` | Drizzle ORM schema, migrations, pgvector queries, connection pool | `packages/db` |
| Concept pipeline | Orchestration layer (inside `apps/web` API route) calling `llm` + `db` + pgvector | `apps/web/lib/pipeline` |
| D3 graph renderer | Client-only React component wrapping D3 force simulation; receives graph JSON | `apps/web/components/graph` |
| Teacher dashboard | Server-rendered Next.js page with aggregated concept/misconception queries | `apps/web/app/teacher` |

## Recommended Project Structure

```
mindmap/
├── apps/
│   └── web/                         # Next.js 14+ App Router
│       ├── app/
│       │   ├── (auth)/              # login / signup routes
│       │   ├── student/             # daily question, graph view
│       │   ├── teacher/             # class dashboard
│       │   └── api/
│       │       ├── ask/route.ts     # main pipeline entrypoint
│       │       ├── graph/route.ts   # graph data fetch
│       │       └── teacher/route.ts # teacher metrics
│       ├── components/
│       │   ├── graph/               # D3 force graph (client component)
│       │   ├── diagnostic/          # Socratic dialogue UI
│       │   └── dashboard/           # teacher charts
│       └── lib/
│           └── pipeline/            # concept extraction orchestration
├── packages/
│   ├── llm/                         # @mindmap/llm
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── openai.ts
│   │   │   │   └── ollama.ts
│   │   │   ├── prompts/             # enrich.ts, diagnose.ts, extract.ts
│   │   │   └── index.ts             # LLMAdapter interface + factory
│   ├── router/                      # @mindmap/router
│   │   ├── src/
│   │   │   ├── rules.ts             # routing rule evaluator
│   │   │   └── index.ts             # route(concept, gradeband) → RoutingDecision
│   ├── misconceptions/              # @mindmap/misconceptions
│   │   ├── library/                 # YAML files by domain
│   │   │   ├── physics.yaml
│   │   │   ├── biology.yaml
│   │   │   ├── math.yaml
│   │   │   └── chemistry.yaml
│   │   └── src/
│   │       ├── schema.ts            # Zod validation
│   │       └── index.ts             # loadLibrary(), getMisconception()
│   └── db/                          # @mindmap/db
│       ├── src/
│       │   ├── schema/              # Drizzle table definitions
│       │   ├── queries/             # typed query helpers
│       │   └── migrations/
│       └── index.ts
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

### Structure Rationale

- **`packages/llm`:** Isolating the LLM adapter behind an interface means swapping Anthropic → OpenAI → Ollama requires touching one file. Prompts live here — not in the web app — so they can be tested independently.
- **`packages/router`:** Decoupled from LLM so routing logic (which is pure function: concept + gradeband → mode) can be unit tested without mocking LLM calls.
- **`packages/misconceptions`:** YAML-based library that any package can import. Community contributions come as YAML PRs; CI validates schema automatically without needing to run the app.
- **`packages/db`:** All database access in one place. pgvector queries (concept deduplication) live here with typed wrappers, preventing direct SQL scattered across the app.
- **`apps/web/lib/pipeline`:** The concept extraction pipeline is app-layer orchestration — it calls `llm`, `db`, and `misconceptions` packages. This is NOT a standalone package because it is deployment-coupled (it runs inside Next.js API routes).

## Architectural Patterns

### Pattern 1: LLM Adapter Interface

**What:** Define a `LLMAdapter` interface with methods `enrich()`, `diagnose()`, `extractConcepts()`, `embed()`. Each provider (Anthropic, OpenAI, Ollama) implements it. A factory function selects the active adapter from env config.

**When to use:** Any time the system calls an LLM — always go through the adapter, never call provider SDKs directly from `apps/web`.

**Trade-offs:** Adds one layer of indirection. Worth it: switching providers for cost/availability requires no refactoring.

**Example:**
```typescript
// packages/llm/src/index.ts
export interface LLMAdapter {
  enrich(question: string, gradeband: string): Promise<EnrichResult>;
  diagnose(state: DiagnosticState): Promise<DiagnosticTurn>;
  extractConcepts(text: string): Promise<string[]>;
  embed(text: string): Promise<number[]>;
}

export function createLLMAdapter(provider: "anthropic" | "openai" | "ollama"): LLMAdapter {
  switch (provider) {
    case "anthropic": return new AnthropicAdapter();
    case "openai":    return new OpenAIAdapter();
    case "ollama":    return new OllamaAdapter();
  }
}
```

### Pattern 2: Two-Stage Concept Deduplication

**What:** When a new concept string arrives, use a fast pgvector ANN (approximate nearest neighbor) query to find candidates with cosine similarity above 0.92. If a match exists, merge. If similarity is in the ambiguous band (0.85–0.92), invoke LLM disambiguation. Below 0.85, create a new node. This prevents "gravity (physics)" and "gravity (baking)" from incorrectly merging.

**When to use:** Every time the extraction pipeline produces a concept string before writing to the database.

**Trade-offs:** The LLM disambiguation call adds ~500ms latency for borderline cases. Accept this — correctness matters more than speed for graph integrity. HNSW indexing keeps the vector search under 10ms even at 100k+ nodes.

**Example:**
```typescript
async function deduplicateConcept(
  rawConcept: string,
  contextText: string,
  db: Database,
  llm: LLMAdapter
): Promise<ConceptId> {
  const embedding = await llm.embed(rawConcept);
  const candidates = await db.findSimilarConcepts(embedding, { threshold: 0.85, limit: 5 });

  const exact = candidates.find(c => c.similarity >= 0.92);
  if (exact) return exact.id;

  const borderline = candidates.filter(c => c.similarity >= 0.85);
  if (borderline.length > 0) {
    const merged = await llm.disambiguate(rawConcept, contextText, borderline);
    if (merged) return merged.id;
  }

  return db.createConcept(rawConcept, embedding);
}
```

### Pattern 3: Router State Machine (Enrich vs. Diagnose)

**What:** The router evaluates a concept against the misconception library and grade band to produce a deterministic `RoutingDecision`. The routing is stateless and pure — given the same inputs it returns the same output. The Socratic diagnostic flow is a separate state machine tracking probe → classify → confront → resolve across turns.

**When to use:** Every question submission runs through the router first. Diagnostic state is stored in the database (not in-memory), so sessions survive page reloads.

**Trade-offs:** Storing diagnostic state in PostgreSQL means slightly higher latency than in-memory sessions. Correct trade-off for a school context where browser crashes are common.

```typescript
// packages/router/src/index.ts
export type RoutingDecision =
  | { mode: "enrich" }
  | { mode: "diagnose"; misconceptionId: string; probability: number };

export function routeQuestion(
  concept: string,
  gradeband: "K-5" | "6-8" | "9-12",
  library: MisconceptionLibrary
): RoutingDecision { ... }

// Diagnostic state machine stages
export type DiagnosticStage = "probe" | "classify" | "confront" | "resolve";
```

## Data Flow

### Primary Request Flow: Student Asks a Question

```
Student submits question
    ↓
POST /api/ask (Next.js API route)
    ↓
Auth middleware → verify JWT, get userId + gradeband
    ↓
@mindmap/router.routeQuestion(concept, gradeband, library)
    ↓
        ┌─── mode: "enrich" ─────────────────────────────────────┐
        │    LLMAdapter.enrich() → { richAnswer, rawConcepts }   │
        │    Concept extraction pipeline (per concept):          │
        │      embed → deduplicate → upsert node → add edge      │
        │    Write daily_question + answer rows                  │
        │    Return { mode, answer, graphDelta }                 │
        └────────────────────────────────────────────────────────┘
        ┌─── mode: "diagnose" ───────────────────────────────────┐
        │    Create misconception_event row (stage: "probe")     │
        │    LLMAdapter.diagnose({ stage, misconceptionId })     │
        │    Return { mode, firstProbeQuestion, misconceptionId } │
        └────────────────────────────────────────────────────────┘
    ↓
Client renders answer OR enters Socratic dialogue UI
    ↓ (D3 graph)
GET /api/graph/[userId] → query concepts + connections → graph JSON
D3 force simulation re-renders with new nodes
```

### Diagnostic Turn Flow (multi-turn Socratic dialogue)

```
Student answers probe question
    ↓
POST /api/ask/diagnose { sessionId, studentResponse }
    ↓
Load diagnostic state from DB (current stage)
    ↓
LLMAdapter.diagnose({ stage, priorTurns, studentResponse, misconception })
    ↓
Advance state machine: probe → classify → confront → resolve
    ↓
If stage = "resolve":
    Mark node_health_state = "misconception" (or "resolved")
    Write concept connections from resolved understanding
    ↓
Return next question OR resolution summary
```

### Graph Data Flow (read path)

```
GET /api/graph/[userId]
    ↓
db.getConceptGraph(userId)  ← concepts + concept_connections tables
    ↓
Transform to D3 format: { nodes: [{ id, label, health, size }], links: [...] }
    ↓
Client: D3 useEffect initializes/updates force simulation
Node color = health state (healthy=green, misconception=red, unprobed=grey, bridge=gold)
```

### Teacher Dashboard Flow

```
GET /api/teacher/class/[classId]
    ↓
Parallel queries:
  - misconception_events aggregate (misconception counts by concept)
  - node_health_states aggregate (health distribution per student)
  - daily_questions count (engagement/streak data)
    ↓
Return { misconceptionHeatmap, engagementMatrix, conceptClusters }
    ↓
Server-rendered page with chart components (recharts or similar)
```

## Build Order (Dependency Graph)

The packages have a strict dependency direction. Build in this order:

```
Layer 0 (no internal deps):
  @mindmap/misconceptions   ← only imports YAML + Zod

Layer 1 (depends on Layer 0):
  @mindmap/db               ← imports nothing internal
  @mindmap/router           ← imports @mindmap/misconceptions

Layer 2 (depends on Layer 1):
  @mindmap/llm              ← imports nothing internal (provider SDKs only)

Layer 3 (depends on Layers 0-2):
  apps/web                  ← imports all packages
```

**Implementation phases implied by this order:**

1. **`@mindmap/db` schema first** — everything persists data; need schema before writing any logic
2. **`@mindmap/misconceptions` second** — YAML library + schema validation; no code dependencies; can be done alongside db
3. **`@mindmap/llm` adapter third** — enrich and embed are needed for the happy path; diagnostic prompts can come later
4. **`@mindmap/router` fourth** — needs misconceptions library to be loadable
5. **Concept pipeline in `apps/web`** — wires packages together; proves end-to-end works
6. **D3 graph UI** — needs graph data from db; unblocked after pipeline works
7. **Diagnostic flow** — builds on the pipeline; adds the state machine + multi-turn UI
8. **Teacher dashboard** — depends on real data existing from the pipeline

## Anti-Patterns

### Anti-Pattern 1: LLM Calls Directly in React Components

**What people do:** Call Anthropic SDK directly from a `useEffect` or `onClick` in a React component.

**Why it's wrong:** Exposes API keys in client bundle. No server-side validation. Bypasses the router and pipeline.

**Do this instead:** All LLM calls go through `POST /api/ask` (API route). Client only sees the response.

### Anti-Pattern 2: Skipping the Deduplication Stage

**What people do:** Write extracted concepts directly to the DB without embedding and similarity check, trusting exact string match instead.

**Why it's wrong:** "Gravity (physics)" and "gravity" become two nodes. Graph fragments rather than connects. This is the stated hard problem of the project.

**Do this instead:** Every concept, even if it looks unique, runs through the two-stage dedup (embed → ANN → optional LLM disambiguate) before insertion.

### Anti-Pattern 3: Storing Diagnostic Session State Client-Side

**What people do:** Track Socratic dialogue stage in React state (useState) or localStorage.

**Why it's wrong:** Students lose progress on browser crash, tab switch, or device change. Teachers cannot see mid-session diagnostic state for intervention.

**Do this instead:** Write diagnostic state to `misconception_events` table after every turn. The client is stateless — it reads stage from the API.

### Anti-Pattern 4: Putting Graph Rendering Logic in API Routes

**What people do:** Generate SVG or run D3 simulation server-side, return HTML.

**Why it's wrong:** D3 force simulation is interactive and physics-based; it must run in the browser. Server-side rendering it produces a static snapshot with no drag/zoom/hover.

**Do this instead:** API returns pure graph data JSON (nodes + links). The D3 component is a client-only React component (`"use client"`) that initializes the simulation in a `useEffect`.

### Anti-Pattern 5: Monolithic Prompt Strings in API Routes

**What people do:** Inline prompt templates as string literals inside API route handlers.

**Why it's wrong:** Prompts cannot be tested in isolation. Adapter swap requires hunting through `apps/web`. Misconception context injection becomes entangled with HTTP handling.

**Do this instead:** All prompts live in `packages/llm/src/prompts/`. They are typed functions that accept structured inputs and return strings. Tested independently of the web layer.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic Claude API | `AnthropicAdapter` in `@mindmap/llm`; env var `LLM_PROVIDER=anthropic` | Primary provider; streaming via SSE for long responses |
| OpenAI API | `OpenAIAdapter` in `@mindmap/llm`; same interface | Fallback; also source of `text-embedding-3-small` embeddings |
| Ollama (local) | `OllamaAdapter` in `@mindmap/llm`; points to `http://localhost:11434` | For self-hosted deployments with no cloud LLM dependency |
| Neon (cloud Postgres) | `DATABASE_URL` env var; `@mindmap/db` uses standard `pg` driver | pgvector extension must be enabled via `CREATE EXTENSION vector` |
| Docker Compose Postgres | Same driver, different `DATABASE_URL`; pgvector via `ankane/pgvector` image | Self-hosted path |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `apps/web` ↔ `@mindmap/llm` | Direct import; async function calls | Never use HTTP between internal packages |
| `apps/web` ↔ `@mindmap/db` | Direct import; async query functions | Connection pool initialized once at app startup |
| `apps/web` ↔ `@mindmap/router` | Direct import; pure synchronous function | Router has no I/O; can be called inline |
| `@mindmap/router` ↔ `@mindmap/misconceptions` | Direct import; in-memory YAML data | Library loaded once at startup and cached |
| D3 component ↔ API | HTTP GET `/api/graph/[userId]` | Client component fetches graph JSON; not a direct package import |
| Diagnostic UI ↔ API | HTTP POST `/api/ask/diagnose` | Multi-turn; stateless client, stateful server |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users (capstone demo) | Single Next.js instance on Vercel, single Neon branch, no caching layer needed. Vercel edge functions for API routes. |
| 500-10k users | Add Redis (Upstash) for session caching and API response caching. HNSW index on `concepts.embedding` becomes critical. Consider read replica for teacher dashboard queries. |
| 10k+ users | Separate concept extraction pipeline from request path (use a queue: BullMQ or Inngest). Graph queries may need materialized views. Consider dedicated embedding service cache to reduce redundant embed API calls. |

### Scaling Priorities for MindMap Specifically

1. **First bottleneck:** LLM API latency. Every `/api/ask` call waits for an LLM response. Mitigation: stream responses to the client with SSE rather than waiting for the full response.
2. **Second bottleneck:** pgvector ANN query performance at scale. HNSW index handles this well to ~1M vectors; beyond that, partitioning by domain becomes necessary.
3. **Third bottleneck:** Teacher dashboard aggregate queries. These scan across all students in a class. Mitigation: pre-aggregate on question submission, store summary rows, not just raw events.

## Sources

- Turborepo structuring guide: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository
- pgvector HNSW indexing and dedup patterns: https://www.instaclustr.com/education/vector-database/pgvector-key-features-tutorial-and-pros-and-cons-2026-guide/
- NVIDIA SemDedup (cosine threshold deduplication): https://docs.nvidia.com/nemo-framework/user-guide/25.07/datacuration/semdedup.html
- LLM-empowered KG construction survey: https://arxiv.org/html/2510.20345v1
- KnowEdu educational KG architecture: https://www.researchgate.net/publication/325303797_KnowEdu_A_System_to_Construct_Knowledge_Graph_for_Education
- D3 force-directed graph with Next.js: https://medium.com/@abdulmajeedamm33/elevating-network-visualizations-d3-force-next-js-2ce1a322d746
- Socratic LLM multi-agent architectures: https://princeton-nlp.github.io/SocraticAI/
- Next.js LLM streaming patterns: https://ai-sdk.dev/docs/getting-started/nextjs-app-router
- Monorepo production architecture: https://mavro.dev/blog/building-production-monorepo-turborepo

---
*Architecture research for: AI-powered K-12 educational knowledge graph (MindMap)*
*Researched: 2026-04-08*
