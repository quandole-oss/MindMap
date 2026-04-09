import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDomainColor,
  DOMAIN_HUE_PALETTE,
} from "../domain-colors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Because getDomainColor uses module-level mutable state (domainColorMap and
// nextIndex) we must reload the module fresh for any test group that needs a
// clean slate. We do this with vi.resetModules() + a dynamic import helper.

async function freshModule() {
  vi.resetModules();
  return import("../domain-colors");
}

// ---------------------------------------------------------------------------
// DOMAIN_HUE_PALETTE — static palette assertions (no module reset needed)
// ---------------------------------------------------------------------------

describe("DOMAIN_HUE_PALETTE", () => {
  it("has exactly 10 entries", () => {
    expect(DOMAIN_HUE_PALETTE).toHaveLength(10);
  });

  it("every entry is a valid 6-digit hex color string", () => {
    for (const color of DOMAIN_HUE_PALETTE) {
      expect(color).toMatch(HEX_RE);
    }
  });
});

// ---------------------------------------------------------------------------
// getDomainColor — isolated per describe block via module reload
// ---------------------------------------------------------------------------

describe("getDomainColor — returns a valid hex color", () => {
  it("returns a valid hex color string for any domain", async () => {
    const { getDomainColor: fresh } = await freshModule();
    const color = fresh("mathematics");
    expect(color).toMatch(HEX_RE);
  });
});

describe("getDomainColor — deterministic (same domain → same color)", () => {
  it("returns the same color on repeated calls for the same domain", async () => {
    const { getDomainColor: fresh } = await freshModule();
    const first = fresh("physics");
    const second = fresh("physics");
    const third = fresh("physics");
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("is stable even after other domains have been assigned", async () => {
    const { getDomainColor: fresh } = await freshModule();
    const before = fresh("history");
    fresh("biology");
    fresh("chemistry");
    const after = fresh("history");
    expect(after).toBe(before);
  });
});

describe("getDomainColor — different domains get different colors", () => {
  it("assigns distinct colors to the first 10 unique domains", async () => {
    const { getDomainColor: fresh } = await freshModule();
    const domains = [
      "domain-0",
      "domain-1",
      "domain-2",
      "domain-3",
      "domain-4",
      "domain-5",
      "domain-6",
      "domain-7",
      "domain-8",
      "domain-9",
    ];
    const colors = domains.map(fresh);
    const unique = new Set(colors);
    // All 10 palette slots should have been used → 10 distinct colors
    expect(unique.size).toBe(10);
  });
});

describe("getDomainColor — colors cycle after palette exhausts", () => {
  it("wraps back to index 0 for the 11th new domain", async () => {
    const { getDomainColor: fresh, DOMAIN_HUE_PALETTE: palette } =
      await freshModule();

    // Consume all 10 palette entries
    for (let i = 0; i < palette.length; i++) {
      fresh(`domain-${i}`);
    }

    // The 11th domain should map to palette[0]
    const eleventh = fresh("domain-overflow");
    expect(eleventh).toBe(palette[0]);
  });

  it("wraps correctly for the 12th new domain (palette[1])", async () => {
    const { getDomainColor: fresh, DOMAIN_HUE_PALETTE: palette } =
      await freshModule();

    for (let i = 0; i < palette.length; i++) {
      fresh(`domain-${i}`);
    }
    fresh("domain-overflow-0"); // index 10 → palette[0]
    const twelfth = fresh("domain-overflow-1"); // index 11 → palette[1]
    expect(twelfth).toBe(palette[1]);
  });
});
