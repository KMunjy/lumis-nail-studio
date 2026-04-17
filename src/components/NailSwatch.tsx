"use client";

/**
 * NailSwatch — SVG nail-shaped swatch component  v1.0
 *
 * Renders an anatomically correct nail silhouette (correct bezier geometry
 * matching nail-renderer.ts path builders) with finish-specific SVG gradient
 * fills that mirror the Canvas v3.4 renderer semantics.
 *
 * Finish treatments:
 *   Gloss    — vertical axis gradient + axis-aligned specular streak + tip dot
 *   Matte    — flat gradient, edge vignette, no specular
 *   Metallic — horizontal reflection band + vertical streak + tight specular
 *   Chrome   — multi-band environment simulation + diagonal stripe
 *   Jelly    — semi-transparent fill + skin-tone show-through + IOR rim glow
 *   Glitter  — base gradient + scattered sparkle circles (seeded)
 *   CatEye   — dark base + diagonal magnetic shimmer streak
 *
 * Sizes:
 *   xs  — 28 × 40 px  (family filter pill at small screens)
 *   sm  — 36 × 52 px  (family filter pill standard)
 *   md  — 44 × 64 px  (shade swatch standard)
 *   lg  — 72 × 104 px (product card thumbnail)
 *   xl  — 120 × 172 px (detail view)
 *
 * Coordinate system: mirrors nail-renderer.ts local space.
 *   nw = nail width, nh = nail height
 *   Y = 0 at cuticle (SVG bottom), Y = -nh at tip (SVG top)
 *   ViewBox: -hw -nh nw (nh + cuticleGap)
 */

import { useMemo, useId } from "react";
import type { NailShape, NailFinish } from "@/types";

// ─── Size map ────────────────────────────────────────────────────────────────

const SIZE_MAP = {
  xs:  { w: 28,  h: 40  },
  sm:  { w: 36,  h: 52  },
  md:  { w: 44,  h: 64  },
  lg:  { w: 72,  h: 104 },
  xl:  { w: 120, h: 172 },
} as const;

export type SwatchSize = keyof typeof SIZE_MAP;

// ─── Shape path builders (SVG path string, local coords) ─────────────────────
// Coordinate frame: hw = nw/2, origin at cuticle centre.
// Tip direction: negative Y. ViewBox will be set to show full nail.

function almondD(nw: number, nh: number): string {
  const hw = nw / 2;
  return [
    `M ${-hw * 0.80} 0`,
    `Q 0 ${nh * 0.08} ${hw * 0.80} 0`,
    `C ${hw * 0.88} ${-nh * 0.28} ${hw * 0.66} ${-nh * 0.66} ${hw * 0.16} ${-nh * 0.94}`,
    `Q 0 ${-nh} ${-hw * 0.16} ${-nh * 0.94}`,
    `C ${-hw * 0.66} ${-nh * 0.66} ${-hw * 0.88} ${-nh * 0.28} ${-hw * 0.80} 0`,
    "Z",
  ].join(" ");
}

function stilettoD(nw: number, nh: number): string {
  const hw = nw / 2;
  return [
    `M ${-hw * 0.80} 0`,
    `Q 0 ${nh * 0.08} ${hw * 0.80} 0`,
    `C ${hw * 0.86} ${-nh * 0.36} ${hw * 0.55} ${-nh * 0.70} 0 ${-nh}`,
    `C ${-hw * 0.55} ${-nh * 0.70} ${-hw * 0.86} ${-nh * 0.36} ${-hw * 0.80} 0`,
    "Z",
  ].join(" ");
}

function ovalD(nw: number, nh: number): string {
  const hw = nw / 2;
  return [
    `M ${-hw * 0.80} 0`,
    `Q 0 ${nh * 0.08} ${hw * 0.80} 0`,
    `C ${hw * 0.88} ${-nh * 0.28} ${hw * 0.80} ${-nh * 0.65} 0 ${-nh}`,
    `C ${-hw * 0.80} ${-nh * 0.65} ${-hw * 0.88} ${-nh * 0.28} ${-hw * 0.80} 0`,
    "Z",
  ].join(" ");
}

function coffinD(nw: number, nh: number): string {
  const hw  = nw / 2;
  const thw = hw * 0.34;
  return [
    `M ${-hw * 0.80} 0`,
    `Q 0 ${nh * 0.08} ${hw * 0.80} 0`,
    `C ${hw * 0.88} ${-nh * 0.26} ${hw * 0.55} ${-nh * 0.68} ${thw} ${-nh}`,
    `L ${-thw} ${-nh}`,
    `C ${-hw * 0.55} ${-nh * 0.68} ${-hw * 0.88} ${-nh * 0.26} ${-hw * 0.80} 0`,
    "Z",
  ].join(" ");
}

function squareD(nw: number, nh: number): string {
  const hw = nw / 2;
  return [
    `M ${-hw * 0.80} 0`,
    `Q 0 ${nh * 0.08} ${hw * 0.80} 0`,
    `L ${hw * 0.80} ${-nh}`,
    `L ${-hw * 0.80} ${-nh}`,
    "Z",
  ].join(" ");
}

function buildPathD(shape: NailShape, nw: number, nh: number): string {
  switch (shape) {
    case "Stiletto": return stilettoD(nw, nh);
    case "Oval":     return ovalD(nw, nh);
    case "Coffin":   return coffinD(nw, nh);
    case "Square":   return squareD(nw, nh);
    default:         return almondD(nw, nh);
  }
}

// ─── Seeded sparkle positions ─────────────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Sparkle { x: number; y: number; r: number; op: number; hue: number | null }

function buildSparkles(nw: number, nh: number, density: number, seed: number): Sparkle[] {
  const rng   = mulberry32(seed);
  const count = Math.round(density * nw * nh * 0.6);
  const hw    = nw / 2;
  const out: Sparkle[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 6) {
    attempts++;
    const x = (rng() - 0.5) * nw * 0.86;
    const y = -(rng() * nh * 0.90 + nh * 0.04);
    // Rough inside-nail test: discard corners outside almond bounding ellipse
    const nx = x / (hw * 0.82);
    const ny = (y + nh * 0.5) / (nh * 0.52);
    if (nx * nx + ny * ny > 1.0) continue;
    out.push({
      x,
      y,
      r:   0.8 + rng() * 1.8,
      op:  0.50 + rng() * 0.50,
      hue: rng() < 0.35 ? Math.round(rng() * 360) : null,
    });
  }
  return out;
}

// ─── Finish-specific defs builder ─────────────────────────────────────────────

interface FinishDefsProps {
  id:          string;
  finish:      NailFinish;
  shape:       NailShape;
  topColor:    string;
  midColor:    string;
  bottomColor: string;
  skinToneHex: string;
  nw:          number;
  nh:          number;
  glitterDensity: number;
  catEyeDir:   number;
}

function FinishDefs({
  id, finish, shape,
  topColor, midColor, bottomColor,
  skinToneHex,
  nw, nh,
  glitterDensity,
  catEyeDir,
}: FinishDefsProps) {
  const hw  = nw / 2;
  const vbT = -nh;   // SVG top of nail

  // Gradient userSpaceOnUse coordinates: y goes from 0 (cuticle) to -nh (tip)
  const gradY1 = 0;      // cuticle
  const gradY2 = vbT;    // tip

  return (
    <defs>
      {/* ── Base fill gradient ─────────────────────────────────────────────── */}
      {/* Diagonal top-left→bottom-right to approximate upper-left light source */}
      <linearGradient id={`${id}-base`}
        x1={-hw * 0.30} y1={gradY2}
        x2={hw  * 0.30} y2={gradY1}
        gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor={topColor}    />   {/* tip / highlight side */}
        <stop offset="45%"  stopColor={midColor}    />
        <stop offset="100%" stopColor={bottomColor} />   {/* cuticle / shadow side */}
      </linearGradient>

      {/* ── GLOSS ──────────────────────────────────────────────────────────── */}
      {finish === "Gloss" && <>
        {/*
          Left-offset specular streak — matches nail_architecture_shape reference.
          Peak at x ≈ -hw*0.18 (left of center, beauty lighting convention).
          Width ≈ hw*0.40. Peak opacity 0.58 (was 0.28 — doubled).
        */}
        <linearGradient id={`${id}-gloss-streak`}
          x1={-hw * 0.55} y1="0"
          x2={hw  * 0.10} y2="0"
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
          <stop offset="45%"  stopColor="rgba(255,255,255,0.58)" />
          <stop offset="75%"  stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>
        {/* Streak vertical fade — brightest from tip to 70% height */}
        <linearGradient id={`${id}-gloss-vfade`}
          x1="0" y1={-nh * 0.90}
          x2="0" y2={-nh * 0.15}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
          <stop offset="70%"  stopColor="rgba(255,255,255,0.20)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>
        {/* Hot specular dot — reference shows ~75% opacity peak near tip */}
        <radialGradient id={`${id}-gloss-dot`}
          cx={-hw * 0.18} cy={-nh * 0.76} r={hw * 0.16}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.88)" />
          <stop offset="40%"  stopColor="rgba(255,255,255,0.30)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>
        {/* Rim light — right edge, ~20% opacity (opposite to main light) */}
        <linearGradient id={`${id}-gloss-rim`}
          x1={hw * 0.60} y1="0"
          x2={hw * 0.20} y2="0"
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>
      </>}

      {/* ── MATTE ──────────────────────────────────────────────────────────── */}
      {finish === "Matte" && <>
        {/* Edge vignette — strong rim darkening, no specular */}
        <radialGradient id={`${id}-matte`}
          cx="0" cy={-nh * 0.50} r={hw * 0.68}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(0,0,0,0)"    />
          <stop offset="75%"  stopColor="rgba(0,0,0,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
        </radialGradient>
        {/* Micro flat sheen — matte still has very slight surface variation */}
        <linearGradient id={`${id}-matte-sheen`}
          x1={-hw * 0.50} y1={-nh * 0.80}
          x2={hw * 0.30}  y2={-nh * 0.30}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>
      </>}

      {/* ── METALLIC ───────────────────────────────────────────────────────── */}
      {finish === "Metallic" && <>
        {/* Horizontal reflection band — strong, centered, wide */}
        <linearGradient id={`${id}-metal-h`}
          x1={-hw * 0.60} y1="0"
          x2={hw  * 0.60} y2="0"
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
          <stop offset="20%"  stopColor="rgba(255,255,255,0.15)" />
          <stop offset="48%"  stopColor="rgba(255,255,255,0.62)" />
          <stop offset="72%"  stopColor="rgba(255,255,255,0.15)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>
        {/* Vertical tip streak — metallic surfaces have a strong tip catch */}
        <linearGradient id={`${id}-metal-v`}
          x1="0" y1={gradY2}
          x2="0" y2={gradY1}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.35)" />
          <stop offset="35%"  stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>
        {/* Tight high-brightness specular dot */}
        <radialGradient id={`${id}-metal-dot`}
          cx={-hw * 0.10} cy={-nh * 0.78} r={hw * 0.15}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.90)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>
        {/* Dark shadow band — metallic shows stark shadow contrast */}
        <linearGradient id={`${id}-metal-shadow`}
          x1="0" y1={gradY1}
          x2="0" y2={-nh * 0.30}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.30)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)"    />
        </linearGradient>
      </>}

      {/* ── CHROME ─────────────────────────────────────────────────────────── */}
      {finish === "Chrome" && <>
        {/*
          Multi-band vertical environment map.
          Reference UGC gold/chrome nails: very high contrast bands.
          White at tip → near-black band → white band → dark base.
        */}
        <linearGradient id={`${id}-chrome`}
          x1="0" y1={gradY2}
          x2="0" y2={gradY1}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.95)" />  {/* tip: near white */}
          <stop offset="18%"  stopColor="rgba(180,200,215,0.30)" />
          <stop offset="32%"  stopColor="rgba(0,0,0,0.50)"       />  {/* dark band */}
          <stop offset="52%"  stopColor="rgba(255,255,255,0.75)" />  {/* mirror band */}
          <stop offset="68%"  stopColor="rgba(140,160,180,0.25)" />
          <stop offset="85%"  stopColor="rgba(0,0,0,0.30)"       />
          <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
        </linearGradient>
        {/* Diagonal highlight stripe — bold (reference shows 80%+ opacity) */}
        <linearGradient id={`${id}-chrome-stripe`}
          x1={-hw * 0.70} y1={-nh * 0.42}
          x2={hw  * 0.55} y2={-nh * 0.28}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
          <stop offset="38%"  stopColor="rgba(255,255,255,0.82)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.88)" />
          <stop offset="62%"  stopColor="rgba(255,255,255,0.82)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </linearGradient>
      </>}

      {/* ── JELLY ──────────────────────────────────────────────────────────── */}
      {finish === "Jelly" && <>
        <linearGradient id={`${id}-jelly-depth`}
          x1="0" y1={gradY1}
          x2="0" y2={gradY2}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.14)"       />
          <stop offset="55%"  stopColor="rgba(0,0,0,0.04)"       />
          <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
        </linearGradient>
        {/* Refraction oval — left-offset matching Gloss convention */}
        <radialGradient id={`${id}-jelly-refract`}
          cx={-hw * 0.12} cy={-nh * 0.54} r={hw * 0.30}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.35)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>
        {/* IOR rim glow */}
        <radialGradient id={`${id}-jelly-rim`}
          cx="0" cy={-nh * 0.50} r={hw * 0.65}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
          <stop offset="78%"  stopColor="rgba(255,255,255,0)"    />
          <stop offset="100%" stopColor="rgba(255,255,255,0.22)" />
        </radialGradient>
      </>}

      {/* ── CATEYE ─────────────────────────────────────────────────────────── */}
      {finish === "CatEye" && <>
        {/* Narrow magnetic shimmer streak — bright centre, hard falloff */}
        <linearGradient id={`${id}-cateye`}
          x1={catEyeDir >= 0 ? -hw * 0.80 : hw * 0.80} y1={-nh * 0.28}
          x2={catEyeDir >= 0 ? hw  * 0.80 : -hw * 0.80} y2={-nh * 0.72}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(200,220,255,0)"    />
          <stop offset="35%"  stopColor="rgba(200,220,255,0)"    />
          <stop offset="48%"  stopColor="rgba(220,235,255,0.80)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.92)" />
          <stop offset="52%"  stopColor="rgba(220,235,255,0.80)" />
          <stop offset="65%"  stopColor="rgba(200,220,255,0)"    />
          <stop offset="100%" stopColor="rgba(200,220,255,0)"    />
        </linearGradient>
        {/* Dark depth at cuticle */}
        <linearGradient id={`${id}-cateye-depth`}
          x1="0" y1={gradY1}
          x2="0" y2={-nh * 0.40}
          gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.40)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)"    />
        </linearGradient>
      </>}

      {/* ── Cuticle shadow — all finishes ──────────────────────────────────── */}
      <radialGradient id={`${id}-shadow`}
        cx="0" cy="0" r={hw * 0.95}
        gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="rgba(0,0,0,0)"    />
        <stop offset="100%" stopColor="rgba(0,0,0,0.36)" />
      </radialGradient>

      {/* ── Clip path — uses actual nail shape so overlays match silhouette ── */}
      <clipPath id={`${id}-clip`}>
        <path d={buildPathD(shape, nw, nh)} />
      </clipPath>
    </defs>
  );
}

// ─── Finish overlay layers ────────────────────────────────────────────────────

interface OverlayProps {
  id:             string;
  finish:         NailFinish;
  pathD:          string;
  nw:             number;
  nh:             number;
  glitterDensity: number;
  catEyeDir:      number;
  skinToneHex:    string;
}

function FinishOverlays({
  id, finish, pathD, nw, nh, glitterDensity, catEyeDir,
}: OverlayProps) {
  const hw = nw / 2;

  // Sparkle positions for Glitter — seeded by nw+nh for stability
  const sparkles = useMemo(
    () => finish === "Glitter"
      ? buildSparkles(nw, nh, glitterDensity, Math.round(nw * 100 + nh))
      : [],
    [finish, nw, nh, glitterDensity],
  );

  return (
    <g clipPath={`url(#${id}-clip)`}>
      {/* ── Cuticle base shadow (all) ───────────────────────────────────── */}
      <path d={pathD} fill={`url(#${id}-shadow)`} />

      {finish === "Gloss" && <>
        <path d={pathD} fill={`url(#${id}-gloss-streak)`} opacity={0.90} />
        <path d={pathD} fill={`url(#${id}-gloss-vfade)`}  opacity={0.80} />
        <path d={pathD} fill={`url(#${id}-gloss-dot)`}    opacity={0.85} />
        <path d={pathD} fill={`url(#${id}-gloss-rim)`}    opacity={0.70} />
      </>}

      {finish === "Matte" && <>
        <path d={pathD} fill={`url(#${id}-matte)`}       opacity={1} />
        <path d={pathD} fill={`url(#${id}-matte-sheen)`} opacity={1} />
      </>}

      {finish === "Metallic" && <>
        <path d={pathD} fill={`url(#${id}-metal-shadow)`} opacity={0.80} />
        <path d={pathD} fill={`url(#${id}-metal-h)`}      opacity={0.90} />
        <path d={pathD} fill={`url(#${id}-metal-v)`}      opacity={0.75} />
        <path d={pathD} fill={`url(#${id}-metal-dot)`}    opacity={0.85} />
      </>}

      {finish === "Chrome" && <>
        <path d={pathD} fill={`url(#${id}-chrome)`}        opacity={0.90} />
        <path d={pathD} fill={`url(#${id}-chrome-stripe)`} opacity={0.55} />
      </>}

      {finish === "Jelly" && <>
        {/* Skin-tone show-through behind polish */}
        <path d={pathD} fill={`url(#${id}-jelly-depth)`}   opacity={0.80} />
        <path d={pathD} fill={`url(#${id}-jelly-refract)`} opacity={1}    />
        <path d={pathD} fill={`url(#${id}-jelly-rim)`}     opacity={0.70} />
      </>}

      {finish === "Glitter" && (
        <g>
          {sparkles.map((sp, i) => (
            <circle
              key={i}
              cx={sp.x}
              cy={sp.y}
              r={sp.r}
              fill={sp.hue !== null
                ? `hsla(${sp.hue},90%,75%,${sp.op})`
                : `rgba(255,255,255,${sp.op})`}
            />
          ))}
          {/* Soft overlay for cohesion */}
          <path d={pathD} fill="rgba(255,255,255,0.06)" />
        </g>
      )}

      {finish === "CatEye" && <>
        <path d={pathD} fill={`url(#${id}-cateye)`}       opacity={1}    />
        <path d={pathD} fill={`url(#${id}-cateye-depth)`} opacity={0.60} />
      </>}
    </g>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface NailSwatchProps {
  /** Nail shape — controls silhouette path */
  shape:        NailShape;
  /** Finish — controls overlay treatment */
  finish:       NailFinish;
  /** Base gradient: cuticle-side (darker) */
  bottomColor:  string;
  /** Base gradient: mid */
  midColor:     string;
  /** Base gradient: tip-side (lighter / highlight color) */
  topColor:     string;
  /** Jelly finish: skin-tone hex for show-through */
  skinToneHex?: string;
  /** Glitter density [0.02–0.12]. Default 0.06 */
  glitterDensity?: number;
  /** CatEye shimmer direction [-1, 1]. Default 0.3 (right) */
  catEyeDir?: number;
  /** Display size preset */
  size?:        SwatchSize;
  /** Optional className for layout */
  className?:   string;
  /** Accessible label */
  "aria-label"?: string;
}

// _idCounter removed — replaced by React useId() for SSR-stable IDs

export function NailSwatch({
  shape,
  finish,
  bottomColor,
  midColor,
  topColor,
  skinToneHex    = "#d4a882",
  glitterDensity = 0.06,
  catEyeDir      = 0.3,
  size           = "md",
  className,
  "aria-label": ariaLabel,
}: NailSwatchProps) {
  // Stable per-instance SVG id prefix — useId() is SSR-consistent, avoids hydration mismatch
  const reactId = useId();
  const id = `ns-${reactId.replace(/:/g, "")}`;

  const { w, h } = SIZE_MAP[size];

  // Internal rendering dimensions — maintain 11:16 nail aspect
  const nw = 44;
  const nh = 64;
  const hw = nw / 2;

  // SVG viewBox: x from -hw to +hw, y from -nh-2 (tip + margin) to +4 (cuticle + margin)
  const vbX = -(hw + 2);
  const vbY = -(nh + 2);
  const vbW = nw + 4;
  const vbH = nh + 6;

  const pathD = buildPathD(shape, nw, nh);

  // Jelly base opacity — translucent polish on top of skin-tone
  const baseOpacity = finish === "Jelly" ? 0.55 : 1;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w}
      height={h}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      aria-label={ariaLabel ?? `${shape} ${finish} nail swatch`}
      role="img"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <FinishDefs
        id={id}
        finish={finish}
        shape={shape}
        topColor={topColor}
        midColor={midColor}
        bottomColor={bottomColor}
        skinToneHex={skinToneHex}
        nw={nw}
        nh={nh}
        glitterDensity={glitterDensity}
        catEyeDir={catEyeDir}
      />

      {/* ── Jelly: skin-tone show-through layer (behind polish) ─────────── */}
      {finish === "Jelly" && (
        <path d={pathD} fill={skinToneHex} opacity={0.14} />
      )}

      {/* ── Base fill ───────────────────────────────────────────────────── */}
      <path
        d={pathD}
        fill={`url(#${id}-base)`}
        opacity={baseOpacity}
      />

      {/* ── Finish-specific overlay layers ──────────────────────────────── */}
      <FinishOverlays
        id={id}
        finish={finish}
        pathD={pathD}
        nw={nw}
        nh={nh}
        glitterDensity={glitterDensity}
        catEyeDir={catEyeDir}
        skinToneHex={skinToneHex}
      />

      {/* ── Cuticle arc line — anatomical detail ────────────────────────── */}
      <path
        d={`M ${-hw * 0.80} 0 Q 0 ${nh * 0.08} ${hw * 0.80} 0`}
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth={0.8}
      />
    </svg>
  );
}

// ─── Canonical shape per finish (for family filter pills) ─────────────────────

export const FINISH_PREVIEW_SHAPE: Record<NailFinish, NailShape> = {
  Gloss:    "Oval",
  Matte:    "Almond",
  Metallic: "Stiletto",
  Chrome:   "Stiletto",
  Jelly:    "Oval",
  Glitter:  "Coffin",
  CatEye:   "Stiletto",
};
