"use client";

/**
 * LUMIS Consent Banner — GDPR Art. 7 / POPIA Section 11  v2.0
 *
 * Improvements over v1:
 *   [1] One-tap return pill — returning consented users see a 2s auto-dismiss pill
 *   [2] Step progress indicator — "Step 1 of 2" so users know the flow
 *   [3] Expandable "Why camera?" accordion — reduces drop-off from uncertain users
 *   [4] 90-day soft reminder toast — lightweight re-confirmation, not a full block
 *   [5] Back navigation at top — confirmed fix from prior session
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Camera } from "lucide-react";
import { hasConsent, giveConsent, getConsent } from "@/lib/consent";

interface ConsentBannerProps {
  onConsent?: () => void;
}

// How old (days) consent can be before showing a soft reminder
const SOFT_REMINDER_DAYS = 90;

function consentAgeDays(): number | null {
  const c = getConsent();
  if (!c) return null;
  const ms = Date.now() - new Date(c.givenAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function ConsentBanner({ onConsent }: ConsentBannerProps) {
  const router = useRouter();

  // "full"   = full first-time modal
  // "remind" = lightweight 90-day re-confirmation toast
  // "pill"   = 2s auto-dismiss pill for returning users
  // "hidden" = nothing to show
  const [mode, setMode] = useState<"full" | "remind" | "pill" | "hidden">("hidden");
  const [whyOpen, setWhyOpen] = useState(false);
  const [pillVisible, setPillVisible] = useState(true);

  useEffect(() => {
    if (!hasConsent()) {
      setMode("full");
    } else {
      const age = consentAgeDays();
      if (age !== null && age >= SOFT_REMINDER_DAYS) {
        setMode("remind");
      } else {
        // [1] Returning user — show quick pill then auto-dismiss
        setMode("pill");
        const t = setTimeout(() => {
          setPillVisible(false);
          onConsent?.();
        }, 2000);
        return () => clearTimeout(t);
      }
    }
  }, [onConsent]);

  function handleAccept() {
    giveConsent();
    setMode("hidden");
    onConsent?.();
  }

  function handleDecline() {
    router.back();
  }

  // ── [1] Return-user pill ───────────────────────────────────────────────────
  if (mode === "pill") {
    return (
      <AnimatePresence>
        {pillVisible && (
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            style={{
              position: "fixed",
              bottom: 96,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(22,19,17,0.92)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 50,
              padding: "10px 18px",
              backdropFilter: "blur(12px)",
            }}
          >
            <Camera size={13} style={{ color: "var(--color-terra-mid)" }} />
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "rgba(249,246,242,0.70)",
            }}>
              Camera starting…
            </span>
            {/* 2s progress bar */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 40 }}
              transition={{ duration: 2, ease: "linear" }}
              style={{
                height: 2,
                backgroundColor: "var(--color-terra-mid)",
                borderRadius: 2,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── [4] 90-day soft reminder ───────────────────────────────────────────────
  if (mode === "remind") {
    return (
      <AnimatePresence>
        <motion.div
          key="remind"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          style={{
            position: "fixed",
            bottom: 96,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            width: "calc(100% - 40px)",
            maxWidth: 380,
            backgroundColor: "rgba(22,19,17,0.96)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "16px 20px",
            backdropFilter: "blur(16px)",
          }}
        >
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(249,246,242,0.82)",
            marginBottom: 4,
          }}>
            Your privacy settings — still OK?
          </p>
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            color: "rgba(249,246,242,0.40)",
            marginBottom: 14,
          }}>
            It&apos;s been 90 days since you accepted our camera & storage policy. Nothing has changed.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleAccept}
              style={{
                flex: 1, height: 36,
                backgroundColor: "var(--color-terra)",
                color: "var(--color-bone)",
                fontFamily: "var(--font-mono)",
                fontSize: 9, letterSpacing: "0.14em",
                textTransform: "uppercase",
                border: "none", borderRadius: 4, cursor: "pointer",
              }}
            >
              ✓ Still OK — Continue
            </button>
            <button
              onClick={handleDecline}
              style={{
                padding: "0 14px", height: 36,
                backgroundColor: "transparent",
                color: "rgba(249,246,242,0.30)",
                fontFamily: "var(--font-mono)",
                fontSize: 9, letterSpacing: "0.12em",
                textTransform: "uppercase",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 4, cursor: "pointer",
              }}
            >
              Review
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Full first-time modal ──────────────────────────────────────────────────
  if (mode !== "full") return null;

  return (
    <AnimatePresence>
      <motion.div
        key="consent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
        style={{ backgroundColor: "rgba(10,9,7,0.94)", backdropFilter: "blur(16px)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
      >
        <motion.div
          initial={{ y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: "100%",
            maxWidth: 440,
            margin: "0 20px 20px",
            backgroundColor: "rgba(22,19,17,0.99)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 2,
          }}
        >
          {/* Back + step indicator row */}
          <div style={{
            padding: "16px 20px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            {/* Back */}
            <button
              onClick={handleDecline}
              aria-label="Go back"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(249,246,242,0.38)", padding: "4px 0",
                fontFamily: "var(--font-sans)", fontSize: 11,
                transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(249,246,242,0.70)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(249,246,242,0.38)"; }}
            >
              <ArrowLeft size={13} />
              Back
            </button>

            {/* [2] Step indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  backgroundColor: "var(--color-terra)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--color-bone)",
                }}>1</div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8,
                  color: "var(--color-terra-mid)", letterSpacing: "0.10em" }}>PRIVACY</span>
              </div>
              <div style={{ width: 16, height: 1, backgroundColor: "rgba(255,255,255,0.12)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(249,246,242,0.30)",
                }}>2</div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8,
                  color: "rgba(249,246,242,0.25)", letterSpacing: "0.10em" }}>CAMERA</span>
              </div>
            </div>
          </div>

          {/* Header */}
          <div style={{
            padding: "16px 28px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9, fontWeight: 400,
              letterSpacing: "0.20em", textTransform: "uppercase",
              color: "var(--color-terra-mid)", marginBottom: 10,
            }}>GDPR · POPIA Data Notice</p>
            <h2
              id="consent-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22, fontWeight: 400, fontStyle: "italic",
                color: "var(--color-bone)",
                letterSpacing: "-0.01em", lineHeight: 1.1,
              }}
            >
              Before you begin
            </h2>
          </div>

          {/* Disclosures */}
          <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Camera */}
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--color-terra-mid)", letterSpacing: "0.10em",
                flexShrink: 0, paddingTop: 2, minWidth: 16,
              }}>01</span>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
                  color: "rgba(249,246,242,0.82)", marginBottom: 4, lineHeight: 1.3,
                }}>Camera — processed on your device only</p>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "rgba(249,246,242,0.38)", lineHeight: 1.65,
                }}>
                  Your camera feed is analysed locally by MediaPipe. No video frames or
                  biometric data are transmitted to any server.
                </p>

                {/* [3] Expandable "Why do we need camera?" */}
                <button
                  onClick={() => setWhyOpen(v => !v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--color-terra-mid)",
                    fontFamily: "var(--font-mono)", fontSize: 8,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "8px 0 2px", transition: "color 0.15s",
                  }}
                  aria-expanded={whyOpen}
                >
                  Why do we need camera access?
                  <ChevronDown
                    size={10}
                    style={{
                      transition: "transform 0.2s",
                      transform: whyOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                <AnimatePresence>
                  {whyOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ overflow: "hidden" }}
                    >
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 10,
                        color: "rgba(249,246,242,0.32)", lineHeight: 1.70,
                        paddingTop: 6, paddingBottom: 2,
                        borderLeft: "2px solid rgba(255,255,255,0.06)",
                        paddingLeft: 10,
                      }}>
                        LUMIS uses your camera to detect 21 hand landmarks in real time using
                        Google&apos;s MediaPipe model — the same technology used in Google Meet
                        backgrounds. We identify the position and orientation of each fingertip
                        to overlay a photorealistic nail swatch directly onto your hand.
                        No pixel data ever leaves your device. The moment you close the studio,
                        processing stops completely.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Storage */}
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--color-terra-mid)", letterSpacing: "0.10em",
                flexShrink: 0, paddingTop: 2, minWidth: 16,
              }}>02</span>
              <div>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
                  color: "rgba(249,246,242,0.82)", marginBottom: 4, lineHeight: 1.3,
                }}>Cart — stored locally for 30 days</p>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "rgba(249,246,242,0.38)", lineHeight: 1.65,
                }}>
                  Product IDs and timestamps are saved to your browser&apos;s localStorage solely
                  to persist your bag. No personal identifiers, no cookies, no analytics.
                </p>
              </div>
            </div>

            {/* Controller notice */}
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 10,
              color: "rgba(249,246,242,0.22)", lineHeight: 1.65,
              paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.04)",
            }}>
              Data controller: LUMIS Couture Ltd. Consent under{" "}
              <span style={{ color: "rgba(249,246,242,0.36)" }}>GDPR Art. 6(1)(a)</span>
              {" "}and{" "}
              <span style={{ color: "rgba(249,246,242,0.36)" }}>POPIA Section 11(1)(a)</span>.{" "}
              <Link href="/privacy" style={{ color: "var(--color-terra-mid)", textDecoration: "none" }}>
                Full Privacy Policy →
              </Link>
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, padding: "0 28px 28px" }}>
            <button
              onClick={handleAccept}
              style={{
                flex: 1, height: 42,
                backgroundColor: "var(--color-terra)",
                color: "var(--color-bone)",
                fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.16em", textTransform: "uppercase",
                border: "none", borderRadius: 2, cursor: "pointer",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-terra-mid)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-terra)"; }}
            >
              I Accept — Continue
            </button>
            <button
              onClick={handleDecline}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: 42, padding: "0 18px",
                backgroundColor: "transparent",
                color: "rgba(249,246,242,0.28)",
                fontFamily: "var(--font-mono)", fontSize: 9,
                letterSpacing: "0.14em", textTransform: "uppercase",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 2, cursor: "pointer", flexShrink: 0,
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              Decline
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function useConsent() {
  const [consented, setConsented] = useState(false);
  useEffect(() => { setConsented(hasConsent()); }, []);
  return consented;
}
