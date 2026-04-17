/**
 * Unit tests for src/lib/regions.ts
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  REGIONS,
  DEFAULT_REGION,
  getRegion,
  formatPrice,
  detectRegion,
} from "@/lib/regions";
import type { RegionCode } from "@/lib/regions";

// ─── REGIONS constant ─────────────────────────────────────────────────────────

describe("REGIONS", () => {
  it("exports 4 regions", () => {
    expect(REGIONS).toHaveLength(4);
  });

  it("includes GB, US, ZA, EU", () => {
    const codes = REGIONS.map(r => r.code) as RegionCode[];
    expect(codes).toContain("GB");
    expect(codes).toContain("US");
    expect(codes).toContain("ZA");
    expect(codes).toContain("EU");
  });

  it("every region has required fields", () => {
    for (const r of REGIONS) {
      expect(r.code).toBeTruthy();
      expect(r.label).toBeTruthy();
      expect(r.currency).toBeTruthy();
      expect(r.symbol).toBeTruthy();
      expect(typeof r.rate).toBe("number");
      expect(r.rate).toBeGreaterThan(0);
      expect(r.freeShippingThreshold).toBeGreaterThan(0);
      expect(r.freeShippingLabel).toBeTruthy();
    }
  });

  it("US region has rate 1.0", () => {
    const us = REGIONS.find(r => r.code === "US");
    expect(us?.rate).toBe(1.0);
  });

  it("DEFAULT_REGION is US", () => {
    expect(DEFAULT_REGION).toBe("US");
  });
});

// ─── getRegion ────────────────────────────────────────────────────────────────

describe("getRegion", () => {
  it("returns GB region for 'GB'", () => {
    expect(getRegion("GB").code).toBe("GB");
  });

  it("returns US region for 'US'", () => {
    expect(getRegion("US").code).toBe("US");
  });

  it("returns ZA region for 'ZA'", () => {
    expect(getRegion("ZA").code).toBe("ZA");
  });

  it("returns EU region for 'EU'", () => {
    expect(getRegion("EU").code).toBe("EU");
  });

  it("falls back to US for unknown code", () => {
    expect(getRegion("XX").code).toBe("US");
    expect(getRegion("").code).toBe("US");
    expect(getRegion("AU").code).toBe("US");
  });
});

// ─── formatPrice ──────────────────────────────────────────────────────────────

describe("formatPrice", () => {
  it("returns USD price with $ symbol for US", () => {
    expect(formatPrice(40, "US")).toBe("$40");
  });

  it("converts USD to GBP using rate 0.79", () => {
    expect(formatPrice(100, "GB")).toBe("£79");
  });

  it("converts USD to ZAR using rate 18.5", () => {
    expect(formatPrice(10, "ZA")).toBe("R185");
  });

  it("converts USD to EUR using rate 0.92", () => {
    expect(formatPrice(50, "EU")).toBe("€46");
  });

  it("rounds to nearest integer", () => {
    // $1 at 0.79 = 0.79 → rounds to 1
    expect(formatPrice(1, "GB")).toBe("£1");
  });

  it("falls back to US for unknown region code", () => {
    expect(formatPrice(25, "AU")).toBe("$25");
  });

  it("handles zero price", () => {
    expect(formatPrice(0, "US")).toBe("$0");
  });

  it("handles large prices", () => {
    expect(formatPrice(1000, "US")).toBe("$1000");
  });
});

// ─── detectRegion ─────────────────────────────────────────────────────────────

/** Build a minimal fetch stub that returns the given country_code */
function makeFetchStub(countryCode: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve({ country_code: countryCode }),
  });
}

describe("detectRegion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Remove any global fetch stub we installed
    if ("fetch" in globalThis && typeof (globalThis as Record<string, unknown>).fetch === "function") {
      vi.unstubAllGlobals();
    }
  });

  it("returns 'GB' for GB country code", async () => {
    vi.stubGlobal("fetch", makeFetchStub("GB"));
    expect(await detectRegion()).toBe("GB");
  });

  it("returns 'US' for US country code", async () => {
    vi.stubGlobal("fetch", makeFetchStub("US"));
    expect(await detectRegion()).toBe("US");
  });

  it("returns 'ZA' for ZA country code", async () => {
    vi.stubGlobal("fetch", makeFetchStub("ZA"));
    expect(await detectRegion()).toBe("ZA");
  });

  it("returns 'EU' for a recognised EU country code (DE)", async () => {
    vi.stubGlobal("fetch", makeFetchStub("DE"));
    expect(await detectRegion()).toBe("EU");
  });

  it("returns 'EU' for another EU code (FR)", async () => {
    vi.stubGlobal("fetch", makeFetchStub("FR"));
    expect(await detectRegion()).toBe("EU");
  });

  it("returns DEFAULT_REGION for unknown country code", async () => {
    vi.stubGlobal("fetch", makeFetchStub("XX"));
    expect(await detectRegion()).toBe(DEFAULT_REGION);
  });

  it("returns DEFAULT_REGION when response is not ok", async () => {
    vi.stubGlobal("fetch", makeFetchStub("GB", false));
    expect(await detectRegion()).toBe(DEFAULT_REGION);
  });

  it("returns DEFAULT_REGION when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    expect(await detectRegion()).toBe(DEFAULT_REGION);
  });

  it("returns DEFAULT_REGION when country_code is absent in response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}), // no country_code field
    }));
    expect(await detectRegion()).toBe(DEFAULT_REGION);
  });
});
