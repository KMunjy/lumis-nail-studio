/**
 * kill-switch.ts — Feature flag and kill-switch system for LUMIS.
 *
 * Kill-switches allow the platform to disable AI/CV features globally without
 * a code deployment — critical for incident response.
 *
 * In production: flags are read from public.platform_flags in Supabase.
 * Fallback: all features enabled (fail-open for UX) — except when explicitly
 * set via NEXT_PUBLIC_KILL_* env vars (fail-closed for critical incidents).
 *
 * Env var overrides (take precedence over DB — useful for emergency shutdowns):
 *   NEXT_PUBLIC_KILL_TRY_ON=true    → disables all try-on features
 *   NEXT_PUBLIC_KILL_CAMERA=true    → disables camera specifically
 *   NEXT_PUBLIC_KILL_MARKETPLACE=true → disables marketplace
 *
 * Usage (client component):
 *   const { isTryOnEnabled } = useFeatureFlags();
 *   if (!isTryOnEnabled) return <FeatureDisabledBanner />;
 *
 * Usage (server / API route):
 *   const enabled = await isFeatureEnabled("try_on_camera");
 *   if (!enabled) return NextResponse.json({ error: "Feature disabled" }, { status: 503 });
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeatureKey =
  | "try_on_camera"
  | "try_on_photo"
  | "try_on_video"
  | "marketplace"
  | "creator_upload"
  | "ad_token"
  | "depth_parallax";

export interface FeatureFlags {
  try_on_camera:   boolean;
  try_on_photo:    boolean;
  try_on_video:    boolean;
  marketplace:     boolean;
  creator_upload:  boolean;
  ad_token:        boolean;
  depth_parallax:  boolean;
}

// ── Env var kill-switches (checked first — emergency override) ────────────────

function envKillSwitch(key: string): boolean | null {
  if (typeof process === "undefined") return null;
  const val = process.env[`NEXT_PUBLIC_KILL_${key.toUpperCase()}`];
  if (val === "true")  return false; // killed
  if (val === "false") return true;  // forced on
  return null; // not set — defer to DB
}

// ── Default flags (fail-open for UX — DB query not available client-side) ─────

const DEFAULTS: FeatureFlags = {
  try_on_camera:  true,
  try_on_photo:   true,
  try_on_video:   true,
  marketplace:    true,
  creator_upload: true,
  ad_token:       true,
  depth_parallax: true,
};

// ── Client-side: in-memory cache (refreshed on mount) ────────────────────────

let _cachedFlags: FeatureFlags | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

/**
 * Fetch feature flags from the /api/flags endpoint (client-side).
 * Returns cached values if fresh. Falls back to defaults on error.
 */
export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  // Check env overrides first
  const fromEnv = buildFromEnv();
  if (fromEnv) return fromEnv;

  const now = Date.now();
  if (_cachedFlags && now < _cacheExpiry) return _cachedFlags;

  try {
    const res = await fetch("/api/flags", { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = await res.json() as { data: FeatureFlags };
    _cachedFlags = data;
    _cacheExpiry = now + CACHE_TTL_MS;
    return data;
  } catch (err) {
    console.warn("[kill-switch] Failed to fetch flags, using defaults:", err);
    return { ...DEFAULTS };
  }
}

/**
 * Invalidate the client-side flag cache (e.g. after admin changes a flag).
 */
export function invalidateFlagCache(): void {
  _cachedFlags = null;
  _cacheExpiry = 0;
}

// ── Server-side: check a single flag against Supabase ────────────────────────

/**
 * Check whether a feature is enabled. For use in API routes and server components.
 * Checks env override first, then queries Supabase platform_flags table.
 */
export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  // Env override wins
  const envResult = envKillSwitch(key);
  if (envResult !== null) return envResult;

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return DEFAULTS[key];

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("platform_flags")
      .select("enabled")
      .eq("key", key)
      .single();

    if (error || !data) return DEFAULTS[key];
    return data.enabled as boolean;
  } catch {
    return DEFAULTS[key]; // fail-open on DB error
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFromEnv(): FeatureFlags | null {
  const killTryOn      = process.env.NEXT_PUBLIC_KILL_TRY_ON === "true";
  const killCamera     = process.env.NEXT_PUBLIC_KILL_CAMERA === "true";
  const killMarketplace = process.env.NEXT_PUBLIC_KILL_MARKETPLACE === "true";

  if (!killTryOn && !killCamera && !killMarketplace) return null;

  return {
    try_on_camera:  !killTryOn && !killCamera,
    try_on_photo:   !killTryOn,
    try_on_video:   !killTryOn,
    marketplace:    !killMarketplace,
    creator_upload: !killMarketplace,
    ad_token:       true,
    depth_parallax: !killTryOn,
  };
}
