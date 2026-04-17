"use client";

/**
 * TrendCard — Feature 3 (Trend Board)
 * Displays a single curated entry within a trend collection.
 */

import Link from "next/link";
import { NailSwatch } from "@/components/NailSwatch";
import type { TrendEntry } from "@/data/trends";

// Finish → single letter badge (mirrors ShadeSelector pattern)
const FINISH_SHORT: Record<string, string> = {
  Gloss: "G", Matte: "M", Metallic: "Me", Chrome: "Ch",
  Jelly: "J", Glitter: "Gl", CatEye: "CE",
};
const FINISH_COLOR: Record<string, string> = {
  Gloss:    "#60a5fa",
  Matte:    "#a78bfa",
  Metallic: "#fbbf24",
  Chrome:   "#94a3b8",
  Jelly:    "#34d399",
  Glitter:  "#f472b6",
  CatEye:   "#fb923c",
};

interface TrendCardProps {
  entry: TrendEntry;
}

export function TrendCard({ entry }: TrendCardProps) {
  const badgeColor = FINISH_COLOR[entry.finish] ?? "#94a3b8";
  const badgeLetter = FINISH_SHORT[entry.finish] ?? entry.finish[0];

  return (
    <Link
      href={`/studio/${entry.productId}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div style={{
        width: 140,
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        border: "1px solid var(--color-border-light)",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.18s, transform 0.18s",
        cursor: "pointer",
        flexShrink: 0,
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        {/* Swatch area */}
        <div style={{
          padding: "14px 14px 10px",
          display: "flex", justifyContent: "center",
          backgroundColor: "#FAFAFA",
        }}>
          <NailSwatch
            shape={entry.shape}
            finish={entry.finish}
            topColor={entry.topColor}
            midColor={entry.midColor}
            bottomColor={entry.bottomColor}
            skinToneHex={entry.skinToneHex}
            glitterDensity={entry.glitterDensity}
            catEyeDir={entry.catEyeDir}
            size="lg"
          />
        </div>

        {/* Info */}
        <div style={{ padding: "8px 10px 10px" }}>
          {/* Finish badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              backgroundColor: badgeColor, flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
              color: badgeColor, letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>
              {badgeLetter} · {entry.finish}
            </span>
          </div>

          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
            color: "var(--color-ink)", marginBottom: 4,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {entry.productName}
          </p>

          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 9,
            color: "var(--color-ink-light)", lineHeight: 1.4,
            fontStyle: "italic",
          }}>
            {entry.curatorNote}
          </p>
        </div>
      </div>
    </Link>
  );
}
