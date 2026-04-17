/**
 * Unit + integration tests for src/store/region-context.tsx
 *
 * Coverage targets:
 *  - RegionProvider: initial state defaults to DEFAULT_REGION ("US")
 *  - RegionProvider: reads persisted region from localStorage on mount
 *  - RegionProvider: auto-detects region via detectRegion() when nothing stored
 *  - RegionProvider: setRegionCode updates state and persists to localStorage
 *  - RegionProvider: formatPrice wraps formatPriceUtil with active regionCode
 *  - useRegion: throws when called outside a RegionProvider
 *
 * detectRegion is mocked to avoid real network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { RegionProvider, useRegion } from "@/store/region-context";

// ─── Mock detectRegion to avoid fetch ─────────────────────────────────────────

vi.mock("@/lib/regions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/regions")>();
  return {
    ...actual,
    detectRegion: vi.fn().mockResolvedValue("ZA"),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "lumis_region_v1";

function wrapper({ children }: { children: ReactNode }) {
  return <RegionProvider>{children}</RegionProvider>;
}

// ─── RegionProvider: initial state ───────────────────────────────────────────

describe("RegionProvider — initial state", () => {
  it("defaults to US when localStorage is empty and detectRegion is pending", () => {
    // Before the useEffect fires, state is DEFAULT_REGION = "US"
    const { result } = renderHook(() => useRegion(), { wrapper });
    expect(result.current.regionCode).toBe("US");
  });

  it("reads stored region from localStorage on mount", async () => {
    localStorage.setItem(STORAGE_KEY, "GB");
    const { result } = renderHook(() => useRegion(), { wrapper });

    await waitFor(() => {
      expect(result.current.regionCode).toBe("GB");
    });
  });

  it("auto-detects region when nothing is stored", async () => {
    // localStorage is cleared between tests (setup.ts beforeEach)
    const { result } = renderHook(() => useRegion(), { wrapper });

    // Wait for the detectRegion() mock (returns "ZA") to resolve
    await waitFor(() => {
      expect(result.current.regionCode).toBe("ZA");
    });
  });
});

// ─── RegionProvider: setRegionCode ───────────────────────────────────────────

describe("RegionProvider — setRegionCode", () => {
  it("updates regionCode in context", async () => {
    const { result } = renderHook(() => useRegion(), { wrapper });

    act(() => {
      result.current.setRegionCode("EU");
    });

    expect(result.current.regionCode).toBe("EU");
  });

  it("persists selected region to localStorage", async () => {
    const { result } = renderHook(() => useRegion(), { wrapper });

    act(() => {
      result.current.setRegionCode("GB");
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("GB");
  });

  it("updates region from one code to another", async () => {
    localStorage.setItem(STORAGE_KEY, "GB");
    const { result } = renderHook(() => useRegion(), { wrapper });

    await waitFor(() => expect(result.current.regionCode).toBe("GB"));

    act(() => {
      result.current.setRegionCode("ZA");
    });

    expect(result.current.regionCode).toBe("ZA");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("ZA");
  });
});

// ─── RegionProvider: formatPrice ─────────────────────────────────────────────

describe("RegionProvider — formatPrice", () => {
  it("formats price in USD when region is US", () => {
    const { result } = renderHook(() => useRegion(), { wrapper });
    // Default or set to US
    act(() => { result.current.setRegionCode("US"); });
    expect(result.current.formatPrice(40)).toBe("$40");
  });

  it("formats price in GBP when region is GB", () => {
    const { result } = renderHook(() => useRegion(), { wrapper });
    act(() => { result.current.setRegionCode("GB"); });
    // 100 USD * 0.79 = 79 GBP
    expect(result.current.formatPrice(100)).toBe("£79");
  });

  it("formats price in ZAR when region is ZA", () => {
    const { result } = renderHook(() => useRegion(), { wrapper });
    act(() => { result.current.setRegionCode("ZA"); });
    // 10 USD * 18.5 = 185 ZAR
    expect(result.current.formatPrice(10)).toBe("R185");
  });

  it("formats price in EUR when region is EU", () => {
    const { result } = renderHook(() => useRegion(), { wrapper });
    act(() => { result.current.setRegionCode("EU"); });
    // 50 USD * 0.92 = 46 EUR
    expect(result.current.formatPrice(50)).toBe("€46");
  });
});

// ─── useRegion: outside provider ─────────────────────────────────────────────

describe("useRegion — outside provider", () => {
  it("throws when called without RegionProvider", () => {
    // renderHook without wrapper — no provider
    expect(() => {
      renderHook(() => useRegion());
    }).toThrow("useRegion must be used within a RegionProvider");
  });
});
