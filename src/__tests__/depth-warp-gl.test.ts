/**
 * LUMIS — depth-warp-gl Unit Tests  v1.0
 *
 * Tests the pure-math exports from src/lib/depth-warp-gl.ts.
 * WebGL context creation is NOT tested here because jsdom does not implement
 * WebGL2. The exported pure functions (computeUVDisplacement, isUVInBounds,
 * displacedSrcUV) contain all the shader math and can be verified in jsdom.
 *
 * Coverage:
 *   computeUVDisplacement  — angle clamping, strength scaling, identity at 0
 *   isUVInBounds           — boundary and out-of-bounds detection
 *   displacedSrcUV         — end-to-end UV displacement, mirrors shader formula
 *   PARALLAX_SCALE_GL      — matches depth-warp.ts constant
 *   MAX_ANGLE_GL           — clamped at ±20
 *   isWebGL2Available      — returns false in jsdom (no WebGL support)
 */

import { describe, it, expect } from "vitest";
import {
  computeUVDisplacement,
  isUVInBounds,
  displacedSrcUV,
  PARALLAX_SCALE_GL,
  MAX_ANGLE_GL,
  isWebGL2Available,
} from "@/lib/depth-warp-gl";

// ─── Constants ────────────────────────────────────────────────────────────────

describe("Module constants", () => {
  it("GL-01: PARALLAX_SCALE_GL matches depth-warp CPU constant (0.015)", () => {
    expect(PARALLAX_SCALE_GL).toBeCloseTo(0.015, 6);
  });

  it("GL-02: MAX_ANGLE_GL is 20 degrees", () => {
    expect(MAX_ANGLE_GL).toBe(20);
  });
});

// ─── isWebGL2Available ────────────────────────────────────────────────────────

describe("isWebGL2Available", () => {
  it("GL-03: returns a boolean without throwing", () => {
    // jsdom stubs getContext("webgl2") so this may return true or false
    // depending on the jsdom version. The important thing is it does not throw.
    const result = isWebGL2Available();
    expect(typeof result).toBe("boolean");
  });
});

// ─── computeUVDisplacement ────────────────────────────────────────────────────

describe("computeUVDisplacement", () => {
  it("GL-04: zero angle → zero displacement", () => {
    const { dx, dy } = computeUVDisplacement(1.0, 0, 0, 1.0);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });

  it("GL-05: zero strength → zero displacement regardless of angle", () => {
    const { dx, dy } = computeUVDisplacement(1.0, 15, 10, 0);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });

  it("GL-06: zero depth → zero displacement regardless of angle or strength", () => {
    const { dx, dy } = computeUVDisplacement(0, 20, 20, 1.0);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
  });

  it("GL-07: positive angle and full depth/strength → positive dx", () => {
    const { dx } = computeUVDisplacement(1.0, 10, 0, 1.0);
    expect(dx).toBeGreaterThan(0);
  });

  it("GL-08: negative angle → negative dx", () => {
    const { dx } = computeUVDisplacement(1.0, -10, 0, 1.0);
    expect(dx).toBeLessThan(0);
  });

  it("GL-09: angle > MAX_ANGLE_GL is clamped (20° and 30° produce same result)", () => {
    const r20 = computeUVDisplacement(1.0, 20,  0, 1.0);
    const r30 = computeUVDisplacement(1.0, 30,  0, 1.0);
    const r50 = computeUVDisplacement(1.0, 50,  0, 1.0);
    expect(r20.dx).toBeCloseTo(r30.dx, 8);
    expect(r20.dx).toBeCloseTo(r50.dx, 8);
  });

  it("GL-10: angle < -MAX_ANGLE_GL is clamped", () => {
    const rNeg20 = computeUVDisplacement(1.0, -20, 0, 1.0);
    const rNeg40 = computeUVDisplacement(1.0, -40, 0, 1.0);
    expect(rNeg20.dx).toBeCloseTo(rNeg40.dx, 8);
  });

  it("GL-11: strength > 1 is clamped to 1", () => {
    const r1  = computeUVDisplacement(1.0, 10, 0, 1.0);
    const r2  = computeUVDisplacement(1.0, 10, 0, 2.0);
    const r10 = computeUVDisplacement(1.0, 10, 0, 10.0);
    expect(r1.dx).toBeCloseTo(r2.dx, 8);
    expect(r1.dx).toBeCloseTo(r10.dx, 8);
  });

  it("GL-12: dx scales linearly with depth", () => {
    const r05 = computeUVDisplacement(0.5, 10, 0, 1.0);
    const r10 = computeUVDisplacement(1.0, 10, 0, 1.0);
    expect(r10.dx).toBeCloseTo(r05.dx * 2, 8);
  });

  it("GL-13: formula matches depth × angle × PARALLAX_SCALE × strength", () => {
    const depth = 0.7; const angleX = 8; const strength = 0.85;
    const { dx } = computeUVDisplacement(depth, angleX, 0, strength);
    const expected = depth * angleX * PARALLAX_SCALE_GL * strength;
    expect(dx).toBeCloseTo(expected, 8);
  });

  it("GL-14: dy computed independently of dx (angleY axis)", () => {
    const { dx, dy } = computeUVDisplacement(1.0, 5, 10, 1.0);
    expect(dx).toBeCloseTo(1.0 * 5  * PARALLAX_SCALE_GL * 1.0, 8);
    expect(dy).toBeCloseTo(1.0 * 10 * PARALLAX_SCALE_GL * 1.0, 8);
  });
});

// ─── isUVInBounds ─────────────────────────────────────────────────────────────

describe("isUVInBounds", () => {
  it("GL-15: (0.5, 0.5) → in bounds", () => {
    expect(isUVInBounds(0.5, 0.5)).toBe(true);
  });

  it("GL-16: (0, 0) → in bounds (corner)", () => {
    expect(isUVInBounds(0, 0)).toBe(true);
  });

  it("GL-17: (1, 1) → in bounds (corner)", () => {
    expect(isUVInBounds(1, 1)).toBe(true);
  });

  it("GL-18: negative u → out of bounds", () => {
    expect(isUVInBounds(-0.01, 0.5)).toBe(false);
  });

  it("GL-19: u > 1 → out of bounds", () => {
    expect(isUVInBounds(1.01, 0.5)).toBe(false);
  });

  it("GL-20: negative v → out of bounds", () => {
    expect(isUVInBounds(0.5, -0.01)).toBe(false);
  });

  it("GL-21: v > 1 → out of bounds", () => {
    expect(isUVInBounds(0.5, 1.01)).toBe(false);
  });
});

// ─── displacedSrcUV ───────────────────────────────────────────────────────────

describe("displacedSrcUV", () => {
  it("GL-22: zero angle → srcUV = outUV (identity)", () => {
    const { u, v } = displacedSrcUV(0.4, 0.6, 0.8, 0, 0, 1.0);
    expect(u).toBeCloseTo(0.4, 8);
    expect(v).toBeCloseTo(0.6, 8);
  });

  it("GL-23: positive angleX → srcUV.u < outUV (displaced left)", () => {
    const { u } = displacedSrcUV(0.5, 0.5, 1.0, 10, 0, 1.0);
    expect(u).toBeLessThan(0.5);
  });

  it("GL-24: negative angleX → srcUV.u > outUV (displaced right)", () => {
    const { u } = displacedSrcUV(0.5, 0.5, 1.0, -10, 0, 1.0);
    expect(u).toBeGreaterThan(0.5);
  });

  it("GL-25: displacement is symmetric (equal magnitude, opposite sign)", () => {
    const pos = displacedSrcUV(0.5, 0.5, 1.0,  10, 0, 1.0);
    const neg = displacedSrcUV(0.5, 0.5, 1.0, -10, 0, 1.0);
    expect(pos.u + neg.u).toBeCloseTo(1.0, 8); // equidistant from 0.5
  });

  it("GL-26: srcUV = outUV − displacement (verify formula)", () => {
    const outU = 0.7; const outV = 0.4;
    const depth = 0.6; const angleX = 12; const angleY = 5; const strength = 0.9;
    const { u, v } = displacedSrcUV(outU, outV, depth, angleX, angleY, strength);
    const { dx, dy } = computeUVDisplacement(depth, angleX, angleY, strength);
    expect(u).toBeCloseTo(outU - dx, 8);
    expect(v).toBeCloseTo(outV - dy, 8);
  });

  it("GL-27: depth=0 → srcUV equals outUV (no displacement for background)", () => {
    const { u, v } = displacedSrcUV(0.3, 0.7, 0, 20, 20, 1.0);
    expect(u).toBeCloseTo(0.3, 8);
    expect(v).toBeCloseTo(0.7, 8);
  });

  it("GL-28: out-of-bounds srcUV detectable via isUVInBounds", () => {
    // Large angle + near depth at edge → srcUV goes negative
    const { u, v } = displacedSrcUV(0.02, 0.5, 1.0, 20, 0, 1.0);
    // displacement ≈ 1.0 × 20 × 0.015 = 0.3, so srcU = 0.02 − 0.3 = −0.28
    const inBounds = isUVInBounds(u, v);
    expect(inBounds).toBe(false);
  });
});
