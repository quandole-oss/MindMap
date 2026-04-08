import { pgTable, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const classes = pgTable("classes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gradeLevel: integer("grade_level").notNull(), // 0=K, 1-12
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const classEnrollments = pgTable("class_enrollments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  classId: text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gradeLevel: integer("grade_level").notNull(), // inherited from class, can be overridden
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // COPPA TTL (INFR-06)
}, (t) => [
  unique().on(t.classId, t.studentId),
]);
