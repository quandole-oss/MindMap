import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    aiResponse: text("ai_response"),
    routingMode: text("routing_mode", { enum: ["enrich", "diagnose"] }),
    routingMisconceptionId: text("routing_misconception_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("questions_user_created_idx").on(t.userId, t.createdAt),
  ]
);

export const concepts = pgTable(
  "concepts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    status: text("status", {
      enum: ["unprobed", "healthy", "misconception"],
    })
      .notNull()
      .default("unprobed"),
    // nullable so existing rows remain valid after migration
    embedding: vector("embedding", { dimensions: 1536 }),
    // tracks how many times this concept appeared across questions
    visitCount: integer("visit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    // HNSW index for cosine similarity — ORDER BY cosineDistance ASC to use this index
    index("concepts_embedding_hnsw_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const edgeTypeEnum = pgEnum("edge_type", [
  "curiosity_link",
  "bridge",
  "misconception_cluster",
]);

export const conceptEdges = pgTable(
  "concept_edges",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sourceConceptId: text("source_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    targetConceptId: text("target_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    edgeType: edgeTypeEnum("edge_type").notNull().default("curiosity_link"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    // prevent duplicate edges (GRPH-03 / T-03-03 mitigation)
    unique().on(t.sourceConceptId, t.targetConceptId, t.edgeType),
  ]
);

export const conceptQuestions = pgTable("concept_questions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conceptId: text("concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
});
