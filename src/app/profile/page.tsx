"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Hand, Package, Shield, CreditCard, HelpCircle, ChevronRight, Trash2, Database, CheckCircle } from "lucide-react";
import { getDataSummary, withdrawConsentAndEraseData, hasConsent } from "@/lib/consent";
import Link from "next/link";

export default function ProfilePage() {
  const [dataSummary, setDataSummary] = useState<{ cartItems: number; consentDate: string | null; policyVersion: string | null } | null>(null);
  const [erased, setErased] = useState(false);

  useEffect(() => {
    setDataSummary(getDataSummary());
  }, []);

  function handleEraseData() {
    withdrawConsentAndEraseData();
    setErased(true);
    setDataSummary({ cartItems: 0, consentDate: null, policyVersion: null });
    // Reload after 1.5 s so consent banner reappears
    setTimeout(() => window.location.reload(), 1500);
  }

  const menuItems = [
    { label: "Order Repository", icon: Package },
    { label: "Archived Looks", icon: Hand },
    { label: "Identity & Shield", icon: Shield },
    { label: "Asset Billing", icon: CreditCard },
    { label: "Knowledge Base", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-surface-void text-on-surface px-6 pt-24 pb-48">
      <div className="max-w-xl mx-auto">
        <header className="flex justify-between items-end mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <p className="text-gold font-mono text-[10px] uppercase tracking-[0.4em] mb-4">Identity // Profile</p>
            <h1 className="text-6xl font-serif italic tracking-tighter leading-none">Studio Profile</h1>
          </motion.div>
          <button className="w-12 h-12 glass flex items-center justify-center border border-white/5 hover:bg-white/10 transition">
            <Settings size={20} className="text-on-faint hover:text-white transition-colors" />
          </button>
        </header>

        {/* High-End Scan Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-light border border-white/10 p-8 mb-12 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
             <Hand size={140} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
               <div className="h-[1px] w-6 bg-gold/40" />
               <h2 className="text-[10px] font-mono text-gold uppercase tracking-[0.2em]">Latest Biometric Scan</h2>
            </div>
            
            <div className="flex gap-4 mb-10">
              {['M', 'S', 'S', 'S', 'XS'].map((size, i) => (
                <div key={i} className="w-10 h-10 border border-white/5 bg-surface-void/40 flex items-center justify-center text-[10px] font-mono text-white/60">
                  {size}
                </div>
              ))}
            </div>

            <button className="cta-gold px-8 py-3 text-[10px] uppercase tracking-widest transition-transform active:scale-95 shadow-lg">
              Initiate New Scan
            </button>
          </div>
        </motion.div>

        {/* Menu Options */}
        <div className="space-y-4">
          {menuItems.map((item, i) => (
            <motion.button 
              key={i} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="w-full bg-surface-low/30 hover:bg-surface-mid/50 transition-all p-5 rounded-none flex items-center justify-between border border-white/5 group text-left"
            >
              <div className="flex items-center gap-4">
                <item.icon size={18} className="text-on-faint group-hover:text-gold transition-colors" />
                <span className="text-xs font-medium uppercase tracking-[0.1em]">{item.label}</span>
              </div>
              <ChevronRight size={16} className="text-on-faint group-hover:translate-x-1 transition-transform" />
            </motion.button>
          ))}
        </div>

        {/* ── Data & Privacy Dashboard (GDPR Art. 17 / POPIA §24) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 border"
          style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(20,18,16,0.6)" }}
        >
          <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <Database size={14} style={{ color: "var(--color-terra-mid)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(249,246,242,0.4)" }}>
              Your Data — GDPR / POPIA
            </span>
          </div>
          <div className="px-5 py-4 space-y-2 text-xs" style={{ color: "rgba(249,246,242,0.45)", fontFamily: "var(--font-mono)" }}>
            <p>Cart items stored: <span style={{ color: "rgba(249,246,242,0.8)" }}>{dataSummary?.cartItems ?? "—"}</span></p>
            <p>Consent given: <span style={{ color: "rgba(249,246,242,0.8)" }}>{dataSummary?.consentDate ? new Date(dataSummary.consentDate).toLocaleDateString() : hasConsent() ? "Yes" : "No"}</span></p>
            <p>Policy version: <span style={{ color: "rgba(249,246,242,0.8)" }}>{dataSummary?.policyVersion ?? "—"}</span></p>
            <p className="pt-1">
              <Link href="/privacy" style={{ color: "var(--color-terra-mid)", textDecoration: "underline" }}>
                View full Privacy Policy →
              </Link>
            </p>
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={handleEraseData}
              disabled={erased}
              style={{
                width: "100%",
                height: 40,
                backgroundColor: erased ? "rgba(110,204,142,0.1)" : "rgba(180,60,60,0.15)",
                border: `1px solid ${erased ? "rgba(110,204,142,0.3)" : "rgba(180,60,60,0.3)"}`,
                color: erased ? "#6ECC8E" : "#E07070",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                cursor: erased ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              {erased ? <><CheckCircle size={12} /> Data erased — reloading…</> : <><Trash2 size={12} /> Erase all my data &amp; withdraw consent</>}
            </button>
          </div>
        </motion.div>

        {/* Footer Branding */}
        <div className="mt-16 text-center opacity-10">
           <p className="font-serif italic text-sm tracking-[0.5em] uppercase font-bold">LUMIS // V4.2</p>
        </div>
      </div>
    </div>
  );
}
