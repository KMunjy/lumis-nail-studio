/**
 * POST /api/consent/withdraw — withdraw all consent for the authenticated user
 *
 * Marks all consent types as withdrawn server-side, then triggers the
 * erasure workflow for non-legally-retained data.
 *
 * POPIA §11(3) / GDPR Art.7(3) — right to withdraw consent at any time.
 *
 * Security:
 *   • Requires valid JWT.
 *   • Scoped to authenticated user — cannot withdraw on behalf of another user.
 *   • Rate-limited: 5 req/min (sensitive destructive operation).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "consent-withdraw", { max: 5, windowMs: 60_000 });
  if (!ok) return rlRes!;

  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.url, env.key, { auth: { persistSession: false } });

    // 1. Withdraw all active consent records
    const { error: withdrawError } = await supabase
      .from("user_consent")
      .update({ given: false, withdrawn_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .eq("given", true);

    if (withdrawError) {
      console.error("[consent/withdraw] Supabase error:", withdrawError.message);
      return NextResponse.json({ error: "Failed to withdraw consent" }, { status: 500 });
    }

    // 2. Log erasure request (right-to-erasure begins asynchronously)
    await supabase.from("erasure_requests").insert({
      user_id:      user!.id,
      status:       "pending",
      scope:        ["consent", "saved_looks", "try_on_sessions"],
      initiated_by: "user",
    });

    return NextResponse.json({
      ok: true,
      message: "Consent withdrawn. Your data erasure request has been queued.",
    });
  } catch (err) {
    console.error("[consent/withdraw] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
