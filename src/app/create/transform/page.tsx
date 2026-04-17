"use client";

/**
 * NailTransform — /create/transform  v2.0
 *
 * Improvements vs v1:
 *   F5-A — Draggable split-screen slider (CSS clip-path + Pointer Events API, zero deps)
 *   F5-B — Opacity/intensity slider (10–100%) controlling colour overlay in real-time
 *   F5-C — Live auto-preview debounce (removes Preview button; 400ms debounce on change)
 *   F5-D — Shade comparison row (4 same-finish alternatives below preview)
 *   F5-E — Honest overlay disclosure chip (links to AR Studio)
 */

import {
  useState, useRef, useCallback, useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, Download, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { products } from "@/data/products";
import type { Product } from "@/data/products";
import { canvasToBlob, downloadBlob, shareBlob } from "@/lib/export-canvas";
import type { NailFinish } from "@/types";

type ExportFormat = "feed" | "story";

const FORMAT_DIMS: Record<ExportFormat, { w: number; h: number }> = {
  feed:  { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

const ALL_FINISHES: Array<NailFinish | "All"> = [
  "All", "Gloss", "Matte", "Metallic", "Chrome", "Jelly", "Glitter", "CatEye",
];

// ─── Canvas renderer ───────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function roundRectClip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
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

async function renderTransform(
  beforeDataUrl: string,
  product: Product,
  format: ExportFormat,
  intensity: number, // 0–1
): Promise<Blob> {
  const { w: W, h: H } = FORMAT_DIMS[format];
  const PAD = 32;
  const GAP = 16;
  const LABEL_H = 64;
  const BOTTOM_H = 120;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1A1025");
  bg.addColorStop(1, "#0D0815");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const imgH = H - BOTTOM_H - PAD * 2 - LABEL_H;
  const halfW = (W - PAD * 2 - GAP) / 2;
  const imgY  = PAD + LABEL_H;

  const img = await loadImage(beforeDataUrl);

  // BEFORE
  ctx.save();
  roundRectClip(ctx, PAD, imgY, halfW, imgH, 16);
  ctx.clip();
  ctx.drawImage(img, PAD, imgY, halfW, imgH);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(PAD, imgY, halfW, imgH);
  ctx.restore();

  // AFTER
  ctx.save();
  roundRectClip(ctx, PAD + halfW + GAP, imgY, halfW, imgH, 16);
  ctx.clip();
  ctx.drawImage(img, PAD + halfW + GAP, imgY, halfW, imgH);

  const shadeGrad = ctx.createLinearGradient(
    PAD + halfW + GAP, imgY,
    PAD + halfW + GAP + halfW, imgY + imgH,
  );
  const alpha = Math.round(intensity * 176).toString(16).padStart(2, "0");
  shadeGrad.addColorStop(0,   product.topColor + alpha);
  shadeGrad.addColorStop(0.5, product.midColor + alpha);
  shadeGrad.addColorStop(1,   product.bottomColor + alpha);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(PAD + halfW + GAP, imgY, halfW, imgH);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  // Labels
  const labelY = PAD + LABEL_H * 0.65;
  ctx.font = "600 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("BEFORE", PAD + halfW / 2, labelY);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("AFTER", PAD + halfW + GAP + halfW / 2, labelY);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(W / 2 - 1, imgY, 2, imgH);

  ctx.font = "300 48px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("→", W / 2, imgY + imgH / 2 + 18);
  ctx.textAlign = "left";

  // Bottom bar
  const botY = H - BOTTOM_H;
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.fillRect(0, botY, W, BOTTOM_H);

  ctx.font = "700 28px sans-serif";
  ctx.fillStyle = "#F43F78";
  ctx.fillText("LUMIS", PAD, botY + 44);

  ctx.font = "600 36px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(product.name, PAD, botY + 88);

  ctx.font = "400 24px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.50)";
  ctx.textAlign = "right";
  ctx.fillText(`${product.finish} · ${product.shape}`, W - PAD, botY + 66);
  ctx.textAlign = "left";

  const swatchR = 28;
  const swX = W - PAD - swatchR;
  const swY = botY + BOTTOM_H - swatchR - 16;
  const swGrad = ctx.createRadialGradient(swX, swY, 0, swX, swY, swatchR);
  swGrad.addColorStop(0,   product.topColor);
  swGrad.addColorStop(0.6, product.midColor);
  swGrad.addColorStop(1,   product.bottomColor);
  ctx.beginPath();
  ctx.arc(swX, swY, swatchR, 0, Math.PI * 2);
  ctx.fillStyle = swGrad;
  ctx.fill();

  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

// ─── F5-A — Split slider component ────────────────────────────────────────────

function SplitSlider({
  beforeUrl,
  product,
  intensity,
}: {
  beforeUrl: string;
  product: Product;
  intensity: number;
}) {
  const [pos, setPos] = useState(50); // 0–100, % from left where "before" ends
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updatePos(e.clientX);
  }, [updatePos]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    updatePos(e.clientX);
  }, [updatePos]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft")  setPos((p) => Math.max(0,   p - 2));
    if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 2));
  }, []);

  // Compute overlay colour with intensity
  const overlayOpacity = intensity;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="slider"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: "100%",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "ew-resize",
        userSelect: "none",
        outline: "none",
        backgroundColor: "#1A1025",
      }}
    >
      {/* BEFORE layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeUrl}
        alt="Before"
        draggable={false}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", pointerEvents: "none",
        }}
      />

      {/* AFTER layer — clipped to right side of slider */}
      <div style={{
        position: "absolute", inset: 0,
        clipPath: `inset(0 0 0 ${pos}%)`,
        pointerEvents: "none",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="After"
          draggable={false}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
          }}
        />
        {/* F5-B — intensity-controlled colour overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(135deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`,
          opacity: overlayOpacity,
          mixBlendMode: "multiply",
        }} />
      </div>

      {/* Labels */}
      <div style={{
        position: "absolute", top: 10, left: 12,
        backgroundColor: "rgba(0,0,0,0.50)",
        borderRadius: 6, padding: "2px 8px",
        fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600,
        color: "rgba(255,255,255,0.7)",
        pointerEvents: "none",
      }}>BEFORE</div>
      <div style={{
        position: "absolute", top: 10, right: 12,
        backgroundColor: "rgba(0,0,0,0.50)",
        borderRadius: 6, padding: "2px 8px",
        fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600,
        color: "rgba(255,255,255,0.95)",
        pointerEvents: "none",
      }}>AFTER</div>

      {/* Divider line */}
      <div style={{
        position: "absolute", top: 0, bottom: 0,
        left: `${pos}%`, width: 2,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 0 6px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }} />

      {/* Handle */}
      <div style={{
        position: "absolute", top: "50%",
        left: `${pos}%`,
        transform: "translate(-50%, -50%)",
        width: 36, height: 36, borderRadius: "50%",
        backgroundColor: "#FFFFFF",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <span style={{ fontSize: 14, color: "#1A1025", fontWeight: 700, letterSpacing: -2 }}>⇔</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NailTransformPage() {
  const [imageDataUrl, setImageDataUrl]       = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [finishFilter, setFilter]             = useState<NailFinish | "All">("All");
  const [format, setFormat]                   = useState<ExportFormat>("story");
  // F5-B — intensity
  const [intensity, setIntensity]             = useState(0.65);
  // F5-C — auto-preview (blob URL)
  const [previewUrl, setPreviewUrl]           = useState<string | null>(null);
  const [generating, setGenerating]           = useState(false);
  const [sharing, setSharing]                 = useState(false);
  const fileRef                               = useRef<HTMLInputElement>(null);
  const debounceRef                           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImageDataUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFile(file);
  }, [handleFile]);

  // F5-C — auto-preview debounce: triggers on image, product, format, or intensity change
  useEffect(() => {
    if (!imageDataUrl || !selectedProduct) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGenerating(true);
      try {
        const blob = await renderTransform(imageDataUrl, selectedProduct, format, intensity);
        const url  = URL.createObjectURL(blob);
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch (err) {
        console.error("[NailTransform] Render failed:", err);
      } finally {
        setGenerating(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [imageDataUrl, selectedProduct, format, intensity]);

  const handleExport = async (action: "download" | "share") => {
    if (!imageDataUrl || !selectedProduct) return;
    if (action === "share") setSharing(true);
    try {
      const blob = await renderTransform(imageDataUrl, selectedProduct, format, intensity);
      const filename = `LUMIS-Transform-${selectedProduct.name}-${format}.jpg`;
      if (action === "share") {
        await shareBlob(blob, filename, `${selectedProduct.name} transformation by LUMIS`);
      } else {
        downloadBlob(blob, filename);
      }
    } catch { /* cancelled */ }
    setSharing(false);
  };

  // F5-D — 4 same-finish alternatives
  const comparisonProducts = selectedProduct
    ? products
        .filter((p) => p.finish === selectedProduct.finish && p.id !== selectedProduct.id)
        .slice(0, 4)
    : [];

  const filteredProducts =
    finishFilter === "All" ? products : products.filter((p) => p.finish === finishFilter);

  const canExport = Boolean(imageDataUrl && selectedProduct);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA" }}>
      {/* Header */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{
              fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700,
              color: "var(--color-ink)", margin: 0, letterSpacing: "-0.01em",
            }}>NailTransform</h1>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12,
              color: "var(--color-ink-light)", margin: "2px 0 0",
            }}>Before & after nail transformation</p>
          </div>
          <Link href="/" style={{ textDecoration: "none", fontSize: 13, color: "var(--color-ink-light)" }}>
            ← Back
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 20px 120px" }}>

        {/* ── Upload zone ── */}
        <div style={{ marginBottom: 16 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {imageDataUrl ? (
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--color-border-light)", position: "relative" }}>
              <div style={{ position: "relative", paddingBottom: "35%", backgroundColor: "#F0EEF2" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDataUrl}
                  alt="Uploaded photo"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  position: "absolute", top: 10, right: 10,
                  padding: "6px 12px", borderRadius: 20,
                  border: "none",
                  backgroundColor: "rgba(255,255,255,0.88)",
                  color: "var(--color-ink)",
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <Camera size={12} /> Change
              </button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{
                border: "2px dashed var(--color-border)",
                borderRadius: 14, padding: "40px 32px",
                textAlign: "center", cursor: "pointer",
                backgroundColor: "#FFFFFF", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-pink)";
                (e.currentTarget as HTMLElement).style.backgroundColor = "#FFF5F8";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                (e.currentTarget as HTMLElement).style.backgroundColor = "#FFFFFF";
              }}
            >
              <Upload size={28} style={{ color: "var(--color-pink)", marginBottom: 12 }} />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--color-ink)", margin: "0 0 6px" }}>
                Upload Your Nail Photo
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-light)", margin: 0 }}>
                JPG, PNG or WebP — stays on your device
              </p>
            </div>
          )}
        </div>

        {/* ── F5-A: Split slider live preview ── */}
        <AnimatePresence>
          {imageDataUrl && selectedProduct && (
            <motion.div
              key="split"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginBottom: 14 }}
            >
              <SplitSlider
                beforeUrl={imageDataUrl}
                product={selectedProduct}
                intensity={intensity}
              />
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 10,
                color: "var(--color-ink-light)",
                textAlign: "center", margin: "8px 0 0",
              }}>
                Drag handle to compare · Use arrow keys for precision
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Shade picker ── */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12, padding: 16,
          border: "1px solid var(--color-border-light)",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
              color: "var(--color-ink)", margin: 0,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              New Shade
              {selectedProduct && (
                <span style={{ fontWeight: 400, color: "var(--color-pink)", marginLeft: 8, letterSpacing: 0, textTransform: "none" }}>
                  {selectedProduct.name}
                </span>
              )}
            </p>
          </div>

          {/* Finish filters */}
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
            gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
            gap: 8,
          }}>
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                style={{
                  borderRadius: 10, padding: 8,
                  border: `2px solid ${selectedProduct?.id === product.id ? "var(--color-pink)" : "transparent"}`,
                  backgroundColor: "var(--color-surface)",
                  cursor: "pointer", textAlign: "left",
                  boxShadow: selectedProduct?.id === product.id ? "0 0 0 1px var(--color-pink)" : "none",
                  transition: "all 0.12s",
                }}
              >
                <div style={{
                  width: "100%", height: 44, borderRadius: 6, marginBottom: 5,
                  background: `linear-gradient(135deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`,
                }} />
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
                  color: "var(--color-ink)", margin: 0,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{product.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── F5-B: Intensity slider + Format ── */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 12, padding: 16,
          border: "1px solid var(--color-border-light)",
          marginBottom: 16,
        }}>
          {/* Intensity slider */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                color: "var(--color-ink)", margin: 0,
              }}>
                Intensity
              </p>
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700,
                color: "var(--color-pink)",
              }}>{Math.round(intensity * 100)}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(intensity * 100)}
              onChange={(e) => setIntensity(Number(e.target.value) / 100)}
              style={{ width: "100%", accentColor: "var(--color-pink)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 9, color: "var(--color-ink-light)" }}>Subtle</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 9, color: "var(--color-ink-light)" }}>Bold</span>
            </div>
          </div>

          {/* Format toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--color-ink)", margin: 0, flexShrink: 0 }}>Format:</p>
            {(["story", "feed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: `1px solid ${format === f ? "var(--color-pink)" : "var(--color-border-light)"}`,
                  backgroundColor: format === f ? "var(--color-pink)" : "#FFFFFF",
                  color: format === f ? "#FFFFFF" : "var(--color-ink-mid)",
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer",
                }}
              >{f === "story" ? "9:16 Stories" : "1:1 Feed"}</button>
            ))}
            {generating && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-pink)" }}>
                Rendering…
              </span>
            )}
          </div>
        </div>

        {/* ── F5-C: Auto-preview output ── */}
        <AnimatePresence>
          {previewUrl && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16, overflow: "hidden",
                border: "1px solid var(--color-border-light)",
                marginBottom: 12,
              }}
            >
              <div style={{
                position: "relative",
                paddingBottom: format === "story" ? "177.8%" : "100%",
                backgroundColor: "#1A1025",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Transform preview"
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%", objectFit: "contain",
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── F5-D: Shade comparison row ── */}
        <AnimatePresence>
          {selectedProduct && comparisonProducts.length > 0 && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 12, padding: "14px 14px",
                border: "1px solid var(--color-border-light)",
                marginBottom: 14,
              }}
            >
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                color: "var(--color-ink-light)", margin: "0 0 10px",
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>
                Similar {selectedProduct.finish} shades
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                {comparisonProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    title={p.name}
                    style={{
                      flex: 1, background: "none", border: "none",
                      cursor: "pointer", padding: 0, textAlign: "center",
                    }}
                  >
                    <div style={{
                      height: 52, borderRadius: 8,
                      background: `linear-gradient(135deg, ${p.topColor}, ${p.midColor}, ${p.bottomColor})`,
                      marginBottom: 4,
                      border: "2px solid transparent",
                      transition: "border-color 0.12s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-pink)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
                    />
                    <p style={{
                      fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
                      color: "var(--color-ink)", margin: 0,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{p.name}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── F5-E: Honest disclosure chip ── */}
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 10,
              backgroundColor: "#FFF8E1",
              border: "1px solid #FFE082",
              marginBottom: 16,
            }}
          >
            <Sparkles size={14} style={{ color: "#C8A000", flexShrink: 0 }} />
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.5,
              color: "#7A5F00", margin: 0, flex: 1,
            }}>
              ✦ Colour simulation — for live AR try-on visit{" "}
              <Link
                href={`/studio/${selectedProduct.id}`}
                style={{ color: "var(--color-pink)", fontWeight: 700, textDecoration: "none" }}
              >
                AR Studio →
              </Link>
            </p>
          </motion.div>
        )}

        {/* ── Export actions ── */}
        {canExport && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => handleExport("share")}
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
              {sharing ? "Sharing…" : "Share"}
            </button>
            <button
              onClick={() => handleExport("download")}
              style={{
                flex: 1, padding: "13px 0", borderRadius: 10,
                border: "1px solid var(--color-border-light)",
                backgroundColor: "#FFFFFF", color: "var(--color-ink)",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <Download size={14} />
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
