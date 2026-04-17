/**
 * GET /api/flags
 *
 * Returns all platform feature flags from the platform_flags table.
 * Used by the client-side kill-switch system (kill-switch.ts → fetchFeatureFlags()).
 *
 * Auth: requires a valid session (any role). Flags are not sensitive — they
 * control which features are enabled, not any personal data.
 *
 * Rate-limit: general (60 req/min per IP).
 *
 * Response:
 *   { data: FeatureFlags }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth }               from "@/lib/auth-guard";
import { rateLimit, LIMITS }         from "@/lib/rate-limit";
import type { FeatureFlags }         from "@/lib/kill-switch";

// Default flags — returned when DB is unavailable or flag row is missing
const DEFAULTS: FeatureFlags = {
  try_on_camera:  true,
  try_on_photo:   true,
  try_on_video:   true,
  marketplace:    true,
  creator_upload: true,
  ad_token:       true,
  depth_parallax: true,
};

// The exact keys we surface — prevents leaking internal/future flags
const FLAG_KEYS: (keyof FeatureFlags)[] = [
  "try_on_camera",
  "try_on_photo",
  "try_on_video",
  "marketplace",
  "creator_upload",
  "ad_token",
  "depth_parallax",
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Rate limit ────────────────────────────────────────────────────────────
  const limited = rateLimit(req, "flags", LIMITS.general);
  if (!limited.ok) return limited.response!;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { error } = await requireAuth(req);
  if (error) return error;

  // ── Fetch flags from Supabase ─────────────────────────────────────────────
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // Fail-open for UX: return defaults when Supabase not configured
    return NextResponse.json({ data: DEFAULTS });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: rows, error: dbError } = await supabase
      .from("platform_flags")
      .select("key, enabled")
      .in("key", FLAG_KEYS);

    if (dbError || !rows) {
      return NextResponse.json({ data: DEFAULTS });
    }

    // Build FeatureFlags map from rows, falling back to DEFAULTS for missing keys
    const flags = { ...DEFAULTS };
    for (const row of rows) {
      const key = row.key as keyof FeatureFlags;
      if (FLAG_KEYS.includes(key)) {
        flags[key] = row.enabled as boolean;
      }
    }

    return NextResponse.json(
      { data: flags },
      {
        headers: {
          // Short cache — flags are low-sensitivity but change rarely
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    console.error("[/api/flags] Unexpected error:", err);
    return NextResponse.json({ data: DEFAULTS });
  }
}
