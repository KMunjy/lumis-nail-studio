-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260417_sprint1_privacy
-- Sprint 1 — Privacy & POPIA readiness
--
-- Creates:
--   1. user_consent          — server-side consent record (POPIA §11 / GDPR Art.6)
--   2. erasure_requests      — right-to-erasure audit log (POPIA §24 / GDPR Art.17)
--   3. RLS policies          — row-level security so users can only see own records
--   4. Indexes               — for consent lookups by user_id + type
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. user_consent ──────────────────────────────────────────────────────────

create table if not exists public.user_consent (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,

  -- Type of consent: 'camera' | 'storage' | 'analytics' | 'marketing'
  consent_type      text        not null check (consent_type in ('camera', 'storage', 'analytics', 'marketing')),

  -- Consent state
  given             boolean     not null default false,

  -- Policy version at time of consent — must match CURRENT_POLICY_VERSION in consent.ts
  policy_version    text        not null default '1.0.0',

  -- Timestamps
  given_at          timestamptz,
  withdrawn_at      timestamptz,

  -- Source: 'banner' | 'settings' | 'api'
  source            text        not null default 'banner',

  -- Metadata for audit trail (user-agent, locale, etc.)
  metadata          jsonb       default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- One record per user per consent type
  unique (user_id, consent_type)
);

comment on table public.user_consent is
  'Server-side consent records per user per consent type. POPIA §11 / GDPR Art.6(1)(a).';

-- ── 2. erasure_requests ──────────────────────────────────────────────────────

create table if not exists public.erasure_requests (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,

  -- Status of the erasure
  status            text        not null default 'pending'
                    check (status in ('pending', 'processing', 'completed', 'failed', 'partial')),

  -- What was requested
  scope             text[]      not null default array['consent', 'saved_looks', 'try_on_sessions'],

  -- Audit trail of what was actually deleted
  actions_taken     jsonb       default '[]'::jsonb,

  -- Error details if failed
  error_detail      text,

  -- Timestamps
  requested_at      timestamptz not null default now(),
  completed_at      timestamptz,

  -- Request source
  initiated_by      text        not null default 'user' check (initiated_by in ('user', 'admin', 'legal')),

  -- Legal retention override — some records cannot be deleted (e.g. financial)
  retained_records  jsonb       default '[]'::jsonb,

  created_at        timestamptz not null default now()
);

comment on table public.erasure_requests is
  'Right-to-erasure request audit log. POPIA §24 / GDPR Art.17. '
  'Financial records (orders) are retained as required by law but PII anonymised.';

-- ── 3. Updated_at trigger ────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_consent_updated_at on public.user_consent;
create trigger user_consent_updated_at
  before update on public.user_consent
  for each row execute function public.set_updated_at();

-- ── 4. Row-level security ────────────────────────────────────────────────────

alter table public.user_consent     enable row level security;
alter table public.erasure_requests enable row level security;

-- user_consent: users can read and write only their own records
create policy "user_consent_self_read" on public.user_consent
  for select using (auth.uid() = user_id);

create policy "user_consent_self_insert" on public.user_consent
  for insert with check (auth.uid() = user_id);

create policy "user_consent_self_update" on public.user_consent
  for update using (auth.uid() = user_id);

-- Admins can read all consent records (for compliance audits)
create policy "user_consent_admin_read" on public.user_consent
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- erasure_requests: users can insert and read their own
create policy "erasure_self_insert" on public.erasure_requests
  for insert with check (auth.uid() = user_id);

create policy "erasure_self_read" on public.erasure_requests
  for select using (auth.uid() = user_id);

-- Admins can read and update all erasure requests (to process them)
create policy "erasure_admin_all" on public.erasure_requests
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── 5. Indexes ───────────────────────────────────────────────────────────────

create index if not exists idx_user_consent_user_id
  on public.user_consent (user_id);

create index if not exists idx_user_consent_type
  on public.user_consent (user_id, consent_type);

create index if not exists idx_erasure_requests_user_id
  on public.erasure_requests (user_id);

create index if not exists idx_erasure_requests_status
  on public.erasure_requests (status) where status = 'pending';

-- ── 6. Service-role helper function for erasure processing ───────────────────

-- Called by /api/erasure route with service-role key (bypasses RLS)
create or replace function public.process_erasure(p_user_id uuid)
returns jsonb
language plpgsql
security definer  -- runs as table owner, not calling user
as $$
declare
  v_actions jsonb := '[]'::jsonb;
  v_count   int;
begin
  -- Delete saved looks (user-generated content — no legal retention requirement)
  delete from public.saved_looks where user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_actions := v_actions || jsonb_build_object('table', 'saved_looks', 'deleted', v_count);

  -- Delete try-on sessions (analytics — no legal retention requirement)
  delete from public.try_on_sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_actions := v_actions || jsonb_build_object('table', 'try_on_sessions', 'deleted', v_count);

  -- Anonymise orders — retain for legal/financial record but remove PII
  -- shipping_address and notes contain PII; replace with anonymised marker
  update public.orders
  set
    shipping_address = '{"anonymised": true}'::jsonb,
    notes            = null
  where user_id = p_user_id;
  get diagnostics v_count = row_count;
  v_actions := v_actions || jsonb_build_object('table', 'orders', 'anonymised', v_count);

  -- Withdraw all consent records
  update public.user_consent
  set given = false, withdrawn_at = now()
  where user_id = p_user_id and given = true;
  get diagnostics v_count = row_count;
  v_actions := v_actions || jsonb_build_object('table', 'user_consent', 'withdrawn', v_count);

  return v_actions;
end;
$$;

comment on function public.process_erasure is
  'Security-definer function for right-to-erasure. '
  'Deletes user content, anonymises financial records, withdraws consent. '
  'Called exclusively by /api/erasure with service-role key.';
