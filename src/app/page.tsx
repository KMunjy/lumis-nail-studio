"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Heart, Eye, SlidersHorizontal, X as XIcon } from "lucide-react";
import { products } from "@/data/products";
import type { Product } from "@/data/products";
import type { NailShape, NailFinish } from "@/types";
import { ShareButton } from "@/components/ShareButton";
import { NailSwatch, FINISH_PREVIEW_SHAPE } from "@/components/NailSwatch";
import { ChallengeBanner } from "@/components/ChallengeBanner";
import { getActiveChallenge, type Challenge } from "@/data/challenges";

// ─── Product Card ─────────────────────────────────────────────────────────────

// ── Wishlist helpers ──────────────────────────────────────────────────────────
const WL_KEY = "lumis_wishlist_v1";
function getWishlist(): string[] {
  try { return JSON.parse(localStorage.getItem(WL_KEY) ?? "[]"); } catch { return []; }
}
function toggleWishlist(id: string): boolean {
  const list = getWishlist();
  const idx = list.indexOf(id);
  if (idx === -1) { list.push(id); localStorage.setItem(WL_KEY, JSON.stringify(list)); return true; }
  list.splice(idx, 1); localStorage.setItem(WL_KEY, JSON.stringify(list)); return false;
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [hovered, setHovered] = useState(false);
  const [wishlisted, setWishlisted] = useState(() => {
    if (typeof window === "undefined") return false;
    return getWishlist().includes(product.id);
  });
  const [toast, setToast] = useState<string | null>(null);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--color-border-light)",
        cursor: "pointer",
        transition: "box-shadow 0.22s ease, transform 0.2s ease",
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.10)" : "none",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <Link href={`/studio/${product.id}`} style={{ textDecoration: "none", display: "block" }}>
        {/* Swatch image area */}
        <div style={{
          position: "relative",
          paddingBottom: "80%",
          overflow: "hidden",
          backgroundColor: "#FDF9F8",
        }}>
          {/* Color strip at top */}
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 4,
            background: `linear-gradient(90deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`,
            zIndex: 1,
          }} />

          {/* NailSwatch — shape + finish-accurate thumbnail */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.22))" }}>
              <NailSwatch
                shape={product.shape}
                finish={product.finish}
                topColor={product.topColor}
                midColor={product.midColor}
                bottomColor={product.bottomColor}
                skinToneHex={product.skinToneHex}
                glitterDensity={product.glitterDensity}
                catEyeDir={product.catEyeDir}
                size="xl"
              />
            </div>
          </div>

          {/* Shape badge — top left */}
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
            <span style={{
              fontSize: 9,
              fontWeight: 500,
              color: "var(--color-ink-mid)",
              backgroundColor: "rgba(0,0,0,0.06)",
              padding: "3px 8px",
              borderRadius: 4,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontFamily: "var(--font-sans)",
            }}>
              {product.shape}
            </span>
          </div>

          {/* WhatsApp share — top left, below shape badge, shown on hover */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="share-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", top: 36, left: 0, zIndex: 2 }}
              >
                <ShareButton
                  productId={product.id}
                  productName={product.name}
                  variant="icon"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* [3] Wishlist heart — functional, saves to localStorage */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const added = toggleWishlist(product.id);
              setWishlisted(added);
              setToast(added ? "Saved to Looks ♥" : "Removed from Looks");
              setTimeout(() => setToast(null), 2000);
            }}
            aria-label={wishlisted ? "Remove from saved looks" : "Save to looks"}
            style={{
              position: "absolute", top: 8, right: 8, zIndex: 2,
              background: wishlisted ? "var(--color-pink)" : "rgba(255,255,255,0.85)",
              border: "none", borderRadius: "50%",
              width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 0.15s ease",
            }}
          >
            <Heart size={14} style={{
              color: wishlisted ? "#FFFFFF" : "#BBBBBB",
              fill: wishlisted ? "#FFFFFF" : "none",
              transition: "color 0.15s ease, fill 0.15s ease",
            }} />
          </button>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                key="toast"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  position: "absolute", top: 44, right: 8, zIndex: 10,
                  backgroundColor: "rgba(20,20,20,0.88)",
                  color: "#FFFFFF", borderRadius: 6,
                  fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 500,
                  padding: "5px 10px", whiteSpace: "nowrap",
                  backdropFilter: "blur(6px)",
                }}
              >{toast}</motion.div>
            )}
          </AnimatePresence>

          {/* [4] Enhanced hover overlay — finish · shape · price */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="cta-bar"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  backgroundColor: "var(--color-pink)",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 12px", height: 48, zIndex: 3,
                }}
              >
                <div>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                    color: "#FFFFFF", letterSpacing: "0.01em", lineHeight: 1.2,
                  }}>Try On Live</p>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 9,
                    color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}>{product.finish} · {product.shape}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Eye size={13} style={{ color: "#FFFFFF" }} />
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                    color: "#FFFFFF",
                  }}>${product.price}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info area */}
        <div style={{ padding: "12px 14px 14px" }}>
          {/* Type label */}
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            fontWeight: 400,
            color: "var(--color-ink-light)",
            marginBottom: 4,
          }}>
            Gel Polish
          </p>
          {/* Product name */}
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-ink)",
            lineHeight: 1.3,
            marginBottom: 8,
          }}>
            {product.name}
          </p>
          {/* Size + price row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              color: "var(--color-ink-light)",
            }}>
              15ml
            </span>
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-ink)",
            }}>
              ${product.price}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

// ─── Category circles data ────────────────────────────────────────────────────

const SHAPES: NailShape[] = ["Almond", "Stiletto", "Oval", "Coffin", "Square"];
const FILTERS: Array<NailShape | "All"> = ["All", ...SHAPES];

const CATEGORY_CIRCLES: Array<{
  id: string;
  label: string;
  shape: NailShape;
  finish: NailFinish;
  top: string;
  mid: string;
  bot: string;
}> = [
  { id: "All",      label: "All",      shape: "Almond",   finish: "Matte",    top: "#6B3A7A", mid: "#5C2F6E", bot: "#3A1A4A" },
  { id: "Almond",   label: "Almond",   shape: "Almond",   finish: "Gloss",    top: "#FF9FB0", mid: "#E07090", bot: "#A04060" },
  { id: "Stiletto", label: "Stiletto", shape: "Stiletto", finish: "Chrome",   top: "#F0F0F0", mid: "#C8C8C8", bot: "#909090" },
  { id: "Oval",     label: "Oval",     shape: "Oval",     finish: "Gloss",    top: "#FFFFFF", mid: "#F3DCD4", bot: "#D0A896" },
  { id: "Coffin",   label: "Coffin",   shape: "Coffin",   finish: "Glitter",  top: "#2A1A4A", mid: "#1E1234", bot: "#10081C" },
  { id: "Square",   label: "Square",   shape: "Square",   finish: "Gloss",    top: "#FFD6E0", mid: "#FFB3C6", bot: "#FF85A1" },
  { id: "Collections", label: "Collections", shape: "Stiletto", finish: "Metallic", top: "#F8D870", mid: "#E9C349", bot: "#9A7E10" },
];

// ─── Colour family swatches (second strip) — nail-shaped ──────────────────────

const COLOUR_FAMILIES: Array<{
  id: string;
  label: string;
  shape: NailShape;
  finish: NailFinish;
  top: string;
  mid: string;
  bot: string;
}> = [
  { id: "All",    label: "All",     shape: "Oval",     finish: "Gloss",    top: "#F5E6D8", mid: "#ECD5C0", bot: "#C9A98D" },
  { id: "Nude",   label: "Nudes",   shape: "Square",   finish: "Jelly",    top: "#E8D0B8", mid: "#D8BCA0", bot: "#C8A888" },
  { id: "Red",    label: "Reds",    shape: "Almond",   finish: "Gloss",    top: "#FF4040", mid: "#CC2D24", bot: "#8A1A15" },
  { id: "Berry",  label: "Berries", shape: "Almond",   finish: "Matte",    top: "#8040A0", mid: "#603078",  bot: "#3A1850" },
  { id: "Dark",   label: "Darks",   shape: "Coffin",   finish: "Matte",    top: "#3A1F4E", mid: "#2D1B33", bot: "#0A0507" },
  { id: "Gold",   label: "Gold",    shape: "Stiletto", finish: "Metallic", top: "#F8D870", mid: "#E9C349", bot: "#7A5E00" },
  { id: "Chrome", label: "Chrome",  shape: "Stiletto", finish: "Chrome",   top: "#E8E8E8", mid: "#C0C0C0", bot: "#888888" },
  { id: "Pastel", label: "Pastels", shape: "Oval",     finish: "Gloss",    top: "#FFD6E0", mid: "#F0C8F8", bot: "#C8F0E0" },
];

const PRODUCT_FAMILY_MAP: Record<string, string> = {
  "lume-01": "Dark",
  "lume-02": "Gold",
  "lume-03": "Nude",
  "lume-04": "Dark",
  "lume-05": "Rose",
  "lume-06": "Chrome",
};

// ─── Hero data ────────────────────────────────────────────────────────────────

// [1] Three shade sets the fan rotates through every 3 s
const HERO_FAN_SETS = [
  ["lume-07", "lume-01", "lume-12", "lume-05", "lume-09"],
  ["lume-02", "lume-03", "lume-04", "lume-06", "lume-08"],
  ["lume-10", "lume-11", "lume-13", "lume-14", "lume-15"],
] as const;

const FAN_POSITIONS = [
  { rot: -22, tx: -100, ty: 18, z: 1 },
  { rot: -11, tx: -50,  ty: 7,  z: 2 },
  { rot:   0, tx:   0,  ty: 0,  z: 3 },
  { rot:  11, tx:  50,  ty: 7,  z: 2 },
  { rot:  22, tx:  100, ty: 18, z: 1 },
] as const;

// [3] Skin tone options
const SKIN_TONES = [
  { hex: "#FDDBB4", label: "Fair"   },
  { hex: "#EDB98A", label: "Light"  },
  { hex: "#D08B5B", label: "Medium" },
  { hex: "#AE5D29", label: "Tan"    },
  { hex: "#694F3D", label: "Deep"   },
  { hex: "#3B2219", label: "Rich"   },
];

// [2] Trending — curated top shades (in production: from analytics)
const TRENDING_IDS = ["lume-12", "lume-05", "lume-03", "lume-09", "lume-01"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [activeFilter, setActiveFilter]   = useState<string>("All");
  const [selectedFamily, setSelectedFamily] = useState<string>("All");
  const [finishFilter, setFinishFilter]   = useState<string>("All");
  const [sortBy, setSortBy]               = useState<"bestsellers"|"price-asc"|"price-desc"|"newest">("bestsellers");
  const [sortOpen, setSortOpen]           = useState(false);
  // [F5 Challenge Mode] active challenge banner
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [challengeDismissed, setChallengeDismissed] = useState(false);
  // [1] Animated fan
  const [fanSet, setFanSet]               = useState(0);
  const fanRef                            = useRef(0);
  // [3] Skin tone
  const [skinTone, setSkinTone]           = useState<string | null>(null);
  const [skinToneOpen, setSkinToneOpen]   = useState(false);

  // [1] Rotate fan every 3 s
  useEffect(() => {
    const t = setInterval(() => {
      fanRef.current = (fanRef.current + 1) % HERO_FAN_SETS.length;
      setFanSet(fanRef.current);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // [F5] Load active challenge — compare stored dismissed slug to current slug
  useEffect(() => {
    const challenge = getActiveChallenge();
    if (!challenge) return;
    try {
      const dismissed = localStorage.getItem("lumis_challenge_dismissed_v1");
      if (dismissed === challenge.slug) { setChallengeDismissed(true); return; }
    } catch { /* ignore */ }
    setActiveChallenge(challenge);
  }, []);

  // [1] Sort + filter combined
  const filtered = (() => {
    let list = products.filter((p: Product) => {
      const shapeMatch  = activeFilter   === "All" || p.shape  === activeFilter;
      const familyMatch = selectedFamily === "All" || PRODUCT_FAMILY_MAP[p.id] === selectedFamily;
      const finishMatch = finishFilter   === "All" || p.finish === finishFilter;
      return shapeMatch && familyMatch && finishMatch;
    });
    if (sortBy === "price-asc")  list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === "newest")     list = [...list].reverse();
    return list;
  })();

  return (
    <div style={{ backgroundColor: "#FFFFFF", minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(145deg, #1A0A1E 0%, #2D1040 40%, #120818 100%)",
        padding: "48px 24px 40px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 340, height: 200,
          background: "radial-gradient(ellipse, rgba(232,64,112,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* [4] Social proof counter */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 50, padding: "6px 14px",
          position: "relative", zIndex: 4,
        }}>
          <span style={{ fontSize: 13 }}>✦</span>
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: 11,
            color: "rgba(255,255,255,0.70)", letterSpacing: "0.01em",
          }}>
            47,000+ shades tried this week · ★ 4.9
          </span>
        </div>

        {/* [1] Animated five-nail fan */}
        <div style={{
          position: "relative", display: "flex",
          alignItems: "flex-end", justifyContent: "center",
          height: 160, width: 260,
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={fanSet}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", inset: 0 }}
            >
              {HERO_FAN_SETS[fanSet].map((shadeId, i) => {
                const p = products.find(pr => pr.id === shadeId);
                if (!p) return null;
                const pos = FAN_POSITIONS[i];
                return (
                  <div
                    key={shadeId}
                    style={{
                      position: "absolute", bottom: 0, left: "50%",
                      transform: `translateX(calc(-50% + ${pos.tx}px)) translateY(${pos.ty}px) rotate(${pos.rot}deg)`,
                      zIndex: pos.z,
                      filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.55))",
                    }}
                  >
                    <NailSwatch
                      shape={p.shape} finish={p.finish}
                      topColor={p.topColor} midColor={p.midColor} bottomColor={p.bottomColor}
                      skinToneHex={skinTone ?? p.skinToneHex}
                      glitterDensity={p.glitterDensity} catEyeDir={p.catEyeDir}
                      size="lg"
                    />
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 4 }}>
          <h1 style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: 28, fontWeight: 700, color: "#FFFFFF",
            lineHeight: 1.15, marginBottom: 8, letterSpacing: "-0.01em",
          }}>
            Your perfect shade,<br />on your hand.
          </h1>
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 14,
            color: "rgba(255,255,255,0.60)", marginBottom: 20,
          }}>
            Try any finish live — no app needed.
          </p>

          {/* [5] Dual CTA */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/studio/lume-12"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                padding: "12px 28px", borderRadius: 50, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(232,64,112,0.40)", letterSpacing: "0.01em",
              }}
            >
              <Eye size={15} />
              Try On Live
            </Link>
            <a
              href="#collection"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                backgroundColor: "transparent", color: "rgba(255,255,255,0.75)",
                fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500,
                padding: "12px 24px", borderRadius: 50, textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.20)", letterSpacing: "0.01em",
                transition: "background-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
              }}
            >
              Browse Collection ↓
            </a>
          </div>
        </div>

        {/* [3] Skin tone selector pill */}
        <div style={{ position: "relative", zIndex: 4 }}>
          <button
            onClick={() => setSkinToneOpen(v => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 50, padding: "7px 14px", cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: 11,
              color: "rgba(255,255,255,0.65)", transition: "background 0.15s",
            }}
          >
            <div style={{
              width: 14, height: 14, borderRadius: "50%",
              backgroundColor: skinTone ?? "#EDB98A",
              border: "1px solid rgba(255,255,255,0.20)",
            }} />
            {skinTone ? "Skin tone set" : "Your skin tone →"}
          </button>
          <AnimatePresence>
            {skinToneOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: "absolute", top: "calc(100% + 10px)", left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "rgba(22,19,17,0.96)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12, padding: "12px 16px",
                  display: "flex", flexDirection: "column", gap: 10,
                  backdropFilter: "blur(12px)", zIndex: 10,
                  minWidth: 200,
                }}
              >
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 10,
                  color: "rgba(255,255,255,0.40)", letterSpacing: "0.08em",
                  textTransform: "uppercase", marginBottom: 4,
                }}>Select your skin tone</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {SKIN_TONES.map(t => (
                    <button
                      key={t.hex}
                      onClick={() => { setSkinTone(t.hex); setSkinToneOpen(false); }}
                      title={t.label}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        backgroundColor: t.hex, border: "none", cursor: "pointer",
                        outline: skinTone === t.hex ? "2px solid var(--color-pink)" : "2px solid transparent",
                        outlineOffset: 2, transition: "outline-color 0.15s",
                      }}
                    />
                  ))}
                </div>
                {skinTone && (
                  <button
                    onClick={() => { setSkinTone(null); setSkinToneOpen(false); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "var(--font-sans)", fontSize: 10,
                      color: "rgba(255,255,255,0.35)", textAlign: "left",
                      padding: 0,
                    }}
                  >Reset →</button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* [2] Trending Now strip */}
      <section style={{
        padding: "16px 16px 0", backgroundColor: "#FDFBFA",
        borderBottom: "1px solid var(--color-border-light)",
      }}>
        <div className="max-w-6xl mx-auto">
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 10,
          }}>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--color-ink-light)",
            }}>Trending this week</span>
            <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border-light)" }} />
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <div style={{ display: "flex", gap: 16, paddingBottom: 14, width: "max-content" }}>
              {TRENDING_IDS.map((id, idx) => {
                const p = products.find(pr => pr.id === id);
                if (!p) return null;
                return (
                  <Link
                    key={id}
                    href={`/studio/${id}`}
                    style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  >
                    <div style={{ position: "relative" }}>
                      {/* Rank badge */}
                      <div style={{
                        position: "absolute", top: -4, left: -4, zIndex: 2,
                        width: 16, height: 16, borderRadius: "50%",
                        backgroundColor: idx === 0 ? "var(--color-pink)" : "var(--color-ink-light)",
                        color: "#FFFFFF",
                        fontFamily: "var(--font-sans)", fontSize: 8, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>#{idx + 1}</div>
                      <div style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.14))" }}>
                        <NailSwatch
                          shape={p.shape} finish={p.finish}
                          topColor={p.topColor} midColor={p.midColor} bottomColor={p.bottomColor}
                          skinToneHex={skinTone ?? p.skinToneHex}
                          glitterDensity={p.glitterDensity} catEyeDir={p.catEyeDir}
                          size="sm"
                        />
                      </div>
                    </div>
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 500,
                      color: "var(--color-ink-mid)", whiteSpace: "nowrap",
                      maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis",
                    }}>{p.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Category Circles Strip ─────────────────────────────────────── */}
      <section style={{ padding: "20px 16px 0", backgroundColor: "#FFFFFF" }}>
        <div className="max-w-6xl mx-auto">
          <div className="overflow-x-auto no-scrollbar">
            <div style={{ display: "flex", gap: 16, width: "max-content", paddingBottom: 8 }}>
              {CATEGORY_CIRCLES.map((cat) => {
                const isActive = activeFilter === cat.id;
                const isShape = FILTERS.includes(cat.id as NailShape | "All");
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (isShape) {
                        setActiveFilter(cat.id);
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {/* Nail-shaped category chip */}
                    <div
                      style={{
                        padding:       6,
                        borderRadius:  8,
                        backgroundColor: "#FDF9F8",
                        display:       "flex",
                        alignItems:    "center",
                        justifyContent: "center",
                        outline:       isActive ? "2px solid var(--color-pink)" : "2px solid transparent",
                        outlineOffset: 2,
                        transition:    "outline-color 0.15s ease",
                        filter:        "drop-shadow(0 2px 6px rgba(0,0,0,0.10))",
                      }}
                    >
                      <NailSwatch
                        shape={cat.shape}
                        finish={cat.finish}
                        topColor={cat.top}
                        midColor={cat.mid}
                        bottomColor={cat.bot}
                        size="sm"
                      />
                    </div>
                    {/* Label */}
                    <span style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 400,
                      color: "var(--color-ink-mid)",
                      whiteSpace: "nowrap",
                    }}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Banner ────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "var(--color-pink-soft)",
        padding: "10px 16px",
        textAlign: "center",
        marginTop: 16,
      }}>
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-ink)",
        }}>
          Free shade guide with any order{" "}
          <span style={{ color: "var(--color-pink)" }}>→</span>
        </span>
      </div>

      {/* ── Product Grid Section ───────────────────────────────────────── */}
      <section id="collection" style={{ padding: "24px 16px 0" }}>
        <div className="max-w-6xl mx-auto">

          {/* Section header row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}>
            <div>
              <span style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-ink)",
              }}>
                Gel Polish Collection
              </span>
              <span style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 400,
                color: "var(--color-ink-light)",
                marginLeft: 8,
              }}>
                {filtered.length} shades
              </span>
            </div>
            {/* [1] Functional sort dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setSortOpen(v => !v)}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                  color: "var(--color-ink-mid)", backgroundColor: "#FFFFFF",
                  border: "1px solid var(--color-border)", borderRadius: 6,
                  padding: "6px 12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <SlidersHorizontal size={13} />
                {sortBy === "bestsellers" ? "Bestsellers" :
                 sortBy === "price-asc"  ? "Price: Low → High" :
                 sortBy === "price-desc" ? "Price: High → Low" : "Newest"}
                {" "}▾
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: "absolute", top: "calc(100% + 6px)", right: 0,
                      backgroundColor: "#FFFFFF",
                      border: "1px solid var(--color-border-light)",
                      borderRadius: 8, zIndex: 50, minWidth: 180,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.10)", overflow: "hidden",
                    }}
                  >
                    {([
                      { value: "bestsellers",  label: "Bestsellers"       },
                      { value: "price-asc",    label: "Price: Low → High" },
                      { value: "price-desc",   label: "Price: High → Low" },
                      { value: "newest",       label: "Newest"            },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                        style={{
                          display: "block", width: "100%", padding: "10px 14px",
                          fontFamily: "var(--font-sans)", fontSize: 13,
                          fontWeight: sortBy === opt.value ? 600 : 400,
                          color: sortBy === opt.value ? "var(--color-pink)" : "var(--color-ink)",
                          backgroundColor: sortBy === opt.value ? "var(--color-pink-soft)" : "transparent",
                          border: "none", cursor: "pointer", textAlign: "left",
                        }}
                      >{opt.label}</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* [2] Shape filter chips */}
          <div className="overflow-x-auto no-scrollbar" style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, paddingBottom: 4, width: "max-content" }}>
              {FILTERS.map((f) => {
                const isActive = activeFilter === f;
                return (
                  <button key={f} onClick={() => setActiveFilter(f)} style={{
                    padding: "7px 16px", borderRadius: 999,
                    fontSize: 12, fontWeight: 500, fontFamily: "var(--font-sans)",
                    cursor: "pointer", flexShrink: 0, transition: "all 0.15s ease",
                    backgroundColor: isActive ? "var(--color-ink)" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "var(--color-ink-mid)",
                    border: isActive ? "1px solid var(--color-ink)" : "1px solid var(--color-border)",
                  }}>
                    {f === "All" ? "ALL" : f.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* [2] Finish filter chips */}
          <div className="overflow-x-auto no-scrollbar" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 6, paddingBottom: 4, width: "max-content" }}>
              {(["All","Gloss","Matte","Metallic","Chrome","Jelly","Glitter","CatEye"] as const).map(f => {
                const isActive = finishFilter === f;
                return (
                  <button key={f} onClick={() => setFinishFilter(f)} style={{
                    padding: "5px 12px", borderRadius: 999,
                    fontSize: 11, fontWeight: 500, fontFamily: "var(--font-sans)",
                    cursor: "pointer", flexShrink: 0, transition: "all 0.15s ease",
                    backgroundColor: isActive ? "var(--color-pink)" : "#FFFFFF",
                    color: isActive ? "#FFFFFF" : "var(--color-ink-light)",
                    border: isActive ? "1px solid var(--color-pink)" : "1px solid var(--color-border-light)",
                  }}>
                    {f === "CatEye" ? "Cat Eye" : f}
                  </button>
                );
              })}
            </div>
          </div>

          {/* [5] Empty state */}
          {filtered.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "60px 24px", gap: 16, textAlign: "center",
            }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600,
                color: "var(--color-ink)" }}>No shades match those filters</p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13,
                color: "var(--color-ink-light)" }}>Try a different shape or finish combination.</p>
              <button
                onClick={() => { setActiveFilter("All"); setFinishFilter("All"); setSelectedFamily("All"); }}
                style={{
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                  color: "var(--color-pink)", backgroundColor: "var(--color-pink-soft)",
                  border: "1px solid var(--color-pink)", borderRadius: 6,
                  padding: "8px 20px", cursor: "pointer",
                }}
              >Clear all filters</button>
            </div>
          ) : (
            /* Product grid */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product: Product, i: number) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Colour Family Circles Strip ────────────────────────────────── */}
      <section style={{ padding: "40px 16px 0", backgroundColor: "#FFFFFF" }}>
        <div className="max-w-6xl mx-auto">
          <p style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--color-ink)",
            marginBottom: 16,
          }}>
            Shop by Colour
          </p>

          <div className="overflow-x-auto no-scrollbar">
            <div style={{ display: "flex", gap: 16, width: "max-content", paddingBottom: 8 }}>
              {COLOUR_FAMILIES.map((fam) => {
                const isActive = selectedFamily === fam.id;
                return (
                  <button
                    key={fam.id}
                    onClick={() => setSelectedFamily(fam.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {/* Nail-shaped colour family swatch */}
                    <div style={{
                      padding:       5,
                      borderRadius:  8,
                      outline:       isActive ? "2px solid var(--color-pink)" : "2px solid transparent",
                      outlineOffset: 2,
                      transition:    "outline-color 0.15s ease",
                      filter:        "drop-shadow(0 2px 8px rgba(0,0,0,0.12))",
                      opacity:       isActive ? 1 : 0.75,
                    }}>
                      <NailSwatch
                        shape={fam.shape}
                        finish={fam.finish}
                        topColor={fam.top}
                        midColor={fam.mid}
                        bottomColor={fam.bot}
                        size="sm"
                      />
                    </div>
                    <span style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fontWeight: 400,
                      color: "var(--color-ink-mid)",
                      whiteSpace: "nowrap",
                    }}>
                      {fam.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* [F5] Challenge Mode banner */}
      <AnimatePresence>
        {activeChallenge && !challengeDismissed && (
          <ChallengeBanner
            key={activeChallenge.slug}
            challenge={activeChallenge}
            onDismiss={() => {
              setChallengeDismissed(true);
              try {
                localStorage.setItem("lumis_challenge_dismissed_v1", activeChallenge.slug);
              } catch { /* ignore */ }
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
