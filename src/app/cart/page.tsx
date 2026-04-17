"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ShoppingBag, Trash2, Plus, Minus, Eye, Star, Gift } from "lucide-react";
import { useTryOn } from "@/store/try-on-context";
import { products } from "@/data/products";
import { NailSwatch } from "@/components/NailSwatch";

// ─── Constants ────────────────────────────────────────────────────────────────
const FREE_SHIPPING_THRESHOLD = 75;  // [F7-3]
const POINTS_PER_DOLLAR       = 10;  // [F7-4] loyalty pts per $1

export default function CartPage() {
  const { state, addToCart, removeFromCart, clearCart } = useTryOn();
  const { cart } = state;

  // [F7-5] Wishlist upsell — products in wishlist but not in cart
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      setWishlistIds(JSON.parse(localStorage.getItem("lumis_wishlist_v1") ?? "[]"));
    } catch { /* ignore */ }
  }, []);

  const lineItems = cart
    .map((item) => ({
      ...item,
      product: products.find((p) => p.id === item.productId),
    }))
    .filter((item) => item.product != null);

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (item.product?.price ?? 0) * item.quantity,
    0
  );

  // [F7-3] Free shipping progress
  const remaining     = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const shippingPct   = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  // [F7-4] Loyalty points
  const earnedPoints  = subtotal * POINTS_PER_DOLLAR;

  // [F7-5] Upsell products: wishlisted but not in cart
  const cartIds       = new Set(cart.map((i) => i.productId));
  const upsellProducts = products.filter(
    (p) => wishlistIds.includes(p.id) && !cartIds.has(p.id)
  );

  return (
    <div style={{ backgroundColor: "#FAFAFA", minHeight: "100vh" }} className="pb-40">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--color-border-light)",
        padding: "20px 20px 16px",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShoppingBag size={18} style={{ color: "var(--color-pink)" }} />
            <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "var(--color-ink)" }}>
              Your Bag
              {cart.length > 0 && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400, color: "var(--color-ink-light)", marginLeft: 8 }}>
                  ({cart.length} {cart.length === 1 ? "item" : "items"})
                </span>
              )}
            </h1>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              style={{
                fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-light)",
                background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
                borderRadius: 4, transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-light)"; }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── [F7-3] Free shipping progress bar ──────────────────────────── */}
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: remaining === 0 ? "rgba(34,197,94,0.08)" : "var(--color-pink-pale)",
              border: `1px solid ${remaining === 0 ? "rgba(34,197,94,0.20)" : "var(--color-pink-border)"}`,
              borderRadius: 8, padding: "12px 16px", marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Gift size={13} style={{ color: remaining === 0 ? "#16A34A" : "var(--color-pink)" }} />
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: remaining === 0 ? "#16A34A" : "var(--color-ink)" }}>
                  {remaining === 0 ? "You've unlocked free shipping!" : `$${remaining.toFixed(0)} away from free shipping`}
                </p>
              </div>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-ink-light)" }}>
                ${FREE_SHIPPING_THRESHOLD} min.
              </span>
            </div>
            <div style={{ height: 4, backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${shippingPct}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: "100%", backgroundColor: remaining === 0 ? "#22C55E" : "var(--color-pink)", borderRadius: 2 }}
              />
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {lineItems.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────────────── */
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--color-border-light)",
                borderRadius: 8, padding: "64px 40px",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                minHeight: "40vh", textAlign: "center",
              }}
            >
              <div style={{
                width: 64, height: 64, backgroundColor: "var(--color-surface)",
                borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
              }}>
                <ShoppingBag size={26} style={{ color: "var(--color-ink-light)" }} strokeWidth={1} />
              </div>
              <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600, color: "var(--color-ink)", marginBottom: 8 }}>
                Nothing here yet
              </h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink-light)", lineHeight: 1.65, maxWidth: 220, marginBottom: 28 }}>
                Try on a look in the studio and add it to your bag.
              </p>
              <Link
                href="/"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                  padding: "12px 24px", borderRadius: 8, textDecoration: "none",
                }}
              >
                Browse Shades <ArrowRight size={13} />
              </Link>
            </motion.div>
          ) : (
            <motion.div key="items" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {/* ── Line items ──────────────────────────────────────────── */}
              <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <AnimatePresence>
                  {lineItems.map((item, i) => {
                    const p = item.product!;
                    return (
                      <motion.div
                        key={item.productId}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10, height: 0, marginBottom: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.28 }}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          backgroundColor: "#FFFFFF",
                          border: "1px solid var(--color-border-light)",
                          borderRadius: 8, padding: "12px 14px",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                        }}
                      >
                        {/* [F7-1] NailSwatch thumbnail */}
                        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48 }}>
                          <NailSwatch
                            shape={p.shape}
                            finish={p.finish}
                            topColor={p.topColor}
                            midColor={p.midColor}
                            bottomColor={p.bottomColor}
                            skinToneHex={p.skinToneHex}
                            glitterDensity={p.glitterDensity}
                            catEyeDir={p.catEyeDir}
                            size="sm"
                          />
                        </div>

                        {/* Product info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.name}
                            </p>
                            {/* [F7-2] Try On quick link */}
                            <Link
                              href={`/studio/${p.id}`}
                              aria-label={`Try on ${p.name}`}
                              title="Try on again"
                              style={{
                                flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                                backgroundColor: "var(--color-pink-pale)",
                                border: "1px solid var(--color-pink-border)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "var(--color-pink)",
                              }}
                            >
                              <Eye size={10} />
                            </Link>
                          </div>
                          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-ink-light)", marginTop: 2 }}>
                            {p.shape} · {p.finish} · ${p.price}
                          </p>
                        </div>

                        {/* Quantity controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => removeFromCart(p.id)}
                            aria-label="Decrease"
                            style={{
                              width: 26, height: 26, borderRadius: 6,
                              border: "1px solid var(--color-border)",
                              backgroundColor: "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", color: "var(--color-ink-mid)",
                            }}
                          >
                            <Minus size={10} />
                          </button>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--color-ink)", minWidth: 18, textAlign: "center" }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => addToCart(p.id)}
                            aria-label="Increase"
                            style={{
                              width: 26, height: 26, borderRadius: 6,
                              border: "1px solid var(--color-border)",
                              backgroundColor: "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", color: "var(--color-ink-mid)",
                            }}
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        {/* Line total + remove */}
                        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 48 }}>
                          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}>
                            ${(p.price * item.quantity).toFixed(0)}
                          </p>
                          <button
                            onClick={() => {
                              for (let q = 0; q < item.quantity; q++) removeFromCart(p.id);
                            }}
                            aria-label={`Remove ${p.name}`}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-ink-light)", marginTop: 4 }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* ── [F7-5] Wishlist upsell strip ───────────────────────── */}
              {upsellProducts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{
                    fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 700,
                    color: "var(--color-ink-light)", letterSpacing: "0.12em",
                    textTransform: "uppercase", marginBottom: 10,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Star size={10} style={{ color: "var(--color-pink)" }} />
                    From your wishlist
                  </p>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }} className="no-scrollbar">
                    {upsellProducts.slice(0, 6).map((p) => (
                      <div
                        key={p.id}
                        style={{
                          flexShrink: 0, width: 100,
                          backgroundColor: "#FFFFFF",
                          border: "1px solid var(--color-border-light)",
                          borderRadius: 8, padding: "10px 8px",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        }}
                      >
                        <NailSwatch shape={p.shape} finish={p.finish} topColor={p.topColor} midColor={p.midColor} bottomColor={p.bottomColor} size="sm" />
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600, color: "var(--color-ink)", textAlign: "center", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--color-ink-light)" }}>${p.price}</p>
                        <button
                          onClick={() => addToCart(p.id)}
                          style={{
                            width: "100%", height: 26, borderRadius: 6,
                            backgroundColor: "var(--color-pink)", border: "none",
                            fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600,
                            color: "#FFFFFF", cursor: "pointer",
                          }}
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Order summary ───────────────────────────────────────── */}
              <div style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid var(--color-border-light)",
                borderRadius: 8, padding: "20px", marginBottom: 12,
              }}>
                {[
                  { label: "Subtotal", value: `$${subtotal}` },
                  { label: "Shipping", value: remaining === 0 ? "Free" : "Calculated at checkout" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-light)" }}>{label}</p>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: remaining === 0 && label === "Shipping" ? "#16A34A" : "var(--color-ink)", fontWeight: remaining === 0 && label === "Shipping" ? 600 : 400 }}>{value}</p>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--color-border-light)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--color-ink)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</p>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 26, fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.02em" }}>${subtotal}</p>
                </div>

                {/* [F7-4] Loyalty points preview */}
                <div style={{
                  marginTop: 12, padding: "8px 12px", borderRadius: 6,
                  backgroundColor: "var(--color-pink-pale)",
                  border: "1px solid var(--color-pink-border)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Star size={12} style={{ color: "var(--color-pink)", flexShrink: 0 }} fill="var(--color-pink)" />
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-ink)" }}>
                    You&apos;ll earn{" "}
                    <span style={{ fontWeight: 700, color: "var(--color-pink)" }}>{earnedPoints.toLocaleString()} pts</span>
                    {" "}with this order
                  </p>
                </div>
              </div>

              {/* ── Checkout CTA ────────────────────────────────────────── */}
              <button
                style={{
                  width: "100%", height: 52,
                  backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                  fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700,
                  letterSpacing: "0.02em", borderRadius: 8, border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 10,
                  boxShadow: "0 4px 16px rgba(232,64,112,0.35)",
                  transition: "background-color 0.18s, box-shadow 0.18s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-pink-hover)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(232,64,112,0.45)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-pink)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(232,64,112,0.35)";
                }}
              >
                Proceed to Checkout <ArrowRight size={14} />
              </button>

              <p style={{
                textAlign: "center", fontFamily: "var(--font-sans)",
                fontSize: 10, color: "var(--color-ink-light)",
                marginTop: 14, letterSpacing: "0.04em",
              }}>
                Secure checkout · Free returns · Virtual Fit Guarantee
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
