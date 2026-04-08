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
    limit: 30,
  });
}

export async function getStreak(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  const rows = await db.query.questions.findMany({
    where: eq(schema.questions.userId, session.user.id),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 365,
  });

  if (rows.length === 0) return 0;

  // Deduplicate to unique UTC dates (one question per day max anyway, but be safe)
  const uniqueDates: Date[] = [];
  const seenDates = new Set<string>();
  for (const row of rows) {
    const d = new Date(row.createdAt!);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString();
    if (!seenDates.has(key)) {
      seenDates.add(key);
      uniqueDates.push(d);
    }
  }

  // Start from today; if today has no question, allow starting from yesterday
  // (streak doesn't break until the day passes without a question)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86_400_000);

  const mostRecentDate = uniqueDates[0];
  if (
    mostRecentDate.getTime() !== today.getTime() &&
    mostRecentDate.getTime() !== yesterday.getTime()
  ) {
    return 0;
  }

  // Count consecutive days backward from the most recent question date
  let streak = 0;
  let checkDate = new Date(mostRecentDate);
  for (const date of uniqueDates) {
    if (date.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
