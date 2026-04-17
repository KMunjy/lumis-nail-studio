/**
 * simulate-cv-pipeline.ts
 * Deterministic CV pipeline simulation based on published MediaPipe benchmarks.
 * No actual images, models, or pixel data are loaded.
 * All outputs are reproducible given the same seed.
 */

import type { SyntheticImage, SyntheticProduct, SyntheticSession, RNG } from "./synthetic-data-gen";

// ─── Base probabilities from published MediaPipe benchmarks ───────────────────

const BASE_DETECTION_PROB: Record<number, number> = {
  1: 0.981,
  2: 0.978,
  3: 0.975,
  4: 0.972,
  5: 0.969,
  6: 0.965,
};

const LIGHTING_MULTIPLIER: Record<string, number> = {
  bright: 1.008,
  natural: 1.0,
  low: 0.978,
  extreme: 0.940,
};

const SHAPE_DICE: Record<string, number> = {
  square: 0.931,
  oval: 0.928,
  almond: 0.919,
  round: 0.925,
  coffin: 0.912,
};

const ORIENTATION_PENALTY: Record<string, number> = {
  palm_down: 0.0,
  palm_up: -0.002,
  side: -0.015,
  partial: -0.045,
};

const ARTIFACT_PENALTY: Record<string, number> = {
  motion_blur: -0.025,
  noise: -0.018,
  jewelry: -0.012,
  painted: -0.005,
};

// ─── Gaussian noise helper ────────────────────────────────────────────────────

/** Box-Muller transform using two uniform samples from rng */
function gaussianNoise(rng: RNG, sigma: number): number {
  const u1 = Math.max(1e-10, rng.next());
  const u2 = rng.next();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── simulateDetection ────────────────────────────────────────────────────────

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  landmarkError: number; // mean pixel error across 21 landmarks
}

export function simulateDetection(image: SyntheticImage, rng: RNG): DetectionResult {
  let prob = BASE_DETECTION_PROB[image.fitzpatrick];

  // Apply lighting multiplier
  prob *= LIGHTING_MULTIPLIER[image.lighting];

  // Apply orientation penalty
  prob += ORIENTATION_PENALTY[image.orientation];

  // Apply artifact penalties
  for (const art of image.artifacts) {
    prob += ARTIFACT_PENALTY[art];
  }

  // Add calibrated Gaussian noise (sigma=0.008)
  prob += gaussianNoise(rng, 0.008);
  prob = clamp(prob, 0, 1);

  const detected = rng.next() < prob;

  // Confidence: slightly lower than detection prob with noise
  const confidence = clamp(prob + gaussianNoise(rng, 0.005), 0, 1);

  // Landmark error: lower lighting/partial orientation → higher error
  const baseLandmarkError = image.lighting === "extreme" ? 4.2 : image.lighting === "low" ? 2.8 : 1.4;
  const orientBonus = image.orientation === "partial" ? 2.5 : image.orientation === "side" ? 1.2 : 0;
  const landmarkError = clamp(
    baseLandmarkError + orientBonus + gaussianNoise(rng, 0.5),
    0.1,
    15
  );

  return { detected, confidence, landmarkError };
}

// ─── simulateSegmentation ─────────────────────────────────────────────────────

export interface SegmentationResult {
  dice: number;
  iou: number;
  boundaryErrorPx: number;
}

export function simulateSegmentation(image: SyntheticImage, rng: RNG): SegmentationResult {
  const baseDice = SHAPE_DICE[image.nailShape];

  // Apply lighting degradation
  const lightingFactor =
    image.lighting === "bright"
      ? 1.002
      : image.lighting === "natural"
      ? 1.0
      : image.lighting === "low"
      ? 0.975
      : 0.945;

  // Artifact penalties for segmentation
  let artifactPenalty = 0;
  for (const art of image.artifacts) {
    artifactPenalty += ARTIFACT_PENALTY[art] * 0.8;
  }

  const dice = clamp(
    baseDice * lightingFactor + artifactPenalty + gaussianNoise(rng, 0.006),
    0,
    1
  );

  // IoU derived from dice: IoU = dice / (2 - dice) + noise
  const iou = clamp(dice / (2 - dice) + gaussianNoise(rng, 0.004), 0, 1);

  // Boundary error in pixels
  const boundaryBase = image.nailShape === "coffin" ? 2.8 : image.nailShape === "almond" ? 2.5 : 1.8;
  const boundaryErrorPx = clamp(boundaryBase + gaussianNoise(rng, 0.4), 0.1, 10);

  return { dice, iou, boundaryErrorPx };
}

// ─── simulatePolishRender ─────────────────────────────────────────────────────

export interface PolishRenderResult {
  deltaE: number;
  renderTimeMs: number;
  success: boolean;
}

export function simulatePolishRender(
  image: SyntheticImage,
  product: SyntheticProduct,
  rng: RNG
): PolishRenderResult {
  // ΔE: color accuracy — higher opacity and glitter finish challenge matching
  const finishPenalty: Record<string, number> = {
    cream: 0,
    gel: 0.3,
    matte: 0.5,
    shimmer: 1.2,
    glitter: 2.1,
  };

  const lightingDeltaE: Record<string, number> = {
    bright: 0.5,
    natural: 0.8,
    low: 2.2,
    extreme: 3.8,
  };

  const baseDeltaE =
    lightingDeltaE[image.lighting] +
    finishPenalty[product.finish] +
    (1 - product.opacity) * 1.5;

  const deltaE = clamp(baseDeltaE + Math.abs(gaussianNoise(rng, 0.4)), 0, 12);

  // Render time: base 800ms, varies by resolution and finish
  const resFactor = (image.resolution.width * image.resolution.height) / (1920 * 1080);
  const baseRenderMs = 800 * resFactor;
  const finishRenderMultiplier: Record<string, number> = {
    cream: 1.0,
    gel: 1.1,
    matte: 1.05,
    shimmer: 1.4,
    glitter: 1.8,
  };
  const renderTimeMs = clamp(
    baseRenderMs * finishRenderMultiplier[product.finish] + gaussianNoise(rng, 120),
    50,
    8000
  );

  // Success: fail if extreme lighting + high-complexity finish
  const failProb =
    image.lighting === "extreme" && product.finish === "glitter" ? 0.08 : 0.005;
  const success = rng.next() > failProb;

  return { deltaE, renderTimeMs, success };
}

// ─── simulateUpload ───────────────────────────────────────────────────────────

export interface UploadResult {
  success: boolean;
  latencyMs: number;
  format: string;
}

export function simulateUpload(session: SyntheticSession, rng: RNG): UploadResult {
  const FORMATS = ["jpeg", "png", "heic"];
  const format = FORMATS[Math.floor(rng.next() * FORMATS.length)];

  const networkLatencyBase: Record<string, number> = {
    "5g": 80,
    "4g": 250,
    "3g": 900,
    offline: 9999,
  };

  const networkSuccessRate: Record<string, number> = {
    "5g": 0.998,
    "4g": 0.985,
    "3g": 0.930,
    offline: 0.0,
  };

  const formatSuccessModifier: Record<string, number> = {
    jpeg: 0,
    png: 0,
    heic: -0.008,
  };

  const baseLatency = networkLatencyBase[session.network];
  const latencyMs = clamp(
    baseLatency + Math.abs(gaussianNoise(rng, baseLatency * 0.2)),
    10,
    30000
  );

  const successProb = clamp(
    networkSuccessRate[session.network] + formatSuccessModifier[format],
    0,
    1
  );
  const success = rng.next() < successProb;

  return { success, latencyMs, format };
}
