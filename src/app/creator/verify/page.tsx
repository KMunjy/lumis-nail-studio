"use client";

/**
 * /creator/verify — Creator Verification Onboarding (P1-1 — G-04)
 *
 * Multi-step form that submits a creator_verifications record.
 * Guards the creator dashboard — unverified creators are redirected here.
 *
 * Steps:
 *   1. Business info (name, type, country)
 *   2. Portfolio & social (URL, Instagram handle)
 *   3. Document upload (ID document, business registration)
 *   4. Review & submit
 *   5. Status screen (pending / under_review / approved / rejected)
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Clock, AlertCircle, Upload,
  ChevronRight, ChevronLeft, Shield, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type BusinessType = "individual" | "salon" | "brand" | "distributor";
type VerificationStatus = "pending" | "under_review" | "approved" | "rejected" | "suspended";

interface VerificationRecord {
  id: string;
  status: VerificationStatus;
  business_name: string;
  business_type: BusinessType;
  country: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

interface FormData {
  business_name:    string;
  business_type:    BusinessType | "";
  country:          string;
  portfolio_url:    string;
  instagram_handle: string;
}

// ── Step components ───────────────────────────────────────────────────────────

const STEPS = ["Business", "Portfolio", "Documents", "Review"] as const;

const BUSINESS_TYPES: { value: BusinessType; label: string; desc: string }[] = [
  { value: "individual", label: "Independent Artist",  desc: "Freelance nail artist or solo creator" },
  { value: "salon",      label: "Nail Salon",          desc: "Physical salon with multiple technicians" },
  { value: "brand",      label: "Nail Brand",          desc: "Product brand or manufacturer" },
  { value: "distributor",label: "Distributor",         desc: "Wholesale or multi-brand distributor" },
];

// ── Status screen ─────────────────────────────────────────────────────────────

function StatusScreen({ record }: { record: VerificationRecord }) {
  const map: Record<VerificationStatus, { icon: React.ReactNode; title: string; desc: string; color: string }> = {
    pending: {
      icon:  <Clock size={36} style={{ color: "#F59E0B" }} />,
      title: "Application Received",
      desc:  "Your verification is in our review queue. We typically respond within 2–3 business days.",
      color: "#F59E0B",
    },
    under_review: {
      icon:  <Shield size={36} style={{ color: "#3B82F6" }} />,
      title: "Under Review",
      desc:  "Our team is reviewing your documents. You'll receive an email once a decision is made.",
      color: "#3B82F6",
    },
    approved: {
      icon:  <CheckCircle size={36} style={{ color: "#10B981" }} />,
      title: "Verified Creator",
      desc:  "Your account is verified. You can now list products on the LUMIS marketplace.",
      color: "#10B981",
    },
    rejected: {
      icon:  <AlertCircle size={36} style={{ color: "#EF4444" }} />,
      title: "Application Not Approved",
      desc:  record.rejection_reason ?? "Your application was not approved at this time. Please review the requirements and resubmit.",
      color: "#EF4444",
    },
    suspended: {
      icon:  <AlertCircle size={36} style={{ color: "#EF4444" }} />,
      title: "Account Suspended",
      desc:  "Your creator account has been suspended. Please contact support.",
      color: "#EF4444",
    },
  };
  const s = map[record.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ textAlign: "center", padding: "40px 0" }}
    >
      <div style={{ marginBottom: 20 }}>{s.icon}</div>
      <h2 style={{ fontSize: 22, fontFamily: "var(--font-display)", fontStyle: "italic", marginBottom: 10 }}>
        {s.title}
      </h2>
      <p style={{ fontSize: 13, opacity: 0.6, maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.7 }}>
        {s.desc}
      </p>

      {record.status === "approved" && (
        <a href="/creator/dashboard"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px",
            background: "#10B981", color: "#fff", borderRadius: 24, fontSize: 13, fontWeight: 600,
            textDecoration: "none" }}>
          Go to Dashboard <ExternalLink size={13} />
        </a>
      )}
      {(record.status === "rejected") && (
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "10px 22px", background: "var(--color-terra, #A85A3E)", color: "#fff",
            borderRadius: 24, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
          Resubmit Application
        </button>
      )}

      <div style={{ marginTop: 24, fontSize: 11, opacity: 0.35, fontFamily: "var(--font-mono)" }}>
        Submitted: {new Date(record.submitted_at).toLocaleDateString()}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreatorVerifyPage() {
  const [step, setStep]               = useState(0);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [existingRecord, setExisting] = useState<VerificationRecord | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    business_name:    "",
    business_type:    "",
    country:          "ZA",
    portfolio_url:    "",
    instagram_handle: "",
  });

  // Load existing verification status on mount
  useEffect(() => {
    fetch("/api/creator/verification", { credentials: "include" })
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) setExisting(data as VerificationRecord);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const update = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/verification", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          business_name:    form.business_name,
          business_type:    form.business_type,
          country:          form.country,
          portfolio_url:    form.portfolio_url || undefined,
          instagram_handle: form.instagram_handle || undefined,
        }),
      });
      if (!res.ok) {
        const { error: e } = await res.json() as { error: string };
        setError(e ?? "Submission failed.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(0,0,0,0.1)",
          borderTop: "3px solid var(--color-terra, #A85A3E)", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // ── Existing record with terminal status ───────────────────────────────────
  if (existingRecord && !submitted &&
      ["pending", "under_review", "approved", "suspended"].includes(existingRecord.status)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 20px" }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <StatusScreen record={existingRecord} />
        </div>
      </div>
    );
  }

  // ── Post-submit success ────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 20px" }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <StatusScreen record={{
            id: "new", status: "pending",
            business_name: form.business_name, business_type: form.business_type as BusinessType,
            country: form.country, submitted_at: new Date().toISOString(),
            reviewed_at: null, rejection_reason: null,
          }} />
        </div>
      </div>
    );
  }

  // ── Multi-step form ────────────────────────────────────────────────────────
  const canProceed0 = form.business_name.trim().length >= 2 && form.business_type !== "";
  const canProceed1 = true; // portfolio optional
  const canProceed2 = true; // docs optional for MVP (paths uploaded separately)

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px", maxWidth: 540, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Shield size={12} style={{ color: "var(--color-terra-mid, #C97D5A)" }} />
          <span style={{ fontSize: 10, letterSpacing: "0.2em", opacity: 0.4, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
            Creator Verification
          </span>
        </div>
        <h1 style={{ fontSize: 26, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
          Become a LUMIS Creator
        </h1>
        <p style={{ fontSize: 13, opacity: 0.5, marginTop: 6, lineHeight: 1.6 }}>
          Verified creators can list nail products and earn commission on every sale.
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{
              height: 3, borderRadius: 2,
              background: i <= step ? "var(--color-terra, #A85A3E)" : "rgba(0,0,0,0.08)",
              transition: "background 0.3s",
            }} />
            <p style={{ fontSize: 9, marginTop: 5, opacity: i === step ? 0.8 : 0.35,
              fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              {s}
            </p>
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">

        {/* Step 0 — Business Info */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Field label="Business / Studio Name" required>
              <input value={form.business_name} onChange={(e) => update("business_name", e.target.value)}
                placeholder="e.g. Nails by Amara" style={inputStyle} maxLength={200} />
            </Field>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Business Type <span style={{ color: "var(--color-terra)" }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {BUSINESS_TYPES.map((bt) => (
                  <button key={bt.value} onClick={() => update("business_type", bt.value)}
                    style={{
                      padding: "14px 16px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                      border: form.business_type === bt.value
                        ? "2px solid var(--color-terra, #A85A3E)"
                        : "1px solid rgba(0,0,0,0.12)",
                      background: form.business_type === bt.value ? "rgba(168,90,62,0.06)" : "rgba(249,246,242,0.6)",
                    }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{bt.label}</p>
                    <p style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.4 }}>{bt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Country">
              <select value={form.country} onChange={(e) => update("country", e.target.value)} style={inputStyle}>
                <option value="ZA">South Africa</option>
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
                <option value="AU">Australia</option>
                <option value="NG">Nigeria</option>
                <option value="KE">Kenya</option>
                <option value="GH">Ghana</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </motion.div>
        )}

        {/* Step 1 — Portfolio & Social */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Field label="Portfolio URL" hint="Your website, Linktree, or online portfolio (optional)">
              <input value={form.portfolio_url} onChange={(e) => update("portfolio_url", e.target.value)}
                placeholder="https://yourportfolio.com" type="url" style={inputStyle} maxLength={500} />
            </Field>
            <Field label="Instagram Handle" hint="Without the @ symbol (optional)">
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                  fontSize: 13, opacity: 0.4 }}>@</span>
                <input value={form.instagram_handle} onChange={(e) => update("instagram_handle", e.target.value)}
                  placeholder="your_handle" style={{ ...inputStyle, paddingLeft: 28 }} maxLength={80} />
              </div>
            </Field>
            <div style={{ padding: "14px 16px", background: "rgba(59,130,246,0.06)", borderRadius: 10,
              border: "1px solid rgba(59,130,246,0.2)", marginTop: 8 }}>
              <p style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.7 }}>
                Portfolio links help our team verify your work quality. Creators with established portfolios are typically approved faster.
              </p>
            </div>
          </motion.div>
        )}

        {/* Step 2 — Documents */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div style={{ padding: "16px 18px", background: "rgba(245,158,11,0.06)", borderRadius: 10,
              border: "1px solid rgba(245,158,11,0.25)", marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Why we need documents</p>
              <p style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.6 }}>
                Identity verification protects our marketplace from fraud and complies with POPIA / GDPR requirements
                for business relationships. Documents are stored encrypted and reviewed only by LUMIS compliance staff.
              </p>
            </div>

            <UploadPlaceholder label="Identity Document" hint="South African ID, passport, or driver's licence" />
            <UploadPlaceholder label="Business Registration" hint="CIPC certificate, sole trader declaration, etc. (optional for individuals)" />
          </motion.div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Review your application</h3>

            <ReviewRow label="Business Name" value={form.business_name} />
            <ReviewRow label="Business Type" value={BUSINESS_TYPES.find((b) => b.value === form.business_type)?.label ?? "—"} />
            <ReviewRow label="Country" value={form.country} />
            <ReviewRow label="Portfolio URL" value={form.portfolio_url || "Not provided"} />
            <ReviewRow label="Instagram" value={form.instagram_handle ? `@${form.instagram_handle}` : "Not provided"} />

            <div style={{ padding: "14px 16px", background: "rgba(168,90,62,0.05)", borderRadius: 10,
              border: "1px solid rgba(168,90,62,0.2)", marginTop: 20 }}>
              <p style={{ fontSize: 11, lineHeight: 1.7, opacity: 0.6 }}>
                By submitting, you confirm that all information is accurate and that you agree to the{" "}
                <a href="/terms/creator" style={{ color: "var(--color-terra)" }}>Creator Terms of Service</a>.
                LUMIS will process your data in accordance with our{" "}
                <a href="/privacy" style={{ color: "var(--color-terra)" }}>Privacy Policy</a>.
              </p>
            </div>

            {error && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(239,68,68,0.08)",
                borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
                <p style={{ fontSize: 12, color: "#B91C1C" }}>{error}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
              border: "1px solid rgba(0,0,0,0.12)", borderRadius: 24, background: "none", cursor: "pointer", fontSize: 13 }}>
            <ChevronLeft size={15} /> Back
          </button>
        ) : <div />}

        {step < 3 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && !canProceed0}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 22px",
              background: "var(--color-terra, #A85A3E)", color: "#fff", borderRadius: 24,
              border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              opacity: (step === 0 && !canProceed0) ? 0.4 : 1,
            }}>
            Continue <ChevronRight size={15} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 22px",
              background: "var(--color-terra, #A85A3E)", color: "#fff", borderRadius: 24,
              border: "none", fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}>
            {submitting ? "Submitting…" : "Submit Application"} {!submitting && <ChevronRight size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: "var(--color-terra)" }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 11, opacity: 0.45, marginBottom: 6 }}>{hint}</p>}
      {children}
    </div>
  );
}

function UploadPlaceholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ marginBottom: 16, padding: "20px", border: "2px dashed rgba(0,0,0,0.12)",
      borderRadius: 10, textAlign: "center", cursor: "pointer",
      background: "rgba(249,246,242,0.4)" }}>
      <Upload size={20} style={{ opacity: 0.3, marginBottom: 8 }} />
      <p style={{ fontSize: 12, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>{hint}</p>
      <p style={{ fontSize: 10, opacity: 0.3, marginTop: 8, fontFamily: "var(--font-mono)" }}>
        Document upload available after submission (coming Sprint 5)
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0",
      borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <span style={{ fontSize: 12, opacity: 0.5 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.12)", background: "rgba(249,246,242,0.7)",
  fontSize: 13, boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
  textTransform: "uppercase", opacity: 0.5, marginBottom: 8,
};
