/**
 * LUMIS — Loyalty System  v1.0
 *
 * Client-side loyalty tier logic plus Supabase helper functions.
 *
 * Points economy
 * ──────────────
 *   TRY_ON_SESSION  +10   — ≥5 s of active dorsal-hand tracking
 *   ADD_TO_CART     +50   — product added to shopping bag
 *   PURCHASE        +100  — order confirmed
 *   SHARE_LOOK      +20   — capture shared on any platform
 *   REFERRAL_SIGNUP +150  — new user signs up via a referral link
 *   REDEMPTION      −(n)  — redemption deducted from balance
 *
 * Tier thresholds (lifetime points; never decrease on spend)
 * ──────────────────────────────────────────────────────────
 *   Bronze    0 – 199
 *   Silver  200 – 499
 *   Gold    500 – 999
 *   Platinum  1 000+
 *
 * Supabase calls use security-definer RPC functions (award_loyalty_points,
 * get_loyalty_summary) so no client-side admin key is needed.
 *
 * All Supabase calls gracefully warn and return null when the client is not
 * configured (NEXT_PUBLIC_SUPABASE_URL not set) — keeps the app functional
 * in development without a live database.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";

export type LoyaltyEventType =
  | "try_on_session"
  | "add_to_cart"
  | "purchase"
  | "share_look"
  | "referral_signup"
  | "redemption";

export interface TierDefinition {
  name:      LoyaltyTier;
  /** Minimum lifetime points required to reach this tier. */
  minPts:    number;
  /** hex colour for badge / progress bar */
  color:     string;
  /** tagline shown in the UI */
  tagline:   string;
  benefits:  string[];
}

export interface LoyaltySummary {
  balance:     number;   // spendable points
  lifetimePts: number;   // never decrements
  tier:        LoyaltyTier;
}

export interface LoyaltyEvent {
  id:          string;
  eventType:   LoyaltyEventType;
  pointsDelta: number;
  createdAt:   string; // ISO
  metadata:    Record<string, unknown>;
}

// ─── Tier definitions ────────────────────────────────────────────────────────

export const TIERS: TierDefinition[] = [
  {
    name:     "Bronze",
    minPts:   0,
    color:    "#CD7F32",
    tagline:  "Welcome to LUMIS",
    benefits: [
      "Early access to new shade launches",
      "Exclusive shade try-on previews",
    ],
  },
  {
    name:     "Silver",
    minPts:   200,
    color:    "#A8A8B8",
    tagline:  "Your style is taking shape",
    benefits: [
      "5% off every order",
      "Priority in-app support",
      "Monthly shade mood-board",
    ],
  },
  {
    name:     "Gold",
    minPts:   500,
    color:    "#E8BA20",
    tagline:  "A true LUMIS devotee",
    benefits: [
      "10% off every order",
      "Free standard shipping",
      "Exclusive designer look previews",
      "Double points on new launches",
    ],
  },
  {
    name:     "Platinum",
    minPts:   1000,
    color:    "#C8C8E8",
    tagline:  "The pinnacle of nail art",
    benefits: [
      "15% off every order",
      "Free expedited shipping",
      "VIP access to designer drops",
      "Personal shade consultation",
      "Triple points always",
    ],
  },
];

// ─── Point event amounts ──────────────────────────────────────────────────────

export const POINT_EVENTS = {
  TRY_ON_SESSION:  10,
  ADD_TO_CART:     50,
  PURCHASE:        100,
  SHARE_LOOK:      20,
  REFERRAL_SIGNUP: 150,
} as const satisfies Record<string, number>;

// ─── Pure tier computation (testable without DB) ─────────────────────────────

/**
 * Return the TierDefinition for a given lifetime point total.
 * Always returns a valid tier — minimum is Bronze.
 */
export function getTierForPoints(lifetimePts: number): TierDefinition {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (lifetimePts >= TIERS[i].minPts) return TIERS[i];
  }
  return TIERS[0]; // Bronze fallback
}

/**
 * Return the next tier definition, or null if already Platinum.
 */
export function getNextTier(lifetimePts: number): TierDefinition | null {
  const current = getTierForPoints(lifetimePts);
  const idx     = TIERS.findIndex((t) => t.name === current.name);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

/**
 * Points remaining until the next tier, or null if already Platinum.
 */
export function getPointsToNextTier(lifetimePts: number): number | null {
  const next = getNextTier(lifetimePts);
  return next ? Math.max(0, next.minPts - lifetimePts) : null;
}

/**
 * Progress percentage [0–100] towards the next tier.
 * Returns 100 for Platinum (already at max).
 */
export function getProgressPercent(lifetimePts: number): number {
  const current = getTierForPoints(lifetimePts);
  const next    = getNextTier(lifetimePts);
  if (!next) return 100;

  const base  = current.minPts;
  const span  = next.minPts - base;
  const done  = lifetimePts - base;
  return Math.min(100, Math.round((done / span) * 100));
}

/**
 * Human-readable label for a point count (e.g. "1,234 pts").
 */
export function formatPoints(pts: number): string {
  return `${pts.toLocaleString()} pts`;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

/** Whether Supabase is configured in this environment. */
function isSupabaseConfigured(): boolean {
  return Boolean(
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Award loyalty points to a user via the `award_loyalty_points` Supabase RPC.
 * Fire-and-forget safe — logs a warning and returns null if DB unavailable.
 *
 * @param userId   Supabase auth user UUID.
 * @param amount   Points to award (positive) or deduct (negative for redemptions).
 * @param event    Event type for the audit log.
 * @param metadata Optional metadata (e.g. productId, orderId).
 * @returns New balance after the award, or null on failure.
 */
export async function awardPoints(
  userId:   string,
  amount:   number,
  event:    LoyaltyEventType,
  metadata: Record<string, unknown> = {},
): Promise<number | null> {
  if (!isSupabaseConfigured()) {
    console.warn("[loyalty] Supabase not configured — skipping point award.");
    return null;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase.rpc("award_loyalty_points", {
      p_user_id:    userId,
      p_amount:     amount,
      p_event_type: event,
      p_metadata:   metadata,
    });

    if (error) {
      console.warn("[loyalty] award_loyalty_points error:", error.message);
      return null;
    }

    return data as number;
  } catch (err) {
    console.warn("[loyalty] Failed to award points:", err);
    return null;
  }
}

/**
 * Fetch a user's current loyalty summary (balance, lifetime pts, tier).
 * Returns null if not configured or the user has no loyalty row yet.
 */
export async function getLoyaltySummary(userId: string): Promise<LoyaltySummary | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
      .from("loyalty_points")
      .select("balance, lifetime_pts, tier")
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    return {
      balance:     data.balance     as number,
      lifetimePts: data.lifetime_pts as number,
      tier:        data.tier         as LoyaltyTier,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the 10 most-recent loyalty events for a user.
 */
export async function getLoyaltyEvents(userId: string): Promise<LoyaltyEvent[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
      .from("loyalty_events")
      .select("id, event_type, points_delta, created_at, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return (data as Array<{
      id: string;
      event_type: string;
      points_delta: number;
      created_at: string;
      metadata: Record<string, unknown>;
    }>).map((row) => ({
      id:          row.id,
      eventType:   row.event_type   as LoyaltyEventType,
      pointsDelta: row.points_delta,
      createdAt:   row.created_at,
      metadata:    row.metadata ?? {},
    }));
  } catch {
    return [];
  }
}

// ─── Event-type display helpers ───────────────────────────────────────────────

export const EVENT_LABELS: Record<LoyaltyEventType, string> = {
  try_on_session:  "Try-On Session",
  add_to_cart:     "Added to Bag",
  purchase:        "Purchase",
  share_look:      "Shared a Look",
  referral_signup: "Referral Sign-Up",
  redemption:      "Points Redeemed",
};

export const EVENT_ICONS: Record<LoyaltyEventType, string> = {
  try_on_session:  "👁",
  add_to_cart:     "🛍",
  purchase:        "✓",
  share_look:      "↗",
  referral_signup: "★",
  redemption:      "−",
};
