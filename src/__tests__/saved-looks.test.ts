/**
 * Unit tests for src/lib/saved-looks.ts
 *
 * Coverage targets:
 *  - _normaliseLook: field aliasing (name→productName, dataUrl→imageUrl)
 *  - _readLocalLooks: primary + legacy key merge + de-duplication
 *  - saveLook: localStorage path (Supabase not configured)
 *  - deleteLook: localStorage path
 *  - getUserLooks: returns normalised, sorted list
 *  - compressImage / makeThumbnail: canvas-based — skipped in jsdom (no real canvas)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveLook,
  getUserLooks,
  deleteLook,
} from "@/lib/saved-looks";
import type { SavedLook } from "@/lib/saved-looks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = "lumis_saved_looks";

function seedRaw(key: string, items: object[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function readKey(key: string): unknown[] {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as unknown[]) : [];
}

const BASE_STYLE = {
  topColor:    "#FF0000",
  midColor:    "#880000",
  bottomColor: "#440000",
  shape:       "Almond" as const,
  finish:      "Gloss"  as const,
};

// ─── _normaliseLook (via getUserLooks reading localStorage) ───────────────────

describe("_normaliseLook", () => {
  it("maps legacy `name` → productName", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "1", name: "OG Name", dataUrl: "data:img/jpeg;base64,ABC", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks[0].productName).toBe("OG Name");
  });

  it("maps legacy `dataUrl` → imageUrl", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "2", name: "X", dataUrl: "data:image/jpeg;base64,XYZ", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks[0].imageUrl).toBe("data:image/jpeg;base64,XYZ");
  });

  it("prefers productName over name when both present", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "3", name: "Old", productName: "New", imageUrl: "data:x", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks[0].productName).toBe("New");
  });

  it("falls back shape from style.shape when top-level shape absent", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "4", productName: "X", imageUrl: "data:x", style: { shape: "Coffin" }, createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks[0].shape).toBe("Coffin");
  });

  it("defaults shape to Almond and finish to Gloss when missing", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "5", productName: "X", imageUrl: "data:x", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks[0].shape).toBe("Almond");
    expect(looks[0].finish).toBe("Gloss");
  });

  it("preserves existing productName and imageUrl", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "6", productName: "Rose Ombre", imageUrl: "https://cdn.example.com/img.jpg", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks[0].productName).toBe("Rose Ombre");
    expect(looks[0].imageUrl).toBe("https://cdn.example.com/img.jpg");
  });
});

// ─── _readLocalLooks: multi-key merge ─────────────────────────────────────────

describe("_readLocalLooks via getUserLooks", () => {
  it("merges primary and legacy keys without duplicates", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "a", productName: "A", imageUrl: "data:a", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);
    seedRaw(`${LS_KEY}_local`, [
      { id: "b", productName: "B", imageUrl: "data:b", createdAt: "2024-01-01T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks).toHaveLength(2);
    const ids = looks.map(l => l.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("de-duplicates by id when same look in both keys", async () => {
    const shared = { id: "dup", productName: "Dup", imageUrl: "data:d", createdAt: "2024-01-01T00:00:00.000Z" };
    seedRaw(`${LS_KEY}_u1`,    [shared]);
    seedRaw(`${LS_KEY}_local`, [shared]);
    const looks = await getUserLooks("u1");
    expect(looks.filter(l => l.id === "dup")).toHaveLength(1);
  });

  it("sorts by createdAt descending", async () => {
    seedRaw(`${LS_KEY}_u1`, [
      { id: "old", productName: "Old", imageUrl: "data:o", createdAt: "2023-01-01T00:00:00.000Z" },
      { id: "new", productName: "New", imageUrl: "data:n", createdAt: "2024-06-01T00:00:00.000Z" },
    ]);
    const looks = await getUserLooks("u1");
    expect(looks[0].id).toBe("new");
    expect(looks[1].id).toBe("old");
  });

  it("returns empty array when no localStorage data", async () => {
    const looks = await getUserLooks("empty-user");
    expect(looks).toEqual([]);
  });

  it("returns empty array when localStorage contains malformed JSON", async () => {
    localStorage.setItem(`${LS_KEY}_baduser`, "{{not-json");
    const looks = await getUserLooks("baduser");
    expect(looks).toEqual([]);
  });
});

// ─── saveLook (localStorage path — Supabase not configured) ──────────────────

describe("saveLook", () => {
  it("saves a look and returns a SavedLook object", async () => {
    const result = await saveLook({
      userId:       "u2",
      productId:    "p1",
      productName:  "Coral Bliss",
      imageDataUrl: "data:image/png;base64,TEST",
      style:        BASE_STYLE,
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe("u2");
    expect(result!.productName).toBe("Coral Bliss");
    expect(result!.imageUrl).toBe("data:image/png;base64,TEST");
    expect(result!.shape).toBe("Almond");
    expect(result!.finish).toBe("Gloss");
  });

  it("persists to localStorage under the user key", async () => {
    await saveLook({
      userId:       "u3",
      productId:    "p2",
      productName:  "Midnight",
      imageDataUrl: "data:image/png;base64,DARK",
      style:        { ...BASE_STYLE, finish: "Matte" },
    });

    const stored = readKey(`${LS_KEY}_u3`) as SavedLook[];
    expect(stored).toHaveLength(1);
    expect(stored[0].productName).toBe("Midnight");
    expect(stored[0].finish).toBe("Matte");
  });

  it("prepends new look (most recent first)", async () => {
    for (const name of ["First", "Second", "Third"]) {
      await saveLook({
        userId: "u4", productId: "px", productName: name,
        imageDataUrl: "data:x", style: BASE_STYLE,
      });
    }
    const stored = readKey(`${LS_KEY}_u4`) as SavedLook[];
    expect(stored[0].productName).toBe("Third");
    expect(stored[2].productName).toBe("First");
  });

  it("caps at 20 looks", async () => {
    for (let i = 0; i < 25; i++) {
      await saveLook({
        userId: "cap-user", productId: `p${i}`, productName: `Look ${i}`,
        imageDataUrl: "data:x", style: BASE_STYLE,
      });
    }
    const stored = readKey(`${LS_KEY}_cap-user`) as SavedLook[];
    expect(stored.length).toBe(20);
  });

  it("returns null when localStorage throws (quota exceeded simulation)", async () => {
    const origSet = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key) => {
      if (key.startsWith(LS_KEY)) throw new DOMException("QuotaExceededError");
      origSet(key, "");
    });

    const result = await saveLook({
      userId: "quota-user", productId: "p1", productName: "X",
      imageDataUrl: "data:x", style: BASE_STYLE,
    });
    expect(result).toBeNull();

    vi.restoreAllMocks();
  });
});

// ─── deleteLook (localStorage path) ──────────────────────────────────────────

describe("deleteLook", () => {
  it("removes the look from localStorage", async () => {
    const look = await saveLook({
      userId: "del-user", productId: "p1", productName: "To Delete",
      imageDataUrl: "data:x", style: BASE_STYLE,
    });
    expect(look).not.toBeNull();

    await deleteLook(look!.id, "del-user");

    const stored = readKey(`${LS_KEY}_del-user`) as SavedLook[];
    expect(stored.find(l => l.id === look!.id)).toBeUndefined();
  });

  it("does not throw when the look id is not found", async () => {
    await expect(deleteLook("non-existent-id", "ghost-user")).resolves.not.toThrow();
  });

  it("preserves other looks after deletion", async () => {
    const l1 = await saveLook({ userId: "keep-user", productId: "p1", productName: "Keep", imageDataUrl: "data:k", style: BASE_STYLE });
    const l2 = await saveLook({ userId: "keep-user", productId: "p2", productName: "Delete", imageDataUrl: "data:d", style: BASE_STYLE });

    await deleteLook(l2!.id, "keep-user");

    const stored = readKey(`${LS_KEY}_keep-user`) as SavedLook[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(l1!.id);
  });
});

// ─── Round-trip: save → list → delete ────────────────────────────────────────

describe("round-trip", () => {
  it("save → getUserLooks → deleteLook leaves empty list", async () => {
    const look = await saveLook({
      userId: "rt-user", productId: "p9", productName: "Round Trip",
      imageDataUrl: "data:rt", style: BASE_STYLE,
    });

    const before = await getUserLooks("rt-user");
    expect(before).toHaveLength(1);

    await deleteLook(look!.id, "rt-user");

    const after = await getUserLooks("rt-user");
    expect(after).toHaveLength(0);
  });
});

// ─── Supabase paths (env configured) ─────────────────────────────────────────
// Setting the env vars causes isSupabaseConfigured() to return true.
// The @supabase/supabase-js module is aliased to a stub that returns
// null/empty results — exercising the code paths without a live DB.

describe("Supabase paths — getUserLooks", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",      "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty array when Supabase query returns null data", async () => {
    // stub returns { data: null, error: null } → early-return []
    const looks = await getUserLooks("sb-user-1");
    expect(looks).toEqual([]);
  });
});

describe("Supabase paths — deleteLook", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",      "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls through without throwing when storagePath is provided", async () => {
    await expect(
      deleteLook("look-123", "sb-user-1", "sb-user-1/look-123.jpg")
    ).resolves.not.toThrow();
  });

  it("calls through without throwing when storagePath is absent", async () => {
    await expect(
      deleteLook("look-456", "sb-user-1")
    ).resolves.not.toThrow();
  });
});

describe("Supabase paths — saveLook", () => {
  // Mock the Image constructor so compressImage doesn't stall
  /* eslint-disable @typescript-eslint/no-explicit-any */
  function setupImageMock() {
    (globalThis as any).Image = class MockImage {
      width = 200;
      height = 200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { Promise.resolve().then(() => { this.onload?.(); }); }
      get src() { return ""; }
    };
  }

  beforeEach(() => {
    setupImageMock();
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob(["fake"], { type: "image/jpeg" }));
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,FAKE");

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",      "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns null when Supabase insert returns null data (stub default)", async () => {
    // The stub's .single() returns { data: null, error: null }
    // so _saveToSupabase returns null
    const result = await saveLook({
      userId:       "sb-user-2",
      productId:    "p-sb",
      productName:  "Supabase Look",
      imageDataUrl: "data:image/png;base64,TEST",
      style:        BASE_STYLE,
    });
    // null because stub insert → null data
    expect(result).toBeNull();
  });
});
