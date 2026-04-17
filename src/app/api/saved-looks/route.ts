/**
 * GET /api/saved-looks
 *
 * Returns the authenticated user's saved looks with signed storage URLs (P2-2 — G-08).
 * Never returns raw storage paths — all images are served via short-lived signed URLs
 * (1 hour expiry) so they cannot be guessed or shared without authentication.
 *
 * Auth: JWT required
 * Rate: general (60/min)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth }               from "@/lib/auth-guard";
import { rateLimit, LIMITS }         from "@/lib/rate-limit";
import { trackApiEvent }             from "@/lib/monitoring";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = rateLimit(req, "saved-looks-get", LIMITS.general);
  if (!limited.ok) return limited.response!;

  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    trackApiEvent({ route: "/api/saved-looks", method: "GET", statusCode: 200, durationMs: Date.now() - start });
    return NextResponse.json({ data: [] });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: rows, error: dbError } = await supabase
      .from("saved_looks")
      .select("id, product_id, product_name, storage_path, shape, finish, style_json, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (dbError) throw dbError;

    // Generate signed URLs for each look — never expose raw storage paths
    const looks = await Promise.all(
      (rows ?? []).map(async (row: {
        id: string;
        product_id: string;
        product_name: string;
        storage_path: string | null;
        shape: string;
        finish: string;
        style_json: Record<string, unknown>;
        created_at: string;
      }) => {
        let signedUrl: string | null = null;

        if (row.storage_path) {
          const { data: signed, error: signError } = await supabase.storage
            .from("lumis-private")
            .createSignedUrl(row.storage_path, 3600); // 1-hour expiry

          if (!signError && signed?.signedUrl) {
            signedUrl = signed.signedUrl;
          }
        }

        return {
          id:          row.id,
          productId:   row.product_id,
          productName: row.product_name,
          // Return signed URL only — never raw storage_path
          imageUrl:    signedUrl,
          shape:       row.shape,
          finish:      row.finish,
          style:       row.style_json ?? {},
          createdAt:   row.created_at,
        };
      }),
    );

    trackApiEvent({ route: "/api/saved-looks", method: "GET", statusCode: 200, durationMs: Date.now() - start });

    return NextResponse.json(
      { data: looks },
      {
        headers: {
          // No caching — signed URLs are per-session
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    trackApiEvent({ route: "/api/saved-looks", method: "GET", statusCode: 500, durationMs: Date.now() - start, errorCode: "DB_ERROR" });
    console.error("[saved-looks] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch saved looks." }, { status: 500 });
  }
}

// DELETE a saved look by ID
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  const limited = rateLimit(req, "saved-looks-delete", LIMITS.sensitive);
  if (!limited.ok) return limited.response!;

  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const lookId = searchParams.get("id");
  if (!lookId) {
    return NextResponse.json({ error: "Missing ?id parameter." }, { status: 400 });
  }

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Fetch storage_path first so we can clean up storage
    const { data: look } = await supabase
      .from("saved_looks")
      .select("storage_path")
      .eq("id", lookId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (look?.storage_path) {
      await supabase.storage.from("lumis-private").remove([look.storage_path]);
    }

    const { error } = await supabase
      .from("saved_looks")
      .delete()
      .eq("id", lookId)
      .eq("user_id", user!.id); // RLS double-check

    if (error) throw error;

    trackApiEvent({ route: "/api/saved-looks", method: "DELETE", statusCode: 200, durationMs: Date.now() - start });
    return NextResponse.json({ success: true });
  } catch (err) {
    trackApiEvent({ route: "/api/saved-looks", method: "DELETE", statusCode: 500, durationMs: Date.now() - start, errorCode: "DB_ERROR" });
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
