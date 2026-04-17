/**
 * GET  /api/orders  — list the authenticated user's own orders
 * POST /api/orders  — create a new order from cart
 *
 * Security:
 *   • Both verbs require a valid Supabase JWT (requireAuth).
 *   • Rate-limited: 20 req/min per IP (sensitive — involves money).
 *   • Input is validated before any DB write.
 *   • FAILS CLOSED when Supabase env vars are absent (no bypass).
 */

import { NextRequest, NextResponse } from "next/server";
import { products as PRODUCTS } from "@/data/products";
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "orders", LIMITS.sensitive);
  if (!ok) return rlRes!;

  const { error: authError } = await requireAuth(req);
  if (authError) return authError;

  // Production:
  // const { data: { user } } = await supabase.auth.getUser(token);
  // const { data } = await supabase.from("orders")
  //   .select("*, order_items(*)")
  //   .eq("user_id", user.id)
  //   .order("created_at", { ascending: false });

  return NextResponse.json({ data: [], total: 0 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { ok, response: rlRes } = rateLimit(req, "orders", LIMITS.sensitive);
  if (!ok) return rlRes!;

  const { error: authError } = await requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json() as {
      items: { productId: string; quantity: number; shapeUsed?: string }[];
      shippingAddress?: Record<string, string>;
    };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Cap cart size to prevent abuse
    if (body.items.length > 50) {
      return NextResponse.json({ error: "Cart exceeds maximum item count" }, { status: 400 });
    }

    const lineItems = [];
    let subtotal = 0;

    for (const item of body.items) {
      if (typeof item.productId !== "string" || !item.productId) {
        return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
      }
      const product = PRODUCTS.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: `Unknown product: ${item.productId}` }, { status: 400 });
      }
      if (typeof item.quantity !== "number" || item.quantity < 1 || item.quantity > 99) {
        return NextResponse.json({ error: `Invalid quantity for ${item.productId}` }, { status: 400 });
      }
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      lineItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        shapeUsed: typeof item.shapeUsed === "string" ? item.shapeUsed : product.shape,
        lineTotal,
      });
    }

    const shippingCost = subtotal >= 100 ? 0 : 9.95;
    const total = subtotal + shippingCost;

    const order = {
      id: crypto.randomUUID(),
      status: "pending",
      subtotal: Math.round(subtotal * 100) / 100,
      shippingCost,
      total: Math.round(total * 100) / 100,
      items: lineItems,
      shippingAddress: body.shippingAddress ?? null,
      createdAt: new Date().toISOString(),
    };

    // Production:
    // 1. Insert into public.orders
    // 2. Insert into public.order_items
    // 3. Create Stripe PaymentIntent
    // 4. Return order.id + stripe client_secret

    return NextResponse.json(
      { data: order, message: "Order created — proceed to payment" },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
