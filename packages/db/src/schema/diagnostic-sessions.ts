import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { concepts, questions } from "./questions";

export const diagnosticStageEnum = pgEnum("diagnostic_stage", [
  "probe",
  "classify",
  "confront",
  "resolve",
]);

export const diagnosticOutcomeEnum = pgEnum("diagnostic_outcome", [
  "resolved",
  "unresolved",
  "incomplete",
]);

export const diagnosticSessions = pgTable(
  "diagnostic_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    // nullable: links to the original question that triggered diagnosis
    questionId: text("question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    // library ID e.g. "phys-001"
    misconceptionId: text("misconception_id").notNull(),
    // human-readable e.g. "Heavier objects fall faster"
    misconceptionName: text("misconception_name").notNull(),
    stage: diagnosticStageEnum("stage").notNull().default("probe"),
    // null until resolve stage completes
    outcome: diagnosticOutcomeEnum("outcome"),
    // Pitfall 6 workaround: use $defaultFn instead of .default([]) to avoid jsonb array default bug
    messages: jsonb("messages")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .$type<any[]>()
      .notNull()
      .$defaultFn(() => []),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    // efficient session lookups by user ordered by time
    index("diagnostic_sessions_user_created_idx").on(t.userId, t.createdAt),
  ]
);
