/**
 * UC-01 / UC-02 — Consent gate (first visit + returning user)
 *
 * DIMENSION 3: System Test  — full browser, real localStorage, real DOM
 * DIMENSION 4: UAT Scenario — "As a first-time user I must consent before using the app"
 *
 * Acceptance criteria:
 *   UC-01: Banner shown on first visit; dismisses on accept; consent persisted
 *   UC-02: Banner NOT shown when valid consent exists in localStorage
 */

import { test, expect } from "@playwright/test";
import { injectConsent, acceptConsent, dumpStorage } from "./helpers";

// ── UC-01: First visit ────────────────────────────────────────────────────────

test.describe("UC-01 — First visit (no prior consent)", () => {
  test("consent banner is visible on fresh load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("banner has correct aria attributes for accessibility", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-labelledby", "consent-title");
  });

  test("banner discloses camera and storage processing", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Camera — processed on your device only/i)).toBeVisible();
    await expect(page.getByText(/Cart — stored locally for 30 days/i)).toBeVisible();
  });

  test("banner shows both GDPR and POPIA legal bases", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/GDPR Art\. 6\(1\)\(a\)/)).toBeVisible();
    await expect(page.getByText(/POPIA Section 11\(1\)\(a\)/)).toBeVisible();
  });

  test("banner has link to full privacy policy", async ({ page }) => {
    await page.goto("/");
    const link = page.getByText(/Full Privacy Policy/i);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/privacy");
  });

  test("clicking 'I Accept' dismisses the banner", async ({ page }) => {
    await page.goto("/");
    await acceptConsent(page);
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("clicking 'I Accept' persists consent to localStorage with correct structure", async ({ page }) => {
    await page.goto("/");
    await acceptConsent(page);
    const storage = await dumpStorage(page);
    expect(storage["lumis_consent_v1"]).not.toBeNull();
    const record = JSON.parse(storage["lumis_consent_v1"]!);
    expect(record.camera).toBe(true);
    expect(record.storage).toBe(true);
    expect(record.policyVersion).toBe("1.0.0");
    expect(new Date(record.givenAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test("'Decline' link is present and navigates away", async ({ page }) => {
    await page.goto("/");
    const declineLink = page.getByText(/^Decline$/i);
    await expect(declineLink).toBeVisible();
    // Decline href navigates user out of the app
    await expect(declineLink.locator("..")).toHaveAttribute("href");
  });
});

// ── UC-02: Returning user ─────────────────────────────────────────────────────

test.describe("UC-02 — Returning user (consent already given)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await injectConsent(page);
  });

  test("consent banner is NOT shown when valid consent exists", async ({ page }) => {
    await page.reload();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("app content is accessible without accepting consent again", async ({ page }) => {
    await page.reload();
    // Navigation should be visible (not blocked)
    await expect(page.locator("nav, [data-testid='bottom-nav']").first()).toBeVisible();
  });
});
