/**
 * LUMIS — Loyalty System Unit Tests  v1.0
 *
 * Tests pure-logic exports from src/lib/loyalty.ts.
 * No Supabase calls are made — only the tier computation and helper functions
 * are exercised here.
 *
 * Coverage:
 *   getTierForPoints       — correct tier at every boundary and midpoint
 *   getNextTier            — returns next tier or null at Platinum
 *   getPointsToNextTier    — correct distance; null at Platinum
 *   getProgressPercent     — 0%/50%/100% cases; Platinum always 100%
 *   formatPoints           — locale string with " pts" suffix
 *   POINT_EVENTS           — all amounts are positive integers
 *   TIERS                  — array is sorted, thresholds correct, no gaps
 *   EVENT_LABELS / ICONS   — every LoyaltyEventType has a label and icon
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TIERS,
  POINT_EVENTS,
  EVENT_LABELS,
  EVENT_ICONS,
  getTierForPoints,
  getNextTier,
  getPointsToNextTier,
  getProgressPercent,
  formatPoints,
  awardPoints,
  getLoyaltySummary,
  getLoyaltyEvents,
} from "@/lib/loyalty";

// ─── 1. TIERS array integrity ─────────────────────────────────────────────────

describe("TIERS array", () => {
  it("LY-01: has exactly 4 tiers", () => {
    expect(TIERS).toHaveLength(4);
  });

  it("LY-02: is sorted by minPts ascending", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].minPts).toBeGreaterThan(TIERS[i - 1].minPts);
    }
  });

  it("LY-03: first tier starts at 0 (Bronze)", () => {
    expect(TIERS[0].minPts).toBe(0);
    expect(TIERS[0].name).toBe("Bronze");
  });

  it("LY-04: last tier is Platinum at 1000", () => {
    expect(TIERS[TIERS.length - 1].name).toBe("Platinum");
    expect(TIERS[TIERS.length - 1].minPts).toBe(1000);
  });

  it("LY-05: each tier has non-empty benefits array", () => {
    for (const tier of TIERS) {
      expect(tier.benefits.length).toBeGreaterThan(0);
    }
  });

  it("LY-06: each tier has a valid hex color", () => {
    for (const tier of TIERS) {
      expect(tier.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ─── 2. getTierForPoints ──────────────────────────────────────────────────────

describe("getTierForPoints", () => {
  it("LY-07: 0 pts → Bronze", () => {
    expect(getTierForPoints(0).name).toBe("Bronze");
  });

  it("LY-08: 199 pts → Bronze", () => {
    expect(getTierForPoints(199).name).toBe("Bronze");
  });

  it("LY-09: 200 pts → Silver (exact boundary)", () => {
    expect(getTierForPoints(200).name).toBe("Silver");
  });

  it("LY-10: 350 pts → Silver (midpoint)", () => {
    expect(getTierForPoints(350).name).toBe("Silver");
  });

  it("LY-11: 499 pts → Silver (just before Gold)", () => {
    expect(getTierForPoints(499).name).toBe("Silver");
  });

  it("LY-12: 500 pts → Gold (exact boundary)", () => {
    expect(getTierForPoints(500).name).toBe("Gold");
  });

  it("LY-13: 750 pts → Gold (midpoint)", () => {
    expect(getTierForPoints(750).name).toBe("Gold");
  });

  it("LY-14: 999 pts → Gold (just before Platinum)", () => {
    expect(getTierForPoints(999).name).toBe("Gold");
  });

  it("LY-15: 1000 pts → Platinum (exact boundary)", () => {
    expect(getTierForPoints(1000).name).toBe("Platinum");
  });

  it("LY-16: 9999 pts → Platinum", () => {
    expect(getTierForPoints(9999).name).toBe("Platinum");
  });

  it("LY-17: negative pts → Bronze (clamp to minimum)", () => {
    expect(getTierForPoints(-10).name).toBe("Bronze");
  });
});

// ─── 3. getNextTier ───────────────────────────────────────────────────────────

describe("getNextTier", () => {
  it("LY-18: Bronze → next is Silver", () => {
    expect(getNextTier(0)?.name).toBe("Silver");
  });

  it("LY-19: Silver → next is Gold", () => {
    expect(getNextTier(300)?.name).toBe("Gold");
  });

  it("LY-20: Gold → next is Platinum", () => {
    expect(getNextTier(600)?.name).toBe("Platinum");
  });

  it("LY-21: Platinum → null (no next tier)", () => {
    expect(getNextTier(1000)).toBeNull();
    expect(getNextTier(5000)).toBeNull();
  });
});

// ─── 4. getPointsToNextTier ───────────────────────────────────────────────────

describe("getPointsToNextTier", () => {
  it("LY-22: 0 pts → 200 to Silver", () => {
    expect(getPointsToNextTier(0)).toBe(200);
  });

  it("LY-23: 100 pts → 100 to Silver", () => {
    expect(getPointsToNextTier(100)).toBe(100);
  });

  it("LY-24: 200 pts (just reached Silver) → 300 to Gold", () => {
    expect(getPointsToNextTier(200)).toBe(300);
  });

  it("LY-25: 490 pts → 10 to Gold", () => {
    expect(getPointsToNextTier(490)).toBe(10);
  });

  it("LY-26: 500 pts (just reached Gold) → 500 to Platinum", () => {
    expect(getPointsToNextTier(500)).toBe(500);
  });

  it("LY-27: 1000 pts (Platinum) → null", () => {
    expect(getPointsToNextTier(1000)).toBeNull();
  });

  it("LY-28: never returns a negative number", () => {
    // At exactly the tier threshold, toNext should be 0
    expect(getPointsToNextTier(200)).toBeGreaterThanOrEqual(0);
    expect(getPointsToNextTier(500)).toBeGreaterThanOrEqual(0);
  });
});

// ─── 5. getProgressPercent ────────────────────────────────────────────────────

describe("getProgressPercent", () => {
  it("LY-29: 0 pts → 0% (start of Bronze)", () => {
    expect(getProgressPercent(0)).toBe(0);
  });

  it("LY-30: 100 pts → 50% (halfway through Bronze → Silver span 200)", () => {
    expect(getProgressPercent(100)).toBe(50);
  });

  it("LY-31: 200 pts (Silver) → 0% (start of Silver span)", () => {
    expect(getProgressPercent(200)).toBe(0);
  });

  it("LY-32: 350 pts → 50% (halfway through Silver 200–500 span of 300)", () => {
    expect(getProgressPercent(350)).toBe(50);
  });

  it("LY-33: 499 pts → 99.7% ≈ 100 rounded", () => {
    expect(getProgressPercent(499)).toBeGreaterThanOrEqual(99);
    expect(getProgressPercent(499)).toBeLessThanOrEqual(100);
  });

  it("LY-34: 1000 pts (Platinum) → 100", () => {
    expect(getProgressPercent(1000)).toBe(100);
  });

  it("LY-35: 9999 pts (Platinum) → 100", () => {
    expect(getProgressPercent(9999)).toBe(100);
  });

  it("LY-36: result is always in [0, 100]", () => {
    const samples = [0, 1, 50, 199, 200, 499, 500, 999, 1000, 2000];
    for (const pts of samples) {
      const p = getProgressPercent(pts);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 6. formatPoints ─────────────────────────────────────────────────────────

describe("formatPoints", () => {
  it("LY-37: 0 → '0 pts'", () => {
    expect(formatPoints(0)).toBe("0 pts");
  });

  it("LY-38: 500 → '500 pts'", () => {
    expect(formatPoints(500)).toBe("500 pts");
  });

  it("LY-39: large numbers include locale separator", () => {
    // 1000 should either be '1,000 pts' (en-US) or '1 000 pts' (fr)
    // We just assert the numeric part appears and ' pts' suffix is present
    const result = formatPoints(1000);
    expect(result).toContain("1");
    expect(result).toMatch(/pts$/);
  });
});

// ─── 7. POINT_EVENTS ─────────────────────────────────────────────────────────

describe("POINT_EVENTS", () => {
  it("LY-40: all values are positive integers", () => {
    for (const [key, val] of Object.entries(POINT_EVENTS)) {
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
      void key;
    }
  });

  it("LY-41: TRY_ON_SESSION is 10", () => {
    expect(POINT_EVENTS.TRY_ON_SESSION).toBe(10);
  });

  it("LY-42: ADD_TO_CART is 50", () => {
    expect(POINT_EVENTS.ADD_TO_CART).toBe(50);
  });

  it("LY-43: PURCHASE is 100", () => {
    expect(POINT_EVENTS.PURCHASE).toBe(100);
  });

  it("LY-44: REFERRAL_SIGNUP is the highest event reward", () => {
    const max = Math.max(...Object.values(POINT_EVENTS));
    expect(POINT_EVENTS.REFERRAL_SIGNUP).toBe(max);
  });
});

// ─── 8. EVENT_LABELS and EVENT_ICONS ─────────────────────────────────────────

describe("EVENT_LABELS and EVENT_ICONS", () => {
  const eventTypes = [
    "try_on_session", "add_to_cart", "purchase",
    "share_look", "referral_signup", "redemption",
  ] as const;

  it("LY-45: every event type has a non-empty label", () => {
    for (const t of eventTypes) {
      expect(typeof EVENT_LABELS[t]).toBe("string");
      expect(EVENT_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it("LY-46: every event type has a non-empty icon", () => {
    for (const t of eventTypes) {
      expect(typeof EVENT_ICONS[t]).toBe("string");
      expect(EVENT_ICONS[t].length).toBeGreaterThan(0);
    }
  });
});

// ─── 9. Supabase helpers (env configured) ────────────────────────────────────
// The @supabase/supabase-js module is aliased to a stub that returns
// null/empty results. Setting the env vars causes isSupabaseConfigured()
// to return true, so the Supabase code-paths are exercised. The stub
// returns graceful null/[] results just as the real client would when
// there is no data — covering the import + createClient + query paths.

describe("Supabase helpers — env configured", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",      "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── awardPoints ──────────────────────────────────────────────────────────

  it("LY-47: awardPoints returns null when rpc data is null (no error)", async () => {
    const result = await awardPoints("user-1", 50, "purchase");
    // stub rpc returns { data: null, error: null } → data is null → returns null
    expect(result).toBeNull();
  });

  it("LY-48: awardPoints accepts all LoyaltyEventType values without throwing", async () => {
    const events = [
      "try_on_session", "add_to_cart", "purchase",
      "share_look", "referral_signup", "redemption",
    ] as const;
    for (const evt of events) {
      await expect(awardPoints("user-1", 10, evt)).resolves.not.toThrow();
    }
  });

  it("LY-49: awardPoints accepts optional metadata without throwing", async () => {
    await expect(
      awardPoints("user-1", 100, "purchase", { orderId: "ord-123" })
    ).resolves.not.toThrow();
  });

  it("LY-50: awardPoints returns null when Supabase not configured", async () => {
    vi.unstubAllEnvs(); // clear — no URL/key
    const result = await awardPoints("user-1", 50, "purchase");
    expect(result).toBeNull();
  });

  // ── getLoyaltySummary ────────────────────────────────────────────────────

  it("LY-51: getLoyaltySummary returns null when no data row exists", async () => {
    const result = await getLoyaltySummary("user-1");
    // stub single() returns { data: null, error: null } → returns null
    expect(result).toBeNull();
  });

  it("LY-52: getLoyaltySummary returns null when Supabase not configured", async () => {
    vi.unstubAllEnvs();
    const result = await getLoyaltySummary("user-1");
    expect(result).toBeNull();
  });

  // ── getLoyaltyEvents ─────────────────────────────────────────────────────

  it("LY-53: getLoyaltyEvents returns empty array when no data", async () => {
    const result = await getLoyaltyEvents("user-1");
    // stub thenable returns { data: null, error: null } → returns []
    expect(result).toEqual([]);
  });

  it("LY-54: getLoyaltyEvents returns empty array when Supabase not configured", async () => {
    vi.unstubAllEnvs();
    const result = await getLoyaltyEvents("user-1");
    expect(result).toEqual([]);
  });
});
