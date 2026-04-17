/**
 * DIMENSION 2 — Integration Tests: TryOnContext
 *
 * Verifies the cart state manager integrated with:
 *   - React context + useReducer wiring
 *   - localStorage hydration (consent-gated)
 *   - 30-day expiry pruning at hydration time
 *   - Persistence on cart change
 *
 * These are integration tests (not unit tests) because they exercise
 * the reducer, context provider, localStorage adapter, and consent
 * module together — verifying the seams between them.
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { TryOnProvider, useTryOn } from "@/store/try-on-context";
import { giveConsent, withdrawConsentAndEraseData } from "@/lib/consent";
import type { ReactNode } from "react";

const wrapper = ({ children }: { children: ReactNode }) => (
  <TryOnProvider>{children}</TryOnProvider>
);

// ─── Cart CRUD ────────────────────────────────────────────────────────────────

describe("Cart — add / remove / clear", () => {
  it("starts with an empty cart", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    expect(result.current.state.cart).toHaveLength(0);
    expect(result.current.cartCount).toBe(0);
  });

  it("addToCart adds a new item with quantity 1", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    expect(result.current.state.cart).toHaveLength(1);
    expect(result.current.state.cart[0].productId).toBe("lume-01");
    expect(result.current.state.cart[0].quantity).toBe(1);
    expect(result.current.cartCount).toBe(1);
  });

  it("addToCart increments quantity for duplicate product", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    act(() => result.current.addToCart("lume-01"));
    expect(result.current.state.cart).toHaveLength(1);
    expect(result.current.state.cart[0].quantity).toBe(2);
    expect(result.current.cartCount).toBe(2);
  });

  it("addToCart handles multiple distinct products", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    act(() => result.current.addToCart("lume-02"));
    act(() => result.current.addToCart("lume-03"));
    expect(result.current.state.cart).toHaveLength(3);
    expect(result.current.cartCount).toBe(3);
  });

  it("removeFromCart removes the item entirely", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    act(() => result.current.addToCart("lume-02"));
    act(() => result.current.removeFromCart("lume-01"));
    expect(result.current.state.cart).toHaveLength(1);
    expect(result.current.state.cart[0].productId).toBe("lume-02");
  });

  it("removeFromCart on non-existent product is a no-op", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    act(() => result.current.removeFromCart("non-existent"));
    expect(result.current.state.cart).toHaveLength(1);
  });

  it("clearCart empties the cart", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    act(() => result.current.addToCart("lume-02"));
    act(() => result.current.clearCart());
    expect(result.current.state.cart).toHaveLength(0);
    expect(result.current.cartCount).toBe(0);
  });
});

// ─── Active style ─────────────────────────────────────────────────────────────

describe("Active style override", () => {
  const style = {
    topColor: "#FF0000",
    midColor: "#CC0000",
    bottomColor: "#880000",
    shape: "Almond" as const,
    opacity: 0.9,
  };

  it("starts with no active style", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    expect(result.current.state.activeStyle).toBeNull();
  });

  it("setActiveStyle updates the active style", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.setActiveStyle(style));
    expect(result.current.state.activeStyle).toEqual(style);
  });

  it("setActiveStyle(null) clears the style", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.setActiveStyle(style));
    act(() => result.current.setActiveStyle(null));
    expect(result.current.state.activeStyle).toBeNull();
  });
});

// ─── localStorage consent gate ────────────────────────────────────────────────

describe("localStorage — consent gate (GDPR)", () => {
  it("does NOT persist cart when no consent given", () => {
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    // Cart is in memory but localStorage should be empty (no consent)
    expect(localStorage.getItem("lumis_cart_v1")).toBeNull();
  });

  it("persists cart to localStorage when consent given", async () => {
    giveConsent();
    const { result } = renderHook(() => useTryOn(), { wrapper });
    act(() => result.current.addToCart("lume-01"));
    // Persistence effect runs after render
    const stored = localStorage.getItem("lumis_cart_v1");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].productId).toBe("lume-01");
  });

  it("hydrates cart from localStorage on mount when consent given", () => {
    giveConsent();
    const now = Date.now();
    const cartData = [
      { productId: "lume-02", quantity: 3, addedAt: now },
    ];
    localStorage.setItem("lumis_cart_v1", JSON.stringify(cartData));

    const { result } = renderHook(() => useTryOn(), { wrapper });
    expect(result.current.state.cart).toHaveLength(1);
    expect(result.current.state.cart[0].productId).toBe("lume-02");
    expect(result.current.state.cart[0].quantity).toBe(3);
  });

  it("does NOT hydrate cart from localStorage without consent", () => {
    // No giveConsent() call
    localStorage.setItem(
      "lumis_cart_v1",
      JSON.stringify([{ productId: "lume-02", quantity: 1, addedAt: Date.now() }])
    );
    const { result } = renderHook(() => useTryOn(), { wrapper });
    expect(result.current.state.cart).toHaveLength(0);
  });
});

// ─── 30-day expiry pruning at hydration ───────────────────────────────────────

describe("Cart hydration — 30-day expiry pruning (GDPR Art. 5(1)(e))", () => {
  const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;

  it("prunes expired items on hydration", () => {
    giveConsent();
    const cartData = [
      { productId: "fresh",   quantity: 1, addedAt: Date.now() },
      { productId: "expired", quantity: 1, addedAt: Date.now() - THIRTY_ONE_DAYS_MS },
    ];
    localStorage.setItem("lumis_cart_v1", JSON.stringify(cartData));

    const { result } = renderHook(() => useTryOn(), { wrapper });
    expect(result.current.state.cart).toHaveLength(1);
    expect(result.current.state.cart[0].productId).toBe("fresh");
  });

  it("handles entirely expired cart gracefully (all items pruned)", () => {
    giveConsent();
    const cartData = [
      { productId: "old-1", quantity: 1, addedAt: Date.now() - THIRTY_ONE_DAYS_MS },
      { productId: "old-2", quantity: 2, addedAt: Date.now() - THIRTY_ONE_DAYS_MS },
    ];
    localStorage.setItem("lumis_cart_v1", JSON.stringify(cartData));

    const { result } = renderHook(() => useTryOn(), { wrapper });
    expect(result.current.state.cart).toHaveLength(0);
  });
});

// ─── Error safety ─────────────────────────────────────────────────────────────

describe("useTryOn — context safety", () => {
  it("throws when used outside TryOnProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useTryOn())).toThrow(
      "useTryOn must be used within a TryOnProvider"
    );
    spy.mockRestore();
  });

  it("handles corrupted localStorage gracefully (starts empty)", () => {
    giveConsent();
    localStorage.setItem("lumis_cart_v1", "not-valid-json{{{{");
    const { result } = renderHook(() => useTryOn(), { wrapper });
    expect(result.current.state.cart).toHaveLength(0);
  });
});
