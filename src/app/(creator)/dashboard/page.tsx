"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, TrendingUp, Users, Activity, LogOut, Package,
  Palette, DollarSign, BarChart2, Upload, Eye, Trash2,
  Edit3, CheckCircle, AlertCircle, ChevronDown, CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { products as PRODUCTS } from "@/data/products";

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = "overview" | "catalogue" | "earnings" | "analytics";

export default function CreatorDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showUploadModal, setShowUploadModal] = useState(false);

  // DEF-008: proper sign-out via Supabase; falls back to homepage redirect in dev
  const handleSignOut = useCallback(async () => {
    try {
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        );
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn("[dashboard] sign-out failed:", err);
    } finally {
      router.push("/auth");
    }
  }, [router]);

  return (
    <div className="min-h-screen px-4 md:px-8 pt-12 pb-24 md:pb-8 mx-auto max-w-5xl"
      style={{ color: "var(--color-charcoal, #1a1814)" }}>

      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <p style={{ fontSize: 10, letterSpacing: "0.2em", opacity: 0.4, fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: 4 }}>
            LUMIS Creator Studio
          </p>
          <h1 style={{ fontSize: 26, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
            Your Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/studio"
            style={{ fontSize: 11, letterSpacing: "0.12em", opacity: 0.5, textTransform: "uppercase", textDecoration: "none", color: "inherit" }}>
            Studio View
          </Link>
          <button
            onClick={() => { void handleSignOut(); }}
            title="Sign out"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.5, background: "none", border: "none", cursor: "pointer" }}>
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        {(["overview", "catalogue", "earnings", "analytics"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "capitalize",
              fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? "2px solid var(--color-terra, #A85A3E)" : "2px solid transparent",
              color: activeTab === tab ? "var(--color-terra, #A85A3E)" : "rgba(26,24,20,0.4)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Total Try-Ons",   value: "14.2k",  delta: "+12%",   icon: Activity,    accent: "#3B82F6" },
              { label: "Active Buyers",   value: "3,842",  delta: "+5%",    icon: Users,       accent: "#10B981" },
              { label: "Your Earnings",   value: "$820",   delta: "+22%",   icon: DollarSign,  accent: "#F59E0B" },
              { label: "Active Styles",   value: PRODUCTS.length.toString(), delta: "+2",  icon: Palette, accent: "#8B5CF6" },
            ].map((kpi, i) => (
              <motion.div key={kpi.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                style={{ background: "rgba(249,246,242,0.6)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "18px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ padding: 8, borderRadius: 8, background: `${kpi.accent}15` }}>
                    <kpi.icon size={16} style={{ color: kpi.accent }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#10B981", background: "#D1FAE5", padding: "2px 8px", borderRadius: 20 }}>
                    {kpi.delta}
                  </span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{kpi.value}</p>
                <p style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.4, fontFamily: "var(--font-mono)" }}>{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.5, textTransform: "uppercase", marginBottom: 16 }}>Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { label: "Upload New Style",    icon: Upload,    action: () => setShowUploadModal(true),   primary: true },
              { label: "View Live Studio",    icon: Eye,       action: () => router.push("/studio"),     primary: false },
              { label: "Payout Request",      icon: CreditCard, action: () => setActiveTab("earnings"), primary: false },
            ].map((btn) => (
              <button key={btn.label} onClick={btn.action}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "14px 18px",
                  background: btn.primary ? "var(--color-terra, #A85A3E)" : "rgba(249,246,242,0.6)",
                  color: btn.primary ? "#F9F6F2" : "inherit",
                  border: "1px solid " + (btn.primary ? "transparent" : "rgba(0,0,0,0.07)"),
                  borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>
                <btn.icon size={16} />
                {btn.label}
              </button>
            ))}
          </div>

          {/* Recent Performance */}
          <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", opacity: 0.5, textTransform: "uppercase", marginBottom: 16 }}>Top Styles This Month</h2>
          <div style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden" }}>
            {PRODUCTS.slice(0, 4).map((p, i) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                borderBottom: i < 3 ? "1px solid rgba(0,0,0,0.05)" : "none",
                background: i % 2 === 0 ? "rgba(249,246,242,0.4)" : "transparent",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${p.topColor}, ${p.bottomColor})`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</p>
                  <p style={{ fontSize: 11, opacity: 0.4 }}>{p.shape} · ${p.price}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{i * 340 + 412} tries</p>
                  <p style={{ fontSize: 10, color: "#10B981" }}>+{(i + 1) * 8}%</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Catalogue Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "catalogue" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex justify-between items-center mb-6">
            <p style={{ fontSize: 13, opacity: 0.5 }}>{PRODUCTS.length} styles active</p>
            <button onClick={() => setShowUploadModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
                background: "var(--color-terra, #A85A3E)", color: "#F9F6F2",
                border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              <Plus size={14} /> Add Style
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {PRODUCTS.map((p) => (
              <div key={p.id}
                style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden", background: "rgba(249,246,242,0.5)" }}>
                <div style={{ height: 120, background: `linear-gradient(160deg, ${p.topColor} 0%, ${p.midColor} 50%, ${p.bottomColor} 100%)`, position: "relative" }}>
                  <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, padding: "3px 8px",
                    background: "rgba(255,255,255,0.9)", borderRadius: 20, letterSpacing: "0.1em", fontWeight: 600 }}>
                    {p.shape}
                  </span>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{p.name}</p>
                  <p style={{ fontSize: 11, opacity: 0.4, marginBottom: 10 }}>${p.price}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ flex: 1, padding: "7px 0", fontSize: 11, border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: 6, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <Edit3 size={12} /> Edit
                    </button>
                    <button style={{ flex: 1, padding: "7px 0", fontSize: 11, border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: 6, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "#EF4444" }}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Earnings Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "earnings" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {[
              { label: "Pending Payout",   value: "$820.00",   note: "Available for withdrawal",  color: "#F59E0B" },
              { label: "Total Earned",     value: "$4,100.00", note: "All time",                   color: "#10B981" },
              { label: "Commission Rate",  value: "20%",       note: "Per sale net of LUMIS fee",  color: "#8B5CF6" },
            ].map((e) => (
              <div key={e.label}
                style={{ padding: "20px 18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, background: "rgba(249,246,242,0.5)" }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: e.color }}>{e.value}</p>
                <p style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{e.label}</p>
                <p style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>{e.note}</p>
              </div>
            ))}
          </div>

          <div style={{ padding: "20px 18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, marginBottom: 16, background: "rgba(249,246,242,0.5)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Payout Settings</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500 }}>Stripe Connect</p>
                  <p style={{ fontSize: 11, opacity: 0.4 }}>Not connected — earnings held until connected</p>
                </div>
                <button style={{ padding: "8px 14px", background: "#635BFF", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                  Connect Stripe
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500 }}>Payout Schedule</p>
                  <p style={{ fontSize: 11, opacity: 0.4 }}>Monthly, on the 1st</p>
                </div>
                <button style={{ padding: "6px 12px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "transparent" }}>
                  Change
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "rgba(245,158,11,0.1)", borderRadius: 10, alignItems: "flex-start" }}>
            <AlertCircle size={16} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#92400E" }}>
              POPIA §22 compliance: payout data is encrypted at rest and only accessible to you and LUMIS finance. No banking details are stored in this app.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Analytics Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Conversion Rate", value: "8.3%",  sub: "try-on → cart" },
              { label: "Capture Rate",    value: "24.1%", sub: "photo saves" },
              { label: "Avg Session",     value: "1m 42s", sub: "in studio" },
              { label: "Top Shape",       value: "Almond", sub: "most tried" },
            ].map((m) => (
              <div key={m.label}
                style={{ padding: "16px 14px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, background: "rgba(249,246,242,0.5)" }}>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{m.value}</p>
                <p style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{m.label}</p>
                <p style={{ fontSize: 10, opacity: 0.4 }}>{m.sub}</p>
              </div>
            ))}
          </div>

          <div style={{ padding: "18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, marginBottom: 16, background: "rgba(249,246,242,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600 }}>AR Renderer Performance</h3>
              <span style={{ fontSize: 10, padding: "3px 8px", background: "#D1FAE5", color: "#065F46", borderRadius: 20, fontWeight: 600 }}>
                v3.0 Active
              </span>
            </div>
            {[
              { label: "Accuracy (5-finger mean)",  value: "97.8%",  target: "≥ 95%",   pass: true  },
              { label: "Direction field angle error", value: "±1.5°",  target: "< ±2°",  pass: true  },
              { label: "Distal edge coverage",       value: "100%",   target: "100%",    pass: true  },
              { label: "Avg frame latency",          value: "11ms",   target: "< 16ms",  pass: true  },
              { label: "Dorsal detection F1",        value: "98.2%",  target: "≥ 95%",   pass: true  },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <p style={{ fontSize: 12 }}>{row.label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: 12, opacity: 0.4 }}>target {row.target}</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{row.value}</p>
                  {row.pass
                    ? <CheckCircle size={14} style={{ color: "#10B981" }} />
                    : <AlertCircle size={14} style={{ color: "#F59E0B" }} />}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,9,7,0.85)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <div style={{ background: "#F9F6F2", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, margin: "0 16px" }}>
            <h3 style={{ fontSize: 18, fontFamily: "var(--font-display)", fontStyle: "italic", marginBottom: 6 }}>Upload New Style</h3>
            <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 20 }}>PNG with transparent background, min 512×512px</p>
            <div style={{ border: "2px dashed rgba(0,0,0,0.15)", borderRadius: 10, padding: 32, textAlign: "center", marginBottom: 16, cursor: "pointer" }}>
              <Upload size={24} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
              <p style={{ fontSize: 12, opacity: 0.4 }}>Drop file here or click to browse</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowUploadModal(false)}
                style={{ flex: 1, padding: "11px 0", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "transparent" }}>
                Cancel
              </button>
              <button style={{ flex: 1, padding: "11px 0", background: "var(--color-terra, #A85A3E)", color: "#F9F6F2", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
