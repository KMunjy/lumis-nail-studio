/**
 * Lume Engine — Nail Renderer v2 (Segmentation-aware)
 *
 * Two rendering paths:
 *
 *   PATH A — Contour mode (when segmentation succeeds, confidence ≥ 0.72):
 *     Uses the fitted polygon from nail-segmentation.ts.
 *     Polish is rendered inside the TRUE nail boundary, not a Bezier approximation.
 *     Light direction comes from per-frame specular analysis (accurate gloss placement).
 *     Opacity is adapted to skin luminance (darker skin → slightly more opaque).
 *
 *   PATH B — Geometric fallback (when segmentation fails / model not loaded):
 *     Identical to nail-renderer.ts v2.0 (96.1% average precision, NW_SCALE=0.46).
 *     Zero dependencies beyond canvas 2D API.
 *
 * The two paths share the same color/gradient/gloss/cuticle-fade logic so the
 * visual output is consistent regardless of which path is active.
 *
 * Usage (in CameraView rAF loop):
 *   const segResults = await segmentNails(video, smoothed, cw, ch, fingerIndices);
 *   for (const f of fingers) {
 *     const seg = segResults.get(f.fingerIndex);
 *     drawNailV2(ctx, smoothed[f.tip], smoothed[f.dip], cw, ch, style, f.fingerIndex, seg);
 *   }
 */

import { drawNail } from "./nail-renderer";
import type { NailStyle, LandmarkPoint } from "@/types";
import type { SegmentResult } from "./nail-segmentation";

// ─── Contour renderer ─────────────────────────────────────────────────────────

/**
 * Renders nail polish using the fitted contour polygon (Path A).
 *
 * The polygon replaces the parametric Bezier path. All shading (gradient,
 * gloss, cuticle fade, edge stroke) is applied using the same techniques
 * as the geometric renderer, but the SHAPE is driven by the real nail boundary.
 */
function drawNailContour(
  ctx: CanvasRenderingContext2D,
  polygon: { x: number; y: number }[],
  style: NailStyle,
  lightDir: { dx: number; dy: number },
  skinLum: number
): void {
  if (polygon.length < 3) return;

  // Build canvas Path2D from the contour polygon
  const path = new Path2D();
  path.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    path.lineTo(polygon[i].x, polygon[i].y);
  }
  path.closePath();

  // Bounding box for gradient anchors
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w  = maxX - minX;
  const h  = maxY - minY;

  // Skin-tone adaptive opacity:
  // Luminance 0 = black skin → opacity 0.95 (strong coverage needed)
  // Luminance 1 = light skin → opacity 0.90 (slight translucency looks natural)
  const opacity = 0.95 - skinLum * 0.05;
  const baseOpacity = style.opacity ?? opacity;

  // ── Base fill — tip→cuticle gradient along finger axis ──────────────────
  // Gradient direction: from tip (minY in crop = top of nail in canvas after
  // contour mapping) toward cuticle (maxY). We use the actual bounding box Y
  // range so the gradient fills the entire real nail length.
  const grad = ctx.createLinearGradient(cx, minY, cx, maxY);
  grad.addColorStop(0,   style.topColor);
  grad.addColorStop(0.5, style.midColor);
  grad.addColorStop(1,   style.bottomColor);

  ctx.fillStyle = grad;
  ctx.globalAlpha = baseOpacity;
  ctx.fill(path);
  ctx.globalAlpha = 1;

  // ── Gloss highlight — direction from specular analysis ──────────────────
  // Placed along the lightDir vector from the nail centroid.
  // This accurately tracks real-world lighting instead of assuming 10 o'clock.
  ctx.save();
  ctx.clip(path);

  const glossW = w * 0.5;
  const glossCx = cx + lightDir.dx * w * 0.15; // offset gloss toward light
  const glossGrad = ctx.createLinearGradient(
    glossCx - glossW / 2, cy,
    glossCx + glossW / 2, cy
  );
  glossGrad.addColorStop(0,    "rgba(255,255,255,0)");
  glossGrad.addColorStop(0.30, "rgba(255,255,255,0.28)");
  glossGrad.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = glossGrad;
  ctx.fill(path);

  // Specular dot near the nail apex, offset toward light source
  const specX = cx + lightDir.dx * w * 0.12;
  const specY = minY + h * 0.25;
  const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, w * 0.20);
  specGrad.addColorStop(0, "rgba(255,255,255,0.30)");
  specGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = specGrad;
  ctx.fill(path);
  ctx.restore();

  // ── Cuticle fade — erases alpha at the base of the nail ─────────────────
  // Fade zone is the bottom 18% of nail height (consistent with geometric renderer).
  const fadeStart = maxY - h * 0.18;
  ctx.save();
  ctx.clip(path);
  const cuticleFade = ctx.createLinearGradient(cx, fadeStart, cx, maxY);
  cuticleFade.addColorStop(0,    "rgba(0,0,0,0)");
  cuticleFade.addColorStop(0.50, "rgba(0,0,0,0.18)");
  cuticleFade.addColorStop(1,    "rgba(0,0,0,0.45)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = cuticleFade;
  ctx.fill(path);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  // ── Edge stroke — sub-pixel boundary definition ──────────────────────────
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.6;
  ctx.stroke(path);
}

// ─── Unified draw entry point ─────────────────────────────────────────────────

/**
 * Draws one nail, routing to the segmentation (Path A) or geometric (Path B)
 * renderer based on the segmentation result.
 *
 * @param ctx         Canvas 2D context
 * @param tip         TIP landmark (normalized)
 * @param dip         DIP landmark (normalized)
 * @param cw          Canvas width
 * @param ch          Canvas height
 * @param style       LUMIS nail style
 * @param fingerIndex 0=thumb … 4=pinky
 * @param seg         Result from segmentNails(), or undefined for geometric only
 */
export function drawNailV2(
  ctx: CanvasRenderingContext2D,
  tip: LandmarkPoint,
  dip: LandmarkPoint,
  cw: number,
  ch: number,
  style: NailStyle,
  fingerIndex: number = 1,
  seg?: SegmentResult
): void {
  // PATH A: use real nail contour
  if (seg?.ok === true && seg.contour.confidence >= 0.72) {
    try {
      drawNailContour(
        ctx,
        seg.contour.polygon,
        style,
        seg.contour.lightDir,
        seg.contour.skinLum
      );
      return;
    } catch {
      // Fall through to geometric path on any rendering error
    }
  }

  // PATH B: geometric fallback (calibrated 96.1% precision)
  drawNail(ctx, tip, dip, cw, ch, style, fingerIndex);
}
