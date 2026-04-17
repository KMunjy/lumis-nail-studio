/**
 * POST /api/referral — log a referral click
 *
 * Body: { productId: string; refSource: string }
 *
 * Security:
 *   • No auth required — this is a public analytics endpoint.
 *   • Rate-limited: 30 req/min per IP to prevent click-fraud flooding.
 *   • IP hash (SHA-256) stored for dedup; raw IP is never persisted.
 *   • refSource is length-capped to prevent log injection.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf     = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(request, "referral", LIMITS.referral);
  if (!ok) return rlRes!;

  let body: { productId?: string; refSource?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { productId, refSource } = body;
  if (!productId || !refSource) {
    return NextResponse.json(
      { error: "productId and refSource are required" },
      { status: 400 },
    );
  }

  // Sanitise refSource — cap length, strip non-printable chars
  const safeRefSource = String(refSource).slice(0, 128).replace(/[^\x20-\x7E]/g, "");
  const safeProductId = String(productId).slice(0, 64).replace(/[^\x20-\x7E]/g, "");

  const ipHash = await sha256Hex(getClientIp(request));
  const ua     = (request.headers.get("user-agent") ?? "").slice(0, 255);

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } },
      );

      await supabase.from("referral_clicks").insert({
        product_id: safeProductId,
        ref_source:  safeRefSource,
        user_agent:  ua,
        ip_hash:     ipHash,
      });
    } catch (err) {
      // Non-critical analytics — log and continue, never surface to client
      console.warn("[referral] DB insert failed:", err);
    }
  }

  return new NextResponse(null, { status: 204 });
}
