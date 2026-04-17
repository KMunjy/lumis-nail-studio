/**
 * /api/creator/verification
 *
 * Creator verification submission and status API (P1-1 — G-04).
 *
 * GET  — returns the current user's verification record (status + details)
 * POST — submits a new verification request (status: pending)
 * PATCH — admin only: update verification status (approved / rejected / suspended)
 *
 * Auth: JWT required. PATCH requires admin role.
 * Rate: 10/min GET, 3/hour POST (submission), 20/min PATCH (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole }  from "@/lib/auth-guard";
import { rateLimit, LIMITS }         from "@/lib/rate-limit";
import { trackApiEvent, log }        from "@/lib/monitoring";

const SUBMIT_LIMIT = { max: 3,  windowMs: 60 * 60_000 }; // 3 submissions/hour
const READ_LIMIT   = { max: 30, windowMs: 60_000 };

// ── GET — fetch own verification status ───────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  const limited = rateLimit(req, "creator-verify-get", READ_LIMIT);
  if (!limited.ok) return limited.response!;

  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("creator_verifications")
      .select("id, status, business_name, business_type, country, portfolio_url, instagram_handle, submitted_at, reviewed_at, rejection_reason")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (error) throw error;

    trackApiEvent({ route: "/api/creator/verification", method: "GET", statusCode: 200, durationMs: Date.now() - start });
    return NextResponse.json({ data: data ?? null });
  } catch (err) {
    trackApiEvent({ route: "/api/creator/verification", method: "GET", statusCode: 500, durationMs: Date.now() - start, errorCode: "DB_ERROR" });
    return NextResponse.json({ error: "Failed to fetch verification status." }, { status: 500 });
  }
}

// ── POST — submit verification request ───────────────────────────────────────

interface SubmitBody {
  business_name:     string;
  business_type:     "individual" | "salon" | "brand" | "distributor";
  country:           string;
  portfolio_url?:    string;
  instagram_handle?: string;
  id_document_path?: string;
  business_reg_path?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  const limited = rateLimit(req, "creator-verify-submit", SUBMIT_LIMIT);
  if (!limited.ok) return limited.response!;

  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  let body: SubmitBody;
  try {
    body = await req.json() as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Validate required fields
  const { business_name, business_type, country } = body;
  if (!business_name?.trim() || !business_type || !country?.trim()) {
    return NextResponse.json({ error: "business_name, business_type, and country are required." }, { status: 422 });
  }
  const VALID_TYPES = ["individual", "salon", "brand", "distributor"];
  if (!VALID_TYPES.includes(business_type)) {
    return NextResponse.json({ error: `business_type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 422 });
  }

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Upsert — allows resubmission after rejection
    const { data, error } = await supabase
      .from("creator_verifications")
      .upsert(
        {
          user_id:            user!.id,
          status:             "pending",
          business_name:      business_name.trim().slice(0, 200),
          business_type,
          country:            country.trim().slice(0, 2).toUpperCase(),
          portfolio_url:      body.portfolio_url?.trim().slice(0, 500) ?? null,
          instagram_handle:   body.instagram_handle?.trim().replace(/^@/, "").slice(0, 80) ?? null,
          id_document_path:   body.id_document_path ?? null,
          business_reg_path:  body.business_reg_path ?? null,
          submitted_at:       new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("id, status, submitted_at")
      .single();

    if (error) throw error;

    // Write audit log entry
    await supabase.from("admin_audit_log").insert({
      admin_user_id: user!.id,
      action:        "creator_verification_submitted",
      target_type:   "creator_verification",
      target_id:     data.id,
      details:       { business_type, country },
    }).catch(() => { /* non-fatal */ });

    log.info("creator-verification", "Verification submitted", { userId: user!.id, status: "pending" });
    trackApiEvent({ route: "/api/creator/verification", method: "POST", statusCode: 201, durationMs: Date.now() - start });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    trackApiEvent({ route: "/api/creator/verification", method: "POST", statusCode: 500, durationMs: Date.now() - start, errorCode: "DB_ERROR" });
    console.error("[creator/verification] POST error:", err);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }
}

// ── PATCH — admin: update verification status ─────────────────────────────────

interface PatchBody {
  verification_id:  string;
  status:           "approved" | "rejected" | "under_review" | "suspended";
  rejection_reason?: string;
  admin_notes?:     string;
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  const limited = rateLimit(req, "creator-verify-admin", LIMITS.sensitive);
  if (!limited.ok) return limited.response!;

  const { user, error: authError } = await requireRole(req, ["admin"]);
  if (authError) return authError;

  let body: PatchBody;
  try {
    body = await req.json() as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const VALID_STATUSES = ["approved", "rejected", "under_review", "suspended"];
  if (!body.verification_id || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "verification_id and a valid status are required." }, { status: 422 });
  }

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("creator_verifications")
      .update({
        status:           body.status,
        reviewed_by:      user!.id,
        reviewed_at:      new Date().toISOString(),
        rejection_reason: body.rejection_reason?.trim() ?? null,
        admin_notes:      body.admin_notes?.trim() ?? null,
      })
      .eq("id", body.verification_id)
      .select("id, user_id, status")
      .single();

    if (error) throw error;

    // Immutable audit log entry
    await supabase.from("admin_audit_log").insert({
      admin_user_id: user!.id,
      action:        `creator_verification_${body.status}`,
      target_type:   "creator_verification",
      target_id:     body.verification_id,
      details:       { status: body.status, rejection_reason: body.rejection_reason ?? null },
    });

    log.info("creator-verification", `Admin set status to ${body.status}`, {
      adminId: user!.id,
      verificationId: body.verification_id,
    });
    trackApiEvent({ route: "/api/creator/verification", method: "PATCH", statusCode: 200, durationMs: Date.now() - start });

    return NextResponse.json({ data });
  } catch (err) {
    trackApiEvent({ route: "/api/creator/verification", method: "PATCH", statusCode: 500, durationMs: Date.now() - start, errorCode: "DB_ERROR" });
    console.error("[creator/verification] PATCH error:", err);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
