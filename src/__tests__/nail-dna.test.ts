/**
 * Unit tests for src/lib/nail-dna.ts
 *
 * Coverage targets:
 *  - computeNailDNA: empty looks → default profile
 *  - computeNailDNA: dominant finish/shape computation
 *  - computeNailDNA: color temperature (warm/cool/neutral)
 *  - computeNailDNA: boldness score
 *  - computeNailDNA: archetype assignment per finish
 *  - ARCHETYPES constant: 8 archetypes with required fields
 */

import { describe, it, expect } from "vitest";
import { computeNailDNA, ARCHETYPES } from "@/lib/nail-dna";
import type { SavedLook } from "@/lib/saved-looks";
import type { NailFinish, NailShape } from "@/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLook(overrides: {
  finish?: NailFinish;
  shape?: NailShape;
  topColor?: string;
}): SavedLook {
  return {
    id:          crypto.randomUUID(),
    userId:      "test-user",
    productId:   "p1",
    productName: "Test Look",
    imageUrl:    "data:x",
    shape:       overrides.shape  ?? "Almond",
    finish:      overrides.finish ?? "Gloss",
    style: {
      topColor:    overrides.topColor ?? "#FF0000",
      midColor:    "#880000",
      bottomColor: "#440000",
      shape:       overrides.shape  ?? "Almond",
      finish:      overrides.finish ?? "Gloss",
    },
    createdAt: new Date().toISOString(),
  };
}

// ─── ARCHETYPES ───────────────────────────────────────────────────────────────

describe("ARCHETYPES", () => {
  it("exports exactly 8 archetypes", () => {
    expect(ARCHETYPES).toHaveLength(8);
  });

  it("every archetype has required fields", () => {
    for (const a of ARCHETYPES) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.tagline).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(a.bgColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(a.emoji).toBeTruthy();
    }
  });

  it("archetype IDs are unique", () => {
    const ids = ARCHETYPES.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── computeNailDNA: empty looks ─────────────────────────────────────────────

describe("computeNailDNA — empty looks", () => {
  it("returns default profile for empty array", () => {
    const profile = computeNailDNA([]);
    expect(profile.dominantFinish).toBe("Gloss");
    expect(profile.dominantShape).toBe("Almond");
    expect(profile.colorTemp).toBe("neutral");
    expect(profile.totalLooks).toBe(0);
    expect(profile.archetype).toBeDefined();
  });
});

// ─── computeNailDNA: dominant finish ─────────────────────────────────────────

describe("computeNailDNA — dominant finish", () => {
  it("returns Chrome as dominant finish when most looks are Chrome", () => {
    const looks = [
      makeLook({ finish: "Chrome" }),
      makeLook({ finish: "Chrome" }),
      makeLook({ finish: "Chrome" }),
      makeLook({ finish: "Gloss" }),
    ];
    const profile = computeNailDNA(looks);
    expect(profile.dominantFinish).toBe("Chrome");
  });

  it("assigns chrome-maven archetype for Chrome dominant finish", () => {
    const looks = Array(5).fill(null).map(() => makeLook({ finish: "Chrome" }));
    const profile = computeNailDNA(looks);
    expect(profile.archetype.id).toBe("chrome-maven");
  });

  it("assigns cat-eye-mystic archetype for CatEye finish", () => {
    const looks = Array(3).fill(null).map(() => makeLook({ finish: "CatEye" }));
    const profile = computeNailDNA(looks);
    expect(profile.archetype.id).toBe("cat-eye-mystic");
  });

  it("assigns glitter-dreamer archetype for Glitter finish", () => {
    const looks = Array(3).fill(null).map(() => makeLook({ finish: "Glitter" }));
    const profile = computeNailDNA(looks);
    expect(profile.archetype.id).toBe("glitter-dreamer");
  });

  it("assigns matte-rebel for Matte finish with high boldness", () => {
    // Dark colors → high boldness
    const looks = Array(4).fill(null).map(() =>
      makeLook({ finish: "Matte", topColor: "#1A0010" })
    );
    const profile = computeNailDNA(looks);
    expect(profile.archetype.id).toBe("matte-rebel");
  });
});

// ─── computeNailDNA: dominant shape ──────────────────────────────────────────

describe("computeNailDNA — dominant shape", () => {
  it("returns Coffin as dominant shape when majority are Coffin", () => {
    const looks = [
      makeLook({ shape: "Coffin" }),
      makeLook({ shape: "Coffin" }),
      makeLook({ shape: "Coffin" }),
      makeLook({ shape: "Almond" }),
    ];
    const profile = computeNailDNA(looks);
    expect(profile.dominantShape).toBe("Coffin");
  });

  it("returns Stiletto as dominant shape", () => {
    const looks = Array(3).fill(null).map(() => makeLook({ shape: "Stiletto" }));
    const profile = computeNailDNA(looks);
    expect(profile.dominantShape).toBe("Stiletto");
  });
});

// ─── computeNailDNA: finish breakdown ────────────────────────────────────────

describe("computeNailDNA — finish breakdown", () => {
  it("correctly counts finishes", () => {
    const looks = [
      makeLook({ finish: "Gloss" }),
      makeLook({ finish: "Gloss" }),
      makeLook({ finish: "Matte" }),
    ];
    const { finishBreakdown } = computeNailDNA(looks);
    expect(finishBreakdown.Gloss).toBe(2);
    expect(finishBreakdown.Matte).toBe(1);
    expect(finishBreakdown.Chrome).toBe(0);
  });
});

// ─── computeNailDNA: shape breakdown ─────────────────────────────────────────

describe("computeNailDNA — shape breakdown", () => {
  it("correctly counts shapes", () => {
    const looks = [
      makeLook({ shape: "Almond" }),
      makeLook({ shape: "Almond" }),
      makeLook({ shape: "Square" }),
    ];
    const { shapeBreakdown } = computeNailDNA(looks);
    expect(shapeBreakdown.Almond).toBe(2);
    expect(shapeBreakdown.Square).toBe(1);
    expect(shapeBreakdown.Coffin).toBe(0);
  });
});

// ─── computeNailDNA: color temperature ───────────────────────────────────────

describe("computeNailDNA — color temperature", () => {
  it("returns warm for predominantly warm (red/orange) colors", () => {
    const looks = [
      makeLook({ topColor: "#FF0000" }), // red (warm)
      makeLook({ topColor: "#FF8800" }), // orange (warm)
      makeLook({ topColor: "#FFCC00" }), // yellow (warm)
    ];
    const profile = computeNailDNA(looks);
    expect(profile.colorTemp).toBe("warm");
  });

  it("returns cool for predominantly cool (blue/purple) colors", () => {
    const looks = [
      makeLook({ topColor: "#0000FF" }), // blue (cool)
      makeLook({ topColor: "#6600FF" }), // purple (cool)
      makeLook({ topColor: "#00CCFF" }), // cyan (cool)
    ];
    const profile = computeNailDNA(looks);
    expect(profile.colorTemp).toBe("cool");
  });

  it("returns neutral for balanced warm/cool mix", () => {
    // 2 warm + 2 cool → ratio = 0 → neutral
    const looks = [
      makeLook({ topColor: "#FF0000" }), // warm (h=0°)
      makeLook({ topColor: "#FF8800" }), // warm (h≈33°)
      makeLook({ topColor: "#0000FF" }), // cool (h=240°)
      makeLook({ topColor: "#6600CC" }), // cool (h≈270°)
    ];
    const profile = computeNailDNA(looks);
    expect(profile.colorTemp).toBe("neutral");
  });
});

// ─── computeNailDNA: totalLooks ──────────────────────────────────────────────

describe("computeNailDNA — totalLooks", () => {
  it("counts total looks correctly", () => {
    const looks = Array(7).fill(null).map(() => makeLook({}));
    const profile = computeNailDNA(looks);
    expect(profile.totalLooks).toBe(7);
  });
});

// ─── computeNailDNA: boldness ────────────────────────────────────────────────

describe("computeNailDNA — boldness", () => {
  it("returns high boldness for dark saturated colors", () => {
    const looks = Array(3).fill(null).map(() =>
      makeLook({ topColor: "#1A0A3D" }) // very dark purple
    );
    const profile = computeNailDNA(looks);
    expect(profile.boldness).toBeGreaterThan(0.5);
  });

  it("returns low boldness for near-white achromatic colors", () => {
    // Near-white grey: s≈0, l≈0.94 → boldness = (0 + 0.06)/2 = 0.03
    const looks = Array(3).fill(null).map(() =>
      makeLook({ topColor: "#F0F0F0" }) // light grey — very low saturation and high lightness
    );
    const profile = computeNailDNA(looks);
    expect(profile.boldness).toBeLessThan(0.5);
  });
});
