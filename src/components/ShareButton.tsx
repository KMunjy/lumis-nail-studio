"use client";

/**
 * ShareButton  v2.0
 *
 * Thin wrapper that opens the multi-platform ShareSheet.
 *
 * variant="icon"  — compact 28×28 WhatsApp-green bubble (catalogue cards)
 * variant="full"  — 46 px tall "Share Look" button (capture preview modal)
 *
 * v2.0 changes (Sprint 3):
 *   - Delegates to <ShareSheet> for platform selection
 *   - Supports WhatsApp, X, Pinterest, Copy Link
 *   - "icon" variant still directly opens WhatsApp to avoid an extra tap
 */

import { useState, useCallback } from "react";
import { ShareSheet } from "@/components/ShareSheet";

interface ShareButtonProps {
  productId:             string;
  productName:           string;
  capturedImageDataUrl?: string;
  variant?:              "icon" | "full";
}

// WhatsApp icon SVG (kept in icon variant for the green bubble)
const WhatsAppIcon = (size: number) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
    <path
      d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z"
      fill="white" fillOpacity="0.92"
    />
    <path
      d="M16.75 14.68c-.26-.13-1.54-.76-1.78-.84-.24-.09-.41-.13-.58.13-.17.26-.66.84-.81 1.01-.15.17-.3.19-.56.06a7.07 7.07 0 0 1-2.08-1.28 7.8 7.8 0 0 1-1.44-1.79c-.15-.26-.02-.4.11-.53.12-.11.26-.3.39-.45.13-.15.17-.26.26-.43.08-.17.04-.32-.02-.45-.06-.13-.58-1.4-.8-1.91-.21-.5-.43-.43-.58-.44H9.4c-.15 0-.39.06-.6.28-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.4 3.8 3.36.53.23.94.37 1.26.47.53.17 1.01.15 1.39.09.42-.06 1.3-.53 1.48-1.04.18-.51.18-.95.13-1.04-.06-.09-.22-.15-.48-.28Z"
      fill="#25D366"
    />
  </svg>
);

export function ShareButton({
  productId,
  productName,
  capturedImageDataUrl,
  variant = "icon",
}: ShareButtonProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Icon variant: direct WhatsApp (one-tap, no sheet needed)
    const message = `Hey 👀 I'm trying on ${productName} by LUMIS — what do you think?\n\nTry it live → https://lumisbeauty.com/studio/${productId}?ref=wa-share`;
    if (typeof navigator !== "undefined" && navigator.share && capturedImageDataUrl) {
      navigator.share({ title: "LUMIS Try-On", text: message }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    }
  }, [productId, productName, capturedImageDataUrl]);

  if (variant === "icon") {
    return (
      <button
        onClick={handleIconClick}
        aria-label="Share on WhatsApp"
        style={{
          position: "absolute", top: 8, left: 8, zIndex: 2,
          width: 28, height: 28, borderRadius: "50%",
          backgroundColor: "#25D366", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "background-color 0.15s, transform 0.15s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "#1ebe5d";
          (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "#25D366";
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
        }}
      >
        {WhatsAppIcon(14)}
      </button>
    );
  }

  // variant === "full" — opens multi-platform ShareSheet
  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Share this look"
        style={{
          width: "100%", height: 46,
          backgroundColor: "#FFFFFF",
          border: "1px solid var(--color-border)",
          borderRadius: 4, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
          color: "var(--color-ink)",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-surface)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#FFFFFF"; }}
      >
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share Look
      </button>

      <ShareSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        productId={productId}
        productName={productName}
        capturedImageDataUrl={capturedImageDataUrl}
      />
    </>
  );
}
