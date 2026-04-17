/**
 * sentry.client.config.ts
 *
 * Sentry SDK initialisation for the browser bundle.
 * This file is loaded automatically by Next.js when `@sentry/nextjs` is installed.
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SENTRY_DSN  — project DSN (safe to expose client-side)
 *   NEXT_PUBLIC_APP_ENV     — "production" | "staging" | "development"
 *
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Don't initialise Sentry if DSN is not configured (local dev without monitoring)
if (dsn) {
  Sentry.init({
    dsn,

    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",

    // Capture 100% of traces in production (lower if volume is high)
    tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === "production" ? 0.2 : 1.0,

    // Capture replays on errors (requires @sentry/replay)
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.05,

    integrations: [
      Sentry.replayIntegration({
        // Mask all text and block all media to protect user privacy
        maskAllText:    true,
        blockAllMedia:  true,
      }),
    ],

    // Filter noise
    ignoreErrors: [
      // Browser extension errors
      "Non-Error exception captured",
      "ResizeObserver loop limit exceeded",
      // MediaPipe WASM init race (handled gracefully in mediapipe.ts)
      "WebAssembly.instantiate",
    ],

    // Attach user context (no PII — only opaque user id)
    beforeSend(event) {
      // Strip any accidentally captured email/name from event
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
  });
}
