/**
 * auth-guard.ts — Shared JWT + RBAC enforcer for all LUMIS API routes.
 *
 * SECURITY CONTRACT:
 *   • Always validates the Supabase JWT.
 *   • NEVER bypasses auth — if env vars are absent the route returns 503
 *     (misconfigured server, fail closed) rather than granting access.
 *   • Role check is exact: caller must hold one of the allowed roles.
 *
 * Usage:
 *   const { user, error } = await requireAuth(req);
 *   if (error) return error;
 *
 *   const { error: rbacError } = await requireRole(req, ["admin"]);
 *   if (rbacError) return rbacError;
 */

import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function supabaseEnv(): { url: string; serviceKey: string } | null {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

// ── requireAuth ───────────────────────────────────────────────────────────────

export interface AuthResult {
  /** Supabase user object (id, email, etc.) — present on success */
  user: { id: string; email?: string } | null;
  /** Role from public.profiles — present on success */
  role: UserRole | null;
  /** If present, return this response immediately to the client */
  error: NextResponse | null;
}

/**
 * Validate the Bearer JWT and return the authenticated user + role.
 * Returns a 401/503 response on failure — caller must short-circuit.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = extractBearer(req);
  if (!token) {
    return {
      user: null,
      role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const env = supabaseEnv();
  if (!env) {
    // Server misconfiguration: FAIL CLOSED — never grant access.
    console.error("[auth-guard] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.");
    return {
      user: null,
      role: null,
      error: NextResponse.json(
        { error: "Service temporarily unavailable. Please try again later." },
        { status: 503 },
      ),
    };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.url, env.serviceKey, {
      auth: { persistSession: false },
    });

    // Validate JWT via Supabase Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return {
        user: null,
        role: null,
        error: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
      };
    }

    // Fetch role from public.profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        user: null,
        role: null,
        error: NextResponse.json({ error: "User profile not found" }, { status: 401 }),
      };
    }

    return {
      user: { id: user.id, email: user.email },
      role: profile.role as UserRole,
      error: null,
    };
  } catch (err) {
    console.error("[auth-guard] Auth check error:", err);
    return {
      user: null,
      role: null,
      error: NextResponse.json({ error: "Authentication check failed" }, { status: 500 }),
    };
  }
}

// ── requireRole ───────────────────────────────────────────────────────────────

export interface RoleResult {
  user: { id: string; email?: string } | null;
  role: UserRole | null;
  error: NextResponse | null;
}

/**
 * Validate JWT AND assert the caller holds one of the allowed roles.
 * Returns a 401 or 403 response on failure — caller must short-circuit.
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: UserRole[],
): Promise<RoleResult> {
  const auth = await requireAuth(req);
  if (auth.error) return auth;

  if (!allowedRoles.includes(auth.role!)) {
    return {
      user: auth.user,
      role: auth.role,
      error: NextResponse.json(
        { error: `Forbidden: requires one of [${allowedRoles.join(", ")}]` },
        { status: 403 },
      ),
    };
  }

  return { user: auth.user, role: auth.role, error: null };
}
