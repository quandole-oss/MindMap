# Phase 3: Knowledge Graph - Research

**Researched:** 2026-04-08
**Domain:** pgvector embeddings, two-stage deduplication, D3.js force graph, bridge detection
**Confidence:** HIGH (core patterns verified; D3 cleanup details MEDIUM)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Embedding model: OpenAI `text-embedding-3-small` (1536 dimensions)
- Two-stage deduplication thresholds: >0.92 cosine similarity = auto-merge, 0.85-0.92 = LLM disambiguate, <0.85 = new node
- Embeddings generated in `onFinish` callback alongside concept extraction
- "Same word, different domain" handled by LLM disambiguation in the 0.85-0.92 band with domain context
- D3.js SVG rendering with `useRef` + `useEffect`
- Graph data from server action returning nodes + edges JSON; client-only D3 rendering
- Node click opens a side panel showing original questions/exchanges
- Mobile performance: zoom-based clustering at ~250+ nodes
- Auto-create edges between concepts from the same question (curiosity_link type)
- Bridge node detection via betweenness centrality
- Weekly surprise connection: server-side action computes top bridge node, shown as toast/card on student login
- Edge types enum: "curiosity_link" (same question), "bridge" (cross-domain), "misconception_cluster" (shared misconception)
- Node colors: teal (#14b8a6 healthy), coral (#f87171 misconception), gray (#a1a1aa unprobed), purple (#a78bfa bridge)
- Node size: 8 + (visitCount * 2) capped at 24px radius

### Claude's Discretion
- pgvector HNSW vs IVFFlat index type
- D3.js force simulation parameters (charge, link distance, alpha decay)
- Side panel layout and animation
- Bridge detection scheduling (cron vs on-demand)
- Embedding generation error handling and retry strategy

### Deferred Ideas (OUT OF SCOPE)
- Ollama embedding adapter for self-hosted (ADPT-02)
- Advanced graph analytics (centrality scores displayed to user)
- Graph export as PNG/JSON (EXPT-01, EXPT-02)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRPH-01 | Concepts stored as nodes with embedding vectors in PostgreSQL + pgvector | Schema migration: add `vector(1536)` column to concepts; HNSW index; `CREATE EXTENSION vector` already available via pgvector/pgvector:pg16 Docker image |
| GRPH-02 | New concepts deduplicated via two-stage process: pgvector ANN + LLM disambiguation | Drizzle `cosineDistance` + `orderBy` ascending to use HNSW index; `embed()` from `@ai-sdk/openai`; LLM disambiguate via `generateText` with structured output |
| GRPH-03 | Concept edges created between related concepts (curiosity_link, bridge, misconception_cluster) | New `concept_edges` table; insert edge pairs in `onFinish` after dedup resolves concept IDs |
| GRPH-04 | Force-directed D3.js graph visualization renders student's personal knowledge graph | `"use client"` component; `useRef` SVG + `useEffect` for simulation lifecycle; cleanup via `simulation.stop()` + `d3.select(svgRef.current).selectAll("*").remove()` |
| GRPH-05 | Node size scales with visit count | `radius = Math.min(8 + visitCount * 2, 24)` on circle elements; `visitCount` integer column on concepts table |
| GRPH-06 | Node color encodes health state | Four states mapped to color constants: teal/coral/gray/purple; applied as `fill` attr on circle elements |
| GRPH-07 | Student can click any node to see original questions and AI exchanges | Side panel component; click handler sets selectedNode state in parent; fetches conceptQuestions join via server action |
| GRPH-08 | Weekly "surprise connection" notification surfaces a cross-subject bridge | Betweenness centrality computed server-side (pure JS BFS/Brandes algorithm); stored result or computed on-demand at login; displayed via Sonner toast (already installed) |
</phase_requirements>

---

## Summary

Phase 3 adds the vector intelligence layer to MindMap: embedding-powered deduplication, typed concept edges, an interactive D3.js force graph, and bridge node detection. The existing codebase provides strong footholds — the `concepts` table, `conceptQuestions` join table, and `onFinish` pipeline are already in place. The primary task is adding two columns (`embedding vector(1536)` and `visitCount integer`) to concepts, creating a new `concept_edges` table, installing `@ai-sdk/openai` for embeddings, and building the D3 graph page.

The hardest single problem is the pgvector index pitfall: the natural pattern of `ORDER BY 1 - cosineDistance(...)` prevents the HNSW index from being used. Queries must `ORDER BY cosineDistance(...) ASC` instead, using a `WHERE cosineDistance < threshold` filter. This is documented in the pgvector issue tracker and must be explicit in the implementation.

The D3.js integration is well-understood for this stack but requires disciplined `useEffect` cleanup (stop simulation, clear SVG) to avoid memory leaks and React Strict Mode double-mount artifacts.

**Primary recommendation:** Add `@ai-sdk/openai` to `@mindmap/llm`, add a `generateEmbedding()` function to the LLM adapter/package, wire it into `onFinish` after concept extraction, then build the graph page last once the data pipeline is correct.

---

## Standard Stack

### Core (already installed in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| drizzle-orm | 0.45.2 | Schema + vector queries | `vector()` column type, `cosineDistance()` function available [VERIFIED: package.json] |
| pgvector (npm) | 0.2.1 | pgvector Node.js bindings | Already in `@mindmap/db` dependencies [VERIFIED: packages/db/package.json] |
| d3 | 7.9.0 | Force graph visualization | Already in project per STATE.md stack snapshot [VERIFIED: npm registry] |
| ai (Vercel AI SDK) | 6.0.154 | embed() / embedMany() functions | Already in `@mindmap/llm` [VERIFIED: packages/llm/package.json] |

### Needs to be Added
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @ai-sdk/openai | 3.0.52 (current stable) | OpenAI embedding provider for `text-embedding-3-small` | `@ai-sdk/anthropic` does not provide embeddings; OpenAI adapter needed for embed calls [VERIFIED: npm registry] |
| @types/d3 | matching d3 major | TypeScript types for D3 | Required for type-safe D3 code in TSX files [ASSUMED] |

**Note on `@ai-sdk/openai` version:** The beta `4.0.0-beta.25` exists in npm but the current stable is `3.0.52`. Use the stable release. [VERIFIED: npm view @ai-sdk/openai version]

**Installation:**
```bash
# In packages/llm
pnpm add @ai-sdk/openai

# In apps/web (if @types/d3 not yet present)
pnpm add -D @types/d3
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @ai-sdk/openai embed() | Direct openai SDK embeddings endpoint | ai-sdk/openai is the standard, consistent with existing AI SDK usage; direct SDK adds a second dependency |
| Pure JS betweenness centrality | ngraph.centrality npm package | Pure JS keeps zero new deps; Brandes' BFS algorithm is ~50 lines and well-documented; for <500 nodes it's fast enough |

---

## Architecture Patterns

### Schema Changes Required

```
packages/db/src/schema/questions.ts
├── concepts table — ADD: embedding vector(1536), visitCount integer default 0
└── (existing: id, userId, name, domain, status, createdAt — keep all)

NEW: concept_edges table
├── id text primaryKey
├── sourceConceptId → concepts.id (cascade delete)
├── targetConceptId → concepts.id (cascade delete)
├── edgeType enum: "curiosity_link" | "bridge" | "misconception_cluster"
└── createdAt timestamp
```

### Recommended Project Structure (additions only)
```
packages/
└── llm/
    └── src/
        ├── embeddings.ts        # generateEmbedding(text) → number[]
        └── prompts/
            └── disambiguate.ts  # buildDisambiguatePrompt() for 0.85-0.92 band

packages/
└── db/
    └── src/
        ├── schema/
        │   └── questions.ts     # MODIFIED: add embedding + visitCount + concept_edges
        └── queries/
            └── concepts.ts      # findSimilarConcepts(), upsertConcept(), createEdge()

apps/web/
├── app/
│   └── student/
│       └── graph/
│           └── page.tsx         # Server component: fetches graph data, renders KnowledgeGraph
├── components/
│   └── graph/
│       ├── knowledge-graph.tsx  # "use client" — D3 force simulation
│       └── node-detail-panel.tsx # Side panel for selected node
└── actions/
    └── graph.ts                 # getGraphData(userId), getBridgeNode(userId)
```

### Pattern 1: pgvector HNSW Index Definition with Drizzle

**Critical:** The HNSW index must be defined using `sql` template literal because Drizzle's `index().using()` requires the op class.

```typescript
// Source: Drizzle ORM pgvector docs + verified pattern from community issue #436
import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { index } from "drizzle-orm/pg-core";

export const concepts = pgTable("concepts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  status: text("status", { enum: ["unprobed", "healthy", "misconception"] }).notNull().default("unprobed"),
  embedding: vector("embedding", { dimensions: 1536 }),  // nullable until first embed
  visitCount: integer("visit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("concepts_embedding_hnsw_idx")
    .using("hnsw", t.embedding.op("vector_cosine_ops")),
]);
```

[CITED: https://orm.drizzle.team/docs/guides/vector-similarity-search]

### Pattern 2: Cosine Similarity Query — Index-Compatible Form

**Critical pitfall:** `ORDER BY 1 - cosineDistance(...)` prevents index use. Always order by cosineDistance ASC.

```typescript
// Source: pgvector issue tracker + Drizzle docs
import { cosineDistance, sql } from "drizzle-orm";

async function findSimilarConcepts(
  db: Database,
  userId: string,
  embedding: number[],
  threshold: number, // e.g. 0.85 → distance threshold = 1 - 0.85 = 0.15
  limit = 5
) {
  const distanceThreshold = 1 - threshold;  // convert similarity to distance
  
  return db
    .select({
      id: concepts.id,
      name: concepts.name,
      domain: concepts.domain,
      distance: cosineDistance(concepts.embedding, embedding),
    })
    .from(concepts)
    .where(
      and(
        eq(concepts.userId, userId),
        // Use distance comparison, NOT similarity — index can be used this way
        sql`${cosineDistance(concepts.embedding, embedding)} < ${distanceThreshold}`
      )
    )
    .orderBy(cosineDistance(concepts.embedding, embedding))  // ASC = closest first
    .limit(limit);
}
```

[CITED: https://orm.drizzle.team/docs/guides/vector-similarity-search + https://github.com/pgvector/pgvector/issues/760]

### Pattern 3: OpenAI Embeddings via AI SDK

```typescript
// Source: AI SDK Core embeddings docs
// In packages/llm/src/embeddings.ts
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

const embeddingModel = openai.embedding("text-embedding-3-small");

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}
```

Requires `OPENAI_API_KEY` environment variable. The `@ai-sdk/openai` package reads it automatically.

[CITED: https://ai-sdk.dev/docs/ai-sdk-core/embeddings + https://ai-sdk.dev/cookbook/node/embed-text]

### Pattern 4: Two-Stage Deduplication in onFinish

```typescript
// In apps/web/app/api/ask/route.ts — extended onFinish logic
// Pseudocode showing the dedup flow after extractConcepts()

for (const { concept } of extractedConcepts) {
  // Stage 1: embed + ANN search
  const embedding = await generateEmbedding(concept.name);
  const candidates = await findSimilarConcepts(db, userId, embedding, 0.85, 5);
  
  // distance < 0.08 means similarity > 0.92 → auto-merge
  const autoMerge = candidates.find(c => c.distance < 0.08);
  if (autoMerge) {
    await db.update(schema.concepts)
      .set({ visitCount: sql`${schema.concepts.visitCount} + 1` })
      .where(eq(schema.concepts.id, autoMerge.id));
    conceptId = autoMerge.id;
    continue;
  }
  
  // 0.08 <= distance < 0.15 means 0.85–0.92 similarity → LLM disambiguate
  const borderline = candidates.filter(c => c.distance >= 0.08 && c.distance < 0.15);
  if (borderline.length > 0) {
    const isSame = await disambiguateConcept(concept.name, concept.domain, borderline, questionText);
    if (isSame) {
      conceptId = borderline[0].id;
      continue;
    }
  }
  
  // distance >= 0.15 (similarity < 0.85) → new node
  const [saved] = await db.insert(schema.concepts)
    .values({ userId, name: concept.name, domain: concept.domain, embedding, visitCount: 1 })
    .returning();
  conceptId = saved.id;
}
```

**Distance ↔ Similarity conversion:** `similarity = 1 - distance`. Thresholds:
- similarity > 0.92 = distance < 0.08 → auto-merge
- similarity 0.85–0.92 = distance 0.08–0.15 → LLM disambiguate
- similarity < 0.85 = distance > 0.15 → new node

### Pattern 5: D3.js Force Graph in Next.js ("use client")

```typescript
// Source: D3.js official docs + community pattern for React hooks integration
"use client";

import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  status: "unprobed" | "healthy" | "misconception";
  isBridge: boolean;
  visitCount: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  edgeType: "curiosity_link" | "bridge" | "misconception_cluster";
}

const NODE_COLORS = {
  healthy: "#14b8a6",
  misconception: "#f87171",
  unprobed: "#a1a1aa",
  bridge: "#a78bfa",
};

export function KnowledgeGraph({ nodes, links, onNodeClick }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();  // clear on re-render

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => Math.min(8 + d.visitCount * 2, 24) + 4));

    // ... render links, nodes, labels, zoom behavior ...

    simulation.on("tick", () => {
      // update positions
    });

    // CRITICAL: cleanup prevents memory leaks and React Strict Mode issues
    return () => {
      simulation.stop();
      svg.selectAll("*").remove();
    };
  }, [nodes, links]);

  return <svg ref={svgRef} width="100%" height="600" />;
}
```

[CITED: https://d3js.org/d3-force + https://d3js.org/d3-force/simulation]

### Pattern 6: Betweenness Centrality (Pure JS, No Dependencies)

Brandes' algorithm for unweighted undirected graph. O(V * E) time, sufficient for <500 nodes per student.

```typescript
// No external dependency needed — implement Brandes' BFS approach
function computeBetweennessCentrality(
  nodeIds: string[],
  edges: Array<{ sourceConceptId: string; targetConceptId: string }>
): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    adjacency.get(edge.sourceConceptId)?.push(edge.targetConceptId);
    adjacency.get(edge.targetConceptId)?.push(edge.sourceConceptId);
  }

  const centrality = new Map<string, number>(nodeIds.map(id => [id, 0]));

  for (const source of nodeIds) {
    // BFS from source — Brandes' algorithm
    // ... standard BFS + back-propagation ...
  }
  
  return centrality;
}

// Top bridge node = max betweenness centrality node in concept that
// connects concepts from different domains (cross-domain bridge)
```

[CITED: https://en.wikipedia.org/wiki/Betweenness_centrality + Brandes (2001) algorithm]

### Anti-Patterns to Avoid

- **`ORDER BY 1 - cosineDistance(...)`:** Prevents HNSW index use; PostgreSQL sees an expression not a raw operator. Always use `ORDER BY cosineDistance(...) ASC` with a `WHERE cosineDistance < threshold` filter.
- **Missing `CREATE EXTENSION vector`:** pgvector/pgvector:pg16 Docker image has the extension available but it must be enabled per-database. Run `CREATE EXTENSION IF NOT EXISTS vector` in a migration.
- **D3 in RSC (Server Component):** D3 must be in a `"use client"` component. Server-rendering D3 produces dead markup with no physics.
- **Missing useEffect cleanup:** Without `simulation.stop()` and `svg.selectAll("*").remove()` in the cleanup function, React Strict Mode double-mounts leak simulation timers.
- **Embedding nullable but queried without null guard:** `findSimilarConcepts` must filter `WHERE embedding IS NOT NULL` to avoid null distance comparisons on existing concept rows that haven't been embedded yet.
- **Not persisting bridge node result:** Recomputing betweenness centrality on every login is O(V * E) and expensive at scale. For GRPH-08, either persist the top bridge node after weekly computation or compute once per login session and cache in the DB.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Embedding generation | Raw `fetch` to OpenAI `/v1/embeddings` | `embed()` from `ai` + `openai.embedding()` from `@ai-sdk/openai` | Handles auth, retries, error normalization; already in project |
| Vector column type in Drizzle | Raw `sql` column definition | `vector("embedding", { dimensions: 1536 })` from `drizzle-orm/pg-core` | Built-in since Drizzle 0.31; project is on 0.45.2 |
| Cosine distance query | Raw SQL `<=>` strings | `cosineDistance()` from `drizzle-orm` | Type-safe; handles serialization; prevents injection |
| D3 force physics | Custom spring simulation | `d3.forceSimulation` + `d3.forceLink` + `d3.forceManyBody` | D3's force module is the standard; already installed (d3 v7.9.0) |
| Betweenness centrality | Neo4j, networkx, or ngraph.centrality | Pure JS BFS (Brandes' algorithm, ~60 lines) | No new dependency; graph is <500 nodes per student; fast enough |
| Toast notifications | Custom toast component | Sonner (`sonner` package, already installed in apps/web) | Already imported via `components/ui/sonner.tsx`; use `toast()` API |

**Key insight:** The hardest part of this phase is the pgvector query pattern, not the data model. The query pitfall (index bypass with `1 - cosineDistance`) is well-documented but not obvious — it must be explicit in every task that writes similarity queries.

---

## Common Pitfalls

### Pitfall 1: HNSW Index Bypassed by Expression in ORDER BY
**What goes wrong:** Query runs as seq scan instead of index scan; correct results but 100x slower at scale.
**Why it happens:** PostgreSQL's index-only-scan requires the ORDER BY expression to match the index operator exactly. `1 - cosineDistance(a, b)` is a computed expression; the index is built on `cosineDistance(a, b)` only.
**How to avoid:** Always write queries as `ORDER BY cosineDistance(embedding, $vec) ASC` with `WHERE cosineDistance(embedding, $vec) < $distanceThreshold`. Never compute similarity in the ORDER BY.
**Warning signs:** `EXPLAIN (ANALYZE)` shows `Seq Scan on concepts` instead of `Index Scan using concepts_embedding_hnsw_idx`.

### Pitfall 2: Missing `CREATE EXTENSION vector` Migration
**What goes wrong:** `drizzle-kit push` or `migrate` fails with `type "vector" does not exist`.
**Why it happens:** The pgvector Docker image has the extension available but it is not auto-enabled in new databases.
**How to avoid:** Add a migration (or a `db:setup` script) that runs `CREATE EXTENSION IF NOT EXISTS vector;` before any schema push. This must run before `drizzle-kit push`.
**Warning signs:** Push command errors: `error: type "vector" does not exist`.

### Pitfall 3: React Strict Mode D3 Double-Mount
**What goes wrong:** On dev server, each page load spawns two simulations; nodes fly off screen or animation is janky.
**Why it happens:** React Strict Mode mounts, unmounts, and re-mounts components in development. Two `useEffect` calls fire before cleanup of the first.
**How to avoid:** Always return a cleanup function from `useEffect`: `return () => { simulation.stop(); d3.select(svgRef.current).selectAll("*").remove(); }`. Clear the SVG at the top of each `useEffect` call before D3 draws.
**Warning signs:** Duplicated nodes or erratic physics in dev mode that disappears in production.

### Pitfall 4: Embedding Null on Existing Concept Rows
**What goes wrong:** `findSimilarConcepts` throws or returns wrong results for old concept rows that have `embedding = NULL`.
**Why it happens:** Concepts created before this phase have no embedding column data.
**How to avoid:** Add `WHERE embedding IS NOT NULL` to every vector similarity query. Write a backfill utility (or accept that pre-phase-3 concepts start unembedded and get embedded on next visit increment).
**Warning signs:** `null` distance values in query results; Drizzle casting errors.

### Pitfall 5: `visitCount` Not Incremented on Merge
**What goes wrong:** Node size doesn't grow when a duplicate concept is detected and merged into an existing node.
**Why it happens:** The dedup path updates `conceptId` but doesn't increment `visitCount` on the canonical node.
**How to avoid:** In the auto-merge branch: `UPDATE concepts SET visit_count = visit_count + 1 WHERE id = $canonicalId`. Treat every concept appearance (even merged) as a visit.
**Warning signs:** All nodes show radius 8 (visitCount = 0 implies initial insert only).

### Pitfall 6: Edge Deduplication
**What goes wrong:** Multiple questions touching the same two concepts create redundant `concept_edges` rows.
**Why it happens:** `onFinish` creates edges for every question without checking for existing edges between the same concept pair.
**How to avoid:** Use `INSERT ... ON CONFLICT DO NOTHING` with a unique constraint on `(sourceConceptId, targetConceptId, edgeType)`. Order source/target IDs consistently (e.g., `min(id), max(id)`) to prevent directional duplicates.
**Warning signs:** D3 renders multiple overlapping edges between two nodes.

### Pitfall 7: D3 Mutates Node/Link Objects
**What goes wrong:** D3 force simulation attaches `x`, `y`, `vx`, `vy`, `index` properties directly to the objects passed in. If those objects are the same references as React state, React's immutability expectations are violated.
**Why it happens:** D3's `forceSimulation(nodes)` mutates its input array's items in-place.
**How to avoid:** Deep-clone nodes and links before passing to D3: `d3.forceSimulation([...nodes.map(n => ({ ...n }))])`. Never pass the raw props directly to the simulation.
**Warning signs:** React state updates trigger infinite re-renders; ESLint rules-of-hooks violations.

---

## Code Examples

### Schema Migration: Enable pgvector Extension
```sql
-- Run before drizzle-kit push (in a migration or setup script)
CREATE EXTENSION IF NOT EXISTS vector;
```

### Drizzle Schema: concept_edges Table
```typescript
// packages/db/src/schema/questions.ts (addition)
import { pgEnum } from "drizzle-orm/pg-core";
import { unique } from "drizzle-orm/pg-core";

export const edgeTypeEnum = pgEnum("edge_type", [
  "curiosity_link",
  "bridge",
  "misconception_cluster",
]);

export const conceptEdges = pgTable("concept_edges", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceConceptId: text("source_concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "cascade" }),
  targetConceptId: text("target_concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "cascade" }),
  edgeType: edgeTypeEnum("edge_type").notNull().default("curiosity_link"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  // Prevents duplicate edges between same concept pair for same type
  unique().on(t.sourceConceptId, t.targetConceptId, t.edgeType),
]);
```

### Graph Data Server Action
```typescript
// apps/web/actions/graph.ts
"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { eq } from "drizzle-orm";

export interface GraphNode {
  id: string;
  name: string;
  domain: string;
  status: "unprobed" | "healthy" | "misconception";
  visitCount: number;
  isBridge: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  edgeType: string;
}

export async function getGraphData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const nodes = await db.query.concepts.findMany({
    where: eq(schema.concepts.userId, session.user.id),
    columns: { id: true, name: true, domain: true, status: true, visitCount: true },
  });

  const edges = await db.query.conceptEdges.findMany({
    where: /* filter to userId via join or subquery */,
    columns: { sourceConceptId: true, targetConceptId: true, edgeType: true },
  });

  return {
    nodes: nodes.map(n => ({ ...n, isBridge: false })), // bridge computed separately
    edges: edges.map(e => ({ source: e.sourceConceptId, target: e.targetConceptId, edgeType: e.edgeType })),
  };
}
```

### Disambiguation Prompt Pattern
```typescript
// packages/llm/src/prompts/disambiguate.ts
export function buildDisambiguatePrompt(
  newConcept: string,
  newDomain: string,
  candidates: Array<{ name: string; domain: string; distance: number }>
): string {
  const candidateList = candidates
    .map((c, i) => `${i + 1}. "${c.name}" (domain: ${c.domain}, similarity: ${(1 - c.distance).toFixed(2)}`)
    .join("\n");

  return `A student asked about "${newConcept}" in the domain of ${newDomain}.

Does this refer to the same underlying educational concept as any of these existing concepts?

${candidateList}

Consider that the same word can mean different things in different domains (e.g. "wave" in physics vs music should NOT merge). Same concept, slightly different phrasing SHOULD merge.

Respond with JSON: { "match": true/false, "matchIndex": 0 } where matchIndex is 0-based.`;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IVFFlat index (requires training data) | HNSW index (builds incrementally) | pgvector 0.5+ | HNSW preferred for dynamic datasets; no need to rebuild index on data changes |
| Raw SQL `<=>` for cosine distance | `cosineDistance()` in Drizzle ORM | Drizzle 0.31.0 | Type-safe, no SQL injection risk, IDE autocomplete |
| Calling OpenAI directly for embeddings | `embed()` via `@ai-sdk/openai` | AI SDK 3.x | Consistent error handling, retry logic, provider swappability |
| D3 class-based components | D3 with React hooks (useRef/useEffect) | React 16.8+ | Functional pattern; no class lifecycle mismatch |

**Deprecated/outdated:**
- IVFFlat index: still functional, but requires manual `VACUUM ANALYZE` to maintain accuracy as data changes. HNSW builds incrementally. For this project's scale, HNSW is correct.
- `d3.event` (D3 v5): removed in D3 v6+. Use the event parameter from callbacks directly: `(event, d) => { ... }`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL + pgvector | GRPH-01, GRPH-02 | ✓ | pgvector/pgvector:pg16 (Docker) | — |
| Node.js | All | ✓ | v24.13.0 | — |
| OPENAI_API_KEY env var | GRPH-01, GRPH-02 (embeddings) | Unknown — not verified in this session | — | None — must be set before embedding calls work |
| @ai-sdk/openai package | GRPH-02 | ✗ — not yet installed | — | Install: `pnpm add @ai-sdk/openai` in packages/llm |

**Missing dependencies with no fallback:**
- `OPENAI_API_KEY` env var: must exist in `.env.local` and Vercel env for embedding calls to succeed. No fallback at this time (Ollama embedding deferred to v2).
- `@ai-sdk/openai` package: must be added to `packages/llm`.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts exists in packages/llm) |
| Config file | `packages/llm/vitest.config.ts` (globals: true) |
| Quick run command | `cd packages/llm && pnpm test` |
| Full suite command | `pnpm turbo test` (runs all packages) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRPH-01 | `vector(1536)` column accepted by Drizzle schema | unit | `pnpm turbo build` (type check) | ❌ Wave 0 |
| GRPH-02 | `findSimilarConcepts()` returns candidates ordered by distance ASC | unit | `cd packages/db && pnpm test` | ❌ Wave 0 |
| GRPH-02 | Dedup logic: distance < 0.08 → merge, 0.08-0.15 → LLM, >0.15 → new | unit | `cd packages/llm && pnpm test` | ❌ Wave 0 |
| GRPH-02 | `generateEmbedding()` returns array of 1536 numbers | unit (mock) | `cd packages/llm && pnpm test` | ❌ Wave 0 |
| GRPH-03 | Edges inserted in `onFinish` for concepts from same question | unit | `cd packages/db && pnpm test` | ❌ Wave 0 |
| GRPH-04 | `KnowledgeGraph` component renders SVG with correct node count | unit | N/A — D3 DOM manipulation requires browser env | manual-only |
| GRPH-05 | Node radius formula: `Math.min(8 + visitCount * 2, 24)` | unit | `cd packages/db && pnpm test` | ❌ Wave 0 |
| GRPH-06 | Color map returns correct hex for each health state | unit | `cd apps/web && pnpm test` (if vitest added) | ❌ Wave 0 |
| GRPH-07 | Side panel renders concept questions on node click | manual | browser smoke test | manual-only |
| GRPH-08 | `computeBetweennessCentrality()` returns higher score for bridge node | unit | `cd apps/web && pnpm test` | ❌ Wave 0 |

**Manual-only justification:** D3 force simulation (GRPH-04) and side panel click interaction (GRPH-07) require a real browser DOM with SVG layout engine. These are verified via dev-server smoke test.

### Sampling Rate
- **Per task commit:** `pnpm turbo build` (type check across all packages)
- **Per wave merge:** `cd packages/llm && pnpm test` + `cd packages/db && pnpm test` (if db tests added)
- **Phase gate:** Full type check + test suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/db/src/__tests__/concepts.test.ts` — covers GRPH-01, GRPH-02, GRPH-03, GRPH-05
- [ ] `packages/llm/src/__tests__/embeddings.test.ts` — covers GRPH-02 (mock embed call returns array of 1536 numbers)
- [ ] `packages/db/vitest.config.ts` — no vitest config exists yet in packages/db
- [ ] `apps/web/src/__tests__/graph-utils.test.ts` — covers GRPH-06 (color map), GRPH-08 (betweenness centrality)
- [ ] `apps/web` vitest setup — no vitest configured in web app yet

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Session check in every server action via `auth()`; already established pattern |
| V3 Session Management | no | No new session logic |
| V4 Access Control | yes | `userId` from session only — never from request body; existing pattern in ask route must continue for graph endpoint |
| V5 Input Validation | yes | `concept.name` passed to OpenAI embed API; validate length (<500 chars) before embed call to avoid API errors |
| V6 Cryptography | no | No new crypto; embeddings are not sensitive data |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Graph data from another user's ID | Spoofing | Server action reads `userId` from `auth()` session — never from client params |
| Excessive embedding calls (DoS) | Denial of Service | Embed calls only in `onFinish` (rate limited by the 1-question/day limit); no separate embed endpoint |
| Concept name injection into LLM disambiguate prompt | Tampering | Escape/truncate concept name before inserting into prompt template; validate max length |
| OPENAI_API_KEY in client bundle | Information Disclosure | Key only accessed in server-side code (`packages/llm`); never imported in `"use client"` components |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@types/d3` is not yet installed in apps/web | Standard Stack | Minor — if already installed, one install step is redundant |
| A2 | `OPENAI_API_KEY` is not yet set in the dev environment | Environment Availability | Blocking — embedding calls fail silently at runtime without this env var |
| A3 | Betweenness centrality for <500 nodes per student is fast enough to run synchronously at login | Common Pitfalls / GRPH-08 | Low risk — at 500 nodes and edges, Brandes' algorithm completes in <5ms in JS |
| A4 | The existing `conceptQuestions` table provides sufficient join to retrieve "original questions for a node" (GRPH-07) | Architecture | Minor — join query needed; table already exists and has the right FK structure |
| A5 | apps/web does not yet have a vitest config | Validation Architecture | Minor — if vitest is present, Wave 0 gap for web tests is already addressed |

---

## Open Questions

1. **OPENAI_API_KEY availability**
   - What we know: The project uses `LLM_PROVIDER=anthropic`; the factory only supports Anthropic today.
   - What's unclear: Does the developer have an OpenAI API key, or should a fallback path exist?
   - Recommendation: The plan should include a Wave 0 task to add `OPENAI_API_KEY` to `.env.local` and confirm it works before embedding tasks start. If the key is unavailable, the whole dedup pipeline stalls.

2. **Bridge detection scheduling: cron vs on-demand**
   - What we know: CONTEXT.md marks this as Claude's discretion. The "surprise connection" is weekly (GRPH-08).
   - What's unclear: No cron infrastructure exists in this project; Vercel Cron would require a free tier limitation check.
   - Recommendation: Implement as on-demand computation at student login (throttled: compute once per day, persist result to DB). Simpler than a cron; sufficient for capstone demo scale.

3. **Backfill of existing concept embeddings**
   - What we know: Phase 2 created concept rows without embeddings. Those rows will have `embedding = NULL`.
   - What's unclear: Should the planner include a backfill task for existing concepts?
   - Recommendation: Skip backfill for now; add `WHERE embedding IS NOT NULL` guards to dedup queries. Existing concepts will get embeddings on their next visit increment (visitCount + 1 path).

4. **Edge direction for curiosity_link**
   - What we know: CONTEXT.md says "auto-create edges between concepts from the same question."
   - What's unclear: If a question produces concepts A, B, C — should we create A-B, A-C, B-C (all pairs) or a chain A-B-C?
   - Recommendation: All pairs (combinations, not permutations) with unique constraint ensuring A-B and B-A collapse to the same edge. For 3 concepts that's 3 edges; for 6 concepts it's 15. Cap at min(id), max(id) ordering.

---

## Sources

### Primary (HIGH confidence)
- Drizzle ORM pgvector docs — `vector()` column type, `cosineDistance()` function, HNSW index definition pattern [CITED: https://orm.drizzle.team/docs/guides/vector-similarity-search]
- AI SDK Core embeddings docs — `embed()` function signature, `openai.embedding()` model spec [CITED: https://ai-sdk.dev/docs/ai-sdk-core/embeddings]
- D3.js force simulation docs — simulation lifecycle, tick, stop, drag behavior [CITED: https://d3js.org/d3-force/simulation]
- pgvector GitHub — HNSW vs IVFFlat recommendation for dynamic datasets [CITED: https://github.com/pgvector/pgvector]
- Existing codebase — questions.ts schema, onFinish pipeline, package.json versions [VERIFIED: direct file reads]

### Secondary (MEDIUM confidence)
- pgvector HNSW vs IVFFlat comparison: HNSW recommended for <10k dynamic datasets [CITED: https://dev.to/philip_mcclarence_2ef9475/ivfflat-vs-hnsw-in-pgvector-which-index-should-you-use-305p]
- pgvector index bypass issue: `1 - cosineDistance` prevents index use [CITED: https://github.com/pgvector/pgvector/issues/760 + https://github.com/drizzle-team/drizzle-orm-docs/issues/436]
- D3.js + React hooks pattern: useRef + useEffect for simulation + cleanup [CITED: https://medium.com/@abdulmajeedamm33/elevating-network-visualizations-d3-force-next-js-2ce1a322d746]
- Betweenness centrality Brandes algorithm: O(V*E), ngraph.centrality as reference [CITED: https://github.com/anvaka/ngraph.centrality]

### Tertiary (LOW confidence)
- `@ai-sdk/openai` beta version 4.0.0-beta.25 noted but stable 3.0.52 recommended — npm registry query only

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified against npm registry and package.json
- Architecture Patterns: HIGH — Drizzle pgvector docs + AI SDK docs confirmed; D3 React hooks pattern is established community standard
- Pitfalls: HIGH — index bypass issue confirmed via pgvector issue tracker; D3 cleanup confirmed in official docs
- Betweenness centrality: MEDIUM — algorithm is well-established; JS implementation is hand-rolled (no external lib), untested in this codebase

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable libraries; D3 and Drizzle APIs are stable)
