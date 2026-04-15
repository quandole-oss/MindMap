/**
 * Edge pair generation for the knowledge graph.
 *
 * Extracts the pure combinatorial logic used by `createConceptEdges`
 * (in packages/db/src/queries/concepts.ts) so it can be unit-tested
 * without a database connection.
 */

export interface EdgePair {
  sourceConceptId: string;
  targetConceptId: string;
  edgeType: string;
}

/**
 * Generate unique edge pairs from a list of concept IDs.
 *
 * Pairs are ordered lexicographically (source < target) so that
 * A->B and B->A always produce the same row, matching the DB
 * unique constraint on (sourceConceptId, targetConceptId, edgeType).
 *
 * @param conceptIds - Array of concept UUIDs from a single question
 * @param edgeType   - Edge classification (default: "curiosity_link")
 * @returns All unique pairs with lexicographic source < target ordering
 */
export function generateEdgePairs(
  conceptIds: string[],
  edgeType: string = "curiosity_link"
): EdgePair[] {
  const pairs: EdgePair[] = [];

  for (let i = 0; i < conceptIds.length; i++) {
    for (let j = i + 1; j < conceptIds.length; j++) {
      const [source, target] =
        conceptIds[i] < conceptIds[j]
          ? [conceptIds[i], conceptIds[j]]
          : [conceptIds[j], conceptIds[i]];

      pairs.push({ sourceConceptId: source, targetConceptId: target, edgeType });
    }
  }

  return pairs;
}
