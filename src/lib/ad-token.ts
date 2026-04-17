/**
 * LUMIS — Ad Token Client  v1.0
 *
 * Client-side utilities for the zero-rate ad-watch entitlement flow.
 *
 * Flow:
 *   1. User opens the "Watch an ad to try on for free" modal.
 *   2. Ad network SDK (AdMob / IronSource) plays the interstitial.
 *   3. On completion, the SDK calls back with a signed completion token.
 *   4. This module sends that token to POST /api/ad-token/claim.
 *   5. The server validates the HMAC signature and returns a 24 h token UUID.
 *   6. The UUID is stored in sessionStorage (cleared on tab close / page refresh).
 *   7. Subsequent API calls include the token as a Bearer header.
 *   8. The server calls verify_ad_token() before allowing premium try-ons.
 *
 * Security model:
 *   - Raw token UUID is stored only in sessionStorage (never localStorage or cookies)
 *     to minimise persistence surface area.
 *   - The server never returns the token hash; only the raw UUID is returned once.
 *   - HMAC verification of the ad completion signal prevents fake token requests.
 *   - Each raw UUID maps to exactly one hashed row in the ad_tokens table.
 *   - Tokens expire server-side regardless of client-side deletion.
 *
 * GDPR / POPIA notes:
 *   - No biometric or PII data is involved in this flow.
 *   - session_id is a random UUID generated per session (not fingerprinted).
 *   - Ad tokens are not linked to profiles for anonymous sessions.
 *   - Token usage counters do not identify individual users.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdNetwork = "admob" | "ironsource" | "unity" | "mock";

export interface AdCompletionPayload {
  /** Ad network that delivered the ad. */
  adNetwork:  AdNetwork;
  /** Ad unit identifier from the network dashboard. */
  adUnitId:   string;
  /** HMAC-SHA256 completion signature provided by the ad network SDK. */
  completionSig: string;
  /** Optional authenticated user ID. Null for anonymous sessions. */
  userId?:    string | null;
}

export interface AdTokenResponse {
  /** Raw UUID token to store client-side. */
  token:     string;
  /** ISO 8601 expiry timestamp (24 h from grant). */
  expiresAt: string;
  /** Informational: network that granted the ad. */
  adNetwork: AdNetwork;
}

export interface AdTokenVerification {
  valid:           boolean;
  expiresAt?:      string;
  tryOnsRemaining?: number;
}

export interface AdTokenState {
  token:     string;
  expiresAt: string;
  grantedAt: string;
  adNetwork: AdNetwork;
}

// ─── Session storage keys ─────────────────────────────────────────────────────

const SESSION_KEY   = "lumis_ad_token";
const SESSION_ID_KEY = "lumis_session_id";

// ─── Anonymous session ID ─────────────────────────────────────────────────────

/**
 * Get or create an anonymous session ID for this browser tab.
 * Stored in sessionStorage — cleared when the tab closes.
 * Not tied to any PII; used only to group ad token lookups for anonymous users.
 */
export function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

// ─── Token storage ────────────────────────────────────────────────────────────

/**
 * Persist an ad token response in sessionStorage.
 * Called immediately after a successful /api/ad-token/claim response.
 */
export function storeAdToken(response: AdTokenResponse): void {
  if (typeof sessionStorage === "undefined") return;
  const state: AdTokenState = {
    token:     response.token,
    expiresAt: response.expiresAt,
    grantedAt: new Date().toISOString(),
    adNetwork: response.adNetwork,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
}

/**
 * Retrieve the stored ad token state, or null if none / expired client-side.
 * Note: client-side expiry check is a convenience only; the server always
 * re-validates the token hash against the database.
 */
export function getStoredAdToken(): AdTokenState | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const state: AdTokenState = JSON.parse(raw);
    // Client-side expiry check (guard only — server is authoritative)
    if (new Date(state.expiresAt) <= new Date()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return state;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/**
 * Clear the stored ad token (e.g. after expiry or user logout).
 */
export function clearAdToken(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Returns true if a non-expired ad token is stored client-side.
 * Does NOT verify with the server — use verifyAdToken() for authoritative check.
 */
export function hasStoredAdToken(): boolean {
  return getStoredAdToken() !== null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Send an ad completion payload to the server and receive a 24 h token.
 *
 * @param payload  Completion data from the ad network SDK callback.
 * @returns        Token response with raw UUID and expiry.
 * @throws         On network error or server-side validation failure.
 */
export async function claimAdToken(payload: AdCompletionPayload): Promise<AdTokenResponse> {
  const body = {
    adNetwork:     payload.adNetwork,
    adUnitId:      payload.adUnitId,
    completionSig: payload.completionSig,
    userId:        payload.userId ?? null,
    sessionId:     getSessionId(),
  };

  const res = await fetch("/api/ad-token/claim", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Ad token claim failed: ${res.status}`);
  }

  const data: AdTokenResponse = await res.json();
  storeAdToken(data);
  return data;
}

/**
 * Verify the stored ad token against the server.
 * Returns { valid: false } if no token is stored or the token has expired.
 */
export async function verifyAdToken(): Promise<AdTokenVerification> {
  const state = getStoredAdToken();
  if (!state) return { valid: false };

  try {
    const res = await fetch(`/api/ad-token/verify?token=${encodeURIComponent(state.token)}`, {
      method:  "GET",
      headers: { "Cache-Control": "no-store" },
    });

    if (!res.ok) return { valid: false };
    const data: AdTokenVerification = await res.json();

    if (!data.valid) clearAdToken();  // server says invalid — remove locally too
    return data;
  } catch {
    // Network error — trust client-side expiry check as fallback
    return { valid: hasStoredAdToken() };
  }
}

/**
 * Get the Authorization header value for API calls requiring a valid ad token.
 * Returns null if no valid token is stored.
 */
export function getAdTokenHeader(): string | null {
  const state = getStoredAdToken();
  return state ? `AdToken ${state.token}` : null;
}

// ─── Mock helper (development / test mode) ────────────────────────────────────

/**
 * Issue a mock ad token directly via the API (network="mock").
 * Only works when NEXT_PUBLIC_AD_MOCK_ENABLED=true.
 * Used in Storybook, E2E tests, and local development.
 */
export async function claimMockAdToken(userId?: string): Promise<AdTokenResponse> {
  if (process.env.NEXT_PUBLIC_AD_MOCK_ENABLED !== "true") {
    throw new Error("Mock ad tokens are disabled in production.");
  }
  return claimAdToken({
    adNetwork:     "mock",
    adUnitId:      "mock-unit-001",
    completionSig: "mock-sig-" + Date.now(),
    userId,
  });
}
