"use client";

/**
 * CommunityCard — Feature 2 (Community Feed)
 * Displays an anonymised look from the community feed.
 */

import Link from "next/link";
import { Heart } from "lucide-react";
import { NailSwatch } from "@/components/NailSwatch";
import type { FeedEntry } from "@/data/community-feed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CommunityCardProps {
  entry: FeedEntry;
}

export function CommunityCard({ entry }: CommunityCardProps) {
  const avatarBg = `hsl(${entry.avatarHue}, 60%, 70%)`;

  return (
    <div style={{
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      border: "1px solid var(--color-border-light)",
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 8,
        borderBottom: "1px solid var(--color-border-light)",
      }}>
        {/* Avatar circle */}
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          backgroundColor: avatarBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700,
            color: "#FFFFFF",
          }}>
            {entry.handle.slice(1, 2).toUpperCase()}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
            color: "var(--color-ink)", whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {entry.handle}
          </p>
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 9,
            color: "var(--color-ink-light)", marginTop: 1,
          }}>
            {timeAgo(entry.postedAt)}
          </p>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 3,
          color: "var(--color-ink-light)",
        }}>
          <Heart size={11} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 10 }}>
            {entry.likeCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Swatch */}
      <div style={{
        padding: "16px 12px 12px",
        display: "flex", justifyContent: "center",
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

      {/* Caption */}
      <div style={{ padding: "0 12px 4px" }}>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 11,
          color: "var(--color-ink)", lineHeight: 1.5,
          fontStyle: "normal",
        }}>
          {entry.caption}
        </p>
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 12px 12px" }}>
        <Link
          href={`/studio/${entry.productId}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
            color: "var(--color-pink)", textDecoration: "none",
          }}
        >
          Try {entry.productName} →
        </Link>
      </div>
    </div>
  );
}
