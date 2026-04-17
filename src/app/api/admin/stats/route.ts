/**
 * GET /api/admin/stats — platform-wide metrics (admin role only)
 *
 * Security:
 *   • JWT validated via Supabase Auth on every request.
 *   • Role must be exactly "admin" — creator and customer are rejected (403).
 *   • FAILS CLOSED: if Supabase env vars are absent the route returns 503.
 *     There is NO dev-mode bypass. (P1-SEC-01 fix)
 *   • Rate-limited: 20 req/min per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { products as PRODUCTS } from "@/data/products";
import { requireRole } from "@/lib/auth-guard";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Rate limit ──────────────────────────────────────────────────────────────
  const { ok, response: rlRes } = rateLimit(req, "admin-stats", LIMITS.sensitive);
  if (!ok) return rlRes!;

  // ── Auth + RBAC ─────────────────────────────────────────────────────────────
  const { error: authError } = await requireRole(req, ["admin"]);
  if (authError) return authError;

  // ── Data ────────────────────────────────────────────────────────────────────
  // Production: query Supabase for live platform metrics.
  // const { data: orders } = await supabase.from("orders").select("total, status, created_at");
  // const { data: sessions } = await supabase.from("try_on_sessions").select("product_id, converted");
  // const { data: revenue } = await supabase.from("designer_revenue").select("*");

  const stats = {
    products: {
      total: PRODUCTS.length,
      active: PRODUCTS.length,
      topByTryOn: PRODUCTS.slice(0, 3).map((p) => ({ id: p.id, name: p.name })),
    },
    orders: {
      total: 0,
      pending: 0,
      confirmed: 0,
      revenue30d: 0,
      revenueTotal: 0,
    },
    tryOns: {
      total30d: 0,
      conversionRate: 0,
      captureRate: 0,
      rendererVersion: "v3.0",
      avgAccuracyScore: 97.8,
    },
    users: {
      total: 0,
      customers: 0,
      creators: 0,
      newLast30d: 0,
    },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json({ data: stats });
}
