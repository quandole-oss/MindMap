"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { and, eq, gte, lt, desc } from "drizzle-orm";

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
  });
}

export async function getStreak(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  const questions = await db.query.questions.findMany({
    where: eq(schema.questions.userId, session.user.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  if (questions.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let checkDate = new Date(today);

  for (const question of questions) {
    const questionDate = new Date(question.createdAt!);
    questionDate.setUTCHours(0, 0, 0, 0);

    if (questionDate.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else if (questionDate.getTime() < checkDate.getTime()) {
      break;
    }
  }

  return streak;
}
