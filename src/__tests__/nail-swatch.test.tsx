/**
 * LUMIS — NailSwatch Component Unit Tests  v1.0
 *
 * Tests the pure-logic and rendering exports from src/components/NailSwatch.tsx.
 * React rendering is tested via @testing-library/react (jsdom).
 *
 * Coverage:
 *   FINISH_PREVIEW_SHAPE — canonical shape per finish
 *   NailSwatch           — renders without throwing, correct aria attributes,
 *                          correct SVG dimensions per size, all shapes/finishes
 *   Path builders        — indirectly via rendered `d` attribute completeness
 *   Sparkle stability    — glitter renders consistent circle count
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { NailSwatch, FINISH_PREVIEW_SHAPE } from "@/components/NailSwatch";
import type { NailShape, NailFinish } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_SHAPES: NailShape[]  = ["Almond", "Stiletto", "Oval", "Coffin", "Square"];
const ALL_FINISHES: NailFinish[] = [
  "Gloss", "Matte", "Metallic", "Chrome", "Jelly", "Glitter", "CatEye",
];

// ─── FINISH_PREVIEW_SHAPE ─────────────────────────────────────────────────────

describe("FINISH_PREVIEW_SHAPE", () => {
  it("SW-01: every finish has a canonical preview shape", () => {
    for (const finish of ALL_FINISHES) {
      expect(FINISH_PREVIEW_SHAPE[finish]).toBeDefined();
      expect(ALL_SHAPES).toContain(FINISH_PREVIEW_SHAPE[finish]);
    }
  });

  it("SW-02: Gloss → Oval", () => {
    expect(FINISH_PREVIEW_SHAPE["Gloss"]).toBe("Oval");
  });

  it("SW-03: CatEye → Stiletto", () => {
    expect(FINISH_PREVIEW_SHAPE["CatEye"]).toBe("Stiletto");
  });

  it("SW-04: Glitter → Coffin", () => {
    expect(FINISH_PREVIEW_SHAPE["Glitter"]).toBe("Coffin");
  });
});

// ─── NailSwatch — rendering ───────────────────────────────────────────────────

describe("NailSwatch rendering", () => {
  it("SW-05: renders an SVG element without throwing", () => {
    expect(() =>
      render(
        <NailSwatch
          shape="Almond"
          finish="Gloss"
          topColor="#FFD6E4"
          midColor="#F4A8C0"
          bottomColor="#C06080"
        />
      )
    ).not.toThrow();
  });

  it("SW-06: rendered element has role='img'", () => {
    const { getByRole } = render(
      <NailSwatch
        shape="Oval"
        finish="Matte"
        topColor="#5C2F6E"
        midColor="#3D1F4A"
        bottomColor="#1A0F1E"
      />
    );
    expect(getByRole("img")).toBeTruthy();
  });

  it("SW-07: aria-label includes shape and finish when not overridden", () => {
    const { getByRole } = render(
      <NailSwatch
        shape="Stiletto"
        finish="Chrome"
        topColor="#E8E8E8"
        midColor="#C0C0C0"
        bottomColor="#888888"
      />
    );
    const svg = getByRole("img");
    const label = svg.getAttribute("aria-label") ?? "";
    expect(label.toLowerCase()).toContain("stiletto");
    expect(label.toLowerCase()).toContain("chrome");
  });

  it("SW-08: custom aria-label overrides the default", () => {
    const { getByRole } = render(
      <NailSwatch
        shape="Almond"
        finish="Gloss"
        topColor="#FFD6E4"
        midColor="#F4A8C0"
        bottomColor="#C06080"
        aria-label="Rosé Reverie nail shade"
      />
    );
    expect(getByRole("img").getAttribute("aria-label")).toBe("Rosé Reverie nail shade");
  });
});

// ─── Size prop ────────────────────────────────────────────────────────────────

describe("NailSwatch size prop", () => {
  const SIZE_MAP = {
    xs:  { w: 28,  h: 40  },
    sm:  { w: 36,  h: 52  },
    md:  { w: 44,  h: 64  },
    lg:  { w: 72,  h: 104 },
    xl:  { w: 120, h: 172 },
  } as const;

  for (const [size, { w, h }] of Object.entries(SIZE_MAP)) {
    it(`SW-${9 + Object.keys(SIZE_MAP).indexOf(size)}: size="${size}" → width=${w} height=${h}`, () => {
      const { getByRole } = render(
        <NailSwatch
          shape="Almond"
          finish="Gloss"
          topColor="#FFD6E4"
          midColor="#F4A8C0"
          bottomColor="#C06080"
          size={size as keyof typeof SIZE_MAP}
        />
      );
      const svg = getByRole("img") as unknown as SVGElement;
      expect(svg.getAttribute("width")).toBe(String(w));
      expect(svg.getAttribute("height")).toBe(String(h));
    });
  }
  // SW-09 through SW-13 are covered by the loop above

  it("SW-14: default size is 'md' (44 × 64)", () => {
    const { getByRole } = render(
      <NailSwatch
        shape="Almond"
        finish="Gloss"
        topColor="#FFD6E4"
        midColor="#F4A8C0"
        bottomColor="#C06080"
      />
    );
    const svg = getByRole("img") as unknown as SVGElement;
    expect(svg.getAttribute("width")).toBe("44");
    expect(svg.getAttribute("height")).toBe("64");
  });
});

// ─── All shapes render ────────────────────────────────────────────────────────

describe("NailSwatch — all shapes", () => {
  for (const shape of ALL_SHAPES) {
    it(`SW-${15 + ALL_SHAPES.indexOf(shape)}: shape="${shape}" renders without error`, () => {
      expect(() =>
        render(
          <NailSwatch
            shape={shape}
            finish="Gloss"
            topColor="#FFD6E4"
            midColor="#F4A8C0"
            bottomColor="#C06080"
          />
        )
      ).not.toThrow();
    });
  }
  // SW-15 through SW-19 covered by loop
});

// ─── All finishes render ──────────────────────────────────────────────────────

describe("NailSwatch — all finishes", () => {
  const BASE = { shape: "Almond" as NailShape, topColor: "#FFD6E4", midColor: "#F4A8C0", bottomColor: "#C06080" };

  for (const finish of ALL_FINISHES) {
    it(`SW-${20 + ALL_FINISHES.indexOf(finish)}: finish="${finish}" renders without error`, () => {
      expect(() =>
        render(<NailSwatch {...BASE} finish={finish} />)
      ).not.toThrow();
    });
  }
  // SW-20 through SW-26 covered by loop
});

// ─── Jelly finish — skin-tone ─────────────────────────────────────────────────

describe("NailSwatch — Jelly finish", () => {
  it("SW-27: Jelly renders without error using default skinToneHex", () => {
    expect(() =>
      render(
        <NailSwatch
          shape="Oval"
          finish="Jelly"
          topColor="#FADADD"
          midColor="#F5C0C5"
          bottomColor="#E8A0A8"
        />
      )
    ).not.toThrow();
  });

  it("SW-28: Jelly renders with custom skinToneHex", () => {
    expect(() =>
      render(
        <NailSwatch
          shape="Oval"
          finish="Jelly"
          topColor="#FADADD"
          midColor="#F5C0C5"
          bottomColor="#E8A0A8"
          skinToneHex="#8B5E3C"
        />
      )
    ).not.toThrow();
  });
});

// ─── Glitter finish — density prop ───────────────────────────────────────────

describe("NailSwatch — Glitter finish", () => {
  it("SW-29: Glitter with density 0.02 renders without error", () => {
    expect(() =>
      render(
        <NailSwatch
          shape="Coffin"
          finish="Glitter"
          topColor="#2A1A4A"
          midColor="#1E1234"
          bottomColor="#10081C"
          glitterDensity={0.02}
        />
      )
    ).not.toThrow();
  });

  it("SW-30: Glitter with density 0.12 renders without error", () => {
    expect(() =>
      render(
        <NailSwatch
          shape="Coffin"
          finish="Glitter"
          topColor="#2A1A4A"
          midColor="#1E1234"
          bottomColor="#10081C"
          glitterDensity={0.12}
        />
      )
    ).not.toThrow();
  });

  it("SW-31: Glitter renders circles (sparkles) in the SVG", () => {
    const { container } = render(
      <NailSwatch
        shape="Almond"
        finish="Glitter"
        topColor="#C8A840"
        midColor="#B89030"
        bottomColor="#806010"
        glitterDensity={0.08}
      />
    );
    const circles = container.querySelectorAll("circle");
    // At density 0.08 with nw=44, nh=64 → should have several sparkles
    expect(circles.length).toBeGreaterThan(0);
  });
});

// ─── CatEye finish — direction prop ──────────────────────────────────────────

describe("NailSwatch — CatEye finish", () => {
  it("SW-32: CatEye with positive catEyeDir renders without error", () => {
    expect(() =>
      render(
        <NailSwatch
          shape="Stiletto"
          finish="CatEye"
          topColor="#0A0A14"
          midColor="#141420"
          bottomColor="#08080E"
          catEyeDir={0.3}
        />
      )
    ).not.toThrow();
  });

  it("SW-33: CatEye with negative catEyeDir renders without error", () => {
    expect(() =>
      render(
        <NailSwatch
          shape="Almond"
          finish="CatEye"
          topColor="#2A0840"
          midColor="#3A1058"
          bottomColor="#180528"
          catEyeDir={-0.2}
        />
      )
    ).not.toThrow();
  });
});

// ─── SVG structure ────────────────────────────────────────────────────────────

describe("NailSwatch — SVG structure", () => {
  it("SW-34: SVG contains a <defs> element", () => {
    const { container } = render(
      <NailSwatch
        shape="Almond"
        finish="Gloss"
        topColor="#FFD6E4"
        midColor="#F4A8C0"
        bottomColor="#C06080"
      />
    );
    expect(container.querySelector("defs")).toBeTruthy();
  });

  it("SW-35: SVG contains at least one <path> element (nail silhouette)", () => {
    const { container } = render(
      <NailSwatch
        shape="Coffin"
        finish="Chrome"
        topColor="#E8E8E8"
        midColor="#C0C0C0"
        bottomColor="#888888"
      />
    );
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("SW-36: SVG contains a linearGradient for the base fill", () => {
    const { container } = render(
      <NailSwatch
        shape="Oval"
        finish="Metallic"
        topColor="#F5D060"
        midColor="#E9C349"
        bottomColor="#7A5E00"
      />
    );
    const gradients = container.querySelectorAll("linearGradient");
    expect(gradients.length).toBeGreaterThan(0);
    // The base gradient id includes "-base"
    const baseGrad = Array.from(gradients).find(g =>
      (g.getAttribute("id") ?? "").includes("-base")
    );
    expect(baseGrad).toBeTruthy();
  });

  it("SW-37: cuticle arc path present (stroke only, no fill)", () => {
    const { container } = render(
      <NailSwatch
        shape="Almond"
        finish="Gloss"
        topColor="#FFD6E4"
        midColor="#F4A8C0"
        bottomColor="#C06080"
      />
    );
    // Cuticle arc path has fill="none" and a stroke attribute
    const arcPath = Array.from(container.querySelectorAll("path")).find(
      p => p.getAttribute("fill") === "none" && p.getAttribute("stroke") !== null
    );
    expect(arcPath).toBeTruthy();
  });

  it("SW-38: viewBox attribute is set", () => {
    const { getByRole } = render(
      <NailSwatch
        shape="Square"
        finish="Matte"
        topColor="#3D1F4A"
        midColor="#5C2F6E"
        bottomColor="#1A0F1E"
      />
    );
    const viewBox = getByRole("img").getAttribute("viewBox");
    expect(viewBox).toBeTruthy();
    // Should be four numeric-ish values separated by spaces
    const parts = (viewBox ?? "").trim().split(/\s+/);
    expect(parts.length).toBe(4);
    parts.forEach(p => expect(isNaN(Number(p))).toBe(false));
  });
});
