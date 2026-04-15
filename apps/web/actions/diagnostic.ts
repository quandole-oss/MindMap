"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { and, eq, isNull, desc, gte, lt } from "drizzle-orm";

/**
 * Returns the most recent incomplete (outcome IS NULL) diagnostic session for the current user.
 * If conceptId is provided, filters to sessions for that specific concept.
 *
 * T-04-01 mitigation: userId is always taken from the server session — never from the client.
 */
export async function getActiveSession(conceptId?: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  return db.query.diagnosticSessions.findFirst({
    where: conceptId
      ? and(
          eq(schema.diagnosticSessions.userId, userId),
          eq(schema.diagnosticSessions.conceptId, conceptId),
          isNull(schema.diagnosticSessions.outcome)
        )
      : and(
          eq(schema.diagnosticSessions.userId, userId),
          isNull(schema.diagnosticSessions.outcome)
        ),
    orderBy: [desc(schema.diagnosticSessions.createdAt)],
  });
}

/**
 * Returns a specific diagnostic session by ID, verified against the current user's ID.
 *
 * T-04-01 mitigation: Ownership check — only returns session if it belongs to the authenticated user.
 * This prevents cross-user session access (ASVS V4 access control).
 */
export async function getSessionById(sessionId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  return db.query.diagnosticSessions.findFirst({
    where: and(
      eq(schema.diagnosticSessions.id, sessionId),
      eq(schema.diagnosticSessions.userId, userId)
    ),
  });
}

/**
 * Returns the diagnostic session linked to today's question, if one exists.
 * Scoped to the current day (UTC) for precision.
 */
export async function getTodayDiagnosticSession() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfDay.getTime() + 86_400_000);

  // Find today's question first
  const todayQuestion = await db.query.questions.findFirst({
    where: and(
      eq(schema.questions.userId, userId),
      gte(schema.questions.createdAt, startOfDay),
      lt(schema.questions.createdAt, startOfTomorrow),
    ),
  });

  if (!todayQuestion) return null;

  return db.query.diagnosticSessions.findFirst({
    where: and(
      eq(schema.diagnosticSessions.userId, userId),
      eq(schema.diagnosticSessions.questionId, todayQuestion.id),
    ),
  });
}

/**
 * Returns all diagnostic sessions for the current user, ordered by most recent first.
 * Limited to 20 for history display.
 *
 * T-04-01 mitigation: userId from session only — no client-supplied filtering.
 */
export async function getSessionsForUser() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  return db.query.diagnosticSessions.findMany({
    where: eq(schema.diagnosticSessions.userId, userId),
    orderBy: [desc(schema.diagnosticSessions.createdAt)],
    limit: 20,
  });
}
