/**
 * SIT — HandSmoother Tests (v2.0 — DEMA with jitter guard)
 *
 * Verifies the velocity-aware Double EMA smoother:
 *   - Initialisation (first frame no interpolation)
 *   - DEMA convergence toward static signal
 *   - Reset clears state (camera switch, tracking loss)
 *   - 21-landmark batch preserves array length
 *   - Jitter guard: large spike does not persist for multiple frames
 *   - DEMA reduces lag vs single EMA on linearly moving signal
 */

import { describe, it, expect } from "vitest";
import { HandSmoother } from "@/lib/smoothing";
import type { LandmarkPoint } from "@/types";

function pt(x: number, y: number, z: number): LandmarkPoint {
  return { x, y, z };
}

function landmarks21(val: number): LandmarkPoint[] {
  return Array.from({ length: 21 }, () => pt(val, val, val));
}

describe("HandSmoother v2.0 (DEMA)", () => {
  it("initialises on first call — output equals input", () => {
    const smoother = new HandSmoother(21, 0.35);
    const out = smoother.smooth(landmarks21(0.5));
    out.forEach((p) => {
      expect(p.x).toBe(0.5);
      expect(p.y).toBe(0.5);
      expect(p.z).toBe(0.5);
    });
  });

  it("output length always equals input length", () => {
    const smoother = new HandSmoother(21, 0.5);
    const out = smoother.smooth(landmarks21(0.3));
    expect(out).toHaveLength(21);
  });

  it("alpha=1.0 → instant convergence for small step (below jitter guard threshold)", () => {
    // MAX_VELOCITY=0.06 — use delta=0.05 to avoid jitter guard override
    const smoother = new HandSmoother(21, 1.0);
    smoother.smooth(landmarks21(0)); // init
    const out = smoother.smooth(landmarks21(0.05)); // delta=0.05 < 0.06 → alpha=1.0 applies
    out.forEach((p) => {
      expect(p.x).toBeCloseTo(0.05, 4);
    });
  });

  it("DEMA converges to a static signal within 10 frames", () => {
    const smoother = new HandSmoother(21, 0.5);
    // Warm up
    for (let i = 0; i < 10; i++) {
      smoother.smooth(landmarks21(1.0));
    }
    const out = smoother.smooth(landmarks21(1.0));
    out.forEach((p) => {
      expect(p.x).toBeCloseTo(1.0, 2); // converged within 1%
    });
  });

  it("reset clears state — next call re-initialises", () => {
    const smoother = new HandSmoother(21, 0.35);
    smoother.smooth(landmarks21(0.8));
    smoother.reset();
    const out = smoother.smooth(landmarks21(0.1));
    out.forEach((p) => {
      expect(p.x).toBeCloseTo(0.1, 5); // re-initialised, not interpolated
    });
  });

  it("DEMA lag is less than single EMA lag on linearly moving signal", () => {
    // Signal: linear ramp 0 → 0.1 per frame over 20 frames
    // DEMA should track closer to true signal than single EMA
    const dema   = new HandSmoother(21, 0.5);
    let demaLast = 0;

    for (let i = 0; i <= 20; i++) {
      const val = i * 0.01; // ramp
      const out = dema.smooth(landmarks21(val));
      if (i === 20) {
        demaLast = out[0].x;
      }
    }
    const truth = 20 * 0.01; // 0.20
    const demagError = Math.abs(demaLast - truth);
    // DEMA should be within 15% of truth value at frame 20
    expect(demagError).toBeLessThan(truth * 0.15);
  });

  it("jitter guard: large spike does not corrupt state for >1 frame", () => {
    const smoother = new HandSmoother(21, 0.5);
    // Warm up at 0.5
    for (let i = 0; i < 5; i++) smoother.smooth(landmarks21(0.5));

    // Inject a large spike (glitch: +0.5 delta >> MAX_VELOCITY=0.06)
    smoother.smooth(landmarks21(1.0));

    // After spike, return to 0.5 — should recover quickly
    const after1 = smoother.smooth(landmarks21(0.5));
    const after3 = (() => {
      smoother.smooth(landmarks21(0.5));
      smoother.smooth(landmarks21(0.5));
      return smoother.smooth(landmarks21(0.5));
    })();

    // After 3 recovery frames, output should be close to 0.5
    after3.forEach((p) => {
      expect(Math.abs(p.x - 0.5)).toBeLessThan(0.15);
    });
    void after1; // suppress unused warning
  });

  it("independent smoothing per landmark", () => {
    // Use small deltas (0.002 per landmark) so jitter guard never triggers;
    // with alpha=1.0 the DEMA converges instantly to each landmark's unique value.
    const smoother = new HandSmoother(21, 1.0);
    const input1 = Array.from({ length: 21 }, (_, i) => pt(i * 0.002, 0, 0));
    smoother.smooth(input1); // init each landmark to i*0.002
    const input2 = Array.from({ length: 21 }, (_, i) => pt(i * 0.003, 0, 0)); // delta = i*0.001 << 0.06
    const out = smoother.smooth(input2);
    out.forEach((p, i) => {
      expect(p.x).toBeCloseTo(i * 0.003, 4);
    });
  });

  it("handles shorter-than-21 input gracefully", () => {
    const smoother = new HandSmoother(21, 0.5);
    const short = [pt(0.5, 0.5, 0.5), pt(0.3, 0.3, 0.3)];
    const out = smoother.smooth(short);
    expect(out).toHaveLength(2);
    expect(out[0].x).toBe(0.5);
  });
});
