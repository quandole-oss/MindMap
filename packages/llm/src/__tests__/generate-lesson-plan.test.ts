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
  generateLessonPlan,
  lessonPlanSchema,
  type LessonPlan,
} from "../prompts/generate-lesson-plan";

const fixtureParams = {
  theme: {
    id: "substance-based-reasoning",
    name: "Substance-based reasoning",
    naive_theory: "Energy treated as stuff that flows",
    description:
      "Students reify abstract processes into physical substances that can be stored, used up, or transferred.",
    citation: "Reiner et al. 2000",
  },
  studentsAffected: 4,
  gradeBand: "6-8" as const,
  constituentMisconceptions: [
    {
      id: "phys-003",
      name: "Heat equals temperature",
      description: "Students conflate thermal energy with temperature as if they were the same quantity.",
      confrontation_scenarios: ["Show two cups of water at the same temperature but different masses."],
    },
    {
      id: "phys-004",
      name: "Current is used up in a circuit",
      description: "Students believe electric current is consumed as it flows through a bulb.",
      confrontation_scenarios: ["Measure current on both sides of a bulb using ammeters."],
    },
    {
      id: "phys-011",
      name: "Cold air sinks because it is heavy",
      description: "Students treat cold as a substance with mass.",
      confrontation_scenarios: ["Compare density of hot vs cold air with a balance demonstration."],
    },
  ],
};

const validLessonPlanFixture: LessonPlan = {
  theme: "Substance-based reasoning",
  commonMisunderstanding:
    "Students treat heat, current, and energy as physical stuff that gets stored, used up, and consumed. This ontological miscategorization leads them to predict systems incorrectly.",
  targetUnderstanding:
    "These are abstract process-relations, not material substances. They describe how systems change over time rather than what gets transferred between objects.",
  suggestedActivities: [
    {
      title: "Energy bar chart demo",
      description:
        "Use a swinging pendulum with a real-time energy bar chart on the board. Students predict then watch the bars shift between KE and PE with no loss.",
      referencedMisconceptionIds: ["phys-003", "phys-004"],
    },
    {
      title: "Battery flashlight challenge",
      description:
        "Show two flashlights with different bulb resistances running off identical batteries. Students measure time-to-dim and reconcile with energy, not 'current used up'.",
      referencedMisconceptionIds: ["phys-004"],
    },
  ],
  discussionPrompts: [
    "What does it mean for a battery to be 'dead' if charge is conserved?",
    "If heat is a substance, where does it go when ice melts at a steady temperature?",
  ],
  confrontationApproaches: [
    "Show identical hot and cold cups and ask students to predict the temperature equilibration curve over ten minutes, then reconcile with measurements.",
  ],
};

describe("generateLessonPlan (LSPL-01, D-15)", () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it("returns a Zod-valid LessonPlan", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validLessonPlanFixture,
    } as never);

    const result = await generateLessonPlan(fixtureParams);
    expect(() => lessonPlanSchema.parse(result)).not.toThrow();
  });

  it("every referencedMisconceptionId is in the input constituentMisconceptions (D-15 anti-hallucination)", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validLessonPlanFixture,
    } as never);

    const result = await generateLessonPlan(fixtureParams);
    const validIds = new Set(fixtureParams.constituentMisconceptions.map((c) => c.id));
    const referenced = result.suggestedActivities.flatMap((a) => a.referencedMisconceptionIds);
    const hallucinated = referenced.filter((id) => !validIds.has(id));
    expect(hallucinated).toEqual([]);
  });

  it("documents the hallucination failure mode when the LLM cites an unknown ID", async () => {
    const hallucinatedPlan: LessonPlan = {
      ...validLessonPlanFixture,
      suggestedActivities: [
        {
          ...validLessonPlanFixture.suggestedActivities[0]!,
          referencedMisconceptionIds: ["phys-999"], // not in input
        },
        validLessonPlanFixture.suggestedActivities[1]!,
      ],
    };
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: hallucinatedPlan,
    } as never);

    const result = await generateLessonPlan(fixtureParams);
    const validIds = new Set(fixtureParams.constituentMisconceptions.map((c) => c.id));
    const referenced = result.suggestedActivities.flatMap((a) => a.referencedMisconceptionIds);
    const hallucinated = referenced.filter((id) => !validIds.has(id));
    // The function itself does NOT filter — the test documents the failure mode
    // so reviewers see the gap (v1: Zod shape + fixture-level guard only).
    expect(hallucinated.length).toBeGreaterThan(0);
  });

  it("calls generateText with experimental_output (NOT generateObject)", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validLessonPlanFixture,
    } as never);

    await generateLessonPlan(fixtureParams);
    expect(generateText).toHaveBeenCalledTimes(1);
    const call = vi.mocked(generateText).mock.calls[0]![0] as Record<string, unknown>;
    expect(call).toHaveProperty("experimental_output");
    expect(call).toHaveProperty("model");
    expect(call).toHaveProperty("prompt");
  });

  it("prompt includes theme name, grade band, misconception names, and anti-hallucination rule", async () => {
    vi.mocked(generateText).mockResolvedValue({
      experimental_output: validLessonPlanFixture,
    } as never);

    await generateLessonPlan(fixtureParams);
    const call = vi.mocked(generateText).mock.calls[0]![0] as { prompt: string };
    expect(call.prompt).toContain("Substance-based reasoning");
    expect(call.prompt).toContain("6-8");
    expect(call.prompt).toContain("Heat equals temperature");
    expect(call.prompt).toContain("phys-003");
    expect(call.prompt.toLowerCase()).toMatch(/do not invent|must come from|referenced/i);
  });
});

describe("lessonPlanSchema structural constraints", () => {
  it("rejects a plan with fewer than 2 activities", () => {
    const plan = {
      ...validLessonPlanFixture,
      suggestedActivities: [validLessonPlanFixture.suggestedActivities[0]!],
    };
    expect(lessonPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects an activity with zero referencedMisconceptionIds", () => {
    const plan = {
      ...validLessonPlanFixture,
      suggestedActivities: [
        { ...validLessonPlanFixture.suggestedActivities[0]!, referencedMisconceptionIds: [] },
        validLessonPlanFixture.suggestedActivities[1]!,
      ],
    };
    expect(lessonPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects commonMisunderstanding shorter than 40 chars", () => {
    const plan = { ...validLessonPlanFixture, commonMisunderstanding: "too short" };
    expect(lessonPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects fewer than 2 discussionPrompts", () => {
    const plan = { ...validLessonPlanFixture, discussionPrompts: ["only one prompt that is long enough"] };
    expect(lessonPlanSchema.safeParse(plan).success).toBe(false);
  });
});
