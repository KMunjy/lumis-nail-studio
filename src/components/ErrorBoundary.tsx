"use client";

/**
 * LUMIS Error Boundary — graceful degradation for runtime errors.
 *
 * Wraps any subtree that may throw (e.g. CameraView with MediaPipe, canvas ops).
 * On error:
 *   1. Logs structured error info to console (and optionally to a monitoring endpoint)
 *   2. Renders a fallback UI that doesn't expose stack traces to users
 *   3. Provides a "Try again" button that clears the error state
 *
 * Usage:
 *   <ErrorBoundary context="CameraView">
 *     <CameraView ... />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Label used in error logs to identify the failing subtree. */
  context?: string;
  /** Custom fallback UI — overrides the default card. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info });
    // Structured log — safe for console (no PII, no stack trace to users)
    console.error("[LUMIS ErrorBoundary]", {
      context: this.props.context ?? "unknown",
      message: error.message,
      name: error.name,
      componentStack: info.componentStack?.split("\n").slice(0, 5).join("\n"),
    });
    // Production monitoring hook — replace with your error tracker (Sentry etc.)
    reportError(this.props.context ?? "unknown", error);
  }

  reset = () => this.setState({ error: null, errorInfo: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <AlertTriangle
            size={32}
            style={{ color: "var(--color-terra-mid, #C97D5A)" }}
            aria-hidden="true"
          />
          <div>
            <p
              style={{
                fontFamily: "var(--font-display, serif)",
                fontSize: 18,
                fontStyle: "italic",
                color: "var(--color-bone, #F9F6F2)",
                marginBottom: 8,
              }}
            >
              Something went wrong
            </p>
            <p
              style={{
                fontSize: 13,
                color: "rgba(249,246,242,0.5)",
                lineHeight: 1.6,
                maxWidth: 300,
              }}
            >
              {this.props.context === "CameraView"
                ? "The camera view encountered an error. This can happen if camera access was denied or your browser does not support the required APIs."
                : "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <button
            onClick={this.reset}
            style={{
              padding: "10px 24px",
              backgroundColor: "var(--color-terra, #A85A3E)",
              color: "var(--color-bone, #F9F6F2)",
              border: "none",
              borderRadius: 2,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "var(--font-sans, sans-serif)",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Monitoring hook ──────────────────────────────────────────────────────────
// Lightweight stub. Replace the body with Sentry.captureException(), Datadog, etc.
// Currently logs to console in a structured format that log aggregators can parse.

function reportError(context: string, error: Error) {
  if (typeof window === "undefined") return;
  // Guard: do not log PII. Error.message is logged only — no stack, no user data.
  const payload = {
    ts: new Date().toISOString(),
    context,
    errorName: error.name,
    // Truncate message to prevent accidental PII in long error strings
    errorMessage: error.message.slice(0, 200),
    url: window.location.pathname,
  };
  // Beacon API — non-blocking, doesn't require a server (no-op if endpoint absent)
  if (typeof navigator.sendBeacon === "function") {
    // Uncomment and replace with your monitoring endpoint:
    // navigator.sendBeacon("/api/errors", JSON.stringify(payload));
    void payload; // suppress lint warning until endpoint is wired
  }
}
