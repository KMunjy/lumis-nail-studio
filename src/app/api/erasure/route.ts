/**
 * POST /api/erasure — execute right-to-erasure for the authenticated user
 *
 * POPIA §24 / GDPR Art.17 — right to be forgotten.
 *
 * What is deleted:
 *   • saved_looks            — user-generated content, no retention requirement
 *   • try_on_sessions        — analytics, no retention requirement
 *   • user_consent           — withdrawn and cleared
 *
 * What is RETAINED (legal obligation):
 *   • orders / order_items   — financial records, retained per tax law
 *                              PII (shipping address, notes) is ANONYMISED
 *
 * What is NOT touched:
 *   • auth.users             — Supabase Auth user deletion is handled separately
 *                              via Supabase dashboard or auth.admin.deleteUser()
 *
 * The actual deletion is performed by the security-definer function
 * public.process_erasure() which bypasses RLS and runs atomically.
 *
 * Security:
 *   • Requires valid JWT — erasure scoped to authenticated user only.
 *   • Rate-limited: 2 req/hour (irreversible destructive operation).
 *   • Logs all actions to erasure_requests for audit trail.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Very low rate limit — this is an irreversible destructive operation
  const { ok, response: rlRes } = rateLimit(req, "erasure", { max: 2, windowMs: 60 * 60_000 });
  if (!ok) return rlRes!;

  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };

  let erasureRequestId: string | null = null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.url, env.key, { auth: { persistSession: false } });

    // 1. Create erasure request record (audit trail)
    const { data: requestRecord, error: requestError } = await supabase
      .from("erasure_requests")
      .insert({
        user_id:      user!.id,
        status:       "processing",
        scope:        ["consent", "saved_looks", "try_on_sessions"],
        initiated_by: "user",
      })
      .select("id")
      .single();

    if (requestError || !requestRecord) {
      console.error("[erasure] Failed to create erasure request:", requestError?.message);
      return NextResponse.json({ error: "Failed to initiate erasure" }, { status: 500 });
    }

    erasureRequestId = requestRecord.id;

    // 2. Execute the security-definer function (performs all deletions atomically)
    const { data: actions, error: erasureError } = await supabase
      .rpc("process_erasure", { p_user_id: user!.id });

    if (erasureError) {
      // Update erasure request as failed
      await supabase
        .from("erasure_requests")
        .update({ status: "failed", error_detail: erasureError.message })
        .eq("id", erasureRequestId);

      console.error("[erasure] process_erasure RPC error:", erasureError.message);
      return NextResponse.json({ error: "Erasure processing failed" }, { status: 500 });
    }

    // 3. Mark erasure request as completed with audit trail
    const retainedRecords = [
      { table: "orders", reason: "Legal/financial retention obligation — PII anonymised" },
      { table: "order_items", reason: "Legal/financial retention obligation" },
      { table: "auth.users", reason: "Auth identity — delete separately via account settings" },
    ];

    await supabase
      .from("erasure_requests")
      .update({
        status:          "completed",
        actions_taken:   actions,
        retained_records: retainedRecords,
        completed_at:    new Date().toISOString(),
      })
      .eq("id", erasureRequestId);

    return NextResponse.json({
      ok: true,
      message: "Your data has been erased. Financial records (orders) have been anonymised as required by law.",
      requestId:       erasureRequestId,
      actionsTaken:    actions,
      retainedRecords,
    });
  } catch (err) {
    console.error("[erasure] Unexpected error:", err);

    // Attempt to mark request as failed if we have an ID
    if (erasureRequestId) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(env.url, env.key, { auth: { persistSession: false } });
        await supabase
          .from("erasure_requests")
          .update({ status: "failed", error_detail: String(err) })
          .eq("id", erasureRequestId);
      } catch { /* best effort */ }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
