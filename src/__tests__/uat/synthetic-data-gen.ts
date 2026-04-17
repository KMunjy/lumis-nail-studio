/**
 * synthetic-data-gen.ts
 * Lazy generator functions for synthetic UAT data. No actual pixel data is ever created.
 * Uses LCG seeded PRNG for deterministic, reproducible outputs.
 * Seed: 42.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyntheticImage {
  id: string;
  fitzpatrick: 1 | 2 | 3 | 4 | 5 | 6;
  nailShape: "square" | "oval" | "almond" | "round" | "coffin";
  length: "short" | "medium" | "long";
  lighting: "bright" | "natural" | "low" | "extreme";
  orientation: "palm_down" | "palm_up" | "side" | "partial";
  artifacts: Array<"motion_blur" | "noise" | "jewelry" | "painted">;
  resolution: { width: number; height: number };
  groundTruth: { hasHand: boolean; nailCount: number };
}

export interface SyntheticSession {
  id: string;
  userId: string;
  journeyType: "first_time" | "returning" | "power_user" | "error_recovery";
  deviceType: "ios" | "android" | "desktop";
  network: "5g" | "4g" | "3g" | "offline";
  startTs: number;
  steps: string[];
}

export interface SyntheticProduct {
  id: string;
  brand: string;
  colorHex: string;
  finish: "cream" | "glitter" | "matte" | "shimmer" | "gel";
  opacity: number;
}

export interface SyntheticRequest {
  id: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  payloadSizeKb: number;
  clientType: "mobile" | "desktop" | "api";
  authPresent: boolean;
  timestamp: number;
}

// ─── LCG PRNG ────────────────────────────────────────────────────────────────

export type RNG = { next: () => number; nextInt: (n: number) => number };

export function makeRNG(seed = 42): RNG {
  let s = seed >>> 0;
  const next = (): number => {
    s = ((s * 1664525 + 1013904223) & 0xffffffff) >>> 0;
    return s / 0xffffffff;
  };
  const nextInt = (n: number): number => Math.floor(next() * n);
  return { next, nextInt };
}

// ─── Constants / lookup tables ────────────────────────────────────────────────

const NAIL_SHAPES: SyntheticImage["nailShape"][] = [
  "square", "oval", "almond", "round", "coffin",
];
const LENGTHS: SyntheticImage["length"][] = ["short", "medium", "long"];
const ARTIFACT_POOL: SyntheticImage["artifacts"][number][] = [
  "motion_blur", "noise", "jewelry", "painted",
];
const ARTIFACT_PROBS = [0.15, 0.15, 0.10, 0.10];
const ENDPOINTS = [
  "/api/upload", "/api/tryon", "/api/save", "/api/share", "/api/products",
];
const BRANDS = ["OPI", "Essie", "Sally Hansen", "Zoya", "CND", "Gelish"];
const FINISHES: SyntheticProduct["finish"][] = [
  "cream", "glitter", "matte", "shimmer", "gel",
];

/** Sample from a discrete distribution given cumulative breakpoints. */
function sampleCumulative(rng: RNG, cumulative: number[]): number {
  const r = rng.next();
  for (let i = 0; i < cumulative.length; i++) {
    if (r < cumulative[i]) return i;
  }
  return cumulative.length - 1;
}

// Cumulative distributions
const LIGHTING_CUM = [0.30, 0.70, 0.90, 1.00]; // bright 30%, natural 40%, low 20%, extreme 10%
const LIGHTING_VALUES: SyntheticImage["lighting"][] = ["bright", "natural", "low", "extreme"];
const ORIENT_CUM = [0.40, 0.70, 0.90, 1.00]; // palm_down 40%, palm_up 30%, side 20%, partial 10%
const ORIENT_VALUES: SyntheticImage["orientation"][] = ["palm_down", "palm_up", "side", "partial"];

function hexFromRNG(rng: RNG): string {
  const r = rng.nextInt(256);
  const g = rng.nextInt(256);
  const b = rng.nextInt(256);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── generateHandImages ───────────────────────────────────────────────────────

export function* generateHandImages(
  n: number,
  chunkSize: number
): Generator<SyntheticImage[]> {
  const rng = makeRNG(42);
  let chunk: SyntheticImage[] = [];

  for (let i = 0; i < n; i++) {
    // Fitzpatrick: uniform across 1-6
    const fitz = ((i % 6) + 1) as SyntheticImage["fitzpatrick"];

    // Lighting
    const lightingIdx = sampleCumulative(rng, LIGHTING_CUM);
    const lighting = LIGHTING_VALUES[lightingIdx];

    // Orientation
    const orientIdx = sampleCumulative(rng, ORIENT_CUM);
    const orientation = ORIENT_VALUES[orientIdx];

    // Nail shape uniform
    const nailShape = NAIL_SHAPES[rng.nextInt(NAIL_SHAPES.length)];

    // Length uniform
    const length = LENGTHS[rng.nextInt(LENGTHS.length)];

    // Artifacts: each sampled independently
    const artifacts: SyntheticImage["artifacts"] = [];
    for (let a = 0; a < ARTIFACT_POOL.length; a++) {
      if (rng.next() < ARTIFACT_PROBS[a]) {
        artifacts.push(ARTIFACT_POOL[a]);
      }
    }

    // Resolution — realistic variety
    const resOptions = [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 3840, height: 2160 },
      { width: 640, height: 480 },
    ];
    const resolution = resOptions[rng.nextInt(resOptions.length)];

    const hasHand = fitz > 0; // always true in normal case
    const nailCount = 10;

    const image: SyntheticImage = {
      id: `img-${i.toString().padStart(6, "0")}`,
      fitzpatrick: fitz,
      nailShape,
      length,
      lighting,
      orientation,
      artifacts,
      resolution,
      groundTruth: { hasHand, nailCount },
    };

    chunk.push(image);

    if (chunk.length >= chunkSize) {
      yield chunk;
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    yield chunk;
    chunk = [];
  }
}

// ─── generateUserSessions ─────────────────────────────────────────────────────

export function* generateUserSessions(
  n: number,
  chunkSize: number
): Generator<SyntheticSession[]> {
  const rng = makeRNG(137);
  let chunk: SyntheticSession[] = [];

  const JOURNEY_TYPES: SyntheticSession["journeyType"][] = [
    "first_time", "returning", "power_user", "error_recovery",
  ];
  const DEVICES: SyntheticSession["deviceType"][] = ["ios", "android", "desktop"];
  const NETWORKS: SyntheticSession["network"][] = ["5g", "4g", "3g", "offline"];
  const STEPS_MAP: Record<SyntheticSession["journeyType"], string[]> = {
    first_time: ["open", "consent", "camera", "try-on", "save"],
    returning: ["login", "library", "try-on", "share"],
    power_user: ["login", "bulk-try-on", "creator", "export", "publish"],
    error_recovery: ["open", "network-drop", "permission-denial", "corrupted-file", "retry"],
  };

  for (let i = 0; i < n; i++) {
    const journeyType = JOURNEY_TYPES[rng.nextInt(JOURNEY_TYPES.length)];
    const deviceType = DEVICES[rng.nextInt(DEVICES.length)];
    const network = NETWORKS[rng.nextInt(NETWORKS.length)];
    const session: SyntheticSession = {
      id: `sess-${i.toString().padStart(7, "0")}`,
      userId: `user-${rng.nextInt(50000).toString().padStart(5, "0")}`,
      journeyType,
      deviceType,
      network,
      startTs: 1700000000000 + i * 3600000,
      steps: [...STEPS_MAP[journeyType]],
    };

    chunk.push(session);

    if (chunk.length >= chunkSize) {
      yield chunk;
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    yield chunk;
    chunk = [];
  }
}

// ─── generateProducts ─────────────────────────────────────────────────────────

export function* generateProducts(
  n: number,
  chunkSize: number
): Generator<SyntheticProduct[]> {
  const rng = makeRNG(99);
  let chunk: SyntheticProduct[] = [];

  for (let i = 0; i < n; i++) {
    const product: SyntheticProduct = {
      id: `prod-${i.toString().padStart(5, "0")}`,
      brand: BRANDS[rng.nextInt(BRANDS.length)],
      colorHex: hexFromRNG(rng),
      finish: FINISHES[rng.nextInt(FINISHES.length)],
      opacity: 0.7 + rng.next() * 0.3,
    };

    chunk.push(product);

    if (chunk.length >= chunkSize) {
      yield chunk;
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    yield chunk;
    chunk = [];
  }
}

// ─── generateAPITraffic ───────────────────────────────────────────────────────

export function* generateAPITraffic(
  n: number,
  chunkSize: number
): Generator<SyntheticRequest[]> {
  const rng = makeRNG(777);
  let chunk: SyntheticRequest[] = [];

  const METHODS: SyntheticRequest["method"][] = ["GET", "POST", "PUT", "DELETE"];
  const CLIENTS: SyntheticRequest["clientType"][] = ["mobile", "desktop", "api"];

  for (let i = 0; i < n; i++) {
    const req: SyntheticRequest = {
      id: `req-${i.toString().padStart(7, "0")}`,
      endpoint: ENDPOINTS[rng.nextInt(ENDPOINTS.length)],
      method: METHODS[rng.nextInt(METHODS.length)],
      payloadSizeKb: rng.next() * 10000, // 0–10 MB
      clientType: CLIENTS[rng.nextInt(CLIENTS.length)],
      authPresent: rng.next() > 0.05,
      timestamp: 1700000000000 + i * 1000,
    };

    chunk.push(req);

    if (chunk.length >= chunkSize) {
      yield chunk;
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    yield chunk;
    chunk = [];
  }
}
