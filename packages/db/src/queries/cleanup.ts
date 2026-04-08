import { db, schema } from "../index";
import { lte, and, isNotNull } from "drizzle-orm";

/**
 * Delete all users whose expires_at timestamp has passed.
 * Because all child tables (questions, concepts, classEnrollments, diagnosticSessions)
 * have onDelete: "cascade" on the userId FK, a single DELETE FROM users cascades
 * to remove all associated student data.
 *
 * Note: Only deletes users where expiresAt IS NOT NULL AND expiresAt <= now.
 * Teacher accounts (which never have expiresAt set) are never deleted.
 *
 * Returns the count of deleted users.
 *
 * PRIV-03: This is the COPPA TTL enforcement function. It is called by the
 * /api/cron/cleanup endpoint which requires CRON_SECRET bearer token authorization.
 */
export async function deleteExpiredUsers(): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(schema.users)
    .where(
      and(
        isNotNull(schema.users.expiresAt),
        lte(schema.users.expiresAt, now)
      )
    )
    .returning({ id: schema.users.id });
  return result.length;
}
