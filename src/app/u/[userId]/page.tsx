"use client";

/**
 * NailCard — /u/[userId]  v2.0
 *
 * Improvements vs v1:
 *   F4-B — Bio + social handles (lumis_card_bio_{userId}), editable by owner
 *   F4-C — QR code generator (qrcode npm, browser canvas, download PNG)
 *   F4-D — Pinned Look of the Week (most recent look as full-width hero)
 *   F4-E — Verified Creator badge (10+ looks or 3+ boards)
 */

import { useState, useEffect, useRef, use } from "react";
import { motion } from "framer-motion";
import {
  Share2, ExternalLink, Sparkles, Check,
  Link2, QrCode, Download, Edit3, BadgeCheck,
} from "lucide-react";
import Link from "next/link";
import { products } from "@/data/products";
import { computeNailDNA, type NailDNAProfile } from "@/lib/nail-dna";
import { shareBlob, canvasToBlob, downloadBlob } from "@/lib/export-canvas";
import type { SavedLook } from "@/lib/saved-looks";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardBio {
  bio: string;
  instagram: string;
  tiktok: string;
}

// ─── F4-E — Verified Creator check ───────────────────────────────────────────

function isVerified(userId: string, looksCount: number): boolean {
  try {
    const flag = localStorage.getItem(`lumis_verified_${userId}`);
    if (flag === "true") return true;
    const boards: object[] = JSON.parse(localStorage.getItem("lumis_boards_local") ?? "[]");
    const verified = looksCount >= 10 || boards.length >= 3;
    if (verified) localStorage.setItem(`lumis_verified_${userId}`, "true");
    return verified;
  } catch {
    return looksCount >= 10;
  }
}

// ─── Share card renderer ───────────────────────────────────────────────────────

async function renderNailCard(
  userId: string,
  profile: NailDNAProfile,
  looks: SavedLook[],
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, profile.archetype.bgColor);
  bg.addColorStop(1, "#FFFFFF");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = profile.archetype.accentColor;
  ctx.fillRect(0, 0, W, 8);

  ctx.font = "700 36px sans-serif";
  ctx.fillStyle = "#F43F78";
  ctx.fillText("LUMIS", 72, 80);

  ctx.font = "600 52px sans-serif";
  ctx.fillStyle = "#1A1025";
  ctx.fillText(`@${userId}`, 72, 160);

  ctx.fillStyle = profile.archetype.accentColor + "22";
  roundRectPath(ctx, 72, 192, 380, 72, 16);
  ctx.fill();
  ctx.font = "500 30px sans-serif";
  ctx.fillStyle = profile.archetype.accentColor;
  ctx.fillText(`${profile.archetype.emoji} ${profile.archetype.name}`, 92, 238);

  const swatches = looks.slice(0, 6);
  const swatchW = (W - 144 - 5 * 12) / 6;
  for (let i = 0; i < swatches.length; i++) {
    const look = swatches[i];
    const p = products.find((pr) => pr.id === look.productId);
    if (!p) continue;
    const sx = 72 + i * (swatchW + 12);
    const sy = 308;
    const g = ctx.createLinearGradient(sx, sy, sx + swatchW, sy + swatchW);
    g.addColorStop(0, p.topColor);
    g.addColorStop(0.5, p.midColor);
    g.addColorStop(1, p.bottomColor);
    roundRectPath(ctx, sx, sy, swatchW, swatchW * 1.4, 12);
    ctx.fillStyle = g;
    ctx.fill();
  }

  ctx.font = "600 26px sans-serif";
  ctx.fillStyle = "rgba(26,16,37,0.45)";
  ctx.fillText(`${looks.length} looks  ·  ${profile.dominantFinish}  ·  ${profile.dominantShape}`, 72, 580);

  ctx.font = "400 28px sans-serif";
  ctx.fillStyle = "rgba(26,16,37,0.35)";
  ctx.textAlign = "center";
  ctx.fillText("Try any look at lumis.app", W / 2, H - 80);
  ctx.textAlign = "left";

  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ─── F4-B — Bio editor component ─────────────────────────────────────────────

function BioEditor({
  userId,
  isOwner,
  bio,
  onBioChange,
}: {
  userId: string;
  isOwner: boolean;
  bio: CardBio;
  onBioChange: (b: CardBio) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(bio);

  const save = () => {
    localStorage.setItem(`lumis_card_bio_${userId}`, JSON.stringify(draft));
    onBioChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ marginBottom: 16 }}>
        <textarea
          value={draft.bio}
          onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value.slice(0, 140) }))}
          placeholder="Write a short bio… (140 chars)"
          rows={3}
          style={{
            width: "100%", borderRadius: 10,
            border: "1px solid var(--color-pink)",
            padding: "10px 12px",
            fontFamily: "var(--font-sans)", fontSize: 13,
            color: "var(--color-ink)", resize: "none", outline: "none",
            boxSizing: "border-box",
          }}
        />
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-ink-light)", margin: "2px 0 10px", textAlign: "right" }}>
          {draft.bio.length}/140
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            value={draft.instagram}
            onChange={(e) => setDraft((d) => ({ ...d, instagram: e.target.value.replace(/^@/, "") }))}
            placeholder="Instagram handle (no @)"
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: "1px solid var(--color-border-light)",
              fontFamily: "var(--font-sans)", fontSize: 13, outline: "none",
            }}
          />
          <input
            type="text"
            value={draft.tiktok}
            onChange={(e) => setDraft((d) => ({ ...d, tiktok: e.target.value.replace(/^@/, "") }))}
            placeholder="TikTok handle (no @)"
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: "1px solid var(--color-border-light)",
              fontFamily: "var(--font-sans)", fontSize: 13, outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={{
            flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
            backgroundColor: "var(--color-pink)", color: "#FFFFFF",
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Check size={14} /> Save
          </button>
          <button onClick={() => { setDraft(bio); setEditing(false); }} style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            border: "1px solid var(--color-border-light)",
            backgroundColor: "#FFFFFF", color: "var(--color-ink)",
            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {bio.bio ? (
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.6,
          color: "rgba(26,16,37,0.68)", margin: "0 0 10px",
        }}>{bio.bio}</p>
      ) : isOwner ? (
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 12,
          color: "var(--color-ink-light)", margin: "0 0 10px",
          fontStyle: "italic",
        }}>Add a bio to personalise your card…</p>
      ) : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {bio.instagram && (
          <a
            href={`https://instagram.com/${bio.instagram}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
              color: "#E4405F", textDecoration: "none",
            }}
          >
            <Link2 size={13} />@{bio.instagram}
          </a>
        )}
        {bio.tiktok && (
          <a
            href={`https://tiktok.com/@${bio.tiktok}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
              color: "#000000", textDecoration: "none",
            }}
          >
            <span style={{ fontWeight: 900, fontSize: 12 }}>♪</span>@{bio.tiktok}
          </a>
        )}
        {isOwner && (
          <button onClick={() => setEditing(true)} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "4px 10px", borderRadius: 16,
            border: "1px solid var(--color-border-light)",
            backgroundColor: "#FAFAFA",
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
            color: "var(--color-ink-light)", cursor: "pointer",
          }}>
            <Edit3 size={11} />
            {bio.bio ? "Edit bio" : "Add bio"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── F4-C — QR code panel ─────────────────────────────────────────────────────

function QRPanel({ userId }: { userId: string }) {
  const [open, setOpen]   = useState(false);
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const qrUrl             = typeof window !== "undefined"
    ? `${window.location.origin}/u/${userId}`
    : `https://lumis.app/u/${userId}`;

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    import("qrcode").then(({ default: QRCode }) => {
      QRCode.toCanvas(canvasRef.current!, qrUrl, {
        width: 256, margin: 2,
        color: { dark: "#1A1025", light: "#FFFFFF" },
      });
    });
  }, [open, qrUrl]);

  const handleDownloadQR = async () => {
    const { default: QRCode } = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(qrUrl, { width: 512, margin: 3 });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `LUMIS-QR-${userId}.png`;
    link.click();
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 20,
          border: `1px solid ${open ? "var(--color-pink)" : "var(--color-border-light)"}`,
          backgroundColor: open ? "#FFF0F5" : "#FFFFFF",
          color: open ? "var(--color-pink)" : "var(--color-ink-mid)",
          fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
          cursor: "pointer", transition: "all 0.14s",
        }}
      >
        <QrCode size={13} />
        {open ? "Hide QR Code" : "Show QR Code"}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          style={{
            marginTop: 12, overflow: "hidden",
            backgroundColor: "#FFFFFF",
            borderRadius: 14, padding: 20,
            border: "1px solid var(--color-border-light)",
            textAlign: "center",
          }}
        >
          <p style={{
            fontFamily: "var(--font-sans)", fontSize: 12,
            color: "var(--color-ink-light)", margin: "0 0 14px",
          }}>
            Scan to view this NailCard · Salon display ready
          </p>
          <canvas
            ref={canvasRef}
            style={{ borderRadius: 8, maxWidth: 180, display: "block", margin: "0 auto 14px" }}
          />
          <button
            onClick={handleDownloadQR}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 20px", borderRadius: 20,
              border: "none",
              backgroundColor: "var(--color-pink)", color: "#FFFFFF",
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download size={13} />
            Download PNG
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NailCardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [looks, setLooks]       = useState<SavedLook[]>([]);
  const [profile, setProfile]   = useState<NailDNAProfile | null>(null);
  const [sharing, setSharing]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [bio, setBio]           = useState<CardBio>({ bio: "", instagram: "", tiktok: "" });
  const [verified, setVerified] = useState(false);
  const [isOwner]               = useState(true); // For localStorage context, always "local" owner

  useEffect(() => {
    try {
      // Collect all looks (standard + shoot-saved)
      const allLooks: SavedLook[] = [];

      // Standard saved looks
      const raw = localStorage.getItem(`lumis_saved_looks_${userId}`);
      if (raw) {
        try { allLooks.push(...(JSON.parse(raw) as SavedLook[])); } catch { /* skip */ }
      }

      // Shoot-page saved looks (lumis_saved_looks_local)
      if (userId !== "local") {
        const localRaw = localStorage.getItem("lumis_saved_looks_local");
        if (localRaw) {
          try { allLooks.push(...(JSON.parse(localRaw) as SavedLook[])); } catch { /* skip */ }
        }
      } else {
        // userId IS local — already read above
        const localRaw = localStorage.getItem("lumis_saved_looks_local");
        if (localRaw && !raw) {
          try { allLooks.push(...(JSON.parse(localRaw) as SavedLook[])); } catch { /* skip */ }
        }
      }

      // Deduplicate by id
      const seen = new Set<string>();
      const deduped = allLooks.filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });

      deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLooks(deduped);
      setProfile(computeNailDNA(deduped));
      setVerified(isVerified(userId, deduped.length));

      // F4-B — Load bio
      const bioRaw = localStorage.getItem(`lumis_card_bio_${userId}`);
      if (bioRaw) {
        try { setBio(JSON.parse(bioRaw) as CardBio); } catch { /* skip */ }
      }
    } catch {
      setProfile(computeNailDNA([]));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleShare = async () => {
    if (!profile) return;
    setSharing(true);
    try {
      const blob = await renderNailCard(userId, profile, looks);
      await shareBlob(blob, `LUMIS-NailCard-${userId}.jpg`, `${userId}'s Nail Portfolio on LUMIS`);
    } catch { /* cancelled */ }
    setSharing(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Sparkles className="animate-pulse" size={32} style={{ color: "var(--color-pink)" }} />
      </div>
    );
  }

  if (!profile) return null;

  const { archetype } = profile;
  const topShades = Array.from(new Set(looks.map((l) => l.productId)))
    .slice(0, 6)
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);

  // F4-D — Pinned "Look of the Week" = most recent saved look with a dataUrl
  const pinnedLook = looks.find((l) => (l.imageUrl?.startsWith("data:") || (l as unknown as { dataUrl?: string }).dataUrl));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA" }}>
      {/* Sticky header */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "14px 20px",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink)",
            }}>LUMIS</span>
          </Link>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 20,
              border: "none",
              backgroundColor: sharing ? "var(--color-border-light)" : "var(--color-pink)",
              color: "#FFFFFF",
              fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
              cursor: sharing ? "not-allowed" : "pointer",
            }}
          >
            <Share2 size={13} />
            {sharing ? "Sharing…" : "Share Profile"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 100px" }}>

        {/* ── F4-D: Pinned Look of the Week (hero) ── */}
        {pinnedLook && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              borderRadius: 16, overflow: "hidden",
              marginBottom: 16,
              border: "1px solid var(--color-border-light)",
              position: "relative",
            }}
          >
            <div style={{ position: "relative", paddingBottom: "56%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={(pinnedLook as unknown as { dataUrl?: string }).dataUrl ?? pinnedLook.imageUrl}
                alt={pinnedLook.productName}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%", objectFit: "cover",
                }}
              />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(transparent 40%, rgba(0,0,0,0.65))",
                display: "flex", alignItems: "flex-end", padding: "16px 18px",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    backgroundColor: "#F43F78", borderRadius: 12,
                    padding: "3px 10px", marginBottom: 6,
                  }}>
                    <Sparkles size={10} style={{ color: "#FFFFFF" }} />
                    <span style={{
                      fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                      color: "#FFFFFF", letterSpacing: "0.06em",
                    }}>LOOK OF THE WEEK</span>
                  </div>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                    color: "#FFFFFF", margin: 0,
                  }}>{pinnedLook.productName}</p>
                </div>
                <Link
                  href={`/studio/${pinnedLook.productId}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "7px 14px", borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(10px)",
                    color: "#FFFFFF",
                    fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Try On <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Profile hero */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: pinnedLook ? 0.06 : 0 }}
          style={{
            backgroundColor: archetype.bgColor,
            borderRadius: 20, overflow: "hidden",
            marginBottom: 16,
            border: "1px solid var(--color-border-light)",
          }}
        >
          <div style={{ height: 5, backgroundColor: archetype.accentColor }} />
          <div style={{ padding: "22px 22px 18px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              {/* Avatar + verified badge */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${archetype.accentColor}, ${archetype.bgColor})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 32,
                  border: `3px solid ${archetype.accentColor}33`,
                }}>
                  {archetype.emoji}
                </div>
                {/* F4-E — verified badge */}
                {verified && (
                  <div style={{
                    position: "absolute", bottom: -2, right: -2,
                    width: 22, height: 22, borderRadius: "50%",
                    backgroundColor: "#F43F78",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid #FFFFFF",
                  }}>
                    <BadgeCheck size={12} style={{ color: "#FFFFFF" }} />
                  </div>
                )}
              </div>

              {/* Try On link */}
              <Link
                href={looks.length > 0 ? `/studio/${looks[0].productId}` : "/studio/lume-01"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", borderRadius: 20,
                  backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                  fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Try On <ExternalLink size={11} />
              </Link>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 4px" }}>
              <h1 style={{
                fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 700,
                color: "#1A1025", margin: 0,
              }}>@{userId}</h1>
              {verified && (
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700,
                  color: "#F43F78", letterSpacing: "0.04em",
                }}>✓ Creator</span>
              )}
            </div>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 16,
              backgroundColor: archetype.accentColor + "18",
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 14 }}>{archetype.emoji}</span>
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600,
                color: archetype.accentColor,
              }}>{archetype.name}</span>
            </div>

            {/* F4-B — Bio + socials */}
            <BioEditor userId={userId} isOwner={isOwner} bio={bio} onBioChange={setBio} />

            {/* Quick stats */}
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: "Looks",       value: looks.length },
                { label: "Fave Finish", value: profile.dominantFinish },
                { label: "Fave Shape",  value: profile.dominantShape },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700,
                    color: "#1A1025", margin: "0 0 2px",
                  }}>{value}</p>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 10,
                    color: "rgba(26,16,37,0.45)", margin: 0,
                  }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* F4-C — QR Code panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ marginBottom: 16 }}
        >
          <QRPanel userId={userId} />
        </motion.div>

        {/* Top shades */}
        {topShades.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14, padding: "16px 16px 12px",
              border: "1px solid var(--color-border-light)",
              marginBottom: 16,
            }}
          >
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.05em", textTransform: "uppercase",
              color: "var(--color-ink)", margin: "0 0 12px",
            }}>Top Shades</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topShades.map((product) => (
                <Link
                  key={product!.id}
                  href={`/studio/${product!.id}`}
                  style={{ textDecoration: "none" }}
                  title={`Try On ${product!.name}`}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 10,
                    background: `linear-gradient(135deg, ${product!.topColor}, ${product!.midColor}, ${product!.bottomColor})`,
                    border: "1px solid rgba(0,0,0,0.06)",
                    transition: "transform 0.12s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                  />
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Saved looks grid */}
        {looks.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14, padding: 16,
              border: "1px solid var(--color-border-light)",
            }}
          >
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.05em", textTransform: "uppercase",
              color: "var(--color-ink)", margin: "0 0 12px",
            }}>Saved Looks</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {looks.slice(0, 9).map((look) => {
                const product = products.find((p) => p.id === look.productId);
                const imgSrc  = (look as unknown as { dataUrl?: string }).dataUrl ?? look.imageUrl;
                return (
                  <Link
                    key={look.id}
                    href={`/studio/${look.productId}`}
                    style={{ textDecoration: "none" }}
                    title={`Try On ${look.productName}`}
                  >
                    <div style={{ position: "relative", paddingBottom: "133%", borderRadius: 10, overflow: "hidden" }}>
                      {imgSrc?.startsWith("data:") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgSrc}
                          alt={look.productName}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{
                          position: "absolute", inset: 0,
                          background: product
                            ? `linear-gradient(135deg, ${product.topColor}, ${product.midColor}, ${product.bottomColor})`
                            : "var(--color-border-light)",
                        }} />
                      )}
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(transparent 60%, rgba(0,0,0,0.45))",
                        display: "flex", alignItems: "flex-end", padding: "8px",
                      }}>
                        <p style={{
                          fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 600,
                          color: "rgba(255,255,255,0.9)", margin: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{look.productName}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {looks.length > 9 && (
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 12,
                color: "var(--color-ink-light)", textAlign: "center", margin: "12px 0 0",
              }}>+{looks.length - 9} more looks</p>
            )}
          </motion.div>
        ) : (
          <div style={{
            backgroundColor: "#FFF5F8",
            borderRadius: 12, padding: "24px",
            border: "1px solid #FFDCE8", textAlign: "center",
          }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-ink)", margin: "0 0 12px" }}>
              No saved looks yet.
            </p>
            <Link href="/studio/lume-01" style={{
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
              color: "var(--color-pink)", textDecoration: "none",
            }}>
              Start trying on shades →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
