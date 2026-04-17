/**
 * LUMIS Consent Management — GDPR / POPIA compliant
 *
 * Lawful bases handled here:
 *
 *   GDPR (EU/UK):
 *     Art. 6(1)(a) — Consent       : camera processing, localStorage persistence
 *     Art. 6(1)(b) — Contract      : cart storage for checkout (arguable necessity)
 *     Art. 7       — Conditions for consent: freely given, specific, informed, unambiguous
 *     Art. 17      — Right to erasure
 *
 *   POPIA (ZA — Protection of Personal Information Act 4 of 2013):
 *     Section 11   — Lawfulness of processing: consent or legitimate purposes
 *     Section 18   — Notification to data subjects (privacy notice)
 *     Section 23   — Right of access
 *     Section 24   — Right to correction/deletion
 *
 * Personal data processed:
 *   1. Camera feed — MediaPipe hand landmark detection. Processed ON-DEVICE only.
 *      No video frames are transmitted to any server. Raw pixel data is never stored.
 *      Only the 21 XYZ hand landmarks per frame are used (non-biometric by design).
 *   2. Cart contents — product IDs + timestamps. Stored in localStorage under
 *      the key "lumis_cart_v1". No name, email, or payment data.
 *   3. Captured images — user-initiated PNG export. Stored in browser memory only;
 *      offered for local download. Never uploaded server-side.
 *
 * Data minimisation (GDPR Art. 5(1)(c) / POPIA Section 10):
 *   - No cookies set by this application.
 *   - No analytics or third-party tracking scripts.
 *   - Camera permission revoked when user navigates away from the studio.
 *   - Cart data carries an expiry timestamp and is purged after 30 days.
 */

const CONSENT_KEY      = "lumis_consent_v1";
const CART_EXPIRY_DAYS = 30;

export type ConsentRecord = {
  /** ISO 8601 timestamp when consent was given */
  givenAt: string;
  /** Version of the privacy policy the user consented to */
  policyVersion: string;
  /** User explicitly accepted camera-data processing disclosure */
  camera: boolean;
  /** User explicitly accepted functional localStorage usage */
  storage: boolean;
};

export const CURRENT_POLICY_VERSION = "1.0.0";

/** Returns the stored consent record, or null if no consent has been given. */
export function getConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    // Invalidate consent if policy version has changed — must re-consent
    if (parsed.policyVersion !== CURRENT_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Returns true if the user has given valid consent for all required purposes. */
export function hasConsent(): boolean {
  const c = getConsent();
  return c !== null && c.camera && c.storage;
}

/** Saves consent to localStorage. Called when user clicks "I Accept". */
export function giveConsent(): void {
  if (typeof window === "undefined") return;
  const record: ConsentRecord = {
    givenAt: new Date().toISOString(),
    policyVersion: CURRENT_POLICY_VERSION,
    camera: true,
    storage: true,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
}

/**
 * Withdraws consent and erases ALL personal data stored by this application.
 * Implements the right to erasure (GDPR Art. 17 / POPIA Section 24).
 *
 * Erases every key starting with "lumis_" from localStorage, which covers:
 *   - lumis_consent_v1          — consent record
 *   - lumis_cart_v1             — cart contents
 *   - lumis_saved_looks_*       — saved looks per user
 *   - lumis_boards_local        — mood-board data
 *   - lumis_wishlist_v1         — wishlist
 *   - lumis_demo_user_id        — ephemeral demo identity
 *   - lumis_last_viewed         — session breadcrumb
 *   - lumis_intent              — onboarding intent
 *   - any future lumis_* keys   — covered by prefix scan
 *
 * NOT erased (because it never existed server-side):
 *   - Camera frames (processed in-memory, never persisted)
 *   - Captured images (in component state only, lost on page unload)
 */
export function withdrawConsentAndEraseData(): void {
  if (typeof window === "undefined") return;

  // Collect all lumis_ keys first (avoid mutating while iterating)
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("lumis_")) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Prunes cart items older than CART_EXPIRY_DAYS.
 * Called at app startup to enforce data retention policy.
 * Satisfies GDPR Art. 5(1)(e) (storage limitation) and POPIA Section 14.
 */
export function pruneExpiredCartItems<T extends { addedAt: number }>(items: T[]): T[] {
  const cutoff = Date.now() - CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => item.addedAt >= cutoff);
}

/** Returns a human-readable summary of stored data for the privacy dashboard. */
export function getDataSummary(): {
  cartItems: number;
  consentDate: string | null;
  policyVersion: string | null;
} {
  if (typeof window === "undefined") {
    return { cartItems: 0, consentDate: null, policyVersion: null };
  }
  const consent = getConsent();
  let cartItems = 0;
  try {
    const raw = localStorage.getItem("lumis_cart_v1");
    if (raw) cartItems = (JSON.parse(raw) as unknown[]).length;
  } catch { /* ignore */ }
  return {
    cartItems,
    consentDate: consent?.givenAt ?? null,
    policyVersion: consent?.policyVersion ?? null,
  };
}
