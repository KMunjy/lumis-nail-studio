/**
 * POST /api/video-processor
 *
 * Server-side video upload guard (P0-2 — G-07).
 * Enforces size and MIME type constraints before the client-side WASM pipeline
 * ever processes the file, preventing DoS via oversized or malicious uploads.
 *
 * This route does NOT process video frames — that is done client-side in
 * src/lib/video-processor.ts. This route:
 *   1. Validates Content-Length header (hard 25 MB cap)
 *   2. Validates Content-Type (MP4, WebM, MOV only)
 *   3. Checks the try_on_video kill-switch
 *   4. Streams the body to Supabase Storage (private bucket)
 *   5. Returns a signed upload URL for the client to confirm success
 *
 * Auth: JWT required (any authenticated user)
 * Rate: 5 uploads per minute per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth }               from "@/lib/auth-guard";
import { rateLimit, LIMITS }         from "@/lib/rate-limit";
import { isFeatureEnabled }          from "@/lib/kill-switch";
import { trackApiEvent }             from "@/lib/monitoring";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_VIDEO_BYTES  = 25 * 1024 * 1024; // 25 MB — aligned with client validator
const ALLOWED_TYPES    = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const VIDEO_UPLOAD_LIMIT = { max: 5, windowMs: 60_000 }; // 5 uploads/min per IP

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  // ── Kill-switch ───────────────────────────────────────────────────────────
  const videoEnabled = await isFeatureEnabled("try_on_video");
  if (!videoEnabled) {
    return NextResponse.json(
      { error: "Video try-on is currently unavailable." },
      { status: 503 },
    );
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const limited = rateLimit(req, "video-upload", VIDEO_UPLOAD_LIMIT);
  if (!limited.ok) return limited.response!;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { user, error: authError } = await requireAuth(req);
  if (authError) return authError;

  // ── Content-Length pre-check ──────────────────────────────────────────────
  // Reject before reading body to avoid buffering huge uploads
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_VIDEO_BYTES) {
    trackApiEvent({ route: "/api/video-processor", method: "POST", statusCode: 413, durationMs: Date.now() - start, errorCode: "FILE_TOO_LARGE" });
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_VIDEO_BYTES / (1024 * 1024)} MB.` },
      { status: 413 },
    );
  }

  // ── MIME type check ───────────────────────────────────────────────────────
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    trackApiEvent({ route: "/api/video-processor", method: "POST", statusCode: 415, durationMs: Date.now() - start, errorCode: "UNSUPPORTED_MIME" });
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: MP4, WebM, MOV." },
      { status: 415 },
    );
  }

  // ── Stream to Supabase Storage ────────────────────────────────────────────
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // No storage configured — return mock success for local dev
    trackApiEvent({ route: "/api/video-processor", method: "POST", statusCode: 200, durationMs: Date.now() - start });
    return NextResponse.json({ uploadId: "local-dev", signedUrl: null });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Read body with a hard size guard (stream + accumulate up to MAX_VIDEO_BYTES + 1)
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const reader = req.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No body provided." }, { status: 400 });
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_VIDEO_BYTES) {
        reader.cancel();
        trackApiEvent({ route: "/api/video-processor", method: "POST", statusCode: 413, durationMs: Date.now() - start, errorCode: "BODY_TOO_LARGE" });
        return NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_VIDEO_BYTES / (1024 * 1024)} MB.` },
          { status: 413 },
        );
      }
      chunks.push(value);
    }

    const uploadId  = crypto.randomUUID();
    const userId    = user!.id;
    const extension = contentType === "video/webm" ? "webm"
                    : contentType === "video/quicktime" ? "mov" : "mp4";
    const path = `${userId}/${uploadId}.${extension}`;

    const blob = new Blob(chunks, { type: contentType });

    const { error: uploadError } = await supabase.storage
      .from("lumis-video-private")
      .upload(path, blob, { contentType, upsert: false });

    if (uploadError) {
      trackApiEvent({ route: "/api/video-processor", method: "POST", statusCode: 500, durationMs: Date.now() - start, errorCode: "STORAGE_UPLOAD_FAILED" });
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    // Create a short-lived signed URL for the client to reference
    const { data: signed } = await supabase.storage
      .from("lumis-video-private")
      .createSignedUrl(path, 3600); // 1-hour expiry

    trackApiEvent({ route: "/api/video-processor", method: "POST", statusCode: 201, durationMs: Date.now() - start });

    return NextResponse.json(
      { uploadId, path, signedUrl: signed?.signedUrl ?? null },
      { status: 201 },
    );
  } catch (err) {
    trackApiEvent({ route: "/api/video-processor", method: "POST", statusCode: 500, durationMs: Date.now() - start, errorCode: "UNEXPECTED" });
    console.error("[video-processor] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// Only POST accepted
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
