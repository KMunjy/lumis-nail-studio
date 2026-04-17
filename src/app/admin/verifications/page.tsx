"use client";

/**
 * /admin/verifications — Creator verification review queue (P1-1 — G-04)
 *
 * Admin-only page. Lists all creator verification submissions with their status.
 * Admins can approve, reject, or mark as under_review.
 * All actions are written to admin_audit_log.
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle, XCircle, Clock, Eye, Shield,
  RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type VerificationStatus = "pending" | "under_review" | "approved" | "rejected" | "suspended";

interface VerificationRecord {
  id:               string;
  user_id:          string;
  status:           VerificationStatus;
  business_name:    string;
  business_type:    string;
  country:          string;
  portfolio_url:    string | null;
  instagram_handle: string | null;
  id_document_path: string | null;
  submitted_at:     string;
  reviewed_at:      string | null;
  rejection_reason: string | null;
  admin_notes:      string | null;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VerificationStatus }) {
  const map: Record<VerificationStatus, { bg: string; color: string; label: string }> = {
    pending:      { bg: "#FEF3C7", color: "#92400E", label: "Pending"      },
    under_review: { bg: "#DBEAFE", color: "#1E40AF", label: "Under Review" },
    approved:     { bg: "#D1FAE5", color: "#065F46", label: "Approved"     },
    rejected:     { bg: "#FEE2E2", color: "#991B1B", label: "Rejected"     },
    suspended:    { bg: "#F3F4F6", color: "#374151", label: "Suspended"    },
  };
  const s = map[status];
  return (
    <span style={{ fontSize: 10, padding: "3px 9px", background: s.bg, color: s.color,
      borderRadius: 20, fontWeight: 700, letterSpacing: "0.08em" }}>
      {s.label}
    </span>
  );
}

// ── Expanded row ──────────────────────────────────────────────────────────────

function ExpandedRow({ record, onAction }: {
  record: VerificationRecord;
  onAction: (id: string, status: VerificationStatus, reason?: string) => void;
}) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [acting, setActing]                   = useState(false);

  async function act(status: VerificationStatus) {
    setActing(true);
    await onAction(record.id, status, rejectionReason || undefined);
    setActing(false);
  }

  return (
    <div style={{ padding: "16px 20px", background: "rgba(249,246,242,0.5)",
      borderTop: "1px solid rgba(0,0,0,0.05)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Detail label="User ID"       value={record.user_id.slice(0, 16) + "…"} mono />
        <Detail label="Country"       value={record.country} />
        <Detail label="Submitted"     value={new Date(record.submitted_at).toLocaleDateString()} />
        <Detail label="Portfolio"     value={record.portfolio_url ?? "—"} link={record.portfolio_url ?? undefined} />
        <Detail label="Instagram"     value={record.instagram_handle ? `@${record.instagram_handle}` : "—"} />
        <Detail label="ID Document"   value={record.id_document_path ? "Uploaded" : "Not provided"} />
      </div>

      {record.rejection_reason && (
        <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, marginBottom: 14 }}>
          <p style={{ fontSize: 11, color: "#B91C1C" }}>Rejection reason: {record.rejection_reason}</p>
        </div>
      )}

      {/* Action buttons — only for pending / under_review */}
      {(record.status === "pending" || record.status === "under_review") && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <button onClick={() => act("under_review")} disabled={acting || record.status === "under_review"}
            style={actionBtn("#3B82F6")}>
            <Eye size={12} /> Mark Under Review
          </button>
          <button onClick={() => act("approved")} disabled={acting}
            style={actionBtn("#10B981")}>
            <CheckCircle size={12} /> Approve
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 280 }}>
            <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Rejection reason (required to reject)"
              style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)",
                fontSize: 12, background: "#fff" }} />
            <button onClick={() => act("rejected")} disabled={acting || !rejectionReason.trim()}
              style={actionBtn("#EF4444")}>
              <XCircle size={12} /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono, link }: {
  label: string; value: string; mono?: boolean; link?: string;
}) {
  return (
    <div>
      <p style={{ fontSize: 10, opacity: 0.4, fontFamily: "var(--font-mono)", textTransform: "uppercase",
        letterSpacing: "0.12em", marginBottom: 3 }}>{label}</p>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: "var(--color-terra)", fontFamily: mono ? "var(--font-mono)" : undefined }}>
          {value}
        </a>
      ) : (
        <p style={{ fontSize: 12, fontFamily: mono ? "var(--font-mono)" : undefined }}>{value}</p>
      )}
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 5, padding: "7px 14px",
    background: color, color: "#fff", border: "none", borderRadius: 20,
    fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminVerificationsPage() {
  const [records, setRecords]     = useState<VerificationRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<VerificationStatus | "all">("pending");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/verifications", { credentials: "include" });
      if (res.ok) {
        const { data } = await res.json() as { data: VerificationRecord[] };
        setRecords(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function handleAction(
    id: string,
    status: VerificationStatus,
    rejection_reason?: string,
  ) {
    const res = await fetch("/api/creator/verification", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ verification_id: id, status, rejection_reason }),
    });
    if (res.ok) {
      setActionMsg(`✓ Verification ${status}`);
      setTimeout(() => setActionMsg(null), 3000);
      await loadRecords();
      setExpanded(null);
    }
  }

  const filtered = filter === "all" ? records : records.filter((r) => r.status === filter);

  const counts: Record<string, number> = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Shield size={12} style={{ color: "var(--color-terra-mid)" }} />
            <span style={{ fontSize: 10, letterSpacing: "0.2em", opacity: 0.4, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
              Admin · Creator Verifications
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontFamily: "var(--font-display)", fontStyle: "italic" }}>
            Verification Queue
          </h1>
        </div>
        <button onClick={loadRecords} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            border: "1px solid rgba(0,0,0,0.1)", borderRadius: 20, background: "none", cursor: "pointer", fontSize: 12 }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Action toast */}
      {actionMsg && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: "10px 16px", background: "#D1FAE5", borderRadius: 8, marginBottom: 16,
            border: "1px solid rgba(16,185,129,0.3)", fontSize: 13, color: "#065F46" }}>
          {actionMsg}
        </motion.div>
      )}

      {/* Stats chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {(["all", "pending", "under_review", "approved", "rejected"] as const).map((s) => {
          const count = s === "all" ? records.length : (counts[s] ?? 0);
          return (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: "5px 13px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: filter === s ? "2px solid var(--color-terra)" : "1px solid rgba(0,0,0,0.1)",
                background: filter === s ? "rgba(168,90,62,0.08)" : "transparent",
                color: filter === s ? "var(--color-terra)" : "rgba(0,0,0,0.5)",
              }}>
              {s === "all" ? "All" : s.replace("_", " ")} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", opacity: 0.4 }}>
          <RefreshCw size={24} style={{ animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", opacity: 0.4 }}>
          <p style={{ fontSize: 13 }}>No {filter !== "all" ? filter.replace("_", " ") : ""} verifications.</p>
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto 28px",
            gap: 12, padding: "10px 18px", background: "rgba(0,0,0,0.02)",
            borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            {["Business", "Type", "Submitted", "Status", ""].map((h, i) => (
              <p key={i} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", opacity: 0.4, textTransform: "uppercase" }}>{h}</p>
            ))}
          </div>

          {filtered.map((record, i) => (
            <div key={record.id}>
              <div
                onClick={() => setExpanded(expanded === record.id ? null : record.id)}
                style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto 28px",
                  gap: 12, alignItems: "center", padding: "13px 18px", cursor: "pointer",
                  borderBottom: i < filtered.length - 1 || expanded === record.id ? "1px solid rgba(0,0,0,0.05)" : "none",
                  background: i % 2 === 0 ? "rgba(249,246,242,0.4)" : "transparent",
                }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{record.business_name}</p>
                  <p style={{ fontSize: 10, opacity: 0.4, fontFamily: "var(--font-mono)" }}>
                    {record.id.slice(0, 12)}…
                  </p>
                </div>
                <p style={{ fontSize: 12, opacity: 0.6, textTransform: "capitalize" }}>{record.business_type}</p>
                <p style={{ fontSize: 12, opacity: 0.5 }}>{new Date(record.submitted_at).toLocaleDateString()}</p>
                <StatusBadge status={record.status} />
                {expanded === record.id
                  ? <ChevronUp size={14} style={{ opacity: 0.4 }} />
                  : <ChevronDown size={14} style={{ opacity: 0.4 }} />}
              </div>

              {expanded === record.id && (
                <ExpandedRow record={record} onAction={handleAction} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
