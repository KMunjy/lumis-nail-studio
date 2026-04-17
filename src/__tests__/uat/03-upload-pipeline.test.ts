/**
 * 03-upload-pipeline.test.ts
 * Section C: Upload Pipeline — 5,000 upload scenarios.
 * Tests success rate per format (JPEG/PNG/HEIC), per network (5G/4G/3G/offline), file sizes.
 * Reports with Wilson CI.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  welfordInit,
  welfordUpdate,
  welfordFinalize,
  wilsonCI,
  formatCI,
  percentile,
} from "./statistical-utils";
import { generateUserSessions, makeRNG } from "./synthetic-data-gen";
import { simulateUpload } from "./simulate-cv-pipeline";
import { uatResults } from "./results-store";

const N = 5_000;
const CHUNK = 500;

// ─── Accumulators ─────────────────────────────────────────────────────────────

const formatSuccesses: Record<string, number> = { jpeg: 0, png: 0, heic: 0 };
const formatTotals: Record<string, number> = { jpeg: 0, png: 0, heic: 0 };

// Online-only format tracking (excludes offline sessions)
const formatOnlineSuccesses: Record<string, number> = { jpeg: 0, png: 0, heic: 0 };
const formatOnlineTotals: Record<string, number> = { jpeg: 0, png: 0, heic: 0 };

const networkSuccesses: Record<string, number> = { "5g": 0, "4g": 0, "3g": 0, offline: 0 };
const networkTotals: Record<string, number> = { "5g": 0, "4g": 0, "3g": 0, offline: 0 };

let latencyState = welfordInit();
let onlineLatencyState = welfordInit(); // excludes offline
let totalSuccesses = 0;

const latencySample: number[] = [];
const onlineLatencySample: number[] = [];
const SAMPLE_CAP = 1000;

beforeAll(() => {
  const rng = makeRNG(42);

  for (const chunk of generateUserSessions(N, CHUNK)) {
    for (const session of chunk) {
      const result = simulateUpload(session, rng);

      formatTotals[result.format] = (formatTotals[result.format] ?? 0) + 1;
      networkTotals[session.network] = (networkTotals[session.network] ?? 0) + 1;

      if (result.success) {
        formatSuccesses[result.format] = (formatSuccesses[result.format] ?? 0) + 1;
        networkSuccesses[session.network] = (networkSuccesses[session.network] ?? 0) + 1;
        totalSuccesses++;
      }

      // Track online-only stats (offline sessions are expected to fail by design)
      if (session.network !== "offline") {
        formatOnlineTotals[result.format] = (formatOnlineTotals[result.format] ?? 0) + 1;
        if (result.success) {
          formatOnlineSuccesses[result.format] = (formatOnlineSuccesses[result.format] ?? 0) + 1;
        }
        onlineLatencyState = welfordUpdate(onlineLatencyState, result.latencyMs);
        if (onlineLatencySample.length < SAMPLE_CAP) onlineLatencySample.push(result.latencyMs);
      }

      latencyState = welfordUpdate(latencyState, result.latencyMs);
      if (latencySample.length < SAMPLE_CAP) latencySample.push(result.latencyMs);
    }
    // chunk released by GC after loop body
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Section C: Upload Pipeline (n=5,000)", () => {
  describe("C1: Overall upload success", () => {
    it("overall success rate > 65% (includes offline sessions which always fail)", () => {
      // ~25% of sessions are offline (0% success by design), pulling overall rate down
      const rate = totalSuccesses / N;
      expect(rate).toBeGreaterThan(0.65);
    });

    it("Wilson CI lower bound > 63%", () => {
      const { lower } = wilsonCI(totalSuccesses, N);
      expect(lower).toBeGreaterThan(0.63);
    });

    it("online-only success rate > 90%", () => {
      const onlineTotal = Object.values(formatOnlineTotals).reduce((s, v) => s + v, 0);
      const onlineSuccess = Object.values(formatOnlineSuccesses).reduce((s, v) => s + v, 0);
      const rate = onlineSuccess / Math.max(1, onlineTotal);
      expect(rate).toBeGreaterThan(0.90);
    });
  });

  describe("C2: Success rate by format (online sessions only)", () => {
    it("JPEG online success rate > 95%", () => {
      const rate = (formatOnlineSuccesses["jpeg"] ?? 0) / Math.max(1, formatOnlineTotals["jpeg"]);
      expect(rate).toBeGreaterThan(0.95);
    });

    it("PNG online success rate > 95%", () => {
      const rate = (formatOnlineSuccesses["png"] ?? 0) / Math.max(1, formatOnlineTotals["png"]);
      expect(rate).toBeGreaterThan(0.95);
    });

    it("HEIC online success rate > 90% (slightly lower due to conversion)", () => {
      const rate = (formatOnlineSuccesses["heic"] ?? 0) / Math.max(1, formatOnlineTotals["heic"]);
      expect(rate).toBeGreaterThan(0.90);
    });
  });

  describe("C3: Success rate by network", () => {
    it("5G success rate > 99%", () => {
      const rate = (networkSuccesses["5g"] ?? 0) / Math.max(1, networkTotals["5g"]);
      expect(rate).toBeGreaterThan(0.99);
    });

    it("4G success rate > 97%", () => {
      const rate = (networkSuccesses["4g"] ?? 0) / Math.max(1, networkTotals["4g"]);
      expect(rate).toBeGreaterThan(0.97);
    });

    it("3G success rate > 88%", () => {
      const rate = (networkSuccesses["3g"] ?? 0) / Math.max(1, networkTotals["3g"]);
      expect(rate).toBeGreaterThan(0.88);
    });

    it("offline success rate = 0%", () => {
      const rate = (networkSuccesses["offline"] ?? 0) / Math.max(1, networkTotals["offline"]);
      expect(rate).toBeLessThan(0.01);
    });
  });

  describe("C4: Latency", () => {
    it("online mean latency < 1500ms", () => {
      const { mean } = welfordFinalize(onlineLatencyState);
      expect(mean).toBeLessThan(1500);
    });

    it("overall mean latency < 5000ms (offline sessions included)", () => {
      const { mean } = welfordFinalize(latencyState);
      expect(mean).toBeLessThan(5000);
    });

    it("online p95 latency < 3000ms", () => {
      if (onlineLatencySample.length < 10) return;
      const sorted = [...onlineLatencySample].sort((a, b) => a - b);
      const p95 = percentile(sorted, 95);
      expect(p95).toBeLessThan(3000);
    });
  });

  describe("C5: Report store", () => {
    it("stores Section C results", () => {
      const successCI = wilsonCI(totalSuccesses, N);
      const jpegCI = wilsonCI(formatSuccesses["jpeg"] ?? 0, Math.max(1, formatTotals["jpeg"]));
      const heicCI = wilsonCI(formatSuccesses["heic"] ?? 0, Math.max(1, formatTotals["heic"]));

      uatResults.add({
        section: "C: Upload Pipeline",
        n: N,
        pass: totalSuccesses / N > 0.80,
        metrics: {
          "overall.success": +((totalSuccesses / N) * 100).toFixed(1) + "%",
          "overall.ci": formatCI(successCI.lower, successCI.upper),
          "jpeg.success": +((formatSuccesses["jpeg"] / Math.max(1, formatTotals["jpeg"])) * 100).toFixed(1) + "%",
          "jpeg.ci": formatCI(jpegCI.lower, jpegCI.upper),
          "heic.success": +((formatSuccesses["heic"] / Math.max(1, formatTotals["heic"])) * 100).toFixed(1) + "%",
          "heic.ci": formatCI(heicCI.lower, heicCI.upper),
          "5g.success": +((networkSuccesses["5g"] / Math.max(1, networkTotals["5g"])) * 100).toFixed(1) + "%",
          "3g.success": +((networkSuccesses["3g"] / Math.max(1, networkTotals["3g"])) * 100).toFixed(1) + "%",
          "latency.mean": +welfordFinalize(latencyState).mean.toFixed(0) + "ms",
        },
        issues: [],
        recommendations: ["Implement retry logic for 3G uploads", "Add HEIC pre-validation to reduce silent failures"],
      });

      expect(uatResults.getAll().some(r => r.section === "C: Upload Pipeline")).toBe(true);
    });
  });
});
