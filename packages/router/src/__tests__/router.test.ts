import { describe, it, expect, beforeEach } from "vitest";
import { routeQuestion, RoutingDecision } from "../index";
import { gradeLevelToGradeBand } from "../utils";

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
