import type { NailShape, NailFinish } from "@/types";

export interface TrendEntry {
  productId:      string;
  productName:    string;
  shape:          NailShape;
  finish:         NailFinish;
  topColor:       string;
  midColor:       string;
  bottomColor:    string;
  skinToneHex?:   string;
  glitterDensity?: number;
  catEyeDir?:     number;
  curatorNote:    string;  // ≤ 60 chars
}

export interface TrendCollection {
  id:           string;
  season:       string;
  tagline:      string;
  heroFrom:     string;  // CSS gradient start colour
  heroTo:       string;  // CSS gradient end colour
  entries:      TrendEntry[];
}

export const trendCollections: TrendCollection[] = [
  {
    id: "spring-2026",
    season: "Spring 2026",
    tagline: "Soft femininity meets botanical freshness",
    heroFrom: "#FADADD",
    heroTo: "#F4C8D0",
    entries: [
      {
        productId: "lume-05",
        productName: "Rosé Reverie",
        shape: "Square",
        finish: "Gloss",
        topColor: "#FFD6E4",
        midColor: "#F4A8C0",
        bottomColor: "#C06080",
        curatorNote: "The definitive spring gloss. Light and luminous.",
      },
      {
        productId: "lume-07",
        productName: "Glazed Petal",
        shape: "Oval",
        finish: "Jelly",
        topColor: "#FADADD",
        midColor: "#F5C0C5",
        bottomColor: "#E8A0A8",
        skinToneHex: "#d4a882",
        curatorNote: "Glazed donut aesthetic — utterly irresistible.",
      },
      {
        productId: "lume-03",
        productName: "Classic French 2.0",
        shape: "Oval",
        finish: "Gloss",
        topColor: "#FFFFFF",
        midColor: "#F3DCD4",
        bottomColor: "#D0A896",
        curatorNote: "Effortless and elegant for every spring occasion.",
      },
      {
        productId: "lume-13",
        productName: "Barely There",
        shape: "Square",
        finish: "Jelly",
        topColor: "#E8D0B8",
        midColor: "#D8BCA0",
        bottomColor: "#C8A888",
        skinToneHex: "#d4a882",
        curatorNote: "Your-nail-but-better. Timeless sheer perfection.",
      },
    ],
  },
  {
    id: "summer-2026",
    season: "Summer 2026",
    tagline: "Bold colour, zero apologies",
    heroFrom: "#A8D8EA",
    heroTo: "#7AB8D4",
    entries: [
      {
        productId: "lume-08",
        productName: "Ocean Glaze",
        shape: "Almond",
        finish: "Jelly",
        topColor: "#A8D8EA",
        midColor: "#88C0D8",
        bottomColor: "#5898B8",
        skinToneHex: "#c89870",
        curatorNote: "Cool and translucent — made for beach days.",
      },
      {
        productId: "lume-15",
        productName: "Arctic Chrome",
        shape: "Coffin",
        finish: "Chrome",
        topColor: "#D8E8F8",
        midColor: "#B8D0E8",
        bottomColor: "#88A8C8",
        curatorNote: "Ice-chrome energy for peak summer heat.",
      },
      {
        productId: "lume-10",
        productName: "Champagne Fizz",
        shape: "Square",
        finish: "Glitter",
        topColor: "#C8A840",
        midColor: "#B89030",
        bottomColor: "#806010",
        glitterDensity: 0.06,
        curatorNote: "Festival-ready gold glitter for every night out.",
      },
      {
        productId: "lume-02",
        productName: "Liquid Gold",
        shape: "Stiletto",
        finish: "Metallic",
        topColor: "#F5D060",
        midColor: "#E9C349",
        bottomColor: "#7A5E00",
        curatorNote: "Statement metallic that commands the room.",
      },
    ],
  },
  {
    id: "autumn-2026",
    season: "Autumn 2026",
    tagline: "Rich, moody, and unapologetically dramatic",
    heroFrom: "#3D1F4A",
    heroTo: "#2A0840",
    entries: [
      {
        productId: "lume-01",
        productName: "Velvet Dahlia",
        shape: "Almond",
        finish: "Matte",
        topColor: "#3D1F4A",
        midColor: "#5C2F6E",
        bottomColor: "#1A0F1E",
        curatorNote: "The definitive autumn shade. Velvet matte drama.",
      },
      {
        productId: "lume-12",
        productName: "Electric Plum",
        shape: "Almond",
        finish: "CatEye",
        topColor: "#2A0840",
        midColor: "#3A1058",
        bottomColor: "#180528",
        catEyeDir: -0.2,
        curatorNote: "Purple cat-eye that shifts like a bruised sunset.",
      },
      {
        productId: "lume-14",
        productName: "Ruby Stardust",
        shape: "Oval",
        finish: "Glitter",
        topColor: "#A81020",
        midColor: "#C01428",
        bottomColor: "#780C18",
        glitterDensity: 0.07,
        curatorNote: "Red glitter for when you mean serious business.",
      },
      {
        productId: "lume-09",
        productName: "Galaxy Dust",
        shape: "Coffin",
        finish: "Glitter",
        topColor: "#2A1A4A",
        midColor: "#3D2860",
        bottomColor: "#1A0E30",
        glitterDensity: 0.09,
        curatorNote: "Holographic galaxy — your nails become art.",
      },
    ],
  },
  {
    id: "winter-2026",
    season: "Winter 2026",
    tagline: "Mirror finishes and magnetic mystery",
    heroFrom: "#141420",
    heroTo: "#0A0A14",
    entries: [
      {
        productId: "lume-11",
        productName: "Magnetic Noir",
        shape: "Stiletto",
        finish: "CatEye",
        topColor: "#0A0A14",
        midColor: "#141420",
        bottomColor: "#08080E",
        catEyeDir: 0.3,
        curatorNote: "Black cat-eye: the only cold-weather nail.",
      },
      {
        productId: "lume-04",
        productName: "Onyx Chroma",
        shape: "Coffin",
        finish: "Chrome",
        topColor: "#1A1A1A",
        midColor: "#0D0D0D",
        bottomColor: "#050505",
        curatorNote: "Obsidian chrome — dark, sleek, and powerful.",
      },
      {
        productId: "lume-06",
        productName: "Midnight Chrome",
        shape: "Stiletto",
        finish: "Chrome",
        topColor: "#E8E8E8",
        midColor: "#B8B8B8",
        bottomColor: "#707070",
        curatorNote: "Silver mirror — pure winter elegance.",
      },
      {
        productId: "lume-15",
        productName: "Arctic Chrome",
        shape: "Coffin",
        finish: "Chrome",
        topColor: "#D8E8F8",
        midColor: "#B8D0E8",
        bottomColor: "#88A8C8",
        curatorNote: "Glacial chrome. Winter in your fingertips.",
      },
    ],
  },
];
