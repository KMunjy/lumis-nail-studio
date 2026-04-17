"use client";

/**
 * LookShareCard — Feature 1 (Share a Look)
 * Composites a branded share card from a SavedLook and invokes
 * the Web Share API (Level 2) or falls back to <a download>.
 *
 * z-index: 85 — above toast (z-80), below Try On Live pill (z-90).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Share2, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SavedLook } from "@/lib/saved-looks";

// ─── Canvas card compositor ───────────────────────────────────────────────────

const CARD_W = 360;
const CARD_H = 480;

async function compositeCard(look: SavedLook): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width  = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) { resolve(null); return; }

    // ── White card background ──
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // ── Pink header band ──
    ctx.fillStyle = "#F43F78";          // var(--color-pink)
    ctx.fillRect(0, 0, CARD_W, 64);

    // ── LUMIS wordmark ──
    ctx.fillStyle = "#FFFFFF";
    ctx.font      = "700 28px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LUMIS", CARD_W / 2, 32);

    // ── Captured image ──
    const drawText = () => {
      // Product name
      ctx.fillStyle = "#1A1A1A";
      ctx.font      = "600 20px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(look.productName, CARD_W / 2, 368);

      // Shape · Finish
      ctx.fillStyle = "#666666";
      ctx.font      = "400 14px 'DM Sans', sans-serif";
      ctx.fillText(`${look.shape} · ${look.finish}`, CARD_W / 2, 396);

      // Footer
      ctx.fillStyle = "#AAAAAA";
      ctx.font      = "400 11px 'DM Sans', sans-serif";
      ctx.fillText("lumis.beauty — Virtual Nail Try-On", CARD_W / 2, 446);

      // Border
      ctx.strokeStyle = "#F0F0F0";
      ctx.lineWidth   = 1;
      ctx.strokeRect(0, 0, CARD_W, CARD_H);

      canvas.toBlob((blob) => resolve(blob), "image/png");
    };

    if (look.imageUrl && look.imageUrl.startsWith("data:")) {
      const img = new Image();
      img.onload = () => {
        // Draw image centred between header and footer
        const imgAreaTop  = 72;
        const imgAreaH    = 288;
        const imgAreaW    = CARD_W - 40;
        // Cover-fit
        const scale = Math.max(imgAreaW / img.width, imgAreaH / img.height);
        const drawW = img.width  * scale;
        const drawH = img.height * scale;
        const dx    = 20 + (imgAreaW - drawW) / 2;
        const dy    = imgAreaTop + (imgAreaH - drawH) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(20, imgAreaTop, imgAreaW, imgAreaH);
        ctx.clip();
        ctx.drawImage(img, dx, dy, drawW, drawH);
        ctx.restore();
        drawText();
      };
      img.onerror = drawText;
      img.src = look.imageUrl;
    } else {
      // No image — just the branded card with shade info
      drawText();
    }
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LookShareCardProps {
  look:   SavedLook;
  onDone: () => void;
}

type ShareState = "idle" | "compositing" | "ready" | "sharing" | "done" | "error";

export function LookShareCard({ look, onDone }: LookShareCardProps) {
  const [status, setStatus]     = useState<ShareState>("idle");
  const [previewUrl, setPreview] = useState<string | null>(null);
  const blobRef                  = useRef<Blob | null>(null);

  // Composite on mount
  useEffect(() => {
    setStatus("compositing");
    compositeCard(look).then((blob) => {
      if (!blob) { setStatus("error"); return; }
      blobRef.current = blob;
      setPreview(URL.createObjectURL(blob));
      setStatus("ready");
    });
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.id]);

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  const handleShare = useCallback(async () => {
    if (!blobRef.current) return;
    setStatus("sharing");

    if (canNativeShare) {
      try {
        const file = new File([blobRef.current], `lumis-${look.productName}.png`, { type: "image/png" });
        await navigator.share({
          title: `My ${look.productName} look — LUMIS`,
          text:  `Just tried on ${look.productName} (${look.shape} · ${look.finish}) on LUMIS! 💅`,
          files: [file],
        });
        setStatus("done");
        setTimeout(onDone, 800);
        return;
      } catch {
        // User cancelled or share failed — fall through to download
      }
    }

    // Download fallback
    const a = document.createElement("a");
    a.href     = URL.createObjectURL(blobRef.current);
    a.download = `lumis-${look.productName.replace(/\s+/g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("done");
    setTimeout(onDone, 600);
  }, [look, canNativeShare, onDone]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="share-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          zIndex: 85,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
        onClick={onDone}
      >
        {/* Card panel */}
        <motion.div
          key="share-card"
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            width: "100%",
            maxWidth: 360,
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
          }}
        >
          {/* Panel header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--color-border-light)",
          }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>
              Share Your Look
            </p>
            <button
              onClick={onDone}
              aria-label="Close"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-ink-light)" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Preview */}
          <div style={{
            padding: "16px",
            minHeight: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FAFAFA",
          }}>
            {status === "compositing" && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-light)" }}>
                Creating your card…
              </p>
            )}
            {status === "error" && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#DC2626" }}>
                Could not create share card. Try downloading the image directly.
              </p>
            )}
            {(status === "ready" || status === "sharing" || status === "done") && previewUrl && (
              <img
                src={previewUrl}
                alt="Share card preview"
                style={{ width: "100%", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
              />
            )}
            {status === "done" && (
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.8)",
              }}>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--color-pink)" }}>
                  Shared! 💅
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: "12px 16px 16px", display: "flex", gap: 8 }}>
            <button
              onClick={handleShare}
              disabled={status !== "ready"}
              style={{
                flex: 1, height: 40, borderRadius: 8,
                backgroundColor: status === "ready" ? "var(--color-pink)" : "#E5E7EB",
                color: status === "ready" ? "#FFFFFF" : "#9CA3AF",
                border: "none", cursor: status === "ready" ? "pointer" : "default",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "background-color 0.15s",
              }}
            >
              {canNativeShare ? <Share2 size={14} /> : <Download size={14} />}
              {canNativeShare ? "Share" : "Download"}
            </button>
          </div>

          {/* Product info */}
          <div style={{
            padding: "0 16px 14px",
            fontFamily: "var(--font-sans)", fontSize: 11,
            color: "var(--color-ink-light)", textAlign: "center",
          }}>
            {look.productName} · {look.shape} · {look.finish}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
