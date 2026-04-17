/**
 * GET    /api/products/[id]  — fetch single product
 * PATCH  /api/products/[id]  — update product (admin / creator)
 * DELETE /api/products/[id]  — soft-delete (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { products as PRODUCTS } from "@/data/products";

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const product = PRODUCTS.find((p) => p.id === id);

  if (!product) {
    return NextResponse.json({ error: `Product not found: ${id}` }, { status: 404 });
  }

  return NextResponse.json({ data: product });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) {
    return NextResponse.json({ error: `Product not found: ${id}` }, { status: 404 });
  }

  try {
    const body = await req.json();

    // Validate updatable fields
    const allowed = ["name", "price", "topColor", "midColor", "bottomColor", "shape", "description", "stockCount"];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Production: await supabase.from("products").update(updates).eq("id", id)
    return NextResponse.json({ data: { ...product, ...updates } });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const authHeader = _req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) {
    return NextResponse.json({ error: `Product not found: ${id}` }, { status: 404 });
  }

  // Production: soft-delete → update is_active = false
  // await supabase.from("products").update({ is_active: false }).eq("id", id)
  return NextResponse.json({ message: `Product ${id} deactivated` });
}
