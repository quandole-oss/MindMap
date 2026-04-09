import { describe, it, expect } from "vitest";
import { buildEnrichSystemPrompt } from "../prompts/enrich";
import { buildExtractPrompt, conceptExtractionSchema, DOMAINS } from "../prompts/extract";

describe("buildEnrichSystemPrompt", () => {
  it("contains 'Grade 5' for gradeLevel 5", () => {
    const prompt = buildEnrichSystemPrompt(5);
    expect(prompt).toContain("Grade 5");
  });

  it("contains 'Kindergarten' for gradeLevel 0", () => {
    const prompt = buildEnrichSystemPrompt(0);
    expect(prompt).toContain("Kindergarten");
  });

  it("contains 'Grade 8' for gradeLevel 8", () => {
    const prompt = buildEnrichSystemPrompt(8);
    expect(prompt).toContain("Grade 8");
  });

  it("contains 'Grade 12' for gradeLevel 12", () => {
    const prompt = buildEnrichSystemPrompt(12);
    expect(prompt).toContain("Grade 12");
  });

  it("includes a Socratic follow-up directive (PRIV-01)", () => {
    const prompt = buildEnrichSystemPrompt(5);
    // Must contain follow-up question directive
    expect(prompt.toLowerCase()).toMatch(/follow.up|thought.provoking|question/i);
  });

  it("PRIV-01: does NOT contain PII placeholders like {name}", () => {
    const prompt = buildEnrichSystemPrompt(5);
    expect(prompt).not.toMatch(/\{name\}/i);
    expect(prompt).not.toMatch(/\{email\}/i);
    expect(prompt).not.toMatch(/\{userId\}/i);
    expect(prompt).not.toMatch(/\{student_id\}/i);
  });

  it("PRIV-01: does NOT contain 'student name' or 'student email' placeholder patterns", () => {
    const prompt = buildEnrichSystemPrompt(7);
    // Should explicitly say NOT to mention personal info, not include a slot for it
    expect(prompt).not.toMatch(/student name:/i);
    expect(prompt).not.toMatch(/student email:/i);
    expect(prompt).not.toMatch(/<name>/i);
    expect(prompt).not.toMatch(/<email>/i);
  });

  it("PRIV-01: any gradeLevel produces no PII pattern", () => {
    for (const level of [0, 1, 5, 6, 8, 9, 12]) {
      const prompt = buildEnrichSystemPrompt(level);
      expect(prompt).not.toMatch(/\{name\}|\{email\}|\{userId\}|\{student_id\}/i);
    }
  });
});

describe("buildExtractPrompt", () => {
  it("returns a string containing the question text", () => {
    const prompt = buildExtractPrompt("Why is the sky blue?", "It has to do with light scattering.");
    expect(prompt).toContain("Why is the sky blue?");
  });

  it("returns a string containing the answer text", () => {
    const prompt = buildExtractPrompt("Why is the sky blue?", "It has to do with light scattering.");
    expect(prompt).toContain("It has to do with light scattering.");
  });

  it("instructs extraction of concepts", () => {
    const prompt = buildExtractPrompt("What is gravity?", "Gravity is a force.");
    expect(prompt.toLowerCase()).toMatch(/concept|extract/);
  });

  it("contains '2-4' concept count guidance", () => {
    const prompt = buildExtractPrompt("What is gravity?", "Gravity is a force.");
    expect(prompt).toContain("2-4");
  });

  it("contains at least one <example> tag", () => {
    const prompt = buildExtractPrompt("What is gravity?", "Gravity is a force.");
    expect(prompt).toContain("<example>");
  });

  it("contains 'computer-science' in the domain list", () => {
    const prompt = buildExtractPrompt("What is gravity?", "Gravity is a force.");
    expect(prompt).toContain("computer-science");
  });

  it("contains 'astronomy' in the domain list", () => {
    const prompt = buildExtractPrompt("What is gravity?", "Gravity is a force.");
    expect(prompt).toContain("astronomy");
  });
});

describe("conceptExtractionSchema", () => {
  it("validates a valid concepts array", () => {
    const result = conceptExtractionSchema.safeParse({
      concepts: [{ name: "gravity", domain: "physics" }],
    });
    expect(result.success).toBe(true);
  });

  it("validates multiple concepts with different domains", () => {
    const result = conceptExtractionSchema.safeParse({
      concepts: [
        { name: "gravity", domain: "physics" },
        { name: "photosynthesis", domain: "biology" },
        { name: "fractions", domain: "math" },
        { name: "civil war", domain: "history" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates concepts with 'general' domain", () => {
    const result = conceptExtractionSchema.safeParse({
      concepts: [{ name: "critical thinking", domain: "general" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts 'chemistry' as a valid domain (now part of 15-domain enum)", () => {
    const result = conceptExtractionSchema.safeParse({
      concepts: [{ name: "acid-base reactions", domain: "chemistry" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a truly invalid domain value like 'cooking'", () => {
    const result = conceptExtractionSchema.safeParse({
      concepts: [{ name: "sourdough bread", domain: "cooking" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts all 15 domains", () => {
    for (const domain of DOMAINS) {
      const result = conceptExtractionSchema.safeParse({
        concepts: [{ name: "test concept", domain }],
      });
      expect(result.success, `domain '${domain}' should be valid`).toBe(true);
    }
  });

  it("rejects missing name field", () => {
    const result = conceptExtractionSchema.safeParse({
      concepts: [{ domain: "physics" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing concepts key", () => {
    const result = conceptExtractionSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });
});
