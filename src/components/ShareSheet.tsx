"use client";

/**
 * ShareSheet — Multi-platform share bottom-sheet  v1.0
 *
 * Platforms supported:
 *   Native   — navigator.share() when available (iOS/Android)
 *   WhatsApp — wa.me intent URL
 *   X        — x.com/intent/tweet
 *   Pinterest — pinterest.com/pin/create/button
 *   Clipboard — navigator.clipboard.writeText()
 *
 * Referral tracking:
 *   All share links append ?ref=<platform>-share so the /api/referral route
 *   can attribute click-throughs. The ref query param is also logged via
 *   the referral_clicks Supabase table.
 *
 * Usage:
 *   <ShareSheet
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     productId="lume-09"
 *     productName="Galaxy Dust"
 *     capturedImageDataUrl={dataUrl}
 *   />
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

// ─── Platform descriptors ─────────────────────────────────────────────────────

interface Platform {
  id:      string;
  label:   string;
  color:   string;
  icon:    React.ReactNode;
  /** Build the share URL or action for this platform. */
  share:   (message: string, url: string) => void;
}

function buildMessage(productName: string, productId: string, refSource: string): string {
  return `I'm trying on ${productName} by LUMIS — see how it looks on my hand →\nhttps://lumisbeauty.com/studio/${productId}?ref=${refSource}`;
}

// ─── SVG Icons (inline — no icon lib dep for share logos) ─────────────────────

const WhatsAppSVG = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z" fill="currentColor" />
    <path d="M16.75 14.68c-.26-.13-1.54-.76-1.78-.84-.24-.09-.41-.13-.58.13-.17.26-.66.84-.81 1.01-.15.17-.3.19-.56.06a7.07 7.07 0 0 1-2.08-1.28 7.8 7.8 0 0 1-1.44-1.79c-.15-.26-.02-.4.11-.53.12-.11.26-.3.39-.45.13-.15.17-.26.26-.43.08-.17.04-.32-.02-.45-.06-.13-.58-1.4-.8-1.91-.21-.5-.43-.43-.58-.44H9.4c-.15 0-.39.06-.6.28-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.4 3.8 3.36.53.23.94.37 1.26.47.53.17 1.01.15 1.39.09.42-.06 1.3-.53 1.48-1.04.18-.51.18-.95.13-1.04-.06-.09-.22-.15-.48-.28Z" fill="white" />
  </svg>
);

const XSVG = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L2.25 2.25h6.865l4.263 5.636L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
);

const PinterestSVG = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0Z" />
  </svg>
);

const CopySVG = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShareSheetProps {
  open:                  boolean;
  onClose:               () => void;
  productId:             string;
  productName:           string;
  capturedImageDataUrl?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareSheet({
  open,
  onClose,
  productId,
  productName,
  capturedImageDataUrl,
}: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Log referral click to API (fire-and-forget)
  const logReferral = useCallback((source: string) => {
    fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, refSource: source }),
    }).catch(() => {/* non-critical */});
  }, [productId]);

  const platforms: Platform[] = [
    {
      id:    "whatsapp",
      label: "WhatsApp",
      color: "#25D366",
      icon:  WhatsAppSVG,
      share: (msg) => {
        logReferral("wa-share");
        // Try Web Share API first (gives native share sheet on mobile)
        if (typeof navigator !== "undefined" && navigator.share) {
          navigator.share({ title: "LUMIS Try-On", text: msg }).catch(() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
          });
        } else {
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
        }
      },
    },
    {
      id:    "x",
      label: "X  (Twitter)",
      color: "#000000",
      icon:  XSVG,
      share: (msg) => {
        logReferral("x-share");
        window.open(
          `https://x.com/intent/tweet?text=${encodeURIComponent(msg)}`,
          "_blank", "noopener,noreferrer,width=600,height=450",
        );
      },
    },
    {
      id:    "pinterest",
      label: "Pinterest",
      color: "#E60023",
      icon:  PinterestSVG,
      share: (_msg, url) => {
        logReferral("pin-share");
        // Pinterest pin from URL — image is optional (they'll crawl OG tags)
        const pinUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(`Try on ${productName} by LUMIS ✨`)}`;
        window.open(pinUrl, "_blank", "noopener,noreferrer,width=750,height=550");
      },
    },
    {
      id:    "copy",
      label: copied ? "Copied!" : "Copy Link",
      color: copied ? "#22C55E" : "#6B7280",
      icon:  copied ? <Check size={20} /> : CopySVG,
      share: (_msg, url) => {
        logReferral("copy");
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
          // Fallback for browsers without clipboard API
          const el = document.createElement("textarea");
          el.value = url;
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      },
    },
  ];

  const handlePlatform = useCallback((platform: Platform) => {
    const url     = `https://lumisbeauty.com/studio/${productId}?ref=${platform.id}-share`;
    const message = buildMessage(productName, productId, `${platform.id}-share`);
    platform.share(message, url);
    if (platform.id !== "copy") onClose();
  }, [productId, productName, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 80,
              backgroundColor: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(2px)",
            }}
          />

          {/* Sheet */}
          <motion.div
            key="sheet-panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 81,
              backgroundColor: "#FFFFFF",
              borderRadius: "12px 12px 0 0",
              padding: "20px 20px 32px",
              paddingBottom: "max(32px, env(safe-area-inset-bottom))",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.12)",
            }}
          >
            {/* Handle bar */}
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: "var(--color-border)",
              margin: "0 auto 20px",
            }} />

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}>
              <div>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 10,
                  color: "var(--color-pink)", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.14em",
                  marginBottom: 2,
                }}>Share your look</p>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600,
                  color: "var(--color-ink)",
                }}>{productName}</p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 4,
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-ink-mid)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Image preview thumbnail (if available) */}
            {capturedImageDataUrl && (
              <div style={{ marginBottom: 20 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImageDataUrl}
                  alt="Your look"
                  style={{
                    width: 72, height: 96, objectFit: "cover",
                    borderRadius: 4,
                    border: "1px solid var(--color-border-light)",
                  }}
                />
              </div>
            )}

            {/* Platform list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePlatform(p)}
                  style={{
                    height: 52,
                    backgroundColor: p.color,
                    border: "none", borderRadius: 6,
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "0 18px",
                    cursor: "pointer",
                    color: "#FFFFFF",
                    fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                    letterSpacing: "0.01em",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {p.icon}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
