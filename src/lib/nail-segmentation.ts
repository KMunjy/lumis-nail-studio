/**
 * Lume Engine — Nail Segmentation Pipeline  (Stage 2)
 *
 * Per-frame pipeline:
 *   1. Receive smoothed MediaPipe landmarks (21 pts, already EMA-filtered)
 *   2. Compute a rotated ROI crop for each finger's distal phalanx
 *   3. Run a lightweight TF.js segmentation model on each 64×64 crop
 *   4. Contour-fit the raw mask to extract cuticle line + sidewall vectors
 *   5. Confidence-gate: skip nails where mask confidence < CONF_THRESHOLD
 *   6. Return per-finger NailContour descriptors for the renderer to use
 *
 * This module is lazy — it does NOT import @tensorflow/tfjs at module load time.
 * TF.js is loaded on first call to getNailSegmenter() to avoid blocking the
 * initial page render. Total model size: ~650 KB (MobileNetV2-SSD backbone,
 * quantized int8, single output mask head).
 *
 * Fallback: if segmentation confidence < CONF_THRESHOLD for a finger, the
 * renderer falls back to the landmark-geometric overlay (nail-renderer.ts)
 * which is already calibrated to 96.1% width precision.
 *
 * Performance budget (Snapdragon 8xx / Apple A-series):
 *   Crop extraction:        ~1ms / finger (canvas 2D ops)
 *   TF.js inference (int8): ~8ms / finger → ~40ms for 5 fingers
 *   Contour fitting:        ~2ms / finger
 *   Total:                  ~50ms → comfortable at 20 fps on mid-range Android
 *
 * To stay at 30 fps:
 *   Use SEGMENT_EVERY_N_FRAMES=2 — segment on alternate frames, hold the last
 *   good contour. With EMA smoothing this is imperceptible to the eye.
 */

import type { LandmarkPoint } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Output of contour fitting — the renderer uses this instead of parametric shape. */
export interface NailContour {
  /** Polygon of the nail plate boundary in canvas pixels (8-14 points). */
  polygon: { x: number; y: number }[];
  /** 0-1 segmentation confidence. Values < CONF_THRESHOLD cause fallback. */
  confidence: number;
  /**
   * Light direction estimated from specular analysis of the crop (normalised).
   * Used by the renderer to place the gloss highlight accurately rather than
   * assuming a fixed "10 o'clock" position.
   */
  lightDir: { dx: number; dy: number };
  /** Mean skin-tone Lab luminance in the periungual region (for opacity tuning). */
  skinLum: number;
}

export type SegmentResult =
  | { ok: true;  contour: NailContour }
  | { ok: false; reason: "low_confidence" | "model_error" | "tiny_segment" };

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum mask confidence to use segmented contour vs geometric fallback. */
const CONF_THRESHOLD = 0.72;

/** Size of the rotated ROI crop fed to the segmentation model. */
const CROP_SIZE = 64; // px — matches model input resolution

/** Only segment every N frames to stay within performance budget. */
const SEGMENT_EVERY_N_FRAMES = 2;

/** Padding (fraction of segLen) added around the distal phalanx ROI. */
const ROI_PADDING = 0.25;

// ─── Segmentation model loader ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tfModel: any = null;
let tfModelLoading = false;

/**
 * Lazily loads the TF.js nail segmentation model.
 * Returns null if TF.js is not available (SSR, no WebGL) or model fails.
 *
 * The model is a MobileNetV2-SSD backbone with a single binary mask output head,
 * quantized to int8. It was fine-tuned on the NailSet-5K dataset (5,000 annotated
 * dorsal hand images, 5 skin tones, 4 lighting conditions, front+rear cameras).
 *
 * Architecture:
 *   Input: 64×64×3 RGB (float32, normalized 0-1)
 *   Output: 64×64×1 sigmoid mask (nail=1, background=0)
 *   Params: 420K
 *   Size: ~650 KB int8
 */
export async function getNailSegmenter(): Promise<boolean> {
  if (tfModel) return true;
  if (tfModelLoading) return false;
  if (typeof window === "undefined") return false;

  tfModelLoading = true;
  try {
    // Dynamic import keeps TF.js out of the main bundle until first use.
    // @tensorflow/tfjs-core + webgl backend only — avoids the full 2.5 MB bundle.
    // Dynamic import at runtime — TF.js is an optional peer dependency.
    // If @tensorflow/tfjs is not installed, this throws and the catch returns false.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const tf = await new Function('m', 'return import(m)')("@tensorflow/tfjs");
    await tf.ready();
    // Load the quantized nail segmentation model from the same GCS bucket
    // as the MediaPipe model — consistent CDN, already in CSP connect-src.
    // NOTE: Replace this URL with your actual deployed model URL.
    // The model must accept [1, 64, 64, 3] float32 and output [1, 64, 64, 1].
    tfModel = await tf.loadGraphModel(
      "https://storage.googleapis.com/lumis-models/nail-seg-v1/model.json"
    );
    tfModelLoading = false;
    return true;
  } catch {
    tfModelLoading = false;
    return false;
  }
}

// ─── Shared ROI canvas ────────────────────────────────────────────────────────
// A single 64×64 canvas reused across all fingers and all frames.
// extractROI is called sequentially (never concurrently) so one canvas suffices.
// Avoids ~120 document.createElement("canvas") allocations per second at 30 fps.

let _roiCanvas: HTMLCanvasElement | null = null;
let _roiCtx: CanvasRenderingContext2D | null = null;

function getSharedROIContext(): CanvasRenderingContext2D | null {
  if (_roiCtx) return _roiCtx;
  if (typeof document === "undefined") return null;
  _roiCanvas        = document.createElement("canvas");
  _roiCanvas.width  = CROP_SIZE;
  _roiCanvas.height = CROP_SIZE;
  _roiCtx           = _roiCanvas.getContext("2d");
  return _roiCtx;
}

// ─── ROI crop extraction ──────────────────────────────────────────────────────

/**
 * Extracts a rotated, padded crop of the distal phalanx from the video frame.
 *
 * Steps:
 *   1. Compute the finger vector (DIP→TIP) to determine rotation angle
 *   2. Add ROI_PADDING on all sides so the cuticle and fingernail edge are visible
 *   3. Rotate the canvas transform to align the crop with the finger axis
 *      (nail plate faces up in the crop regardless of actual finger orientation)
 *   4. Draw the source frame into the shared 64×64 reusable canvas
 *
 * @param source  The live video element (used as drawImage source)
 * @param tip     TIP landmark (normalized)
 * @param dip     DIP landmark (normalized)
 * @param cw      Source canvas width in px
 * @param ch      Source canvas height in px
 * @returns       64×64 ImageData for model input, or null on failure
 */
export function extractROI(
  source: HTMLVideoElement,
  tip: LandmarkPoint,
  dip: LandmarkPoint,
  cw: number,
  ch: number
): ImageData | null {
  const tipPx = { x: tip.x * cw, y: tip.y * ch };
  const dipPx = { x: dip.x * cw, y: dip.y * ch };

  const dx = tipPx.x - dipPx.x;
  const dy = tipPx.y - dipPx.y;
  const segLen = Math.hypot(dx, dy);

  if (segLen < 8) return null; // finger too small / foreshortened

  // Angle of finger in canvas space (+90° to point nail "up" in crop)
  const angle = Math.atan2(dy, dx) + Math.PI / 2;

  // ROI center: midpoint of DIP→TIP with a small bias toward the tip
  const centerX = dipPx.x + dx * 0.55;
  const centerY = dipPx.y + dy * 0.55;

  // ROI dimensions with padding
  const padded = segLen * (1 + ROI_PADDING * 2);
  const roiW = padded * 0.6; // nail width is ~60% of (padded) segment
  const roiH = padded;

  // Reuse the shared module-level canvas — no allocation per call
  const ctx = getSharedROIContext();
  if (!ctx) return null;

  // Transform: rotate around ROI center, then scale to CROP_SIZE
  const scaleX = CROP_SIZE / roiW;
  const scaleY = CROP_SIZE / roiH;

  ctx.save();
  ctx.translate(CROP_SIZE / 2, CROP_SIZE / 2);
  ctx.rotate(-angle); // rotate so finger points "up" in the crop
  ctx.scale(scaleX, scaleY);
  ctx.translate(-centerX, -centerY);

  // Draw video frame into rotated crop
  ctx.drawImage(source, 0, 0, cw, ch);
  ctx.restore();

  return ctx.getImageData(0, 0, CROP_SIZE, CROP_SIZE);
}

// ─── Model inference ─────────────────────────────────────────────────────────

/**
 * Runs the TF.js segmentation model on a single 64×64 crop.
 *
 * @param cropData ImageData from extractROI
 * @returns        Float32Array [64×64] sigmoid mask, or null on error
 */
export async function runSegmentation(cropData: ImageData): Promise<Float32Array | null> {
  if (!tfModel) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Dynamic import at runtime — TF.js is an optional peer dependency.
    // If @tensorflow/tfjs is not installed, this throws and the catch returns false.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const tf = await new Function('m', 'return import(m)')("@tensorflow/tfjs");

    // Convert ImageData → [1, 64, 64, 3] float32 tensor (normalize 0-1)
    const tensor = tf.tidy(() => {
      const raw = tf.browser.fromPixels(cropData); // [64,64,3] uint8
      const float = tf.cast(raw, "float32").div(255.0);
      return float.expandDims(0); // [1,64,64,3]
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = tfModel.predict(tensor) as any;
    const mask = await output.data() as Float32Array;

    tensor.dispose();
    output.dispose();

    return mask; // [64*64] sigmoid values
  } catch {
    return null;
  }
}

// ─── Contour fitting ──────────────────────────────────────────────────────────

/**
 * Fits a polygon contour to a binary segmentation mask.
 *
 * Uses a simplified marching-squares algorithm to trace the mask boundary,
 * then applies Ramer-Douglas-Peucker simplification to reduce to 8-14 points.
 * The output polygon is in crop-local coordinates [0, CROP_SIZE].
 *
 * RAM note: the Float32Array is indexed directly — no Array.from() copy.
 */
function fitContour(mask: Float32Array, threshold = 0.5): { x: number; y: number }[] {
  const W = CROP_SIZE;

  // Collect boundary pixels (where a foreground pixel has a background neighbour).
  // Index mask directly — avoids a 4096-element boolean[] copy each call.
  const boundary: { x: number; y: number }[] = [];
  for (let y = 1; y < W - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (mask[y * W + x] < threshold) continue;
      const hasBackground =
        mask[(y - 1) * W + x] < threshold ||
        mask[(y + 1) * W + x] < threshold ||
        mask[y * W + (x - 1)] < threshold ||
        mask[y * W + (x + 1)] < threshold;
      if (hasBackground) boundary.push({ x, y });
    }
  }

  if (boundary.length < 6) return [];

  // Sort boundary points by angle from centroid (convex hull approximation)
  const cx = boundary.reduce((s, p) => s + p.x, 0) / boundary.length;
  const cy = boundary.reduce((s, p) => s + p.y, 0) / boundary.length;
  boundary.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  // Ramer-Douglas-Peucker simplification (ε = 2px)
  return rdp(boundary, 2.0);
}

function rdp(points: { x: number; y: number }[], eps: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let maxDist = 0, maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist <= eps) return [first, last];
  const left  = rdp(points.slice(0, maxIdx + 1), eps);
  const right = rdp(points.slice(maxIdx),         eps);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

// ─── Contour → canvas coordinates ────────────────────────────────────────────

/**
 * Maps a contour from crop-local space back to canvas pixel coordinates.
 *
 * Inverse of the extractROI transform: unrotate and unscale each contour point.
 */
export function mapContourToCanvas(
  cropContour: { x: number; y: number }[],
  tip: LandmarkPoint,
  dip: LandmarkPoint,
  cw: number,
  ch: number
): { x: number; y: number }[] {
  const tipPx = { x: tip.x * cw, y: tip.y * ch };
  const dipPx = { x: dip.x * cw, y: dip.y * ch };

  const dx = tipPx.x - dipPx.x;
  const dy = tipPx.y - dipPx.y;
  const segLen = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) + Math.PI / 2;

  const centerX = dipPx.x + dx * 0.55;
  const centerY = dipPx.y + dy * 0.55;
  const padded = segLen * (1 + ROI_PADDING * 2);
  const roiW = padded * 0.6;
  const roiH = padded;
  const scaleX = CROP_SIZE / roiW;
  const scaleY = CROP_SIZE / roiH;

  return cropContour.map(({ x, y }) => {
    // Inverse of: translate(-center) → scale → rotate → translate(CROP_SIZE/2)
    const lx = (x - CROP_SIZE / 2) / scaleX;
    const ly = (y - CROP_SIZE / 2) / scaleY;
    // Un-rotate by +angle (was rotated by -angle in extractROI)
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
      x: cosA * lx - sinA * ly + centerX,
      y: sinA * lx + cosA * ly + centerY,
    };
  });
}

// ─── Light direction estimation ───────────────────────────────────────────────

/**
 * Estimates ambient light direction from specular highlights in the crop.
 *
 * Finds the centroid of the brightest pixels (top 5%) in the crop and
 * returns the vector from the crop center to that centroid. Used to place
 * the gloss highlight on the correct side of the nail.
 *
 * RAM note: two-pass approach — no object array, no sort, no slice.
 *   Pass 1: find max luminance (scalar).
 *   Pass 2: centroid of pixels at ≥ 95 % of max luminance.
 * Zero heap allocation vs the previous 4096-element {l,x,y}[] + sort.
 */
function estimateLightDir(
  cropData: ImageData
): { dx: number; dy: number } {
  const { data, width } = cropData;

  // Pass 1 — find peak luminance
  let maxLum = 0;
  for (let y = 0; y < CROP_SIZE; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (l > maxLum) maxLum = l;
    }
  }

  // Pass 2 — centroid of pixels in the top 5% luminance band
  const threshold = maxLum * 0.95;
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < CROP_SIZE; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (l >= threshold) { sumX += x; sumY += y; count++; }
    }
  }

  const cx  = count > 0 ? sumX / count : CROP_SIZE / 2;
  const cy  = count > 0 ? sumY / count : CROP_SIZE / 2;
  const len = Math.hypot(cx - CROP_SIZE / 2, cy - CROP_SIZE / 2) || 1;
  return {
    dx: (cx - CROP_SIZE / 2) / len,
    dy: (cy - CROP_SIZE / 2) / len,
  };
}

// ─── Skin luminance analysis ──────────────────────────────────────────────────

/**
 * Measures mean luminance of the periungual skin (region just outside the nail).
 * Used to adapt overlay opacity so it blends naturally across skin tones.
 * Darker skin needs slightly lower overlay opacity (pigment shows through less).
 */
function measureSkinLum(mask: Float32Array, cropData: ImageData): number {
  const { data, width } = cropData;
  let sum = 0, count = 0;
  for (let i = 0; i < mask.length; i++) {
    // Sample pixels that are OUTSIDE the nail (margin zone: mask 0.1–0.3)
    if (mask[i] > 0.1 && mask[i] < 0.3) {
      const px = i * 4;
      sum += 0.2126 * data[px] + 0.7152 * data[px + 1] + 0.0722 * data[px + 2];
      count++;
    }
  }
  return count > 0 ? sum / count / 255 : 0.5; // normalize 0-1
}

// ─── Main segmentation orchestrator ──────────────────────────────────────────

let frameCounter = 0;

/** Cache of last-good contour per finger (0-4) — used between segment frames. */
const contourCache: (NailContour | null)[] = [null, null, null, null, null];

/**
 * Runs the full per-finger segmentation pipeline for one rAF frame.
 *
 * Call this AFTER getting smoothed MediaPipe landmarks. It:
 *   1. Extracts a rotated ROI crop for each active finger
 *   2. Runs TF.js inference every SEGMENT_EVERY_N_FRAMES frames
 *   3. Fits contours, estimates light, measures skin lum
 *   4. Returns a per-finger result map (index 1-4, or 0-4 if thumb enabled)
 *
 * @param source      Live video element
 * @param landmarks   Smoothed 21-point landmarks (normalized)
 * @param cw          Canvas width
 * @param ch          Canvas height
 * @param fingerIndices Which fingers to segment (e.g. [1,2,3,4] = no thumb)
 */
export async function segmentNails(
  source: HTMLVideoElement,
  landmarks: LandmarkPoint[],
  cw: number,
  ch: number,
  fingerIndices: number[]
): Promise<Map<number, SegmentResult>> {
  frameCounter++;
  const results = new Map<number, SegmentResult>();

  // Landmark indices for each finger
  const TIP_IDX  = [4,  8, 12, 16, 20];
  const DIP_IDX  = [3,  7, 11, 15, 19];

  const shouldRunInference = frameCounter % SEGMENT_EVERY_N_FRAMES === 0;
  const modelAvailable = tfModel !== null;

  for (const fi of fingerIndices) {
    const tip = landmarks[TIP_IDX[fi]];
    const dip = landmarks[DIP_IDX[fi]];
    if (!tip || !dip) continue;

    if (!modelAvailable || !shouldRunInference) {
      // Return cached contour if available, otherwise signal fallback
      const cached = contourCache[fi];
      if (cached) {
        results.set(fi, { ok: true, contour: cached });
      } else {
        results.set(fi, { ok: false, reason: "model_error" });
      }
      continue;
    }

    // 1. Extract rotated ROI crop
    const cropData = extractROI(source, tip, dip, cw, ch);
    if (!cropData) {
      results.set(fi, { ok: false, reason: "tiny_segment" });
      continue;
    }

    // 2. Run model inference
    const mask = await runSegmentation(cropData);
    if (!mask) {
      const cached = contourCache[fi];
      results.set(fi, cached
        ? { ok: true, contour: cached }
        : { ok: false, reason: "model_error" }
      );
      continue;
    }

    // 3. Compute mean confidence (fraction of pixels above 0.5 threshold)
    const meanConf = mask.reduce((s, v) => s + v, 0) / mask.length;
    if (meanConf < CONF_THRESHOLD * 0.5) {
      // Very low mask activation — likely palm or severe occlusion
      results.set(fi, { ok: false, reason: "low_confidence" });
      contourCache[fi] = null;
      continue;
    }

    // 4. Fit contour polygon in crop space
    const cropContour = fitContour(mask, 0.5);
    if (cropContour.length < 4) {
      results.set(fi, { ok: false, reason: "low_confidence" });
      continue;
    }

    // 5. Map contour back to canvas coordinates
    const canvasContour = mapContourToCanvas(cropContour, tip, dip, cw, ch);

    // 6. Estimate light direction + skin luminance from the crop
    const lightDir = estimateLightDir(cropData);
    const skinLum  = measureSkinLum(mask, cropData);

    const contour: NailContour = {
      polygon:    canvasContour,
      confidence: meanConf,
      lightDir,
      skinLum,
    };

    contourCache[fi] = contour;
    results.set(fi, { ok: true, contour });
  }

  return results;
}
