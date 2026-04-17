"use client";

/**
 * RegionContext — stores the user's chosen region for currency display
 * and shipping threshold copy throughout the LUMIS storefront.
 *
 * Priority order (highest → lowest):
 *   1. User's explicit selection, persisted to localStorage
 *   2. IP-geolocation via detectRegion() on first visit
 *   3. DEFAULT_REGION ('US')
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  DEFAULT_REGION,
  detectRegion,
  formatPrice as formatPriceUtil,
  type RegionCode,
} from "@/lib/regions";

// ─── Context shape ────────────────────────────────────────────────────────────

interface RegionContextValue {
  regionCode: RegionCode;
  setRegionCode: (code: RegionCode) => void;
  /** Convenience wrapper: formats a USD price for the active region */
  formatPrice: (priceUSD: number) => string;
}

const RegionContext = createContext<RegionContextValue | null>(null);

const STORAGE_KEY = "lumis_region_v1";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RegionProvider({ children }: { children: ReactNode }) {
  const [regionCode, setRegionCodeState] = useState<RegionCode>(DEFAULT_REGION);

  // On mount: read persisted preference, or auto-detect if absent
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as RegionCode | null;

    if (stored && ["GB", "US", "ZA", "EU"].includes(stored)) {
      setRegionCodeState(stored);
    } else {
      // No stored preference — detect from IP in background
      detectRegion().then((detected) => {
        setRegionCodeState(detected);
        // Do NOT persist auto-detected value so the user can still change it
        // and we re-detect on next fresh visit.
      });
    }
  }, []);

  const setRegionCode = useCallback((code: RegionCode) => {
    setRegionCodeState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Private mode or storage full — ignore
    }
  }, []);

  const formatPrice = useCallback(
    (priceUSD: number) => formatPriceUtil(priceUSD, regionCode),
    [regionCode]
  );

  return (
    <RegionContext.Provider value={{ regionCode, setRegionCode, formatPrice }}>
      {children}
    </RegionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRegion(): RegionContextValue {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    throw new Error("useRegion must be used within a RegionProvider");
  }
  return ctx;
}
