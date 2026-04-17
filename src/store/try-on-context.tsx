"use client";

/**
 * TryOn Context — global state for the LUMIS try-on session.
 *
 * Responsibilities:
 *   - Cart item management (persisted to localStorage)
 *   - Active style override (user's shade selection within the studio)
 *   - Session tracking (try-on count, last viewed product)
 *
 * Deliberately kept minimal. No Redux, no Zustand — the app is small enough
 * that a single context with useReducer is correct here.
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem, NailStyle } from "@/types";
import { hasConsent, pruneExpiredCartItems } from "@/lib/consent";

// ─── State ────────────────────────────────────────────────────────────────────

interface TryOnState {
  cart: CartItem[];
  /** Active style override applied in the studio (null = use product default) */
  activeStyle: NailStyle | null;
  /** ID of the last product the user viewed in the studio */
  lastViewedProductId: string | null;
}

const INITIAL_STATE: TryOnState = {
  cart: [],
  activeStyle: null,
  lastViewedProductId: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD_TO_CART"; productId: string }
  | { type: "REMOVE_FROM_CART"; productId: string }
  | { type: "CLEAR_CART" }
  | { type: "SET_ACTIVE_STYLE"; style: NailStyle | null }
  | { type: "SET_LAST_VIEWED"; productId: string }
  | { type: "HYDRATE_CART"; cart: CartItem[] };

function reducer(state: TryOnState, action: Action): TryOnState {
  switch (action.type) {
    case "ADD_TO_CART": {
      const existing = state.cart.find((i) => i.productId === action.productId);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((i) =>
            i.productId === action.productId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...state,
        cart: [
          ...state.cart,
          { productId: action.productId, quantity: 1, addedAt: Date.now() },
        ],
      };
    }
    case "REMOVE_FROM_CART":
      return {
        ...state,
        cart: state.cart.filter((i) => i.productId !== action.productId),
      };
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "SET_ACTIVE_STYLE":
      return { ...state, activeStyle: action.style };
    case "SET_LAST_VIEWED":
      return { ...state, lastViewedProductId: action.productId };
    case "HYDRATE_CART":
      return { ...state, cart: action.cart };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface TryOnContextValue {
  state: TryOnState;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setActiveStyle: (style: NailStyle | null) => void;
  setLastViewed: (productId: string) => void;
  cartCount: number;
}

const TryOnContext = createContext<TryOnContextValue | null>(null);

const CART_KEY         = "lumis_cart_v1";
const LAST_VIEWED_KEY  = "lumis_last_viewed";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TryOnProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Hydrate cart from localStorage on mount.
  // Only reads if consent has been given (GDPR Art. 7 / POPIA §11).
  // Prunes items older than 30 days on load (data retention / storage limitation).
  useEffect(() => {
    if (!hasConsent()) return;
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          const pruned = pruneExpiredCartItems(parsed);
          dispatch({ type: "HYDRATE_CART", cart: pruned });
        }
      }
    } catch {
      // Corrupted storage — ignore, start fresh
    }
  }, []);

  // Persist cart on change — only if consent has been given.
  useEffect(() => {
    if (!hasConsent()) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch {
      // Storage full or private mode — ignore
    }
  }, [state.cart]);

  // Persist last-viewed product (used for resume-browsing UX and erased on consent withdrawal).
  useEffect(() => {
    if (!hasConsent() || !state.lastViewedProductId) return;
    try {
      localStorage.setItem(LAST_VIEWED_KEY, state.lastViewedProductId);
    } catch { /* ignore */ }
  }, [state.lastViewedProductId]);

  const addToCart = useCallback(
    (productId: string) => dispatch({ type: "ADD_TO_CART", productId }),
    []
  );
  const removeFromCart = useCallback(
    (productId: string) => dispatch({ type: "REMOVE_FROM_CART", productId }),
    []
  );
  const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), []);
  const setActiveStyle = useCallback(
    (style: NailStyle | null) => dispatch({ type: "SET_ACTIVE_STYLE", style }),
    []
  );
  const setLastViewed = useCallback(
    (productId: string) => dispatch({ type: "SET_LAST_VIEWED", productId }),
    []
  );

  const cartCount = state.cart.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <TryOnContext.Provider
      value={{
        state,
        addToCart,
        removeFromCart,
        clearCart,
        setActiveStyle,
        setLastViewed,
        cartCount,
      }}
    >
      {children}
    </TryOnContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTryOn(): TryOnContextValue {
  const ctx = useContext(TryOnContext);
  if (!ctx) {
    throw new Error("useTryOn must be used within a TryOnProvider");
  }
  return ctx;
}
