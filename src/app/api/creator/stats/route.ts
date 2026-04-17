/**
 * GET /api/creator/stats — creator dashboard metrics (creator or admin role only)
 *
 * Security:
 *   • JWT validated via Supabase Auth on every request.
 *   • Role must be "creator" or "admin" — customer is rejected (403).
 *   • FAILS CLOSED: if Supabase env vars are absent the route returns 503.
 *     There is NO dev-mode bypass. (P1-SEC-02 fix)
 *   • Rate-limited: 20 req/min per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { products as PRODUCTS } from "@/data/products";
import { requireRole } from "@/lib/auth-guard";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Rate limit ──────────────────────────────────────────────────────────────
  const { ok, response: rlRes } = rateLimit(req, "creator-stats", LIMITS.sensitive);
  if (!ok) return rlRes!;

  // ── Auth + RBAC ─────────────────────────────────────────────────────────────
  const { error: authError } = await requireRole(req, ["creator", "admin"]);
  if (authError) return authError;

  // ── Data ────────────────────────────────────────────────────────────────────
  // Production:
  // const user = await getAuthUser(req);
  // const { data: designer } = await supabase.from("designers").select("*").eq("user_id", user.id).single();
  // const { data: products } = await supabase.from("products").select("*").eq("designer_id", designer.id);
  // const { data: revenue } = await supabase.from("designer_revenue").select("*").eq("designer_id", designer.id).single();

  const stats = {
    products: {
      total: PRODUCTS.length,
      active: PRODUCTS.length,
      items: PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        shape: p.shape,
        stockCount: 100,
      })),
    },
    earnings: {
      commissionRate: 20,
      grossRevenue: 0,
      yourEarnings: 0,
      pendingPayout: 0,
      totalPaid: 0,
    },
    performance: {
      totalTryOns: 0,
      conversionRate: 0,
      captureRate: 0,
      topShape: "Almond",
      avgSessionDuration: 0,
    },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json({ data: stats });
}
