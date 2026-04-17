"use client";

/**
 * CreatorBanner — Feature 4 (Creator Collab)
 * Shown at the top of the studio when a ?creator= param is present.
 * z-index: 35 — above studio bars (z-30), below capture modal (z-60).
 */

import { X, Star } from "lucide-react";
import { motion } from "framer-motion";

interface CreatorBannerProps {
  creatorName: string;
  productName: string;
  onDismiss:   () => void;
}

export function CreatorBanner({ creatorName, productName, onDismiss }: CreatorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "relative",
        zIndex: 35,
        backgroundColor: "var(--color-pink)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
      }}
    >
      <Star size={13} style={{ color: "#FFFFFF", flexShrink: 0 }} />

      <p style={{
        flex: 1,
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 500,
        color: "#FFFFFF",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        Curated by <strong>{creatorName}</strong>
        {productName && (
          <span style={{
            marginLeft: 8,
            backgroundColor: "rgba(255,255,255,0.25)",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: 11,
          }}>
            {productName}
          </span>
        )}
      </p>

      <button
        onClick={onDismiss}
        aria-label="Dismiss creator banner"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.80)",
          display: "flex",
          alignItems: "center",
          padding: 2,
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
