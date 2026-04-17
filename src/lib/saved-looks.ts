/**
 * LUMIS — Saved Looks  v1.0
 *
 * Save, list, and delete user nail-try-on captures.
 *
 * Storage strategy (priority order):
 *   1. Supabase Storage bucket "looks" — JPEG upload, stores path in saved_looks.storage_path
 *   2. localStorage fallback — stores base64 thumbnail in saved_looks.thumbnail_b64
 *      (used in development or when the user is not authenticated)
 *
 * The caller always receives a unified SavedLook object regardless of backend.
 *
 * Image downsizing:
 *   Full captures can be 1–2 MB. Before uploading to Storage we resize to
 *   a 960×1280 JPEG at 85% quality (~80–120 KB). The original data URL is
 *   used for the in-session preview; the resized version goes to the DB.
 */

import type { NailStyle, NailShape, NailFinish } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedLook {
  id:            string;
  userId:        string;
  productId:     string;
  productName:   string;
  /** Public URL to display the image. */
  imageUrl:      string;
  shape:         NailShape;
  finish:        NailFinish;
  style:         Partial<NailStyle>;
  createdAt:     string; // ISO
}

export interface SaveLookParams {
  userId:      string;
  productId:   string;
  productName: string;
  /** Full-resolution PNG data URL from the capture. */
  imageDataUrl: string;
  style:        NailStyle;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = "lumis_saved_looks";
/** Max dimensions for the compressed JPEG upload. */
const UPLOAD_MAX_W = 960;
const UPLOAD_MAX_H = 1280;
const UPLOAD_QUALITY = 0.85;

// ─── Image helpers ────────────────────────────────────────────────────────────

/**
 * Compress a full-resolution PNG data URL to a JPEG at reduced dimensions.
 * Returns a Blob ready for upload, and a reduced data URL for preview.
 */
export async function compressImage(dataUrl: string): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, UPLOAD_MAX_W / img.width, UPLOAD_MAX_H / img.height);
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No 2D context")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", UPLOAD_QUALITY);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("toBlob failed")); return; }
          resolve({ blob, dataUrl: compressed });
        },
        "image/jpeg",
        UPLOAD_QUALITY,
      );
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

/**
 * Generate a 128×96 JPEG thumbnail data URL for localStorage fallback.
 */
export async function makeThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const aspect = img.width / img.height;
      const w = 128;
      const h = Math.round(w / aspect);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No 2D context")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.70));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

// ─── Supabase availability ────────────────────────────────────────────────────

function isSupabaseConfigured(): boolean {
  return Boolean(
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Save a captured look.
 *   - If Supabase is configured: compress → upload to Storage → insert DB row.
 *   - Otherwise: generate thumbnail → persist in localStorage.
 *
 * @returns The saved look record, or null on failure.
 */
export async function saveLook(params: SaveLookParams): Promise<SavedLook | null> {
  const { userId, productId, productName, imageDataUrl, style } = params;

  if (isSupabaseConfigured()) {
    return _saveToSupabase(userId, productId, productName, imageDataUrl, style);
  }
  return _saveToLocalStorage(userId, productId, productName, imageDataUrl, style);
}

async function _saveToSupabase(
  userId:       string,
  productId:    string,
  productName:  string,
  imageDataUrl: string,
  style:        NailStyle,
): Promise<SavedLook | null> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Compress before upload
    const { blob } = await compressImage(imageDataUrl);
    const lookId   = crypto.randomUUID();
    const path     = `${userId}/${lookId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("looks")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });

    if (uploadError) {
      console.warn("[saved-looks] Storage upload failed:", uploadError.message);
      // Fall through to localStorage
      return _saveToLocalStorage(userId, productId, productName, imageDataUrl, style);
    }

    // Get signed URL — 1-hour expiry. Never expose raw storage path (P2-2 — G-08).
    const { data: urlData } = await supabase.storage.from("lumis-private").createSignedUrl(path, 3600);

    const { data, error } = await supabase
      .from("saved_looks")
      .insert({
        id:           lookId,
        user_id:      userId,
        product_id:   productId,
        product_name: productName,
        storage_path: path,
        shape:        style.shape ?? "Almond",
        finish:       style.finish ?? "Gloss",
        style_json:   JSON.parse(JSON.stringify(style)) as Record<string, unknown>,
      })
      .select()
      .single();

    if (error || !data) return null;

    return {
      id:          lookId,
      userId,
      productId,
      productName,
      imageUrl:    urlData?.signedUrl ?? imageDataUrl,
      shape:       (data.shape   as NailShape)  ?? "Almond",
      finish:      (data.finish  as NailFinish) ?? "Gloss",
      style,
      createdAt:   data.created_at as string,
    };
  } catch (err) {
    console.warn("[saved-looks] Supabase save failed:", err);
    return null;
  }
}

function _saveToLocalStorage(
  userId:       string,
  productId:    string,
  productName:  string,
  imageDataUrl: string,
  style:        NailStyle,
): SavedLook | null {
  try {
    const existing: SavedLook[] = _readLocalLooks(userId);
    const look: SavedLook = {
      id:          crypto.randomUUID(),
      userId,
      productId,
      productName,
      imageUrl:    imageDataUrl, // full data URL in localStorage (OK for dev)
      shape:       style.shape  ?? "Almond",
      finish:      style.finish ?? "Gloss",
      style,
      createdAt:   new Date().toISOString(),
    };
    // Cap at 20 looks in localStorage to avoid quota errors
    const updated = [look, ...existing].slice(0, 20);
    localStorage.setItem(`${LS_KEY}_${userId}`, JSON.stringify(updated));
    return look;
  } catch {
    return null;
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all saved looks for a user.
 * Falls back to localStorage if Supabase is not configured.
 */
export async function getUserLooks(userId: string): Promise<SavedLook[]> {
  if (!isSupabaseConfigured()) return _readLocalLooks(userId);

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
      .from("saved_looks")
      .select("id, product_id, product_name, storage_path, thumbnail_b64, shape, finish, style_json, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return Promise.all((data as Array<{
      id: string;
      product_id: string;
      product_name: string;
      storage_path: string | null;
      thumbnail_b64: string | null;
      shape: string;
      finish: string;
      style_json: Record<string, unknown>;
      created_at: string;
    }>).map(async (row) => {
      let imageUrl = row.thumbnail_b64 ?? "";
      if (row.storage_path) {
        // Use signed URL — never expose raw storage path to client (P2-2 — G-08)
        const { data: urlData } = await supabase.storage
          .from("lumis-private")
          .createSignedUrl(row.storage_path, 3600);
        imageUrl = urlData?.signedUrl ?? imageUrl;
      }
      return {
        id:          row.id,
        userId,
        productId:   row.product_id,
        productName: row.product_name,
        imageUrl,
        shape:       row.shape  as NailShape,
        finish:      row.finish as NailFinish,
        style:       (row.style_json ?? {}) as Partial<NailStyle>,
        createdAt:   row.created_at,
      };
    }));
  } catch {
    return [];
  }
}

function _normaliseLook(raw: Record<string, unknown>, userId: string): SavedLook {
  // Handle old saves that used `name` and `dataUrl` instead of `productName` / `imageUrl`
  const imageUrl =
    (raw.imageUrl as string | undefined) ??
    (raw.dataUrl   as string | undefined) ??
    "";
  const productName =
    (raw.productName as string | undefined) ??
    (raw.name        as string | undefined) ??
    "Untitled";
  const shape =
    (raw.shape as string | undefined) ??
    ((raw.style as Record<string, unknown> | undefined)?.shape as string | undefined) ??
    "Almond";
  const finish =
    (raw.finish as string | undefined) ??
    ((raw.style as Record<string, unknown> | undefined)?.finish as string | undefined) ??
    "Gloss";
  return {
    id:          (raw.id as string) ?? `${Date.now()}`,
    userId:      (raw.userId as string | undefined) ?? userId,
    productId:   (raw.productId as string) ?? "",
    productName,
    imageUrl,
    shape:       shape  as import("@/types").NailShape,
    finish:      finish as import("@/types").NailFinish,
    style:       (raw.style as Partial<import("@/types").NailStyle>) ?? {},
    createdAt:   (raw.createdAt as string) ?? new Date().toISOString(),
  };
}

function _readLocalLooks(userId: string): SavedLook[] {
  try {
    const parseKey = (key: string): Record<string, unknown>[] => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return JSON.parse(raw) as Record<string, unknown>[];
    };

    // Primary key (matches current saveLook() output)
    const primary = parseKey(`${LS_KEY}_${userId}`);

    // Legacy key written by old shoot page (userId was hard-coded to "local")
    const legacy  = parseKey(`${LS_KEY}_local`);

    const all = [...primary, ...legacy];
    // De-duplicate by id, keeping first occurrence
    const seen = new Set<string>();
    return all
      .filter((r) => {
        const id = r.id as string | undefined;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((r) => _normaliseLook(r, userId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a saved look by ID.
 * Also removes the Storage object if applicable.
 */
export async function deleteLook(lookId: string, userId: string, storagePath?: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    _deleteLocalLook(lookId, userId);
    return;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    if (storagePath) {
      await supabase.storage.from("looks").remove([storagePath]);
    }

    await supabase.from("saved_looks").delete().eq("id", lookId).eq("user_id", userId);
  } catch (err) {
    console.warn("[saved-looks] Delete failed:", err);
  }
}

function _deleteLocalLook(lookId: string, userId: string): void {
  try {
    const existing = _readLocalLooks(userId);
    localStorage.setItem(
      `${LS_KEY}_${userId}`,
      JSON.stringify(existing.filter((l) => l.id !== lookId)),
    );
  } catch { /* ignore */ }
}
