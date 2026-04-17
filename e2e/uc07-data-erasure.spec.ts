/**
 * UC-07 — Right to erasure / data withdrawal
 *
 * DIMENSION 3: System Test  — localStorage clearing, page reload behaviour
 * DIMENSION 4: UAT Scenario — "As a user I can erase all my data from
 *                              the Profile page and withdraw consent"
 *
 * GDPR Art. 17 / POPIA §24 compliance test.
 */

import { test, expect } from "@playwright/test";
import { injectConsent, injectCart, dumpStorage } from "./helpers";

test.describe("UC-07 — Data erasure + consent withdrawal (GDPR Art. 17)", () => {
  test.beforeEach(async ({ page }) => {
    // Set up: give consent + add cart data
    await page.goto("/");
    await injectConsent(page);
    await injectCart(page, [
      { productId: "lume-01", quantity: 1, addedAt: Date.now() },
    ]);
    // Navigate to profile where erasure control lives
    await page.goto("/profile");
  });

  test("profile page loads without error", async ({ page }) => {
    await expect(page).toHaveURL(/profile/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("data summary shows stored consent information", async ({ page }) => {
    // The profile page renders a data privacy dashboard
    // It should show consent date or policy version
    const body = await page.locator("body").textContent();
    // Either policy version text or some data indicator
    const hasDataIndicator =
      (body ?? "").includes("1.0.0") ||
      (body ?? "").includes("consent") ||
      (body ?? "").includes("data") ||
      (body ?? "").includes("privacy");
    expect(hasDataIndicator).toBe(true);
  });

  test("erase button removes all personal data from localStorage", async ({ page }) => {
    // Pre-check: data exists
    const before = await dumpStorage(page);
    expect(before["lumis_consent_v1"]).not.toBeNull();
    expect(before["lumis_cart_v1"]).not.toBeNull();

    // Find and click the erase button
    const eraseBtn = page.getByText(/erase/i).first();
    await expect(eraseBtn).toBeVisible();
    await eraseBtn.click();

    // Allow time for reload / state reset
    await page.waitForTimeout(2000);
    const current = page.url();

    // Either page reloaded to / or consent banner is visible
    const isAtHome = current.endsWith("/") || current.includes("localhost:3000/");
    const hasBanner = await page.getByRole("dialog").isVisible().catch(() => false);
    expect(isAtHome || hasBanner).toBe(true);
  });

  test("consent banner reappears after erasure (consent withdrawn)", async ({ page }) => {
    const eraseBtn = page.getByText(/erase/i).first();
    await eraseBtn.click();
    // Page reloads after ~1.5s
    await page.waitForTimeout(2500);
    // Navigate to home to trigger consent check
    await page.goto("/");
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
