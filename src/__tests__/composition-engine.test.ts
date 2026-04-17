/**
 * Unit tests for src/lib/composition-engine.ts
 *
 * Coverage targets:
 *  - COMPOSITION_CONFIGS: exports 12 named styles with correct structure
 *  - CompositionStyle type values: all 12 listed
 *  - generateMiniPreviews: returns 3 previews with correct style labels
 *  - generateCompositions: returns 12 compositions matching CONFIGS
 *  - isDark helper (via COMPOSITION_CONFIGS metadata)
 *
 * Canvas drawing is mocked via setup.ts (HTMLCanvasElement.getContext stub).
 * loadImage is mocked to avoid actual network/DOM image loading.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  COMPOSITION_CONFIGS,
  generateMiniPreviews,
  generateCompositions,
} from "@/lib/composition-engine";
import type { CompositionStyle } from "@/lib/composition-engine";
import type { Product } from "@/data/products";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_PRODUCT: Product = {
  id:          "test-product",
  name:        "Test Red",
  designer:    "LUMIS Test",
  price:       24.99,
  color:       "#FF0000",
  topColor:    "#FF0000",
  midColor:    "#CC0000",
  bottomColor: "#880000",
  shape:       "Almond",
  finish:      "Gloss",
  description: "Test shade",
  length:      "Medium",
};

const FAKE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

// ─── Mock loadImage (private — triggered by generateCompositions/generateMiniPreviews) ─

// We override the global Image constructor so that setting img.src immediately fires onload.
function setupImageMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Image = class MockImage {
    width  = 100;
    height = 100;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_v: string) {
      // Trigger onload asynchronously
      Promise.resolve().then(() => { this.onload?.(); });
    }
    get src() { return ""; }
  };
}

beforeEach(() => {
  // canvasToBlob mock: immediately call callback with a fake Blob
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
    cb(new Blob(["fake"], { type: "image/jpeg" }));
  });
  // toDataURL mock
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,FAKE");
});

// ─── COMPOSITION_CONFIGS ──────────────────────────────────────────────────────

describe("COMPOSITION_CONFIGS", () => {
  const EXPECTED_STYLES: CompositionStyle[] = [
    "clean", "marble", "botanical", "dark", "luxury", "blush",
    "neon",  "linen",  "glitter",   "cement", "sage", "holographic",
  ];

  it("exports exactly 12 configs", () => {
    expect(COMPOSITION_CONFIGS).toHaveLength(12);
  });

  it("includes all 12 composition styles", () => {
    const styles = COMPOSITION_CONFIGS.map(c => c.style);
    for (const expected of EXPECTED_STYLES) {
      expect(styles).toContain(expected);
    }
  });

  it("every config has a non-empty label", () => {
    for (const cfg of COMPOSITION_CONFIGS) {
      expect(cfg.label).toBeTruthy();
      expect(typeof cfg.label).toBe("string");
    }
  });

  it("every config has a valid style value", () => {
    const valid = new Set<CompositionStyle>(EXPECTED_STYLES);
    for (const cfg of COMPOSITION_CONFIGS) {
      expect(valid.has(cfg.style)).toBe(true);
    }
  });

  it("styles are unique (no duplicates)", () => {
    const styles = COMPOSITION_CONFIGS.map(c => c.style);
    expect(new Set(styles).size).toBe(styles.length);
  });
});

// ─── generateMiniPreviews ─────────────────────────────────────────────────────

describe("generateMiniPreviews", () => {
  beforeEach(setupImageMock);

  it("returns exactly 3 mini previews", async () => {
    const results = await generateMiniPreviews(FAKE_DATA_URL, FAKE_PRODUCT);
    expect(results).toHaveLength(3);
  });

  it("returns clean, marble, dark in that order", async () => {
    const results = await generateMiniPreviews(FAKE_DATA_URL, FAKE_PRODUCT);
    expect(results[0].style).toBe("clean");
    expect(results[1].style).toBe("marble");
    expect(results[2].style).toBe("dark");
  });

  it("returns correct labels for each style", async () => {
    const results = await generateMiniPreviews(FAKE_DATA_URL, FAKE_PRODUCT);
    expect(results[0].label).toBe("Studio");
    expect(results[1].label).toBe("Marble");
    expect(results[2].label).toBe("Dark");
  });

  it("each result has a dataUrl string", async () => {
    const results = await generateMiniPreviews(FAKE_DATA_URL, FAKE_PRODUCT);
    for (const r of results) {
      expect(typeof r.dataUrl).toBe("string");
      expect(r.dataUrl.length).toBeGreaterThan(0);
    }
  });
});

// ─── generateCompositions ─────────────────────────────────────────────────────

describe("generateCompositions", () => {
  beforeEach(setupImageMock);

  it("returns 12 compositions by default (high quality)", async () => {
    const results = await generateCompositions(FAKE_DATA_URL, FAKE_PRODUCT);
    expect(results).toHaveLength(12);
  });

  it("returns 12 compositions with standard quality", async () => {
    const results = await generateCompositions(FAKE_DATA_URL, FAKE_PRODUCT, "standard");
    expect(results).toHaveLength(12);
  });

  it("returns 12 compositions with lite quality", async () => {
    const results = await generateCompositions(FAKE_DATA_URL, FAKE_PRODUCT, "lite");
    expect(results).toHaveLength(12);
  });

  it("each composition has style, label, dataUrl, and blob", async () => {
    const results = await generateCompositions(FAKE_DATA_URL, FAKE_PRODUCT, "lite");
    for (const r of results) {
      expect(typeof r.style).toBe("string");
      expect(typeof r.label).toBe("string");
      expect(typeof r.dataUrl).toBe("string");
      expect(r.blob).toBeInstanceOf(Blob);
    }
  });

  it("composition styles match COMPOSITION_CONFIGS order", async () => {
    const results = await generateCompositions(FAKE_DATA_URL, FAKE_PRODUCT, "lite");
    const resultStyles = results.map(r => r.style);
    const configStyles = COMPOSITION_CONFIGS.map(c => c.style);
    expect(resultStyles).toEqual(configStyles);
  });

  it("includes optional skinToneHex without error", async () => {
    await expect(
      generateCompositions(FAKE_DATA_URL, FAKE_PRODUCT, "lite", "#B57A5C")
    ).resolves.toHaveLength(12);
  });
});
