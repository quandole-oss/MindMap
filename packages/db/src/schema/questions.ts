import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
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

export const concepts = pgTable("concepts", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const conceptQuestions = pgTable("concept_questions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conceptId: text("concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
});
