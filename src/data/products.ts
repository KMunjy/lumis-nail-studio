import type { NailShape, NailFinish } from "@/types";

export type Product = {
  id: string;
  name: string;
  designer: string;
  price: number;
  color: string;
  topColor: string;
  midColor: string;
  bottomColor: string;
  shape: NailShape;
  length: "Short" | "Medium" | "Long";
  finish: NailFinish;
  description: string;
  /** Fitzpatrick-neutral skin tone hex for Jelly show-through rendering. */
  skinToneHex?: string;
  /** Glitter finish: sparkle density [0.02–0.12]. Default 0.06. */
  glitterDensity?: number;
  /** CatEye finish: shimmer direction [-1,1]. Default 0.3. */
  catEyeDir?: number;
};

export const products: Product[] = [
  // ── Existing hero shades (updated with finish field) ──────────────────────
  {
    id: "lume-01",
    name: "Velvet Dahlia",
    designer: "LUMIS Couture",
    price: 32,
    color: "Deep Plum",
    topColor: "#3D1F4A",
    midColor: "#5C2F6E",
    bottomColor: "#1A0F1E",
    shape: "Almond",
    length: "Medium",
    finish: "Matte",
    description: "Sophisticated deep plum with a matte velvet finish.",
  },
  {
    id: "lume-02",
    name: "Liquid Gold",
    designer: "LUMIS Couture",
    price: 45,
    color: "Gold Leaf",
    topColor: "#F5D060",
    midColor: "#E9C349",
    bottomColor: "#7A5E00",
    shape: "Stiletto",
    length: "Long",
    finish: "Metallic",
    description: "Metallic gold with micro-shimmer. Captures light with every movement.",
  },
  {
    id: "lume-03",
    name: "Classic French 2.0",
    designer: "LUMIS Digital",
    price: 28,
    color: "Nude / White",
    topColor: "#FFFFFF",
    midColor: "#F3DCD4",
    bottomColor: "#D0A896",
    shape: "Oval",
    length: "Short",
    finish: "Gloss",
    description: "The timeless French tip, digitally remastered.",
  },
  {
    id: "lume-04",
    name: "Onyx Chroma",
    designer: "LUMIS Studio",
    price: 36,
    color: "Black Iridescent",
    topColor: "#1A1A1A",
    midColor: "#0D0D0D",
    bottomColor: "#050505",
    shape: "Coffin",
    length: "Medium",
    finish: "Chrome",
    description: "Deepest obsidian with a hidden prismatic shift.",
  },
  {
    id: "lume-05",
    name: "Rosé Reverie",
    designer: "LUMIS Digital",
    price: 30,
    color: "Soft Rose",
    topColor: "#FFD6E4",
    midColor: "#F4A8C0",
    bottomColor: "#C06080",
    shape: "Square",
    length: "Short",
    finish: "Gloss",
    description: "Luminous soft rose with a glossy finish.",
  },
  {
    id: "lume-06",
    name: "Midnight Chrome",
    designer: "LUMIS Studio",
    price: 52,
    color: "Silver Chrome",
    topColor: "#E8E8E8",
    midColor: "#B8B8B8",
    bottomColor: "#707070",
    shape: "Stiletto",
    length: "Long",
    finish: "Chrome",
    description: "Mirror-finish chrome that fractures light into a thousand reflections.",
  },

  // ── v3.4 — New finish showcase shades ─────────────────────────────────────

  {
    id: "lume-07",
    name: "Glazed Petal",
    designer: "LUMIS Digital",
    price: 34,
    color: "Sheer Blush",
    topColor: "#FADADD",
    midColor: "#F5C0C5",
    bottomColor: "#E8A0A8",
    shape: "Oval",
    length: "Short",
    finish: "Jelly",
    skinToneHex: "#d4a882",
    description:
      "Ultra-sheer blush jelly — your nail plate glows through a soft pink veil.",
  },
  {
    id: "lume-08",
    name: "Ocean Glaze",
    designer: "LUMIS Digital",
    price: 34,
    color: "Aqua Jelly",
    topColor: "#A8D8EA",
    midColor: "#88C0D8",
    bottomColor: "#5898B8",
    shape: "Almond",
    length: "Medium",
    finish: "Jelly",
    skinToneHex: "#c89870",
    description:
      "Cool translucent aqua. Light passes through the polish like sea glass.",
  },
  {
    id: "lume-09",
    name: "Galaxy Dust",
    designer: "LUMIS Studio",
    price: 48,
    color: "Holographic Glitter",
    topColor: "#2A1A4A",
    midColor: "#3D2860",
    bottomColor: "#1A0E30",
    shape: "Coffin",
    length: "Long",
    finish: "Glitter",
    glitterDensity: 0.09,
    description:
      "Deep violet base with holographic glitter. Shifts from purple to gold to pink.",
  },
  {
    id: "lume-10",
    name: "Champagne Fizz",
    designer: "LUMIS Couture",
    price: 38,
    color: "Gold Glitter",
    topColor: "#C8A840",
    midColor: "#B89030",
    bottomColor: "#806010",
    shape: "Square",
    length: "Short",
    finish: "Glitter",
    glitterDensity: 0.06,
    description:
      "Warm champagne base saturated with fine gold glitter. Party-ready.",
  },
  {
    id: "lume-11",
    name: "Magnetic Noir",
    designer: "LUMIS Studio",
    price: 55,
    color: "Black Cat-Eye",
    topColor: "#0A0A14",
    midColor: "#141420",
    bottomColor: "#08080E",
    shape: "Stiletto",
    length: "Long",
    finish: "CatEye",
    catEyeDir: 0.3,
    description:
      "Black cat-eye with a silver magnetic streak. Move your hand and watch it shift.",
  },
  {
    id: "lume-12",
    name: "Electric Plum",
    designer: "LUMIS Couture",
    price: 55,
    color: "Purple Cat-Eye",
    topColor: "#2A0840",
    midColor: "#3A1058",
    bottomColor: "#180528",
    shape: "Almond",
    length: "Medium",
    finish: "CatEye",
    catEyeDir: -0.2,
    description:
      "Rich violet cat-eye with a blue-silver shimmer that follows the light.",
  },
  {
    id: "lume-13",
    name: "Barely There",
    designer: "LUMIS Digital",
    price: 26,
    color: "Sheer Nude",
    topColor: "#E8D0B8",
    midColor: "#D8BCA0",
    bottomColor: "#C8A888",
    shape: "Square",
    length: "Short",
    finish: "Jelly",
    skinToneHex: "#d4a882",
    description:
      "The original your-nail-but-better. Sheer nude jelly for every skin tone.",
  },
  {
    id: "lume-14",
    name: "Ruby Stardust",
    designer: "LUMIS Couture",
    price: 44,
    color: "Red Glitter",
    topColor: "#A81020",
    midColor: "#C01428",
    bottomColor: "#780C18",
    shape: "Oval",
    length: "Medium",
    finish: "Glitter",
    glitterDensity: 0.07,
    description:
      "Deep crimson with scarlet and gold micro-glitter. Bold without being loud.",
  },
  {
    id: "lume-15",
    name: "Arctic Chrome",
    designer: "LUMIS Studio",
    price: 58,
    color: "Ice Chrome",
    topColor: "#D8E8F8",
    midColor: "#B8D0E8",
    bottomColor: "#88A8C8",
    shape: "Coffin",
    length: "Long",
    finish: "Chrome",
    description:
      "Glacial chrome with a cool blue undertone. The mirror effect in ice.",
  },
];
