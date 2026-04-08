import { cosineDistance, sql, and, eq, isNotNull } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";

/**
 * Find existing concepts for a user that are semantically similar to the given embedding.
 *
 * Uses pgvector HNSW cosine distance index. CRITICAL: ORDER BY cosineDistance ASC
 * (not DESC or by 1-distance) to ensure the HNSW index is used.
 *
 * @param userId - The user whose concepts to search
 * @param queryEmbedding - The 1536-dim embedding of the new concept name
 * @param threshold - Cosine similarity threshold (default 0.85); converted to distance internally
 * @param limit - Max candidates to return (default 5)
 * @returns Array of { id, name, domain, distance } sorted by distance ascending (most similar first)
 */
export async function findSimilarConcepts(
  userId: string,
  queryEmbedding: number[],
  threshold: number = 0.85,
  limit: number = 5
): Promise<Array<{ id: string; name: string; domain: string; distance: number }>> {
  // CRITICAL: similarity 0.85 = distance 0.15. Must use distance for WHERE clause.
  const distanceThreshold = 1 - threshold;

  const rows = await db
    .select({
      id: schema.concepts.id,
      name: schema.concepts.name,
      domain: schema.concepts.domain,
      // Use cosineDistance directly as the distance value
      distance: cosineDistance(schema.concepts.embedding, queryEmbedding),
    })
    .from(schema.concepts)
    .where(
      and(
        eq(schema.concepts.userId, userId),
        // Skip pre-phase-3 concepts that have no embedding yet (pitfall 4)
        isNotNull(schema.concepts.embedding),
        // Filter by distance threshold using raw SQL (WHERE must reference the expression)
        sql`${cosineDistance(schema.concepts.embedding, queryEmbedding)} < ${distanceThreshold}`
      )
    )
    // CRITICAL: ORDER BY cosineDistance ASC to use HNSW index (pitfall 1)
    .orderBy(cosineDistance(schema.concepts.embedding, queryEmbedding))
    .limit(limit);

  return rows as Array<{ id: string; name: string; domain: string; distance: number }>;
}

/**
 * Create curiosity_link edges between all unique pairs of concept IDs from the same question.
 *
 * - Generates all unique (i < j) pairs to avoid duplicates
 * - Orders source/target as (min, max) by string comparison so A->B and B->A produce the same row
 * - Uses ON CONFLICT DO NOTHING to silently skip duplicate edges (schema has unique constraint)
 *
 * @param conceptIds - The resolved concept IDs from a single question
 * @param edgeType - Edge type (default: "curiosity_link")
 */
export async function createConceptEdges(
  conceptIds: string[],
  edgeType: "curiosity_link" | "bridge" | "misconception_cluster" = "curiosity_link"
): Promise<void> {
  if (conceptIds.length < 2) {
    // No pairs possible with fewer than 2 concepts
    return;
  }

  for (let i = 0; i < conceptIds.length; i++) {
    for (let j = i + 1; j < conceptIds.length; j++) {
      // Order source/target lexicographically so A-B and B-A map to the same row
      // This ensures the unique constraint (sourceConceptId, targetConceptId, edgeType) works correctly
      const sourceConceptId =
        conceptIds[i] < conceptIds[j] ? conceptIds[i] : conceptIds[j];
      const targetConceptId =
        conceptIds[i] < conceptIds[j] ? conceptIds[j] : conceptIds[i];

      await db
        .insert(schema.conceptEdges)
        .values({ sourceConceptId, targetConceptId, edgeType })
        .onConflictDoNothing();
    }
  }
}
