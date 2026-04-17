"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { NailFinish } from "@/types";

const VALID_FINISHES: NailFinish[] = [
  "Gloss", "Matte", "Metallic", "Chrome", "Jelly", "Glitter", "CatEye",
];

export interface CreatorParams {
  creatorName:   string | null;
  shadeHex:      string | null;  // e.g. "#FFD6E4" — already URL-decoded
  finish:        NailFinish | null;
  challengeSlug: string | null;
}

/**
 * Reads and validates URL search params used by Creator Collab and Challenge Mode.
 *
 * Params:
 *   creator   — creator handle (Feature 4)
 *   shade     — shade hex colour pre-load (Feature 4 + 5)
 *   finish    — NailFinish enum value (Feature 4 + 5)
 *   challenge — challenge slug (Feature 5 banner)
 *
 * Must be used inside a <Suspense> boundary because useSearchParams() suspends.
 */
export function useCreatorParams(): CreatorParams {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const rawShade   = searchParams.get("shade");
    const rawFinish  = searchParams.get("finish") as NailFinish | null;
    const rawCreator = searchParams.get("creator");
    const rawChallenge = searchParams.get("challenge");

    // Validate hex: must be #RRGGBB or #RGB
    const shadeHex = rawShade && /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(rawShade)
      ? rawShade
      : null;

    // Validate finish enum
    const finish: NailFinish | null = rawFinish && VALID_FINISHES.includes(rawFinish)
      ? rawFinish
      : null;

    return {
      creatorName:   rawCreator   ? decodeURIComponent(rawCreator)   : null,
      shadeHex,
      finish,
      challengeSlug: rawChallenge ? decodeURIComponent(rawChallenge) : null,
    };
  }, [searchParams]);
}
