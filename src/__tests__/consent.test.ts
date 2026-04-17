/**
 * SIT — Consent & GDPR/POPIA Data Management Tests
 *
 * Verifies the full consent lifecycle:
 *   - No consent by default
 *   - giveConsent() persists correctly
 *   - hasConsent() reads correctly
 *   - withdrawConsentAndEraseData() removes all personal data
 *   - pruneExpiredCartItems() enforces 30-day retention
 *   - getDataSummary() returns accurate counts
 *
 * These tests are critical for GDPR compliance evidence.
 * They should be included in the audit trail for the ICO / Information Regulator.
 */

import { describe, it, expect } from "vitest";
import {
  getConsent,
  hasConsent,
  giveConsent,
  withdrawConsentAndEraseData,
  pruneExpiredCartItems,
  getDataSummary,
  CURRENT_POLICY_VERSION,
} from "@/lib/consent";

describe("Consent lifecycle (GDPR Art. 7 / POPIA §11)", () => {
  it("hasConsent() returns false when no consent has been given", () => {
    expect(hasConsent()).toBe(false);
    expect(getConsent()).toBeNull();
  });

  it("giveConsent() persists consent with correct structure", () => {
    giveConsent();
    const c = getConsent();
    expect(c).not.toBeNull();
    expect(c!.camera).toBe(true);
    expect(c!.storage).toBe(true);
    expect(c!.policyVersion).toBe(CURRENT_POLICY_VERSION);
    expect(new Date(c!.givenAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("hasConsent() returns true after giveConsent()", () => {
    giveConsent();
    expect(hasConsent()).toBe(true);
  });

  it("getConsent() returns null when stored policy version differs (re-consent required)", () => {
    giveConsent();
    // Tamper with stored version to simulate a policy update
    const raw = localStorage.getItem("lumis_consent_v1")!;
    const old = JSON.parse(raw);
    old.policyVersion = "0.9.0"; // older version
    localStorage.setItem("lumis_consent_v1", JSON.stringify(old));
    expect(getConsent()).toBeNull();
    expect(hasConsent()).toBe(false);
  });
});

describe("Right to erasure (GDPR Art. 17 / POPIA §24)", () => {
  it("withdrawConsentAndEraseData() removes consent, cart, and lastViewed data", () => {
    // Set up data
    giveConsent();
    localStorage.setItem("lumis_cart_v1", JSON.stringify([{ productId: "lume-01", quantity: 1, addedAt: Date.now() }]));
    localStorage.setItem("lumis_last_viewed", "lume-01");

    withdrawConsentAndEraseData();

    expect(localStorage.getItem("lumis_consent_v1")).toBeNull();
    expect(localStorage.getItem("lumis_cart_v1")).toBeNull();
    expect(localStorage.getItem("lumis_last_viewed")).toBeNull();
  });

  it("hasConsent() returns false after erasure", () => {
    giveConsent();
    withdrawConsentAndEraseData();
    expect(hasConsent()).toBe(false);
  });
});

describe("Data retention — 30-day cart pruning (GDPR Art. 5(1)(e) / POPIA §14)", () => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  it("keeps items added today", () => {
    const items = [{ productId: "lume-01", quantity: 1, addedAt: Date.now() }];
    const pruned = pruneExpiredCartItems(items);
    expect(pruned).toHaveLength(1);
  });

  it("removes items older than 30 days", () => {
    const oldTs = Date.now() - THIRTY_DAYS_MS - 1000;
    const items = [{ productId: "lume-01", quantity: 1, addedAt: oldTs }];
    const pruned = pruneExpiredCartItems(items);
    expect(pruned).toHaveLength(0);
  });

  it("keeps recent and removes old items in a mixed cart", () => {
    const items = [
      { productId: "lume-01", quantity: 1, addedAt: Date.now() },                    // keep
      { productId: "lume-02", quantity: 2, addedAt: Date.now() - THIRTY_DAYS_MS - 1 }, // remove
      { productId: "lume-03", quantity: 1, addedAt: Date.now() - THIRTY_DAYS_MS + 1000 }, // keep (just inside)
    ];
    const pruned = pruneExpiredCartItems(items);
    expect(pruned).toHaveLength(2);
    expect(pruned.map(i => i.productId)).toContain("lume-01");
    expect(pruned.map(i => i.productId)).toContain("lume-03");
    expect(pruned.map(i => i.productId)).not.toContain("lume-02");
  });

  it("handles empty cart gracefully", () => {
    expect(pruneExpiredCartItems([])).toHaveLength(0);
  });
});

describe("Data summary (GDPR transparency)", () => {
  it("returns zero cart items and null consent when nothing stored", () => {
    const summary = getDataSummary();
    expect(summary.cartItems).toBe(0);
    expect(summary.consentDate).toBeNull();
    expect(summary.policyVersion).toBeNull();
  });

  it("returns correct cart count after storing items", () => {
    const items = [
      { productId: "lume-01", quantity: 2, addedAt: Date.now() },
      { productId: "lume-02", quantity: 1, addedAt: Date.now() },
    ];
    localStorage.setItem("lumis_cart_v1", JSON.stringify(items));
    const summary = getDataSummary();
    expect(summary.cartItems).toBe(2);
  });

  it("returns consent date after giveConsent()", () => {
    giveConsent();
    const summary = getDataSummary();
    expect(summary.consentDate).not.toBeNull();
    expect(summary.policyVersion).toBe(CURRENT_POLICY_VERSION);
  });
});
