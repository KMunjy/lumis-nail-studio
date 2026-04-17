/**
 * monitoring.ts — Structured logging and error tracking for LUMIS.
 *
 * Provides a thin abstraction over the logging backend so it can be swapped
 * (e.g. Sentry, Datadog, Axiom) without changing call sites.
 *
 * Current state (Sprint 3): console-based structured logging.
 * Integration point: replace _sendToBackend() with your monitoring SDK.
 *
 * Usage:
 *   import { log, trackError, trackTryOnOutcome } from "@/lib/monitoring";
 *
 *   log.info("try-on", "Session started", { productId, shape });
 *   trackError("segmentation", err, { fingerIndex, frameCount });
 *   trackTryOnOutcome({ productId, success: true, iou: 0.91, durationMs: 1200 });
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  level:     LogLevel;
  domain:    string;  // e.g. "try-on", "auth", "api", "render", "consent"
  message:   string;
  data?:     Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
}

export interface TryOnOutcome {
  productId:    string;
  success:      boolean;
  iou?:         number;
  durationMs?:  number;
  rendererVersion?: string;
  errorCode?:   string;
  inputType?:   "camera" | "photo" | "video";
  fitzpatrickRange?: string;
}

export interface ApiEvent {
  route:      string;
  method:     string;
  statusCode: number;
  durationMs: number;
  errorCode?: string;
}

// ── Configuration ─────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";

// ── Internal send function (replace with SDK integration) ─────────────────────

function _sendToBackend(event: LogEvent): void {
  // ── Sentry integration (uncomment when Sentry is configured) ──────────────
  // import * as Sentry from "@sentry/nextjs";
  // if (event.level === "error") {
  //   Sentry.captureMessage(event.message, {
  //     level: "error",
  //     tags: { domain: event.domain },
  //     extra: event.data,
  //   });
  // }

  // ── Axiom / Datadog integration (uncomment when configured) ───────────────
  // fetch("/api/logs", { method: "POST", body: JSON.stringify(event) });

  // Current: structured console output
  const prefix = `[LUMIS:${event.domain}]`;
  const payload = event.data ? JSON.stringify(event.data) : "";

  switch (event.level) {
    case "debug": if (!IS_PROD) console.debug(prefix, event.message, payload); break;
    case "info":  console.info(prefix, event.message, payload);  break;
    case "warn":  console.warn(prefix, event.message, payload);  break;
    case "error": console.error(prefix, event.message, payload); break;
  }
}

// ── Core logger ───────────────────────────────────────────────────────────────

function createLog(level: LogLevel) {
  return (domain: string, message: string, data?: Record<string, unknown>) => {
    _sendToBackend({
      level,
      domain,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  };
}

export const log = {
  debug: createLog("debug"),
  info:  createLog("info"),
  warn:  createLog("warn"),
  error: createLog("error"),
};

// ── Error tracking ────────────────────────────────────────────────────────────

/**
 * Track an unexpected error with structured context.
 * In production this would be sent to Sentry or equivalent.
 */
export function trackError(
  domain: string,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack   = err instanceof Error ? err.stack   : undefined;

  _sendToBackend({
    level: "error",
    domain,
    message,
    data: { ...context, stack: IS_PROD ? undefined : stack },
    timestamp: new Date().toISOString(),
  });
}

// ── Domain-specific tracking ──────────────────────────────────────────────────

/**
 * Track a try-on session outcome (success or failure).
 * Used to monitor pipeline quality in production.
 */
export function trackTryOnOutcome(outcome: TryOnOutcome): void {
  _sendToBackend({
    level: outcome.success ? "info" : "warn",
    domain: "try-on",
    message: outcome.success ? "Try-on completed" : "Try-on failed",
    data: {
      productId:       outcome.productId,
      success:         outcome.success,
      iou:             outcome.iou,
      durationMs:      outcome.durationMs,
      rendererVersion: outcome.rendererVersion ?? "v3.0",
      errorCode:       outcome.errorCode,
      inputType:       outcome.inputType ?? "camera",
      fitzpatrickRange: outcome.fitzpatrickRange,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track API route performance and errors.
 */
export function trackApiEvent(event: ApiEvent): void {
  const level: LogLevel = event.statusCode >= 500 ? "error"
    : event.statusCode >= 400 ? "warn"
    : "info";

  _sendToBackend({
    level,
    domain: "api",
    message: `${event.method} ${event.route} → ${event.statusCode}`,
    data: {
      route:      event.route,
      method:     event.method,
      statusCode: event.statusCode,
      durationMs: event.durationMs,
      errorCode:  event.errorCode,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track consent events for POPIA/GDPR audit trail.
 * PII is explicitly excluded — only consent type and action are logged.
 */
export function trackConsentEvent(
  action: "given" | "withdrawn" | "expired",
  consentType: string,
  policyVersion: string,
): void {
  _sendToBackend({
    level: "info",
    domain: "consent",
    message: `Consent ${action}: ${consentType}`,
    data: { action, consentType, policyVersion },
    timestamp: new Date().toISOString(),
  });
}
