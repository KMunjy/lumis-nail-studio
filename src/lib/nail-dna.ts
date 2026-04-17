/**
 * LUMIS — Nail DNA Engine
 *
 * Reads the user's saved looks history and computes a personality archetype:
 *   dominant finish, dominant shape, color temperature, boldness score,
 *   and one of 8 named archetypes.
 *
 * All computation is purely client-side with no network calls.
 */

import type { NailFinish, NailShape } from "@/types";
import type { SavedLook } from "@/lib/saved-looks";

// ─── Archetype definitions ─────────────────────────────────────────────────────

export interface NailArchetype {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  bgColor: string;
  emoji: string;
}

export const ARCHETYPES: NailArchetype[] = [
  {
    id: "chrome-maven",
    name: "The Chrome Maven",
    tagline: "Mirror-finish obsessed",
    description:
      "You live for the liquid metal moment. Chrome nails are your power move — reflective, futuristic, unapologetic. Your manicure is your armour.",
    accentColor: "#8B9CC8",
    bgColor: "#E8ECF8",
    emoji: "✨",
  },
  {
    id: "glazed-minimalist",
    name: "The Glazed Minimalist",
    tagline: "Glass skin, glass nails",
    description:
      "Sheer, glossy, effortlessly put-together. Your nails whisper luxury rather than shouting it. Less is always more.",
    accentColor: "#F43F78",
    bgColor: "#FFF0F5",
    emoji: "🌸",
  },
  {
    id: "matte-rebel",
    name: "The Matte Rebel",
    tagline: "Flat finish, sharp edge",
    description:
      "You reject sparkle and embrace texture. Matte nails are your signature — bold, deliberate, and impossible to ignore.",
    accentColor: "#3D1F4A",
    bgColor: "#F0EBF4",
    emoji: "🖤",
  },
  {
    id: "glitter-dreamer",
    name: "The Glitter Dreamer",
    tagline: "Sparkle is a personality",
    description:
      "Why have one shade when you can have a thousand points of light? You dress your nails like a festival — joyful, expressive, unapologetically extra.",
    accentColor: "#D4A017",
    bgColor: "#FFF9E6",
    emoji: "💫",
  },
  {
    id: "golden-hour",
    name: "The Golden Hour",
    tagline: "Warm metallic energy",
    description:
      "Bronze, gold, copper — your palette is permanently sunset-lit. Warmth is your signature and your power.",
    accentColor: "#C87941",
    bgColor: "#FDF3E8",
    emoji: "🌅",
  },
  {
    id: "cat-eye-mystic",
    name: "The Cat Eye Mystic",
    tagline: "Magnetic, shifting allure",
    description:
      "The shifting shimmer streak fascinates you. Your nails hold secrets — they change with the light, just like you.",
    accentColor: "#7C3AED",
    bgColor: "#F5F0FF",
    emoji: "🔮",
  },
  {
    id: "nude-naturalist",
    name: "The Nude Naturalist",
    tagline: "Skin-tone elegance",
    description:
      "Your nails are an extension of you — polished, confident, never trying too hard. Effortless is your brand.",
    accentColor: "#A07850",
    bgColor: "#F8F2EC",
    emoji: "🤍",
  },
  {
    id: "dark-romantic",
    name: "The Dark Romantic",
    tagline: "Velvet after midnight",
    description:
      "Deep plums, midnight blues, obsidian blacks. Your nails are moody, poetic, and impossible to ignore. Drama is your love language.",
    accentColor: "#4A1070",
    bgColor: "#F2ECF8",
    emoji: "🌙",
  },
];

// ─── DNA Profile ───────────────────────────────────────────────────────────────

export interface NailDNAProfile {
  dominantFinish: NailFinish;
  dominantShape: NailShape;
  colorTemp: "warm" | "cool" | "neutral";
  /** 0–1; higher = more saturated / darker palette */
  boldness: number;
  archetype: NailArchetype;
  totalLooks: number;
  finishBreakdown: Record<NailFinish, number>;
  shapeBreakdown: Record<NailShape, number>;
}

// ─── Colour helpers ────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [0, 0, 0.5];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;

  return [hue * 360, s, l];
}

function computeColorTemp(topColors: string[]): "warm" | "cool" | "neutral" {
  if (!topColors.length) return "neutral";
  let warmScore = 0;
  let count = 0;
  for (const c of topColors) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(c)) continue;
    const [h] = hexToHsl(c);
    // Warm: reds/oranges/yellows (0–60, 330–360)
    // Cool: blues/purples/greens (120–270)
    if (h <= 60 || h >= 330) warmScore++;
    else if (h >= 120 && h <= 270) warmScore--;
    count++;
  }
  if (count === 0) return "neutral";
  const ratio = warmScore / count;
  if (ratio > 0.25) return "warm";
  if (ratio < -0.25) return "cool";
  return "neutral";
}

function computeBoldness(topColors: string[]): number {
  if (!topColors.length) return 0.5;
  let total = 0;
  let count = 0;
  for (const c of topColors) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(c)) continue;
    const [, s, l] = hexToHsl(c);
    // Boldness = saturation + (1 - lightness), averaged
    total += (s + (1 - l)) / 2;
    count++;
  }
  return count > 0 ? total / count : 0.5;
}

// ─── Archetype assignment ──────────────────────────────────────────────────────

function assignArchetype(
  finish: NailFinish,
  temp: "warm" | "cool" | "neutral",
  boldness: number,
  _totalLooks: number,
): NailArchetype {
  const find = (id: string) => ARCHETYPES.find((a) => a.id === id)!;

  if (finish === "Chrome")  return find("chrome-maven");
  if (finish === "CatEye")  return find("cat-eye-mystic");
  if (finish === "Glitter") return find("glitter-dreamer");
  if (finish === "Matte" && boldness > 0.5) return find("matte-rebel");
  if (finish === "Metallic" && temp === "warm") return find("golden-hour");
  if ((finish === "Gloss" || finish === "Jelly") && boldness < 0.38) return find("glazed-minimalist");
  if (boldness > 0.68 && temp === "cool") return find("dark-romantic");
  if (boldness < 0.32) return find("nude-naturalist");
  // Warm default
  if (temp === "warm") return find("golden-hour");
  return find("glazed-minimalist");
}

// ─── Main export ───────────────────────────────────────────────────────────────

const EMPTY_FINISH: Record<NailFinish, number> = {
  Gloss: 0, Matte: 0, Metallic: 0, Chrome: 0, Jelly: 0, Glitter: 0, CatEye: 0,
};
const EMPTY_SHAPE: Record<NailShape, number> = {
  Almond: 0, Stiletto: 0, Oval: 0, Coffin: 0, Square: 0,
};

export function computeNailDNA(looks: SavedLook[]): NailDNAProfile {
  if (!looks.length) {
    return {
      dominantFinish: "Gloss",
      dominantShape: "Almond",
      colorTemp: "neutral",
      boldness: 0.5,
      archetype: ARCHETYPES.find((a) => a.id === "glazed-minimalist")!,
      totalLooks: 0,
      finishBreakdown: { ...EMPTY_FINISH },
      shapeBreakdown: { ...EMPTY_SHAPE },
    };
  }

  const finishBreakdown: Record<NailFinish, number> = { ...EMPTY_FINISH };
  const shapeBreakdown: Record<NailShape, number>   = { ...EMPTY_SHAPE };

  for (const look of looks) {
    if (look.finish in finishBreakdown) finishBreakdown[look.finish]++;
    if (look.shape  in shapeBreakdown)  shapeBreakdown[look.shape]++;
  }

  const dominantFinish = (
    Object.entries(finishBreakdown).sort(([, a], [, b]) => b - a)[0][0]
  ) as NailFinish;

  const dominantShape = (
    Object.entries(shapeBreakdown).sort(([, a], [, b]) => b - a)[0][0]
  ) as NailShape;

  const topColors = looks.map((l) => l.style?.topColor ?? "").filter(Boolean);
  const colorTemp = computeColorTemp(topColors);
  const boldness  = computeBoldness(topColors);
  const archetype = assignArchetype(dominantFinish, colorTemp, boldness, looks.length);

  return {
    dominantFinish,
    dominantShape,
    colorTemp,
    boldness,
    archetype,
    totalLooks: looks.length,
    finishBreakdown,
    shapeBreakdown,
  };
}
