/**
 * LUMIS — Evaluation Metrics  v1.0
 *
 * TypeScript implementations of the core overlay accuracy metrics,
 * usable both in-browser (live QA mode) and in Vitest regression suites.
 *
 * All functions are pure — they accept typed arrays and return numeric scores.
 * No DOM or Canvas APIs are used; callers own the mask extraction step.
 *
 * Metric definitions
 * ------------------
 *  IoU               — Intersection over Union (Jaccard index)
 *  Dice              — Dice / F1 similarity coefficient
 *  BoundaryF1        — Boundary-pixel precision-recall F1
 *  GeometricFit      — {cuticleError, sidewallRatio, axisAngleError}
 *  BleedRatios       — {total, cuticle, sidewall, tip}
 *  ColourDeltaE      — CIEDE2000 ΔE between expected and rendered colour
 *  JitterPx          — Mean inter-frame anchor displacement
 *
 * Pass thresholds (from validation-strategy v1.0)
 * ------------------------------------------------
 *  IoU               ≥ 0.82  (degraded: 0.72)
 *  Dice              ≥ 0.88
 *  BoundaryF1        ≥ 0.80
 *  CuticleError      ≤ 4 px
 *  SidewallRatio     0.92 – 1.08
 *  BleedTotal        < 3 %
 *  BleedCuticle      < 2 %
 *  ΔE                ≤ 8.0
 *  JitterPx          ≤ 1.5 px
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaskMetrics {
  iou:        number;
  dice:       number;
  boundaryF1: number;
}

export interface GeometricFit {
  /** Mean absolute cuticle placement error in pixels. */
  cuticleErrorPx: number;
  /** Ratio rendered_width / expected_width; ideal = 1.0. */
  sidewallRatio: number;
  /** Absolute axis angle error in degrees. */
  axisAngleDeg: number;
}

export interface BleedRatios {
  /** Fraction of renderer mask outside any GT zone (total bleed). */
  total:    number;
  /** Fraction of bleed pixels in the cuticle zone. */
  cuticle:  number;
  /** Fraction of bleed pixels in the sidewall zone. */
  sidewall: number;
  /** Fraction of bleed pixels in the tip zone. */
  tip:      number;
}

export interface ColourSample {
  /** RGB in [0, 255]. */
  r: number;
  g: number;
  b: number;
}

export interface MetricSuite {
  mask:      MaskMetrics;
  geometric: GeometricFit;
  bleed:     BleedRatios;
  deltaE:    number;
  /** Pass/fail per threshold. */
  pass: {
    iou:           boolean;
    dice:          boolean;
    boundaryF1:    boolean;
    cuticleError:  boolean;
    sidewallRatio: boolean;
    bleedTotal:    boolean;
    bleedCuticle:  boolean;
    deltaE:        boolean;
  };
  /** Aggregated pass (all thresholds satisfied). */
  allPass: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const THRESHOLDS = {
  iou:           0.82,
  iouDegraded:   0.72,
  dice:          0.88,
  boundaryF1:    0.80,
  cuticleErrorPx: 4.0,
  sidewallRatioMin: 0.92,
  sidewallRatioMax: 1.08,
  bleedTotal:    0.03,
  bleedCuticle:  0.02,
  deltaE:        8.0,
  jitterPx:      1.5,
} as const;

// ─── Mask metrics (IoU, Dice, BoundaryF1) ────────────────────────────────────

/**
 * Compute IoU and Dice similarity between two flat boolean arrays.
 * Both arrays must have the same length (W × H pixels).
 */
export function computeMaskOverlap(
  rendererMask: Uint8Array | boolean[],
  gtMask:       Uint8Array | boolean[],
): { iou: number; dice: number } {
  const n = rendererMask.length;
  if (n !== gtMask.length) {
    throw new Error(`Mask length mismatch: ${n} vs ${gtMask.length}`);
  }

  let inter = 0;
  let unionCount = 0;
  let sumR = 0;
  let sumG = 0;

  for (let i = 0; i < n; i++) {
    const r = rendererMask[i] ? 1 : 0;
    const g = gtMask[i] ? 1 : 0;
    inter += r & g;
    unionCount += (r | g);
    sumR += r;
    sumG += g;
  }

  const iou  = unionCount === 0 ? 1.0 : inter / unionCount;
  const dice = (sumR + sumG) === 0 ? 1.0 : (2 * inter) / (sumR + sumG);
  return { iou, dice };
}

/**
 * Compute boundary F1 (contour recall/precision) for two flat boolean masks.
 *
 * Boundary pixels are defined as mask-on pixels adjacent to at least one
 * mask-off pixel (4-connectivity). The boundary is dilated by `dilate`
 * pixels before matching (tolerance window).
 */
export function computeBoundaryF1(
  rendererMask: Uint8Array | boolean[],
  gtMask:       Uint8Array | boolean[],
  width:        number,
  height:       number,
  dilate:       number = 2,
): number {
  const rBoundary = _extractBoundary(rendererMask, width, height);
  const gBoundary = _extractBoundary(gtMask, width, height);

  const rDilated = _dilate(rBoundary, width, height, dilate);
  const gDilated = _dilate(gBoundary, width, height, dilate);

  let tp = 0, rCount = 0, gCount = 0;

  for (let i = 0; i < rBoundary.length; i++) {
    if (rBoundary[i]) rCount++;
    if (gBoundary[i]) gCount++;
    if (rBoundary[i] && gDilated[i]) tp++;
  }

  const precision = rCount === 0 ? 1.0 : tp / rCount;
  let tpG = 0;
  for (let i = 0; i < gBoundary.length; i++) {
    if (gBoundary[i] && rDilated[i]) tpG++;
  }
  const recall = gCount === 0 ? 1.0 : tpG / gCount;

  const f1 = (precision + recall) === 0 ? 0.0 : 2 * precision * recall / (precision + recall);
  return f1;
}

// ─── Zone-decomposed bleed ratios ────────────────────────────────────────────

/**
 * Compute bleed ratios for four zones: total, cuticle, sidewall, tip.
 *
 * Bleed pixels = renderer mask on, GT mask off.
 * Zone bleed = bleed pixels within that zone / total renderer mask pixels.
 *
 * Pass nullish for zone masks if not available (zone scores will be 0).
 */
export function computeBleed(
  rendererMask:    Uint8Array | boolean[],
  gtMask:          Uint8Array | boolean[],
  cuticleZone?:    Uint8Array | boolean[] | null,
  sidewallZone?:   Uint8Array | boolean[] | null,
  tipZone?:        Uint8Array | boolean[] | null,
): BleedRatios {
  const n = rendererMask.length;
  let totalBleed = 0;
  let cuticleBleed = 0;
  let sidewallBleed = 0;
  let tipBleed = 0;
  let rendererTotal = 0;

  for (let i = 0; i < n; i++) {
    const r = rendererMask[i] ? 1 : 0;
    const g = gtMask[i] ? 1 : 0;
    rendererTotal += r;
    const isBleed = r && !g;
    if (isBleed) {
      totalBleed++;
      if (cuticleZone  && cuticleZone[i])  cuticleBleed++;
      if (sidewallZone && sidewallZone[i]) sidewallBleed++;
      if (tipZone      && tipZone[i])      tipBleed++;
    }
  }

  if (rendererTotal === 0) {
    return { total: 0, cuticle: 0, sidewall: 0, tip: 0 };
  }

  return {
    total:    totalBleed    / rendererTotal,
    cuticle:  cuticleBleed  / rendererTotal,
    sidewall: sidewallBleed / rendererTotal,
    tip:      tipBleed      / rendererTotal,
  };
}

// ─── Geometric fit ────────────────────────────────────────────────────────────

/** Eval-only landmark point — z is optional since ground-truth annotations may omit depth. */
export interface EvalLandmarkPoint {
  x: number;  // normalised [0,1]
  y: number;  // normalised [0,1]
  z?: number;
}

/**
 * Compute geometric fit metrics from rendered and ground-truth landmarks.
 *
 * Both arrays use the 21-point MediaPipe convention.
 * Pixel distances require canvasW × canvasH for denormalisation.
 */
export function computeGeometricFit(
  renderedLandmarks: EvalLandmarkPoint[],
  gtLandmarks:       EvalLandmarkPoint[],
  fingerIndex:       number,
  canvasW:           number,
  canvasH:           number,
): GeometricFit {
  // Finger tip/DIP indices per finger (MediaPipe)
  const TIPS = [4, 8, 12, 16, 20];
  const DIPS = [3, 7, 11, 15, 19];
  const PIPS = [2, 6, 10, 14, 18];

  const fi = fingerIndex;

  const rTip = renderedLandmarks[TIPS[fi]];
  const rDip = renderedLandmarks[DIPS[fi]];
  const gTip = gtLandmarks[TIPS[fi]];
  const gDip = gtLandmarks[DIPS[fi]];

  // Cuticle anchor = DIP + cuticleT × (TIP - DIP)
  const CUTICLE_T = [0.20, 0.24, 0.24, 0.24, 0.24];
  const ct = CUTICLE_T[fi];

  const rCuticleX = (rDip.x + ct * (rTip.x - rDip.x)) * canvasW;
  const rCuticleY = (rDip.y + ct * (rTip.y - rDip.y)) * canvasH;
  const gCuticleX = (gDip.x + ct * (gTip.x - gDip.x)) * canvasW;
  const gCuticleY = (gDip.y + ct * (gTip.y - gDip.y)) * canvasH;

  const cuticleErrorPx = Math.hypot(rCuticleX - gCuticleX, rCuticleY - gCuticleY);

  // Sidewall ratio: rendered nail width / gt nail width
  const NW_SCALE = 0.52;
  const FINGER_W_MULT = [1.12, 1.00, 1.06, 0.97, 0.80];

  function segLen(a: EvalLandmarkPoint, b: EvalLandmarkPoint) {
    return Math.hypot((a.x - b.x) * canvasW, (a.y - b.y) * canvasH);
  }

  const rSegLen = segLen(rDip, rTip);
  const gSegLen = segLen(gDip, gTip);

  const rWidth = rSegLen * NW_SCALE * FINGER_W_MULT[fi];
  const gWidth = gSegLen * NW_SCALE * FINGER_W_MULT[fi];
  const sidewallRatio = gWidth === 0 ? 1.0 : rWidth / gWidth;

  // Axis angle error
  const rAngle = Math.atan2((rTip.y - rDip.y) * canvasH, (rTip.x - rDip.x) * canvasW);
  const gAngle = Math.atan2((gTip.y - gDip.y) * canvasH, (gTip.x - gDip.x) * canvasW);
  const axisAngleDeg = Math.abs(((rAngle - gAngle) * 180) / Math.PI) % 180;

  return { cuticleErrorPx, sidewallRatio, axisAngleDeg };
}

// ─── Colour ΔE CIEDE2000 ──────────────────────────────────────────────────────

/**
 * Compute CIEDE2000 ΔE between two RGB colour samples.
 * Uses a lightweight JS implementation (no external deps).
 *
 * @param expected - Expected colour from product definition
 * @param rendered - Mean sampled colour from renderer output
 */
export function computeDeltaE(expected: ColourSample, rendered: ColourSample): number {
  const lab1 = _rgbToLab(expected.r, expected.g, expected.b);
  const lab2 = _rgbToLab(rendered.r, rendered.g, rendered.b);
  return _ciede2000(lab1, lab2);
}

// ─── Temporal stability ───────────────────────────────────────────────────────

/**
 * Compute mean inter-frame jitter from a sequence of cuticle anchor positions.
 * Each point is in pixel space.
 */
export function computeJitter(
  anchors: Array<{ x: number; y: number } | null>,
): number {
  const valid = anchors.filter((a): a is { x: number; y: number } => a !== null);
  if (valid.length < 2) return 0;

  let sumDisp = 0;
  for (let i = 1; i < valid.length; i++) {
    sumDisp += Math.hypot(valid[i].x - valid[i - 1].x, valid[i].y - valid[i - 1].y);
  }
  return sumDisp / (valid.length - 1);
}

/**
 * Detect flicker: frames where the mask IoU drops > 0.08 then recovers > 0.08
 * within a 5-frame window. Returns count of flicker events.
 */
export function detectFlicker(
  iouSequence: number[],
  dropThreshold: number = 0.08,
  windowSize: number = 5,
): number {
  let flickerCount = 0;
  for (let i = 1; i < iouSequence.length - 1; i++) {
    const drop     = iouSequence[i - 1] - iouSequence[i];
    const recovery = iouSequence[Math.min(i + windowSize, iouSequence.length - 1)] - iouSequence[i];
    if (drop > dropThreshold && recovery > dropThreshold) {
      flickerCount++;
    }
  }
  return flickerCount;
}

/**
 * Convergence frame: first frame where IoU exceeds threshold and stays there
 * for at least `stableFrames` consecutive frames.
 */
export function convergenceFrame(
  iouSequence: number[],
  threshold:   number = THRESHOLDS.iou,
  stableFrames: number = 3,
): number {
  for (let i = 0; i < iouSequence.length; i++) {
    let stable = true;
    for (let j = i; j < Math.min(i + stableFrames, iouSequence.length); j++) {
      if (iouSequence[j] < threshold) { stable = false; break; }
    }
    if (stable) return i;
  }
  return iouSequence.length; // never converged
}

// ─── Aggregated suite ─────────────────────────────────────────────────────────

/**
 * Run the complete metric suite and evaluate all pass/fail thresholds.
 */
export function runMetricSuite(params: {
  rendererMask:      Uint8Array | boolean[];
  gtMask:            Uint8Array | boolean[];
  width:             number;
  height:            number;
  renderedLandmarks: EvalLandmarkPoint[];
  gtLandmarks:       EvalLandmarkPoint[];
  fingerIndex:       number;
  expectedColour:    ColourSample;
  renderedColour:    ColourSample;
  cuticleZone?:      Uint8Array | boolean[] | null;
  sidewallZone?:     Uint8Array | boolean[] | null;
  tipZone?:          Uint8Array | boolean[] | null;
  isDegraded?:       boolean;
}): MetricSuite {
  const { rendererMask, gtMask, width, height, fingerIndex, isDegraded = false } = params;

  const { iou, dice } = computeMaskOverlap(rendererMask, gtMask);
  const boundaryF1    = computeBoundaryF1(rendererMask, gtMask, width, height);
  const bleed         = computeBleed(rendererMask, gtMask, params.cuticleZone, params.sidewallZone, params.tipZone);
  const geometric     = computeGeometricFit(
    params.renderedLandmarks, params.gtLandmarks,
    fingerIndex, width, height,
  );
  const deltaE = computeDeltaE(params.expectedColour, params.renderedColour);

  const iouThreshold = isDegraded ? THRESHOLDS.iouDegraded : THRESHOLDS.iou;

  const pass = {
    iou:           iou           >= iouThreshold,
    dice:          dice          >= THRESHOLDS.dice,
    boundaryF1:    boundaryF1    >= THRESHOLDS.boundaryF1,
    cuticleError:  geometric.cuticleErrorPx <= THRESHOLDS.cuticleErrorPx,
    sidewallRatio: geometric.sidewallRatio  >= THRESHOLDS.sidewallRatioMin &&
                   geometric.sidewallRatio  <= THRESHOLDS.sidewallRatioMax,
    bleedTotal:    bleed.total   < THRESHOLDS.bleedTotal,
    bleedCuticle:  bleed.cuticle < THRESHOLDS.bleedCuticle,
    deltaE:        deltaE        <= THRESHOLDS.deltaE,
  };

  return {
    mask: { iou, dice, boundaryF1 },
    geometric,
    bleed,
    deltaE,
    pass,
    allPass: Object.values(pass).every(Boolean),
  };
}

// ─── Internal colour math ─────────────────────────────────────────────────────

function _sRgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function _rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = _sRgbToLinear(r);
  const gl = _sRgbToLinear(g);
  const bl = _sRgbToLinear(b);
  const X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;
  return [X, Y, Z];
}

function _f(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function _rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [X, Y, Z] = _rgbToXyz(r, g, b);
  const fx = _f(X / 0.95047);
  const fy = _f(Y / 1.00000);
  const fz = _f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function _ciede2000(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const avgL   = (L1 + L2) / 2;
  const C1     = Math.sqrt(a1 * a1 + b1 * b1);
  const C2     = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC   = (C1 + C2) / 2;
  const avgC7  = Math.pow(avgC, 7);
  const G      = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + 6103515625)));
  const a1p    = a1 * (1 + G);
  const a2p    = a2 * (1 + G);
  const C1p    = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p    = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * 180 / Math.PI;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180)  dhp -= 360;
    if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * Math.PI / 180);

  const avgLp  = (L1 + L2) / 2;
  const avgCp  = (C1p + C2p) / 2;
  let avgHp    = (h1p + h2p) / 2;
  if (Math.abs(h1p - h2p) > 180) avgHp = (h1p + h2p + 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.20 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const SL   = 1 + 0.015 * Math.pow(avgLp - 50, 2) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const SC   = 1 + 0.045 * avgCp;
  const SH   = 1 + 0.015 * avgCp * T;
  const avgCp7 = Math.pow(avgCp, 7);
  const RC   = 2 * Math.sqrt(avgCp7 / (avgCp7 + 6103515625));
  const d0   = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const RT   = -Math.sin(2 * d0 * Math.PI / 180) * RC;

  return Math.sqrt(
    Math.pow(dLp / SL, 2) +
    Math.pow(dCp / SC, 2) +
    Math.pow(dHp / SH, 2) +
    RT * (dCp / SC) * (dHp / SH),
  );
}

// ─── Internal boundary/dilation helpers ──────────────────────────────────────

function _extractBoundary(
  mask:   Uint8Array | boolean[],
  width:  number,
  height: number,
): boolean[] {
  const boundary: boolean[] = new Array(mask.length).fill(false);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      // Check 4-neighbours
      if (
        (x > 0 && !mask[i - 1]) ||
        (x < width - 1 && !mask[i + 1]) ||
        (y > 0 && !mask[i - width]) ||
        (y < height - 1 && !mask[i + width])
      ) {
        boundary[i] = true;
      }
    }
  }
  return boundary;
}

function _dilate(
  mask:   boolean[],
  width:  number,
  height: number,
  radius: number,
): boolean[] {
  let current = mask.slice();
  for (let r = 0; r < radius; r++) {
    const next = current.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (current[i]) {
          if (x > 0)          next[i - 1]     = true;
          if (x < width - 1)  next[i + 1]     = true;
          if (y > 0)          next[i - width]  = true;
          if (y < height - 1) next[i + width]  = true;
        }
      }
    }
    current = next;
  }
  return current;
}
