/**
 * sentry.server.config.ts
 *
 * Sentry SDK initialisation for the Node.js / Edge server bundle.
 * Loaded automatically by Next.js when `@sentry/nextjs` is installed.
 *
 * Environment variables required:
 *   SENTRY_DSN              — project DSN (server-side, same as client DSN)
 *   SENTRY_AUTH_TOKEN       — used by CI to upload source maps
 *   NEXT_PUBLIC_APP_ENV     — "production" | "staging" | "development"
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",

    // Lower trace sample rate on server — high-throughput API routes
    tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === "production" ? 0.1 : 1.0,

    // Capture unhandled promise rejections and uncaught exceptions
    autoSessionTracking: true,

    beforeSend(event) {
      // Strip user PII — only keep opaque id
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
  });
}
