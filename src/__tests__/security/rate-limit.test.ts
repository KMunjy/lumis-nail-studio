/**
 * rate-limit.test.ts — Unit tests for the in-memory sliding-window rate limiter
 *
 * Verifies:
 *   • Requests within the limit return ok:true
 *   • Requests over the limit return ok:false with a 429 NextResponse
 *   • Retry-After header is a positive integer
 *   • Different IP addresses are tracked independently
 *   • Different buckets are tracked independently
 *   • Window expiry allows new requests after window elapses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

function makeRequest(ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const opts = { max: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) {
      const { ok } = rateLimit(makeRequest(), "test-bucket", opts);
      expect(ok).toBe(true);
    }
  });

  it("blocks the (max+1)th request with 429", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const opts = { max: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i++) rateLimit(makeRequest(), "test-bucket-2", opts);

    const { ok, response } = rateLimit(makeRequest(), "test-bucket-2", opts);
    expect(ok).toBe(false);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
  });

  it("includes Retry-After header on 429", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const opts = { max: 1, windowMs: 30_000 };

    rateLimit(makeRequest(), "retry-bucket", opts);
    const { ok, response } = rateLimit(makeRequest(), "retry-bucket", opts);
    expect(ok).toBe(false);
    const retryAfter = response!.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("tracks different IPs independently", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const opts = { max: 1, windowMs: 60_000 };

    const { ok: ok1 } = rateLimit(makeRequest("10.0.0.1"), "ip-bucket", opts);
    const { ok: ok2 } = rateLimit(makeRequest("10.0.0.2"), "ip-bucket", opts);
    expect(ok1).toBe(true);
    expect(ok2).toBe(true); // different IP, own counter
  });

  it("tracks different buckets independently", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const opts = { max: 1, windowMs: 60_000 };

    rateLimit(makeRequest(), "bucket-a", opts);
    // bucket-a is exhausted for this IP, but bucket-b should be fresh
    const { ok } = rateLimit(makeRequest(), "bucket-b", opts);
    expect(ok).toBe(true);
  });

  it("allows requests again after the window expires", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const windowMs = 10_000;
    const opts = { max: 2, windowMs };

    rateLimit(makeRequest(), "window-bucket", opts);
    rateLimit(makeRequest(), "window-bucket", opts);
    // 3rd should be blocked
    const { ok: blocked } = rateLimit(makeRequest(), "window-bucket", opts);
    expect(blocked).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    // Now should be allowed again
    const { ok: allowed } = rateLimit(makeRequest(), "window-bucket", opts);
    expect(allowed).toBe(true);
  });

  it("exposes RateLimit headers on 429", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const opts = { max: 1, windowMs: 60_000 };

    rateLimit(makeRequest(), "header-bucket", opts);
    const { response } = rateLimit(makeRequest(), "header-bucket", opts);

    expect(response!.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(response!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response!.headers.get("X-RateLimit-Reset")).not.toBeNull();
  });
});
