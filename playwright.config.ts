import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration — UAT + System Tests for LUMIS Nail Studio.
 *
 * Test dimensions covered here:
 *   Dimension 3 — System Tests : full browser, real DOM, localStorage
 *   Dimension 4 — Acceptance Tests (UAT): business scenario journeys
 *
 * Camera access is NOT tested here (requires real device/camera mock).
 * AR overlay accuracy is covered by Dimension 1 (vitest geometry unit tests).
 *
 * Run: npm run test:e2e
 * Run with UI: npm run test:e2e:ui
 * Run headed:  npm run test:e2e:headed
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Fake localStorage consent so tests that don't cover consent flow start clean
    storageState: undefined,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 14"] },
    },
  ],

  // Spin up Next.js dev server before tests, tear down after
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
