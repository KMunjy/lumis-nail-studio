/**
 * Supabase client — shared singleton for server and client components.
 *
 * For Server Components / Route Handlers: use createServerClient()
 * For Client Components: use createBrowserClient()
 *
 * Install: npm install @supabase/supabase-js @supabase/ssr
 *
 * Environment variables required (add to .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   ← server-only, never expose to client
 */

// Type definitions for the database schema
export type UserRole = "customer" | "creator" | "admin";
export type AdNetwork = "admob" | "ironsource" | "unity" | "mock";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Designer {
  id: string;
  user_id: string;
  brand_name: string;
  bio: string | null;
  commission_rate: number;
  total_earnings: number;
  payout_email: string | null;
  stripe_account: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  name: string;
  designer_id: string | null;
  price: number;
  top_color: string;
  mid_color: string;
  bottom_color: string;
  shape: "Almond" | "Stiletto" | "Oval" | "Coffin" | "Square";
  finish: "Gloss" | "Matte" | "Metallic" | "Chrome" | null;
  description: string | null;
  length: "Short" | "Medium" | "Long" | null;
  stock_count: number;
  is_active: boolean;
  try_on_count: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";
  subtotal: number;
  shipping_cost: number;
  total: number;
  shipping_address: Record<string, string> | null;
  stripe_payment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_snapshot: Record<string, unknown>;
  quantity: number;
  unit_price: number;
  shape_used: string | null;
  created_at: string;
}

export interface SavedLook {
  id: string;
  user_id: string;
  product_id: string | null;
  style_snapshot: Record<string, unknown>;
  thumbnail_url: string | null;
  created_at: string;
}

export interface TryOnSession {
  id: string;
  user_id: string | null;
  product_id: string | null;
  shape_used: string | null;
  duration_seconds: number | null;
  captured: boolean;
  converted: boolean;
  renderer_version: string;
  accuracy_score: number | null;
  /** v0.5.0: "camera" | "photo" | "video" */
  input_type: "camera" | "photo" | "video" | null;
  /** v0.5.0: total rendered frames (video mode) */
  frame_count: number | null;
  /** v0.5.0: mean inter-frame jitter in pixels */
  jitter_px: number | null;
  /** v0.5.0: estimated scene colour temperature (Kelvin) */
  lighting_kelvin: number | null;
  /** v0.5.0: true if 2.5D depth-warp was used */
  depth_warp_used: boolean;
  /** v0.5.0: linked ad-token entitlement (zero-rate flow) */
  ad_token_id: string | null;
  created_at: string;
}

/** v0.5.0 — Zero-rate ad-watch entitlement token */
export interface AdToken {
  id: string;
  token_hash: string;
  user_id: string | null;
  session_id: string | null;
  ad_network: AdNetwork;
  ad_unit_id: string;
  completion_sig: string;
  granted_at: string;
  expires_at: string;
  revoked: boolean;
  revoke_reason: string | null;
  try_ons_used: number;
  try_ons_limit: number;
  created_at: string;
}

/** v0.5.0 — Canonical PBR shade definition for the swatch pipeline */
export interface ShadeDefinition {
  id: string;
  product_id: string | null;
  display_hex: string;
  lab_l: number | null;
  lab_a: number | null;
  lab_b: number | null;
  linear_r: number | null;
  linear_g: number | null;
  linear_b: number | null;
  finish: "Gloss" | "Matte" | "Metallic" | "Chrome" | "Jelly" | "Glitter" | "CatEye";
  roughness: number;
  metallic: number;
  subsurface: number;
  clearcoat: number;
  glitter_density: number | null;
  cat_eye_dir: number | null;
  skin_tone_hex: string | null;
  swatch_url: string | null;
  swatch_urls: Record<string, string> | null;
  fitzpatrick_range: string | null;
  calibrated: boolean;
  version: string;
  created_at: string;
  updated_at: string;
}

// ─── Typed database definition ────────────────────────────────────────────────
// Used as the generic parameter to createClient<Database>()
export type Database = {
  public: {
    Tables: {
      profiles:         { Row: Profile;    Insert: Partial<Profile> & Pick<Profile, "id">;    Update: Partial<Profile>    };
      designers:        { Row: Designer;   Insert: Partial<Designer> & Pick<Designer, "user_id" | "brand_name">; Update: Partial<Designer> };
      products:          { Row: DbProduct;       Insert: Partial<DbProduct> & Pick<DbProduct, "id" | "name" | "price" | "top_color" | "mid_color" | "bottom_color" | "shape">; Update: Partial<DbProduct> };
      orders:            { Row: Order;           Insert: Partial<Order> & Pick<Order, "user_id" | "subtotal" | "total">; Update: Partial<Order>   };
      order_items:       { Row: OrderItem;       Insert: Partial<OrderItem> & Pick<OrderItem, "order_id" | "product_snapshot" | "quantity" | "unit_price">; Update: Partial<OrderItem> };
      saved_looks:       { Row: SavedLook;       Insert: Partial<SavedLook> & Pick<SavedLook, "user_id" | "style_snapshot">; Update: Partial<SavedLook> };
      try_on_sessions:   { Row: TryOnSession;    Insert: Partial<TryOnSession>; Update: Partial<TryOnSession> };
      ad_tokens:         { Row: AdToken;         Insert: Partial<AdToken> & Pick<AdToken, "token_hash" | "ad_network" | "ad_unit_id" | "completion_sig">; Update: Partial<AdToken> };
      shade_definitions: { Row: ShadeDefinition; Insert: Partial<ShadeDefinition> & Pick<ShadeDefinition, "display_hex" | "finish">; Update: Partial<ShadeDefinition> };
    };
    Views: {
      designer_revenue: {
        Row: {
          designer_id: string;
          brand_name: string;
          commission_rate: number;
          order_count: number;
          gross_revenue: number;
          designer_earnings: number;
        };
      };
    };
  };
};
