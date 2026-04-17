/**
 * GET  /api/products  — list all active products (public, rate-limited)
 * POST /api/products  — create product (admin or creator role only)
 *
 * Security:
 *   • GET is public but rate-limited (60 req/min) to prevent scraping.
 *   • POST requires valid JWT + [admin | creator] role.
 *   • FAILS CLOSED when Supabase env vars are absent (no bypass).
 */

import { NextRequest, NextResponse } from "next/server";
import { products as PRODUCTS } from "@/data/products";
import { requireRole } from "@/lib/auth-guard";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

// GET /api/products — public catalogue
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "products-get", LIMITS.general);
  if (!ok) return rlRes!;

  const { searchParams } = new URL(req.url);
  const shape  = searchParams.get("shape");
  const sortBy = searchParams.get("sort") ?? "name";

  // Production: swap for Supabase client query
  // const supabase = createRouteHandlerClient<Database>({ cookies });
  // let q = supabase.from("products").select("*").eq("is_active", true);
  // if (shape) q = q.eq("shape", shape);
  // const { data, error } = await q;
  // if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let data = shape
    ? PRODUCTS.filter((p) => p.shape === shape)
    : [...PRODUCTS];

  if (sortBy === "price_asc")  data = data.sort((a, b) => a.price - b.price);
  if (sortBy === "price_desc") data = data.sort((a, b) => b.price - a.price);

  return NextResponse.json(
    { data, total: data.length },
    {
      headers: {
        "Cache-Control":     "public, s-maxage=60, stale-while-revalidate=120",
        "X-LUMIS-Renderer":  "v3.0",
      },
    },
  );
}

// POST /api/products — admin / creator only
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "products-write", LIMITS.sensitive);
  if (!ok) return rlRes!;

  const { error: authError } = await requireRole(req, ["admin", "creator"]);
  if (authError) return authError;

  try {
    const body = await req.json();

    const required = ["id", "name", "price", "topColor", "midColor", "bottomColor", "shape"];
    for (const field of required) {
      if (!(field in body)) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }

    const validShapes = ["Almond", "Stiletto", "Oval", "Coffin", "Square"];
    if (!validShapes.includes(body.shape)) {
      return NextResponse.json({ error: `Invalid shape: ${body.shape}` }, { status: 400 });
    }

    if (typeof body.price !== "number" || body.price < 0) {
      return NextResponse.json({ error: "Price must be a non-negative number" }, { status: 400 });
    }

    // Production: insert into Supabase
    // const { data, error } = await supabase.from("products").insert(body).select().single();

    return NextResponse.json({ data: body, message: "Product created" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
