-- ============================================================
-- LUMIS Nail Studio — Sprint 2 Migration  v0.5.0 → v0.5.1
-- Date: 2026-04-13
-- ============================================================
-- Adds:
--   1. Extended finish columns on products (Jelly / Glitter / CatEye params)
--   2. shade_definitions table (full PBR ShadeDefinition catalogue schema)
--   3. ad_tokens table (zero-rate ad-watch flow, 24 h TTL)
--   4. video pipeline fields on try_on_sessions
--   5. Indexes, RLS policies, helper functions
--
-- Run: supabase db push  OR  paste into Supabase SQL editor (dashboard)
-- Idempotent: all DDL uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- ── 1. Products table — extend for v3.4 finishes ─────────────────────────────

-- Widen the finish check constraint to include the three new finishes.
-- We drop and recreate because ALTER TABLE ... DROP CONSTRAINT is cleaner.
alter table public.products
  drop constraint if exists products_finish_check;

alter table public.products
  add constraint products_finish_check
  check (finish in ('Gloss','Matte','Metallic','Chrome','Jelly','Glitter','CatEye'));

-- Jelly: skin-tone show-through hex  (e.g. '#c89870')
alter table public.products
  add column if not exists skin_tone_hex text;

-- Glitter: sparkle density [0.02 – 0.12]
alter table public.products
  add column if not exists glitter_density numeric(4,3)
    check (glitter_density is null or glitter_density between 0.02 and 0.12);

-- CatEye: shimmer streak direction [-1.0 – 1.0]
alter table public.products
  add column if not exists cat_eye_dir numeric(4,2)
    check (cat_eye_dir is null or cat_eye_dir between -1.0 and 1.0);

-- Colour fields: canonical Lab values for shade catalog (optional, null for existing rows)
alter table public.products
  add column if not exists lab_l numeric(6,2);  -- CIE L* [0,100]
alter table public.products
  add column if not exists lab_a numeric(6,2);  -- CIE a* [-128,127]
alter table public.products
  add column if not exists lab_b numeric(6,2);  -- CIE b* [-128,127]

comment on column public.products.skin_tone_hex    is 'Jelly finish: skin-tone hex used for nail-bed show-through. Fitzpatrick-neutral default #c89870.';
comment on column public.products.glitter_density  is 'Glitter finish: sparkle density [0.02–0.12]. Default 0.06.';
comment on column public.products.cat_eye_dir      is 'CatEye finish: shimmer streak horizontal offset [-1=left, +1=right]. Default 0.3.';
comment on column public.products.lab_l            is 'CIE L* luminance for colour-accurate catalogue swatch matching.';
comment on column public.products.lab_a            is 'CIE a* (green–red) for colour-accurate catalogue swatch matching.';
comment on column public.products.lab_b            is 'CIE b* (blue–yellow) for colour-accurate catalogue swatch matching.';

-- Backfill Sprint 1 new products (lume-07 through lume-15)
insert into public.products
  (id, name, price, top_color, mid_color, bottom_color, shape, finish,
   description, length, stock_count, skin_tone_hex, glitter_density, cat_eye_dir)
values
  ('lume-07', 'Glazed Petal',    34.00, '#FADADD', '#F5C0C5', '#E8A0A8', 'Oval',    'Jelly',
   'Ultra-sheer blush jelly — your nail plate glows through a soft pink veil.',
   'Short',  120, '#d4a882', null,  null),

  ('lume-08', 'Ocean Glaze',     34.00, '#A8D8EA', '#88C0D8', '#5898B8', 'Almond',  'Jelly',
   'Cool translucent aqua. Light passes through the polish like sea glass.',
   'Medium', 120, '#c89870', null,  null),

  ('lume-09', 'Galaxy Dust',     48.00, '#2A1A4A', '#3D2860', '#1A0E30', 'Coffin',  'Glitter',
   'Deep violet base with holographic glitter. Shifts from purple to gold to pink.',
   'Long',    80,  null,     0.09,  null),

  ('lume-10', 'Champagne Fizz',  38.00, '#C8A840', '#B89030', '#806010', 'Square',  'Glitter',
   'Warm champagne base saturated with fine gold glitter. Party-ready.',
   'Short',  100,  null,     0.06,  null),

  ('lume-11', 'Magnetic Noir',   55.00, '#0A0A14', '#141420', '#08080E', 'Stiletto','CatEye',
   'Black cat-eye with a silver magnetic streak. Move your hand and watch it shift.',
   'Long',    60,  null,     null,  0.3),

  ('lume-12', 'Electric Plum',   55.00, '#2A0840', '#3A1058', '#180528', 'Almond',  'CatEye',
   'Rich violet cat-eye with a blue-silver shimmer that follows the light.',
   'Medium',  60,  null,     null, -0.2),

  ('lume-13', 'Barely There',    26.00, '#E8D0B8', '#D8BCA0', '#C8A888', 'Square',  'Jelly',
   'The original your-nail-but-better. Sheer nude jelly for every skin tone.',
   'Short',  200, '#d4a882', null,  null),

  ('lume-14', 'Ruby Stardust',   44.00, '#A81020', '#C01428', '#780C18', 'Oval',    'Glitter',
   'Deep crimson with scarlet and gold micro-glitter. Bold without being loud.',
   'Medium',  80,  null,     0.07,  null),

  ('lume-15', 'Arctic Chrome',   58.00, '#D8E8F8', '#B8D0E8', '#88A8C8', 'Coffin',  'Chrome',
   'Glacial chrome with a cool blue undertone. The mirror effect in ice.',
   'Long',    50,  null,     null,  null)
on conflict (id) do update set
  name           = excluded.name,
  price          = excluded.price,
  top_color      = excluded.top_color,
  mid_color      = excluded.mid_color,
  bottom_color   = excluded.bottom_color,
  shape          = excluded.shape,
  finish         = excluded.finish,
  description    = excluded.description,
  length         = excluded.length,
  skin_tone_hex  = excluded.skin_tone_hex,
  glitter_density= excluded.glitter_density,
  cat_eye_dir    = excluded.cat_eye_dir;

-- ── 2. Shade definitions table (canonical PBR swatch catalogue) ───────────────

create table if not exists public.shade_definitions (
  id              uuid          primary key default gen_random_uuid(),
  product_id      text          references public.products(id) on delete cascade,

  -- Display colour
  display_hex     text          not null,           -- e.g. '#3D1F4A'

  -- CIE Lab (linearised for ΔE computation)
  lab_l           numeric(6,2),
  lab_a           numeric(6,2),
  lab_b           numeric(6,2),

  -- Linear RGB [0,1] for renderer (gamma-decoded from display_hex)
  linear_r        numeric(8,6)  check (linear_r between 0 and 1),
  linear_g        numeric(8,6)  check (linear_g between 0 and 1),
  linear_b        numeric(8,6)  check (linear_b between 0 and 1),

  -- PBR material properties (Blender Principled BSDF equivalents)
  finish          text          not null
                                check (finish in ('Gloss','Matte','Metallic','Chrome','Jelly','Glitter','CatEye')),
  roughness       numeric(4,3)  not null default 0.05 check (roughness between 0 and 1),
  metallic        numeric(4,3)  not null default 0.00 check (metallic  between 0 and 1),
  subsurface      numeric(4,3)  not null default 0.00 check (subsurface between 0 and 1),
  clearcoat       numeric(4,3)  not null default 0.80 check (clearcoat between 0 and 1),

  -- Finish-specific parameters
  glitter_density numeric(4,3)  check (glitter_density is null or glitter_density between 0.02 and 0.12),
  cat_eye_dir     numeric(4,2)  check (cat_eye_dir     is null or cat_eye_dir     between -1.0 and 1.0),
  skin_tone_hex   text,

  -- Canonical swatch assets (populated by blender_batch_generator.py)
  swatch_url      text,         -- Blender render: 6 Fitzpatrick renders, 7 finishes
  swatch_urls     jsonb,        -- {fitz_1: url, fitz_2: url, …, fitz_6: url}

  -- Metadata
  fitzpatrick_range text,       -- e.g. '1-3' if swatch only calibrated for lighter tones
  calibrated      boolean       not null default false,  -- X-Rite calibration done
  version         text          not null default '1.0',

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table  public.shade_definitions is 'Canonical PBR shade definitions for the LUMIS catalogue swatch pipeline.';
comment on column public.shade_definitions.swatch_urls is 'JSON map: Fitzpatrick level → Blender-rendered swatch image URL on Cloudflare R2.';
comment on column public.shade_definitions.calibrated  is 'True once X-Rite ColorChecker physical calibration has been applied.';

alter table public.shade_definitions enable row level security;

create policy "shade_defs_public_read" on public.shade_definitions
  for select using (true);                -- public catalogue read

create policy "shade_defs_admin_write"  on public.shade_definitions
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create trigger shade_definitions_updated_at
  before update on public.shade_definitions
  for each row execute procedure public.set_updated_at();

create index if not exists idx_shade_defs_product   on public.shade_definitions(product_id);
create index if not exists idx_shade_defs_finish     on public.shade_definitions(finish);
create index if not exists idx_shade_defs_calibrated on public.shade_definitions(calibrated) where calibrated = true;

-- ── 3. Ad tokens table (zero-rate: customer watches advert → 24 h free tier) ──

create table if not exists public.ad_tokens (
  id              uuid          primary key default gen_random_uuid(),

  -- The opaque token sent to the client (also stored hashed for lookup)
  token_hash      text          not null unique,  -- SHA-256 of raw token (never store raw)

  -- Identity (anonymous sessions allowed)
  user_id         uuid          references public.profiles(id) on delete cascade,
  session_id      text,         -- anonymous device session ID (fingerprint-free)

  -- Ad provenance
  ad_network      text          not null check (ad_network in ('admob','ironsource','unity','mock')),
  ad_unit_id      text          not null,
  completion_sig  text          not null,          -- HMAC-SHA256 from ad network

  -- Entitlement
  granted_at      timestamptz   not null default now(),
  expires_at      timestamptz   not null default (now() + interval '24 hours'),
  revoked         boolean       not null default false,
  revoke_reason   text,

  -- Usage tracking
  try_ons_used    integer       not null default 0,
  try_ons_limit   integer       not null default 999,  -- effectively unlimited for 24 h

  created_at      timestamptz   not null default now()
);

comment on table  public.ad_tokens is 'Zero-rate ad-watch entitlement tokens. One row per successful ad completion. Token raw value is never stored — only the SHA-256 hash.';
comment on column public.ad_tokens.token_hash    is 'SHA-256 hex digest of the raw UUID token returned to the client.';
comment on column public.ad_tokens.completion_sig is 'HMAC-SHA256 completion callback from the ad network, verified server-side before issuing token.';
comment on column public.ad_tokens.expires_at    is 'Token validity window — default 24 h from grant time.';

alter table public.ad_tokens enable row level security;

-- Users can only read their own tokens; anonymous tokens are keyed by session_id
create policy "ad_tokens_select_own" on public.ad_tokens
  for select using (
    user_id = auth.uid()
    or (user_id is null and session_id is not null)  -- anonymous allowed
  );

create policy "ad_tokens_admin_all" on public.ad_tokens
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Service role only (API route uses service-role key for inserts)
create policy "ad_tokens_service_insert" on public.ad_tokens
  for insert with check (true);   -- restricted further by service-role key at API layer

create index if not exists idx_ad_tokens_hash       on public.ad_tokens(token_hash);
create index if not exists idx_ad_tokens_user        on public.ad_tokens(user_id, expires_at desc) where user_id is not null;
create index if not exists idx_ad_tokens_expires     on public.ad_tokens(expires_at) where revoked = false;

-- Auto-expire: mark tokens revoked after their expiry (optional background job can
-- also clean up with: DELETE FROM ad_tokens WHERE expires_at < now() - interval '7 days')

-- ── 4. try_on_sessions — add video pipeline fields ────────────────────────────

alter table public.try_on_sessions
  add column if not exists input_type       text   default 'camera'
    check (input_type in ('camera', 'photo', 'video'));

alter table public.try_on_sessions
  add column if not exists frame_count      integer;   -- total frames rendered (video mode)

alter table public.try_on_sessions
  add column if not exists jitter_px        numeric(6,2);  -- mean inter-frame jitter

alter table public.try_on_sessions
  add column if not exists lighting_kelvin  integer;   -- estimated scene colour temp

alter table public.try_on_sessions
  add column if not exists depth_warp_used  boolean    default false;  -- 2.5D mode

alter table public.try_on_sessions
  add column if not exists ad_token_id      uuid
    references public.ad_tokens(id) on delete set null;  -- zero-rate session link

-- Update renderer_version default for new sessions
alter table public.try_on_sessions
  alter column renderer_version set default 'v3.4';

comment on column public.try_on_sessions.input_type    is 'camera=live AR, photo=uploaded still, video=uploaded clip.';
comment on column public.try_on_sessions.frame_count   is 'Number of frames rendered in video or live mode.';
comment on column public.try_on_sessions.jitter_px     is 'Mean inter-frame cuticle anchor displacement in pixels (video mode).';
comment on column public.try_on_sessions.lighting_kelvin is 'Estimated scene colour temperature in Kelvin from lighting estimator.';
comment on column public.try_on_sessions.depth_warp_used is 'True if 2.5D depth-warp parallax was used during the session.';
comment on column public.try_on_sessions.ad_token_id   is 'Links session to a zero-rate ad entitlement, if applicable.';

create index if not exists idx_sessions_ad_token   on public.try_on_sessions(ad_token_id) where ad_token_id is not null;
create index if not exists idx_sessions_input_type on public.try_on_sessions(input_type, created_at desc);

-- ── 5. Helper function: verify ad token (called from API route) ───────────────

create or replace function public.verify_ad_token(p_token_hash text)
returns table (
  valid       boolean,
  token_id    uuid,
  expires_at  timestamptz,
  try_ons_remaining integer
)
language plpgsql security definer as $$
begin
  return query
    select
      (not revoked and expires_at > now())        as valid,
      id                                          as token_id,
      ad_tokens.expires_at,
      (try_ons_limit - try_ons_used)              as try_ons_remaining
    from public.ad_tokens
    where token_hash = p_token_hash
    limit 1;
end;
$$;

comment on function public.verify_ad_token is 'Check whether an ad token hash is currently valid. Called by the /api/ad-token/verify route handler.';

-- ── 6. Helper function: increment try_on count on ad token usage ──────────────

create or replace function public.use_ad_token(p_token_hash text)
returns boolean
language plpgsql security definer as $$
declare
  v_valid boolean;
begin
  select (not revoked and expires_at > now())
  into   v_valid
  from   public.ad_tokens
  where  token_hash = p_token_hash;

  if v_valid then
    update public.ad_tokens
    set    try_ons_used = try_ons_used + 1
    where  token_hash   = p_token_hash;
  end if;

  return coalesce(v_valid, false);
end;
$$;

-- ── 7. Updated designer_revenue view (re-create after product table changes) ──

create or replace view public.designer_revenue as
  select
    d.id             as designer_id,
    d.brand_name,
    d.commission_rate,
    count(distinct oi.order_id)                             as order_count,
    sum(oi.quantity * oi.unit_price)                        as gross_revenue,
    sum(oi.quantity * oi.unit_price * d.commission_rate / 100) as designer_earnings,
    count(distinct p.id)                                    as product_count,
    sum(p.try_on_count)                                     as total_try_ons
  from public.designers d
  join public.products p    on p.designer_id = d.id
  left join public.order_items oi on oi.product_id = p.id
  left join public.orders o  on o.id = oi.order_id and o.status not in ('cancelled','refunded')
  group by d.id, d.brand_name, d.commission_rate;
