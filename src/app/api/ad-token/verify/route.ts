/**
 * GET /api/ad-token/verify?token=<uuid>
 *
 * Verify whether a raw ad token UUID is currently valid (not expired, not revoked).
 *
 * Response 200:
 *   { valid: true,  expiresAt: "ISO 8601", tryOnsRemaining: number }
 *   { valid: false }
 *
 * The server hashes the provided raw token UUID and looks up the token_hash
 * column in ad_tokens. The raw UUID is never logged or stored.
 *
 * Security:
 *   - This endpoint uses the public anon Supabase key because the
 *     verify_ad_token() DB function is security definer.
 *   - The response deliberately reveals minimal information (no ad network,
 *     no user ID) to limit token enumeration usefulness.
 *   - Rate limited by Vercel Edge Config / WAF in production.
 *   - Cache-Control: no-store to prevent CDN caching of token state.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

async function sha256Hex(input: string): Promise<string> {
  const data   = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "ad-token-verify", LIMITS.adToken);
  if (!ok) return rlRes!;

  const token = req.nextUrl.searchParams.get("token");

  if (!token || token.length < 32) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  // Sanitise: only allow UUID-shaped tokens (hyphenated hex)
  if (!/^[0-9a-f-]{32,}$/i.test(token)) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  const tokenHash = await sha256Hex(token);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Supabase not configured — FAIL CLOSED. Never grant access silently.
    // Previously this returned valid:true with 999 try-ons — that was a
    // silent privilege escalation bug. (Security fix: P1-SEC-04 adjacent)
    console.error("[ad-token/verify] Supabase not configured. Returning invalid.");
    return NextResponse.json(
      { valid: false },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, anonKey);

    // Call the security-definer RPC function defined in the migration
    const { data, error } = await supabase.rpc("verify_ad_token", {
      p_token_hash: tokenHash,
    });

    if (error) {
      console.error("[ad-token/verify] RPC error:", error.message);
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.valid) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    return NextResponse.json(
      {
        valid:           true,
        expiresAt:       row.expires_at,
        tryOnsRemaining: row.try_ons_remaining,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[ad-token/verify] Unexpected error:", err);
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}
