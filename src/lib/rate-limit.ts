/**
 * rate-limit.ts — In-memory sliding-window rate limiter for LUMIS API routes.
 *
 * Design:
 *   • Keyed by IP address (x-forwarded-for → first hop, or x-real-ip).
 *   • Separate rate-limit "buckets" per route namespace so limits are independent.
 *   • Sliding window: each request is timestamped; old entries are pruned.
 *   • For MVP single-instance deployment. Replace with Upstash Redis for
 *     multi-instance / edge deployments.
 *
 * Usage:
 *   const { ok, response } = rateLimit(req, "orders", { max: 60, windowMs: 60_000 });
 *   if (!ok) return response!;
 *
 * Default limits (overridable per call):
 *   • General routes:       60 req / 60 s  per IP
 *   • Sensitive routes:     20 req / 60 s  per IP
 *   • Ad-token endpoints:   10 req / 60 s  per IP (separate from session limit)
 */

import { NextRequest, NextResponse } from "next/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  /** true if request is within limits */
  ok: boolean;
  /** Pre-built 429 response — return this immediately when ok === false */
  response: NextResponse | null;
  /** Remaining requests allowed in current window */
  remaining: number;
}

// ── Default limits ────────────────────────────────────────────────────────────

export const LIMITS = {
  general:   { max: 60,  windowMs: 60_000 },   // 60 req/min
  sensitive: { max: 20,  windowMs: 60_000 },   // 20 req/min
  adToken:   { max: 10,  windowMs: 60_000 },   // 10 req/min
  referral:  { max: 30,  windowMs: 60_000 },   // 30 req/min
} satisfies Record<string, RateLimitOptions>;

// ── In-memory store ───────────────────────────────────────────────────────────

/** bucket → ip → sorted list of request timestamps */
const _store = new Map<string, Map<string, number[]>>();

/** Prune _store periodically to prevent unbounded growth */
let _lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 5 * 60_000; // prune every 5 min

function pruneStaleEntries(now: number): void {
  if (now - _lastPrune < PRUNE_INTERVAL_MS) return;
  _lastPrune = now;
  for (const [bucket, ipMap] of _store) {
    for (const [ip, timestamps] of ipMap) {
      // Remove entries older than the largest configured window (5 min)
      const cutoff = now - 5 * 60_000;
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) ipMap.delete(ip);
      else ipMap.set(ip, fresh);
    }
    if (ipMap.size === 0) _store.delete(bucket);
  }
}

// ── IP extraction ─────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  // x-forwarded-for may contain a comma-separated list; take the first (client) IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ── Core rate-limit function ──────────────────────────────────────────────────

/**
 * Check rate limit for a request.
 *
 * @param req       - Incoming Next.js request
 * @param bucket    - Logical bucket name (e.g. "orders", "admin", "ad-token")
 * @param options   - Optional override for max and windowMs
 */
export function rateLimit(
  req: NextRequest,
  bucket: string,
  options: RateLimitOptions = LIMITS.general,
): RateLimitResult {
  const { max, windowMs } = options;
  const now = Date.now();
  const ip  = getClientIp(req);

  pruneStaleEntries(now);

  // Get or create bucket map
  let ipMap = _store.get(bucket);
  if (!ipMap) {
    ipMap = new Map();
    _store.set(bucket, ipMap);
  }

  // Get or create timestamp list for this IP
  const cutoff     = now - windowMs;
  const timestamps = (ipMap.get(ip) ?? []).filter((t) => t > cutoff);

  const remaining = Math.max(0, max - timestamps.length);

  if (timestamps.length >= max) {
    const oldestInWindow = timestamps[0] ?? now;
    const retryAfter     = Math.ceil((oldestInWindow + windowMs - now) / 1000);

    return {
      ok: false,
      remaining: 0,
      response: NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After":          String(Math.max(1, retryAfter)),
            "X-RateLimit-Limit":    String(max),
            "X-RateLimit-Remaining":"0",
            "X-RateLimit-Reset":    String(Math.ceil((oldestInWindow + windowMs) / 1000)),
          },
        },
      ),
    };
  }

  timestamps.push(now);
  ipMap.set(ip, timestamps);

  return {
    ok: true,
    remaining: remaining - 1,
    response: null,
  };
}
