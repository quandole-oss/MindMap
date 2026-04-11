import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

vi.mock("../adapters/factory", () => ({
  createLLMAdapter: () => ({
    getModel: () => ({ __mock: "model" }),
    getModelId: () => "mock-model",
  }),
}));

import { generateText } from "ai";
import {
  analyzeStudentThemes,
  studentThemeAnalysisSchema,
  type StudentThemeAnalysis,
} from "../prompts/analyze-student-themes";

const fixtureParams = {
  gradeBand: "6-8" as const,
  themeCounts: {
    "substance-based-reasoning": 3,
    "perception-equals-reality": 1,
  },
  misconceptionIds: ["phys-003", "phys-004", "phys-011", "bio-004"],
  sessionOutcomes: ["unresolved", "unresolved", "resolved", "incomplete"] as Array<
    "resolved" | "unresolved" | "incomplete"
  >,
};

const validAnalysisFixture: StudentThemeAnalysis = {
  dominantThemes: ["substance-based-reasoning"],
  narrative:
    "This learner consistently reifies abstract processes into physical substances, treating heat, current, and cold air as stuff that can be stored or used up. The pattern cuts across domains and points to a framework-level ontological category error, not isolated topic gaps.",
  supportingMisconceptionIds: ["phys-003", "phys-004", "phys-011"],
};

describe("analyzeStudentThemes (THME-02, D-11)", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it("returns a Zod-valid StudentThemeAnalysis", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validAnalysisFixture,
    } as never);

    const result = await analyzeStudentThemes(fixtureParams);
    expect(() => studentThemeAnalysisSchema.parse(result)).not.toThrow();
  });

  it("at least one dominantTheme is a key of input themeCounts (grounding)", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validAnalysisFixture,
    } as never);

    const result = await analyzeStudentThemes(fixtureParams);
    const inputThemes = new Set(Object.keys(fixtureParams.themeCounts));
    const grounded = result.dominantThemes.some((t) => inputThemes.has(t));
    expect(grounded).toBe(true);
  });

  it("at least one supportingMisconceptionId is in input misconceptionIds (subset)", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validAnalysisFixture,
    } as never);

    const result = await analyzeStudentThemes(fixtureParams);
    const inputIds = new Set(fixtureParams.misconceptionIds);
    const grounded = result.supportingMisconceptionIds.some((id) => inputIds.has(id));
    expect(grounded).toBe(true);
  });

  it("calls generateText with experimental_output (NOT generateObject)", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validAnalysisFixture,
    } as never);

    await analyzeStudentThemes(fixtureParams);
    expect(generateText).toHaveBeenCalledTimes(1);
    const call = vi.mocked(generateText).mock.calls[0]![0] as Record<string, unknown>;
    expect(call).toHaveProperty("experimental_output");
    expect(call).toHaveProperty("model");
    expect(call).toHaveProperty("prompt");
  });

  it("prompt includes grade band, theme ids, misconception ids, and cross-pattern rule", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validAnalysisFixture,
    } as never);

    await analyzeStudentThemes(fixtureParams);
    const call = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string };
    expect(call.prompt).toContain("6-8");
    expect(call.prompt).toContain("substance-based-reasoning");
    expect(call.prompt).toContain("phys-003");
    expect(call.prompt.toLowerCase()).toMatch(/cross|pattern|do not enumerate|framework/);
  });

  it("prompt does not contain any student name placeholder", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validAnalysisFixture,
    } as never);

    await analyzeStudentThemes(fixtureParams);
    const call = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string };
    expect(call.prompt).not.toMatch(/\{name\}/i);
    expect(call.prompt).not.toMatch(/\{studentName\}/i);
    expect(call.prompt).not.toMatch(/\{email\}/i);
  });
});

describe("studentThemeAnalysisSchema structural constraints", () => {
  it("rejects empty dominantThemes", () => {
    const bad = { ...validAnalysisFixture, dominantThemes: [] };
    expect(studentThemeAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects more than 3 dominantThemes", () => {
    const bad = {
      ...validAnalysisFixture,
      dominantThemes: ["a", "b", "c", "d"],
    };
    expect(studentThemeAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects narrative shorter than 60 chars", () => {
    const bad = { ...validAnalysisFixture, narrative: "too short" };
    expect(studentThemeAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects empty supportingMisconceptionIds", () => {
    const bad = { ...validAnalysisFixture, supportingMisconceptionIds: [] };
    expect(studentThemeAnalysisSchema.safeParse(bad).success).toBe(false);
  });
});
