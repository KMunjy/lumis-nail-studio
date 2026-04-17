import type { NailFinish } from "@/types";

export interface Challenge {
  slug:       string;        // URL-safe identifier
  weekLabel:  string;        // Display: "Week of Apr 14"
  prompt:     string;        // The creative brief
  productId:  string;        // Pre-loaded in studio
  shadeHex:   string;        // topColor for accent (banner dot, etc.)
  finish:     NailFinish;
  expiresAt:  string;        // ISO — challenge is "active" until this passes
}

export const challenges: Challenge[] = [
  {
    slug: "glazed-spring",
    weekLabel: "Week of Apr 14",
    prompt: "Channel the glazed donut aesthetic — sheer, luminous, and effortless.",
    productId: "lume-07",
    shadeHex: "#FADADD",
    finish: "Jelly",
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    slug: "midnight-cat",
    weekLabel: "Week of Apr 21",
    prompt: "Go full drama with a magnetic cat-eye in the darkest shade possible.",
    productId: "lume-11",
    shadeHex: "#0A0A14",
    finish: "CatEye",
    expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    slug: "gold-rush",
    weekLabel: "Week of Apr 28",
    prompt: "Make a statement — metallic gold nails, full coverage, no apologies.",
    productId: "lume-02",
    shadeHex: "#F5D060",
    finish: "Metallic",
    expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    slug: "galaxy-mode",
    weekLabel: "Week of May 5",
    prompt: "Enter the galaxy — deep violet holographic glitter for festival season.",
    productId: "lume-09",
    shadeHex: "#2A1A4A",
    finish: "Glitter",
    expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    slug: "barely-there",
    weekLabel: "Week of May 12",
    prompt: "Go minimal — your-nail-but-better with the most wearable jelly shade.",
    productId: "lume-13",
    shadeHex: "#E8D0B8",
    finish: "Jelly",
    expiresAt: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

/**
 * Returns the currently active challenge (soonest expiry that is still in the future).
 * Returns undefined if all challenges have expired.
 */
export function getActiveChallenge(): Challenge | undefined {
  const now = Date.now();
  return challenges
    .filter((c) => new Date(c.expiresAt).getTime() > now)
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0];
}
