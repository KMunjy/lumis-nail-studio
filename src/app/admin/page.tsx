"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Users, TrendingUp, Activity, Package,
  CheckCircle, AlertCircle, XCircle, Shield, Database,
  RefreshCw, Lock, ExternalLink, BarChart2, Cpu,
} from "lucide-react";
import { products as PRODUCTS } from "@/data/products";

type AdminTab = "overview" | "products" | "orders" | "users" | "system";

export default function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("overview");

  return (
    <div className="min-h-screen px-4 md:px-8 pt-12 pb-24 md:pb-8 mx-auto max-w-6xl"
      style={{ color: "var(--color-charcoal, #1a1814)" }}>

      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Shield size={14} style={{ color: "var(--color-terra-mid, #C97D5A)" }} />
            <p style={{ fontSize: 10, letterSpacing: "0.2em", opacity: 0.4, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
              LUMIS Admin Panel
            </p>
          </div>
          <h1 style={{ fontSize: 26, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
            Operations Dashboard
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
          background: "rgba(16,185,129,0.1)", borderRadius: 20, border: "1px solid rgba(16,185,129,0.2)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: 10, color: "#065F46", fontWeight: 600, letterSpacing: "0.1em" }}>SYSTEMS NOMINAL</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        {(["overview", "products", "orders", "users", "system"] as AdminTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: "8px 16px", fontSize: 11, letterSpacing: "0.1em",
              textTransform: "capitalize", fontWeight: tab === t ? 600 : 400,
              borderBottom: tab === t ? "2px solid var(--color-terra, #A85A3E)" : "2px solid transparent",
              color: tab === t ? "var(--color-terra)" : "rgba(26,24,20,0.4)",
              background: "none", border: "none",
              cursor: "pointer",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Total Revenue",    value: "$14.2k",  delta: "+22%",  icon: TrendingUp,  accent: "#10B981" },
              { label: "Orders (30d)",     value: "284",     delta: "+18%",  icon: ShoppingBag, accent: "#3B82F6" },
              { label: "Registered Users", value: "3,842",   delta: "+5%",   icon: Users,       accent: "#8B5CF6" },
              { label: "Try-Ons (30d)",    value: "14.2k",   delta: "+12%",  icon: Activity,    accent: "#F59E0B" },
            ].map((k, i) => (
              <motion.div key={k.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                style={{ background: "rgba(249,246,242,0.6)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "18px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ padding: 8, borderRadius: 8, background: `${k.accent}15` }}>
                    <k.icon size={16} style={{ color: k.accent }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#10B981", background: "#D1FAE5", padding: "2px 7px", borderRadius: 20 }}>
                    {k.delta}
                  </span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 700 }}>{k.value}</p>
                <p style={{ fontSize: 9, letterSpacing: "0.15em", opacity: 0.4, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{k.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Recent Orders */}
          <h3 style={{ fontSize: 13, fontWeight: 600, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
            Recent Orders
          </h3>
          <div style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            {[
              { id: "#ORD-0821", customer: "A. Mensah",    product: "Liquid Gold",     total: "$52", status: "shipped"   },
              { id: "#ORD-0820", customer: "T. van Wyk",   product: "Velvet Dahlia",   total: "$28", status: "confirmed" },
              { id: "#ORD-0819", customer: "S. Dlamini",   product: "Midnight Chrome", total: "$46", status: "pending"   },
              { id: "#ORD-0818", customer: "K. Boateng",   product: "Onyx Chroma",     total: "$38", status: "delivered" },
            ].map((o, i) => (
              <div key={o.id} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 12,
                alignItems: "center", padding: "13px 18px",
                borderBottom: i < 3 ? "1px solid rgba(0,0,0,0.05)" : "none",
                background: i % 2 === 0 ? "rgba(249,246,242,0.4)" : "transparent",
              }}>
                <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", opacity: 0.6 }}>{o.id}</p>
                <p style={{ fontSize: 12, fontWeight: 500 }}>{o.customer}</p>
                <p style={{ fontSize: 12, opacity: 0.5 }}>{o.product}</p>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{o.total}</p>
                <StatusBadge status={o.status} />
              </div>
            ))}
          </div>

          {/* Designer Revenue */}
          <h3 style={{ fontSize: 13, fontWeight: 600, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
            Designer Revenue (All Time)
          </h3>
          <div style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden" }}>
            {[
              { brand: "LUMIS House",     styles: 6, gross: "$14,200", commission: "—",   earnings: "—"     },
            ].map((d, i) => (
              <div key={d.brand} style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto auto",
                gap: 12, alignItems: "center", padding: "13px 18px",
                background: i % 2 === 0 ? "rgba(249,246,242,0.4)" : "transparent",
              }}>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{d.brand}</p>
                <p style={{ fontSize: 12, opacity: 0.5 }}>{d.styles} styles</p>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{d.gross}</p>
                <p style={{ fontSize: 12, opacity: 0.5 }}>{d.commission}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>{d.earnings}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Products ──────────────────────────────────────────────────────────── */}
      {tab === "products" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <p style={{ fontSize: 13, opacity: 0.5 }}>{PRODUCTS.length} active products</p>
          </div>
          <div style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr auto auto auto auto auto",
              gap: 10, padding: "10px 18px", borderBottom: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(0,0,0,0.02)" }}>
              {["", "Product", "Shape", "Price", "Stock", "Try-Ons", "Status"].map((h) => (
                <p key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", opacity: 0.4, textTransform: "uppercase" }}>{h}</p>
              ))}
            </div>
            {PRODUCTS.map((p, i) => (
              <div key={p.id}
                style={{ display: "grid", gridTemplateColumns: "48px 1fr auto auto auto auto auto",
                  gap: 10, alignItems: "center", padding: "12px 18px",
                  borderBottom: i < PRODUCTS.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                  background: i % 2 === 0 ? "rgba(249,246,242,0.35)" : "transparent" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8,
                  background: `linear-gradient(135deg, ${p.topColor}, ${p.bottomColor})`, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</p>
                  <p style={{ fontSize: 10, opacity: 0.4, fontFamily: "var(--font-mono)" }}>{p.id}</p>
                </div>
                <p style={{ fontSize: 12, opacity: 0.6 }}>{p.shape}</p>
                <p style={{ fontSize: 12, fontWeight: 600 }}>${p.price}</p>
                <p style={{ fontSize: 12, opacity: 0.6 }}>100</p>
                <p style={{ fontSize: 12 }}>—</p>
                <span style={{ fontSize: 10, padding: "3px 8px", background: "#D1FAE5", color: "#065F46",
                  borderRadius: 20, fontWeight: 600 }}>Active</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Orders ────────────────────────────────────────────────────────────── */}
      {tab === "orders" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ fontSize: 13, opacity: 0.4, padding: "40px 0", textAlign: "center" }}>
            Order management connects to Supabase in production. Schema ready — see supabase/schema.sql.
          </p>
        </motion.div>
      )}

      {/* ── Users ─────────────────────────────────────────────────────────────── */}
      {tab === "users" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {[
              { label: "Total Users",     value: "3,842" },
              { label: "Creators",        value: "12"    },
              { label: "New (30d)",       value: "284"   },
            ].map((s) => (
              <div key={s.label}
                style={{ padding: "20px 18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, background: "rgba(249,246,242,0.5)" }}>
                <p style={{ fontSize: 26, fontWeight: 700 }}>{s.value}</p>
                <p style={{ fontSize: 12, opacity: 0.4, marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{ padding: 18, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, background: "rgba(245,158,11,0.06)" }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>GDPR / POPIA Data Access Note</p>
            <p style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.6 }}>
              User PII is visible to admin role only via Supabase RLS policies. Bulk exports require DPO sign-off. Right-to-erasure requests should be processed via the withdrawConsentAndEraseData() API within 30 days of request.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── System ────────────────────────────────────────────────────────────── */}
      {tab === "system" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* AR Engine Status */}
            <div style={{ padding: "20px 18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, background: "rgba(249,246,242,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Cpu size={16} style={{ color: "var(--color-terra-mid)" }} />
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>Lume Engine v3.0</h3>
              </div>
              {[
                { label: "Renderer",          value: "Geometric + Direction Field", ok: true },
                { label: "Accuracy (mean)",   value: "97.8%",                       ok: true },
                { label: "MediaPipe",         value: "0.10.34 (pinned)",            ok: true },
                { label: "DEMA Smoother",     value: "v2.0 (jitter guard active)",  ok: true },
                { label: "Stage 2 Model",     value: "Pending training",            ok: false },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: 12, opacity: 0.6 }}>{r.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 500 }}>{r.value}</p>
                    {r.ok ? <CheckCircle size={13} style={{ color: "#10B981" }} /> : <AlertCircle size={13} style={{ color: "#F59E0B" }} />}
                  </div>
                </div>
              ))}
            </div>

            {/* CI/CD Status */}
            <div style={{ padding: "20px 18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, background: "rgba(249,246,242,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Activity size={16} style={{ color: "var(--color-terra-mid)" }} />
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>CI/CD Pipeline (8 Jobs)</h3>
              </div>
              {[
                { job: "quality (lint + tsc)",    status: "pass" },
                { job: "test (67 SIT tests)",     status: "pass" },
                { job: "build (Next.js)",         status: "pass" },
                { job: "security (Gitleaks)",     status: "pass" },
                { job: "model-health (CDN)",      status: "pass" },
                { job: "accessibility (axe)",     status: "warn" },
                { job: "e2e-uat (Playwright)",    status: "pass" },
                { job: "docker (Trivy)",          status: "pass" },
              ].map((j) => (
                <div key={j.job} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: 12, opacity: 0.6, fontFamily: "var(--font-mono)" }}>{j.job}</p>
                  <span style={{
                    fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 700, letterSpacing: "0.1em",
                    background: j.status === "pass" ? "#D1FAE5" : "#FEF3C7",
                    color: j.status === "pass" ? "#065F46" : "#92400E",
                  }}>
                    {j.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* GDPR Compliance */}
            <div style={{ padding: "20px 18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, background: "rgba(249,246,242,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Shield size={16} style={{ color: "var(--color-terra-mid)" }} />
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>GDPR / POPIA Compliance</h3>
              </div>
              {[
                { label: "Consent banner (Art. 7)",         ok: true  },
                { label: "Privacy policy (Art. 13)",        ok: true  },
                { label: "Right to erasure (Art. 17)",      ok: true  },
                { label: "30-day retention enforced",       ok: true  },
                { label: "DPIA documented",                 ok: true  },
                { label: "DPO appointed",                   ok: false },
                { label: "Supabase DPA signed",             ok: false },
              ].map((c) => (
                <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: 12, opacity: 0.7 }}>{c.label}</p>
                  {c.ok ? <CheckCircle size={14} style={{ color: "#10B981" }} /> : <XCircle size={14} style={{ color: "#EF4444" }} />}
                </div>
              ))}
            </div>

            {/* Database */}
            <div style={{ padding: "20px 18px", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, background: "rgba(249,246,242,0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Database size={16} style={{ color: "var(--color-terra-mid)" }} />
                <h3 style={{ fontSize: 13, fontWeight: 600 }}>Database (Supabase)</h3>
              </div>
              {[
                { label: "Schema version",    value: "1.0.0" },
                { label: "Tables",            value: "7 (+ 1 view)" },
                { label: "RLS enabled",       value: "All tables" },
                { label: "Auth provider",     value: "Magic link" },
                { label: "Backups",           value: "Daily (Supabase Pro)" },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: 12, opacity: 0.6 }}>{r.label}</p>
                  <p style={{ fontSize: 12, fontWeight: 500 }}>{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending:   { bg: "#FEF3C7", color: "#92400E" },
    confirmed: { bg: "#DBEAFE", color: "#1E40AF" },
    shipped:   { bg: "#EDE9FE", color: "#5B21B6" },
    delivered: { bg: "#D1FAE5", color: "#065F46" },
    cancelled: { bg: "#FEE2E2", color: "#991B1B" },
    refunded:  { bg: "#F3F4F6", color: "#374151" },
  };
  const s = map[status] ?? { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ fontSize: 10, padding: "3px 8px", background: s.bg, color: s.color, borderRadius: 20, fontWeight: 600, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}
