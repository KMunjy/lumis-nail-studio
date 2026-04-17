/**
 * LUMIS — Shade Catalog Seeder  v1.0
 *
 * Seeds all 15 products from src/data/products.ts into the Supabase
 * `products` and `shade_definitions` tables.
 *
 * Prerequisites:
 *   1. Run the Sprint 2 migration: supabase/migrations/20260413_sprint2.sql
 *   2. Set environment variables:
 *        NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 *
 * Usage:
 *   npx tsx scripts/seed-shades.ts
 *   npx tsx scripts/seed-shades.ts --dry-run   (print only, no writes)
 *   npx tsx scripts/seed-shades.ts --clear     (delete all rows first)
 *
 * The script is idempotent: existing rows are upserted (updated if changed).
 */

import { products, type Product } from "../src/data/products";

// ─── Colour math (no external deps required) ──────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function sRgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const rl = sRgbToLinear(r), gl = sRgbToLinear(g), bl = sRgbToLinear(b);
  return [
    0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
    0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl,
    0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl,
  ];
}

function f(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [X, Y, Z] = rgbToXyz(r, g, b);
  const fx = f(X / 0.95047), fy = f(Y / 1.0), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// ─── PBR defaults per finish ──────────────────────────────────────────────────

const PBR_DEFAULTS: Record<string, { roughness: number; metallic: number; subsurface: number; clearcoat: number }> = {
  Gloss:    { roughness: 0.05, metallic: 0.00, subsurface: 0.00, clearcoat: 0.90 },
  Matte:    { roughness: 0.85, metallic: 0.00, subsurface: 0.00, clearcoat: 0.00 },
  Metallic: { roughness: 0.15, metallic: 0.80, subsurface: 0.00, clearcoat: 0.70 },
  Chrome:   { roughness: 0.02, metallic: 1.00, subsurface: 0.00, clearcoat: 0.95 },
  Jelly:    { roughness: 0.04, metallic: 0.00, subsurface: 0.40, clearcoat: 0.85 },
  Glitter:  { roughness: 0.10, metallic: 0.50, subsurface: 0.00, clearcoat: 0.75 },
  CatEye:   { roughness: 0.08, metallic: 0.70, subsurface: 0.00, clearcoat: 0.80 },
};

// ─── Build DB row from Product ────────────────────────────────────────────────

function buildProductRow(p: Product): Record<string, unknown> {
  const [r, g, b] = hexToRgb(p.topColor);
  const [labL, labA, labB] = rgbToLab(r, g, b);

  return {
    id:              p.id,
    name:            p.name,
    price:           p.price,
    top_color:       p.topColor,
    mid_color:       p.midColor,
    bottom_color:    p.bottomColor,
    shape:           p.shape,
    finish:          p.finish,
    description:     p.description,
    length:          p.length,
    skin_tone_hex:   p.skinToneHex ?? null,
    glitter_density: p.glitterDensity ?? null,
    cat_eye_dir:     p.catEyeDir ?? null,
    lab_l:           Math.round(labL * 100) / 100,
    lab_a:           Math.round(labA * 100) / 100,
    lab_b:           Math.round(labB * 100) / 100,
    stock_count:     100,
    is_active:       true,
  };
}

function buildShadeDefRow(p: Product): Record<string, unknown> {
  const [r, g, b] = hexToRgb(p.topColor);
  const [labL, labA, labB] = rgbToLab(r, g, b);
  const pbr = PBR_DEFAULTS[p.finish] ?? PBR_DEFAULTS.Gloss;

  return {
    product_id:      p.id,
    display_hex:     p.topColor,
    lab_l:           Math.round(labL * 100) / 100,
    lab_a:           Math.round(labA * 100) / 100,
    lab_b:           Math.round(labB * 100) / 100,
    linear_r:        Math.round(sRgbToLinear(r) * 1e6) / 1e6,
    linear_g:        Math.round(sRgbToLinear(g) * 1e6) / 1e6,
    linear_b:        Math.round(sRgbToLinear(b) * 1e6) / 1e6,
    finish:          p.finish,
    roughness:       pbr.roughness,
    metallic:        pbr.metallic,
    subsurface:      pbr.subsurface,
    clearcoat:       pbr.clearcoat,
    glitter_density: p.glitterDensity ?? null,
    cat_eye_dir:     p.catEyeDir ?? null,
    skin_tone_hex:   p.skinToneHex ?? null,
    calibrated:      false,
    version:         "1.0",
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const clear  = args.includes("--clear");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  LUMIS Shade Catalog Seeder  v1.0        ║");
  console.log(`║  Mode: ${dryRun ? "DRY RUN  " : clear ? "CLEAR+SEED" : "UPSERT   "} (${products.length} shades) ║`);
  console.log("╚══════════════════════════════════════════╝\n");

  // Print rows in dry-run mode
  if (dryRun) {
    for (const p of products) {
      const row = buildProductRow(p);
      const shade = buildShadeDefRow(p);
      console.log(`── ${p.id}  ${p.name.padEnd(20)} finish=${p.finish}`);
      console.log(`   Lab: L=${shade.lab_l} a=${shade.lab_a} b=${shade.lab_b}`);
      console.log(`   PBR: roughness=${shade.roughness} metallic=${shade.metallic} clearcoat=${shade.clearcoat}`);
      if (p.skinToneHex) console.log(`   Jelly skinToneHex: ${p.skinToneHex}`);
      if (p.glitterDensity) console.log(`   Glitter density: ${p.glitterDensity}`);
      if (p.catEyeDir !== undefined) console.log(`   CatEye dir: ${p.catEyeDir}`);
      console.log();
      void row; // suppress unused warning
    }
    console.log("Dry run complete — no writes made.");
    return;
  }

  // Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey);

  // Optional clear step
  if (clear) {
    console.log("Clearing shade_definitions and products...");
    await supabase.from("shade_definitions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: delErr } = await supabase.from("products").delete()
      .in("id", products.map((p) => p.id));
    if (delErr) {
      console.error("Clear error:", delErr.message);
      process.exit(1);
    }
    console.log("  Cleared.\n");
  }

  let productsOk = 0, productsFail = 0;
  let shadesOk = 0, shadesFail = 0;

  // Upsert products
  console.log("Upserting products...");
  for (const p of products) {
    const row = buildProductRow(p);
    const { error } = await supabase.from("products").upsert(row, { onConflict: "id" });
    if (error) {
      console.error(`  ✗ ${p.id}: ${error.message}`);
      productsFail++;
    } else {
      console.log(`  ✓ ${p.id}  ${p.name}`);
      productsOk++;
    }
  }

  // Upsert shade_definitions
  console.log("\nUpserting shade_definitions...");
  for (const p of products) {
    const shade = buildShadeDefRow(p);

    // Check if shade_definition already exists for this product
    const { data: existing } = await supabase
      .from("shade_definitions")
      .select("id")
      .eq("product_id", p.id)
      .maybeSingle();

    let error;
    if (existing?.id) {
      ({ error } = await supabase
        .from("shade_definitions")
        .update(shade)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("shade_definitions").insert(shade));
    }

    if (error) {
      console.error(`  ✗ ${p.id}: ${error.message}`);
      shadesFail++;
    } else {
      console.log(`  ✓ ${p.id}  ${p.finish}  Lab(${shade.lab_l}, ${shade.lab_a}, ${shade.lab_b})`);
      shadesOk++;
    }
  }

  console.log("\n──────────────────────────────────────────");
  console.log(`Products:         ${productsOk} ok, ${productsFail} failed`);
  console.log(`Shade defs:       ${shadesOk} ok, ${shadesFail} failed`);
  console.log("──────────────────────────────────────────");

  if (productsFail + shadesFail > 0) {
    console.error("\nSome rows failed. Check errors above.");
    process.exit(1);
  } else {
    console.log("\nAll shades seeded successfully.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
