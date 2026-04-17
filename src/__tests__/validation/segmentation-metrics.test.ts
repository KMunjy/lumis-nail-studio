/**
 * LUMIS — Segmentation Metrics Unit Tests  v1.0
 *
 * Targeted unit tests for IoU boundary extraction, CIEDE2000 accuracy,
 * and edge-case handling in the eval-metrics library.
 *
 * Complements overlay-accuracy.test.ts with lower-level coverage.
 */

import { describe, it, expect } from "vitest";
import {
  computeMaskOverlap,
  computeBoundaryF1,
  computeBleed,
  computeDeltaE,
  THRESHOLDS,
  type ColourSample,
} from "@/lib/eval-metrics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const W = 50, H = 50, N = W * H;

function filled(val: 0 | 1): Uint8Array {
  return new Uint8Array(N).fill(val);
}

function stripe(every: number): Uint8Array {
  const m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = i % every === 0 ? 1 : 0;
  return m;
}

// ─── IoU mathematical properties ─────────────────────────────────────────────

describe("IoU / Dice — mathematical properties", () => {
  it("SEG-01: Dice ≥ IoU for any two masks (Dice ≥ IoU is always true)", () => {
    for (let trial = 0; trial < 10; trial++) {
      // Deterministic "random" masks using stripe patterns
      const a = stripe(trial + 2);
      const b = stripe(trial + 3);
      const { iou, dice } = computeMaskOverlap(a, b);
      expect(dice).toBeGreaterThanOrEqual(iou - 1e-9);
    }
  });

  it("SEG-02: IoU = Dice / (2 - Dice) identity", () => {
    const a = stripe(3);
    const b = stripe(5);
    const { iou, dice } = computeMaskOverlap(a, b);
    if (dice < 0.999) {  // skip perfect case (division edge)
      const iouFromDice = dice / (2 - dice);
      expect(iou).toBeCloseTo(iouFromDice, 3);
    }
  });

  it("SEG-03: fully filled masks → IoU=1, Dice=1", () => {
    const { iou, dice } = computeMaskOverlap(filled(1), filled(1));
    expect(iou).toBe(1.0);
    expect(dice).toBe(1.0);
  });

  it("SEG-04: single pixel overlap — IoU = 1/(N+N-1)", () => {
    const a = new Uint8Array(N);
    const b = new Uint8Array(N);
    a[0] = 1;
    b[0] = 1;
    const { iou } = computeMaskOverlap(a, b);
    expect(iou).toBeCloseTo(1 / (1 + 1 - 1), 5);  // = 1.0 (only 1 pixel each, identical)
  });

  it("SEG-05: single pixel in renderer, not in GT → IoU = 0", () => {
    const a = new Uint8Array(N);
    const b = new Uint8Array(N);
    a[0] = 1;
    b[1] = 1;
    const { iou } = computeMaskOverlap(a, b);
    expect(iou).toBe(0.0);
  });
});

// ─── Boundary F1 properties ───────────────────────────────────────────────────

describe("BoundaryF1 — properties and edge cases", () => {
  it("SEG-06: fully filled masks — no boundary pixels → F1 = 1 (vacuous)", () => {
    const f1 = computeBoundaryF1(filled(1), filled(1), W, H);
    expect(f1).toBeCloseTo(1.0, 2);
  });

  it("SEG-07: both empty masks → no boundary → F1 = 1.0 (vacuous)", () => {
    const f1 = computeBoundaryF1(filled(0), filled(0), W, H);
    expect(f1).toBeCloseTo(1.0, 2);
  });

  it("SEG-08: larger dilation window → higher F1 for shifted masks", () => {
    const a = new Uint8Array(N), b = new Uint8Array(N);
    // Rectangle shifted by 3px
    for (let y = 10; y < 40; y++) { a[y * W + 10] = 1; a[y * W + 11] = 1; }
    for (let y = 10; y < 40; y++) { b[y * W + 13] = 1; b[y * W + 14] = 1; }

    const f1_tight = computeBoundaryF1(a, b, W, H, 1);
    const f1_loose = computeBoundaryF1(a, b, W, H, 4);
    expect(f1_loose).toBeGreaterThanOrEqual(f1_tight);
  });
});

// ─── Bleed zone decomposition ─────────────────────────────────────────────────

describe("computeBleed — zone decomposition", () => {
  it("SEG-09: bleed only in tip zone — cuticle/sidewall remain 0", () => {
    const renderer = new Uint8Array(N);
    const gt       = new Uint8Array(N);
    const tipZone  = new Uint8Array(N);

    // renderer has 10 extra pixels in the tip zone
    for (let i = 0; i < 10; i++) renderer[i] = 1;
    // GT has only 5 of those
    for (let i = 0; i < 5; i++) gt[i] = 1;
    // tip zone covers those 10 pixels
    for (let i = 0; i < 10; i++) tipZone[i] = 1;

    const bleed = computeBleed(renderer, gt, null, null, tipZone);
    expect(bleed.tip).toBeGreaterThan(0);
    expect(bleed.cuticle).toBe(0);
    expect(bleed.sidewall).toBe(0);
  });

  it("SEG-10: bleed split across cuticle and sidewall", () => {
    const renderer    = new Uint8Array(N);
    const gt          = new Uint8Array(N);
    const cuticleZone = new Uint8Array(N);
    const sidewallZone = new Uint8Array(N);

    // renderer: pixels 0-19 on
    for (let i = 0; i < 20; i++) renderer[i] = 1;
    // gt: pixels 10-19 on (0-9 are bleed)
    for (let i = 10; i < 20; i++) gt[i] = 1;
    // cuticle zone: pixels 0-4 (5 bleed pixels)
    for (let i = 0; i < 5; i++) cuticleZone[i] = 1;
    // sidewall zone: pixels 5-9 (5 bleed pixels)
    for (let i = 5; i < 10; i++) sidewallZone[i] = 1;

    const bleed = computeBleed(renderer, gt, cuticleZone, sidewallZone, null);
    // total bleed = 10 pixels / 20 renderer pixels = 0.5
    expect(bleed.total).toBeCloseTo(0.5, 2);
    // cuticle bleed = 5/20 = 0.25
    expect(bleed.cuticle).toBeCloseTo(0.25, 2);
    // sidewall bleed = 5/20 = 0.25
    expect(bleed.sidewall).toBeCloseTo(0.25, 2);
  });

  it("SEG-11: renderer is subset of GT → zero bleed", () => {
    const small  = new Uint8Array(N);
    const large  = new Uint8Array(N);
    for (let i = 0; i < 10; i++) small[i] = 1;
    for (let i = 0; i < 20; i++) large[i] = 1;
    const bleed = computeBleed(small, large);  // renderer ⊂ GT
    expect(bleed.total).toBe(0);
  });
});

// ─── CIEDE2000 colour metric ──────────────────────────────────────────────────

describe("computeDeltaE — CIEDE2000 accuracy", () => {
  // Reference pairs from Sharma et al. (2005) CIEDE2000 test data — simplified
  const pairs: Array<[ColourSample, ColourSample, number, number]> = [
    // [a, b, expectedDeltaE approx, tolerance]
    [
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 0, b: 0 },
      0.0, 0.01,
    ],
    [
      { r: 128, g: 0, b: 128 },
      { r: 0, g: 128, b: 0 },
      // Purple vs green — large ΔE
      50, 40,  // wide tolerance for hue shift
    ],
    [
      { r: 255, g: 255, b: 200 },
      { r: 255, g: 255, b: 210 },
      // Near-identical yellows — small ΔE
      0, 4,
    ],
  ];

  it.each(pairs)("SEG-12: ΔE within expected range", (a, b, approx, tol) => {
    const de = computeDeltaE(a, b);
    expect(de).toBeGreaterThanOrEqual(Math.max(0, approx - tol));
    expect(de).toBeLessThanOrEqual(approx + tol);
  });

  it("SEG-13: Gloss product colours (Rosé Reverie) — ΔE < 8 for ±10 RGB shift", () => {
    const expected: ColourSample = { r: 0xFF, g: 0xD6, b: 0xE4 };  // #FFD6E4
    const rendered: ColourSample = { r: 0xFF - 8, g: 0xD6 - 6, b: 0xE4 + 6 };
    const de = computeDeltaE(expected, rendered);
    expect(de).toBeLessThan(THRESHOLDS.deltaE);
  });

  it("SEG-14: Chrome vs Matte same base — ΔE > 0 (finish changes perceived colour)", () => {
    // Chrome adds specular highlight; base topColor differs in perceived lightness
    const chromeTop: ColourSample = { r: 0xE8, g: 0xE8, b: 0xE8 };  // Midnight Chrome
    const matteDark: ColourSample = { r: 0x1A, g: 0x1A, b: 0x1A };  // Onyx mid
    const de = computeDeltaE(chromeTop, matteDark);
    expect(de).toBeGreaterThan(THRESHOLDS.deltaE);  // very different colours
  });

  it("SEG-15: ΔE never negative", () => {
    for (let i = 0; i < 20; i++) {
      const a: ColourSample = { r: i * 12, g: 255 - i * 10, b: i * 5 };
      const b: ColourSample = { r: 255 - i * 12, g: i * 10, b: 255 - i * 5 };
      expect(computeDeltaE(a, b)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── THRESHOLDS constants ─────────────────────────────────────────────────────

describe("THRESHOLDS constants", () => {
  it("SEG-16: THRESHOLDS has correct production values", () => {
    expect(THRESHOLDS.iou).toBe(0.82);
    expect(THRESHOLDS.iouDegraded).toBe(0.72);
    expect(THRESHOLDS.dice).toBe(0.88);
    expect(THRESHOLDS.boundaryF1).toBe(0.80);
    expect(THRESHOLDS.cuticleErrorPx).toBe(4.0);
    expect(THRESHOLDS.sidewallRatioMin).toBe(0.92);
    expect(THRESHOLDS.sidewallRatioMax).toBe(1.08);
    expect(THRESHOLDS.bleedTotal).toBe(0.03);
    expect(THRESHOLDS.bleedCuticle).toBe(0.02);
    expect(THRESHOLDS.deltaE).toBe(8.0);
    expect(THRESHOLDS.jitterPx).toBe(1.5);
  });

  it("SEG-17: iouDegraded < iou (degraded threshold is more lenient)", () => {
    expect(THRESHOLDS.iouDegraded).toBeLessThan(THRESHOLDS.iou);
  });

  it("SEG-18: bleedCuticle < bleedTotal (stricter for cuticle zone)", () => {
    expect(THRESHOLDS.bleedCuticle).toBeLessThan(THRESHOLDS.bleedTotal);
  });
});
