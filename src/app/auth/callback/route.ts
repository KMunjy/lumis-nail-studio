/**
 * /auth/callback — Supabase PKCE magic-link exchange  v1.0
 *
 * Supabase sends the user back here after clicking the magic link in their
 * email. This route exchanges the one-time `code` query parameter for a
 * full session, then redirects to the account page (or the `next` param).
 *
 * Flow:
 *   User clicks link → GET /auth/callback?code=<otp>&next=/account/loyalty
 *   → exchangeCodeForSession() sets the session cookie
 *   → 302 redirect to `next` (or "/" if absent)
 *
 * Security:
 *   - The code is single-use and expires after 60 s (Supabase default).
 *   - PKCE verifier is handled automatically by @supabase/auth-helpers-nextjs.
 *   - On error we redirect to /auth?error=<message> rather than exposing
 *     internal details in the response body.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Validate `next` to prevent open-redirect
  const safenext = next.startsWith("/") ? next : "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth?error=missing_code`,
    );
  }

  // Only attempt Supabase exchange if configured
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // Dev fallback: just redirect to the destination
    console.warn("[auth/callback] Supabase not configured — skipping code exchange.");
    return NextResponse.redirect(`${origin}${safenext}`);
  }

  try {
    // Dynamic import keeps auth-helpers out of the edge-runtime bundle
    // when auth is disabled in development
    const { createServerClient } = await import("@supabase/auth-helpers-nextjs");
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent(error.message)}`,
      );
    }

    return NextResponse.redirect(`${origin}${safenext}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[auth/callback] Unexpected error:", msg);
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(msg)}`,
    );
  }
}
