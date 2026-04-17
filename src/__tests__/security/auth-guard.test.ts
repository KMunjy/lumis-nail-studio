/**
 * auth-guard.test.ts — RBAC security tests
 *
 * Verifies the contract established by Sprint 0:
 *   • No Bearer header     → 401 Unauthorized
 *   • Missing env vars     → 503 Service Unavailable (fail-closed)
 *   • Invalid JWT          → 401 Invalid or expired token
 *   • Wrong role           → 403 Forbidden
 *   • Correct role         → passes through (null error)
 *
 * These tests mock Supabase at the module level so no network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/test", { headers });
}

// ── Supabase mock factory ─────────────────────────────────────────────────────

function mockSupabase(opts: {
  userError?: boolean;
  userId?: string;
  userEmail?: string;
  role?: string;
  profileError?: boolean;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        opts.userError
          ? { data: { user: null }, error: new Error("bad token") }
          : { data: { user: { id: opts.userId ?? "user-1", email: opts.userEmail ?? "a@b.com" } }, error: null },
      ),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        opts.profileError
          ? { data: null, error: new Error("not found") }
          : { data: { role: opts.role ?? "customer" }, error: null },
      ),
    }),
  };
}

// ── Tests: requireAuth ─────────────────────────────────────────────────────────

describe("requireAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    // Set env vars for tests that should reach Supabase
    process.env.NEXT_PUBLIC_SUPABASE_URL        = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY       = "test-service-key";
  });

  it("returns 401 when no Authorization header is present", async () => {
    const { requireAuth } = await import("@/lib/auth-guard");
    const req = makeRequest(); // no token
    const { error } = await requireAuth(req);
    expect(error).not.toBeNull();
    const body = await error!.json();
    expect(error!.status).toBe(401);
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 401 when Authorization header has no token after 'Bearer '", async () => {
    const { requireAuth } = await import("@/lib/auth-guard");
    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer " },
    });
    const { error } = await requireAuth(req);
    expect(error!.status).toBe(401);
  });

  it("returns 503 when Supabase env vars are absent (fail-closed)", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { requireAuth } = await import("@/lib/auth-guard");
    const req = makeRequest("some-valid-looking-token");
    const { error } = await requireAuth(req);
    expect(error!.status).toBe(503);
  });

  it("returns 401 when Supabase rejects the JWT", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ userError: true }),
    }));
    const { requireAuth } = await import("@/lib/auth-guard");
    const req = makeRequest("invalid-jwt");
    const { error } = await requireAuth(req);
    expect(error!.status).toBe(401);
    const body = await error!.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  it("returns 401 when profile lookup fails", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ profileError: true }),
    }));
    const { requireAuth } = await import("@/lib/auth-guard");
    const req = makeRequest("valid-jwt");
    const { error } = await requireAuth(req);
    expect(error!.status).toBe(401);
  });

  it("returns user + role when JWT and profile are valid", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ role: "customer" }),
    }));
    const { requireAuth } = await import("@/lib/auth-guard");
    const req = makeRequest("valid-jwt");
    const { user, role, error } = await requireAuth(req);
    expect(error).toBeNull();
    expect(user?.id).toBe("user-1");
    expect(role).toBe("customer");
  });
});

// ── Tests: requireRole ─────────────────────────────────────────────────────────

describe("requireRole", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL  = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  it("returns 403 when user role is not in allowed list", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ role: "customer" }),
    }));
    const { requireRole } = await import("@/lib/auth-guard");
    const req = makeRequest("valid-jwt");
    const { error } = await requireRole(req, ["admin"]);
    expect(error!.status).toBe(403);
    const body = await error!.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns 403 when creator tries to access admin-only route", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ role: "creator" }),
    }));
    const { requireRole } = await import("@/lib/auth-guard");
    const req = makeRequest("valid-jwt");
    const { error } = await requireRole(req, ["admin"]);
    expect(error!.status).toBe(403);
  });

  it("passes when admin accesses admin-only route", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ role: "admin" }),
    }));
    const { requireRole } = await import("@/lib/auth-guard");
    const req = makeRequest("valid-jwt");
    const { error, role } = await requireRole(req, ["admin"]);
    expect(error).toBeNull();
    expect(role).toBe("admin");
  });

  it("passes when creator accesses creator-or-admin route", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ role: "creator" }),
    }));
    const { requireRole } = await import("@/lib/auth-guard");
    const req = makeRequest("valid-jwt");
    const { error } = await requireRole(req, ["creator", "admin"]);
    expect(error).toBeNull();
  });

  it("passes when admin accesses creator-or-admin route", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => mockSupabase({ role: "admin" }),
    }));
    const { requireRole } = await import("@/lib/auth-guard");
    const req = makeRequest("valid-jwt");
    const { error } = await requireRole(req, ["creator", "admin"]);
    expect(error).toBeNull();
  });

  it("returns 401 (not 403) when no token is provided", async () => {
    const { requireRole } = await import("@/lib/auth-guard");
    const req = makeRequest(); // no Bearer
    const { error } = await requireRole(req, ["admin"]);
    // Should be 401 (auth failed) not 403 (wrong role)
    expect(error!.status).toBe(401);
  });
});
