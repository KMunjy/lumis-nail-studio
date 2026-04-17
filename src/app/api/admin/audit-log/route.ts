/**
 * GET /api/admin/audit-log
 *
 * Returns paginated admin audit log entries (P3-3 — G-11).
 * Admin role required. Supports date-range and action-type filtering.
 *
 * Query params:
 *   ?limit=25&offset=0
 *   ?action=creator_verification_approved
 *   ?target_type=creator_verification
 *   ?from=2026-01-01&to=2026-12-31
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole }               from "@/lib/auth-guard";
import { rateLimit, LIMITS }         from "@/lib/rate-limit";
import { trackApiEvent }             from "@/lib/monitoring";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = rateLimit(req, "admin-audit-log", LIMITS.sensitive);
  if (!limited.ok) return limited.response!;

  const { error: authError } = await requireRole(req, ["admin"]);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const limit      = Math.min(100, Math.max(1, Number(searchParams.get("limit")  ?? "50")));
  const offset     = Math.max(0, Number(searchParams.get("offset") ?? "0"));
  const action     = searchParams.get("action")      ?? null;
  const targetType = searchParams.get("target_type") ?? null;
  const from       = searchParams.get("from")        ?? null;
  const to         = searchParams.get("to")          ?? null;

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ data: [], total: 0 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    let query = supabase
      .from("admin_audit_log")
      .select("id, admin_user_id, action, target_type, target_id, details, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (action)     query = query.eq("action", action);
    if (targetType) query = query.eq("target_type", targetType);
    if (from)       query = query.gte("created_at", from);
    if (to)         query = query.lte("created_at", to + "T23:59:59Z");

    const { data, error, count } = await query;

    if (error) throw error;

    trackApiEvent({ route: "/api/admin/audit-log", method: "GET", statusCode: 200, durationMs: Date.now() - start });

    return NextResponse.json({ data: data ?? [], total: count ?? 0 });
  } catch (err) {
    trackApiEvent({ route: "/api/admin/audit-log", method: "GET", statusCode: 500, durationMs: Date.now() - start, errorCode: "DB_ERROR" });
    console.error("[admin/audit-log] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch audit log." }, { status: 500 });
  }
}
