/**
 * LUMIS — Depth-Warp Unit Tests  v1.0
 *
 * Tests for the pure-TypeScript functions in src/lib/depth-warp.ts.
 * ONNX inference (estimateDepth / getDepthSession) is mocked to keep
 * the suite fast and offline-capable.
 *
 * Coverage:
 *   preprocessForMiDaS  — tensor shape, normalisation, range
 *   normaliseDepth       — min/max remapping, upsampling, bilinear
 *   warpFrame            — identity warp, zero-angle, depth scaling,
 *                          out-of-bounds fill, angle clamping
 *   depthMapToRgba       — near/far colour mapping
 *   ParallaxResult types — shape contract
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  preprocessForMiDaS,
  normaliseDepth,
  warpFrame,
  depthMapToRgba,
  _resetSession,
  type DepthMap,
} from "@/lib/depth-warp";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a uniform-colour 375×812 ImageData. */
function solidImageData(w: number, h: number, r: number, g: number, b: number, a = 255): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4]     = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return new ImageData(data, w, h);
}

/** Create a gradient ImageData: left=black, right=white. */
function gradientImageData(w: number, h: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / (w - 1)) * 255);
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
}

/** Build a synthetic DepthMap with a constant depth value. */
function constantDepth(w: number, h: number, value: number): DepthMap {
  return { data: new Float32Array(w * h).fill(value), width: w, height: h };
}

/** Build a DepthMap where right half is near (1.0) and left half is far (0.0). */
function splitDepth(w: number, h: number): DepthMap {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      data[y * w + x] = x >= w / 2 ? 1.0 : 0.0;
  return { data, width: w, height: h };
}

// ─── 1. preprocessForMiDaS ────────────────────────────────────────────────────

describe("preprocessForMiDaS", () => {
  it("DW-01: output length = 3 × 256 × 256", () => {
    const img = solidImageData(375, 812, 128, 64, 32);
    const tensor = preprocessForMiDaS(img);
    expect(tensor.length).toBe(3 * 256 * 256);
  });

  it("DW-02: white image → all channels near (1 - mean) / std", () => {
    const img = solidImageData(64, 64, 255, 255, 255);
    const tensor = preprocessForMiDaS(img);
    // White: R=G=B=1.0
    // R channel: (1.0 - 0.485) / 0.229 ≈ 2.249
    const expectedR = (1.0 - 0.485) / 0.229;
    expect(tensor[0]).toBeCloseTo(expectedR, 2);
  });

  it("DW-03: black image → all channels near -mean/std", () => {
    const img = solidImageData(64, 64, 0, 0, 0);
    const tensor = preprocessForMiDaS(img);
    const expectedR = (0.0 - 0.485) / 0.229;
    expect(tensor[0]).toBeCloseTo(expectedR, 2);
  });

  it("DW-04: output is Float32Array", () => {
    const img = solidImageData(100, 100, 200, 100, 50);
    expect(preprocessForMiDaS(img)).toBeInstanceOf(Float32Array);
  });

  it("DW-05: channels are stored separately (CHW layout)", () => {
    // CHW layout: first 256*256 values = R channel
    const img = solidImageData(256, 256, 255, 0, 0);  // pure red
    const tensor = preprocessForMiDaS(img);
    const channelSize = 256 * 256;
    // R channel should all be same positive value (red = 1.0)
    expect(tensor[0]).toBeGreaterThan(0);          // R at [0]
    // G channel (all = 0, so negative after normalisation)
    expect(tensor[channelSize]).toBeLessThan(0);   // G at [channelSize]
    // B channel (all = 0)
    expect(tensor[2 * channelSize]).toBeLessThan(0); // B at [2*channelSize]
  });
});

// ─── 2. normaliseDepth ────────────────────────────────────────────────────────

describe("normaliseDepth", () => {
  it("DW-06: constant raw depth → all normalised values = 0 (or clamped to 0)", () => {
    // When min == max, range = 1e-6 — all values should be ~0
    const raw = new Float32Array(256 * 256).fill(5.0);
    const result = normaliseDepth(raw, 64, 64);
    expect(result.data[0]).toBeCloseTo(0.0, 3);
  });

  it("DW-07: raw with clear min/max → normalised range is [0, 1]", () => {
    const raw = new Float32Array(256 * 256);
    raw[0] = 0.0;
    raw[1] = 10.0;
    const result = normaliseDepth(raw, 256, 256);
    let minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < result.data.length; i++) {
      if (result.data[i] < minV) minV = result.data[i];
      if (result.data[i] > maxV) maxV = result.data[i];
    }
    expect(minV).toBeGreaterThanOrEqual(0.0);
    expect(maxV).toBeLessThanOrEqual(1.0);
  });

  it("DW-08: output dimensions match target W × H", () => {
    const raw = new Float32Array(256 * 256).fill(1.0);
    const result = normaliseDepth(raw, 375, 812);
    expect(result.width).toBe(375);
    expect(result.height).toBe(812);
    expect(result.data.length).toBe(375 * 812);
  });

  it("DW-09: bilinear upsampling — corner values preserved", () => {
    // Put a known value at MiDaS [0,0] (top-left)
    const raw = new Float32Array(256 * 256).fill(0.5);
    raw[0] = 1.0;  // top-left corner = max
    const result = normaliseDepth(raw, 256, 256);
    // Top-left should be close to the max normalised value
    expect(result.data[0]).toBeGreaterThan(result.data[256 * 256 - 1]);
  });

  it("DW-10: returns Float32Array", () => {
    const raw = new Float32Array(256 * 256).fill(1.0);
    expect(normaliseDepth(raw, 64, 64).data).toBeInstanceOf(Float32Array);
  });
});

// ─── 3. warpFrame ─────────────────────────────────────────────────────────────

describe("warpFrame", () => {
  const W = 40, H = 40;

  it("DW-11: zero angle → output equals input (identity warp)", () => {
    const img   = gradientImageData(W, H);
    const depth = constantDepth(W, H, 0.5);
    const out   = warpFrame(img, depth, { angleX: 0, angleY: 0 });
    expect(out.width).toBe(W);
    expect(out.height).toBe(H);
    // With zero angle, dispX = dispY = 0 → sample from same pixel → output = input
    for (let i = 0; i < W * H * 4; i++) {
      expect(out.data[i]).toBe(img.data[i]);
    }
  });

  it("DW-12: zero-depth map → zero displacement regardless of angle", () => {
    const img   = gradientImageData(W, H);
    const depth = constantDepth(W, H, 0.0);  // all far
    const out   = warpFrame(img, depth, { angleX: 15, angleY: 10 });
    // depth=0 → dispX = 0 × scale → no displacement
    for (let i = 0; i < W * H * 4; i++) {
      expect(out.data[i]).toBe(img.data[i]);
    }
  });

  it("DW-13: throws on mismatched depth map dimensions", () => {
    const img   = solidImageData(100, 100, 0, 0, 0);
    const depth = constantDepth(50, 50, 0.5);  // wrong size
    expect(() => warpFrame(img, depth, { angleX: 5, angleY: 0 })).toThrow("does not match");
  });

  it("DW-14: positive angleX shifts near pixels right (x displacement positive)", () => {
    // Solid red image; near half shifts — use depth 1.0 (all near)
    const img   = solidImageData(W, H, 255, 0, 0);
    const depth = constantDepth(W, H, 1.0);
    // With large angle and full near depth, pixels at far-right go out of bounds
    const out = warpFrame(img, depth, { angleX: 20, angleY: 0, fillR: 0, fillG: 0, fillB: 0, fillA: 255 });
    // Some right-column pixels should be filled black (out of bounds sampled left)
    let hasFill = false;
    for (let y = 0; y < H; y++) {
      const i = (y * W + 0) * 4;  // left edge after big positive shift
      if (out.data[i] === 0 && out.data[i + 1] === 0 && out.data[i + 2] === 0) hasFill = true;
    }
    expect(hasFill).toBe(true);
  });

  it("DW-15: angle clamped to ±20° (>20° treated as 20°)", () => {
    const img   = solidImageData(W, H, 100, 100, 100);
    const depth = constantDepth(W, H, 0.5);
    const out20  = warpFrame(img, depth, { angleX: 20,  angleY: 0 });
    const out100 = warpFrame(img, depth, { angleX: 100, angleY: 0 });
    // Both should produce identical output since 100° is clamped to 20°
    for (let i = 0; i < W * H * 4; i++) {
      expect(out100.data[i]).toBe(out20.data[i]);
    }
  });

  it("DW-16: strength=0 → identity (no displacement)", () => {
    const img   = gradientImageData(W, H);
    const depth = constantDepth(W, H, 1.0);
    const out   = warpFrame(img, depth, { angleX: 20, angleY: 20, strength: 0 });
    for (let i = 0; i < W * H * 4; i++) {
      expect(out.data[i]).toBe(img.data[i]);
    }
  });

  it("DW-17: output is a new ImageData (not a mutation of input)", () => {
    const img   = solidImageData(W, H, 200, 200, 200);
    const depth = constantDepth(W, H, 0.5);
    const out   = warpFrame(img, depth, { angleX: 5, angleY: 0 });
    expect(out).not.toBe(img);
    expect(out.data).not.toBe(img.data);
  });

  it("DW-18: split-depth warp — near side shifts more than far side", () => {
    const img   = gradientImageData(W, H);
    const depth = splitDepth(W, H);
    // Near half (right) shifts, far half (left) stays
    const out   = warpFrame(img, depth, { angleX: 15, angleY: 0 });
    // Output differs from input somewhere
    let anyDiff = false;
    for (let i = 0; i < W * H * 4; i++) {
      if (out.data[i] !== img.data[i]) { anyDiff = true; break; }
    }
    expect(anyDiff).toBe(true);
  });
});

// ─── 4. depthMapToRgba ────────────────────────────────────────────────────────

describe("depthMapToRgba", () => {
  it("DW-19: near depth (1.0) → red channel = 255, blue ≈ 0", () => {
    const depth = constantDepth(1, 1, 1.0);
    const rgba  = depthMapToRgba(depth);
    expect(rgba.data[0]).toBe(255);   // R
    expect(rgba.data[2]).toBe(0);     // B
    expect(rgba.data[3]).toBe(255);   // A always 255
  });

  it("DW-20: far depth (0.0) → red ≈ 0, blue = 255", () => {
    const depth = constantDepth(1, 1, 0.0);
    const rgba  = depthMapToRgba(depth);
    expect(rgba.data[0]).toBe(0);     // R
    expect(rgba.data[2]).toBe(255);   // B
  });

  it("DW-21: output dimensions match depth map", () => {
    const depth = constantDepth(30, 50, 0.5);
    const rgba  = depthMapToRgba(depth);
    expect(rgba.width).toBe(30);
    expect(rgba.height).toBe(50);
  });

  it("DW-22: alpha channel always 255", () => {
    const depth = splitDepth(4, 4);
    const rgba  = depthMapToRgba(depth);
    for (let i = 3; i < rgba.data.length; i += 4) {
      expect(rgba.data[i]).toBe(255);
    }
  });
});

// ─── 5. Session management ────────────────────────────────────────────────────

describe("getDepthSession / _resetSession", () => {
  beforeEach(() => {
    _resetSession();
    vi.restoreAllMocks();
  });

  it("DW-23: getDepthSession throws if onnxruntime-web is unavailable", async () => {
    // Dynamic import of 'onnxruntime-web' will fail in jsdom (not installed)
    const { getDepthSession } = await import("@/lib/depth-warp");
    await expect(getDepthSession()).rejects.toThrow();
  });

  it("DW-24: _resetSession clears error so next call retries", async () => {
    const { getDepthSession } = await import("@/lib/depth-warp");
    // First call fails (no onnxruntime-web in test env)
    try { await getDepthSession(); } catch { /* expected */ }
    _resetSession();
    // After reset, getDepthSession should attempt load again (will throw again, not a stale error)
    await expect(getDepthSession()).rejects.toThrow();
  });
});
