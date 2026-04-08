import { describe, it, expect, beforeEach } from "vitest";
import { loadLibrary, getMisconceptionsByDomainAndBand, resetLibraryCache } from "../loader";

describe("misconception library", () => {
  beforeEach(() => {
    resetLibraryCache();
  });

  it("loads without schema errors", () => {
    expect(() => loadLibrary()).not.toThrow();
  });

  it("has at least 35 entries (MISC-01)", () => {
    const library = loadLibrary();
    expect(library.length).toBeGreaterThanOrEqual(35);
  });

  it("covers all 4 required domains (MISC-01)", () => {
    const library = loadLibrary();
    const domains = new Set(library.map((e) => e.domain));
    expect(domains).toEqual(new Set(["physics", "biology", "math", "history"]));
  });

  it("physics has 10+ entries", () => {
    const library = loadLibrary();
    const physics = library.filter((e) => e.domain === "physics");
    expect(physics.length).toBeGreaterThanOrEqual(10);
  });

  it("biology has 8+ entries", () => {
    const library = loadLibrary();
    const bio = library.filter((e) => e.domain === "biology");
    expect(bio.length).toBeGreaterThanOrEqual(8);
  });

  it("math has 8+ entries", () => {
    const library = loadLibrary();
    const math = library.filter((e) => e.domain === "math");
    expect(math.length).toBeGreaterThanOrEqual(8);
  });

  it("history has 6+ entries", () => {
    const library = loadLibrary();
    const history = library.filter((e) => e.domain === "history");
    expect(history.length).toBeGreaterThanOrEqual(6);
  });

  it("every entry has at least one probe question (MISC-02)", () => {
    const library = loadLibrary();
    for (const entry of library) {
      expect(entry.probe_questions.length).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one confrontation scenario (MISC-02)", () => {
    const library = loadLibrary();
    for (const entry of library) {
      expect(entry.confrontation_scenarios.length).toBeGreaterThan(0);
    }
  });

  it("all IDs are unique", () => {
    const library = loadLibrary();
    const ids = library.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("grade bands are valid values", () => {
    const validBands = new Set(["K-5", "6-8", "9-12"]);
    const library = loadLibrary();
    for (const entry of library) {
      expect(validBands.has(entry.grade_band)).toBe(true);
    }
  });

  it("getMisconceptionsByDomainAndBand returns filtered results", () => {
    const result = getMisconceptionsByDomainAndBand("physics", "K-5");
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry.domain).toBe("physics");
      expect(entry.grade_band).toBe("K-5");
    }
  });
});
