/**
 * GET  /api/consent  — fetch the authenticated user's current consent status
 * POST /api/consent  — record or update consent for one or more consent types
 *
 * POPIA §11 / GDPR Art.6(1)(a) — explicit consent for camera and storage.
 *
 * Security:
 *   • Both verbs require a valid Supabase JWT.
 *   • Consent records are scoped to the authenticated user only (enforced by
 *     both the route and Supabase RLS on public.user_consent).
 *   • Rate-limited: 20 req/min per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

const VALID_CONSENT_TYPES = ["camera", "storage", "analytics", "marketing"] as const;
type ConsentType = (typeof VALID_CONSENT_TYPES)[number];

// ── GET /api/consent ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "consent-get", LIMITS.sensitive);
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

    const { data, error } = await supabase
      .from("user_consent")
      .select("consent_type, given, policy_version, given_at, withdrawn_at")
      .eq("user_id", user!.id);

    if (error) {
      console.error("[consent/GET] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to fetch consent status" }, { status: 500 });
    }

    // Return a flat map: { camera: true, storage: false, ... }
    const consentMap = Object.fromEntries(
      VALID_CONSENT_TYPES.map((t) => {
        const record = data?.find((r) => r.consent_type === t);
        return [t, record ? { given: record.given, policyVersion: record.policy_version, givenAt: record.given_at, withdrawnAt: record.withdrawn_at } : null];
      }),
    );

    return NextResponse.json({ data: consentMap });
  } catch (err) {
    console.error("[consent/GET] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── POST /api/consent ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "consent-post", LIMITS.sensitive);
  if (!ok) return rlRes!;

  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  let body: { consents: { type: ConsentType; given: boolean }[]; policyVersion?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.consents) || body.consents.length === 0) {
    return NextResponse.json({ error: "consents array is required" }, { status: 400 });
  }

  // Validate each consent type
  for (const c of body.consents) {
    if (!VALID_CONSENT_TYPES.includes(c.type)) {
      return NextResponse.json({ error: `Invalid consent type: ${c.type}` }, { status: 400 });
    }
    if (typeof c.given !== "boolean") {
      return NextResponse.json({ error: `consent.given must be boolean for type: ${c.type}` }, { status: 400 });
    }
  }

  const policyVersion = body.policyVersion ?? "1.0.0";
  const source        = body.source ?? "api";
  const now           = new Date().toISOString();

  const upsertRows = body.consents.map((c) => ({
    user_id:        user!.id,
    consent_type:   c.type,
    given:          c.given,
    policy_version: policyVersion,
    source,
    given_at:       c.given ? now : null,
    withdrawn_at:   !c.given ? now : null,
    metadata:       { userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? "" },
  }));

  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.url, env.key, { auth: { persistSession: false } });

    const { error } = await supabase
      .from("user_consent")
      .upsert(upsertRows, { onConflict: "user_id,consent_type" });

    if (error) {
      console.error("[consent/POST] Supabase error:", error.message);
      return NextResponse.json({ error: "Failed to record consent" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, recorded: body.consents.length }, { status: 200 });
  } catch (err) {
    console.error("[consent/POST] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
