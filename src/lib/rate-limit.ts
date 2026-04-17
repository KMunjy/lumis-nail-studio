/**
 * rate-limit.ts — Sliding-window rate limiter for LUMIS API routes (P1-3 — G-06).
 *
 * Two-tier design:
 *   TIER 1 (Upstash Redis) — used when UPSTASH_REDIS_REST_URL + TOKEN are set.
 *     Shared counter across all serverless function instances.
 *     Algorithm: sliding window via @upstash/ratelimit.
 *
 *   TIER 2 (In-memory) — fallback for local dev / single-instance deployments.
 *     Keyed by IP + bucket. Stale entries pruned every 5 minutes.
 *     NOT suitable for multi-instance deployments.
 *
 * Usage (unchanged at call sites):
 *   const { ok, response } = rateLimit(req, "orders", LIMITS.sensitive);
 *   if (!ok) return response!;
 *
 * Default limits:
 *   • General:   60 req / 60 s
 *   • Sensitive: 20 req / 60 s
 *   • Ad-token:  10 req / 60 s
 *   • Referral:  30 req / 60 s
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

// ── Upstash Redis adapter (Tier 1) ────────────────────────────────────────────

/**
 * Attempt a rate-limit check via Upstash Redis.
 * Returns null if Upstash is not configured, so the caller falls back to in-memory.
 */
async function _upstashRateLimit(
  ip: string,
  bucket: string,
  options: RateLimitOptions,
): Promise<RateLimitResult | null> {
  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) return null;

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis }     = await import("@upstash/redis");

    const redis  = new Redis({ url: redisUrl, token: redisToken });
    const window = `${Math.floor(options.windowMs / 1000)} s` as `${number} s`;

    // Lazily create limiter per bucket (cached in closure via module-level map)
    let limiter = _upstashLimiters.get(bucket);
    if (!limiter) {
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(options.max, window),
        prefix:  "lumis",
      });
      _upstashLimiters.set(bucket, limiter);
    }

    const identifier    = `${bucket}:${ip}`;
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return {
        ok: false,
        remaining: 0,
        response: NextResponse.json(
          { error: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: {
              "Retry-After":           String(retryAfter),
              "X-RateLimit-Limit":     String(limit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset":     String(Math.ceil(reset / 1000)),
            },
          },
        ),
      };
    }

    return { ok: true, remaining, response: null };
  } catch (err) {
    // If Upstash is unreachable, fall through to in-memory
    console.warn("[rate-limit] Upstash unavailable, falling back to in-memory:", err);
    return null;
  }
}

// Module-level cache of Upstash Ratelimit instances (one per bucket)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _upstashLimiters = new Map<string, any>();

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
export async function rateLimitAsync(
  req: NextRequest,
  bucket: string,
  options: RateLimitOptions = LIMITS.general,
): Promise<RateLimitResult> {
  const ip = getClientIp(req);

  // Try Upstash first (shared across instances)
  const upstashResult = await _upstashRateLimit(ip, bucket, options);
  if (upstashResult !== null) return upstashResult;

  // Fallback to in-memory
  return _inMemoryRateLimit(ip, bucket, options);
}

/**
 * Synchronous in-memory rate limit — same interface as before.
 * Use this when you cannot await (e.g. middleware).
 * For API routes, prefer rateLimitAsync() which uses Upstash when available.
 */
export function rateLimit(
  req: NextRequest,
  bucket: string,
  options: RateLimitOptions = LIMITS.general,
): RateLimitResult {
  const ip = getClientIp(req);
  return _inMemoryRateLimit(ip, bucket, options);
}

function _inMemoryRateLimit(
  ip: string,
  bucket: string,
  options: RateLimitOptions,
): RateLimitResult {
  const { max, windowMs } = options;
  const now = Date.now();

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
