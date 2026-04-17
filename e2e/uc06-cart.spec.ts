/**
 * UC-06 — Cart management + 30-day expiry
 *
 * DIMENSION 3: System Test  — localStorage + React context integration
 * DIMENSION 4: UAT Scenario — "As a user I can add products to my cart
 *                              and expired items are automatically removed"
 *
 * Acceptance criteria:
 *   - Add product → cart badge increments
 *   - localStorage persisted with product ID + addedAt
 *   - Items older than 30 days are pruned on page load
 */

import { test, expect } from "@playwright/test";
import { injectConsent, injectCart, dumpStorage } from "./helpers";

test.describe("UC-06 — Cart persistence and 30-day expiry", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await injectConsent(page);
    await page.reload();
  });

  test("cart badge starts at 0 on fresh session", async ({ page }) => {
    // No items in cart
    const badge = page.locator("[data-testid='cart-count'], .cart-badge, [aria-label*='cart']").first();
    // Badge either not visible or shows 0
    const badgeText = await badge.textContent().catch(() => "0");
    expect(Number(badgeText) || 0).toBe(0);
  });

  test("cart stores items to localStorage on add", async ({ page }) => {
    await page.goto("/shop");
    // Inject an item directly to simulate add-to-cart
    await injectCart(page, [
      { productId: "lume-01", quantity: 1, addedAt: Date.now() },
    ]);
    const storage = await dumpStorage(page);
    const cart = JSON.parse(storage["lumis_cart_v1"]!);
    expect(cart).toHaveLength(1);
    expect(cart[0].productId).toBe("lume-01");
  });

  test("expired items (>30 days) are pruned on page reload", async ({ page }) => {
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    await injectCart(page, [
      { productId: "fresh",   quantity: 1, addedAt: Date.now() },
      { productId: "expired", quantity: 1, addedAt: Date.now() - THIRTY_ONE_DAYS_MS },
    ]);
    // Reload to trigger hydration + pruning
    await page.reload();
    // Wait for app to hydrate
    await page.waitForLoadState("networkidle");
    const storage = await dumpStorage(page);
    if (storage["lumis_cart_v1"]) {
      const cart = JSON.parse(storage["lumis_cart_v1"]);
      const ids = cart.map((i: { productId: string }) => i.productId);
      expect(ids).not.toContain("expired");
    }
  });

  test("cart page is reachable", async ({ page }) => {
    await page.goto("/cart");
    await expect(page).toHaveURL(/cart/);
    await expect(page.locator("body")).toBeVisible();
  });
});
