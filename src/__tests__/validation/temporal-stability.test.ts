/**
 * LUMIS — Temporal Stability Regression Suite  v1.0
 *
 * Tests for jitter measurement, flicker detection, and DEMA smoother
 * convergence — all defined in src/lib/eval-metrics.ts and src/lib/smoothing.ts.
 *
 * Thresholds tested:
 *   JitterPx     ≤ 1.5 px
 *   Flicker      = 0 events in stable sequence
 *   Convergence  ≤ 8 frames
 */

import { describe, it, expect } from "vitest";
import {
  computeJitter,
  detectFlicker,
  convergenceFrame,
  THRESHOLDS,
} from "@/lib/eval-metrics";
import { measureJitter, smoothLandmarkSequence } from "@/lib/video-processor";
import type { LandmarkPoint } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a 21-landmark array with the index DIP and TIP at given positions. */
function makeLandmarks(
  dipX: number, dipY: number,
  tipX: number, tipY: number,
): LandmarkPoint[] {
  const lms: LandmarkPoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  // Index DIP = landmark 7, TIP = landmark 8
  lms[7] = { x: dipX, y: dipY, z: 0 };
  lms[8] = { x: tipX, y: tipY, z: 0 };
  return lms;
}

const CW = 375, CH = 812;

// ─── 1. computeJitter ────────────────────────────────────────────────────────

describe("computeJitter", () => {
  it("TMP-01: stationary anchor → jitter = 0", () => {
    const anchors = Array.from({ length: 10 }, () => ({ x: 100.0, y: 200.0 }));
    expect(computeJitter(anchors)).toBe(0);
  });

  it("TMP-02: empty sequence → jitter = 0", () => {
    expect(computeJitter([])).toBe(0);
  });

  it("TMP-03: single anchor → jitter = 0 (no inter-frame displacement)", () => {
    expect(computeJitter([{ x: 50, y: 50 }])).toBe(0);
  });

  it("TMP-04: 1px inter-frame displacement → jitter = 1.0", () => {
    const anchors = Array.from({ length: 5 }, (_, i) => ({ x: i * 1.0, y: 0.0 }));
    expect(computeJitter(anchors)).toBeCloseTo(1.0, 5);
  });

  it("TMP-05: 2px diagonal displacement → jitter = sqrt(2) ≈ 1.414", () => {
    const anchors = Array.from({ length: 5 }, (_, i) => ({ x: i * 1.0, y: i * 1.0 }));
    expect(computeJitter(anchors)).toBeCloseTo(Math.SQRT2, 3);
  });

  it("TMP-06: null frames excluded from jitter calculation", () => {
    const anchors: Array<{ x: number; y: number } | null> = [
      { x: 0, y: 0 },
      null,
      null,
      { x: 1, y: 0 },  // 1px jump, but only 2 valid frames → jitter=1
    ];
    expect(computeJitter(anchors)).toBeCloseTo(1.0, 5);
  });

  it("TMP-07: jitter below production threshold for 1px natural hand sway", () => {
    // Simulate slight natural hand movement: 0.5px random per frame
    const anchors = Array.from({ length: 30 }, (_, i) => ({
      x: 100 + 0.5 * Math.sin(i * 0.3),
      y: 200 + 0.5 * Math.cos(i * 0.3),
    }));
    const jitter = computeJitter(anchors);
    expect(jitter).toBeLessThan(THRESHOLDS.jitterPx);
  });
});

// ─── 2. measureJitter (video-processor) ──────────────────────────────────────

describe("measureJitter (video-processor)", () => {
  it("TMP-08: stationary landmarks → jitter = 0", () => {
    const lms = makeLandmarks(0.5, 0.6, 0.5, 0.4);
    const sequence = Array.from({ length: 10 }, () => lms);
    expect(measureJitter(sequence, CW, CH)).toBe(0);
  });

  it("TMP-09: null landmark sequence → jitter = 0", () => {
    const sequence: (LandmarkPoint[] | null)[] = [null, null, null];
    expect(measureJitter(sequence, CW, CH)).toBe(0);
  });

  it("TMP-10: single valid frame → jitter = 0", () => {
    const lms = makeLandmarks(0.5, 0.6, 0.5, 0.4);
    expect(measureJitter([lms], CW, CH)).toBe(0);
  });

  it("TMP-11: 1px anchor shift across frames → jitter = 1px", () => {
    // Each frame shifts dipY by 1/CH (= 1 pixel in canvas space)
    const pixelY = 1 / CH;
    const sequence = Array.from({ length: 5 }, (_, i) => {
      const dipY = 0.6 + i * pixelY;
      const tipY = 0.4 + i * pixelY;
      return makeLandmarks(0.5, dipY, 0.5, tipY);
    });
    const jitter = measureJitter(sequence, CW, CH);
    // cuticleT for index (fi=1) = 0.24; anchor = dip + 0.24*(tip-dip)
    // anchor shifts by 1px per frame → jitter ≈ 1.0px
    expect(jitter).toBeCloseTo(1.0, 0);
  });

  it("TMP-12: nulls reset smoother — jitter reported for valid segment only", () => {
    const lms = makeLandmarks(0.5, 0.6, 0.5, 0.4);
    const sequence: (LandmarkPoint[] | null)[] = [lms, null, lms, lms, lms];
    // 3 valid frames at same position → jitter = 0
    expect(measureJitter(sequence, CW, CH)).toBe(0);
  });
});

// ─── 3. detectFlicker ────────────────────────────────────────────────────────

describe("detectFlicker", () => {
  it("TMP-13: stable high-IoU sequence → 0 flicker events", () => {
    const stable = Array.from({ length: 30 }, () => 0.90);
    expect(detectFlicker(stable)).toBe(0);
  });

  it("TMP-14: monotonically decreasing IoU → 0 flicker events (no recovery)", () => {
    const decreasing = Array.from({ length: 20 }, (_, i) => 0.9 - i * 0.02);
    expect(detectFlicker(decreasing)).toBe(0);
  });

  it("TMP-15: single sharp dip with recovery → flicker detected", () => {
    const ious = [
      ...Array(5).fill(0.90),
      0.70,   // sudden drop (0.20 drop)
      0.70,
      0.90,   // recovery
      ...Array(5).fill(0.90),
    ];
    // Should detect at least 1 flicker event
    expect(detectFlicker(ious, 0.08, 5)).toBeGreaterThanOrEqual(1);
  });

  it("TMP-16: oscillating IoU → multiple flicker events", () => {
    const ious = [0.90, 0.70, 0.90, 0.70, 0.90, 0.70, 0.90];
    expect(detectFlicker(ious, 0.08, 2)).toBeGreaterThan(0);
  });

  it("TMP-17: small dip within threshold → 0 flicker (noise floor)", () => {
    // Drop of 0.04 < threshold 0.08
    const ious = [0.90, 0.86, 0.90, 0.90, 0.90];
    expect(detectFlicker(ious, 0.08, 3)).toBe(0);
  });

  it("TMP-18: empty sequence → 0 flicker", () => {
    expect(detectFlicker([])).toBe(0);
  });

  it("TMP-19: single-element sequence → 0 flicker", () => {
    expect(detectFlicker([0.9])).toBe(0);
  });
});

// ─── 4. convergenceFrame ─────────────────────────────────────────────────────

describe("convergenceFrame", () => {
  it("TMP-20: immediately above threshold → converges at frame 0", () => {
    const ious = Array.from({ length: 10 }, () => 0.90);
    expect(convergenceFrame(ious, 0.82, 3)).toBe(0);
  });

  it("TMP-21: converges at frame 5 after warm-up", () => {
    const ious = [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.88, 0.90, 0.91, 0.92];
    // First frame ≥ 0.82 and stays there for ≥ 3 frames: frame index 5
    expect(convergenceFrame(ious, 0.82, 3)).toBe(5);
  });

  it("TMP-22: never converges → returns sequence length", () => {
    const ious = Array.from({ length: 10 }, () => 0.70);  // always below 0.82
    expect(convergenceFrame(ious, 0.82, 3)).toBe(10);
  });

  it("TMP-23: converges then drops — still reports first convergence frame", () => {
    const ious = [0.50, 0.85, 0.86, 0.87, 0.60, 0.60];  // drops at frame 4
    // Frames 1,2,3 all ≥ 0.82 for 3 consecutive → convergence at frame 1
    expect(convergenceFrame(ious, 0.82, 3)).toBe(1);
  });

  it("TMP-24: convergence within 8 frames (production SLA)", () => {
    // Simulate typical ramp-up: MediaPipe settles within 8 frames
    const ious = [0.40, 0.55, 0.68, 0.76, 0.82, 0.84, 0.86, 0.88, 0.90, 0.91];
    const frame = convergenceFrame(ious, 0.82, 3);
    expect(frame).toBeLessThanOrEqual(8);
  });

  it("TMP-25: empty sequence → returns 0 (sequence length)", () => {
    expect(convergenceFrame([], 0.82, 3)).toBe(0);
  });
});

// ─── 5. smoothLandmarkSequence ────────────────────────────────────────────────

describe("smoothLandmarkSequence — DEMA convergence", () => {
  it("TMP-26: null-only sequence → all nulls out", () => {
    const result = smoothLandmarkSequence([null, null, null]);
    expect(result).toEqual([null, null, null]);
  });

  it("TMP-27: stationary landmarks → smoothed output near original", () => {
    const lms = makeLandmarks(0.5, 0.6, 0.5, 0.4);
    const sequence = Array.from({ length: 10 }, () => lms);
    const smoothed = smoothLandmarkSequence(sequence);
    const valid = smoothed.filter((s) => s !== null);
    expect(valid).toHaveLength(10);
    // After convergence, index DIP should be near the original position
    const last = valid[valid.length - 1]!;
    expect(last[7].x).toBeCloseTo(0.5, 2);
    expect(last[7].y).toBeCloseTo(0.6, 2);
  });

  it("TMP-28: null mid-sequence resets smoother", () => {
    const lms = makeLandmarks(0.5, 0.6, 0.5, 0.4);
    const sequence: (LandmarkPoint[] | null)[] = [lms, lms, null, lms, lms];
    const smoothed = smoothLandmarkSequence(sequence);
    expect(smoothed[2]).toBeNull();
    expect(smoothed[3]).not.toBeNull();
    expect(smoothed[4]).not.toBeNull();
  });

  it("TMP-29: smoothed sequence has same length as input", () => {
    const lms = makeLandmarks(0.5, 0.6, 0.5, 0.4);
    const n = 20;
    const sequence = Array.from({ length: n }, () => lms);
    expect(smoothLandmarkSequence(sequence)).toHaveLength(n);
  });

  it("TMP-30: DEMA attenuates a 10px sudden jump within 5 frames", () => {
    // Simulate sudden jump: first 5 frames at DIP.y=0.5, then jumps to 0.5+10/CH
    const jumpY = 10 / CH;
    const preLms  = makeLandmarks(0.5, 0.5, 0.5, 0.3);
    const postLms = makeLandmarks(0.5, 0.5 + jumpY, 0.5, 0.3 + jumpY);

    const sequence: (LandmarkPoint[] | null)[] = [
      ...Array(5).fill(preLms),
      ...Array(5).fill(postLms),
    ];
    const smoothed = smoothLandmarkSequence(sequence);

    // Frame 5 (first post-jump): smoothed DIP.y should be < full jump
    const frameAfterJump = smoothed[5];
    expect(frameAfterJump).not.toBeNull();
    const dipY = frameAfterJump![7].y;
    // Should be between pre and post positions (attenuation)
    expect(dipY).toBeGreaterThan(0.5);
    expect(dipY).toBeLessThan(0.5 + jumpY);  // not instantly at full jump
  });
});
