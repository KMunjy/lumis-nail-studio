/**
 * LUMIS — NailShoot Composition Engine  v2.0
 *
 * F1-A: Quality selector — High (1080) / Standard (720) / Lite (480)
 * F1-B: 12 compositions — Clean, Marble, Botanical, Dark, Luxury, Blush,
 *                         Neon, Linen, Glitter, Cement, Sage, Holographic
 * F1-C: Mini preview — generateMiniPreviews() renders 3 × 160px thumbnails fast
 */

import type { Product } from "@/data/products";
import { canvasToBlob } from "@/lib/export-canvas";

// ─── Quality ──────────────────────────────────────────────────────────────────

export type QualityLevel = "high" | "standard" | "lite";

const QUALITY_DIM: Record<QualityLevel, number>    = { high: 1080, standard: 720, lite: 480 };
const QUALITY_JPEG: Record<QualityLevel, number>   = { high: 0.92, standard: 0.85, lite: 0.72 };

// ─── Composition styles ───────────────────────────────────────────────────────

export type CompositionStyle =
  | "clean" | "marble" | "botanical" | "dark" | "luxury" | "blush"
  | "neon"  | "linen"  | "glitter"   | "cement" | "sage"  | "holographic";

export interface Composition {
  style:   CompositionStyle;
  label:   string;
  blob:    Blob;
  dataUrl: string;
}

// Full-res working canvas size (always 1080, then downscale)
const MASTER = 1080;

// ─── Background renderers (all at MASTER=1080) ────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, style: CompositionStyle): void {
  ctx.save();
  switch (style) {
    case "clean": {
      ctx.fillStyle = "#FAFAFA";
      ctx.fillRect(0, 0, MASTER, MASTER);
      break;
    }
    case "marble": {
      ctx.fillStyle = "#F6F4F1";
      ctx.fillRect(0, 0, MASTER, MASTER);
      const veins = [
        [0.15, 0.05, 0.72, 0.95, 0.40],
        [0.55, 0.00, 0.30, 0.85, 0.60],
        [0.80, 0.10, 0.60, 1.00, 0.25],
        [0.05, 0.40, 0.90, 0.70, 0.80],
      ];
      for (const [x1, y1, cx, cy, x2] of veins) {
        ctx.beginPath();
        ctx.moveTo(x1 * MASTER, y1 * MASTER);
        ctx.quadraticCurveTo(cx * MASTER, cy * MASTER, x2 * MASTER, MASTER);
        ctx.strokeStyle = "rgba(170,165,158,0.28)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case "botanical": {
      const g = ctx.createRadialGradient(MASTER * 0.35, MASTER * 0.35, 0, MASTER * 0.5, MASTER * 0.5, MASTER * 0.72);
      g.addColorStop(0, "#D4E8D1"); g.addColorStop(0.6, "#A8C9A0"); g.addColorStop(1, "#6F9968");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MASTER, MASTER);
      break;
    }
    case "dark": {
      const g = ctx.createLinearGradient(0, 0, MASTER, MASTER);
      g.addColorStop(0, "#0A0815"); g.addColorStop(1, "#16102A");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MASTER, MASTER);
      break;
    }
    case "luxury": {
      const g = ctx.createLinearGradient(0, 0, MASTER, MASTER);
      g.addColorStop(0, "#261708"); g.addColorStop(0.45, "#3E2910"); g.addColorStop(1, "#120C04");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MASTER, MASTER);
      ctx.strokeStyle = "rgba(230,190,80,0.07)";
      ctx.lineWidth = 1;
      for (let y = 0; y < MASTER; y += 28) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MASTER, y); ctx.stroke();
      }
      break;
    }
    case "blush": {
      const g = ctx.createRadialGradient(MASTER * 0.28, MASTER * 0.28, 0, MASTER * 0.5, MASTER * 0.5, MASTER * 0.82);
      g.addColorStop(0, "#FEE8EF"); g.addColorStop(0.55, "#F9C8D8"); g.addColorStop(1, "#EE96BA");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MASTER, MASTER);
      break;
    }
    case "neon": {
      ctx.fillStyle = "#0D0820";
      ctx.fillRect(0, 0, MASTER, MASTER);
      // Neon glow orbs
      const orbs: Array<[number, number, string]> = [
        [0.2, 0.3, "#F43F78"], [0.8, 0.7, "#8B5CF6"], [0.5, 0.15, "#06B6D4"],
      ];
      for (const [x, y, colour] of orbs) {
        const g = ctx.createRadialGradient(x * MASTER, y * MASTER, 0, x * MASTER, y * MASTER, MASTER * 0.35);
        g.addColorStop(0, colour + "40"); g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, MASTER, MASTER);
      }
      // Fine grid
      ctx.strokeStyle = "rgba(244,63,120,0.06)";
      ctx.lineWidth = 1;
      for (let i = 0; i < MASTER; i += 48) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MASTER); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MASTER, i); ctx.stroke();
      }
      break;
    }
    case "linen": {
      ctx.fillStyle = "#F5EFE6";
      ctx.fillRect(0, 0, MASTER, MASTER);
      // Woven texture: crosshatch lines
      ctx.strokeStyle = "rgba(180,155,120,0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < MASTER; i += 8) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, MASTER); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MASTER, i); ctx.stroke();
      }
      // Diagonal grain
      ctx.strokeStyle = "rgba(160,130,90,0.06)";
      for (let i = -MASTER; i < MASTER * 2; i += 20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + MASTER, MASTER); ctx.stroke();
      }
      break;
    }
    case "glitter": {
      ctx.fillStyle = "#0F0F18";
      ctx.fillRect(0, 0, MASTER, MASTER);
      // Scatter sparkle dots with pseudo-random positions
      const rng = seededRandom(42);
      for (let i = 0; i < 400; i++) {
        const x = rng() * MASTER;
        const y = rng() * MASTER;
        const r = 0.5 + rng() * 2.5;
        const a = 0.3 + rng() * 0.7;
        const hue = [0, 45, 200, 280, 320][Math.floor(rng() * 5)];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 90%, 80%, ${a})`;
        ctx.fill();
      }
      break;
    }
    case "cement": {
      const g = ctx.createLinearGradient(0, 0, 0, MASTER);
      g.addColorStop(0, "#D4D0CB"); g.addColorStop(1, "#AEABA5");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MASTER, MASTER);
      // Subtle noise grain via dots
      const rng = seededRandom(77);
      for (let i = 0; i < 3000; i++) {
        const x = rng() * MASTER;
        const y = rng() * MASTER;
        const a = rng() * 0.06;
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(50,46,40,${a})`;
        ctx.fill();
      }
      break;
    }
    case "sage": {
      const g = ctx.createLinearGradient(0, 0, MASTER, MASTER);
      g.addColorStop(0, "#E8F0E4"); g.addColorStop(0.5, "#C8DABD"); g.addColorStop(1, "#A4C097");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MASTER, MASTER);
      // Soft paper texture
      ctx.strokeStyle = "rgba(120,150,100,0.08)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < MASTER; i += 16) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(MASTER, i); ctx.stroke();
      }
      break;
    }
    case "holographic": {
      const g = ctx.createLinearGradient(0, 0, MASTER, MASTER);
      g.addColorStop(0.00, "#FFB3D9");
      g.addColorStop(0.15, "#B3D9FF");
      g.addColorStop(0.30, "#B3FFD9");
      g.addColorStop(0.45, "#FFFBB3");
      g.addColorStop(0.60, "#FFD9B3");
      g.addColorStop(0.75, "#D9B3FF");
      g.addColorStop(0.90, "#B3E8FF");
      g.addColorStop(1.00, "#FFB3E8");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, MASTER, MASTER);
      // Shimmer overlay
      const sg = ctx.createLinearGradient(MASTER, 0, 0, MASTER);
      sg.addColorStop(0, "rgba(255,255,255,0.25)");
      sg.addColorStop(0.5, "rgba(255,255,255,0)");
      sg.addColorStop(1, "rgba(255,255,255,0.15)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, MASTER, MASTER);
      break;
    }
  }
  ctx.restore();
}

// ─── Seeded RNG (Mulberry32) ──────────────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  r = 20,
): void {
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
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawSwatchCircle(
  ctx: CanvasRenderingContext2D,
  product: Product,
  cx: number, cy: number, r: number,
): void {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, product.topColor); g.addColorStop(0.5, product.midColor); g.addColorStop(1, product.bottomColor);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function isDark(style: CompositionStyle): boolean {
  return ["dark", "luxury", "neon", "glitter"].includes(style);
}

function drawBrandingPanel(
  ctx: CanvasRenderingContext2D,
  style: CompositionStyle,
  product: Product,
  skinToneHex?: string,
): void {
  const dark = isDark(style);
  const panelH = 192;
  const panelY = MASTER - panelH;
  const textCol  = dark ? "#FFFFFF" : "#1A1025";
  const mutedCol = dark ? "rgba(255,255,255,0.52)" : "rgba(26,16,37,0.48)";

  ctx.save();
  ctx.fillStyle = dark ? "rgba(0,0,0,0.52)" : "rgba(255,255,255,0.88)";
  ctx.fillRect(0, panelY, MASTER, panelH);
  // Accent stripe
  ctx.fillStyle = "#F43F78";
  ctx.fillRect(0, panelY, 5, panelH);

  ctx.font = "700 22px sans-serif";
  ctx.fillStyle = "#F43F78";
  ctx.fillText("LUMIS", 36, panelY + 46);

  ctx.font = "600 40px sans-serif";
  ctx.fillStyle = textCol;
  ctx.fillText(product.name, 36, panelY + 100);

  ctx.font = "400 22px sans-serif";
  ctx.fillStyle = mutedCol;
  ctx.fillText(`${product.shape} · ${product.finish} · $${product.price}`, 36, panelY + 142);

  // Skin tone dot if provided
  if (skinToneHex) {
    ctx.beginPath();
    ctx.arc(MASTER - 140, panelY + 96, 16, 0, Math.PI * 2);
    ctx.fillStyle = skinToneHex;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawSwatchCircle(ctx, product, MASTER - 76, panelY + 96, 50);
  ctx.restore();
}

// ─── Image loader ─────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("[composition-engine] Image load failed"));
    img.src = src;
  });
}

// ─── Config table (12 compositions) ──────────────────────────────────────────

const CONFIGS: Array<{ style: CompositionStyle; label: string }> = [
  { style: "clean",       label: "Clean Studio"      },
  { style: "marble",      label: "Marble Editorial"   },
  { style: "botanical",   label: "Botanical Garden"   },
  { style: "dark",        label: "Dark Luxe"          },
  { style: "luxury",      label: "Gold Foil"          },
  { style: "blush",       label: "Blush Couture"      },
  { style: "neon",        label: "Neon Nights"        },
  { style: "linen",       label: "Linen & Co."        },
  { style: "glitter",     label: "Stardust"           },
  { style: "cement",      label: "Cement Editorial"   },
  { style: "sage",        label: "Sage Garden"        },
  { style: "holographic", label: "Holographic"        },
];

// ─── Render one composition at MASTER size then downscale ─────────────────────

async function renderOne(
  img: HTMLImageElement,
  config: { style: CompositionStyle; label: string },
  product: Product,
  quality: QualityLevel,
  skinToneHex?: string,
): Promise<Composition> {
  const canvas = document.createElement("canvas");
  canvas.width  = MASTER;
  canvas.height = MASTER;
  const ctx = canvas.getContext("2d")!;

  drawBackground(ctx, config.style);

  const panelH = 192;
  const availH = MASTER - panelH;
  const aspect = img.width / img.height;
  const imgW = Math.round(Math.min(MASTER * 0.85, availH * aspect));
  const imgH = Math.round(imgW / aspect);
  const imgX = Math.round((MASTER - imgW) / 2);
  const imgY = Math.round((availH - imgH) / 2);

  drawRoundedImage(ctx, img, imgX, imgY, imgW, imgH, 24);

  // Shadow vignette on image bottom
  const sv = ctx.createLinearGradient(0, imgY + imgH - 60, 0, imgY + imgH);
  sv.addColorStop(0, "rgba(0,0,0,0)");
  sv.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.save();
  ctx.beginPath();
  ctx.rect(imgX, imgY, imgW, imgH);
  ctx.clip();
  ctx.fillStyle = sv;
  ctx.fillRect(imgX, imgY + imgH - 60, imgW, 60);
  ctx.restore();

  drawBrandingPanel(ctx, config.style, product, skinToneHex);

  // Downscale if not High
  const dim  = QUALITY_DIM[quality];
  const jpeg = QUALITY_JPEG[quality];

  let outCanvas = canvas;
  if (dim < MASTER) {
    outCanvas        = document.createElement("canvas");
    outCanvas.width  = dim;
    outCanvas.height = dim;
    outCanvas.getContext("2d")!.drawImage(canvas, 0, 0, dim, dim);
    // Master canvas no longer needed — release its backing store now
    canvas.width  = 0;
    canvas.height = 0;
  }

  const blob    = await canvasToBlob(outCanvas, "image/jpeg", jpeg);
  const dataUrl = outCanvas.toDataURL("image/jpeg", jpeg);

  // Release output canvas backing store — blob + dataUrl are the durable forms
  outCanvas.width  = 0;
  outCanvas.height = 0;

  return { style: config.style, label: config.label, blob, dataUrl };
}

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * Generate all 12 professional nail compositions.
 *
 * @param imageDataUrl  User's photo data URL
 * @param product       Selected product
 * @param quality       Output resolution — "high" (1080) | "standard" (720) | "lite" (480)
 * @param skinToneHex   Optional Fitzpatrick skin tone hex
 */
export async function generateCompositions(
  imageDataUrl: string,
  product: Product,
  quality: QualityLevel = "high",
  skinToneHex?: string,
): Promise<Composition[]> {
  const img = await loadImage(imageDataUrl);
  const results: Composition[] = [];
  for (const config of CONFIGS) {
    results.push(await renderOne(img, config, product, quality, skinToneHex));
  }
  return results;
}

// ─── F1-C: Mini preview (3 styles, 160px, fast) ───────────────────────────────

const MINI_STYLES: Array<{ style: CompositionStyle; label: string }> = [
  { style: "clean",  label: "Studio" },
  { style: "marble", label: "Marble" },
  { style: "dark",   label: "Dark"   },
];

/**
 * Generate 3 lightweight 160×160 previews for the shade-selection step.
 * No branding panel — just background + nail swatch overlay. Very fast (~5ms each).
 */
export async function generateMiniPreviews(
  imageDataUrl: string,
  product: Product,
): Promise<Array<{ style: CompositionStyle; label: string; dataUrl: string }>> {
  const MINI = 160;
  const img  = await loadImage(imageDataUrl);
  const results: Array<{ style: CompositionStyle; label: string; dataUrl: string }> = [];

  for (const config of MINI_STYLES) {
    const canvas = document.createElement("canvas");
    canvas.width  = MINI;
    canvas.height = MINI;
    const ctx = canvas.getContext("2d")!;

    // Scale all background draws into 160px
    ctx.save();
    ctx.scale(MINI / MASTER, MINI / MASTER);
    drawBackground(ctx, config.style);
    ctx.restore();

    // Draw image (fill most of canvas)
    const aspect = img.width / img.height;
    const iw = Math.round(Math.min(MINI * 0.88, MINI * aspect));
    const ih = Math.round(iw / aspect);
    const ix = Math.round((MINI - iw) / 2);
    const iy = Math.round((MINI - ih) / 2 - 8);
    drawRoundedImage(ctx, img, ix, iy, iw, ih, 6);

    // Tiny swatch dot
    const g2 = ctx.createRadialGradient(MINI - 18, MINI - 18, 0, MINI - 18, MINI - 18, 10);
    g2.addColorStop(0, product.topColor); g2.addColorStop(1, product.bottomColor);
    ctx.beginPath();
    ctx.arc(MINI - 18, MINI - 18, 10, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.80);
    // Release 160×160 backing store — dataUrl is the durable form
    canvas.width  = 0;
    canvas.height = 0;
    results.push({ style: config.style, label: config.label, dataUrl });
  }
  return results;
}

// Re-export for consumers
export type { QualityLevel as NailShootQuality };
export { CONFIGS as COMPOSITION_CONFIGS };
