"use client";

/**
 * /auth — LUMIS authentication  v3.0
 *
 * v3.0 improvements (competitive analysis sprint):
 *  [CA-1] Intent hook — 1-question step before auth captures occasion/goal,
 *          stored to localStorage for personalised onboarding
 *  [CA-2] Google + Apple SSO as primary CTAs; email collapses to secondary
 *  [CA-3] Email magic-link remains for users who prefer it
 */

import { useState, useEffect } from "react";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Mail, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Intent options ────────────────────────────────────────────────────────────

const INTENT_OPTIONS = [
  { id: "occasion",   emoji: "🥂", label: "Special occasion",    sub: "Wedding, event, night out" },
  { id: "explore",    emoji: "🎨", label: "Exploring shades",    sub: "Not sure yet — just browsing" },
  { id: "collection", emoji: "💅", label: "Building my look",    sub: "I have colours in mind" },
  { id: "gift",       emoji: "🎁", label: "Finding a gift",      sub: "For someone I love" },
] as const;

type IntentId = typeof INTENT_OPTIONS[number]["id"];

// ─── SVG logos (inline — no external deps) ────────────────────────────────────

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-32.8-155.5-127.4C46 370.8 45 274 45 258.3c0-11.6 2-23.2 3.2-34.8 20.7-190.5 155.5-291.2 268.5-302.7C315.9 8.6 350.4 0 384.7 0c25.5 0 70.1 13.6 97.8 23.2 27.7 9.7 54.2 19.3 72.8 19.3 11 0 35.1-5.8 58.3-16.7C638.3 12.8 665.1 0 693.9 0c4.5 0 97.2 1.3 159.1 83.2C847.5 97.5 788.1 340.9 788.1 340.9z"/>
    </svg>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type AuthStep = "intent" | "auth";

// ─── Inner component (uses useSearchParams — must be inside Suspense) ──────────

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step,        setStep]        = useState<AuthStep>("intent");
  const [intent,      setIntent]      = useState<IntentId | null>(null);
  const [email,       setEmail]       = useState("");
  const [submitted,   setSubmitted]   = useState(false);
  const [error,       setError]       = useState("");
  const [showEmail,   setShowEmail]   = useState(false);
  const [ssoLoading,  setSsoLoading]  = useState<"google" | "apple" | null>(null);
  const [urlError,    setUrlError]    = useState<string | null>(null);

  // DEF-002: read ?error= from callback redirect (e.g. expired magic link)
  useEffect(() => {
    const e = searchParams.get("error");
    if (e) { setUrlError(decodeURIComponent(e)); setStep("auth"); }
  }, [searchParams]);

  // ── Intent step ─────────────────────────────────────────────────────────────

  const handleIntentSelect = (id: IntentId) => {
    setIntent(id);
    // Persist for personalised welcome
    try { localStorage.setItem("lumis_intent", id); } catch { /* ignore */ }
    setTimeout(() => setStep("auth"), 220);
  };

  // ── SSO handlers ─────────────────────────────────────────────────────────────

  const handleSSO = async (provider: "google" | "apple") => {
    setSsoLoading(provider);
    if (
      typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        );
        await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: `${window.location.origin}/auth/callback?next=/account/loyalty` },
        });
        // Redirects; no further code needed
        return;
      } catch (err) {
        console.warn(`[auth] ${provider} SSO failed:`, err);
      }
    } else {
      // Dev / demo — simulate redirect
      console.info(`[auth] Supabase not configured — simulating ${provider} SSO.`);
      await new Promise((r) => setTimeout(r, 800));
      router.push("/");
    }
    setSsoLoading(null);
  };

  // ── Email magic-link handler ──────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    setError("");

    if (
      typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        );
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account/loyalty` },
        });
        if (otpError) { setError(otpError.message); return; }
      } catch (err) {
        console.warn("[auth] signInWithOtp failed:", err);
      }
    } else {
      console.info("[auth] Supabase not configured — simulating magic-link send.");
    }

    setSubmitted(true);
  };

  // ── Shared panel styles ───────────────────────────────────────────────────────

  const ssoBtn = (
    label: string,
    provider: "google" | "apple",
    icon: React.ReactNode,
    bg: string,
    color: string,
    border: string,
  ) => (
    <button
      onClick={() => handleSSO(provider)}
      disabled={ssoLoading !== null}
      style={{
        width: "100%",
        height: 50,
        backgroundColor: bg,
        color,
        border,
        borderRadius: 2,
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "0.04em",
        cursor: ssoLoading !== null ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: ssoLoading !== null && ssoLoading !== provider ? 0.5 : 1,
        transition: "opacity 0.15s, background-color 0.2s",
      }}
    >
      {ssoLoading === provider ? (
        <span style={{ width: 18, height: 18, border: `2px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
      ) : icon}
      {label}
    </button>
  );

  return (
    <div
      style={{ backgroundColor: "var(--color-bone)", minHeight: "100dvh" }}
      className="flex flex-col md:flex-row"
    >
      {/* ── Left — editorial brand panel ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          backgroundColor: "var(--color-ink)",
          flex: "0 0 45%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 48px",
          minHeight: "40vh",
        }}
        className="hidden md:flex"
      >
        <div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, letterSpacing: "0.22em", color: "var(--color-bone)", fontVariant: "small-caps" }}>
            LUMIS
          </span>
        </div>

        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--color-stone)", textTransform: "uppercase", letterSpacing: "0.24em", marginBottom: 28 }}>
            Virtual Nail Studio
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.8rem, 4vw, 4.5rem)", fontWeight: 300, fontStyle: "italic", color: "var(--color-bone)", lineHeight: 0.96, letterSpacing: "-0.02em", marginBottom: 28 }}>
            Colour finds<br />
            <span style={{ color: "var(--color-terra-mid)" }}>you.</span>
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 300, color: "var(--color-stone)", lineHeight: 1.7, maxWidth: 320 }}>
            Try any shade live on your hand — no guessing, no swatches on the back of a wrist. Real-time AR, real decisions.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[{ top: "#3D1F4A", bot: "#1A0F1E" }, { top: "#FFD6E4", bot: "#C06080" }, { top: "#FFFFFF", bot: "#D0A896" }, { top: "#F5D060", bot: "#7A5E00" }, { top: "#E8E8E8", bot: "#707070" }].map((s, i) => (
            <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(160deg, ${s.top}, ${s.bot})`, border: "1px solid rgba(249,246,242,0.1)" }} />
          ))}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--color-stone)", textTransform: "uppercase", letterSpacing: "0.18em", marginLeft: 8 }}>12+ shades</span>
        </div>
      </motion.div>

      {/* ── Right — form panel ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "48px 32px", overflow: "hidden" }}>

        {/* Mobile logo */}
        <div className="md:hidden mb-10">
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, letterSpacing: "0.22em", color: "var(--color-ink)", fontVariant: "small-caps" }}>LUMIS</span>
        </div>

        <div style={{ width: "100%", maxWidth: 380 }}>
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Intent hook ─────────────────────────────────── */}
            {step === "intent" && (
              <motion.div
                key="intent"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="label-cap" style={{ marginBottom: 12 }}>Quick question</p>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.9rem, 5vw, 2.8rem)", fontWeight: 300, fontStyle: "italic", color: "var(--color-ink)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 32 }}>
                  What brings you<br />to LUMIS?
                </h1>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {INTENT_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleIntentSelect(opt.id)}
                      style={{
                        width: "100%",
                        padding: "14px 18px",
                        backgroundColor: intent === opt.id ? "var(--color-terra-light)" : "#FFFFFF",
                        border: `1px solid ${intent === opt.id ? "var(--color-terra)" : "var(--color-parchment)"}`,
                        borderRadius: 2,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        textAlign: "left",
                        transition: "border-color 0.15s, background-color 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 22, lineHeight: 1 }}>{opt.emoji}</span>
                      <div>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--color-ink)", marginBottom: 1 }}>{opt.label}</p>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 300, color: "var(--color-stone)", letterSpacing: "0.02em" }}>{opt.sub}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <button
                    onClick={() => setStep("auth")}
                    style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 400, color: "var(--color-sand)", letterSpacing: "0.08em", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: Auth ────────────────────────────────────────── */}
            {step === "auth" && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="label-cap" style={{ marginBottom: 12 }}>
                  {intent ? `${INTENT_OPTIONS.find(o => o.id === intent)?.emoji} ${INTENT_OPTIONS.find(o => o.id === intent)?.label}` : "Begin your look"}
                </p>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 300, fontStyle: "italic", color: "var(--color-ink)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 32 }}>
                  Welcome<br />to the studio.
                </h1>

                {/* DEF-002: URL error from /auth/callback (e.g. expired link) */}
                {urlError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "14px 16px", marginBottom: 20,
                      backgroundColor: "#FFF0F0",
                      border: "1px solid var(--color-terra)",
                      borderRadius: 2,
                    }}
                  >
                    <AlertCircle size={14} style={{ color: "var(--color-terra)", flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-terra)", lineHeight: 1.5, margin: 0 }}>
                      {urlError}
                    </p>
                  </motion.div>
                )}

                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ padding: "24px", backgroundColor: "var(--color-terra-light)", border: "1px solid var(--color-terra)", borderRadius: 2, textAlign: "center" }}
                  >
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontStyle: "italic", color: "var(--color-terra)" }}>Opening studio…</p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-stone)", marginTop: 8 }}>Check your inbox for the magic link.</p>
                  </motion.div>
                ) : (
                  <>
                    {/* ── Primary SSO CTAs ───────────────────────────── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                      {ssoBtn("Continue with Google", "google", <GoogleLogo />, "#FFFFFF", "#1F1F1F", "1px solid #DADCE0")}
                      {ssoBtn("Continue with Apple",  "apple",  <AppleLogo />, "#000000", "#FFFFFF", "1px solid #000000")}
                    </div>

                    {/* ── Divider ────────────────────────────────────── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-parchment)" }} />
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-sand)", letterSpacing: "0.14em", textTransform: "uppercase" }}>or</p>
                      <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-parchment)" }} />
                    </div>

                    {/* ── Email collapse toggle ──────────────────────── */}
                    <button
                      onClick={() => setShowEmail(v => !v)}
                      style={{
                        width: "100%",
                        height: 44,
                        backgroundColor: "transparent",
                        border: "1px solid var(--color-parchment)",
                        borderRadius: 2,
                        fontFamily: "var(--font-sans)",
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--color-stone)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        letterSpacing: "0.04em",
                      }}
                    >
                      <Mail size={13} />
                      Continue with email
                      {showEmail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {/* ── Email form (collapsible) ───────────────────── */}
                    <AnimatePresence>
                      {showEmail && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                            <div>
                              <label htmlFor="email" className="label-cap" style={{ display: "block", marginBottom: 6 }}>Email address</label>
                              <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                                placeholder="you@example.com"
                                style={{
                                  width: "100%",
                                  padding: "12px 16px",
                                  backgroundColor: "#FFFFFF",
                                  border: `1px solid ${error ? "var(--color-terra)" : "var(--color-parchment)"}`,
                                  borderRadius: 2,
                                  fontFamily: "var(--font-sans)",
                                  fontSize: 14,
                                  fontWeight: 300,
                                  color: "var(--color-charcoal)",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-terra)"; }}
                                onBlur={(e)  => { e.currentTarget.style.borderColor = error ? "var(--color-terra)" : "var(--color-parchment)"; }}
                              />
                              {error && (
                                <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-terra)", letterSpacing: "0.04em", marginTop: 5 }}>{error}</p>
                              )}
                            </div>
                            <button
                              type="submit"
                              style={{
                                width: "100%",
                                height: 48,
                                backgroundColor: "var(--color-terra)",
                                color: "var(--color-bone)",
                                fontFamily: "var(--font-sans)",
                                fontSize: 11,
                                fontWeight: 500,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                borderRadius: 2,
                                border: "none",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                              }}
                            >
                              Send magic link
                              <ArrowRight size={13} />
                            </button>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* ── Guest link ─────────────────────────────────────── */}
                <div style={{ marginTop: 28, textAlign: "center" }}>
                  <Link
                    href="/"
                    style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 400, color: "var(--color-stone)", letterSpacing: "0.08em", textDecoration: "underline", textUnderlineOffset: 3 }}
                    className="hover:text-[#2C2420]"
                  >
                    Continue as guest
                  </Link>
                </div>

                {/* ── Back to intent ─────────────────────────────────── */}
                <div style={{ marginTop: 8, textAlign: "center" }}>
                  <button
                    onClick={() => setStep("intent")}
                    style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-sand)", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.06em" }}
                  >
                    ← Change
                  </button>
                </div>

                <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 300, color: "var(--color-sand)", lineHeight: 1.6, marginTop: 32, textAlign: "center" }}>
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Spin keyframe for SSO loading indicator */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Page export — wraps inner in Suspense (required for useSearchParams) ────

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--color-pink)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    }>
      <AuthPageInner />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Suspense>
  );
}
