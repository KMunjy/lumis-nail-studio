"use client";

/**
 * SiteHeader v2.0 — Navigation with all 5 UAT improvements:
 *  [1] Shrinks to compact mode on scroll-down, expands on scroll-up
 *  [2] Active pink underline on current nav link
 *  [3] Cart drawer (slide-in panel, no page navigation)
 *  [4] Floating "Try On Live" pulse pill on browse pages
 *  [5] Keyboard shortcuts: / = search, T = Try On
 */

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Search, Heart, ShoppingBag, User, Menu, X, Eye, Trash2 } from "lucide-react";
import { useTryOn } from "@/store/try-on-context";
import { usePathname, useRouter } from "next/navigation";
import { RegionSelector } from "@/components/RegionSelector";
import { motion, AnimatePresence } from "framer-motion";
import { products } from "@/data/products";

export function SiteHeader() {
  const { cartCount, state, removeFromCart } = useTryOn();
  const cartItems = state.cart;
  const [searchOpen, setSearchOpen]   = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [cartOpen, setCartOpen]       = useState(false);
  const [compact, setCompact]         = useState(false);
  const lastScrollY                   = useRef(0);
  const pathname                      = usePathname();
  const router                        = useRouter();

  const isImmersive = pathname.startsWith("/studio/") || pathname === "/auth";

  // [1] Shrink header on scroll-down, expand on scroll-up
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y > 80 && y > lastScrollY.current) setCompact(true);
      else if (y < lastScrollY.current - 10) setCompact(false);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // [5] Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.key === "t" || e.key === "T") && !e.metaKey && !e.ctrlKey) {
        router.push("/studio/lume-01");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (isImmersive) return null;

  const isBrowse = pathname === "/";

  return (
    <>
      {/* Announcement bar — hidden in compact mode */}
      <AnimatePresence>
        {!compact && (
          <motion.div
            key="announcement"
            initial={false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              overflow: "hidden",
              backgroundColor: "var(--color-pink-banner)",
              color: "#FFFFFF",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            <div style={{ padding: "10px 16px" }}>
              Try any shade live on your hand — no app, no upload →
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main header */}
      <header
        style={{
          backgroundColor: "#FFFFFF",
          borderBottom: "1px solid var(--color-border-light)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          transition: "box-shadow 0.22s ease",
          boxShadow: compact ? "0 2px 12px rgba(0,0,0,0.08)" : "none",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 20px",
            height: compact ? 44 : 60,   // [1] shrinks
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            transition: "height 0.22s ease",
          }}
        >
          {/* Left — hamburger + nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1 }}>
            <button
              aria-label="Menu"
              onClick={() => setDrawerOpen(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-ink)", padding: 4,
                display: "flex", alignItems: "center",
              }}
            >
              <Menu size={compact ? 18 : 20} strokeWidth={1.5} />
            </button>

            {/* [2] Active underline nav links */}
            {!compact && (
              <nav style={{ display: "flex", gap: 20, alignItems: "center" }}>
                {[
                  { href: "/", label: "Browse" },
                  { href: "/studio/lume-01", label: "Try On" },
                ].map(({ href, label }) => {
                  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      style={{
                        fontSize: 13, fontWeight: active ? 600 : 500,
                        color: active ? "var(--color-ink)" : "var(--color-ink-mid)",
                        textDecoration: "none", whiteSpace: "nowrap",
                        paddingBottom: 2,
                        borderBottom: active ? "2px solid var(--color-pink)" : "2px solid transparent",
                        transition: "color 0.15s, border-color 0.15s",
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Center — wordmark */}
          <Link href="/" style={{ textDecoration: "none", flex: "none" }}>
            <span style={{
              fontFamily: "var(--font-sans)",
              fontSize: compact ? 16 : 20,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-ink)",
              userSelect: "none",
              transition: "font-size 0.22s ease",
            }}>
              LUMIS
            </span>
          </Link>

          {/* Right — utility icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
            {!compact && <RegionSelector />}

            {/* Search — with keyboard hint */}
            <button
              onClick={() => setSearchOpen(v => !v)}
              aria-label="Search (press /)"
              title="Search   /"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-ink-mid)", padding: 8, borderRadius: 6,
                display: "flex", alignItems: "center", transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-mid)"; }}
            >
              <Search size={compact ? 16 : 18} strokeWidth={1.5} />
            </button>

            {/* Wishlist */}
            <Link
              href="/account/looks"
              aria-label="Saved looks"
              style={{
                color: "var(--color-ink-mid)", padding: 8, borderRadius: 6,
                display: "flex", alignItems: "center", textDecoration: "none", transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-pink)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-mid)"; }}
            >
              <Heart size={compact ? 16 : 18} strokeWidth={1.5} />
            </Link>

            {/* Account */}
            <Link
              href="/auth"
              aria-label="Account"
              style={{
                color: "var(--color-ink-mid)", padding: 8, borderRadius: 6,
                display: "flex", alignItems: "center", textDecoration: "none", transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-mid)"; }}
            >
              <User size={compact ? 16 : 18} strokeWidth={1.5} />
            </Link>

            {/* [3] Cart — opens drawer instead of navigating */}
            <button
              onClick={() => setCartOpen(true)}
              aria-label={`Cart (${cartCount} items)`}
              style={{
                position: "relative", background: "none", border: "none", cursor: "pointer",
                color: "var(--color-ink-mid)", padding: 8, borderRadius: 6,
                display: "flex", alignItems: "center", transition: "color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--color-ink-mid)"; }}
            >
              <ShoppingBag size={compact ? 16 : 18} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  width: 14, height: 14, borderRadius: "50%",
                  backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                  fontSize: 8, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div style={{
            borderTop: "1px solid var(--color-border-light)",
            backgroundColor: "#FFFFFF",
            padding: "12px 20px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <Search size={16} style={{ color: "var(--color-ink-light)", flexShrink: 0 }} />
            <input
              autoFocus
              type="search"
              placeholder="Search shades, collections, shapes…"
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const q = (e.currentTarget as HTMLInputElement).value.trim();
                  if (q) window.location.href = `/?q=${encodeURIComponent(q)}`;
                  setSearchOpen(false);
                }
                if (e.key === "Escape") setSearchOpen(false);
              }}
              style={{
                flex: 1, border: "none", outline: "none",
                fontSize: 14, color: "var(--color-ink)",
                backgroundColor: "transparent", fontFamily: "var(--font-sans)",
              }}
            />
            <span style={{
              fontSize: 10, color: "var(--color-ink-light)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
              border: "1px solid var(--color-border-light)", borderRadius: 3,
              padding: "2px 5px",
            }}>ESC</span>
            <button onClick={() => setSearchOpen(false)} aria-label="Close search"
              style={{ background: "none", border: "none", cursor: "pointer",
                color: "var(--color-ink-light)", display: "flex", alignItems: "center" }}>
              <X size={16} />
            </button>
          </div>
        )}
      </header>

      {/* [4] Floating "Try On Live" pulse pill — browse pages only */}
      <AnimatePresence>
        {isBrowse && (
          <motion.div
            key="tryonpill"
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ delay: 1.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", bottom: 88, right: 16, zIndex: 90,
            }}
          >
            <Link
              href="/studio/lume-01"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                backgroundColor: "var(--color-pink)",
                color: "#FFFFFF",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                padding: "12px 20px", borderRadius: 50,
                textDecoration: "none",
                boxShadow: "0 4px 20px rgba(232,64,112,0.45)",
                letterSpacing: "0.01em",
              }}
            >
              {/* Pulse dot */}
              <span style={{ position: "relative", display: "flex" }}>
                <span style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  backgroundColor: "rgba(255,255,255,0.5)",
                  animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite",
                }} />
                <Eye size={14} />
              </span>
              Try On Live
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* [3] Cart drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              key="cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 300,
                backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
              }}
            />
            <motion.aside
              key="cart-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed", top: 0, right: 0, bottom: 0,
                width: 360, zIndex: 301,
                backgroundColor: "#FFFFFF",
                boxShadow: "-4px 0 32px rgba(0,0,0,0.12)",
                display: "flex", flexDirection: "column",
              }}
            >
              {/* Drawer header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "20px 20px 16px",
                borderBottom: "1px solid var(--color-border-light)",
              }}>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600,
                  color: "var(--color-ink)",
                }}>
                  Your Bag {cartCount > 0 && (
                    <span style={{
                      fontSize: 12, fontWeight: 400, color: "var(--color-ink-light)",
                      marginLeft: 6,
                    }}>({cartCount})</span>
                  )}
                </span>
                <button onClick={() => setCartOpen(false)} aria-label="Close cart"
                  style={{ background: "none", border: "none", cursor: "pointer",
                    color: "var(--color-ink-mid)", display: "flex", alignItems: "center" }}>
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              {/* Cart items */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {cartCount === 0 ? (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", height: "100%", gap: 12, textAlign: "center",
                  }}>
                    <ShoppingBag size={36} style={{ color: "var(--color-border)" }} strokeWidth={1} />
                    <p style={{
                      fontFamily: "var(--font-sans)", fontSize: 14,
                      color: "var(--color-ink-light)",
                    }}>Your bag is empty</p>
                    <Link
                      href="/"
                      onClick={() => setCartOpen(false)}
                      style={{
                        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                        color: "var(--color-pink)", textDecoration: "none",
                      }}
                    >Browse shades →</Link>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(cartItems ?? []).map((item: { productId: string; quantity: number; addedAt: number }) => {
                      const p = products.find(pr => pr.id === item.productId);
                      if (!p) return null;
                      return (
                        <div key={item.productId} style={{
                          display: "flex", gap: 12, alignItems: "center",
                          padding: "12px 0",
                          borderBottom: "1px solid var(--color-border-light)",
                        }}>
                          {/* Colour swatch */}
                          <div style={{
                            width: 48, height: 48, borderRadius: 6, flexShrink: 0,
                            background: `linear-gradient(135deg, ${p.topColor}, ${p.midColor}, ${p.bottomColor})`,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                              color: "var(--color-ink)", marginBottom: 2,
                            }}>{p.name}</p>
                            <p style={{
                              fontFamily: "var(--font-sans)", fontSize: 11,
                              color: "var(--color-ink-light)",
                            }}>{p.shape} · {p.finish}</p>
                          </div>
                          <p style={{
                            fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                            color: "var(--color-ink)", flexShrink: 0,
                          }}>${p.price}</p>
                          <button
                            onClick={() => removeFromCart?.(item.productId)}
                            aria-label={`Remove ${p.name}`}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "var(--color-ink-light)", padding: 4,
                              display: "flex", alignItems: "center", flexShrink: 0,
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Checkout CTA */}
              {cartCount > 0 && (
                <div style={{
                  padding: "16px 20px 24px",
                  borderTop: "1px solid var(--color-border-light)",
                }}>
                  <Link
                    href="/cart"
                    onClick={() => setCartOpen(false)}
                    style={{
                      display: "block", width: "100%", textAlign: "center",
                      backgroundColor: "var(--color-pink)", color: "#FFFFFF",
                      fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
                      padding: "14px 0", borderRadius: 8, textDecoration: "none",
                      letterSpacing: "0.01em",
                    }}
                  >
                    View Bag & Checkout
                  </Link>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile navigation drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 200,
                backgroundColor: "rgba(0,0,0,0.40)", backdropFilter: "blur(2px)",
              }}
            />
            <motion.nav
              key="nav-drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed", top: 0, left: 0, bottom: 0,
                width: 280, zIndex: 201,
                backgroundColor: "#FFFFFF",
                boxShadow: "4px 0 32px rgba(0,0,0,0.14)",
                display: "flex", flexDirection: "column", overflowY: "auto",
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "20px 20px 16px",
                borderBottom: "1px solid var(--color-border-light)",
              }}>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase" as const,
                  color: "var(--color-ink)",
                }}>LUMIS</span>
                <button onClick={() => setDrawerOpen(false)} aria-label="Close menu"
                  style={{ background: "none", border: "none", cursor: "pointer",
                    color: "var(--color-ink-mid)", display: "flex", alignItems: "center" }}>
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
              {[
                { href: "/",                   label: "Browse Shades"  },
                { href: "/studio/lume-01",     label: "Try On Live"    },
                { href: "/community",          label: "Community"      },
                { href: "/trends",             label: "Trend Board"    },
                { href: "/studio/shoot",       label: "NailShoot"      },
                { href: "/profile/dna",        label: "Nail DNA"       },
                { href: "/create/board",       label: "NailBoard"      },
                { href: "/create/transform",   label: "NailTransform"  },
                { href: "/cart",               label: "Your Bag"       },
                { href: "/account/looks",      label: "Saved Looks"    },
                { href: "/auth",               label: "Sign In"        },
                { href: "/privacy",            label: "Privacy Policy" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    display: "block", padding: "16px 20px",
                    fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500,
                    color: "var(--color-ink)", textDecoration: "none",
                    borderBottom: "1px solid var(--color-border-light)",
                    transition: "background-color 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-surface)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  {label}
                </Link>
              ))}

              {/* [5] Keyboard shortcut hints in drawer footer */}
              <div style={{
                marginTop: "auto", padding: "16px 20px",
                borderTop: "1px solid var(--color-border-light)",
              }}>
                <p style={{
                  fontFamily: "var(--font-sans)", fontSize: 10,
                  color: "var(--color-ink-light)", marginBottom: 8,
                }}>Keyboard shortcuts</p>
                {[
                  { key: "/", label: "Search" },
                  { key: "T", label: "Try On" },
                ].map(({ key, label }) => (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 6,
                  }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--color-ink-mid)" }}>{label}</span>
                    <kbd style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border-light)",
                      borderRadius: 3, padding: "2px 6px",
                      color: "var(--color-ink-mid)",
                    }}>{key}</kbd>
                  </div>
                ))}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

    </>
  );
}
