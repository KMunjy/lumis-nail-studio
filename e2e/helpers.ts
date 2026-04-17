/**
 * Shared helpers for LUMIS E2E / UAT test suite.
 */
import { type Page } from "@playwright/test";

export const CONSENT_KEY = "lumis_consent_v1";
export const CART_KEY    = "lumis_cart_v1";
export const POLICY_VER  = "1.0.0";

/** Inject a valid consent record into localStorage without going through the UI. */
export async function injectConsent(page: Page) {
  await page.evaluate(
    ({ key, ver }) => {
      const record = {
        givenAt: new Date().toISOString(),
        policyVersion: ver,
        camera: true,
        storage: true,
      };
      localStorage.setItem(key, JSON.stringify(record));
    },
    { key: CONSENT_KEY, ver: POLICY_VER }
  );
}

/** Inject cart items directly into localStorage. */
export async function injectCart(
  page: Page,
  items: { productId: string; quantity: number; addedAt: number }[]
) {
  await page.evaluate(
    ({ key, items }) => localStorage.setItem(key, JSON.stringify(items)),
    { key: CART_KEY, items }
  );
}

/** Read all localStorage keys as a plain object. */
export async function dumpStorage(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() => {
    const out: Record<string, string | null> = {};
    for (const k of ["lumis_consent_v1", "lumis_cart_v1", "lumis_last_viewed"]) {
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
}

/** Accept the consent banner by clicking "I Accept". */
export async function acceptConsent(page: Page) {
  await page.getByText(/I Accept — Continue/i).click();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
}
