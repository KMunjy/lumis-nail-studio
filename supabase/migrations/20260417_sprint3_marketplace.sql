-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260417_sprint3_marketplace
-- Sprint 3 — Marketplace governance
--
-- Creates:
--   1. creator_verifications  — gated onboarding verification for creators/suppliers
--   2. platform_flags         — kill-switch and feature flag store
--   3. admin_audit_log        — immutable admin action audit trail
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. creator_verifications ─────────────────────────────────────────────────

create table if not exists public.creator_verifications (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,

  -- Verification state machine: pending → under_review → approved | rejected
  status          text        not null default 'pending'
                  check (status in ('pending', 'under_review', 'approved', 'rejected', 'suspended')),

  -- Submitted evidence (URLs or base64 thumbnails — store securely)
  business_name   text        not null,
  business_type   text        not null check (business_type in ('individual', 'salon', 'brand', 'distributor')),
  country         text        not null default 'ZA',
  portfolio_url   text,
  instagram_handle text,

  -- Supporting documents (stored in Supabase Storage — paths only)
  id_document_path    text,   -- identity document
  business_reg_path   text,   -- company registration (if applicable)

  -- Admin review
  reviewed_by         uuid    references auth.users(id),
  reviewed_at         timestamptz,
  rejection_reason    text,
  admin_notes         text,

  -- Timestamps
  submitted_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (user_id)
);

comment on table public.creator_verifications is
  'Creator/supplier onboarding verification. Status must be approved before '
  'creator can list products or access creator dashboard.';

drop trigger if exists creator_verifications_updated_at on public.creator_verifications;
create trigger creator_verifications_updated_at
  before update on public.creator_verifications
  for each row execute function public.set_updated_at();

-- ── 2. platform_flags (kill-switch + feature flags) ──────────────────────────

create table if not exists public.platform_flags (
  key             text        primary key,
  enabled         boolean     not null default true,
  description     text,
  -- When false and kill_switch = true, the feature is fully disabled
  kill_switch     boolean     not null default false,
  updated_by      uuid        references auth.users(id),
  updated_at      timestamptz not null default now()
);

comment on table public.platform_flags is
  'Platform-wide feature flags and kill-switches. '
  'kill_switch=true + enabled=false disables the feature for all users.';

-- Seed default flags
insert into public.platform_flags (key, enabled, kill_switch, description) values
  ('try_on_camera',    true,  true,  'Live camera AR try-on — kill-switch disables for all users'),
  ('try_on_photo',     true,  true,  'Photo upload try-on'),
  ('try_on_video',     true,  true,  'Video upload try-on'),
  ('marketplace',      true,  true,  'Marketplace browsing and purchase'),
  ('creator_upload',   true,  true,  'Creator product submission'),
  ('ad_token',         true,  false, 'Zero-rate ad-watch entitlement'),
  ('depth_parallax',   true,  false, '3D parallax depth warp (MiDaS)')
on conflict (key) do nothing;

-- ── 3. admin_audit_log ───────────────────────────────────────────────────────

create table if not exists public.admin_audit_log (
  id              uuid        primary key default gen_random_uuid(),
  admin_user_id   uuid        not null references auth.users(id),
  action          text        not null,
  target_type     text        not null, -- 'creator_verification' | 'platform_flag' | 'user' | 'product'
  target_id       text,
  details         jsonb       default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Immutable admin action audit trail. No update or delete policy (append-only).';

-- RLS: admins can insert and read; no updates or deletes allowed
alter table public.admin_audit_log enable row level security;
create policy "audit_log_admin_insert" on public.admin_audit_log
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy "audit_log_admin_read" on public.admin_audit_log
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
-- Explicitly deny updates and deletes (defence in depth)
create policy "audit_log_no_update" on public.admin_audit_log
  for update using (false);
create policy "audit_log_no_delete" on public.admin_audit_log
  for delete using (false);

-- RLS for creator_verifications
alter table public.creator_verifications enable row level security;
create policy "creator_verify_self_read" on public.creator_verifications
  for select using (auth.uid() = user_id);
create policy "creator_verify_self_insert" on public.creator_verifications
  for insert with check (auth.uid() = user_id);
create policy "creator_verify_admin_all" on public.creator_verifications
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- platform_flags: readable by all authenticated users (needed for kill-switch check)
alter table public.platform_flags enable row level security;
create policy "platform_flags_read_all" on public.platform_flags
  for select using (auth.uid() is not null);
create policy "platform_flags_admin_write" on public.platform_flags
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
