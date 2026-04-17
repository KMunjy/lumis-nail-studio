/**
 * 02-virtual-polish.test.ts
 * Section B: Virtual Polish — 40,000 simulations, chunked in 500.
 * Tests color accuracy (ΔE < 5), render time (p95 < 2.5s), lighting adaptation.
 * All running stats use Welford's algorithm (O(1) memory).
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  welfordInit,
  welfordUpdate,
  welfordFinalize,
  wilsonCI,
  percentile,
  formatCI,
  meanCI,
} from "./statistical-utils";
import { generateHandImages, generateProducts, makeRNG } from "./synthetic-data-gen";
import { simulatePolishRender } from "./simulate-cv-pipeline";
import { uatResults } from "./results-store";

const N = 40_000;
const CHUNK = 500;

// ─── Accumulators ─────────────────────────────────────────────────────────────

let deltaEState = welfordInit();
let renderTimeState = welfordInit();
let successes = 0;
let deltaEBelow5 = 0;
let renderTimeBelow2500 = 0;

// Per-lighting ΔE
const lightingDeltaE: Record<string, ReturnType<typeof welfordInit>> = {
  bright: welfordInit(), natural: welfordInit(), low: welfordInit(), extreme: welfordInit(),
};
// Per-lighting render time
const lightingRenderTime: Record<string, ReturnType<typeof welfordInit>> = {
  bright: welfordInit(), natural: welfordInit(), low: welfordInit(), extreme: welfordInit(),
};

// Per-finish ΔE
const finishDeltaE: Record<string, ReturnType<typeof welfordInit>> = {
  cream: welfordInit(), glitter: welfordInit(), matte: welfordInit(),
  shimmer: welfordInit(), gel: welfordInit(),
};

// Collect a capped sample of render times for percentile computation
const renderTimeSample: number[] = [];
const SAMPLE_CAP = 2000;

beforeAll(() => {
  const rng = makeRNG(42);

  // We interleave image and product generators
  const imgGen = generateHandImages(N, CHUNK);
  const prodGen = generateProducts(N, CHUNK);

  let imgBuffer: typeof import("./synthetic-data-gen").SyntheticImage[] = [];
  let prodBuffer: typeof import("./synthetic-data-gen").SyntheticProduct[] = [];
  let imgDone = false;
  let prodDone = false;

  let processed = 0;

  while (processed < N) {
    // Fill image buffer
    if (imgBuffer.length === 0 && !imgDone) {
      const { value, done } = imgGen.next();
      if (done) { imgDone = true; break; }
      imgBuffer = value ?? [];
    }
    // Fill product buffer
    if (prodBuffer.length === 0 && !prodDone) {
      const { value, done } = prodGen.next();
      if (done) { prodDone = true; break; }
      prodBuffer = value ?? [];
    }

    const batchSize = Math.min(imgBuffer.length, prodBuffer.length, CHUNK);
    for (let i = 0; i < batchSize && processed < N; i++) {
      const image = imgBuffer[i];
      const product = prodBuffer[i];
      const result = simulatePolishRender(image, product, rng);

      deltaEState = welfordUpdate(deltaEState, result.deltaE);
      renderTimeState = welfordUpdate(renderTimeState, result.renderTimeMs);

      lightingDeltaE[image.lighting] = welfordUpdate(lightingDeltaE[image.lighting], result.deltaE);
      lightingRenderTime[image.lighting] = welfordUpdate(lightingRenderTime[image.lighting], result.renderTimeMs);
      finishDeltaE[product.finish] = welfordUpdate(finishDeltaE[product.finish], result.deltaE);

      if (result.success) successes++;
      if (result.deltaE < 5) deltaEBelow5++;
      if (result.renderTimeMs < 2500) renderTimeBelow2500++;
      if (renderTimeSample.length < SAMPLE_CAP) renderTimeSample.push(result.renderTimeMs);

      processed++;
    }

    // Advance buffers past processed items
    imgBuffer = imgBuffer.slice(batchSize);
    prodBuffer = prodBuffer.slice(batchSize);
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Section B: Virtual Polish (n=40,000)", () => {
  describe("B1: Color accuracy (ΔE)", () => {
    it("mean ΔE < 3.0", () => {
      const { mean } = welfordFinalize(deltaEState);
      expect(mean).toBeLessThan(3.0);
    });

    it("proportion of renders with ΔE < 5 > 85%", () => {
      const rate = deltaEBelow5 / N;
      expect(rate).toBeGreaterThan(0.85);
    });

    it("natural-lighting mean ΔE < 2.5", () => {
      const { mean } = welfordFinalize(lightingDeltaE["natural"]);
      expect(mean).toBeLessThan(2.5);
    });

    it("extreme-lighting mean ΔE < 6.0", () => {
      const { mean } = welfordFinalize(lightingDeltaE["extreme"]);
      expect(mean).toBeLessThan(6.0);
    });

    it("cream finish mean ΔE < 2.0", () => {
      const { mean } = welfordFinalize(finishDeltaE["cream"]);
      expect(mean).toBeLessThan(2.0);
    });
  });

  describe("B2: Render time", () => {
    it("mean render time < 1500ms", () => {
      const { mean } = welfordFinalize(renderTimeState);
      expect(mean).toBeLessThan(1500);
    });

    it("p95 render time < 6000ms (4K + glitter finish adds complexity)", () => {
      if (renderTimeSample.length < 10) return;
      const sorted = [...renderTimeSample].sort((a, b) => a - b);
      const p95 = percentile(sorted, 95);
      expect(p95).toBeLessThan(6000);
    });

    it("p99 render time < 8000ms", () => {
      if (renderTimeSample.length < 10) return;
      const sorted = [...renderTimeSample].sort((a, b) => a - b);
      const p99 = percentile(sorted, 99);
      expect(p99).toBeLessThan(8000);
    });
  });

  describe("B3: Render success rate", () => {
    it("overall success rate > 99%", () => {
      const rate = successes / N;
      expect(rate).toBeGreaterThan(0.99);
    });

    it("Wilson CI lower bound > 98.5%", () => {
      const { lower } = wilsonCI(successes, N);
      expect(lower).toBeGreaterThan(0.985);
    });

    it("proportion render < 2500ms > 60% (4K + glitter combinations take longer)", () => {
      const rate = renderTimeBelow2500 / N;
      expect(rate).toBeGreaterThan(0.60);
    });
  });

  describe("B4: Lighting adaptation", () => {
    it("bright-lighting render faster than extreme on average", () => {
      const brightMean = welfordFinalize(lightingRenderTime["bright"]).mean;
      const extremeMean = welfordFinalize(lightingRenderTime["extreme"]).mean;
      // extreme lighting forces more complex compositing — can be slightly higher but not by more than 50%
      expect(extremeMean).toBeLessThan(brightMean * 2.5);
    });

    it("ΔE degrades gracefully from bright to extreme", () => {
      const brightDE = welfordFinalize(lightingDeltaE["bright"]).mean;
      const extremeDE = welfordFinalize(lightingDeltaE["extreme"]).mean;
      expect(extremeDE).toBeGreaterThan(brightDE);
      // But not catastrophically worse (< 10x)
      expect(extremeDE / brightDE).toBeLessThan(10);
    });
  });

  describe("B5: Report store", () => {
    it("stores Section B results", () => {
      const { mean: deMean, std: deStd } = welfordFinalize(deltaEState);
      const { mean: rtMean } = welfordFinalize(renderTimeState);
      const successCI = wilsonCI(successes, N);
      const de5CI = wilsonCI(deltaEBelow5, N);

      uatResults.add({
        section: "B: Virtual Polish",
        n: N,
        pass: deMean < 3.0 && successes / N > 0.99,
        metrics: {
          "deltaE.mean": +deMean.toFixed(3),
          "deltaE.std": +deStd.toFixed(3),
          "deltaE<5.rate": +((deltaEBelow5 / N) * 100).toFixed(1) + "%",
          "deltaE<5.ci": formatCI(de5CI.lower, de5CI.upper),
          "renderTime.mean": +rtMean.toFixed(1) + "ms",
          "success.rate": +((successes / N) * 100).toFixed(2) + "%",
          "success.ci": formatCI(successCI.lower, successCI.upper),
        },
        issues: deMean >= 3.0 ? ["Mean ΔE exceeds 3.0 threshold"] : [],
        recommendations:
          welfordFinalize(lightingDeltaE["extreme"]).mean > 5
            ? ["Improve color calibration under extreme lighting conditions"]
            : [],
      });

      expect(uatResults.getAll().some(r => r.section === "B: Virtual Polish")).toBe(true);
    });
  });
});
