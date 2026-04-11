/**
 * Pure helpers for the theme_lesson_plans cache key (Plan 08-04 / LSPL-02 / D-17).
 *
 * These functions are deliberately free of "use server", DB, and auth imports
 * so they can be unit-tested under Vitest's Node runtime (matching the existing
 * test-isolation pattern in apps/web/lib/theme-aggregation.ts).
 *
 * Critical constraints enforced here (08-RESEARCH.md §C7):
 *
 * 1. Web Crypto only. Uses `crypto.subtle.digest("SHA-256", ...)` — never
 *    `node:crypto`. Both Node 20+ and Edge runtimes expose the Web Crypto
 *    API on the global `crypto` object, so a single codepath works in dev,
 *    Vercel Edge, and Docker Compose / Node server runtimes.
 *
 * 2. Canonical ordering before hashing. The misconception tuples are sorted
 *    by `misconceptionId.localeCompare` BEFORE JSON serialization so that
 *    cache lookups are order-independent — the same class + theme producing
 *    the same fingerprint always maps to the same hash regardless of the
 *    order the SQL query returned rows.
 *
 * 3. Input is not mutated. `computeDataHash` spreads `tuples` into a fresh
 *    array before sorting — a defensive copy so callers are free to reuse
 *    their tuple arrays without surprise side-effects.
 *
 * See Pitfall 4 in 08-RESEARCH.md for the "forgot to sort before JSON.stringify"
 * footgun that this module guards against.
 */

/**
 * SHA-256 hex digest via Web Crypto. Deterministic — same input, same output.
 * 64-character lowercase hex string.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes the stable cache key for a (classId, themeId) tuple from the
 * current set of per-misconception counts. Sorts the input by misconceptionId
 * before hashing so two callers passing the same data in different orders
 * both produce the same hash.
 *
 * The tuples shape mirrors the output of getThemeFingerprint in themes.ts —
 * one row per constituent misconception of the theme, with the authoritative
 * server-side student and unresolved counts.
 */
export async function computeDataHash(
  tuples: Array<{
    misconceptionId: string;
    studentCount: number;
    unresolvedCount: number;
  }>
): Promise<string> {
  // Defensive copy — do not mutate caller's array.
  const sorted = [...tuples].sort((a, b) =>
    a.misconceptionId.localeCompare(b.misconceptionId)
  );
  // Canonical form: array of [id, studentCount, unresolvedCount] triples.
  // Avoid object key ordering ambiguity across runtimes by using positional
  // arrays rather than object literals.
  const canonical = JSON.stringify(
    sorted.map((t) => [t.misconceptionId, t.studentCount, t.unresolvedCount])
  );
  return sha256Hex(canonical);
}
