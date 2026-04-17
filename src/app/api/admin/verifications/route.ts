/**
 * GET /api/admin/verifications
 *
 * Returns all creator verification records for admin review (P1-1 — G-04).
 * Admin role required.
 *
 * Query params:
 *   ?status=pending|under_review|approved|rejected|suspended|all (default: all)
 *   ?limit=50&offset=0
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole }               from "@/lib/auth-guard";
import { rateLimit, LIMITS }         from "@/lib/rate-limit";
import { trackApiEvent }             from "@/lib/monitoring";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = rateLimit(req, "admin-verifications", LIMITS.sensitive);
  if (!limited.ok) return limited.response!;

  const { error: authError } = await requireRole(req, ["admin"]);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit")  ?? "50")));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ data: [], total: 0 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    let query = supabase
      .from("creator_verifications")
      .select(
        "id, user_id, status, business_name, business_type, country, portfolio_url, instagram_handle, id_document_path, business_reg_path, submitted_at, reviewed_at, reviewed_by, rejection_reason, admin_notes",
        { count: "exact" },
      )
      .order("submitted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const VALID_STATUSES = ["pending", "under_review", "approved", "rejected", "suspended"];
    if (status !== "all" && VALID_STATUSES.includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    trackApiEvent({ route: "/api/admin/verifications", method: "GET", statusCode: 200, durationMs: Date.now() - start });

    return NextResponse.json({ data: data ?? [], total: count ?? 0 });
  } catch (err) {
    trackApiEvent({ route: "/api/admin/verifications", method: "GET", statusCode: 500, durationMs: Date.now() - start, errorCode: "DB_ERROR" });
    console.error("[admin/verifications] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch verifications." }, { status: 500 });
  }
}
