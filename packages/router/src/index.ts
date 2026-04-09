import { getMisconceptionsByDomainAndBand } from "@mindmap/misconceptions";
import { gradeLevelToGradeBand } from "./utils";

export type RoutingDecision =
  | { mode: "enrich" }
  | { mode: "diagnose"; misconceptionId: string; probability: number };

/**
 * Determines whether to enrich or diagnose a student's concept.
 *
 * String matching: lowercases both the concept name and misconception entry name,
 * then checks if one contains the other.
 *
 * @param conceptName - The concept extracted from the student's question
 * @param gradeLevel  - The student's numeric grade level (0-12)
 * @param domain      - The subject domain (e.g. "physics", "biology")
 * @returns RoutingDecision — enrich if no match, diagnose with misconceptionId if matched
 */
export function routeQuestion(
  conceptName: string,
  gradeLevel: number,
  domain: string
): RoutingDecision {
  const gradeBand = gradeLevelToGradeBand(gradeLevel);
  const misconceptions = getMisconceptionsByDomainAndBand(domain, gradeBand);

  const normalizedConcept = conceptName.toLowerCase().trim();

  for (const entry of misconceptions) {
    const normalizedEntry = entry.name.toLowerCase().trim();

    // Only match if the concept name contains the full misconception phrase,
    // OR the misconception name contains the concept AND the concept is multi-word
    // (single-word concepts like "gravity" should not match longer phrases).
    const conceptWordCount = normalizedConcept.split(/\s+/).length;
    const isMultiWord = conceptWordCount > 1;

    const matches =
      normalizedConcept.includes(normalizedEntry) ||
      (isMultiWord && normalizedEntry.includes(normalizedConcept));

    if (matches) {
      return {
        mode: "diagnose",
        misconceptionId: entry.id,
        probability: 0.8,
      };
    }
  }

  return { mode: "enrich" };
}

export { gradeLevelToGradeBand } from "./utils";
export { semanticFallback } from "./semantic-fallback";
export type { SemanticMatch } from "./semantic-fallback";
