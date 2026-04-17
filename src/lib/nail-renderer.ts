/**
 * Lume Engine — Nail Renderer  v4.0
 *
 * Canvas-based nail overlay renderer. Each public function draws one nail
 * onto the supplied CanvasRenderingContext2D and is purely functional — no
 * internal state, safe to call in a rAF loop.
 *
 * Changelog:
 *   v4.0  — Stitch-quality rendering pass (Sprint 3)
 *           applyCenterBrightness NEW: convex surface center brightening
 *           applyTransverseCurvature: intensity raised +50–60% across all finishes;
 *             darkening extends from edge to 20% inward (was 10%) for stronger 3-D tube
 *           applyGloss: specular peak 0.28→0.58, left-offset streak + vertical fade,
 *             specular dot 0.32→0.75 — matches Stitch reference
 *           applyMetallic: band peak 0.45→0.68, spec dot 0.55→0.90, cuticle shadow added
 *           applyChrome: tip 0.70→0.95, dark band 0.30→0.52, mirror 0.55→0.82,
 *             stripe peak 0.60→0.88 — dramatic multi-band environment map
 *           applyTipHighlight: alpha raised Chrome 0.22→0.40, Metallic 0.18→0.30,
 *             Gloss 0.14→0.24
 *           Base gradient: diagonal upper-left bias for beauty-lighting convention
 *   v3.5  — Transverse curvature shadow (lateral edge darkening, all finishes)
 *           Tip free-edge highlight (specular brightening at free edge)
 *           Both passes physically motivated by nail surface geometry
 *   v3.4  — Jelly / Glitter / CatEye finish modes
 *           Lighting-adaptive highlight positioning (LightingEstimate)
 *           Seeded-PRNG glitter for stable sparkle across frames
 *           CatEye directional shimmer with pointer/gyro hook-point
 *           Jelly nail-bed show-through with internal refraction highlight
 *   v3.3  — NW_SCALE calibrated 0.46 → 0.52 (width +6.9pp, composite 99.25%)
 *   v3.2  — Gloss / Matte / Metallic / Chrome finish stack
 *   v3.1  — Anchor placement, tip extensions, angle blend
 *   v3.0  — Dorsal detection, DEMA smoother integration
 *
 * Coordinate conventions:
 *   - All landmark points are MediaPipe-normalized [0,1] coordinates.
 *   - The caller maps them to canvas pixels before passing in.
 *   - Local space after ctx.translate + ctx.rotate:
 *       negative Y = toward tip, positive Y = toward palm, origin = cuticle anchor.
 */

import type { NailShape, NailStyle, LandmarkPoint, LightingEstimate } from "@/types";

// ─── Per-finger anatomy constants ─────────────────────────────────────────────

const FINGER_W_MULT    = [1.12, 1.00, 1.06, 0.97, 0.80] as const;
const FINGER_CUTICLE_T = [0.20, 0.24, 0.24, 0.24, 0.24] as const;

// ─── Shape path builders ──────────────────────────────────────────────────────

function almondPath(nw: number, nh: number): Path2D {
  const p = new Path2D();
  const hw = nw / 2;
  p.moveTo(-hw * 0.80, 0);
  p.quadraticCurveTo(0, nh * 0.08, hw * 0.80, 0);
  p.bezierCurveTo(hw * 0.88, -nh * 0.28, hw * 0.66, -nh * 0.66, hw * 0.16, -nh * 0.94);
  p.quadraticCurveTo(0, -nh, -hw * 0.16, -nh * 0.94);
  p.bezierCurveTo(-hw * 0.66, -nh * 0.66, -hw * 0.88, -nh * 0.28, -hw * 0.80, 0);
  p.closePath();
  return p;
}

function stilettoPath(nw: number, nh: number): Path2D {
  const p = new Path2D();
  const hw = nw / 2;
  p.moveTo(-hw * 0.80, 0);
  p.quadraticCurveTo(0, nh * 0.08, hw * 0.80, 0);
  p.bezierCurveTo(hw * 0.86, -nh * 0.36, hw * 0.55, -nh * 0.70, 0, -nh);
  p.bezierCurveTo(-hw * 0.55, -nh * 0.70, -hw * 0.86, -nh * 0.36, -hw * 0.80, 0);
  p.closePath();
  return p;
}

function ovalPath(nw: number, nh: number): Path2D {
  const p = new Path2D();
  const hw = nw / 2;
  p.moveTo(-hw * 0.80, 0);
  p.quadraticCurveTo(0, nh * 0.08, hw * 0.80, 0);
  p.bezierCurveTo(hw * 0.88, -nh * 0.28, hw * 0.80, -nh * 0.65, 0, -nh);
  p.bezierCurveTo(-hw * 0.80, -nh * 0.65, -hw * 0.88, -nh * 0.28, -hw * 0.80, 0);
  p.closePath();
  return p;
}

function coffinPath(nw: number, nh: number): Path2D {
  const p = new Path2D();
  const hw = nw / 2;
  const topHw = hw * 0.34;
  p.moveTo(-hw * 0.80, 0);
  p.quadraticCurveTo(0, nh * 0.08, hw * 0.80, 0);
  p.bezierCurveTo(hw * 0.88, -nh * 0.26, hw * 0.55, -nh * 0.68, topHw, -nh);
  p.lineTo(-topHw, -nh);
  p.bezierCurveTo(-hw * 0.55, -nh * 0.68, -hw * 0.88, -nh * 0.26, -hw * 0.80, 0);
  p.closePath();
  return p;
}

function squarePath(nw: number, nh: number): Path2D {
  const p = new Path2D();
  const hw = nw / 2;
  p.moveTo(-hw * 0.80, 0);
  p.quadraticCurveTo(0, nh * 0.08, hw * 0.80, 0);
  p.lineTo(hw * 0.80, -nh);
  p.lineTo(-hw * 0.80, -nh);
  p.closePath();
  return p;
}

function buildPath(shape: NailShape, nw: number, nh: number): Path2D {
  switch (shape) {
    case "Stiletto": return stilettoPath(nw, nh);
    case "Oval":     return ovalPath(nw, nh);
    case "Coffin":   return coffinPath(nw, nh);
    case "Square":   return squarePath(nw, nh);
    default:         return almondPath(nw, nh);
  }
}

// ─── Tip extension factors ────────────────────────────────────────────────────

function tipExtension(shape: NailShape): number {
  switch (shape) {
    case "Stiletto": return 0.60;
    case "Almond":   return 0.18;
    case "Coffin":   return 0.05;
    case "Oval":     return 0.04;
    case "Square":   return 0.00;
    default:         return 0.18;
  }
}

// ─── Direction field helper ───────────────────────────────────────────────────

function computeNailAngle(
  tipPx: { x: number; y: number },
  dipPx: { x: number; y: number },
  pipPx?: { x: number; y: number }
): number {
  const v1x = tipPx.x - dipPx.x;
  const v1y = tipPx.y - dipPx.y;

  if (!pipPx) return Math.atan2(v1y, v1x) + Math.PI / 2;

  const v2x = dipPx.x - pipPx.x;
  const v2y = dipPx.y - pipPx.y;
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);

  if (len1 < 1 || len2 < 1) return Math.atan2(v1y, v1x) + Math.PI / 2;

  const dirX = 0.70 * (v1x / len1) + 0.30 * (v2x / len2);
  const dirY = 0.70 * (v1y / len1) + 0.30 * (v2y / len2);
  return Math.atan2(dirY, dirX) + Math.PI / 2;
}

// ─── Seeded PRNG (Mulberry32) — stable glitter per nail size ─────────────────

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Colour temperature → specular tint ──────────────────────────────────────

/**
 * Map Kelvin colour temperature to an RGBA specular tint string.
 * Warm light (2700K) → golden specular; cool/daylight (6500K) → pure white.
 */
function specularTintFromTemp(colourTempK: number): string {
  const t = Math.max(0, Math.min(1, (colourTempK - 2700) / (6500 - 2700)));
  const r = Math.round(255);
  const g = Math.round(220 + t * 35);        // warm=220, cool=255
  const b = Math.round(160 + t * 95);        // warm=160, cool=255
  return `rgba(${r},${g},${b},`;             // caller appends alpha + ")"
}

// ─── Transverse curvature & tip highlight (all finishes) ─────────────────────

/**
 * CURVATURE SHADOW — v3.5 NEW.
 *
 * A nail is a convex surface that curves away from the viewer at its lateral
 * edges. The edges therefore receive less direct light and appear darker.
 * This pass adds a horizontal (left→right) radial darkening at the rim.
 *
 * The effect intensity is tuned per finish:
 *   Chrome / Metallic — strong (high specular, curvature is very visible)
 *   Gloss             — medium (smooth surface shows curvature clearly)
 *   Matte             — light (diffuse surface; less specular curvature)
 *   Jelly             — very light (semi-transparent; edge brightens via IOR)
 *   Glitter / CatEye  — medium
 */
function applyTransverseCurvature(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  finish: string,
): void {
  ctx.save();
  ctx.clip(path);

  // v4.0: intensities raised +50–60% vs v3.5 to match Stitch 3-D curvature.
  // Darkening zone extended inward to 20% of half-width (was 10%) for a
  // stronger convex-tube read on all nail shapes.
  const intensity =
    finish === "Chrome"    ? 0.46 :
    finish === "Metallic"  ? 0.38 :
    finish === "CatEye"    ? 0.35 :
    finish === "Gloss"     ? 0.32 :
    finish === "Glitter"   ? 0.26 :
    finish === "Matte"     ? 0.22 :
    finish === "Jelly"     ? 0.14 :
    0.32;

  // Left edge — fades from full intensity at rim to 0 at 20% inward
  const left = ctx.createLinearGradient(-nw * 0.50, 0, -nw * 0.20, 0);
  left.addColorStop(0,   `rgba(0,0,0,${intensity})`);
  left.addColorStop(0.6, `rgba(0,0,0,${intensity * 0.4})`);
  left.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = left;
  ctx.fill(path);

  // Right edge — mirror of left
  const right = ctx.createLinearGradient(nw * 0.50, 0, nw * 0.20, 0);
  right.addColorStop(0,   `rgba(0,0,0,${intensity})`);
  right.addColorStop(0.6, `rgba(0,0,0,${intensity * 0.4})`);
  right.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = right;
  ctx.fill(path);

  ctx.restore();
}

/**
 * CENTER BRIGHTNESS — v4.0 NEW.
 *
 * A convex nail surface curves away at the edges and is most perpendicular
 * to overhead light at the centre. This pass adds a soft brightening strip
 * down the vertical centre of the nail, opposing the lateral edge shadows.
 *
 * Applied to all specular finishes; skipped for Matte (diffuse) and
 * Glitter (sparkle already implies depth).
 */
function applyCenterBrightness(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  finish: string,
  lighting?: LightingEstimate,
): void {
  if (finish === "Matte" || finish === "Glitter") return;

  ctx.save();
  ctx.clip(path);

  // Shift peak slightly toward estimated light source for physical consistency
  const lightShift = lighting ? lighting.primaryDir.x * nw * 0.12 : -nw * 0.08;
  const peakX = -nw * 0.08 + lightShift;   // slight left-of-centre default

  const alpha =
    finish === "Chrome"    ? 0.18 :
    finish === "Metallic"  ? 0.16 :
    finish === "Gloss"     ? 0.14 :
    finish === "CatEye"    ? 0.12 :
    finish === "Jelly"     ? 0.10 :
    0.10;

  const center = ctx.createRadialGradient(peakX, -nh * 0.50, 0, peakX, -nh * 0.50, nw * 0.40);
  center.addColorStop(0,    `rgba(255,255,255,${alpha})`);
  center.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.3})`);
  center.addColorStop(1,    "rgba(255,255,255,0)");
  ctx.fillStyle = center;
  ctx.fill(path);

  ctx.restore();
}

/**
 * TIP HIGHLIGHT — v3.5 NEW.
 *
 * The free edge of the nail (tip zone) is the area most perpendicular to
 * the overhead light in most natural scenes. A narrow brightening band
 * across the top ~15% of nail height reads as the transition to the free edge.
 *
 * Applied for: Gloss, Chrome, Metallic, Jelly, CatEye.
 * Skipped for: Matte (diffuse — no specular tip), Glitter (obscured by sparkle).
 */
function applyTipHighlight(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  finish: string,
  lighting?: LightingEstimate,
): void {
  if (finish === "Matte" || finish === "Glitter") return;

  ctx.save();
  ctx.clip(path);

  const specTint = lighting
    ? specularTintFromTemp(lighting.colourTempK)
    : "rgba(255,255,255,";

  // v4.0: alpha raised to match Stitch free-edge brightness
  const alpha =
    finish === "Chrome"   ? 0.40 :
    finish === "Metallic" ? 0.30 :
    finish === "Gloss"    ? 0.24 :
    finish === "CatEye"   ? 0.18 :
    finish === "Jelly"    ? 0.14 :
    0.14;

  // Tip band extends 25% down from tip (was 20%) for a more visible free-edge catch
  const tip = ctx.createLinearGradient(0, -nh, 0, -nh * 0.75);
  tip.addColorStop(0,    `${specTint}${alpha})`);
  tip.addColorStop(0.50, `${specTint}${alpha * 0.5})`);
  tip.addColorStop(1,    `${specTint}0)`);
  ctx.fillStyle = tip;
  ctx.fill(path);

  ctx.restore();
}

// ─── Finish rendering passes ──────────────────────────────────────────────────

/**
 * GLOSS — v4.0: left-offset streak + vertical fade + hot specular dot + rim light.
 * Matches Stitch reference: peak at x ≈ -28% from centre, 0.58 opacity streak.
 */
function applyGloss(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  opacity: number,
  lighting?: LightingEstimate,
): void {
  ctx.save();
  ctx.clip(path);

  const lightShift = lighting ? lighting.primaryDir.x * nw * 0.18 : 0;
  const specTint   = lighting ? specularTintFromTemp(lighting.colourTempK) : "rgba(255,255,255,";
  // Streak offset: left of centre (beauty-lighting convention)
  const streakX0 = -nw * 0.55 + lightShift;
  const streakX1 =  nw * 0.10 + lightShift;

  // Horizontal streak — left-offset, peak 0.58
  const streak = ctx.createLinearGradient(streakX0, 0, streakX1, 0);
  streak.addColorStop(0,    `${specTint}0)`);
  streak.addColorStop(0.45, `${specTint}0.58)`);
  streak.addColorStop(0.75, `${specTint}0.18)`);
  streak.addColorStop(1,    `${specTint}0)`);
  ctx.fillStyle = streak;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  // Vertical fade — brightest at tip, fades to 0 at 85% height
  const vfade = ctx.createLinearGradient(0, -nh * 0.92, 0, -nh * 0.15);
  vfade.addColorStop(0,    `${specTint}0.55)`);
  vfade.addColorStop(0.70, `${specTint}0.18)`);
  vfade.addColorStop(1,    `${specTint}0)`);
  ctx.fillStyle = vfade;
  ctx.globalAlpha = opacity * 0.85;
  ctx.fill(path);

  // Hot specular dot — shifted by light direction, 0.75 peak
  const specYShift = lighting ? lighting.primaryDir.y * nh * 0.08 : 0;
  const dotX = -nw * 0.18 + lightShift;
  const spec = ctx.createRadialGradient(
    dotX, -nh * 0.76 + specYShift, 0,
    dotX, -nh * 0.76 + specYShift, nw * 0.18,
  );
  spec.addColorStop(0,    `${specTint}0.75)`);
  spec.addColorStop(0.40, `${specTint}0.28)`);
  spec.addColorStop(1,    `${specTint}0)`);
  ctx.fillStyle = spec;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  // Right-edge rim light — opposing the main specular
  const rim = ctx.createLinearGradient(nw * 0.60, 0, nw * 0.22, 0);
  rim.addColorStop(0,   `${specTint}0.20)`);
  rim.addColorStop(1,   `${specTint}0)`);
  ctx.fillStyle = rim;
  ctx.globalAlpha = opacity * 0.60;
  ctx.fill(path);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * MATTE — micro-noise grain pass for tactile surface feel.
 */
function applyMatte(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  opacity: number,
): void {
  ctx.save();
  ctx.clip(path);

  const edgeShadow = ctx.createRadialGradient(0, -nh * 0.50, nw * 0.10, 0, -nh * 0.50, nw * 0.70);
  edgeShadow.addColorStop(0, "rgba(0,0,0,0)");
  edgeShadow.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = edgeShadow;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  // Micro-grain lines — matte surfaces show micro-texture
  ctx.globalAlpha = opacity * 0.06;
  for (let i = 0; i < 3; i++) {
    const y = -nh * (0.25 + i * 0.22);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(-nw / 2, y, nw, 0.5);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * METALLIC — v4.0: stronger reflection band + cuticle shadow + brighter spec.
 */
function applyMetallic(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  opacity: number,
  lighting?: LightingEstimate,
): void {
  ctx.save();
  ctx.clip(path);

  const lightShift = lighting ? lighting.primaryDir.x * nw * 0.15 : 0;
  const specTint   = lighting ? specularTintFromTemp(lighting.colourTempK) : "rgba(255,255,255,";

  // Cuticle shadow — metallic shows stark base shadow
  const shadow = ctx.createLinearGradient(0, 0, 0, -nh * 0.28);
  shadow.addColorStop(0,   "rgba(0,0,0,0.28)");
  shadow.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = shadow;
  ctx.globalAlpha = opacity * 0.80;
  ctx.fill(path);

  // Horizontal reflection band — peak raised 0.45→0.68
  const band = ctx.createLinearGradient(-nw * 0.55 + lightShift, 0, nw * 0.55 + lightShift, 0);
  band.addColorStop(0,    `${specTint}0)`);
  band.addColorStop(0.20, `${specTint}0.14)`);
  band.addColorStop(0.48, `${specTint}0.68)`);
  band.addColorStop(0.72, `${specTint}0.14)`);
  band.addColorStop(1,    `${specTint}0)`);
  ctx.fillStyle = band;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  // Vertical tip streak
  const streak = ctx.createLinearGradient(0, -nh, 0, -nh * 0.30);
  streak.addColorStop(0,    `${specTint}0.35)`);
  streak.addColorStop(0.40, `${specTint}0.10)`);
  streak.addColorStop(1,    `${specTint}0)`);
  ctx.fillStyle = streak;
  ctx.globalAlpha = opacity * 0.80;
  ctx.fill(path);

  // Tight specular dot — peak raised 0.55→0.90
  const sx = -nw * 0.10 + lightShift;
  const spec = ctx.createRadialGradient(sx, -nh * 0.80, 0, sx, -nh * 0.80, nw * 0.16);
  spec.addColorStop(0,    `${specTint}0.90)`);
  spec.addColorStop(0.45, `${specTint}0.25)`);
  spec.addColorStop(1,    `${specTint}0)`);
  ctx.fillStyle = spec;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * CHROME — v4.0: dramatic multi-band environment map matching Stitch gold/chrome nails.
 * Very high contrast: near-white tip → dark band → bright mirror band → dark base.
 */
function applyChrome(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  opacity: number,
): void {
  ctx.save();
  ctx.clip(path);

  // Multi-band vertical env map — tip 0.70→0.95, dark 0.30→0.52, mirror 0.55→0.82
  const env = ctx.createLinearGradient(0, -nh, 0, 0);
  env.addColorStop(0,    "rgba(255,255,255,0.95)");  // near-white tip
  env.addColorStop(0.14, "rgba(210,225,235,0.28)");
  env.addColorStop(0.28, "rgba(0,0,0,0.52)");         // dark band
  env.addColorStop(0.48, "rgba(255,255,255,0.82)");   // mirror band
  env.addColorStop(0.66, "rgba(150,170,190,0.22)");
  env.addColorStop(0.84, "rgba(0,0,0,0.32)");
  env.addColorStop(1,    "rgba(255,255,255,0.12)");
  ctx.fillStyle = env;
  ctx.globalAlpha = opacity * 0.92;
  ctx.fill(path);

  // Diagonal highlight stripe — peak 0.60→0.88
  const stripe = ctx.createLinearGradient(-nw * 0.65, -nh * 0.44, nw * 0.58, -nh * 0.28);
  stripe.addColorStop(0,    "rgba(255,255,255,0)");
  stripe.addColorStop(0.38, "rgba(255,255,255,0.82)");
  stripe.addColorStop(0.50, "rgba(255,255,255,0.88)");
  stripe.addColorStop(0.62, "rgba(255,255,255,0.82)");
  stripe.addColorStop(1,    "rgba(255,255,255,0)");
  ctx.fillStyle = stripe;
  ctx.globalAlpha = opacity * 0.70;
  ctx.fill(path);

  // Tight specular pinpoint
  const spec = ctx.createRadialGradient(-nw * 0.10, -nh * 0.82, 0, -nw * 0.10, -nh * 0.82, nw * 0.10);
  spec.addColorStop(0,    "rgba(255,255,255,0.95)");
  spec.addColorStop(0.40, "rgba(255,255,255,0.30)");
  spec.addColorStop(1,    "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * JELLY — v3.4 NEW.
 * Translucent/sheer finish with nail-bed show-through and internal refraction.
 * Opacity is deliberately low (0.35–0.50) — the nail plate and skin are visible.
 *
 * Rendering layers (bottom to top):
 *   1. Skin-tone tint (show-through nail bed)
 *   2. Semi-transparent polish fill
 *   3. Internal refraction highlight (soft oval, upper centre)
 *   4. Rim glow (edge lightening from IOR)
 */
function applyJelly(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  opacity: number,
  skinToneHex: string,
  lighting?: LightingEstimate,
): void {
  ctx.save();
  ctx.clip(path);

  // 1. Nail-bed show-through — faint skin-tone fill beneath the jelly
  ctx.fillStyle = skinToneHex;
  ctx.globalAlpha = 0.12;
  ctx.fill(path);

  // 2. Internal depth gradient — jelly has visible depth (lighter at tip, deeper at cuticle)
  const lightShift = lighting ? lighting.primaryDir.x * nw * 0.12 : 0;
  const depth = ctx.createLinearGradient(0, -nh, 0, 0);
  depth.addColorStop(0,    "rgba(255,255,255,0.08)");   // tip: lighter
  depth.addColorStop(0.60, "rgba(0,0,0,0.04)");         // mid
  depth.addColorStop(1,    "rgba(0,0,0,0.10)");          // cuticle: deeper
  ctx.fillStyle = depth;
  ctx.globalAlpha = opacity * 0.80;
  ctx.fill(path);

  // 3. Internal refraction highlight — soft glowing oval in upper centre
  //    Simulates light bending through the translucent medium
  const refractX = lightShift * 0.5;
  const refract = ctx.createRadialGradient(
    refractX, -nh * 0.52, 0,
    refractX, -nh * 0.52, nw * 0.32,
  );
  refract.addColorStop(0,    "rgba(255,255,255,0.22)");
  refract.addColorStop(0.50, "rgba(255,255,255,0.08)");
  refract.addColorStop(1,    "rgba(255,255,255,0)");
  ctx.fillStyle = refract;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  // 4. IOR rim glow — edge lightening from refractive index
  const rim = ctx.createRadialGradient(0, -nh * 0.50, nw * 0.25, 0, -nh * 0.50, nw * 0.65);
  rim.addColorStop(0,    "rgba(255,255,255,0)");
  rim.addColorStop(0.80, "rgba(255,255,255,0)");
  rim.addColorStop(1,    "rgba(255,255,255,0.15)");
  ctx.fillStyle = rim;
  ctx.globalAlpha = opacity * 0.70;
  ctx.fill(path);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * GLITTER — v3.4 NEW.
 * Seeded-PRNG sparkle scatter over base colour.
 * Seed derived from nw × nh → stable sparkle pattern per nail/frame.
 *
 * Three sparkle tiers:
 *   Large: 1.5–3px, low density — catches directional light
 *   Small: 0.5–1.5px, medium density — scatter fill
 *   Micro: 0.3–0.8px, high density — glitter dust
 */
function applyGlitter(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  opacity: number,
  density: number,   // [0.02, 0.12] — caller-supplied or default 0.06
  lighting?: LightingEstimate,
): void {
  ctx.save();
  ctx.clip(path);

  const seed = Math.round(nw * 1000 + nh * 7);
  const rng  = mulberry32(seed);

  const lightShift = lighting ? lighting.primaryDir.x * 0.4 : 0;
  const specTint   = lighting ? specularTintFromTemp(lighting.colourTempK) : "rgba(255,255,255,";

  const area     = nw * nh;
  const nLarge   = Math.max(2,  Math.round(area * density * 0.015));
  const nSmall   = Math.max(5,  Math.round(area * density * 0.06));
  const nMicro   = Math.max(10, Math.round(area * density * 0.25));

  // Large sparkles — 4-point star shape
  for (let i = 0; i < nLarge; i++) {
    const sx    = (rng() - 0.5) * nw * 0.86;
    const sy    = -(rng() * nh * 0.92 + nh * 0.04);
    const sr    = rng() * 1.5 + 1.5;
    const alpha = (rng() * 0.5 + 0.5) * opacity;

    // Bias brightness to light-source side
    const brightnessBias = 1 + lightShift * (sx / (nw * 0.5));
    const finalAlpha     = Math.min(1, alpha * Math.max(0.4, brightnessBias));

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.2);
    g.addColorStop(0,    `${specTint}${finalAlpha})`);
    g.addColorStop(0.30, `${specTint}${finalAlpha * 0.6})`);
    g.addColorStop(1,    `${specTint}0)`);
    ctx.fillStyle = g;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small sparkles — radial dot
  for (let i = 0; i < nSmall; i++) {
    const sx    = (rng() - 0.5) * nw * 0.88;
    const sy    = -(rng() * nh * 0.90 + nh * 0.05);
    const sr    = rng() * 0.8 + 0.5;
    const alpha = (rng() * 0.6 + 0.2) * opacity;

    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.8);
    g.addColorStop(0, `${specTint}${alpha})`);
    g.addColorStop(1, `${specTint}0)`);
    ctx.fillStyle = g;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Micro sparkle dust — single-pixel dots
  ctx.globalAlpha = opacity * 0.45;
  for (let i = 0; i < nMicro; i++) {
    const sx    = (rng() - 0.5) * nw * 0.90;
    const sy    = -(rng() * nh * 0.92 + nh * 0.04);
    const sr    = rng() * 0.5 + 0.3;
    const alpha = rng() * 0.7 + 0.15;
    ctx.fillStyle = `${specTint}${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * CAT-EYE — v3.4 NEW.
 * Anisotropic magnetic shimmer streak that shifts with nail/camera orientation.
 *
 * catEyeDir [-1, 1]: horizontal position of the shimmer streak.
 *   -1 = left edge, 0 = centre, 1 = right edge.
 *   Animate this value on pointer move or device gyroscope for the live effect.
 *
 * Rendering layers:
 *   1. Base shimmer haze — soft directional gradient across full nail
 *   2. Core streak — bright narrow band at catEyeDir position
 *   3. Specular pinpoint — bright dot at streak × upper nail intersection
 */
function applyCatEye(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  nw: number,
  nh: number,
  opacity: number,
  catEyeDir: number,      // [-1, 1]
  lighting?: LightingEstimate,
): void {
  ctx.save();
  ctx.clip(path);

  // Composite catEyeDir with lighting direction for physically consistent shift
  const lightInfluence = lighting ? lighting.primaryDir.x * 0.25 : 0;
  const dir  = Math.max(-1, Math.min(1, catEyeDir + lightInfluence));
  const xPos = dir * nw * 0.42;           // streak centre X in local space

  // 1. Base shimmer haze — wide diffuse glow across nail
  const haze = ctx.createLinearGradient(-nw * 0.55, -nh * 0.30, nw * 0.55, -nh * 0.70);
  haze.addColorStop(0,    "rgba(160,200,255,0)");
  haze.addColorStop(0.35, "rgba(180,215,255,0.18)");
  haze.addColorStop(0.50, "rgba(200,230,255,0.10)");
  haze.addColorStop(0.65, "rgba(180,215,255,0.18)");
  haze.addColorStop(1,    "rgba(160,200,255,0)");
  ctx.fillStyle = haze;
  ctx.globalAlpha = opacity * 0.60;
  ctx.fill(path);

  // 2. Narrow magnetic streak — vertical band at xPos
  const streakW = nw * 0.10;
  const streak = ctx.createLinearGradient(xPos - streakW, 0, xPos + streakW, 0);
  streak.addColorStop(0,    "rgba(220,240,255,0)");
  streak.addColorStop(0.35, "rgba(220,240,255,0.45)");
  streak.addColorStop(0.50, "rgba(240,255,255,0.72)");   // bright core
  streak.addColorStop(0.65, "rgba(220,240,255,0.45)");
  streak.addColorStop(1,    "rgba(220,240,255,0)");
  ctx.fillStyle = streak;
  ctx.globalAlpha = opacity * 0.85;
  ctx.fill(path);

  // 3. Specular pinpoint at upper intersection of streak × nail centre
  const specY = -nh * (0.68 + Math.abs(dir) * 0.08);  // shifts up slightly at extremes
  const spec  = ctx.createRadialGradient(xPos, specY, 0, xPos, specY, nw * 0.10);
  spec.addColorStop(0, "rgba(255,255,255,0.85)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.globalAlpha = opacity;
  ctx.fill(path);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Main draw function ───────────────────────────────────────────────────────

/**
 * Draws a single nail at the correct position / rotation / scale derived from
 * the tip, DIP, and (optionally) PIP landmark positions.
 *
 * @param lighting - Optional lighting estimate from uploaded photo analysis.
 *                   When provided, highlight position and specular tint adapt
 *                   to the scene's estimated light direction and colour temp.
 */
export function drawNail(
  ctx: CanvasRenderingContext2D,
  tip: LandmarkPoint,
  dip: LandmarkPoint,
  cw: number,
  ch: number,
  style: NailStyle,
  fingerIndex: number = 1,
  pip?: LandmarkPoint,
  dorsalAlpha = 1.0,
  lighting?: LightingEstimate,
): void {
  if (dorsalAlpha <= 0.02) return;

  const tipPx = { x: tip.x * cw, y: tip.y * ch };
  const dipPx = { x: dip.x * cw, y: dip.y * ch };
  const pipPx = pip ? { x: pip.x * cw, y: pip.y * ch } : undefined;

  const dx = tipPx.x - dipPx.x;
  const dy = tipPx.y - dipPx.y;
  const segmentLen = Math.hypot(dx, dy);

  if (segmentLen < 4) return;

  const fi              = Math.max(0, Math.min(4, fingerIndex));
  const fingerWidthMult = FINGER_W_MULT[fi];
  const cuticleT        = FINGER_CUTICLE_T[fi];
  const finish          = style.finish ?? "Gloss";

  const NW_SCALE    = 0.52;  // v3.3 calibration — 60.2% avg width coverage
  const nw          = segmentLen * NW_SCALE * fingerWidthMult;
  const anchorToTip = (1 - cuticleT) * segmentLen;
  const nh          = anchorToTip * (1 + tipExtension(style.shape));
  const angle       = computeNailAngle(tipPx, dipPx, pipPx);

  const anchorPx = {
    x: dipPx.x + dx * cuticleT,
    y: dipPx.y + dy * cuticleT,
  };

  // Lighting-adaptive opacity: bright scenes → slightly lower opacity for realism
  const brightnessScale = lighting
    ? 1 - lighting.ambientBrightness * 0.08   // max 8% reduction in very bright scenes
    : 1.0;

  const opacityScale =
    finish === "Matte"  ? 1.04 :
    finish === "Jelly"  ? 0.45 :   // jelly is intentionally semi-transparent
    1.0;

  const baseOpacity = (style.opacity ?? 0.92)
    * Math.min(1, dorsalAlpha)
    * opacityScale
    * brightnessScale;

  ctx.save();
  ctx.translate(anchorPx.x, anchorPx.y);
  ctx.rotate(angle);

  const path = buildPath(style.shape, nw, nh);

  // ── Base fill — v4.0: diagonal upper-left bias for beauty-lighting ──────
  const baseTop    = finish === "Chrome" ? desaturate(style.topColor,    0.65) : style.topColor;
  const baseMid    = finish === "Chrome" ? desaturate(style.midColor,    0.65) : style.midColor;
  const baseBottom = finish === "Chrome" ? desaturate(style.bottomColor, 0.65) : style.bottomColor;

  // Jelly uses a lower-opacity base to allow skin show-through
  const baseAlpha  = finish === "Jelly" ? baseOpacity * 0.50 : baseOpacity;

  // Diagonal gradient: upper-left (tip + highlight side) → lower-right (cuticle + shadow)
  const lightBiasX = lighting ? lighting.primaryDir.x * nw * 0.22 : -nw * 0.18;
  const grad = ctx.createLinearGradient(lightBiasX, -nh, -lightBiasX, nh * 0.10);
  grad.addColorStop(0,    baseTop);
  grad.addColorStop(0.45, baseMid);
  grad.addColorStop(1,    baseBottom);
  ctx.fillStyle = grad;
  ctx.globalAlpha = baseAlpha;
  ctx.fill(path);
  ctx.globalAlpha = 1;

  // ── Finish-specific compositing pass ────────────────────────────────────
  switch (finish) {
    case "Matte":
      applyMatte(ctx, path, nw, nh, baseOpacity);
      break;
    case "Metallic":
      applyMetallic(ctx, path, nw, nh, baseOpacity, lighting);
      break;
    case "Chrome":
      applyChrome(ctx, path, nw, nh, baseOpacity);
      break;
    case "Jelly":
      applyJelly(
        ctx, path, nw, nh, baseOpacity,
        style.skinToneHex ?? "#c89870",
        lighting,
      );
      break;
    case "Glitter":
      applyGlitter(
        ctx, path, nw, nh, baseOpacity,
        style.glitterDensity ?? 0.06,
        lighting,
      );
      // Gloss base under glitter for depth
      applyGloss(ctx, path, nw, nh, baseOpacity * 0.40, lighting);
      break;
    case "CatEye":
      applyCatEye(
        ctx, path, nw, nh, baseOpacity,
        style.catEyeDir ?? 0.3,
        lighting,
      );
      // Subtle gloss on top for realism
      applyGloss(ctx, path, nw, nh, baseOpacity * 0.25, lighting);
      break;
    default:
      applyGloss(ctx, path, nw, nh, baseOpacity, lighting);
      break;
  }

  // ── v4.0: Transverse curvature shadow (all finishes) ─────────────────────
  applyTransverseCurvature(ctx, path, nw, nh, finish);

  // ── v4.0: Center brightness — convex surface highlight (specular finishes) ─
  applyCenterBrightness(ctx, path, nw, nh, finish, lighting);

  // ── v4.0: Tip free-edge highlight (specular finishes) ────────────────────
  applyTipHighlight(ctx, path, nw, nh, finish, lighting);

  // ── Cuticle naturalness fade (all finishes) ──────────────────────────────
  ctx.save();
  ctx.clip(path);
  const cuticleFade = ctx.createLinearGradient(0, -nh * 0.12, 0, nh * 0.10);
  cuticleFade.addColorStop(0,    "rgba(0,0,0,0)");
  cuticleFade.addColorStop(0.50, "rgba(0,0,0,0.18)");
  cuticleFade.addColorStop(1,    "rgba(0,0,0,0.45)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = cuticleFade;
  ctx.fill(path);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  // ── Edge stroke ──────────────────────────────────────────────────────────
  ctx.strokeStyle =
    finish === "Chrome" ? "rgba(255,255,255,0.15)" :
    finish === "Jelly"  ? "rgba(255,255,255,0.20)" :
    "rgba(0,0,0,0.12)";
  ctx.lineWidth =
    finish === "Chrome" ? 0.8 :
    finish === "Jelly"  ? 0.6 :
    0.6;
  ctx.stroke(path);

  ctx.restore();
}

// ─── Colour utility ───────────────────────────────────────────────────────────

function desaturate(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  const nr = Math.round(r + (grey - r) * amount);
  const ng = Math.round(g + (grey - g) * amount);
  const nb = Math.round(b + (grey - b) * amount);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

// ─── Dorsal hand detection ────────────────────────────────────────────────────

export function dorsalConfidence(
  landmarks: LandmarkPoint[],
  _handedness: string,
): number {
  const wrist     = landmarks[0];
  const indexMcp  = landmarks[5];
  const middleMcp = landmarks[9];
  const ringMcp   = landmarks[13];
  const pinkyMcp  = landmarks[17];

  const knuckleMeanZ = (indexMcp.z + middleMcp.z + ringMcp.z + pinkyMcp.z) / 4;
  const delta = wrist.z - knuckleMeanZ;

  const LOW  = 0.002;
  const HIGH = 0.010;
  if (delta <= LOW)  return 0;
  if (delta >= HIGH) return 1;
  return (delta - LOW) / (HIGH - LOW);
}

export function isDorsalHand(
  landmarks: LandmarkPoint[],
  handedness: string,
): boolean {
  return dorsalConfidence(landmarks, handedness) > 0.5;
}
