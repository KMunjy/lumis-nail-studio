/**
 * UC-08 — Accessibility (WCAG 2.1 Level AA)
 *
 * DIMENSION 3: System Test  — axe-core violations in a real browser
 * DIMENSION 4: UAT Scenario — "All pages are accessible to assistive technology users"
 *
 * Uses @axe-core/playwright for in-browser accessibility scanning.
 * Each page is tested both with and without consent (consent banner overlay
 * must itself be accessible).
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { injectConsent } from "./helpers";

test.describe("UC-08 — Accessibility (axe-core / WCAG 2.1 AA)", () => {
  // ── With consent banner visible (first-visit state) ────────────────────────

  test("homepage — consent banner state has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    // Filter to critical/serious violations only — warn on minor
    const critical = results.violations.filter(v =>
      v.impact === "critical" || v.impact === "serious"
    );
    expect(critical, `Critical violations: ${JSON.stringify(critical.map(v => v.id))}`).toHaveLength(0);
  });

  // ── With consent given (normal app state) ─────────────────────────────────

  test.describe("Post-consent pages", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await injectConsent(page);
    });

    test("homepage has no critical a11y violations", async ({ page }) => {
      await page.reload();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter(v =>
        v.impact === "critical" || v.impact === "serious"
      );
      expect(critical, `Violations: ${JSON.stringify(critical.map(v => v.id))}`).toHaveLength(0);
    });

    test("/privacy page has no critical a11y violations", async ({ page }) => {
      await page.goto("/privacy");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter(v =>
        v.impact === "critical" || v.impact === "serious"
      );
      expect(critical, `Violations: ${JSON.stringify(critical.map(v => v.id))}`).toHaveLength(0);
    });

    test("/profile page has no critical a11y violations", async ({ page }) => {
      await page.goto("/profile");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter(v =>
        v.impact === "critical" || v.impact === "serious"
      );
      expect(critical, `Violations: ${JSON.stringify(critical.map(v => v.id))}`).toHaveLength(0);
    });

    test("/cart page has no critical a11y violations", async ({ page }) => {
      await page.goto("/cart");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter(v =>
        v.impact === "critical" || v.impact === "serious"
      );
      expect(critical, `Violations: ${JSON.stringify(critical.map(v => v.id))}`).toHaveLength(0);
    });
  });
});
