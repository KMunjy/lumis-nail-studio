/**
 * /community — Community Feed  (Feature 2)
 *
 * Static, anonymised showcase of community looks.
 * No real user data — all entries are synthetic seed data.
 */

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { CommunityCard } from "@/components/CommunityCard";
import { communityFeed } from "@/data/community-feed";

export default function CommunityPage() {
  return (
    <div style={{ backgroundColor: "#FAFAFA", minHeight: "100dvh", paddingBottom: 80 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{
            width: 34, height: 34, borderRadius: 6,
            border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-ink)", textDecoration: "none",
            backgroundColor: "#FFFFFF",
          }}>
            <ArrowLeft size={16} />
          </Link>

          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600,
              color: "var(--color-pink)", letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 1,
            }}>
              Community
            </p>
            <h1 style={{
              fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700,
              color: "var(--color-ink)", lineHeight: 1.2,
            }}>
              Real Looks, Real Hands
            </h1>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            backgroundColor: "var(--color-pink-pale)",
            borderRadius: 8, padding: "5px 10px",
          }}>
            <Users size={13} style={{ color: "var(--color-pink)" }} />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
              color: "var(--color-pink)",
            }}>
              {communityFeed.length.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Intro ────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 20px 4px" }}>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 12,
          color: "var(--color-ink-light)", lineHeight: 1.6,
        }}>
          Try any look you see. Every shade links directly to the studio.
        </p>
      </div>

      {/* ── Feed grid ────────────────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 600, margin: "0 auto",
        padding: "12px 20px",
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 12,
      }}>
        {communityFeed.map((entry) => (
          <CommunityCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
