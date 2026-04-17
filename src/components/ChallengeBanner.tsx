"use client";

/**
 * ChallengeBanner — Feature 5 (Challenge Mode)
 * Floating bottom banner on the home page for the active weekly challenge.
 * z-index: 45 — above studio bars (z-30), below capture modal (z-60).
 */

import Link from "next/link";
import { X, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import type { Challenge } from "@/data/challenges";

interface ChallengeBannerProps {
  challenge: Challenge;
  onDismiss: () => void;
}

export function ChallengeBanner({ challenge, onDismiss }: ChallengeBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        bottom: 80,               // above BottomNav (~56px) + gap
        left: 16,
        right: 16,
        zIndex: 45,
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid var(--color-border-light)",
        overflow: "hidden",
      }}
    >
      {/* Accent stripe */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${challenge.shadeHex} 0%, var(--color-pink) 100%)`,
      }} />

      <div style={{ padding: "12px 14px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            backgroundColor: "var(--color-pink-pale)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Trophy size={15} style={{ color: "var(--color-pink)" }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 700,
              color: "var(--color-pink)", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 2,
            }}>
              This Week&rsquo;s Challenge · {challenge.weekLabel}
            </p>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
              color: "var(--color-ink)", lineHeight: 1.4,
            }}>
              {challenge.prompt}
            </p>
          </div>

          <button
            onClick={onDismiss}
            aria-label="Dismiss challenge"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-ink-light)", padding: 2, flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 10, paddingLeft: 38 }}>
          <Link
            href={`/challenge/${challenge.slug}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              backgroundColor: "var(--color-pink)",
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
              padding: "7px 14px", borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Try the Look →
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
