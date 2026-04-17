/**
 * /trends — Trend Board  (Feature 3)
 *
 * Four seasonal trend collections, each with a hero band and
 * a horizontal-scroll strip of curated NailSwatch cards.
 */

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { TrendCard } from "@/components/TrendCard";
import { trendCollections } from "@/data/trends";

export default function TrendsPage() {
  return (
    <div style={{ backgroundColor: "#FAFAFA", minHeight: "100dvh", paddingBottom: 80 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
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
              Trend Board
            </p>
            <h1 style={{
              fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700,
              color: "var(--color-ink)", lineHeight: 1.2,
            }}>
              What&rsquo;s Trending Now
            </h1>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            backgroundColor: "var(--color-pink-pale)",
            borderRadius: 8, padding: "5px 10px",
          }}>
            <Sparkles size={13} style={{ color: "var(--color-pink)" }} />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
              color: "var(--color-pink)",
            }}>
              {trendCollections.length} Collections
            </span>
          </div>
        </div>
      </div>

      {/* ── Seasonal collections ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {trendCollections.map((collection) => (
          <section key={collection.id} style={{ marginBottom: 32 }}>

            {/* Hero band */}
            <div style={{
              background: `linear-gradient(135deg, ${collection.heroFrom} 0%, ${collection.heroTo} 100%)`,
              padding: "20px 20px 16px",
            }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                color: "rgba(255,255,255,0.80)", letterSpacing: "0.10em",
                textTransform: "uppercase", marginBottom: 4,
              }}>
                {collection.season}
              </p>
              <h2 style={{
                fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700,
                color: "#FFFFFF", lineHeight: 1.25, marginBottom: 6,
              }}>
                {collection.tagline}
              </h2>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11,
                color: "rgba(255,255,255,0.75)",
              }}>
                {collection.entries.length} curated shades — tap any to try on
              </p>
            </div>

            {/* Horizontal scroll strip */}
            <div style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              padding: "16px 20px",
              display: "flex",
              gap: 12,
            }}>
              {collection.entries.map((entry) => (
                <TrendCard key={entry.productId} entry={entry} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
