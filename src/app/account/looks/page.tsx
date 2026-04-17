"use client";

/**
 * /account/looks — Saved Looks gallery  v2.0
 *
 * v2.0 additions (Batch 3):
 *  [F8-1] localStorage key disconnect fixed — reads via getUserLooks() which
 *          uses lumis_saved_looks_${userId}, matching saveLook() in studio
 *  [F8-2] Date grouping — Today / This Week / Earlier section headers
 *  [F8-3] Add to Bag — each look card has a direct "Add to Bag" CTA
 *  [F8-4] Bulk select + delete — toggle select mode, checkbox per card, bulk trash
 *  [F8-5] Sort control — newest / oldest / by product name
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, ShoppingBag, CheckSquare, Square, SlidersHorizontal, Eye, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ShareSheet } from "@/components/ShareSheet";
import { LookShareCard } from "@/components/LookShareCard";
import { getUserLooks, deleteLook, type SavedLook } from "@/lib/saved-looks";
import { useTryOn } from "@/store/try-on-context";

// ─── Date grouping helpers ─────────────────────────────────────────────────────

function getDateGroup(iso: string): "Today" | "This Week" | "Earlier" {
  const d    = new Date(iso);
  const now  = new Date();
  const diffMs  = now.getTime() - d.getTime();
  const diffDay = diffMs / (1000 * 60 * 60 * 24);
  if (diffDay < 1)  return "Today";
  if (diffDay < 7)  return "This Week";
  return "Earlier";
}

type SortKey = "newest" | "oldest" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name:   "Product A–Z",
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LooksPage() {
  const { addToCart } = useTryOn();

  const [looks,        setLooks]        = useState<SavedLook[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [shareFor,     setShareFor]     = useState<SavedLook | null>(null);
  // [Batch 4 F1] Share a Look — branded card export
  const [shareCardFor, setShareCardFor] = useState<SavedLook | null>(null);

  // [F8-4] Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());

  // [F8-5] Sort
  const [sortKey,    setSortKey]    = useState<SortKey>("newest");
  const [sortOpen,   setSortOpen]   = useState(false);

  const userId = typeof window !== "undefined"
    ? (localStorage.getItem("lumis_demo_user_id") ?? "demo-user")
    : "demo-user";

  useEffect(() => {
    let cancelled = false;
    getUserLooks(userId).then((l) => {
      if (!cancelled) { setLooks(l); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const handleDelete = useCallback(async (look: SavedLook) => {
    await deleteLook(look.id, userId);
    setLooks((prev) => prev.filter((l) => l.id !== look.id));
    setSelected((prev) => { const s = new Set(prev); s.delete(look.id); return s; });
  }, [userId]);

  // [F8-4] Bulk delete
  const handleBulkDelete = useCallback(async () => {
    await Promise.all([...selected].map((id) => {
      const look = looks.find((l) => l.id === id);
      return look ? deleteLook(look.id, userId) : Promise.resolve();
    }));
    setLooks((prev) => prev.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
    setSelectMode(false);
  }, [selected, looks, userId]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // [F8-5] Sorted looks
  const sortedLooks = useMemo(() => {
    const copy = [...looks];
    if (sortKey === "newest") return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sortKey === "oldest") return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return copy.sort((a, b) => a.productName.localeCompare(b.productName));
  }, [looks, sortKey]);

  // [F8-2] Grouped by date
  const grouped = useMemo(() => {
    const groups: Record<string, SavedLook[]> = { "Today": [], "This Week": [], "Earlier": [] };
    sortedLooks.forEach((l) => groups[getDateGroup(l.createdAt)].push(l));
    return (["Today", "This Week", "Earlier"] as const).filter((g) => groups[g].length > 0).map((g) => ({ label: g, items: groups[g] }));
  }, [sortedLooks]);

  return (
    <div style={{ backgroundColor: "#FAFAFA", minHeight: "100dvh", paddingBottom: 40 }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{
            width: 34, height: 34, borderRadius: 6,
            border: "1px solid var(--color-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-ink)", textDecoration: "none",
            backgroundColor: "#FFFFFF",
          }}>
            <ArrowLeft size={14} />
          </Link>

          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-pink)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Your Collection
            </p>
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "var(--color-ink)", lineHeight: 1.2 }}>
              Saved Looks
              {looks.length > 0 && (
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-ink-light)", marginLeft: 8 }}>
                  {looks.length}
                </span>
              )}
            </h1>
          </div>

          {/* [F8-5] Sort button */}
          {looks.length > 1 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setSortOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "#FFFFFF",
                  fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-ink-mid)",
                  cursor: "pointer",
                }}
              >
                <SlidersHorizontal size={11} />
                {SORT_LABELS[sortKey].split(" ")[0]}
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: "absolute", top: "calc(100% + 6px)", right: 0,
                      backgroundColor: "#FFFFFF",
                      border: "1px solid var(--color-border-light)",
                      borderRadius: 8, overflow: "hidden",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
                      zIndex: 20, minWidth: 140,
                    }}
                  >
                    {(["newest","oldest","name"] as SortKey[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => { setSortKey(k); setSortOpen(false); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "10px 14px",
                          fontFamily: "var(--font-sans)", fontSize: 12,
                          color: sortKey === k ? "var(--color-pink)" : "var(--color-ink)",
                          fontWeight: sortKey === k ? 600 : 400,
                          background: "none", border: "none", cursor: "pointer",
                          borderBottom: k !== "name" ? "1px solid var(--color-border-light)" : "none",
                          backgroundColor: sortKey === k ? "var(--color-pink-pale)" : "transparent",
                        }}
                      >
                        {SORT_LABELS[k]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* [F8-4] Select / bulk delete toggle */}
          {looks.length > 0 && (
            selectMode ? (
              <div style={{ display: "flex", gap: 6 }}>
                {selected.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 10px", borderRadius: 6,
                      backgroundColor: "#FEE2E2", border: "1px solid #FECACA",
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                      color: "#DC2626", cursor: "pointer",
                    }}
                  >
                    <Trash2 size={11} /> Delete {selected.size}
                  </button>
                )}
                <button
                  onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                  style={{
                    padding: "6px 10px", borderRadius: 6,
                    border: "1px solid var(--color-border)",
                    backgroundColor: "#FFFFFF",
                    fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-ink-mid)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 10px", borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  backgroundColor: "#FFFFFF",
                  fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-ink-mid)",
                  cursor: "pointer",
                }}
              >
                <CheckSquare size={11} /> Select
              </button>
            )
          )}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-light)", letterSpacing: "0.08em" }}>
              Loading your looks…
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && looks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: "80px 24px" }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              backgroundColor: "var(--color-pink-pale)",
              border: "1px solid var(--color-pink-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <Eye size={28} style={{ color: "var(--color-pink)" }} strokeWidth={1.5} />
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700, color: "var(--color-ink)", marginBottom: 10 }}>
              No looks saved yet
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink-light)", lineHeight: 1.6, marginBottom: 28, maxWidth: 280, margin: "0 auto 28px" }}>
              Capture your try-on in the studio and your looks will appear here automatically.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 24px", borderRadius: 8,
                backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Browse shades
            </Link>
          </motion.div>
        )}

        {/* [F8-2] Date-grouped grid */}
        {!loading && looks.length > 0 && (
          <div>
            {grouped.map(({ label, items }) => (
              <div key={label} style={{ marginBottom: 24 }}>
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                    color: "var(--color-ink-light)", letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}>{label}</p>
                  <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border-light)" }} />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-ink-light)" }}>
                    {items.length}
                  </span>
                </div>

                {/* Two-column card grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  <AnimatePresence>
                    {items.map((look, i) => {
                      const isSelected = selected.has(look.id);
                      return (
                        <motion.div
                          key={look.id}
                          initial={{ opacity: 0, scale: 0.94 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.90 }}
                          transition={{ delay: i * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderRadius: 8, overflow: "hidden",
                            border: isSelected
                              ? "2px solid var(--color-pink)"
                              : "1px solid var(--color-border-light)",
                            boxShadow: isSelected
                              ? "0 0 0 3px var(--color-pink-pale)"
                              : "0 1px 8px rgba(0,0,0,0.06)",
                            transition: "border-color 0.15s, box-shadow 0.15s",
                          }}
                        >
                          {/* Image area */}
                          <div
                            style={{ position: "relative", paddingBottom: "133.3%", cursor: selectMode ? "pointer" : "default" }}
                            onClick={selectMode ? () => toggleSelect(look.id) : undefined}
                          >
                            {/* Gradient placeholder — shown when imageUrl is absent or broken */}
                            <div style={{
                              position: "absolute", inset: 0,
                              background: `linear-gradient(135deg, ${(look.style as Record<string,string>)?.topColor ?? "#C084FC"} 0%, ${(look.style as Record<string,string>)?.bottomColor ?? "#F43F78"} 100%)`,
                            }} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {look.imageUrl ? (
                              <img
                                src={look.imageUrl}
                                alt={look.productName}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : null}

                            {/* [F8-4] Select checkbox */}
                            {selectMode && (
                              <button
                                onClick={() => toggleSelect(look.id)}
                                style={{
                                  position: "absolute", top: 8, left: 8,
                                  background: "none", border: "none", cursor: "pointer",
                                  color: isSelected ? "var(--color-pink)" : "rgba(255,255,255,0.85)",
                                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                                }}
                              >
                                {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                              </button>
                            )}

                            {/* Delete button (non-select mode) */}
                            {!selectMode && (
                              <button
                                onClick={() => handleDelete(look)}
                                aria-label={`Delete ${look.productName} look`}
                                style={{
                                  position: "absolute", top: 8, right: 8,
                                  width: 28, height: 28, borderRadius: "50%",
                                  backgroundColor: "rgba(0,0,0,0.45)",
                                  border: "none", color: "#FFFFFF",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer", backdropFilter: "blur(4px)",
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}

                            {/* Date stamp */}
                            <div style={{
                              position: "absolute", bottom: 8, left: 8,
                              backgroundColor: "rgba(0,0,0,0.40)",
                              borderRadius: 4, padding: "2px 6px",
                              backdropFilter: "blur(4px)",
                            }}>
                              <p style={{ fontFamily: "var(--font-sans)", fontSize: 8, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                                {new Date(look.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                          </div>

                          {/* Card info */}
                          <div style={{ padding: "10px 10px 12px" }}>
                            <p style={{
                              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                              color: "var(--color-ink)", marginBottom: 2,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {look.productName}
                            </p>
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-ink-light)", marginBottom: 10 }}>
                              {look.shape} · {look.finish}
                            </p>

                            {!selectMode && (
                              <div style={{ display: "flex", gap: 6 }}>
                                {/* Re-try in studio */}
                                <Link
                                  href={`/studio/${look.productId}`}
                                  style={{
                                    flex: 1, height: 30, borderRadius: 6,
                                    border: "1px solid var(--color-border)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
                                    color: "var(--color-ink)", textDecoration: "none",
                                    gap: 4,
                                  }}
                                >
                                  <Eye size={10} /> Try on
                                </Link>

                                {/* [F8-3] Add to Bag */}
                                <button
                                  onClick={() => addToCart(look.productId)}
                                  style={{
                                    flex: 1, height: 30, borderRadius: 6,
                                    backgroundColor: "var(--color-pink)", border: "none",
                                    fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                                    color: "#FFFFFF", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                  }}
                                >
                                  <ShoppingBag size={10} /> Add
                                </button>

                                {/* [Batch 4 F1] Share card */}
                                <button
                                  onClick={() => setShareCardFor(look)}
                                  aria-label={`Share ${look.productName} look`}
                                  style={{
                                    width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                                    border: "1px solid var(--color-border)",
                                    background: "none", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: "var(--color-ink-light)",
                                  }}
                                >
                                  <Share2 size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share sheet (URL share) */}
      {shareFor && (
        <ShareSheet
          open={Boolean(shareFor)}
          onClose={() => setShareFor(null)}
          productId={shareFor.productId}
          productName={shareFor.productName}
          capturedImageDataUrl={shareFor.imageUrl?.startsWith("data:") ? shareFor.imageUrl : undefined}
        />
      )}

      {/* [Batch 4 F1] Share a Look — branded card export */}
      {shareCardFor && (
        <LookShareCard
          look={shareCardFor}
          onDone={() => setShareCardFor(null)}
        />
      )}
    </div>
  );
}
