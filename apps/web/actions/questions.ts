"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { calculateStreak } from "@/lib/streak";

export async function hasAskedToday(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfDay.getTime() + 86_400_000);
  const existing = await db.query.questions.findFirst({
    where: and(
      eq(schema.questions.userId, session.user.id),
      gte(schema.questions.createdAt, startOfDay),
      lt(schema.questions.createdAt, startOfTomorrow),
    ),
  });
  return !!existing;
}

export async function getTodayQuestion() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfDay.getTime() + 86_400_000);
  return db.query.questions.findFirst({
    where: and(
      eq(schema.questions.userId, session.user.id),
      gte(schema.questions.createdAt, startOfDay),
      lt(schema.questions.createdAt, startOfTomorrow),
    ),
  });
}

export async function getStudentGradeLevel(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 6;
  const enrollment = await db.query.classEnrollments.findFirst({
    where: eq(schema.classEnrollments.studentId, session.user.id),
    orderBy: (t, { desc }) => [desc(t.enrolledAt)],
  });
  return enrollment?.gradeLevel ?? 6;
}

export async function getQuestionHistory() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db.query.questions.findMany({
    where: eq(schema.questions.userId, session.user.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 30,
  });
}

export async function getTodayQuestionConcepts(): Promise<
  Array<{ id: string; name: string }>
> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfDay.getTime() + 86_400_000);
  const question = await db.query.questions.findFirst({
    where: and(
      eq(schema.questions.userId, session.user.id),
      gte(schema.questions.createdAt, startOfDay),
      lt(schema.questions.createdAt, startOfTomorrow),
    ),
  });
  if (!question) return [];
  const links = await db.query.conceptQuestions.findMany({
    where: eq(schema.conceptQuestions.questionId, question.id),
  });
  if (links.length === 0) return [];
  const concepts = await db.query.concepts.findMany({
    where: and(
      inArray(schema.concepts.id, links.map((l) => l.conceptId)),
      eq(schema.concepts.userId, session.user.id),
    ),
    columns: { id: true, name: true },
  });
  return concepts;
}

export async function getStreak(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  const rows = await db.query.questions.findMany({
    where: eq(schema.questions.userId, session.user.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 365,
  });

  const dates = rows.map((r) => r.createdAt!);
  return calculateStreak(dates);
}
