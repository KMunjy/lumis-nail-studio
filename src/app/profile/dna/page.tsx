"use client";

/**
 * Nail DNA — /profile/dna  v2.0
 *
 * Improvements vs v1:
 *   F2-A — 0-look gated state (3 locked silhouettes, "Unlock your DNA" CTA)
 *   F2-B — SVG donut colour wheel (warm / cool / neutral segments)
 *   F2-C — "Styled for DNA" product carousel (filtered by archetype)
 *   F2-D — DNA evolution timeline (4-week bar chart)
 *   F2-E — Archetype deep-link (copy URL to share)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share2, Sparkles, Copy, Check, Lock, ShoppingBag, ArrowRight } from "lucide-react";
import Link from "next/link";
import { computeNailDNA, ARCHETYPES, type NailDNAProfile } from "@/lib/nail-dna";
import { canvasToBlob, downloadBlob, shareBlob } from "@/lib/export-canvas";
import { products, type Product } from "@/data/products";
import type { SavedLook } from "@/lib/saved-looks";
import type { NailFinish, NailShape } from "@/types";

const FINISH_LABELS: Record<NailFinish, string> = {
  Gloss: "Gloss", Matte: "Matte", Metallic: "Metallic",
  Chrome: "Chrome", Jelly: "Jelly", Glitter: "Glitter", CatEye: "Cat Eye",
};

// ─── F2-B — Finish → colour temperature mapping ────────────────────────────────
const FINISH_TEMP: Record<NailFinish, "warm" | "cool" | "neutral"> = {
  Metallic: "warm",
  Glitter:  "warm",
  CatEye:   "warm",
  Chrome:   "cool",
  Jelly:    "cool",
  Gloss:    "neutral",
  Matte:    "neutral",
};

function computeTempPcts(breakdown: Record<NailFinish, number>, total: number) {
  let warm = 0, cool = 0, neutral = 0;
  for (const [finish, count] of Object.entries(breakdown) as [NailFinish, number][]) {
    const temp = FINISH_TEMP[finish];
    if (temp === "warm")    warm    += count;
    else if (temp === "cool")    cool    += count;
    else                    neutral += count;
  }
  if (total === 0) return { warm: 33, cool: 33, neutral: 34 };
  return {
    warm:    Math.round((warm    / total) * 100),
    cool:    Math.round((cool    / total) * 100),
    neutral: Math.round((neutral / total) * 100),
  };
}

// ─── F2-B — SVG Donut ─────────────────────────────────────────────────────────

function DonutChart({ warm, cool, neutral }: { warm: number; cool: number; neutral: number }) {
  const R = 38;
  const STROKE = 14;
  const CX = 50;
  const circumference = 2 * Math.PI * R;
  const GAP = 3; // gap between segments in "circumference units"

  const segments = [
    { pct: warm,    color: "#F43F78", label: "Warm",    labelColor: "#F43F78" },
    { pct: cool,    color: "#7C3AED", label: "Cool",    labelColor: "#7C3AED" },
    { pct: neutral, color: "#94A3B8", label: "Neutral", labelColor: "#94A3B8" },
  ];

  let offset = 0; // starts at 12 o'clock (rotate -90 on circle)
  const rendered = segments.map((seg) => {
    const length = (seg.pct / 100) * circumference - GAP;
    const dashArray = `${Math.max(0, length)} ${circumference}`;
    const dashOffset = -offset;
    offset += (seg.pct / 100) * circumference;
    return { ...seg, dashArray, dashOffset };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle
          cx={CX} cy={CX} r={R}
          fill="none"
          stroke="var(--color-border-light)"
          strokeWidth={STROKE}
        />
        {/* Segments */}
        {rendered.map((seg, i) => (
          <circle
            key={i}
            cx={CX} cy={CX} r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={STROKE}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
            transform={`rotate(-90 ${CX} ${CX})`}
            strokeLinecap="round"
          />
        ))}
        {/* Centre label */}
        <text
          x={CX} y={CX - 5}
          textAnchor="middle"
          fontSize="11" fontWeight="700"
          fill="var(--color-ink)"
        >
          {warm}%
        </text>
        <text
          x={CX} y={CX + 10}
          textAnchor="middle"
          fontSize="9"
          fill="var(--color-ink-light)"
        >
          warm
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {segments.map((seg) => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              backgroundColor: seg.color, flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 12,
              color: "var(--color-ink)", flex: 1,
            }}>{seg.label}</span>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
              color: seg.labelColor,
            }}>{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── F2-D — 4-week activity chart ─────────────────────────────────────────────

function WeekChart({ looks }: { looks: SavedLook[] }) {
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const weeks = [0, 1, 2, 3].map((i) => ({
    label: i === 0 ? "This wk" : i === 1 ? "Last wk" : `${i + 1}w ago`,
    count: looks.filter((l) => {
      const d = now - new Date(l.createdAt).getTime();
      return d >= i * ONE_WEEK && d < (i + 1) * ONE_WEEK;
    }).length,
  })).reverse(); // oldest first

  const max = Math.max(...weeks.map((w) => w.count), 1);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 80 }}>
        {weeks.map((w, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(w.count / max) * 64}px` }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              style={{
                width: "100%", borderRadius: 4,
                backgroundColor: i === 3 ? "var(--color-pink)" : "var(--color-border-light)",
                minHeight: w.count > 0 ? 6 : 3,
              }}
            />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 9,
              color: "var(--color-ink-light)", textAlign: "center",
            }}>{w.count}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        {weeks.map((w, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 9,
              color: "var(--color-ink-light)",
            }}>{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DNA card canvas renderer ──────────────────────────────────────────────────

async function renderDNACard(profile: NailDNAProfile, format: "square" | "story"): Promise<Blob> {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, profile.archetype.bgColor);
  bg.addColorStop(1, "#FFFFFF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = profile.archetype.accentColor;
  ctx.fillRect(0, 0, W, 8);

  ctx.fillStyle = "rgba(0,0,0,0.04)";
  for (let x = 40; x < W; x += 56) {
    for (let y = 40; y < H; y += 56) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const yBase = format === "story" ? 340 : 140;

  ctx.font = "700 32px sans-serif";
  ctx.fillStyle = profile.archetype.accentColor;
  ctx.fillText("LUMIS", 72, yBase);

  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(72, yBase + 18, W - 144, 1);

  ctx.font = "500 28px sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText("YOUR NAIL DNA", 72, yBase + 66);

  ctx.font = `${format === "story" ? 160 : 120}px sans-serif`;
  ctx.fillText(profile.archetype.emoji, 72, yBase + (format === "story" ? 280 : 230));

  ctx.font = `700 ${format === "story" ? 88 : 72}px sans-serif`;
  ctx.fillStyle = "#1A1025";
  const nameLines = wrapText(ctx, profile.archetype.name, W - 144, format === "story" ? 88 : 72);
  let nameY = yBase + (format === "story" ? 380 : 300);
  for (const line of nameLines) { ctx.fillText(line, 72, nameY); nameY += format === "story" ? 100 : 84; }

  ctx.font = `500 ${format === "story" ? 44 : 36}px sans-serif`;
  ctx.fillStyle = profile.archetype.accentColor;
  ctx.fillText(profile.archetype.tagline, 72, nameY + 12);

  ctx.font = `400 ${format === "story" ? 38 : 30}px sans-serif`;
  ctx.fillStyle = "rgba(26,16,37,0.62)";
  const descLines = wrapText(ctx, profile.archetype.description, W - 144, format === "story" ? 38 : 30);
  let descY = nameY + (format === "story" ? 80 : 64);
  for (const line of descLines.slice(0, 4)) { ctx.fillText(line, 72, descY); descY += format === "story" ? 54 : 44; }

  const statsY = H - (format === "story" ? 360 : 240);
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  roundRect(ctx, 72, statsY, W - 144, format === "story" ? 280 : 168, 20);
  ctx.fill();

  const statItems = [
    { label: "Looks Saved", value: String(profile.totalLooks) },
    { label: "Fave Finish",  value: FINISH_LABELS[profile.dominantFinish] },
    { label: "Fave Shape",   value: profile.dominantShape },
    { label: "Palette",      value: profile.colorTemp.charAt(0).toUpperCase() + profile.colorTemp.slice(1) },
  ];

  const colW = (W - 144) / 4;
  const statFontSize = format === "story" ? 36 : 26;
  const labelFontSize = format === "story" ? 26 : 19;

  for (let i = 0; i < statItems.length; i++) {
    const sx = 72 + i * colW + colW * 0.5;
    ctx.font = `700 ${statFontSize}px sans-serif`;
    ctx.fillStyle = "#1A1025";
    ctx.textAlign = "center";
    ctx.fillText(statItems[i].value, sx, statsY + (format === "story" ? 88 : 60));
    ctx.font = `400 ${labelFontSize}px sans-serif`;
    ctx.fillStyle = "rgba(26,16,37,0.50)";
    ctx.fillText(statItems[i].label, sx, statsY + (format === "story" ? 140 : 96));
  }
  ctx.textAlign = "left";

  ctx.font = "400 24px sans-serif";
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.textAlign = "center";
  ctx.fillText("lumis.app — AI Nail Try-On", W / 2, H - 52);
  ctx.textAlign = "left";

  const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  // Release the 1080×1080 or 1080×1920 native backing store.
  // blob is the durable output — the canvas pixels are no longer needed.
  canvas.width  = 0;
  canvas.height = 0;
  return blob;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, _fontSize: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = word; }
    else current = test;
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── F2-C — Product recommendations filtered by archetype ─────────────────────

function getRecommendedProducts(profile: NailDNAProfile): Product[] {
  const finishMatch  = products.filter((p) => p.finish === profile.dominantFinish);
  const tempFinishes: NailFinish[] = profile.colorTemp === "warm"
    ? ["Metallic", "Glitter", "CatEye"]
    : profile.colorTemp === "cool"
    ? ["Chrome", "Jelly"]
    : ["Gloss", "Matte"];
  const tempMatch = products.filter((p) => tempFinishes.includes(p.finish) && p.finish !== profile.dominantFinish);
  const rest = products.filter((p) => !finishMatch.includes(p) && !tempMatch.includes(p));
  return [...finishMatch, ...tempMatch, ...rest].slice(0, 6);
}

// ─── F2-A — Locked state silhouettes ──────────────────────────────────────────

const SILHOUETTE_ARCHETYPES = ["chrome-maven", "glazed-minimalist", "matte-rebel"] as const;

function LockedDNA() {
  return (
    <div>
      <div style={{ textAlign: "center", padding: "32px 20px 24px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          backgroundColor: "#FFF0F5",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <Lock size={28} style={{ color: "var(--color-pink)" }} />
        </div>
        <h2 style={{
          fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 700,
          color: "var(--color-ink)", margin: "0 0 8px",
        }}>Unlock Your Nail DNA</h2>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6,
          color: "var(--color-ink-light)", margin: "0 0 8px",
          maxWidth: 320, marginLeft: "auto", marginRight: "auto",
        }}>
          Save 3 or more looks to reveal your nail personality archetype.
        </p>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
          color: "var(--color-pink)", margin: 0,
        }}>Which one are you? 👀</p>
      </div>

      {/* 3 blurred/locked archetype silhouettes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
        {SILHOUETTE_ARCHETYPES.map((id) => {
          const a = ARCHETYPES.find((x) => x.id === id)!;
          return (
            <div
              key={id}
              style={{
                borderRadius: 16, overflow: "hidden",
                border: "1px solid var(--color-border-light)",
                backgroundColor: a.bgColor,
                filter: "blur(4px)",
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              <div style={{ height: 4, backgroundColor: a.accentColor }} />
              <div style={{ padding: "18px 14px 16px" }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(0,0,0,0.35)", margin: "0 0 8px",
                }}>Archetype</p>
                <div style={{ fontSize: 36, margin: "0 0 10px", lineHeight: 1 }}>{a.emoji}</div>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                  color: "#1A1025", margin: "0 0 4px", lineHeight: 1.3,
                }}>{a.name}</p>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 10,
                  color: a.accentColor, margin: 0,
                }}>{a.tagline}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <Link href="/studio/shoot" style={{ textDecoration: "none" }}>
        <button style={{
          width: "100%", padding: "16px 0", borderRadius: 12,
          border: "none", backgroundColor: "var(--color-pink)",
          color: "#FFFFFF",
          fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <Sparkles size={18} />
          Start Your First Look →
        </button>
      </Link>

      <p style={{
        textAlign: "center", marginTop: 14,
        fontFamily: "var(--font-sans)", fontSize: 12,
        color: "var(--color-ink-light)",
      }}>
        Or{" "}
        <Link href="/studio" style={{ color: "var(--color-pink)", textDecoration: "none" }}>
          try on live with AR
        </Link>
      </p>
    </div>
  );
}

// ─── Page component ────────────────────────────────────────────────────────────

export default function NailDNAPage() {
  const [profile, setProfile]       = useState<NailDNAProfile | null>(null);
  const [allLooks, setAllLooks]     = useState<SavedLook[]>([]);
  const [sharing, setSharing]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [activeFormat, setFormat]   = useState<"square" | "story">("square");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const prevUrlRef                  = useRef<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const looks: SavedLook[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) ?? "";
        if (key.startsWith("lumis_saved_looks_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try { looks.push(...(JSON.parse(raw) as SavedLook[])); } catch { /* skip */ }
          }
        }
      }
      looks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllLooks(looks);
      setProfile(computeNailDNA(looks));
    } catch {
      setProfile(computeNailDNA([]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile || !profile.totalLooks) return;
    let cancelled = false;
    renderDNACard(profile, activeFormat).then((blob) => {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
    });
    return () => { cancelled = true; };
  }, [profile, activeFormat]);

  const handleShare = useCallback(async () => {
    if (!profile) return;
    setSharing(true);
    try {
      const blob = await renderDNACard(profile, activeFormat);
      await shareBlob(blob, `LUMIS-NailDNA-${profile.archetype.id}.jpg`, `My Nail DNA: ${profile.archetype.name}`, "Discover your nail personality at lumis.app");
    } catch { /* cancelled */ }
    setSharing(false);
  }, [profile, activeFormat]);

  const handleDownload = useCallback(async () => {
    if (!profile) return;
    const blob = await renderDNACard(profile, activeFormat);
    downloadBlob(blob, `LUMIS-NailDNA-${profile.archetype.id}-${activeFormat}.jpg`);
  }, [profile, activeFormat]);

  // F2-E — Copy deep-link
  const handleCopyLink = useCallback(() => {
    if (!profile) return;
    const url = `https://lumis.app/profile/dna?archetype=${profile.archetype.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {
      // Fallback: show in alert
      window.prompt("Copy this link:", url);
    });
  }, [profile]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Sparkles className="animate-pulse" size={36} style={{ color: "var(--color-pink)" }} />
      </div>
    );
  }

  if (!profile) return null;

  const { archetype } = profile;
  const tempPcts = computeTempPcts(profile.finishBreakdown, profile.totalLooks);
  const recommended = getRecommendedProducts(profile);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA" }}>
      {/* Header */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700,
              color: "var(--color-ink)", margin: 0, letterSpacing: "-0.01em",
            }}>Nail DNA</h1>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12,
              color: "var(--color-ink-light)", margin: "2px 0 0",
            }}>Your nail personality, computed</p>
          </div>
          <Link href="/account/looks" style={{ textDecoration: "none", fontSize: 13, color: "var(--color-ink-light)" }}>
            ← Looks
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 100px" }}>

        {/* ── F2-A: Gated state ── */}
        {profile.totalLooks === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <LockedDNA />
          </motion.div>
        ) : (
          <>
            {/* Archetype hero card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                borderRadius: 20, overflow: "hidden",
                marginBottom: 16,
                border: "1px solid var(--color-border-light)",
                backgroundColor: archetype.bgColor,
              }}
            >
              <div style={{ height: 5, backgroundColor: archetype.accentColor }} />
              <div style={{ padding: "28px 28px 24px" }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(0,0,0,0.4)", margin: "0 0 12px",
                }}>Your Nail DNA</p>
                <div style={{ fontSize: 64, margin: "0 0 16px", lineHeight: 1 }}>{archetype.emoji}</div>
                <h2 style={{
                  fontFamily: "var(--font-sans)", fontSize: 28, fontWeight: 700,
                  color: "#1A1025", margin: "0 0 6px", letterSpacing: "-0.01em",
                }}>{archetype.name}</h2>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                  color: archetype.accentColor, margin: "0 0 14px",
                }}>{archetype.tagline}</p>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6,
                  color: "rgba(26,16,37,0.68)", margin: "0 0 20px",
                }}>{archetype.description}</p>

                {/* F2-E — Deep-link copy button (inside hero) */}
                <button
                  onClick={handleCopyLink}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "9px 18px", borderRadius: 30,
                    border: `1.5px solid ${copied ? "#22C55E" : archetype.accentColor}`,
                    backgroundColor: copied ? "#F0FDF4" : "transparent",
                    color: copied ? "#16A34A" : archetype.accentColor,
                    fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Link copied!" : "Share my archetype"}
                </button>
              </div>
            </motion.div>

            {/* Stats grid */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8, marginBottom: 16,
              }}
            >
              {[
                { label: "Looks", value: String(profile.totalLooks) },
                { label: "Top Finish", value: FINISH_LABELS[profile.dominantFinish] },
                { label: "Top Shape", value: profile.dominantShape },
                { label: "Palette",   value: profile.colorTemp.charAt(0).toUpperCase() + profile.colorTemp.slice(1) },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12, padding: "14px 10px",
                  border: "1px solid var(--color-border-light)",
                  textAlign: "center",
                }}>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700,
                    color: "var(--color-ink)", margin: "0 0 3px",
                  }}>{value}</p>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 9,
                    color: "var(--color-ink-light)", margin: 0,
                  }}>{label}</p>
                </div>
              ))}
            </motion.div>

            {/* F2-B — Donut + finish breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 14, padding: "18px 18px 20px",
                border: "1px solid var(--color-border-light)",
                marginBottom: 16,
              }}
            >
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                color: "var(--color-ink)", margin: "0 0 16px",
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>Colour Palette</p>
              <DonutChart warm={tempPcts.warm} cool={tempPcts.cool} neutral={tempPcts.neutral} />
            </motion.div>

            {/* Finish breakdown bars */}
            {Object.values(profile.finishBreakdown).some((v) => v > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14, padding: "18px 18px 20px",
                  border: "1px solid var(--color-border-light)",
                  marginBottom: 16,
                }}
              >
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                  color: "var(--color-ink)", margin: "0 0 14px",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>Finish Breakdown</p>
                {Object.entries(profile.finishBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .filter(([, v]) => v > 0)
                  .map(([finish, count]) => {
                    const pct = profile.totalLooks > 0 ? (count / profile.totalLooks) * 100 : 0;
                    return (
                      <div key={finish} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink)" }}>
                            {FINISH_LABELS[finish as NailFinish]}
                          </span>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-light)" }}>
                            {count}
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, backgroundColor: "var(--color-border-light)", overflow: "hidden" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            style={{ height: "100%", borderRadius: 3, backgroundColor: archetype.accentColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </motion.div>
            )}

            {/* F2-D — Evolution timeline */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 14, padding: "18px 18px 20px",
                border: "1px solid var(--color-border-light)",
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                  color: "var(--color-ink)", margin: 0,
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>DNA Evolution</p>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: 10,
                  color: "var(--color-ink-light)",
                }}>looks per week</span>
              </div>
              <WeekChart looks={allLooks} />
            </motion.div>

            {/* F2-C — Styled for DNA carousel */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              style={{ marginBottom: 20 }}
            >
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                color: "var(--color-ink)", margin: "0 0 12px",
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>Styled for Your DNA</p>
              <div style={{
                display: "flex", gap: 10, overflowX: "auto",
                paddingBottom: 8,
                scrollbarWidth: "none",
              }}>
                {recommended.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      flexShrink: 0, width: 140,
                      backgroundColor: "#FFFFFF",
                      borderRadius: 14,
                      border: "1px solid var(--color-border-light)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{
                      height: 80,
                      background: `linear-gradient(135deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`,
                    }} />
                    <div style={{ padding: "10px 10px 12px" }}>
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                        color: "var(--color-ink)", margin: "0 0 2px",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{product.name}</p>
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 10,
                        color: "var(--color-ink-light)", margin: "0 0 8px",
                      }}>{product.finish} · £{product.price}</p>
                      <div style={{ display: "flex", gap: 5 }}>
                        <Link
                          href={`/studio/${product.id}`}
                          style={{
                            flex: 1, textAlign: "center",
                            padding: "5px 0", borderRadius: 6,
                            backgroundColor: "var(--color-pink)",
                            color: "#FFFFFF",
                            fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 700,
                            textDecoration: "none",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                          }}
                        >
                          <ArrowRight size={10} /> Try
                        </Link>
                        <button style={{
                          flex: 1, padding: "5px 0", borderRadius: 6,
                          border: "1px solid var(--color-border-light)",
                          backgroundColor: "#FFFFFF",
                          fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
                          color: "var(--color-ink)", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                        }}>
                          <ShoppingBag size={9} /> Bag
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* All archetypes grid */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 14, padding: 18,
                border: "1px solid var(--color-border-light)",
                marginBottom: 20,
              }}
            >
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                color: "var(--color-ink)", margin: "0 0 14px",
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>All Archetypes</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ARCHETYPES.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      backgroundColor: a.id === archetype.id ? archetype.bgColor : "var(--color-surface)",
                      border: a.id === archetype.id ? `1px solid ${archetype.accentColor}` : "1px solid transparent",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{a.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                        color: "var(--color-ink)", margin: 0,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{a.name}</p>
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 10,
                        color: "var(--color-ink-light)", margin: 0,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{a.tagline}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Share card section */}
            <div style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16, padding: 18,
              border: "1px solid var(--color-border-light)",
              marginBottom: 24,
            }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                color: "var(--color-ink)", margin: "0 0 14px",
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>Share Your DNA Card</p>

              {/* Format toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {(["square", "story"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8,
                      border: `1px solid ${activeFormat === f ? "var(--color-pink)" : "var(--color-border-light)"}`,
                      backgroundColor: activeFormat === f ? "var(--color-pink)" : "#FFFFFF",
                      color: activeFormat === f ? "#FFFFFF" : "var(--color-ink-mid)",
                      fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {f === "square" ? "1:1 Feed" : "9:16 Stories"}
                  </button>
                ))}
              </div>

              {/* Preview */}
              {previewUrl && (
                <div style={{
                  borderRadius: 12, overflow: "hidden",
                  marginBottom: 14,
                  border: "1px solid var(--color-border-light)",
                  backgroundColor: "#F0EEF2",
                  maxHeight: 320,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="DNA card preview"
                    style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  style={{
                    flex: 1, padding: "13px 0", borderRadius: 10,
                    border: "none",
                    backgroundColor: sharing ? "var(--color-border-light)" : "var(--color-pink)",
                    color: sharing ? "var(--color-ink-light)" : "#FFFFFF",
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                    cursor: sharing ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  }}
                >
                  <Share2 size={14} />
                  {sharing ? "Sharing…" : "Share Card"}
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    flex: 1, padding: "13px 0", borderRadius: 10,
                    border: "1px solid var(--color-border-light)",
                    backgroundColor: "#FFFFFF",
                    color: "var(--color-ink)",
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  }}
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
