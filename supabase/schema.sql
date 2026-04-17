-- ============================================================
-- LUMIS Nail Studio — Supabase Schema  v1.0.0
-- Date: 2026-04-12
-- ============================================================
-- Run: supabase db push  OR  paste into Supabase SQL editor
-- Dependencies: Supabase Auth (auth.users) must be enabled.
--
-- Entity map:
--   auth.users ──< profiles ──< orders ──< order_items >── products
--                           ──< saved_looks >── products
--                           ──< try_on_sessions >── products
--   profiles ──< designers ──< products
--
-- RLS: Row Level Security enabled on all tables.
--      Policies enforce: users see only their own data;
--      admins and designers see broader views via role column.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Profiles (extends Supabase Auth user) ────────────────────────────────────
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        unique,
  full_name   text,
  avatar_url  text,
  role        text        not null default 'customer'
                          check (role in ('customer', 'creator', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.profiles is 'LUMIS user profiles — extends Supabase Auth. One row per user.';
comment on column public.profiles.role is 'customer=buyer, creator=nail designer/supplier, admin=LUMIS team.';

alter table public.profiles enable row level security;

create policy "profiles_select_own"     on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own"     on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own"     on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_admin_all"      on public.profiles for all    using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Trigger: keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Trigger: create profile on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Designers / Suppliers ─────────────────────────────────────────────────────
create table public.designers (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null unique references public.profiles(id) on delete cascade,
  brand_name       text        not null,
  bio              text,
  commission_rate  numeric(5,2) not null default 20.00
                               check (commission_rate between 0 and 100),
  total_earnings   numeric(12,2) not null default 0.00,
  payout_email     text,
  stripe_account   text,       -- Stripe Connect account ID (populated after onboarding)
  verified         boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.designers is 'Nail designer / supplier accounts. One per creator profile.';

alter table public.designers enable row level security;
create policy "designers_select_own"   on public.designers for select using (user_id = auth.uid());
create policy "designers_update_own"   on public.designers for update using (user_id = auth.uid());
create policy "designers_insert_own"   on public.designers for insert with check (user_id = auth.uid());
create policy "designers_public_read"  on public.designers for select using (verified = true);
create policy "designers_admin_all"    on public.designers for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create trigger designers_updated_at
  before update on public.designers
  for each row execute procedure public.set_updated_at();

-- ── Products ──────────────────────────────────────────────────────────────────
create table public.products (
  id               text        primary key,  -- slug e.g. "lume-01"
  name             text        not null,
  designer_id      uuid        references public.designers(id) on delete set null,
  price            numeric(10,2) not null check (price >= 0),
  top_color        text        not null,     -- hex
  mid_color        text        not null,
  bottom_color     text        not null,
  shape            text        not null check (shape in ('Almond','Stiletto','Oval','Coffin','Square')),
  finish           text        check (finish in ('Gloss','Matte','Metallic','Chrome')),
  description      text,
  length           text        check (length in ('Short','Medium','Long')),
  stock_count      integer     not null default 100,
  is_active        boolean     not null default true,
  try_on_count     integer     not null default 0,
  image_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.products is 'Nail polish products. try_on_count is incremented by a trigger on try_on_sessions.';

alter table public.products enable row level security;
-- All authenticated users can read active products; only admin/creator can write
create policy "products_public_read"   on public.products for select using (is_active = true);
create policy "products_creator_write" on public.products for all using (
  exists (
    select 1 from public.designers d
    join public.profiles p on p.id = d.user_id
    where p.id = auth.uid() and d.id = products.designer_id
  )
);
create policy "products_admin_all"     on public.products for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create trigger products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

-- ── Orders ────────────────────────────────────────────────────────────────────
create table public.orders (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete restrict,
  status           text        not null default 'pending'
                               check (status in ('pending','confirmed','shipped','delivered','cancelled','refunded')),
  subtotal         numeric(10,2) not null check (subtotal >= 0),
  shipping_cost    numeric(10,2) not null default 0.00,
  total            numeric(10,2) not null check (total >= 0),
  shipping_address jsonb,
  stripe_payment   text,       -- Stripe PaymentIntent ID
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.orders is 'Customer purchase orders. Statuses managed by webhook from Stripe/fulfilment.';

alter table public.orders enable row level security;
create policy "orders_select_own"   on public.orders for select using (user_id = auth.uid());
create policy "orders_insert_own"   on public.orders for insert with check (user_id = auth.uid());
create policy "orders_admin_all"    on public.orders for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

-- ── Order Items ───────────────────────────────────────────────────────────────
create table public.order_items (
  id               uuid        primary key default gen_random_uuid(),
  order_id         uuid        not null references public.orders(id) on delete cascade,
  product_id       text        references public.products(id) on delete set null,
  product_snapshot jsonb       not null,  -- name/price/colors at time of purchase
  quantity         integer     not null default 1 check (quantity > 0),
  unit_price       numeric(10,2) not null,
  shape_used       text,
  created_at       timestamptz not null default now()
);

alter table public.order_items enable row level security;
create policy "order_items_select_own" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);
create policy "order_items_insert_own" on public.order_items for insert with check (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);
create policy "order_items_admin_all"  on public.order_items for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ── Saved Looks ───────────────────────────────────────────────────────────────
create table public.saved_looks (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  product_id       text        references public.products(id) on delete set null,
  style_snapshot   jsonb       not null,  -- NailStyle JSON at time of save
  thumbnail_url    text,
  created_at       timestamptz not null default now()
);

alter table public.saved_looks enable row level security;
create policy "looks_own" on public.saved_looks for all using (user_id = auth.uid());

-- ── Try-on Sessions (analytics + MLOps feedback) ─────────────────────────────
create table public.try_on_sessions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references public.profiles(id) on delete set null,
  product_id       text        references public.products(id) on delete set null,
  shape_used       text,
  duration_seconds integer,
  captured         boolean     not null default false,  -- user hit "Save" button
  converted        boolean     not null default false,  -- user added to cart
  renderer_version text        default 'v3.0',
  accuracy_score   numeric(5,2),  -- if self-reported or computed
  created_at       timestamptz not null default now()
);

alter table public.try_on_sessions enable row level security;
create policy "sessions_insert_own" on public.try_on_sessions for insert with check (
  user_id is null or user_id = auth.uid()
);
create policy "sessions_admin_all"  on public.try_on_sessions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Trigger: increment product try_on_count on session insert
create or replace function public.increment_try_on_count()
returns trigger language plpgsql as $$
begin
  if new.product_id is not null then
    update public.products set try_on_count = try_on_count + 1 where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger try_on_count_increment
  after insert on public.try_on_sessions
  for each row execute procedure public.increment_try_on_count();

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index idx_orders_user_id         on public.orders(user_id, created_at desc);
create index idx_order_items_order_id   on public.order_items(order_id);
create index idx_saved_looks_user_id    on public.saved_looks(user_id, created_at desc);
create index idx_try_on_sessions_prod   on public.try_on_sessions(product_id, created_at desc);
create index idx_products_active        on public.products(is_active, created_at desc);
create index idx_products_designer      on public.products(designer_id);

-- ── Admin view: revenue per designer ─────────────────────────────────────────
create view public.designer_revenue as
  select
    d.id            as designer_id,
    d.brand_name,
    d.commission_rate,
    count(distinct oi.order_id) as order_count,
    sum(oi.quantity * oi.unit_price) as gross_revenue,
    sum(oi.quantity * oi.unit_price * d.commission_rate / 100) as designer_earnings
  from public.designers d
  join public.products p  on p.designer_id = d.id
  join public.order_items oi on oi.product_id = p.id
  join public.orders o    on o.id = oi.order_id and o.status not in ('cancelled','refunded')
  group by d.id, d.brand_name, d.commission_rate;

-- ── Seed data (mirrors src/data/products.ts) ──────────────────────────────────
insert into public.products (id, name, price, top_color, mid_color, bottom_color, shape, finish, description, length, stock_count) values
  ('lume-01', 'Velvet Dahlia',       28.00, '#3D1F4A', '#5C2F6E', '#1A0F1E', 'Almond',   'Gloss',    'Deep plum meets midnight violet.',          'Medium', 100),
  ('lume-02', 'Liquid Gold',         52.00, '#D4AF37', '#C49A1A', '#8B6914', 'Stiletto', 'Metallic', 'Burnished 24k chrome.',                     'Long',   50),
  ('lume-03', 'Classic French 2.0',  34.00, '#FDF6F0', '#F5E8DC', '#EDD5C5', 'Oval',     'Gloss',    'Updated nude with warm ivory tip.',         'Short',  200),
  ('lume-04', 'Onyx Chroma',         38.00, '#1A1A2E', '#16213E', '#0F3460', 'Coffin',   'Chrome',   'Obsidian meets midnight-shift iridescence.','Medium', 80),
  ('lume-05', 'Rosé Reverie',        32.00, '#E8ADC3', '#D4829F', '#BE5C80', 'Almond',   'Gloss',    'Dusty pink romanticism.',                   'Medium', 150),
  ('lume-06', 'Midnight Chrome',     46.00, '#191970', '#0D0D5A', '#050530', 'Stiletto', 'Chrome',   'Electric indigo at the edge of void.',      'Long',   60)
on conflict (id) do nothing;
