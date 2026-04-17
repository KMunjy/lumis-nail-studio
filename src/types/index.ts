// ─── LUMIS Design System — Shared Types ──────────────────────────────────────
// These mirror the design tokens from the Stitch PRD. Keep in sync with
// globals.css and the products catalog.

export type NailShape = "Almond" | "Stiletto" | "Oval" | "Coffin" | "Square";

/**
 * v3.4 — extended finish palette:
 *   Gloss    — classic high-shine (v3.2)
 *   Matte    — flat no-specular (v3.2)
 *   Metallic — warm shimmer band (v3.2)
 *   Chrome   — mirror multi-band reflection (v3.2)
 *   Jelly    — translucent/sheer with nail-bed show-through (v3.4)
 *   Glitter  — particle sparkle scatter on top of base (v3.4)
 *   CatEye   — anisotropic magnetic shimmer streak (v3.4)
 */
export type NailFinish =
  | "Gloss"
  | "Matte"
  | "Metallic"
  | "Chrome"
  | "Jelly"
  | "Glitter"
  | "CatEye";

/** Rendering descriptor passed down to the Lume Engine canvas renderer. */
export interface NailStyle {
  topColor: string;
  midColor: string;
  bottomColor: string;
  shape: NailShape;
  finish?: NailFinish;
  /** 0–1 opacity; defaults to 0.92 to allow subtle skin-tone bleed through */
  opacity?: number;
  /**
   * v3.4 — finish-specific overrides (all optional):
   *   skinToneHex   : used by Jelly to composite nail-bed show-through
   *   glitterDensity: [0.02–0.12] sparkle density, default 0.06
   *   catEyeDir     : [-1, 1] horizontal shimmer streak position, default 0.3
   */
  skinToneHex?: string;
  glitterDensity?: number;
  catEyeDir?: number;
}

/**
 * v3.4 — Lighting estimate derived from uploaded photo analysis.
 * Passed to drawNail() to adapt highlight placement and specular colour.
 */
export interface LightingEstimate {
  /** Normalised 2-D light direction [-1,1] each axis. {0,0} = overhead. */
  primaryDir: { x: number; y: number };
  /** Estimated scene colour temperature in Kelvin (2700–7000). */
  colourTempK: number;
  /** Mean luminance of scene [0–1]. Used to scale overlay opacity. */
  ambientBrightness: number;
}

/** 3-component normalized landmark point from MediaPipe. */
export interface LandmarkPoint {
  x: number; // 0–1, left→right in raw video frame
  y: number; // 0–1, top→bottom
  z: number; // relative depth (smaller = closer)
}

export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: number;
}
