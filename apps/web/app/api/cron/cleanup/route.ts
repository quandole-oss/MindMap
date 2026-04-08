import { deleteExpiredUsers } from "@mindmap/db";

/**
 * COPPA TTL cleanup endpoint (PRIV-03).
 * Protected by CRON_SECRET bearer token.
 * Callable by:
 *   - Vercel Cron (set up in vercel.json crons)
 *   - System cron on Docker host: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/cleanup
 *
 * Security (T-06-07): Returns 401 on invalid/missing token, 503 when CRON_SECRET is not configured.
 * Safety (T-06-10): WHERE clause requires expiresAt IS NOT NULL AND expiresAt <= now.
 *   Teacher accounts have null expiresAt and are never deleted.
 */
export async function GET(req: Request) {
  // Verify bearer token
  const authHeader = req.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.warn("[cleanup] CRON_SECRET not set — cleanup endpoint disabled");
    return new Response(JSON.stringify({ error: "Cleanup not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const deletedCount = await deleteExpiredUsers();
    console.log(`[cleanup] Deleted ${deletedCount} expired user(s)`);
    return new Response(
      JSON.stringify({ ok: true, deletedCount }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[cleanup] Failed:", err);
    return new Response(JSON.stringify({ error: "Cleanup failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
