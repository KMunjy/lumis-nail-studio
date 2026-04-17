import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * LUMIS Auth Proxy  (Next.js 16 — renamed from middleware.ts)
 *
 * Performs an optimistic session check via Supabase auth cookie.
 * Full JWT validation is still enforced inside each API route handler.
 *
 * Dev/CI skip: when NEXT_PUBLIC_SUPABASE_URL is absent the proxy is a no-op
 * so the app works without credentials during development.
 */

const ADMIN_ONLY:   string[] = ["/admin"];
const CREATOR_ONLY: string[] = ["/dashboard"];
const AUTH_REQUIRED: string[] = ["/account", "/profile", "/create"];

function requiresAuth(pathname: string): boolean {
  return [...ADMIN_ONLY, ...CREATOR_ONLY, ...AUTH_REQUIRED].some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Dev bypass ─────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return NextResponse.next();

  if (!requiresAuth(pathname)) return NextResponse.next();

  // ── Optimistic cookie check ────────────────────────────────────────────────
  // Supabase SSR sets a cookie named `sb-<project-ref>-auth-token`.
  const ref = supabaseUrl.match(/https?:\/\/([^.]+)\./)?.[1] ?? "";
  const cookieName = `sb-${ref}-auth-token`;
  const hasSession = request.cookies.has(cookieName);

  if (!hasSession) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    "/profile/:path*",
    "/create/:path*",
  ],
};
