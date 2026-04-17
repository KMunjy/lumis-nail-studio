"use client";

/**
 * ShadeSelector — nail swatch picker  v5.0
 *
 * v5.0 additions:
 *  [F6-1] Search/filter input — live name filter with clear button
 *  [F6-2] "Recently Tried" pinned row — up to 6 shades from localStorage
 *  [F6-3] Favourite hearts — toggle heart per swatch, persists to localStorage
 *  [F6-4] Finish badge — small chip under each swatch name
 *  [F6-5] Section headers — grouped by finish when showing All / no search
 *
 * Two tiers (unchanged):
 *  1. Finish-family filter — NailSwatch thumbnails (sm), one per finish type.
 *  2. Shade strip — NailSwatch (md) per product in the correct silhouette shape.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Search, X } from "lucide-react";
import { products } from "@/data/products";
import { NailSwatch, FINISH_PREVIEW_SHAPE } from "@/components/NailSwatch";
import type { NailStyle, NailShape, NailFinish } from "@/types";

// ─── Shade catalog — derived from products ─────────────────────────────────────

export interface ShadeOption {
  id:              string;
  label:           string;
  topColor:        string;
  midColor:        string;
  bottomColor:     string;
  shape:           NailShape;
  finish:          NailFinish;
  skinToneHex?:    string;
  glitterDensity?: number;
  catEyeDir?:      number;
}

export const SHADE_OPTIONS: ShadeOption[] = products.map((p) => ({
  id:              p.id,
  label:           p.name,
  topColor:        p.topColor,
  midColor:        p.midColor,
  bottomColor:     p.bottomColor,
  shape:           p.shape,
  finish:          p.finish,
  skinToneHex:     p.skinToneHex,
  glitterDensity:  p.glitterDensity,
  catEyeDir:       p.catEyeDir,
}));

// ─── Family filter data ───────────────────────────────────────────────────────

const FAMILIES: Array<{
  id:     "All" | NailFinish;
  label:  string;
  top:    string;
  mid:    string;
  bot:    string;
}> = [
  { id: "All",      label: "All",      top: "#F4A8C0", mid: "#E07090", bot: "#A04060" },
  { id: "Gloss",    label: "Gloss",    top: "#FFD6E4", mid: "#F4A8C0", bot: "#C06080" },
  { id: "Matte",    label: "Matte",    top: "#6B3A7A", mid: "#5C2F6E", bot: "#3A1A4A" },
  { id: "Metallic", label: "Metallic", top: "#F8D870", mid: "#E9C349", bot: "#9A7E10" },
  { id: "Chrome",   label: "Chrome",   top: "#F0F0F0", mid: "#C8C8C8", bot: "#909090" },
  { id: "Jelly",    label: "Jelly",    top: "#FADADD", mid: "#F5C0C5", bot: "#E8A0A8" },
  { id: "Glitter",  label: "Glitter",  top: "#3D2860", mid: "#2A1A4A", bot: "#180E30" },
  { id: "CatEye",   label: "Cat Eye",  top: "#1A1A28", mid: "#141420", bot: "#08080E" },
];

const SHADE_FAMILY_MAP: Record<string, string> = Object.fromEntries(
  products.map((p) => [p.id, p.finish]),
);

// ─── [F6-3] Favourites localStorage helpers ───────────────────────────────────

const FAV_KEY    = "lumis_wishlist_v1";      // unified with browse-grid wishlist key
const RECENT_KEY = "lumis_recently_tried_v1";

function getFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"); } catch { return []; }
}
function toggleFav(id: string): boolean {
  const list = getFavs();
  const idx  = list.indexOf(id);
  if (idx === -1) { list.push(id); localStorage.setItem(FAV_KEY, JSON.stringify(list)); return true; }
  list.splice(idx, 1); localStorage.setItem(FAV_KEY, JSON.stringify(list)); return false;
}

// ─── [F6-2] Recently tried localStorage helpers ────────────────────────────────

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function addRecent(id: string) {
  const list = getRecent().filter((x) => x !== id);
  list.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}

// ─── "All" family pill — cluster of three tiny swatches ──────────────────────

function AllPill({ isActive }: { isActive: boolean }) {
  return (
    <div style={{ width: 40, height: 56, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", left: 0, top: 6, opacity: 0.70 }}>
        <NailSwatch shape="Oval"   finish="Gloss"   topColor="#FFD6E4" midColor="#F4A8C0" bottomColor="#C06080" size="xs" />
      </div>
      <div style={{ position: "absolute", left: 8, top: 2, opacity: 0.80 }}>
        <NailSwatch shape="Almond" finish="Matte"   topColor="#6B3A7A" midColor="#5C2F6E" bottomColor="#3A1A4A" size="xs" />
      </div>
      <div style={{ position: "absolute", left: 16, top: 6, opacity: 0.70 }}>
        <NailSwatch shape="Coffin" finish="Glitter" topColor="#3D2860" midColor="#2A1A4A" bottomColor="#180E30" size="xs" glitterDensity={0.07} />
      </div>
      {isActive && <div style={{ position: "absolute", inset: -3, border: "2px solid var(--color-pink)", borderRadius: 4 }} />}
    </div>
  );
}

// ─── [F6-4] Finish badge ──────────────────────────────────────────────────────

const FINISH_BADGE_COLOR: Record<NailFinish, string> = {
  Gloss:    "#EC4899",
  Matte:    "#7C3AED",
  Metallic: "#D97706",
  Chrome:   "#6B7280",
  Jelly:    "#DB2777",
  Glitter:  "#7C3AED",
  CatEye:   "#1D4ED8",
};

const FINISH_SHORT: Record<NailFinish, string> = {
  Gloss: "G", Matte: "M", Metallic: "Me", Chrome: "Ch", Jelly: "J", Glitter: "Gl", CatEye: "CE",
};

// ─── Individual swatch button ──────────────────────────────────────────────────

function SwatchButton({
  shade, isActive, isFav, onSelect, onToggleFav, index,
}: {
  shade: ShadeOption;
  isActive: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
  index: number;
}) {
  const badgeColor = FINISH_BADGE_COLOR[shade.finish] ?? "#6B7280";

  return (
    <motion.div
      key={shade.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.022, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: "relative", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
    >
      <button
        onClick={onSelect}
        aria-label={`${shade.label} — ${shade.finish} finish`}
        aria-pressed={isActive}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
      >
        {/* Nail swatch */}
        <motion.div
          animate={{ scale: isActive ? 1.12 : 1 }}
          transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "relative",
            padding: 3, borderRadius: 8,
            outline: isActive ? "2px solid var(--color-pink)" : "2px solid transparent",
            outlineOffset: 1,
            transition: "outline-color 0.15s ease",
            filter: isActive
              ? "drop-shadow(0 3px 10px rgba(232,64,112,0.40))"
              : "drop-shadow(0 2px 6px rgba(0,0,0,0.18))",
          }}
        >
          <NailSwatch
            shape={shade.shape}
            finish={shade.finish}
            topColor={shade.topColor}
            midColor={shade.midColor}
            bottomColor={shade.bottomColor}
            skinToneHex={shade.skinToneHex}
            glitterDensity={shade.glitterDensity}
            catEyeDir={shade.catEyeDir}
            size="md"
            aria-label={shade.label}
          />
          {/* [F6-4] Finish badge dot */}
          <span style={{
            position: "absolute", bottom: 2, right: 2,
            width: 9, height: 9, borderRadius: "50%",
            backgroundColor: badgeColor,
            border: "1.5px solid #FFFFFF",
            boxShadow: "0 1px 2px rgba(0,0,0,0.20)",
          }} title={shade.finish} />
        </motion.div>

        {/* Name label */}
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: 9,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--color-pink)" : "var(--color-ink-light)",
          whiteSpace: "nowrap", textAlign: "center",
          maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis",
          transition: "color 0.15s ease",
        }}>
          {shade.label}
        </span>

        {/* [F6-4] Finish badge label */}
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: 7, fontWeight: 700,
          color: badgeColor,
          letterSpacing: "0.06em",
          lineHeight: 1,
        }}>
          {FINISH_SHORT[shade.finish]}
        </span>
      </button>

      {/* [F6-3] Favourite heart button */}
      <button
        onClick={onToggleFav}
        aria-label={isFav ? `Remove ${shade.label} from favourites` : `Favourite ${shade.label}`}
        style={{
          position: "absolute", top: 0, right: -2,
          width: 16, height: 16, borderRadius: "50%",
          backgroundColor: isFav ? "var(--color-pink)" : "rgba(255,255,255,0.85)",
          border: isFav ? "none" : "1px solid rgba(0,0,0,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", padding: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "background-color 0.15s, transform 0.15s",
          zIndex: 2,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.18)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
      >
        <Heart size={8} style={{ fill: isFav ? "#FFFFFF" : "none", color: isFav ? "#FFFFFF" : "var(--color-ink-mid)" }} />
      </button>
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ShadeSelectorProps {
  activeShadeId: string | null;
  onSelect: (style: NailStyle | null, shadeId: string | null) => void;
}

export function ShadeSelector({ activeShadeId, onSelect }: ShadeSelectorProps) {
  const [family,    setFamily]    = useState<string>("All");
  const [search,    setSearch]    = useState("");
  const [favIds,    setFavIds]    = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setFavIds(getFavs());
    setRecentIds(getRecent());
  }, []);

  // ── Filtered shades ──────────────────────────────────────────────────────
  const byFamily =
    family === "All"
      ? SHADE_OPTIONS
      : SHADE_OPTIONS.filter((s) => SHADE_FAMILY_MAP[s.id] === family);

  const visibleShades = search.trim()
    ? SHADE_OPTIONS.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()))
    : byFamily;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelect = (shade: ShadeOption) => {
    if (activeShadeId === shade.id) {
      onSelect(null, null);
      return;
    }
    const style: NailStyle = {
      topColor: shade.topColor, midColor: shade.midColor, bottomColor: shade.bottomColor,
      shape: shade.shape, finish: shade.finish, opacity: 0.92,
      skinToneHex: shade.skinToneHex, glitterDensity: shade.glitterDensity, catEyeDir: shade.catEyeDir,
    };
    onSelect(style, shade.id);
    // [F6-2] Track as recently tried
    addRecent(shade.id);
    setRecentIds(getRecent());
  };

  const handleToggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleFav(id);
    setFavIds(getFavs());
  };

  // ── [F6-2] Recently tried shades ─────────────────────────────────────────
  const recentShades = recentIds
    .map((id) => SHADE_OPTIONS.find((s) => s.id === id))
    .filter(Boolean) as ShadeOption[];

  // ── [F6-5] Grouped sections (only when All + no search) ──────────────────
  const showSections = family === "All" && !search.trim();
  type FinishGroup = { finish: NailFinish; label: string; shades: ShadeOption[] };
  const sections: FinishGroup[] = showSections
    ? (["Gloss","Matte","Metallic","Chrome","Jelly","Glitter","CatEye"] as NailFinish[])
        .map((f) => ({
          finish: f,
          label: FAMILIES.find((x) => x.id === f)?.label ?? f,
          shades: visibleShades.filter((s) => s.finish === f),
        }))
        .filter((g) => g.shades.length > 0)
    : [];

  return (
    <div className="w-full" style={{ backgroundColor: "#FFFFFF" }}>

      {/* [F6-1] Search input */}
      <div style={{ padding: "4px 2px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 6,
          backgroundColor: "#F5F5F5",
          borderRadius: 20, padding: "5px 10px",
          border: "1px solid var(--color-border-light)",
        }}>
          <Search size={11} style={{ color: "var(--color-ink-light)", flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shades…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontFamily: "var(--font-sans)", fontSize: 11,
              color: "var(--color-ink)",
              minWidth: 0,
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); searchRef.current?.focus(); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              aria-label="Clear search"
            >
              <X size={11} style={{ color: "var(--color-ink-light)" }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Family filter — nail-shaped finish pills ────────────────────── */}
      {!search && (
        <div className="overflow-x-auto no-scrollbar" style={{ paddingBottom: 10 }}>
          <div style={{ display: "flex", gap: 16, width: "max-content", paddingLeft: 2, paddingRight: 2 }}>
            {FAMILIES.map((fam) => {
              const isActive = family === fam.id;
              return (
                <button
                  key={fam.id}
                  onClick={() => setFamily(fam.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0,
                  }}
                  aria-label={`Filter by ${fam.label} finish`}
                  aria-pressed={isActive}
                >
                  <div style={{
                    padding: 4, borderRadius: 6,
                    outline: isActive ? "2px solid var(--color-pink)" : "2px solid transparent",
                    outlineOffset: 2, transition: "outline-color 0.15s ease",
                    opacity: isActive ? 1 : 0.70,
                  }}>
                    {fam.id === "All" ? (
                      <AllPill isActive={false} />
                    ) : (
                      <NailSwatch
                        shape={FINISH_PREVIEW_SHAPE[fam.id as NailFinish]}
                        finish={fam.id as NailFinish}
                        topColor={fam.top} midColor={fam.mid} bottomColor={fam.bot}
                        size="sm"
                      />
                    )}
                  </div>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: 10,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--color-ink)" : "var(--color-ink-light)",
                    whiteSpace: "nowrap", transition: "color 0.15s ease, font-weight 0.15s ease",
                  }}>
                    {fam.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* [F6-2] Recently Tried pinned row */}
      <AnimatePresence>
        {recentShades.length > 0 && !search && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingBottom: 8 }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 8, fontWeight: 700,
                color: "var(--color-ink-light)", letterSpacing: "0.12em",
                textTransform: "uppercase", paddingLeft: 2, marginBottom: 6,
              }}>Recently Tried</p>
              <div className="overflow-x-auto no-scrollbar">
                <div style={{ display: "flex", gap: 8, paddingLeft: 2, paddingRight: 2, width: "max-content", alignItems: "flex-end" }}>
                  {recentShades.slice(0, 6).map((shade, i) => (
                    <SwatchButton
                      key={shade.id}
                      shade={shade}
                      isActive={activeShadeId === shade.id}
                      isFav={favIds.includes(shade.id)}
                      onSelect={() => handleSelect(shade)}
                      onToggleFav={(e) => handleToggleFav(e, shade.id)}
                      index={i}
                    />
                  ))}
                </div>
              </div>
              <div style={{ height: 1, backgroundColor: "var(--color-border-light)", margin: "8px 2px 0" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Shade strip ─────────────────────────────────────────────────────── */}
      {showSections ? (
        /* [F6-5] Grouped with section headers */
        <div>
          {sections.map((group) => (
            <div key={group.finish} style={{ marginBottom: 10 }}>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 8, fontWeight: 700,
                color: "var(--color-ink-light)", letterSpacing: "0.12em",
                textTransform: "uppercase", paddingLeft: 2, marginBottom: 6,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                  backgroundColor: FINISH_BADGE_COLOR[group.finish],
                }} />
                {group.label}
                <span style={{ fontWeight: 400, letterSpacing: 0 }}>— {group.shades.length}</span>
              </p>
              <div className="overflow-x-auto no-scrollbar">
                <div style={{ display: "flex", gap: 8, paddingBottom: 4, paddingLeft: 2, paddingRight: 2, paddingTop: 2, width: "max-content", alignItems: "flex-end" }}>
                  {group.shades.map((shade, i) => (
                    <SwatchButton
                      key={shade.id}
                      shade={shade}
                      isActive={activeShadeId === shade.id}
                      isFav={favIds.includes(shade.id)}
                      onSelect={() => handleSelect(shade)}
                      onToggleFav={(e) => handleToggleFav(e, shade.id)}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat list (filtered by family or search) */
        <div className="overflow-x-auto no-scrollbar">
          {visibleShades.length === 0 ? (
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 11,
              color: "var(--color-ink-light)", padding: "8px 2px",
            }}>No shades match "{search}"</p>
          ) : (
            <div style={{ display: "flex", gap: 8, paddingBottom: 6, paddingLeft: 2, paddingRight: 2, paddingTop: 2, width: "max-content", alignItems: "flex-end" }}>
              {visibleShades.map((shade, i) => (
                <SwatchButton
                  key={shade.id}
                  shade={shade}
                  isActive={activeShadeId === shade.id}
                  isFav={favIds.includes(shade.id)}
                  onSelect={() => handleSelect(shade)}
                  onToggleFav={(e) => handleToggleFav(e, shade.id)}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
