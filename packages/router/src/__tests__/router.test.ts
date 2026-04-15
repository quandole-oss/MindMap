import { describe, it, expect, beforeEach } from "vitest";
import { routeQuestion, RoutingDecision } from "../index";
import { gradeLevelToGradeBand } from "../utils";
import { semanticFallback } from "../semantic-fallback";

describe("gradeLevelToGradeBand", () => {
  it("maps grade 0 (Kindergarten) to 'K-5'", () => {
    expect(gradeLevelToGradeBand(0)).toBe("K-5");
  });

  it("maps grade 1 to 'K-5'", () => {
    expect(gradeLevelToGradeBand(1)).toBe("K-5");
  });

  it("maps grade 5 to 'K-5'", () => {
    expect(gradeLevelToGradeBand(5)).toBe("K-5");
  });

  it("maps grade 6 to '6-8'", () => {
    expect(gradeLevelToGradeBand(6)).toBe("6-8");
  });

  it("maps grade 7 to '6-8'", () => {
    expect(gradeLevelToGradeBand(7)).toBe("6-8");
  });

  it("maps grade 8 to '6-8'", () => {
    expect(gradeLevelToGradeBand(8)).toBe("6-8");
  });

  it("maps grade 9 to '9-12'", () => {
    expect(gradeLevelToGradeBand(9)).toBe("9-12");
  });

  it("maps grade 10 to '9-12'", () => {
    expect(gradeLevelToGradeBand(10)).toBe("9-12");
  });

  it("maps grade 12 to '9-12'", () => {
    expect(gradeLevelToGradeBand(12)).toBe("9-12");
  });
});

describe("routeQuestion", () => {
  it("returns 'enrich' for a concept with no misconception match", () => {
    // "gravity" as a concept name (not a misconception phrase) should not match
    const result = routeQuestion("gravity", 5, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("returns 'diagnose' for a concept matching a known misconception", () => {
    // "Heavier objects fall faster" is a known physics misconception for K-5
    const result = routeQuestion("heavier objects fall faster", 5, "physics");
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(typeof result.misconceptionId).toBe("string");
      expect(result.misconceptionId.length).toBeGreaterThan(0);
      expect(typeof result.probability).toBe("number");
      expect(result.probability).toBeGreaterThan(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    }
  });

  it("returns misconceptionId matching the library entry", () => {
    const result = routeQuestion("heavier objects fall faster", 5, "physics");
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-001");
    }
  });

  it("matching is case-insensitive", () => {
    const lower = routeQuestion("heavier objects fall faster", 5, "physics");
    const upper = routeQuestion("HEAVIER OBJECTS FALL FASTER", 5, "physics");
    const mixed = routeQuestion("Heavier Objects Fall Faster", 5, "physics");
    expect(lower.mode).toBe("diagnose");
    expect(upper.mode).toBe("diagnose");
    expect(mixed.mode).toBe("diagnose");
  });

  it("returns 'enrich' for a concept in a different domain with no match", () => {
    // 'quantum entanglement' has no misconception in the library for grade 10
    const result = routeQuestion("quantum entanglement", 10, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("returns 'enrich' when domain does not match", () => {
    // "heavier objects fall faster" is a physics misconception — if we look in biology, no match
    const result = routeQuestion("heavier objects fall faster", 5, "biology");
    expect(result.mode).toBe("enrich");
  });

  it("returns a RoutingDecision object in all cases", () => {
    const result = routeQuestion("any concept", 7, "math");
    expect(result).toHaveProperty("mode");
    expect(["enrich", "diagnose"]).toContain(result.mode);
  });
});

describe("gradeLevelToGradeBand - edge cases", () => {
  it("maps negative grade to 'K-5' (clamped to lowest band)", () => {
    expect(gradeLevelToGradeBand(-1)).toBe("K-5");
    expect(gradeLevelToGradeBand(-100)).toBe("K-5");
  });

  it("maps grade 2 to 'K-5' (mid-band)", () => {
    expect(gradeLevelToGradeBand(2)).toBe("K-5");
  });

  it("maps grade 3 to 'K-5'", () => {
    expect(gradeLevelToGradeBand(3)).toBe("K-5");
  });

  it("maps grade 4 to 'K-5'", () => {
    expect(gradeLevelToGradeBand(4)).toBe("K-5");
  });

  it("maps grade 11 to '9-12'", () => {
    expect(gradeLevelToGradeBand(11)).toBe("9-12");
  });

  it("maps grade 13 to '9-12' (above max, falls into highest band)", () => {
    expect(gradeLevelToGradeBand(13)).toBe("9-12");
  });

  it("maps grade 99 to '9-12' (far above max)", () => {
    expect(gradeLevelToGradeBand(99)).toBe("9-12");
  });
});

describe("routeQuestion - single-word vs multi-word matching", () => {
  it("does not match a single-word concept against a multi-word misconception name", () => {
    // "gravity" is a single word; "Heavier objects fall faster" is multi-word
    // The router should NOT match single-word concepts against longer phrases
    // to avoid false positives
    const result = routeQuestion("gravity", 5, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("does not match a different single-word concept against misconceptions", () => {
    // "temperature" alone should not match "Heat and temperature are the same thing"
    const result = routeQuestion("temperature", 7, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("matches when the concept fully contains the misconception name", () => {
    // Concept contains the entire misconception phrase
    const result = routeQuestion(
      "I think heavier objects fall faster than lighter ones",
      5,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
  });

  it("matches when a multi-word concept is a substring of the misconception name", () => {
    // "objects fall faster" is multi-word and is contained in "Heavier objects fall faster"
    const result = routeQuestion("objects fall faster", 5, "physics");
    expect(result.mode).toBe("diagnose");
  });

  it("does not match two-word concept that is not a substring of any misconception", () => {
    const result = routeQuestion("fast gravity", 5, "physics");
    expect(result.mode).toBe("enrich");
  });
});

describe("routeQuestion - whitespace handling", () => {
  it("trims leading and trailing whitespace from concept", () => {
    const result = routeQuestion(
      "  heavier objects fall faster  ",
      5,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
  });

  it("returns 'enrich' for empty string concept", () => {
    const result = routeQuestion("", 5, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("returns 'enrich' for whitespace-only concept", () => {
    const result = routeQuestion("   ", 5, "physics");
    expect(result.mode).toBe("enrich");
  });
});

describe("routeQuestion - domain filtering", () => {
  it("matches biology misconception in biology domain", () => {
    // bio-001: "Plants get their food from the soil" is K-5 biology
    const result = routeQuestion(
      "plants get their food from the soil",
      3,
      "biology"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("bio-001");
    }
  });

  it("does not match biology misconception when domain is physics", () => {
    const result = routeQuestion(
      "plants get their food from the soil",
      3,
      "physics"
    );
    expect(result.mode).toBe("enrich");
  });

  it("matches math misconception in math domain", () => {
    // math-001: "Multiplication always makes numbers bigger" is K-5 math
    const result = routeQuestion(
      "multiplication always makes numbers bigger",
      4,
      "math"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("math-001");
    }
  });

  it("does not match math misconception when domain is biology", () => {
    const result = routeQuestion(
      "multiplication always makes numbers bigger",
      4,
      "biology"
    );
    expect(result.mode).toBe("enrich");
  });

  it("matches history misconception in history domain", () => {
    // hist-001: "Columbus proved the Earth was round" is 6-8 history
    const result = routeQuestion(
      "Columbus proved the Earth was round",
      7,
      "history"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("hist-001");
    }
  });

  it("returns 'enrich' for a nonexistent domain", () => {
    const result = routeQuestion(
      "heavier objects fall faster",
      5,
      "astrology"
    );
    expect(result.mode).toBe("enrich");
  });

  it("domain matching is exact (case-sensitive domain)", () => {
    // The library stores domain as lowercase "physics"
    // Passing "Physics" should not match because domain filtering is exact
    const result = routeQuestion(
      "heavier objects fall faster",
      5,
      "Physics"
    );
    expect(result.mode).toBe("enrich");
  });
});

describe("routeQuestion - grade band filtering", () => {
  it("does not match a K-5 misconception when grade is in 6-8 band", () => {
    // phys-001 is K-5 only; grade 7 is in 6-8 band
    const result = routeQuestion("heavier objects fall faster", 7, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("does not match a 6-8 misconception when grade is in K-5 band", () => {
    // phys-002: "An object at rest has no forces acting on it" is 6-8
    const result = routeQuestion(
      "an object at rest has no forces acting on it",
      4,
      "physics"
    );
    expect(result.mode).toBe("enrich");
  });

  it("matches a 6-8 misconception at grade 6 boundary", () => {
    const result = routeQuestion(
      "an object at rest has no forces acting on it",
      6,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-002");
    }
  });

  it("matches a 6-8 misconception at grade 8 boundary", () => {
    const result = routeQuestion(
      "an object at rest has no forces acting on it",
      8,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-002");
    }
  });

  it("does not match a 6-8 misconception at grade 9 (9-12 band)", () => {
    const result = routeQuestion(
      "an object at rest has no forces acting on it",
      9,
      "physics"
    );
    expect(result.mode).toBe("enrich");
  });

  it("matches a 9-12 misconception at grade 9", () => {
    // phys-012: "Energy is a substance or fluid that flows" is 9-12 physics
    const result = routeQuestion(
      "energy is a substance or fluid that flows",
      9,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-012");
    }
  });

  it("matches a 9-12 misconception at grade 12", () => {
    const result = routeQuestion(
      "energy is a substance or fluid that flows",
      12,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-012");
    }
  });
});

describe("routeQuestion - first-match behavior with multiple candidates", () => {
  it("returns the first matching misconception when multiple share the same domain and band", () => {
    // In physics 6-8, there are multiple entries (phys-002 through phys-010)
    // A concept matching phys-002 should return phys-002 specifically
    const result = routeQuestion(
      "an object at rest has no forces acting on it",
      7,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-002");
    }
  });

  it("matches the correct entry among many in the same band", () => {
    // phys-003: "Heat and temperature are the same thing" is also 6-8 physics
    const result = routeQuestion(
      "heat and temperature are the same thing",
      7,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-003");
    }
  });

  it("matches a later entry in the list correctly", () => {
    // phys-010: "Light travels instantaneously" is 6-8 physics
    const result = routeQuestion(
      "light travels instantaneously",
      7,
      "physics"
    );
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.misconceptionId).toBe("phys-010");
    }
  });
});

describe("routeQuestion - probability value", () => {
  it("returns probability of 0.8 for string matches", () => {
    const result = routeQuestion("heavier objects fall faster", 5, "physics");
    expect(result.mode).toBe("diagnose");
    if (result.mode === "diagnose") {
      expect(result.probability).toBe(0.8);
    }
  });

  it("returns consistent probability across different misconceptions", () => {
    const phys = routeQuestion("heavier objects fall faster", 5, "physics");
    const bio = routeQuestion(
      "plants get their food from the soil",
      3,
      "biology"
    );
    const math = routeQuestion(
      "multiplication always makes numbers bigger",
      4,
      "math"
    );

    // All string matches should return the same fixed probability
    if (phys.mode === "diagnose" && bio.mode === "diagnose" && math.mode === "diagnose") {
      expect(phys.probability).toBe(bio.probability);
      expect(bio.probability).toBe(math.probability);
    } else {
      // Force test to fail if any didn't match
      expect(phys.mode).toBe("diagnose");
      expect(bio.mode).toBe("diagnose");
      expect(math.mode).toBe("diagnose");
    }
  });
});

describe("routeQuestion - enrich mode confirmation", () => {
  it("returns 'enrich' for a novel concept with no misconception association", () => {
    const result = routeQuestion("photosynthesis", 5, "biology");
    expect(result.mode).toBe("enrich");
  });

  it("returns 'enrich' for a valid but unmatched multi-word concept", () => {
    const result = routeQuestion("how do rockets work", 7, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("returns 'enrich' for a concept in a domain with no misconceptions for that band", () => {
    // history has no K-5 entries except hist-006
    // "quantum computing" has no match in any domain
    const result = routeQuestion("quantum computing", 3, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("enrich result has no misconceptionId or probability properties", () => {
    const result = routeQuestion("dinosaurs", 5, "biology");
    expect(result.mode).toBe("enrich");
    expect(result).not.toHaveProperty("misconceptionId");
    expect(result).not.toHaveProperty("probability");
  });
});

describe("routeQuestion - special characters in concept names", () => {
  it("handles apostrophes in concept names gracefully", () => {
    const result = routeQuestion("earth's gravity", 5, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("handles hyphens in concept names gracefully", () => {
    const result = routeQuestion("anti-gravity", 5, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("handles unicode characters without crashing", () => {
    const result = routeQuestion("force = mass \u00D7 acceleration", 7, "physics");
    expect(result.mode).toBe("enrich");
  });

  it("handles numeric characters in concept names", () => {
    const result = routeQuestion("Newton's 3rd law", 7, "physics");
    expect(result.mode).toBe("enrich");
  });
});

describe("semanticFallback", () => {
  it("returns empty array for empty unmatched list without making an LLM call", async () => {
    // No model needed when unmatched is empty — early return before any LLM call
    const result = await semanticFallback([], 5, {} as any);
    expect(result).toEqual([]);
  });
});
