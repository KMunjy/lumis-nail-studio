"use client";

/**
 * /account/loyalty — Loyalty dashboard
 *
 * Shows: tier badge · spendable balance · progress to next tier · event log
 *
 * Reads from Supabase via loyalty.ts helpers.
 * Falls back to a Bronze/zero-balance placeholder when Supabase is not configured.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import {
  TIERS,
  getTierForPoints,
  getNextTier,
  getPointsToNextTier,
  getProgressPercent,
  formatPoints,
  getLoyaltySummary,
  getLoyaltyEvents,
  EVENT_LABELS,
  EVENT_ICONS,
  type LoyaltySummary,
  type LoyaltyEvent,
} from "@/lib/loyalty";

// ─── Placeholder when not authenticated ───────────────────────────────────────

const PLACEHOLDER: LoyaltySummary = { balance: 0, lifetimePts: 0, tier: "Bronze" };

// ─── Tier Badge ────────────────────────────────────────────────────────────────

function TierBadge({ name, color }: { name: string; color: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 20,
      border: `1.5px solid ${color}`,
      backgroundColor: `${color}18`,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
      <span style={{
        fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
        color: color, letterSpacing: "0.06em",
      }}>
        {name.toUpperCase()}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const [summary, setSummary] = useState<LoyaltySummary>(PLACEHOLDER);
  const [events,  setEvents]  = useState<LoyaltyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // In production this comes from Supabase auth session
  const userId = typeof window !== "undefined"
    ? (localStorage.getItem("lumis_demo_user_id") ?? "demo-user")
    : "demo-user";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, e] = await Promise.all([
        getLoyaltySummary(userId),
        getLoyaltyEvents(userId),
      ]);
      if (!cancelled) {
        setSummary(s ?? PLACEHOLDER);
        setEvents(e);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const tier      = getTierForPoints(summary.lifetimePts);
  const nextTier  = getNextTier(summary.lifetimePts);
  const toNext    = getPointsToNextTier(summary.lifetimePts);
  const progress  = getProgressPercent(summary.lifetimePts);

  return (
    <div style={{ backgroundColor: "var(--color-bone)", minHeight: "100dvh" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Link href="/" style={{
          width: 34, height: 34, borderRadius: 4,
          border: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-ink)",
        }}>
          <ArrowLeft size={14} />
        </Link>
        <div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-pink)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            LUMIS Rewards
          </p>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "var(--color-ink)", lineHeight: 1.2 }}>
            Your Loyalty
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── Tier hero card ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 8,
            padding: 24,
            marginBottom: 16,
            border: "1px solid var(--color-border-light)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <TierBadge name={tier.name} color={tier.color} />
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 12,
                color: "var(--color-ink-light)", marginTop: 8,
              }}>
                {tier.tagline}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 28, fontWeight: 700,
                color: "var(--color-ink)", lineHeight: 1,
              }}>
                {loading ? "—" : summary.balance.toLocaleString()}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-ink-light)", marginTop: 2 }}>
                points available
              </p>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier ? (
            <div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginBottom: 6,
              }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-ink-light)" }}>
                  Progress to {nextTier.name}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--color-ink)" }}>
                  {loading ? "—" : toNext !== null ? `${formatPoints(toNext)} to go` : ""}
                </span>
              </div>
              <div style={{
                height: 6, borderRadius: 3,
                backgroundColor: "var(--color-border)",
                overflow: "hidden",
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 3, backgroundColor: tier.color }}
                />
              </div>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 10,
                color: "var(--color-ink-light)", marginTop: 6,
              }}>
                {summary.lifetimePts.toLocaleString()} / {nextTier.minPts.toLocaleString()} lifetime pts
              </p>
            </div>
          ) : (
            <div style={{
              backgroundColor: `${tier.color}14`,
              borderRadius: 4, padding: "10px 14px",
            }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: tier.color, fontWeight: 600 }}>
                ✦ You&apos;ve reached Platinum — the highest tier
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Tier benefits ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 8, padding: 20,
            marginBottom: 16,
            border: "1px solid var(--color-border-light)",
          }}
        >
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--color-ink-light)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 12 }}>
            Your benefits
          </p>
          {tier.benefits.map((b) => (
            <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <span style={{ color: tier.color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink)", lineHeight: 1.5 }}>{b}</p>
            </div>
          ))}
        </motion.div>

        {/* ── How to earn ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 8, padding: 20,
            marginBottom: 16,
            border: "1px solid var(--color-border-light)",
          }}
        >
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--color-ink-light)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 12 }}>
            Earn points
          </p>
          {([
            ["👁", "Try on a look (≥5 s)",        "+10 pts"],
            ["🛍", "Add a product to your bag",   "+50 pts"],
            ["✓",  "Complete a purchase",          "+100 pts"],
            ["↗",  "Share a look",                 "+20 pts"],
            ["★",  "Refer a friend who signs up",  "+150 pts"],
          ] as const).map(([icon, label, pts]) => (
            <div key={label} style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: "1px solid var(--color-border-light)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink)" }}>{label}</span>
              </div>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--color-pink)" }}>{pts}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Tier overview ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 8, padding: 20,
            marginBottom: 16,
            border: "1px solid var(--color-border-light)",
          }}
        >
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--color-ink-light)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 12 }}>
            Tier overview
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {TIERS.map((t) => {
              const isActive = t.name === tier.name;
              return (
                <div
                  key={t.name}
                  style={{
                    flex: 1, borderRadius: 6, padding: "10px 8px",
                    border: isActive ? `1.5px solid ${t.color}` : "1px solid var(--color-border-light)",
                    backgroundColor: isActive ? `${t.color}10` : "#FAFAFA",
                    textAlign: "center",
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: t.color, margin: "0 auto 4px" }} />
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: isActive ? 700 : 400, color: isActive ? t.color : "var(--color-ink-light)" }}>
                    {t.name}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--color-ink-light)", marginTop: 2 }}>
                    {t.minPts === 0 ? "Start" : `${t.minPts}+`}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Recent events ────────────────────────────────────────────────── */}
        {events.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 8, padding: 20,
              border: "1px solid var(--color-border-light)",
            }}
          >
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--color-ink-light)", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 12 }}>
              Recent activity
            </p>
            {events.map((ev) => (
              <div key={ev.id} style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border-light)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{EVENT_ICONS[ev.eventType]}</span>
                  <div>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink)" }}>
                      {EVENT_LABELS[ev.eventType]}
                    </p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-ink-light)", marginTop: 2 }}>
                      {new Date(ev.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                  color: ev.pointsDelta >= 0 ? "var(--color-pink)" : "#9CA3AF",
                }}>
                  {ev.pointsDelta >= 0 ? "+" : ""}{ev.pointsDelta} pts
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
