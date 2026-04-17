"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, ShoppingBag, User } from "lucide-react";
import { useTryOn } from "@/store/try-on-context";

export function BottomNav() {
  const pathname = usePathname();
  const { cartCount, state } = useTryOn();
  const studioHref = state.lastViewedProductId
    ? `/studio/${state.lastViewedProductId}`
    : "/studio/lume-01";

  // Studio and auth pages are full-screen — no nav overlay
  const isImmersive =
    pathname.startsWith("/studio/") || pathname === "/auth";
  if (isImmersive) return null;

  const links = [
    { href: "/",        label: "Home",    icon: Home },
    { href: studioHref, label: "Try On",  icon: Camera },
    { href: "/cart",    label: "Cart",    icon: ShoppingBag },
    { href: "/profile", label: "Account", icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex justify-around items-center pb-safe"
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid var(--color-border-light)",
      }}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href ||
          (href !== "/" && pathname.startsWith(href));

        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center gap-1 py-2.5 px-5 transition-colors duration-150"
            style={{
              color: isActive ? "var(--color-pink)" : "var(--color-ink-light)",
              textDecoration: "none",
            }}
          >
            <div className="relative">
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              {href === "/cart" && cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-pink)",
                    color: "#FFFFFF",
                  }}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </div>
            <span
              className="text-[9px] font-medium"
              style={{ letterSpacing: "0.04em" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
