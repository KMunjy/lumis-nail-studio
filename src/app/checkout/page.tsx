"use client";

/**
 * /checkout — LUMIS Checkout  v1.0
 *
 * Functional MVP checkout:
 *  1. Order summary — reads cart from TryOnContext
 *  2. Shipping address form — validated before submit
 *  3. Payment placeholder — Stripe integration scaffold (client_secret flow)
 *  4. Order confirmation — stores order ID in localStorage, clears cart
 *
 * Production wiring required:
 *  - POST /api/orders → returns { data: { id, stripeClientSecret } }
 *  - Stripe Elements <PaymentElement> with client_secret
 *  - supabase.auth.getSession() → Bearer token for API call
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, Truck, CreditCard, CheckCircle, ArrowLeft, AlertCircle } from "lucide-react";
import { useTryOn } from "@/store/try-on-context";
import { products as PRODUCTS } from "@/data/products";
import type { Product } from "@/data/products";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShippingAddress {
  fullName:  string;
  line1:     string;
  line2:     string;
  city:      string;
  state:     string;
  postcode:  string;
  country:   string;
}

type CheckoutStep = "summary" | "shipping" | "payment" | "confirmation";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LineItem({ product, quantity }: { product: Product; quantity: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--color-border-light)" }}>
      {/* Swatch */}
      <div style={{
        width: 48, height: 48, borderRadius: 6, flexShrink: 0, overflow: "hidden",
        background: `linear-gradient(160deg, ${product.topColor}, ${product.bottomColor})`,
        border: "1px solid var(--color-border)",
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--color-ink)" }}>{product.name}</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-ink-light)", letterSpacing: "0.08em", marginTop: 2 }}>
          {product.shape} · {product.finish} · Qty {quantity}
        </p>
      </div>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--color-ink)", flexShrink: 0 }}>
        ${(product.price * quantity).toFixed(2)}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { state, clearCart } = useTryOn();

  const [step,        setStep]        = useState<CheckoutStep>("summary");
  const [shipping,    setShipping]    = useState<ShippingAddress>({ fullName: "", line1: "", line2: "", city: "", state: "", postcode: "", country: "US" });
  const [shippingErr, setShippingErr] = useState<Partial<ShippingAddress>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [orderId,     setOrderId]     = useState<string | null>(null);

  // ── Derived cart ────────────────────────────────────────────────────────────
  const lineItems = state.cart.flatMap((item: { productId: string; quantity: number }) => {
    const product = PRODUCTS.find((p) => p.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  });

  const subtotal     = lineItems.reduce((s: number, { product, quantity }: { product: Product; quantity: number }) => s + product.price * quantity, 0);
  const shippingCost = subtotal >= 100 ? 0 : 9.95;
  const total        = subtotal + shippingCost;

  // ── Empty cart ───────────────────────────────────────────────────────────────
  if (lineItems.length === 0 && step !== "confirmation") {
    return (
      <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <ShoppingBag size={40} style={{ color: "var(--color-ink-ghost)" }} />
        <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontStyle: "italic", color: "var(--color-ink)" }}>Your bag is empty</p>
        <Link href="/studio" className="btn-primary" style={{ padding: "12px 28px", textDecoration: "none", borderRadius: 2 }}>
          Browse Studio
        </Link>
      </div>
    );
  }

  // ── Shipping validation ──────────────────────────────────────────────────────
  function validateShipping(): boolean {
    const errs: Partial<ShippingAddress> = {};
    if (!shipping.fullName.trim()) errs.fullName = "Required";
    if (!shipping.line1.trim())    errs.line1    = "Required";
    if (!shipping.city.trim())     errs.city     = "Required";
    if (!shipping.postcode.trim()) errs.postcode = "Required";
    if (!shipping.country.trim())  errs.country  = "Required";
    setShippingErr(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit order (DEF-014 scaffold) ─────────────────────────────────────────
  async function handlePlaceOrder() {
    setSubmitting(true);
    setApiError(null);
    try {
      const body = {
        items: state.cart.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: {
          fullName:  shipping.fullName,
          line1:     shipping.line1,
          line2:     shipping.line2 || undefined,
          city:      shipping.city,
          state:     shipping.state || undefined,
          postcode:  shipping.postcode,
          country:   shipping.country,
        },
      };

      // In production: get JWT from Supabase session, pass as Bearer
      // const { data: { session } } = await supabase.auth.getSession();
      // const token = session?.access_token ?? "";
      const token = "dev-token"; // dev placeholder

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        setApiError(error ?? "Something went wrong");
        return;
      }

      const { data } = await res.json() as { data: { id: string } };
      const id = data?.id ?? `ord_${Date.now()}`;
      setOrderId(id);

      // Store confirmation in localStorage for the confirmation page
      try { localStorage.setItem("lumis_last_order_id", id); } catch { /* ignore */ }

      // Clear cart
      clearCart();

      setStep("confirmation");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>

      {/* Progress indicator */}
      {(() => {
        const STEPS = ["summary", "shipping", "payment"] as const;
        const stepIndex = STEPS.indexOf(step as typeof STEPS[number]);
        const currentIndex = stepIndex === -1 ? STEPS.length : stepIndex;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 40 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: i <= currentIndex ? "var(--color-pink)" : "var(--color-border)",
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: i <= currentIndex ? "#fff" : "var(--color-ink-ghost)",
                  transition: "background-color 0.2s",
                }}>
                  {i + 1}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: step === s ? "var(--color-ink)" : "var(--color-ink-light)" }}>
                  {s}
                </span>
                {i < 2 && <div style={{ width: 24, height: 1, backgroundColor: "var(--color-border)" }} />}
              </div>
            ))}
          </div>
        );
      })()}

      <AnimatePresence mode="wait">

        {/* ── Step 1: Order summary ─────────────────────────────────────── */}
        {step === "summary" && (
          <motion.div key="summary" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <ShoppingBag size={20} style={{ color: "var(--color-ink)" }} />
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontStyle: "italic", color: "var(--color-ink)" }}>Your bag</h1>
            </div>

            {lineItems.map(({ product, quantity }: { product: Product; quantity: number }) => (
              <LineItem key={product.id} product={product} quantity={quantity} />
            ))}

            <div style={{ marginTop: 24, padding: "16px 0", borderTop: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink-mid)" }}>Subtotal</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13 }}>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink-mid)" }}>Shipping</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: shippingCost === 0 ? "green" : undefined }}>
                  {shippingCost === 0 ? "Free" : `$${shippingCost.toFixed(2)}`}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600 }}>Total</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600 }}>${total.toFixed(2)}</span>
              </div>
            </div>

            {subtotal < 100 && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-ink-light)", letterSpacing: "0.10em", marginBottom: 20 }}>
                Add ${(100 - subtotal).toFixed(2)} more for free shipping
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <Link href="/cart" style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-mid)", textDecoration: "none" }}>
                <ArrowLeft size={13} /> Edit bag
              </Link>
              <button
                onClick={() => setStep("shipping")}
                className="btn-primary"
                style={{ flex: 1, height: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 2, border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                <Truck size={14} /> Continue to shipping
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Shipping ──────────────────────────────────────────── */}
        {step === "shipping" && (
          <motion.div key="shipping" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <Truck size={20} style={{ color: "var(--color-ink)" }} />
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontStyle: "italic", color: "var(--color-ink)" }}>Shipping address</h1>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {([
                { key: "fullName", label: "Full name", span: 2, placeholder: "Jane Smith" },
                { key: "line1",    label: "Address",   span: 2, placeholder: "123 Main St" },
                { key: "line2",    label: "Apt / Suite (optional)", span: 2, placeholder: "" },
                { key: "city",     label: "City",      span: 1, placeholder: "New York" },
                { key: "state",    label: "State",     span: 1, placeholder: "NY" },
                { key: "postcode", label: "Post code", span: 1, placeholder: "10001" },
                { key: "country",  label: "Country",   span: 1, placeholder: "US" },
              ] as { key: keyof ShippingAddress; label: string; span: 1 | 2; placeholder: string }[]).map(({ key, label, span, placeholder }) => (
                <div key={key} style={{ gridColumn: `span ${span}` }}>
                  <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-mid)", marginBottom: 6 }}>
                    {label}
                  </label>
                  <input
                    value={shipping[key]}
                    onChange={(e) => { setShipping(prev => ({ ...prev, [key]: e.target.value })); if (shippingErr[key]) setShippingErr(prev => ({ ...prev, [key]: undefined })); }}
                    placeholder={placeholder}
                    style={{
                      width: "100%", height: 42, padding: "0 14px",
                      border: `1px solid ${shippingErr[key] ? "var(--color-pink)" : "var(--color-border)"}`,
                      borderRadius: 2, outline: "none", boxSizing: "border-box",
                      fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink)",
                      backgroundColor: "#fff",
                    }}
                  />
                  {shippingErr[key] && (
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--color-pink)", marginTop: 4 }}>{shippingErr[key]}</p>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => setStep("summary")} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-mid)", background: "none", border: "none", cursor: "pointer" }}>
                <ArrowLeft size={13} /> Back
              </button>
              <button
                onClick={() => { if (validateShipping()) setStep("payment"); }}
                className="btn-primary"
                style={{ flex: 1, height: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 2, border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                <CreditCard size={14} /> Continue to payment
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Payment ───────────────────────────────────────────── */}
        {step === "payment" && (
          <motion.div key="payment" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <CreditCard size={20} style={{ color: "var(--color-ink)" }} />
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontStyle: "italic", color: "var(--color-ink)" }}>Payment</h1>
            </div>

            {/* Stripe Elements mount point */}
            <div style={{
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              padding: 24,
              backgroundColor: "var(--color-surface)",
              marginBottom: 24,
            }}>
              {/* TODO: Mount <PaymentElement> from @stripe/react-stripe-js here
                  when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set.
                  Steps:
                  1. POST /api/orders → get stripeClientSecret
                  2. <Elements stripe={stripePromise} options={{ clientSecret }}>
                  3. <PaymentElement />
                  4. stripe.confirmPayment(...)
              */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-ink-light)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  Stripe payment — integration pending
                </p>
                <div style={{ height: 48, backgroundColor: "var(--color-surface-mid)", borderRadius: 4, border: "1px dashed var(--color-border-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-ghost)" }}>Card number · Expiry · CVC</p>
                </div>
              </div>
            </div>

            {/* Order summary recap */}
            <div style={{ padding: "14px 16px", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink-mid)" }}>Order total</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600 }}>${total.toFixed(2)}</span>
              </div>
            </div>

            {apiError && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", backgroundColor: "#FFF0F0", border: "1px solid var(--color-pink)", borderRadius: 4, marginBottom: 16 }}>
                <AlertCircle size={14} style={{ color: "var(--color-pink)", flexShrink: 0 }} />
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-pink)" }}>{apiError}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("shipping")} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-mid)", background: "none", border: "none", cursor: "pointer" }}>
                <ArrowLeft size={13} /> Back
              </button>
              <button
                onClick={() => { void handlePlaceOrder(); }}
                disabled={submitting}
                className="btn-primary"
                style={{ flex: 1, height: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 2, border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                {submitting ? "Placing order…" : `Place order · $${total.toFixed(2)}`}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Confirmation ──────────────────────────────────────── */}
        {step === "confirmation" && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "60px 20px" }}>
            <CheckCircle size={52} style={{ color: "var(--color-pink)", margin: "0 auto 20px" }} />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontStyle: "italic", color: "var(--color-ink)", marginBottom: 8 }}>
              Order confirmed!
            </h1>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-ink-light)", letterSpacing: "0.14em", marginBottom: 4 }}>
              ORDER ID
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--color-ink)", marginBottom: 32 }}>
              {orderId}
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--color-ink-mid)", lineHeight: 1.6, maxWidth: 340, margin: "0 auto 32px" }}>
              We&apos;ve received your order. You&apos;ll get an email confirmation shortly.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/account/looks")}
                className="btn-primary"
                style={{ padding: "12px 24px", borderRadius: 2, border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                View my looks
              </button>
              <button
                onClick={() => router.push("/studio")}
                style={{ padding: "12px 24px", borderRadius: 2, border: "1px solid var(--color-border)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-mid)", background: "#fff", letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                Back to studio
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
