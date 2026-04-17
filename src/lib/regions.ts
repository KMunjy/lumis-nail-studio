/**
 * regions.ts — LUMIS region / currency configuration
 *
 * All prices in the product catalogue are stored in USD.
 * This module provides the conversion rates, formatting, and
 * shipping threshold copy for each supported region.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegionCode = "GB" | "US" | "ZA" | "EU";

export interface Region {
  code: RegionCode;
  label: string;
  flag: string;
  currency: string;
  symbol: string;
  /** Multiplier relative to USD base (USD = 1.0) */
  rate: number;
  /** Threshold (in local currency) above which shipping is free */
  freeShippingThreshold: number;
  freeShippingLabel: string;
}

// ─── Region data ──────────────────────────────────────────────────────────────

export const REGIONS: Region[] = [
  {
    code: "GB",
    label: "United Kingdom",
    flag: "🇬🇧",
    currency: "GBP",
    symbol: "£",
    rate: 0.79,
    freeShippingThreshold: 50,
    freeShippingLabel: "Free UK delivery over £50",
  },
  {
    code: "US",
    label: "United States",
    flag: "🇺🇸",
    currency: "USD",
    symbol: "$",
    rate: 1.0,
    freeShippingThreshold: 60,
    freeShippingLabel: "Free US shipping over $60",
  },
  {
    code: "ZA",
    label: "South Africa",
    flag: "🇿🇦",
    currency: "ZAR",
    symbol: "R",
    rate: 18.5,
    freeShippingThreshold: 900,
    freeShippingLabel: "Free SA delivery over R900",
  },
  {
    code: "EU",
    label: "Europe",
    flag: "🇪🇺",
    currency: "EUR",
    symbol: "€",
    rate: 0.92,
    freeShippingThreshold: 55,
    freeShippingLabel: "Free EU delivery over €55",
  },
];

export const DEFAULT_REGION: RegionCode = "US";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Look up a Region by code. Falls back to the US region if not found. */
export function getRegion(code: string): Region {
  return REGIONS.find((r) => r.code === code) ?? REGIONS.find((r) => r.code === "US")!;
}

/**
 * Format a USD price into the display string for the given region.
 * Examples: formatPrice(40, 'GB') → "£32"
 *           formatPrice(40, 'ZA') → "R740"
 */
export function formatPrice(priceUSD: number, regionCode: string): string {
  const region = getRegion(regionCode);
  const converted = Math.round(priceUSD * region.rate);
  return `${region.symbol}${converted}`;
}

// ─── EU country codes ─────────────────────────────────────────────────────────

const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

/**
 * Attempt to detect the user's region via IP geolocation.
 * Falls back to DEFAULT_REGION ('US') on any error or timeout.
 */
export async function detectRegion(): Promise<RegionCode> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return DEFAULT_REGION;

    const data = (await res.json()) as { country_code?: string };
    const cc = data.country_code ?? "";

    if (cc === "GB") return "GB";
    if (cc === "US") return "US";
    if (cc === "ZA") return "ZA";
    if (EU_COUNTRY_CODES.has(cc)) return "EU";

    return DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION;
  }
}
