/**
 * POST /api/ad-token/claim
 *
 * Zero-rate ad-watch entitlement flow — server-side token issuance.
 *
 * Request body:
 *   {
 *     adNetwork:     "admob" | "ironsource" | "unity" | "mock"
 *     adUnitId:      string
 *     completionSig: string        — HMAC-SHA256 from ad network SDK
 *     userId?:       string | null — authenticated user UUID (optional)
 *     sessionId:     string        — anonymous session UUID from client
 *   }
 *
 * Response 200:
 *   {
 *     token:     string   — raw UUID (returned once, never stored server-side in plain)
 *     expiresAt: string   — ISO 8601
 *     adNetwork: string
 *   }
 *
 * Errors:
 *   400 — missing required fields
 *   401 — invalid completion signature (HMAC mismatch)
 *   429 — rate-limit: more than 5 token claims per session per 24 h
 *   500 — database error
 *
 * Security:
 *   - Completion sig is validated via HMAC-SHA256 using AD_TOKEN_SECRET env var.
 *   - The raw token UUID is returned to the client but never persisted in the DB.
 *     Only its SHA-256 hash is stored (token_hash column).
 *   - The service-role Supabase client is used for inserts (bypasses RLS).
 *   - NEXT_PUBLIC_AD_MOCK_ENABLED=true bypasses sig check in dev/test.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

// ─── HMAC verification ────────────────────────────────────────────────────────

async function verifyCompletionSig(
  adNetwork:     string,
  adUnitId:      string,
  completionSig: string,
): Promise<boolean> {
  // Mock network bypass (dev / test mode only)
  if (
    process.env.NEXT_PUBLIC_AD_MOCK_ENABLED === "true" &&
    adNetwork === "mock"
  ) {
    return true;
  }

  const secret = process.env.AD_TOKEN_SECRET;
  if (!secret) {
    console.error("[ad-token/claim] AD_TOKEN_SECRET is not set.");
    return false;
  }

  // The message the ad network signs is: "{adNetwork}:{adUnitId}"
  // Each network uses a slightly different payload — this implementation
  // follows the AdMob / IronSource server-to-server SSV callback convention.
  const message = `${adNetwork}:${adUnitId}`;

  const keyData  = new TextEncoder().encode(secret);
  const msgData  = new TextEncoder().encode(message);

  const key = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-256" },
    false, ["verify"],
  );

  // completionSig is expected as a lowercase hex string
  const sigBytes = hexToUint8Array(completionSig);
  if (!sigBytes) return false;

  return crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, msgData);
}

function hexToUint8Array(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  try {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
  } catch {
    return null;
  }
}

// ─── Token hashing ────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const data   = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Rate limit check (in-memory, per serverless instance) ───────────────────
// In production, use a Redis / Upstash counter instead.
// This is a best-effort guard suitable for low-traffic MVP.

const _claims = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 h

function checkRateLimit(sessionId: string): boolean {
  const now  = Date.now();
  const rec  = _claims.get(sessionId);

  if (!rec || now - rec.windowStart > RATE_LIMIT_WINDOW) {
    _claims.set(sessionId, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= RATE_LIMIT_MAX) return false;
  rec.count++;
  return true;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // IP-level rate limit (in addition to per-session limit below)
  const { ok, response: rlRes } = rateLimit(req, "ad-token-claim", LIMITS.adToken);
  if (!ok) return rlRes!;

  let body: {
    adNetwork?:     string;
    adUnitId?:      string;
    completionSig?: string;
    userId?:        string | null;
    sessionId?:     string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { adNetwork, adUnitId, completionSig, userId, sessionId } = body;

  // ── Validate required fields ────────────────────────────────────────────────
  if (!adNetwork || !adUnitId || !completionSig || !sessionId) {
    return NextResponse.json(
      { error: "Missing required fields: adNetwork, adUnitId, completionSig, sessionId." },
      { status: 400 },
    );
  }

  const allowedNetworks = ["admob", "ironsource", "unity", "mock"] as const;
  if (!allowedNetworks.includes(adNetwork as (typeof allowedNetworks)[number])) {
    return NextResponse.json({ error: "Unknown ad network." }, { status: 400 });
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  if (!checkRateLimit(sessionId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded: maximum 5 ad tokens per session per 24 hours." },
      { status: 429 },
    );
  }

  // ── Verify completion signature ─────────────────────────────────────────────
  const sigValid = await verifyCompletionSig(adNetwork, adUnitId, completionSig);
  if (!sigValid) {
    return NextResponse.json(
      { error: "Invalid completion signature. Ad claim rejected." },
      { status: 401 },
    );
  }

  // ── Generate token and hash ─────────────────────────────────────────────────
  const rawToken = crypto.randomUUID();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // ── Persist to Supabase (service-role client, bypasses RLS) ─────────────────
  // Production: import { createClient } from "@supabase/supabase-js"
  // and use process.env.SUPABASE_SERVICE_ROLE_KEY.
  // Stubbed here to keep the route runnable without Supabase configured.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, serviceKey);

      const { error } = await supabase.from("ad_tokens").insert({
        token_hash:     tokenHash,
        user_id:        userId ?? null,
        session_id:     sessionId,
        ad_network:     adNetwork,
        ad_unit_id:     adUnitId,
        completion_sig: completionSig,
        expires_at:     expiresAt,
      });

      if (error) {
        console.error("[ad-token/claim] Supabase insert error:", error.message);
        return NextResponse.json({ error: "Failed to issue token." }, { status: 500 });
      }
    } catch (err) {
      console.error("[ad-token/claim] Unexpected error:", err);
      return NextResponse.json({ error: "Failed to issue token." }, { status: 500 });
    }
  } else {
    // Supabase not configured — log and continue (dev mode)
    console.warn("[ad-token/claim] Supabase not configured. Token not persisted.");
  }

  return NextResponse.json(
    {
      token:     rawToken,
      expiresAt,
      adNetwork,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":               "no-store",
        "X-Content-Type-Options":      "nosniff",
        "Content-Security-Policy":     "default-src 'none'",
      },
    },
  );
}
