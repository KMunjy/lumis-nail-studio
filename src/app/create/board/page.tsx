"use client";

/**
 * NailBoard — /create/board  v2.0
 *
 * Improvements vs v1:
 *   F3-A — Background theme picker (Dark / White / Marble / Linen / Holographic / Blush)
 *   F3-B — Drag-to-reorder selected swatches (@dnd-kit/sortable, pointer + touch)
 *   F3-C — Shoppable price labels toggle (name + price in canvas export)
 *   F3-D — "Inspire Me" random board (reads DNA archetype finish from localStorage)
 *   F3-E — Save boards to profile (lumis_boards_local[], max 5)
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, Share2, Grid, Minus, Dice5,
  Bookmark, BookmarkCheck, Tag, Tags,
} from "lucide-react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { products } from "@/data/products";
import type { Product } from "@/data/products";
import { canvasToBlob, downloadBlob, shareBlob } from "@/lib/export-canvas";
import type { NailFinish } from "@/types";

type Layout = "2x2" | "3x3" | "strip";

// F3-A — Board background themes
type BoardTheme = "dark" | "white" | "marble" | "linen" | "holographic" | "blush";

interface ThemeConfig {
  id: BoardTheme;
  label: string;
  // For canvas rendering
  bgFrom: string;
  bgTo: string;
  logoColor: string;
  textColor: string;
  captionColor: string;
}

const BOARD_THEMES: ThemeConfig[] = [
  { id: "dark",         label: "Dark",         bgFrom: "#1A1025", bgTo: "#0D0815",  logoColor: "#F43F78", textColor: "rgba(255,255,255,0.88)", captionColor: "rgba(255,255,255,0.6)"  },
  { id: "white",        label: "White Studio",  bgFrom: "#FFFFFF", bgTo: "#F5F5F5", logoColor: "#F43F78", textColor: "rgba(0,0,0,0.80)",       captionColor: "rgba(0,0,0,0.45)"       },
  { id: "marble",       label: "Marble",        bgFrom: "#EDE8E8", bgTo: "#D5CBCB", logoColor: "#8B4E4E", textColor: "rgba(60,30,30,0.85)",    captionColor: "rgba(60,30,30,0.50)"    },
  { id: "linen",        label: "Linen",         bgFrom: "#F7F2E8", bgTo: "#E8DFC8", logoColor: "#A08050", textColor: "rgba(70,50,20,0.85)",    captionColor: "rgba(70,50,20,0.50)"    },
  { id: "holographic",  label: "Holo",          bgFrom: "#E0D0FF", bgTo: "#C8F0FF", logoColor: "#7C3AED", textColor: "rgba(30,10,80,0.85)",    captionColor: "rgba(30,10,80,0.50)"    },
  { id: "blush",        label: "Blush",         bgFrom: "#FFF0F5", bgTo: "#FFD6E8", logoColor: "#F43F78", textColor: "rgba(80,20,40,0.85)",    captionColor: "rgba(80,20,40,0.50)"    },
];

// Preview CSS for theme swatches in UI
const THEME_PREVIEW_CSS: Record<BoardTheme, string> = {
  dark:        "linear-gradient(135deg, #1A1025, #0D0815)",
  white:       "linear-gradient(135deg, #FFFFFF, #F0F0F0)",
  marble:      "linear-gradient(135deg, #EDE8E8, #D5CBCB)",
  linen:       "linear-gradient(135deg, #F7F2E8, #E8DFC8)",
  holographic: "linear-gradient(135deg, #E0D0FF, #C8F0FF)",
  blush:       "linear-gradient(135deg, #FFF0F5, #FFD6E8)",
};

const LAYOUT_OPTIONS: Array<{ id: Layout; label: string; max: number; cols: number }> = [
  { id: "2x2",   label: "2 × 2", max: 4, cols: 2 },
  { id: "3x3",   label: "3 × 3", max: 9, cols: 3 },
  { id: "strip", label: "Strip", max: 5, cols: 5 },
];

const ALL_FINISHES: Array<NailFinish | "All"> = [
  "All", "Gloss", "Matte", "Metallic", "Chrome", "Jelly", "Glitter", "CatEye",
];

// ─── F3-B — Sortable swatch item ──────────────────────────────────────────────

function SortableSwatch({
  product,
  onRemove,
  showPrice,
}: {
  product: Product;
  onRemove: () => void;
  showPrice: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderRadius: 10, overflow: "hidden",
        background: `linear-gradient(135deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`,
        position: "relative",
        minHeight: 0,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      {...attributes}
      {...listeners}
    >
      {/* Remove button — not draggable */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        aria-label={`Remove ${product.name}`}
        style={{
          position: "absolute", top: 4, right: 4,
          width: 20, height: 20, borderRadius: "50%",
          backgroundColor: "rgba(0,0,0,0.5)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#FFFFFF", zIndex: 2,
        }}
      >
        <X size={11} />
      </button>

      <div style={{
        position: "absolute", bottom: 0, insetInline: 0,
        padding: "4px 6px",
        background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
      }}>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
          color: "rgba(255,255,255,0.9)", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{product.name}</p>
        {showPrice && (
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 8,
            color: "rgba(255,255,255,0.70)", margin: 0,
          }}>£{product.price}</p>
        )}
      </div>
    </div>
  );
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function drawSwatch(
  ctx: CanvasRenderingContext2D,
  product: Product,
  x: number, y: number, w: number, h: number,
  showPrice: boolean,
  r = 16,
): void {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0,   product.topColor);
  g.addColorStop(0.5, product.midColor);
  g.addColorStop(1,   product.bottomColor);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // Gradient overlay for text legibility
  const grad = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.font = "600 26px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "center";
  ctx.fillText(product.name, x + w / 2, y + h - (showPrice ? 40 : 20));

  if (showPrice) {
    ctx.font = "500 22px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(`£${product.price}`, x + w / 2, y + h - 14);
  }

  ctx.textAlign = "left";
  ctx.restore();
}

async function renderBoard(
  selected: Product[],
  layout: Layout,
  caption: string,
  theme: ThemeConfig,
  showPrice: boolean,
): Promise<Blob> {
  const W  = 1080;
  const H  = 1080;
  const PAD = 24;
  const GAP = 12;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bgFrom);
  bg.addColorStop(1, theme.bgTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Marble / linen texture overlay (subtle noise)
  if (theme.id === "marble" || theme.id === "linen") {
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = theme.id === "marble" ? "#888" : "#A08050";
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, Math.random() * 4 + 1);
    }
    ctx.globalAlpha = 1;
  }

  const captionH = caption.trim() ? 96 : 60;
  const gridTop  = 60;
  const gridBot  = H - captionH;
  const gridH    = gridBot - gridTop;

  if (layout === "strip") {
    const cols = Math.min(selected.length, 5);
    const cellW = (W - PAD * 2 - GAP * (cols - 1)) / cols;
    const cellH = gridH - PAD;
    for (let i = 0; i < cols; i++) {
      drawSwatch(ctx, selected[i], PAD + i * (cellW + GAP), gridTop, cellW, cellH, showPrice, 16);
    }
  } else {
    const cols = layout === "2x2" ? 2 : 3;
    const rows = cols;
    const cellW = (W - PAD * 2 - GAP * (cols - 1)) / cols;
    const cellH = (gridH - PAD - GAP * (rows - 1)) / rows;

    for (let i = 0; i < Math.min(selected.length, cols * rows); i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      drawSwatch(ctx, selected[i], PAD + col * (cellW + GAP), gridTop + row * (cellH + GAP), cellW, cellH, showPrice, 16);
    }
  }

  // Bottom branding bar
  const barAlpha = theme.id === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  ctx.fillStyle = barAlpha;
  ctx.fillRect(0, gridBot, W, captionH);

  ctx.font = "700 26px sans-serif";
  ctx.fillStyle = theme.logoColor;
  ctx.fillText("LUMIS", PAD, gridBot + 38);

  if (caption.trim()) {
    ctx.font = "500 28px sans-serif";
    ctx.fillStyle = theme.captionColor;
    ctx.fillText(caption.slice(0, 54), PAD, gridBot + 78);
  }

  ctx.font = "400 22px sans-serif";
  ctx.fillStyle = theme.captionColor;
  ctx.textAlign = "right";
  ctx.fillText(`${selected.length} shade${selected.length !== 1 ? "s" : ""}`, W - PAD, gridBot + 38);
  ctx.textAlign = "left";

  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getThemeStyle(themeId: BoardTheme): { background: string; color?: string } {
  const isDark = themeId === "dark";
  return {
    background: THEME_PREVIEW_CSS[themeId],
    color: isDark ? "#FFFFFF" : "#1A1025",
  };
}

// F3-D — Inspire Me: reads DNA archetype finish from localStorage
function getInspiredSelection(maxSlots: number): Product[] {
  let finishHint: NailFinish | null = null;
  try {
    // Check if DNA profile has been computed (dominantFinish stored on profile JSON)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      if (key.startsWith("lumis_saved_looks_")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const looks = JSON.parse(raw) as Array<{ finish?: string }>;
          if (looks.length > 0) {
            // Count finishes
            const counts: Record<string, number> = {};
            for (const look of looks) {
              if (look.finish) counts[look.finish] = (counts[look.finish] ?? 0) + 1;
            }
            const dominant = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
            if (dominant) finishHint = dominant[0] as NailFinish;
          }
        }
      }
    }
  } catch { /* ignore */ }

  // Pick matching products first, then pad with others
  const pool = finishHint
    ? [...products.filter((p) => p.finish === finishHint), ...products.filter((p) => p.finish !== finishHint)]
    : [...products];

  // Shuffle deterministically-ish
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, maxSlots);
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function NailBoardPage() {
  const [selected, setSelected]       = useState<Product[]>([]);
  const [layout, setLayout]           = useState<Layout>("3x3");
  const [caption, setCaption]         = useState("");
  const [finishFilter, setFilter]     = useState<NailFinish | "All">("All");
  const [sharing, setSharing]         = useState(false);
  const [exporting, setExporting]     = useState(false);
  // F3-A
  const [theme, setTheme]             = useState<BoardTheme>("dark");
  // F3-C
  const [showPrice, setShowPrice]     = useState(false);
  // F3-E
  const [saved, setSaved]             = useState(false);

  // F3-B — dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const activeConfig = LAYOUT_OPTIONS.find((l) => l.id === layout)!;
  const maxSlots     = activeConfig.max;
  const canAdd       = selected.length < maxSlots;
  const activeTheme  = BOARD_THEMES.find((t) => t.id === theme)!;

  const toggle = useCallback((product: Product) => {
    setSaved(false);
    setSelected((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      if (prev.length >= maxSlots) return prev;
      return [...prev, product];
    });
  }, [maxSlots]);

  // F3-B — drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelected((prev) => {
        const oldIdx = prev.findIndex((p) => p.id === active.id);
        const newIdx = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
      setSaved(false);
    }
  }, []);

  // F3-D — Inspire Me
  const handleInspire = () => {
    setSelected(getInspiredSelection(maxSlots));
    setSaved(false);
  };

  const handleExport = async (action: "download" | "share") => {
    if (selected.length === 0) return;
    if (action === "download") setExporting(true);
    else setSharing(true);

    try {
      const blob = await renderBoard(selected, layout, caption, activeTheme, showPrice);
      if (action === "download") {
        downloadBlob(blob, `LUMIS-NailBoard-${layout}-${theme}.jpg`);
      } else {
        await shareBlob(blob, `LUMIS-NailBoard-${layout}-${theme}.jpg`, "My LUMIS NailBoard");
      }
    } catch { /* cancelled */ }

    setExporting(false);
    setSharing(false);
  };

  // F3-E — Save to profile
  const handleSaveBoard = () => {
    if (selected.length === 0) return;
    const storageKey = "lumis_boards_local";
    const existing: object[] = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    const board = {
      id: `${Date.now()}`,
      layout,
      theme,
      caption,
      showPrice,
      productIds: selected.map((p) => p.id),
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey, JSON.stringify([board, ...existing].slice(0, 5)));
    setSaved(true);
  };

  const filteredProducts =
    finishFilter === "All" ? products : products.filter((p) => p.finish === finishFilter);

  const isDarkTheme = theme === "dark";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA" }}>
      {/* Header */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700,
              color: "var(--color-ink)", margin: 0, letterSpacing: "-0.01em",
            }}>NailBoard</h1>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12,
              color: "var(--color-ink-light)", margin: "2px 0 0",
            }}>Build & export a nail mood board</p>
          </div>
          <Link href="/" style={{ textDecoration: "none", fontSize: 13, color: "var(--color-ink-light)" }}>
            ← Back
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 120px" }}>

        {/* ── F3-A: Background theme picker ── */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 12,
          overflowX: "auto", paddingBottom: 4,
          scrollbarWidth: "none",
        }}>
          {BOARD_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.label}
              style={{
                flexShrink: 0, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: THEME_PREVIEW_CSS[t.id],
                border: theme === t.id
                  ? "3px solid var(--color-pink)"
                  : "3px solid transparent",
                boxShadow: theme === t.id
                  ? "0 0 0 1px var(--color-pink)"
                  : "0 1px 4px rgba(0,0,0,0.12)",
                transition: "all 0.14s",
              }} />
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: 9,
                color: theme === t.id ? "var(--color-pink)" : "var(--color-ink-light)",
                fontWeight: theme === t.id ? 700 : 400,
              }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Board preview ── */}
        <div style={{
          background: THEME_PREVIEW_CSS[theme],
          borderRadius: 16, overflow: "hidden",
          marginBottom: 12,
          border: "1px solid var(--color-border-light)",
          aspectRatio: "1",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          padding: 12, gap: 8,
        }}>
          {selected.length === 0 ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              justifyContent: "center", flexDirection: "column", gap: 12,
            }}>
              <Grid size={36} style={{ color: isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }} />
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 13,
                color: isDarkTheme ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                margin: 0, textAlign: "center",
              }}>Select shades below to build your board</p>
            </div>
          ) : (
            /* F3-B — dnd-kit drag context */
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selected.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div style={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: layout === "strip"
                    ? `repeat(${Math.min(selected.length, 5)}, 1fr)`
                    : `repeat(${activeConfig.cols}, 1fr)`,
                  gap: 6,
                }}>
                  {selected.map((product) => (
                    <SortableSwatch
                      key={product.id}
                      product={product}
                      showPrice={showPrice}
                      onRemove={() => toggle(product)}
                    />
                  ))}
                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, activeConfig.max - selected.length) }).map((_, i) => (
                    <div key={`empty-${i}`} style={{
                      borderRadius: 10,
                      border: `1px dashed ${isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0,
                    }}>
                      <Minus size={12} style={{ color: isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }} />
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Branding bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 4px 0",
          }}>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.12em", color: activeTheme.logoColor,
            }}>LUMIS</span>
            {caption && (
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: 10,
                color: isDarkTheme ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: "70%", textAlign: "right",
              }}>{caption}</span>
            )}
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12, padding: 14,
          border: "1px solid var(--color-border-light)",
          marginBottom: 12,
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        }}>
          {/* Layout picker */}
          <div style={{ display: "flex", gap: 6 }}>
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setLayout(opt.id); setSelected([]); setSaved(false); }}
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: `1px solid ${layout === opt.id ? "var(--color-pink)" : "var(--color-border-light)"}`,
                  backgroundColor: layout === opt.id ? "var(--color-pink)" : "#FFFFFF",
                  color: layout === opt.id ? "#FFFFFF" : "var(--color-ink-mid)",
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                }}
              >{opt.label}</button>
            ))}
          </div>

          {/* Caption */}
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 54))}
            placeholder="Add a caption…"
            style={{
              flex: 1, minWidth: 100,
              padding: "7px 12px", borderRadius: 8,
              border: "1px solid var(--color-border-light)",
              fontFamily: "var(--font-sans)", fontSize: 13,
              color: "var(--color-ink)", outline: "none",
              backgroundColor: "var(--color-surface)",
            }}
          />

          {/* F3-C — Price labels toggle */}
          <button
            onClick={() => setShowPrice((v) => !v)}
            title={showPrice ? "Hide prices" : "Show prices"}
            style={{
              padding: "6px 10px", borderRadius: 8,
              border: `1px solid ${showPrice ? "var(--color-pink)" : "var(--color-border-light)"}`,
              backgroundColor: showPrice ? "#FFF0F5" : "#FFFFFF",
              color: showPrice ? "var(--color-pink)" : "var(--color-ink-mid)",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontFamily: "var(--font-sans)", fontSize: 11,
            }}
          >
            {showPrice ? <Tag size={13} /> : <Tags size={13} />}
            Price
          </button>

          {/* F3-D — Inspire Me */}
          <button
            onClick={handleInspire}
            title="Inspire Me"
            style={{
              padding: "6px 10px", borderRadius: 8,
              border: "1px solid var(--color-border-light)",
              backgroundColor: "#FFFFFF",
              color: "var(--color-ink-mid)",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontFamily: "var(--font-sans)", fontSize: 11,
            }}
          >
            <Dice5 size={13} />
            Inspire
          </button>
        </div>

        {/* ── Export + Save actions ── */}
        {selected.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <button
              onClick={() => handleExport("share")}
              disabled={sharing}
              style={{
                flex: 1, minWidth: 100, padding: "13px 0", borderRadius: 10,
                border: "none",
                backgroundColor: sharing ? "var(--color-border-light)" : "var(--color-pink)",
                color: sharing ? "var(--color-ink-light)" : "#FFFFFF",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                cursor: sharing ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <Share2 size={14} />
              {sharing ? "Sharing…" : "Share"}
            </button>
            <button
              onClick={() => handleExport("download")}
              disabled={exporting}
              style={{
                flex: 1, minWidth: 80, padding: "13px 0", borderRadius: 10,
                border: "1px solid var(--color-border-light)",
                backgroundColor: "#FFFFFF",
                color: "var(--color-ink)",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                cursor: exporting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <Download size={14} />
              {exporting ? "Saving…" : "Download"}
            </button>
            {/* F3-E — Save to profile */}
            <button
              onClick={saved ? undefined : handleSaveBoard}
              disabled={saved}
              style={{
                flex: 1, minWidth: 80, padding: "13px 0", borderRadius: 10,
                border: `1px solid ${saved ? "#22C55E" : "var(--color-border-light)"}`,
                backgroundColor: saved ? "#F0FDF4" : "#FFFFFF",
                color: saved ? "#16A34A" : "var(--color-ink)",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                cursor: saved ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "all 0.2s",
              }}
            >
              {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              {saved ? "Saved!" : "Save"}
            </button>
          </div>
        )}

        {/* ── Shade catalog ── */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12, padding: 16,
          border: "1px solid var(--color-border-light)",
        }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 12,
          }}>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
              color: "var(--color-ink)", margin: 0,
            }}>
              Select Shades{" "}
              <span style={{ color: "var(--color-ink-light)", fontWeight: 400 }}>
                ({selected.length}/{maxSlots})
              </span>
            </p>
            {selected.length > 0 && (
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: 10,
                color: "var(--color-ink-light)",
              }}>
                Drag to reorder ↕
              </span>
            )}
          </div>

          {/* Finish filter */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {ALL_FINISHES.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "3px 10px", borderRadius: 20,
                  border: `1px solid ${finishFilter === f ? "var(--color-pink)" : "var(--color-border-light)"}`,
                  backgroundColor: finishFilter === f ? "var(--color-pink)" : "#FFFFFF",
                  color: finishFilter === f ? "#FFFFFF" : "var(--color-ink-mid)",
                  fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 500,
                  cursor: "pointer",
                }}
              >{f}</button>
            ))}
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
            gap: 8,
          }}>
            {filteredProducts.map((product) => {
              const isSelected = selected.some((p) => p.id === product.id);
              const isDisabled = !isSelected && !canAdd;
              return (
                <button
                  key={product.id}
                  onClick={() => !isDisabled && toggle(product)}
                  style={{
                    borderRadius: 10, padding: 8,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    border: `2px solid ${isSelected ? "var(--color-pink)" : "transparent"}`,
                    backgroundColor: isSelected ? "#FFF0F5" : "#FAFAFA",
                    opacity: isDisabled ? 0.45 : 1,
                    transition: "all 0.12s",
                    textAlign: "left",
                  }}
                >
                  <div style={{
                    width: "100%", height: 48, borderRadius: 6, marginBottom: 5,
                    background: `linear-gradient(135deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`,
                  }} />
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
                    color: "var(--color-ink)", margin: "0 0 1px",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{product.name}</p>
                  {showPrice && (
                    <p style={{
                      fontFamily: "var(--font-sans)", fontSize: 8,
                      color: "var(--color-ink-light)", margin: 0,
                    }}>£{product.price}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
