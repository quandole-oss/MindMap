import { describe, it, expect } from "vitest";
import {
  isTerminalStage,
  isValidTransition,
  getNextStage,
  isValidOutcome,
  type DiagnosticStage,
} from "../stages";

// ---------------------------------------------------------------------------
// isTerminalStage
// ---------------------------------------------------------------------------
describe("isTerminalStage", () => {
  it("returns false for probe", () => {
    expect(isTerminalStage("probe")).toBe(false);
  });

  it("returns false for classify", () => {
    expect(isTerminalStage("classify")).toBe(false);
  });

  it("returns false for confront", () => {
    expect(isTerminalStage("confront")).toBe(false);
  });

  it("returns true for resolve", () => {
    expect(isTerminalStage("resolve")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidTransition
// ---------------------------------------------------------------------------
describe("isValidTransition", () => {
  describe("from probe", () => {
    it("allows probe -> classify", () => {
      expect(isValidTransition("probe", "classify")).toBe(true);
    });

    it("allows probe -> confront", () => {
      expect(isValidTransition("probe", "confront")).toBe(true);
    });

    it("rejects probe -> resolve", () => {
      expect(isValidTransition("probe", "resolve")).toBe(false);
    });

    it("rejects probe -> probe (self-loop)", () => {
      expect(isValidTransition("probe", "probe")).toBe(false);
    });
  });

  describe("from classify", () => {
    it("allows classify -> confront", () => {
      expect(isValidTransition("classify", "confront")).toBe(true);
    });

    it("rejects classify -> resolve", () => {
      expect(isValidTransition("classify", "resolve")).toBe(false);
    });

    it("rejects classify -> probe", () => {
      expect(isValidTransition("classify", "probe")).toBe(false);
    });

    it("rejects classify -> classify (self-loop)", () => {
      expect(isValidTransition("classify", "classify")).toBe(false);
    });
  });

  describe("from confront", () => {
    it("allows confront -> resolve", () => {
      expect(isValidTransition("confront", "resolve")).toBe(true);
    });

    it("rejects confront -> probe", () => {
      expect(isValidTransition("confront", "probe")).toBe(false);
    });

    it("rejects confront -> classify", () => {
      expect(isValidTransition("confront", "classify")).toBe(false);
    });

    it("rejects confront -> confront (self-loop)", () => {
      expect(isValidTransition("confront", "confront")).toBe(false);
    });
  });

  describe("from resolve (terminal)", () => {
    const targets: DiagnosticStage[] = [
      "probe",
      "classify",
      "confront",
      "resolve",
    ];

    it.each(targets)("rejects resolve -> %s", (target) => {
      expect(isValidTransition("resolve", target)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// getNextStage
// ---------------------------------------------------------------------------
describe("getNextStage", () => {
  it("returns probe when in probe stage with no student response (waiting)", () => {
    expect(getNextStage("probe", false)).toBe("probe");
  });

  it("returns confront when in probe stage with student response", () => {
    expect(getNextStage("probe", true)).toBe("confront");
  });

  it("returns confront from classify (regardless of response flag)", () => {
    expect(getNextStage("classify", false)).toBe("confront");
    expect(getNextStage("classify", true)).toBe("confront");
  });

  it("returns resolve when in confront stage with student response", () => {
    expect(getNextStage("confront", true)).toBe("resolve");
  });

  it("returns null when in confront stage without student response", () => {
    expect(getNextStage("confront", false)).toBeNull();
  });

  it("returns null from resolve (terminal, no further stages)", () => {
    expect(getNextStage("resolve", false)).toBeNull();
    expect(getNextStage("resolve", true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isValidOutcome
// ---------------------------------------------------------------------------
describe("isValidOutcome", () => {
  describe("non-resolve stages require null outcome", () => {
    const nonTerminal: DiagnosticStage[] = ["probe", "classify", "confront"];

    it.each(nonTerminal)("%s + null -> valid", (stage) => {
      expect(isValidOutcome(stage, null)).toBe(true);
    });

    it.each(nonTerminal)('%s + "resolved" -> invalid', (stage) => {
      expect(isValidOutcome(stage, "resolved")).toBe(false);
    });

    it.each(nonTerminal)('%s + "unresolved" -> invalid', (stage) => {
      expect(isValidOutcome(stage, "unresolved")).toBe(false);
    });

    it.each(nonTerminal)('%s + "incomplete" -> invalid', (stage) => {
      expect(isValidOutcome(stage, "incomplete")).toBe(false);
    });
  });

  describe("resolve stage accepts only resolved/unresolved", () => {
    it('resolve + "resolved" -> valid', () => {
      expect(isValidOutcome("resolve", "resolved")).toBe(true);
    });

    it('resolve + "unresolved" -> valid', () => {
      expect(isValidOutcome("resolve", "unresolved")).toBe(true);
    });

    it("resolve + null -> invalid", () => {
      expect(isValidOutcome("resolve", null)).toBe(false);
    });

    it('resolve + "incomplete" -> invalid (not a valid terminal outcome)', () => {
      expect(isValidOutcome("resolve", "incomplete")).toBe(false);
    });
  });
});
