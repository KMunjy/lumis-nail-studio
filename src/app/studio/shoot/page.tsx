"use client";

/**
 * NailShoot Studio — /studio/shoot  v2.0
 *
 * Improvements vs v1:
 *   F1-A — Quality selector (High / Standard / Lite) before generate
 *   F1-C — Live shade preview strip (3 mini thumbnails) on shade step
 *   F1-D — Save-to-NailCard button in export step (writes to lumis_saved_looks_local)
 *   F1-E — Fitzpatrick skin-tone selector (6 dots) on upload step
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Camera, ArrowRight, ArrowLeft,
  Download, Share2, Check, Loader2, Bookmark, BookmarkCheck,
} from "lucide-react";
import Link from "next/link";
import { products } from "@/data/products";
import type { Product } from "@/data/products";
import {
  generateCompositions,
  generateMiniPreviews,
  type Composition,
  type QualityLevel,
} from "@/lib/composition-engine";
import { downloadBlob, shareBlob } from "@/lib/export-canvas";
import type { NailFinish } from "@/types";

type Step = "upload" | "shade" | "generate" | "export";

const STEP_ORDER: Step[] = ["upload", "shade", "generate", "export"];
const STEP_LABELS: Record<Step, string> = {
  upload:   "Upload",
  shade:    "Shade",
  generate: "Generating",
  export:   "Your Shots",
};

const ALL_FINISHES: NailFinish[] = [
  "Gloss", "Matte", "Metallic", "Chrome", "Jelly", "Glitter", "CatEye",
];

// F1-E — Fitzpatrick scale (6 tones)
const FITZPATRICK_TONES = [
  { hex: "#FDDBB4", label: "Type I–II" },
  { hex: "#EEC68A", label: "Type III" },
  { hex: "#D4956A", label: "Type IV" },
  { hex: "#A0624A", label: "Type V" },
  { hex: "#6E3B2A", label: "Type VI" },
  { hex: "#3D1F10", label: "Type VI+" },
];

// F1-A — Quality tiers
const QUALITY_OPTIONS: { key: QualityLevel; label: string; sub: string }[] = [
  { key: "high",     label: "High",     sub: "1080px · ~180KB" },
  { key: "standard", label: "Standard", sub: "720px · ~90KB" },
  { key: "lite",     label: "Lite",     sub: "480px · ~40KB" },
];

export default function NailShootStudio() {
  const [step, setStep]                         = useState<Step>("upload");
  const [imageDataUrl, setImageDataUrl]         = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct]   = useState<Product | null>(null);
  const [compositions, setCompositions]         = useState<Composition[]>([]);
  const [generating, setGenerating]             = useState(false);
  const [progress, setProgress]                 = useState(0);
  const [selectedComp, setSelectedComp]         = useState<Composition | null>(null);
  const [sharing, setSharing]                   = useState(false);
  const [finishFilter, setFinishFilter]         = useState<NailFinish | "All">("All");
  // F1-A
  const [quality, setQuality]                   = useState<QualityLevel>("high");
  // F1-C
  const [miniPreviews, setMiniPreviews]         = useState<Array<{ style: string; label: string; dataUrl: string }>>([]);
  const [miniLoading, setMiniLoading]           = useState(false);
  const miniCache                               = useRef<Record<string, typeof miniPreviews>>({});
  // F1-D
  const [saved, setSaved]                       = useState(false);
  // F1-E
  const [skinToneHex, setSkinToneHex]           = useState<string | undefined>(undefined);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageDataUrl(e.target?.result as string);
      setStep("shade");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleFile(file);
    },
    [handleFile],
  );

  // F1-C — generate mini previews when a product is selected
  useEffect(() => {
    if (!imageDataUrl || !selectedProduct) { setMiniPreviews([]); return; }
    const cacheKey = `${selectedProduct.id}`;
    if (miniCache.current[cacheKey]) {
      setMiniPreviews(miniCache.current[cacheKey]);
      return;
    }
    let cancelled = false;
    setMiniLoading(true);
    generateMiniPreviews(imageDataUrl, selectedProduct)
      .then((previews) => {
        if (cancelled) return;
        miniCache.current[cacheKey] = previews;
        setMiniPreviews(previews);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setMiniLoading(false); });
    return () => { cancelled = true; };
  }, [imageDataUrl, selectedProduct]);

  const handleGenerate = async () => {
    if (!imageDataUrl || !selectedProduct) return;
    setGenerating(true);
    setStep("generate");
    setProgress(0);
    setSaved(false);

    try {
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90));
      }, 380);

      const comps = await generateCompositions(imageDataUrl, selectedProduct, quality, skinToneHex);
      clearInterval(interval);
      setProgress(100);
      setCompositions(comps);
      setSelectedComp(comps[0] ?? null);
      setTimeout(() => setStep("export"), 300);
    } catch (err) {
      console.error("[NailShoot] Generation failed:", err);
      setStep("shade");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    for (const comp of compositions) {
      downloadBlob(
        comp.blob,
        `LUMIS-${selectedProduct?.name ?? "nail"}-${comp.label}.jpg`,
      );
      await new Promise((r) => setTimeout(r, 160));
    }
  };

  const handleShare = async (comp: Composition) => {
    setSharing(true);
    try {
      await shareBlob(
        comp.blob,
        `LUMIS-${selectedProduct?.name ?? "nail"}-${comp.label}.jpg`,
        `${selectedProduct?.name} by LUMIS`,
        `Try ${selectedProduct?.name} at lumis.app`,
      );
    } catch { /* user cancelled */ }
    setSharing(false);
  };

  // F1-D — Save selected composition to NailCard profile
  const handleSaveToProfile = () => {
    if (!selectedComp || !selectedProduct) return;
    // Use the same userId key as the rest of the app (demo-user fallback)
    const userId = localStorage.getItem("lumis_demo_user_id") ?? "demo-user";
    const storageKey = `lumis_saved_looks_${userId}`;
    const existing: object[] = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    // Conform to the SavedLook interface so /account/looks renders correctly
    const newLook = {
      id: `${Date.now()}`,
      userId,
      productId:   selectedProduct.id,
      productName: selectedProduct.name,
      imageUrl:    selectedComp.dataUrl, // data URL stored directly
      shape:       "Almond",
      finish:      selectedProduct.finish,
      style: {
        finish:      selectedProduct.finish,
        topColor:    selectedProduct.topColor,
        midColor:    selectedProduct.midColor,
        bottomColor: selectedProduct.bottomColor,
        compositionStyle: selectedComp.style,
      },
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey, JSON.stringify([newLook, ...existing].slice(0, 50)));
    setSaved(true);
  };

  const filteredProducts =
    finishFilter === "All"
      ? products
      : products.filter((p) => p.finish === finishFilter);

  const stepIdx = STEP_ORDER.indexOf(step);

  // ─── Pill button helper ────────────────────────────────────────────────────
  const pillBtn = (
    onClick: () => void,
    label: React.ReactNode,
    primary: boolean,
    disabled = false,
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: "14px 0", borderRadius: 10,
        border: primary ? "none" : "1px solid var(--color-border-light)",
        backgroundColor: disabled
          ? "var(--color-border-light)"
          : primary ? "var(--color-pink)" : "#FFFFFF",
        color: disabled
          ? "var(--color-ink-light)"
          : primary ? "#FFFFFF" : "var(--color-ink)",
        fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "background-color 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA" }}>
      {/* ── Sticky header ── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 14,
          }}>
            <div>
              <h1 style={{
                fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700,
                color: "var(--color-ink)", letterSpacing: "-0.01em",
                margin: 0,
              }}>NailShoot Studio</h1>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 12,
                color: "var(--color-ink-light)", margin: "2px 0 0",
              }}>Generate 12 professional nail portraits</p>
            </div>
            <Link href="/" style={{
              textDecoration: "none", fontSize: 13,
              color: "var(--color-ink-light)",
            }}>← Back</Link>
          </div>

          {/* Step progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {(["upload", "shade", "export"] as const).map((s, i) => {
              const sIdx   = STEP_ORDER.indexOf(s);
              const done   = stepIdx > sIdx;
              const active = stepIdx === sIdx || (step === "generate" && s === "export" && i === 2);
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: done || active ? "var(--color-pink)" : "var(--color-border-light)",
                      color: done || active ? "#FFFFFF" : "var(--color-ink-light)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, transition: "background-color 0.2s",
                    }}>
                      {done ? <Check size={10} /> : i + 1}
                    </div>
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
                      color: active ? "var(--color-ink)" : "var(--color-ink-light)",
                      whiteSpace: "nowrap",
                    }}>{STEP_LABELS[s]}</span>
                  </div>
                  {i < 2 && (
                    <div style={{
                      flex: 1, height: 1, margin: "0 8px",
                      backgroundColor: done ? "var(--color-pink)" : "var(--color-border-light)",
                      transition: "background-color 0.2s",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 120px" }}>
        <AnimatePresence mode="wait">

          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed var(--color-border)",
                  borderRadius: 16, padding: "56px 32px",
                  textAlign: "center", cursor: "pointer",
                  backgroundColor: "#FFFFFF",
                  transition: "border-color 0.18s, background-color 0.18s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-pink)";
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#FFF5F8";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#FFFFFF";
                }}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  backgroundColor: "#FFF0F5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}>
                  <Upload size={28} style={{ color: "var(--color-pink)" }} />
                </div>
                <h2 style={{
                  fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 600,
                  color: "var(--color-ink)", margin: "0 0 10px",
                }}>Upload Your Nail Photo</h2>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 13,
                  color: "var(--color-ink-light)",
                  margin: "0 0 28px", lineHeight: 1.55,
                }}>
                  Drag & drop or tap to choose. JPG, PNG or WebP.<br />
                  Best: close-up on a neutral or white background.
                </p>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                  padding: "11px 24px", borderRadius: 40,
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                  pointerEvents: "none",
                }}>
                  <Camera size={15} />
                  Choose Photo
                </div>
              </div>

              {/* ── F1-E: Fitzpatrick skin-tone selector ── */}
              <div style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--color-border-light)",
                borderRadius: 14, padding: "16px 18px",
                marginTop: 16,
              }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                  color: "var(--color-ink)", margin: "0 0 4px",
                }}>Skin tone (optional)</p>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "var(--color-ink-light)", margin: "0 0 12px",
                }}>
                  Helps the branding panel match your complexion.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {FITZPATRICK_TONES.map((tone) => (
                    <button
                      key={tone.hex}
                      title={tone.label}
                      onClick={() => setSkinToneHex(skinToneHex === tone.hex ? undefined : tone.hex)}
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        backgroundColor: tone.hex,
                        border: skinToneHex === tone.hex
                          ? "3px solid var(--color-pink)"
                          : "3px solid transparent",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                        cursor: "pointer",
                        outline: skinToneHex === tone.hex ? "2px solid #FFFFFF" : "none",
                        outlineOffset: "-5px",
                        transition: "border-color 0.14s",
                      }}
                    />
                  ))}
                  {skinToneHex && (
                    <button
                      onClick={() => setSkinToneHex(undefined)}
                      style={{
                        padding: "0 12px", borderRadius: 20, height: 36,
                        border: "1px solid var(--color-border-light)",
                        backgroundColor: "#FAFAFA",
                        fontFamily: "var(--font-sans)", fontSize: 11,
                        color: "var(--color-ink-light)", cursor: "pointer",
                      }}
                    >Clear</button>
                  )}
                </div>
              </div>

              {/* ── F1-A: Quality selector ── */}
              <div style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--color-border-light)",
                borderRadius: 14, padding: "16px 18px",
                marginTop: 12,
              }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                  color: "var(--color-ink)", margin: "0 0 12px",
                }}>Export quality</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.key}
                      onClick={() => setQuality(q.key)}
                      style={{
                        flex: 1, padding: "10px 6px",
                        borderRadius: 10,
                        border: quality === q.key
                          ? "2px solid var(--color-pink)"
                          : "2px solid var(--color-border-light)",
                        backgroundColor: quality === q.key ? "#FFF0F5" : "#FFFFFF",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.14s",
                      }}
                    >
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                        color: quality === q.key ? "var(--color-pink)" : "var(--color-ink)",
                        margin: "0 0 2px",
                      }}>{q.label}</p>
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 10,
                        color: "var(--color-ink-light)", margin: 0,
                      }}>{q.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <p style={{
                textAlign: "center", marginTop: 18,
                fontFamily: "var(--font-sans)", fontSize: 11,
                color: "var(--color-ink-light)",
              }}>
                Photos stay on your device — nothing is uploaded to any server.
              </p>
            </motion.div>
          )}

          {/* ── Step 2: Shade selection ── */}
          {step === "shade" && (
            <motion.div
              key="shade"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
            >
              {/* Thumbnail of uploaded photo */}
              {imageDataUrl && (
                <div style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12, overflow: "hidden",
                  marginBottom: 20,
                  border: "1px solid var(--color-border-light)",
                }}>
                  <div style={{ position: "relative", paddingBottom: "38%", backgroundColor: "#F0EEF2" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageDataUrl}
                      alt="Uploaded nail photo"
                      style={{
                        position: "absolute", inset: 0,
                        width: "100%", height: "100%", objectFit: "cover",
                      }}
                    />
                    <div style={{
                      position: "absolute", bottom: 10, right: 10,
                      backgroundColor: "rgba(255,255,255,0.92)",
                      borderRadius: 6, padding: "3px 10px",
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
                      color: "var(--color-ink)",
                    }}>
                      ✓ Photo ready
                    </div>
                  </div>
                </div>
              )}

              {/* Finish filter pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {(["All", ...ALL_FINISHES] as Array<NailFinish | "All">).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFinishFilter(f)}
                    style={{
                      padding: "4px 12px", borderRadius: 20,
                      border: `1px solid ${finishFilter === f ? "var(--color-pink)" : "var(--color-border-light)"}`,
                      backgroundColor: finishFilter === f ? "var(--color-pink)" : "#FFFFFF",
                      color: finishFilter === f ? "#FFFFFF" : "var(--color-ink-mid)",
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
                      cursor: "pointer", transition: "all 0.12s",
                    }}
                  >{f}</button>
                ))}
              </div>

              {/* Product grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 10, marginBottom: 20,
              }}>
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    style={{
                      border: `2px solid ${selectedProduct?.id === product.id ? "var(--color-pink)" : "transparent"}`,
                      borderRadius: 12, padding: 10,
                      backgroundColor: "#FFFFFF",
                      cursor: "pointer", textAlign: "left",
                      boxShadow: selectedProduct?.id === product.id
                        ? "0 0 0 1px var(--color-pink)"
                        : "0 1px 4px rgba(0,0,0,0.07)",
                      transition: "all 0.14s",
                    }}
                  >
                    <div style={{
                      width: "100%", height: 56, borderRadius: 7, marginBottom: 7,
                      background: `linear-gradient(135deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`,
                    }} />
                    <p style={{
                      fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                      color: "var(--color-ink)", margin: "0 0 2px",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{product.name}</p>
                    <p style={{
                      fontFamily: "var(--font-sans)", fontSize: 10,
                      color: "var(--color-ink-light)", margin: 0,
                    }}>{product.finish}</p>
                  </button>
                ))}
              </div>

              {/* ── F1-C: Live shade preview strip ── */}
              <AnimatePresence>
                {selectedProduct && (
                  <motion.div
                    key="mini-strip"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden", marginBottom: 20 }}
                  >
                    <div style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid var(--color-border-light)",
                      borderRadius: 14, padding: "14px 16px",
                    }}>
                      <p style={{
                        fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
                        color: "var(--color-ink-light)", margin: "0 0 10px",
                        letterSpacing: "0.05em", textTransform: "uppercase",
                      }}>Preview — {selectedProduct.name}</p>
                      {miniLoading ? (
                        <div style={{
                          display: "flex", gap: 10, alignItems: "center",
                          color: "var(--color-ink-light)",
                        }}>
                          <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-pink)" }} />
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12 }}>
                            Rendering previews…
                          </span>
                        </div>
                      ) : miniPreviews.length > 0 ? (
                        <div style={{ display: "flex", gap: 10 }}>
                          {miniPreviews.map((prev) => (
                            <div key={prev.style} style={{ flex: 1 }}>
                              <div style={{
                                borderRadius: 8, overflow: "hidden",
                                border: "1px solid var(--color-border-light)",
                                marginBottom: 4,
                              }}>
                                <div style={{ position: "relative", paddingBottom: "100%" }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={prev.dataUrl}
                                    alt={prev.label}
                                    style={{
                                      position: "absolute", inset: 0,
                                      width: "100%", height: "100%", objectFit: "cover",
                                    }}
                                  />
                                </div>
                              </div>
                              <p style={{
                                fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 500,
                                color: "var(--color-ink-light)", margin: 0,
                                textAlign: "center", textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}>{prev.label}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quality reminder badge */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 16,
                padding: "8px 12px", borderRadius: 8,
                backgroundColor: "#F8F8F8",
                border: "1px solid var(--color-border-light)",
              }}>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "var(--color-ink-light)",
                }}>
                  Quality: <strong style={{ color: "var(--color-ink)" }}>{
                    QUALITY_OPTIONS.find(q => q.key === quality)?.label
                  }</strong>
                  {" "}· {QUALITY_OPTIONS.find(q => q.key === quality)?.sub}
                  {skinToneHex && (
                    <>
                      {" "}·{" "}
                      <span style={{
                        display: "inline-block", width: 12, height: 12,
                        borderRadius: "50%", backgroundColor: skinToneHex,
                        verticalAlign: "middle", marginRight: 3,
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
                      }} />
                      Tone matched
                    </>
                  )}
                </span>
                <button
                  onClick={() => setStep("upload")}
                  style={{
                    marginLeft: "auto", border: "none", background: "none",
                    fontFamily: "var(--font-sans)", fontSize: 11,
                    color: "var(--color-pink)", cursor: "pointer", fontWeight: 600,
                  }}
                >Edit</button>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                {pillBtn(
                  () => { setStep("upload"); setImageDataUrl(null); },
                  <><ArrowLeft size={14} /> Back</>,
                  false,
                )}
                {pillBtn(
                  handleGenerate,
                  <><Camera size={14} /> Generate {quality === "high" ? "12" : "12"} Shots <ArrowRight size={14} /></>,
                  true,
                  !selectedProduct,
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Generating ── */}
          {step === "generate" && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: "center", padding: "80px 32px" }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                backgroundColor: "#FFF0F5",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
              }}>
                <Loader2
                  size={36}
                  className="animate-spin"
                  style={{ color: "var(--color-pink)" }}
                />
              </div>
              <h2 style={{
                fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600,
                color: "var(--color-ink)", margin: "0 0 8px",
              }}>Creating Your Portraits</h2>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 13,
                color: "var(--color-ink-light)", margin: "0 0 32px",
              }}>
                Compositing 12 professional backdrops…
              </p>
              <div style={{
                width: "100%", height: 6, borderRadius: 3,
                backgroundColor: "var(--color-border-light)", overflow: "hidden",
              }}>
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  style={{
                    height: "100%", borderRadius: 3,
                    backgroundColor: "var(--color-pink)",
                  }}
                />
              </div>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11,
                color: "var(--color-ink-light)", marginTop: 8,
              }}>{progress}%</p>
            </motion.div>
          )}

          {/* ── Step 4: Export ── */}
          {step === "export" && compositions.length > 0 && (
            <motion.div
              key="export"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Main preview */}
              {selectedComp && (
                <div style={{
                  borderRadius: 16, overflow: "hidden",
                  marginBottom: 14,
                  border: "1px solid var(--color-border-light)",
                }}>
                  <div style={{ position: "relative", paddingBottom: "100%" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedComp.dataUrl}
                      alt={selectedComp.label}
                      style={{
                        position: "absolute", inset: 0,
                        width: "100%", height: "100%", objectFit: "cover",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Composition label */}
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                color: "var(--color-ink)", textAlign: "center", margin: "0 0 12px",
                letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                {selectedComp?.label}
              </p>

              {/* Thumbnail strip — all 12 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 5, marginBottom: 8,
              }}>
                {compositions.slice(0, 6).map((comp) => (
                  <button
                    key={comp.style}
                    onClick={() => setSelectedComp(comp)}
                    style={{
                      border: `2px solid ${selectedComp?.style === comp.style ? "var(--color-pink)" : "transparent"}`,
                      borderRadius: 8, padding: 0, overflow: "hidden",
                      cursor: "pointer", background: "none",
                      transition: "border-color 0.14s",
                    }}
                    title={comp.label}
                  >
                    <div style={{ position: "relative", paddingBottom: "100%" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={comp.dataUrl} alt={comp.label} style={{
                        position: "absolute", inset: 0,
                        width: "100%", height: "100%", objectFit: "cover",
                      }} />
                    </div>
                  </button>
                ))}
              </div>
              {compositions.length > 6 && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 5, marginBottom: 20,
                }}>
                  {compositions.slice(6).map((comp) => (
                    <button
                      key={comp.style}
                      onClick={() => setSelectedComp(comp)}
                      style={{
                        border: `2px solid ${selectedComp?.style === comp.style ? "var(--color-pink)" : "transparent"}`,
                        borderRadius: 8, padding: 0, overflow: "hidden",
                        cursor: "pointer", background: "none",
                        transition: "border-color 0.14s",
                      }}
                      title={comp.label}
                    >
                      <div style={{ position: "relative", paddingBottom: "100%" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={comp.dataUrl} alt={comp.label} style={{
                          position: "absolute", inset: 0,
                          width: "100%", height: "100%", objectFit: "cover",
                        }} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Primary actions */}
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                {pillBtn(
                  () => selectedComp && handleShare(selectedComp),
                  <><Share2 size={15} />{sharing ? "Sharing…" : "Share This"}</>,
                  true,
                  sharing,
                )}
                {pillBtn(
                  () =>
                    selectedComp &&
                    downloadBlob(
                      selectedComp.blob,
                      `LUMIS-${selectedProduct?.name ?? "nail"}-${selectedComp.label}.jpg`,
                    ),
                  <><Download size={15} /> Download</>,
                  false,
                )}
              </div>

              {/* F1-D — Save to NailCard profile */}
              <button
                onClick={saved ? undefined : handleSaveToProfile}
                disabled={saved}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 10,
                  border: saved
                    ? "2px solid #22C55E"
                    : "2px solid var(--color-pink)",
                  backgroundColor: saved ? "#F0FDF4" : "#FFF0F5",
                  color: saved ? "#16A34A" : "var(--color-pink)",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
                  cursor: saved ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  marginBottom: 10,
                  transition: "all 0.2s",
                }}
              >
                {saved
                  ? <><BookmarkCheck size={16} /> Saved to Your NailCard</>
                  : <><Bookmark size={16} /> Save to NailCard Profile</>
                }
              </button>

              {/* Download all */}
              <button
                onClick={handleDownloadAll}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10,
                  border: "1px solid var(--color-border-light)",
                  backgroundColor: "#FFFFFF",
                  color: "var(--color-ink-mid)",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", marginBottom: 20,
                }}
              >
                Download All {compositions.length} Shots
              </button>

              {/* Navigation */}
              <div style={{ display: "flex", gap: 10 }}>
                {pillBtn(
                  () => { setStep("shade"); setCompositions([]); setSaved(false); },
                  "← Change Shade",
                  false,
                )}
                {pillBtn(
                  () => {
                    setStep("upload");
                    setImageDataUrl(null);
                    setCompositions([]);
                    setSelectedProduct(null);
                    setSelectedComp(null);
                    setMiniPreviews([]);
                    setSaved(false);
                  },
                  "New Shoot",
                  false,
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
