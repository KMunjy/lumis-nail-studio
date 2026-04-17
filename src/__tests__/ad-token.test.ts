/**
 * LUMIS — Ad Token Client Unit Tests  v1.0
 *
 * Tests the pure client-side utilities in src/lib/ad-token.ts.
 * No Supabase or network calls are made — fetch is mocked.
 *
 * Coverage:
 *   getSessionId          — creates and reuses session ID
 *   storeAdToken          — writes to sessionStorage
 *   getStoredAdToken      — reads back, handles expiry, handles corrupt data
 *   clearAdToken          — removes from sessionStorage
 *   hasStoredAdToken      — reflects storage state
 *   getAdTokenHeader      — returns correct Authorization format
 *   claimAdToken          — POST /api/ad-token/claim, stores response
 *   verifyAdToken         — GET /api/ad-token/verify, handles errors
 *   claimMockAdToken      — respects NEXT_PUBLIC_AD_MOCK_ENABLED guard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getSessionId,
  storeAdToken,
  getStoredAdToken,
  clearAdToken,
  hasStoredAdToken,
  getAdTokenHeader,
  claimAdToken,
  verifyAdToken,
  claimMockAdToken,
  type AdTokenResponse,
  type AdTokenState,
} from "@/lib/ad-token";

// ─── Session storage mock ─────────────────────────────────────────────────────

// jsdom provides sessionStorage — we clear it between tests.
beforeEach(() => sessionStorage.clear());
afterEach(()  => sessionStorage.clear());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function futureDate(hoursAhead = 24): string {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

function pastDate(hoursBehind = 1): string {
  return new Date(Date.now() - hoursBehind * 60 * 60 * 1000).toISOString();
}

function makeResponse(overrides: Partial<AdTokenResponse> = {}): AdTokenResponse {
  return {
    token:     "test-uuid-1234-5678-abcd",
    expiresAt: futureDate(24),
    adNetwork: "mock",
    ...overrides,
  };
}

// ─── 1. getSessionId ──────────────────────────────────────────────────────────

describe("getSessionId", () => {
  it("AT-01: creates a session ID on first call", () => {
    const id = getSessionId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(8);
  });

  it("AT-02: returns same ID on subsequent calls", () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
  });

  it("AT-03: persists session ID in sessionStorage", () => {
    const id = getSessionId();
    expect(sessionStorage.getItem("lumis_session_id")).toBe(id);
  });
});

// ─── 2. storeAdToken / getStoredAdToken ──────────────────────────────────────

describe("storeAdToken / getStoredAdToken", () => {
  it("AT-04: stores token and retrieves it correctly", () => {
    const res = makeResponse();
    storeAdToken(res);
    const state = getStoredAdToken();
    expect(state).not.toBeNull();
    expect(state!.token).toBe(res.token);
    expect(state!.expiresAt).toBe(res.expiresAt);
    expect(state!.adNetwork).toBe(res.adNetwork);
    expect(state!.grantedAt).toBeDefined();
  });

  it("AT-05: expired token → returns null and removes from storage", () => {
    const res = makeResponse({ expiresAt: pastDate(1) });
    storeAdToken(res);
    const state = getStoredAdToken();
    expect(state).toBeNull();
    expect(sessionStorage.getItem("lumis_ad_token")).toBeNull();
  });

  it("AT-06: returns null when nothing is stored", () => {
    expect(getStoredAdToken()).toBeNull();
  });

  it("AT-07: corrupt JSON in storage → returns null and clears", () => {
    sessionStorage.setItem("lumis_ad_token", "NOT_JSON{{{");
    const state = getStoredAdToken();
    expect(state).toBeNull();
    expect(sessionStorage.getItem("lumis_ad_token")).toBeNull();
  });
});

// ─── 3. clearAdToken ─────────────────────────────────────────────────────────

describe("clearAdToken", () => {
  it("AT-08: removes stored token", () => {
    storeAdToken(makeResponse());
    clearAdToken();
    expect(getStoredAdToken()).toBeNull();
  });

  it("AT-09: no-op when nothing stored", () => {
    expect(() => clearAdToken()).not.toThrow();
  });
});

// ─── 4. hasStoredAdToken ──────────────────────────────────────────────────────

describe("hasStoredAdToken", () => {
  it("AT-10: false when nothing stored", () => {
    expect(hasStoredAdToken()).toBe(false);
  });

  it("AT-11: true after storing a valid token", () => {
    storeAdToken(makeResponse());
    expect(hasStoredAdToken()).toBe(true);
  });

  it("AT-12: false after token expires", () => {
    storeAdToken(makeResponse({ expiresAt: pastDate(1) }));
    expect(hasStoredAdToken()).toBe(false);
  });

  it("AT-13: false after clearAdToken", () => {
    storeAdToken(makeResponse());
    clearAdToken();
    expect(hasStoredAdToken()).toBe(false);
  });
});

// ─── 5. getAdTokenHeader ─────────────────────────────────────────────────────

describe("getAdTokenHeader", () => {
  it("AT-14: returns null when no token stored", () => {
    expect(getAdTokenHeader()).toBeNull();
  });

  it("AT-15: returns 'AdToken <uuid>' when token present", () => {
    const token = "my-test-token-uuid";
    storeAdToken(makeResponse({ token }));
    expect(getAdTokenHeader()).toBe(`AdToken ${token}`);
  });

  it("AT-16: returns null after token expires", () => {
    storeAdToken(makeResponse({ expiresAt: pastDate(1) }));
    expect(getAdTokenHeader()).toBeNull();
  });
});

// ─── 6. claimAdToken (fetch mocked) ──────────────────────────────────────────

describe("claimAdToken", () => {
  afterEach(() => vi.restoreAllMocks());

  it("AT-17: calls POST /api/ad-token/claim with correct body", async () => {
    const mockResponse = makeResponse();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => mockResponse,
    } as Response);

    await claimAdToken({
      adNetwork:     "mock",
      adUnitId:      "unit-001",
      completionSig: "sig-abc",
    });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/ad-token/claim");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.adNetwork).toBe("mock");
    expect(body.adUnitId).toBe("unit-001");
    expect(body.completionSig).toBe("sig-abc");
    expect(body.sessionId).toBeDefined();
  });

  it("AT-18: stores token in sessionStorage on success", async () => {
    const mockResponse = makeResponse();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => mockResponse,
    } as Response);

    await claimAdToken({ adNetwork: "mock", adUnitId: "u", completionSig: "s" });
    const state = getStoredAdToken();
    expect(state?.token).toBe(mockResponse.token);
  });

  it("AT-19: throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   false,
      json: async () => ({ error: "Invalid signature." }),
      status: 401,
    } as Response);

    await expect(
      claimAdToken({ adNetwork: "mock", adUnitId: "u", completionSig: "bad" }),
    ).rejects.toThrow("Invalid signature");
  });

  it("AT-20: throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network down"));

    await expect(
      claimAdToken({ adNetwork: "admob", adUnitId: "u", completionSig: "s" }),
    ).rejects.toThrow("Network down");
  });
});

// ─── 7. verifyAdToken (fetch mocked) ─────────────────────────────────────────

describe("verifyAdToken", () => {
  afterEach(() => vi.restoreAllMocks());

  it("AT-21: returns { valid: false } when no token stored", async () => {
    const result = await verifyAdToken();
    expect(result.valid).toBe(false);
  });

  it("AT-22: calls GET /api/ad-token/verify?token=... with stored token", async () => {
    storeAdToken(makeResponse({ token: "my-uuid-token" }));
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ valid: true, expiresAt: futureDate(20), tryOnsRemaining: 999 }),
    } as Response);

    await verifyAdToken();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/api/ad-token/verify");
    expect(url).toContain("my-uuid-token");
  });

  it("AT-23: clears local token if server says invalid", async () => {
    storeAdToken(makeResponse());
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ valid: false }),
    } as Response);

    const result = await verifyAdToken();
    expect(result.valid).toBe(false);
    expect(getStoredAdToken()).toBeNull();
  });

  it("AT-24: returns cached valid on network error", async () => {
    storeAdToken(makeResponse());
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Offline"));

    const result = await verifyAdToken();
    // Falls back to hasStoredAdToken() === true
    expect(result.valid).toBe(true);
  });

  it("AT-25: returns { valid: true } when server confirms", async () => {
    storeAdToken(makeResponse());
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ valid: true, expiresAt: futureDate(20), tryOnsRemaining: 500 }),
    } as Response);

    const result = await verifyAdToken();
    expect(result.valid).toBe(true);
    expect(result.tryOnsRemaining).toBe(500);
  });
});

// ─── 8. claimMockAdToken ─────────────────────────────────────────────────────

describe("claimMockAdToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("AT-26: throws when NEXT_PUBLIC_AD_MOCK_ENABLED is not set", async () => {
    await expect(claimMockAdToken()).rejects.toThrow("disabled in production");
  });

  it("AT-27: calls claimAdToken with network=mock when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AD_MOCK_ENABLED", "true");
    const mockResponse = makeResponse();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => mockResponse,
    } as Response);

    const result = await claimMockAdToken();
    const body = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.adNetwork).toBe("mock");
    expect(result.token).toBe(mockResponse.token);
  });
});
