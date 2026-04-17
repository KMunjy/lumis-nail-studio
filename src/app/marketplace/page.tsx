"use client";

/**
 * LUMIS Marketplace Access Page — /marketplace
 *
 * Role-selector landing serving three audiences:
 *   1. Consumers      → AR try-on, shade explorer, Nail DNA
 *   2. Nail Techs     → NailCard portfolio, NailShoot, QR codes for salon
 *   3. Brands / Ads   → Product listings, AR placement, analytics
 *
 * Pattern: Airbnb host/guest toggle × Booksy client/professional split.
 * Mobile-first stacked cards, desktop 3-column grid.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Sparkles, Camera, Dna, Bookmark,
  Scissors, QrCode, LayoutGrid, Star,
  BarChart2, Megaphone, ShoppingBag, Globe,
  ArrowRight, Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "consumer" | "tech" | "brand";

interface RoleCard {
  id:       Role;
  badge:    string;
  title:    string;
  tagline:  string;
  accent:   string;
  bgLight:  string;
  icon:     React.ReactNode;
  features: string[];
  cta:      string;
  href:     string;
}

// ─── Role definitions ─────────────────────────────────────────────────────────

const ROLES: RoleCard[] = [
  {
    id:      "consumer",
    badge:   "For You",
    title:   "Try On & Discover",
    tagline: "Find your perfect shade before you commit.",
    accent:  "#F43F78",
    bgLight: "#FFF0F5",
    icon:    <Sparkles size={28} />,
    features: [
      "Live AR nail try-on via your camera",
      "Explore 15 shades across 7 finishes",
      "Save looks & build your Nail DNA profile",
      "NailShoot: 12 professional nail portraits",
      "NailBoard: curated mood boards to share",
    ],
    cta:  "Start Try-On",
    href: "/studio",
  },
  {
    id:      "tech",
    badge:   "For Nail Techs",
    title:   "Build Your Portfolio",
    tagline: "A digital showcase that lives in every client's pocket.",
    accent:  "#7C3AED",
    bgLight: "#F5F0FF",
    icon:    <Scissors size={28} />,
    features: [
      "NailCard: shareable portfolio at lumis.app/u/you",
      "QR code for in-salon try-on handoffs",
      "NailShoot Studio: professional content in minutes",
      "Client-facing shade explorer & booking bridge",
      "Verified Creator badge for 10+ saved looks",
    ],
    cta:  "Build Your NailCard",
    href: "/u/demo-user",
  },
  {
    id:      "brand",
    badge:   "For Brands",
    title:   "AR-Powered Placement",
    tagline: "Put your product on real customers, live.",
    accent:  "#0EA5E9",
    bgLight: "#F0F9FF",
    icon:    <BarChart2 size={28} />,
    features: [
      "List shades in the LUMIS AR catalogue",
      "Try-on analytics: impressions, dwell time, saves",
      "NailShoot integrations for campaign content",
      "Co-branded Nail DNA archetype sponsorships",
      "API access for white-label AR integration",
    ],
    cta:  "Partner with LUMIS",
    href: "mailto:brands@lumis.app",
  },
];

// ─── Stat bar data ─────────────────────────────────────────────────────────────

const STATS = [
  { value: "15",  label: "Shades"         },
  { value: "7",   label: "Finishes"       },
  { value: "8",   label: "DNA Archetypes" },
  { value: "12",  label: "NailShoot Styles" },
  { value: "5",   label: "Nail Shapes"    },
];

// ─── Feature icon map ─────────────────────────────────────────────────────────

function featureIcon(role: Role) {
  if (role === "consumer") return <Camera size={12} style={{ flexShrink: 0 }} />;
  if (role === "tech")     return <QrCode  size={12} style={{ flexShrink: 0 }} />;
  return                          <Globe   size={12} style={{ flexShrink: 0 }} />;
}

// ─── Role card component ──────────────────────────────────────────────────────

function Card({ role, active, onSelect }: { role: RoleCard; active: boolean; onSelect: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 0,
        borderRadius: 20,
        border: active
          ? `2px solid ${role.accent}`
          : "2px solid var(--color-border-light)",
        backgroundColor: active ? role.bgLight : "#FFFFFF",
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color 0.18s, background-color 0.18s, box-shadow 0.18s",
        boxShadow: active
          ? `0 8px 32px ${role.accent}22`
          : "0 1px 6px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 4, backgroundColor: active ? role.accent : "transparent", transition: "background-color 0.18s" }} />

      <div style={{ padding: "24px 22px 22px", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Badge + icon row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{
            display: "inline-block",
            padding: "3px 10px", borderRadius: 20,
            backgroundColor: active ? role.accent : "var(--color-border-light)",
            color: active ? "#FFFFFF" : "var(--color-ink-light)",
            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase",
            transition: "all 0.18s",
          }}>
            {role.badge}
          </span>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            backgroundColor: active ? role.accent : "var(--color-border-light)",
            color: active ? "#FFFFFF" : "var(--color-ink-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.18s",
          }}>
            {role.icon}
          </div>
        </div>

        {/* Title + tagline */}
        <h2 style={{
          fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700,
          color: "var(--color-ink)", margin: "0 0 6px",
          letterSpacing: "-0.01em", lineHeight: 1.25,
        }}>{role.title}</h2>
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.55,
          color: "var(--color-ink-light)", margin: "0 0 20px",
        }}>{role.tagline}</p>

        {/* Feature list */}
        <ul style={{ listStyle: "none", margin: "0 0 24px", padding: 0, flex: 1 }}>
          {role.features.map((f) => (
            <li key={f} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              marginBottom: 9,
              fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.5,
              color: active ? "var(--color-ink)" : "var(--color-ink-light)",
              transition: "color 0.18s",
            }}>
              <span style={{ color: role.accent, marginTop: 2 }}>
                {active ? <Check size={12} style={{ flexShrink: 0 }} /> : featureIcon(role.id)}
              </span>
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href={role.href}
          onClick={(e) => e.stopPropagation()}
          style={{ textDecoration: "none" }}
        >
          <button
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              border: "none",
              backgroundColor: active ? role.accent : "var(--color-border-light)",
              color: active ? "#FFFFFF" : "var(--color-ink-light)",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.18s",
            }}
          >
            {role.cta}
            <ArrowRight size={14} />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [activeRole, setActiveRole] = useState<Role>("consumer");

  const active = ROLES.find((r) => r.id === activeRole)!;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFAFA" }}>

      {/* ── Header ── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "16px 20px",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 22,
              fontWeight: 400, fontStyle: "italic",
              color: "var(--color-ink)", letterSpacing: "0.04em",
            }}>LUMIS</span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--color-ink-light)", letterSpacing: "0.14em",
              textTransform: "uppercase", marginTop: 2,
            }}>Marketplace</span>
          </div>
          <Link href="/" style={{ textDecoration: "none", fontSize: 13, color: "var(--color-ink-light)" }}>
            ← Home
          </Link>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{
        maxWidth: 960, margin: "0 auto",
        padding: "48px 20px 32px",
        textAlign: "center",
      }}>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--color-pink)", letterSpacing: "0.18em",
            textTransform: "uppercase", margin: "0 0 14px",
          }}
        >
          AR Nail Try-On · Content · Commerce
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{
            fontFamily: "var(--font-sans)", fontSize: "clamp(28px, 5vw, 44px)",
            fontWeight: 800, color: "var(--color-ink)",
            margin: "0 0 16px", letterSpacing: "-0.02em", lineHeight: 1.15,
          }}
        >
          Beauty tech built for<br />
          <span style={{ color: "var(--color-pink)" }}>everyone in nails</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.65,
            color: "var(--color-ink-light)", margin: "0 auto 40px",
            maxWidth: 520,
          }}
        >
          Whether you're discovering your next shade, growing a nail tech business,
          or placing your brand in AR — LUMIS has a path for you.
        </motion.p>

        {/* ── Role selector pills ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          style={{
            display: "inline-flex", gap: 6, padding: "5px",
            backgroundColor: "#FFFFFF",
            borderRadius: 40,
            border: "1px solid var(--color-border-light)",
            marginBottom: 40,
          }}
        >
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              style={{
                padding: "9px 20px", borderRadius: 35, border: "none",
                backgroundColor: activeRole === role.id ? role.accent : "transparent",
                color: activeRole === role.id ? "#FFFFFF" : "var(--color-ink-light)",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.18s",
                whiteSpace: "nowrap",
              }}
            >
              {role.badge}
            </button>
          ))}
        </motion.div>
      </div>

      {/* ── Role cards ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px 48px" }}>
        <div style={{
          display: "flex", gap: 14,
          flexWrap: "wrap",
        }}>
          {ROLES.map((role, i) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
              style={{ flex: "1 1 280px", minWidth: 0 }}
            >
              <Card
                role={role}
                active={activeRole === role.id}
                onSelect={() => setActiveRole(role.id)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Stat bar ── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid var(--color-border-light)",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "28px 20px",
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto",
          display: "flex", gap: 0,
          justifyContent: "center", flexWrap: "wrap",
        }}>
          {STATS.map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 120px", textAlign: "center",
                padding: "8px 12px",
                borderRight: i < STATS.length - 1 ? "1px solid var(--color-border-light)" : "none",
              }}
            >
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 800,
                color: "var(--color-pink)", margin: "0 0 4px",
                letterSpacing: "-0.01em",
              }}>{s.value}</p>
              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 11,
                color: "var(--color-ink-light)", margin: 0,
              }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Active role deep-dive panel ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeRole}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            maxWidth: 960, margin: "0 auto",
            padding: "48px 20px 80px",
          }}
        >
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20, overflow: "hidden",
            border: "1px solid var(--color-border-light)",
          }}>
            <div style={{ height: 5, backgroundColor: active.accent }} />
            <div style={{ padding: "32px 32px 36px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  backgroundColor: active.bgLight,
                  color: active.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {active.icon}
                </div>
                <div>
                  <p style={{
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    color: active.accent, letterSpacing: "0.14em",
                    textTransform: "uppercase", margin: "0 0 3px",
                  }}>{active.badge}</p>
                  <h3 style={{
                    fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 700,
                    color: "var(--color-ink)", margin: 0, letterSpacing: "-0.01em",
                  }}>{active.title}</h3>
                </div>
              </div>

              <p style={{
                fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.65,
                color: "var(--color-ink-light)", margin: "0 0 28px",
                maxWidth: 560,
              }}>{active.tagline}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
                {active.features.map((f) => (
                  <div
                    key={f}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "7px 14px", borderRadius: 30,
                      backgroundColor: active.bgLight,
                      border: `1px solid ${active.accent}33`,
                      fontFamily: "var(--font-sans)", fontSize: 12,
                      color: "var(--color-ink)",
                    }}
                  >
                    <Check size={11} style={{ color: active.accent, flexShrink: 0 }} />
                    {f}
                  </div>
                ))}
              </div>

              <Link href={active.href} style={{ textDecoration: "none" }}>
                <button style={{
                  padding: "14px 32px", borderRadius: 12, border: "none",
                  backgroundColor: active.accent,
                  color: "#FFFFFF",
                  fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 9,
                  transition: "opacity 0.15s",
                }}>
                  {active.cta}
                  <ArrowRight size={15} />
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
