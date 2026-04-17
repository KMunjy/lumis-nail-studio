-- =============================================================================
-- LUMIS Nail Studio — Sprint 3 Migration
-- 2026-04-13  ·  Loyalty · Saved Looks · Referral Tracking
-- =============================================================================
-- Run with: supabase db push  (or apply via Supabase Dashboard SQL editor)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LOYALTY POINTS  (one row per authenticated user; balance + lifetime)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance      integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_pts integer     NOT NULL DEFAULT 0 CHECK (lifetime_pts >= 0),
  tier         text        NOT NULL DEFAULT 'Bronze'
                           CHECK (tier IN ('Bronze','Silver','Gold','Platinum')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  loyalty_points              IS 'Running loyalty balance per user. balance is spendable; lifetime_pts never decrements.';
COMMENT ON COLUMN loyalty_points.balance      IS 'Spendable points (decremented on redemption).';
COMMENT ON COLUMN loyalty_points.lifetime_pts IS 'Cumulative earned points — used solely for tier calculation.';
COMMENT ON COLUMN loyalty_points.tier         IS 'Computed tier: Bronze 0-199, Silver 200-499, Gold 500-999, Platinum 1000+.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LOYALTY EVENTS  (immutable audit log)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   text        NOT NULL
               CHECK (event_type IN (
                 'try_on_session', 'add_to_cart', 'purchase',
                 'share_look', 'referral_signup', 'redemption'
               )),
  points_delta integer     NOT NULL,
  metadata     jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_events_user_created
  ON loyalty_events (user_id, created_at DESC);

COMMENT ON TABLE loyalty_events IS 'Append-only event log for every loyalty point award or deduction.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SAVED LOOKS  (captures saved by authenticated users)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_looks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id     text        NOT NULL,
  product_name   text        NOT NULL,
  -- Supabase Storage object path (preferred: avoids large base64 in DB rows)
  storage_path   text,
  -- 128×128 JPEG data-URL thumbnail fallback (used when Storage not configured)
  thumbnail_b64  text,
  shape          text        NOT NULL,
  finish         text        NOT NULL
                 CHECK (finish IN ('Gloss','Matte','Metallic','Chrome','Jelly','Glitter','CatEye')),
  -- Full NailStyle JSON snapshot for re-rendering
  style_json     jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_looks_user_created
  ON saved_looks (user_id, created_at DESC);

COMMENT ON TABLE  saved_looks               IS 'User-saved try-on captures. Images stored in Supabase Storage; only path stored here.';
COMMENT ON COLUMN saved_looks.storage_path  IS 'Object path in the "looks" Supabase Storage bucket, e.g. "user-uuid/look-uuid.jpg".';
COMMENT ON COLUMN saved_looks.thumbnail_b64 IS 'Fallback 128px JPEG data-URL for offline/dev environments.';
COMMENT ON COLUMN saved_looks.style_json    IS 'Full NailStyle snapshot at capture time (colors, shape, finish, density, etc.).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REFERRAL CLICKS  (anonymous, no user FK required)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_clicks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   text        NOT NULL,
  ref_source   text        NOT NULL,  -- 'wa-share' | 'x-share' | 'pin-share' | 'copy'
  clicked_at   timestamptz NOT NULL DEFAULT now(),
  user_agent   text,
  -- SHA-256 of IP for dedup without storing raw PII
  ip_hash      text
);

CREATE INDEX IF NOT EXISTS referral_clicks_product_source
  ON referral_clicks (product_id, ref_source, clicked_at DESC);

COMMENT ON TABLE referral_clicks IS 'Anonymous referral click log. ip_hash used for dedup only; raw IP never stored.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE loyalty_points  ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_looks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

-- loyalty_points: users read their own row; no direct writes (use RPC)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_points' AND policyname = 'Users read own loyalty balance'
  ) THEN
    CREATE POLICY "Users read own loyalty balance"
      ON loyalty_points FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- loyalty_events: users read their own events; no direct writes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_events' AND policyname = 'Users read own loyalty events'
  ) THEN
    CREATE POLICY "Users read own loyalty events"
      ON loyalty_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- saved_looks: users manage their own looks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_looks' AND policyname = 'Users manage own looks'
  ) THEN
    CREATE POLICY "Users manage own looks"
      ON saved_looks FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- referral_clicks: anonymous inserts allowed; reads restricted to service role
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referral_clicks' AND policyname = 'Anonymous referral click insert'
  ) THEN
    CREATE POLICY "Anonymous referral click insert"
      ON referral_clicks FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SECURITY DEFINER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- award_loyalty_points: atomic upsert + event log + tier computation
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_user_id    uuid,
  p_amount     integer,
  p_event_type text,
  p_metadata   jsonb DEFAULT '{}'
)
RETURNS integer         -- new spendable balance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance     integer;
  v_lifetime    integer;
  v_tier        text;
BEGIN
  -- Upsert the loyalty_points row
  INSERT INTO loyalty_points (user_id, balance, lifetime_pts)
  VALUES (p_user_id, p_amount, GREATEST(p_amount, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance      = loyalty_points.balance      + p_amount,
        lifetime_pts = loyalty_points.lifetime_pts + GREATEST(p_amount, 0),
        updated_at   = now()
  RETURNING balance, lifetime_pts INTO v_balance, v_lifetime;

  -- Derive tier from lifetime points
  v_tier := CASE
    WHEN v_lifetime >= 1000 THEN 'Platinum'
    WHEN v_lifetime >= 500  THEN 'Gold'
    WHEN v_lifetime >= 200  THEN 'Silver'
    ELSE 'Bronze'
  END;

  UPDATE loyalty_points
  SET    tier = v_tier
  WHERE  user_id = p_user_id AND tier <> v_tier;

  -- Append to event log
  INSERT INTO loyalty_events (user_id, event_type, points_delta, metadata)
  VALUES (p_user_id, p_event_type, p_amount, p_metadata);

  RETURN v_balance;
END;
$$;

COMMENT ON FUNCTION award_loyalty_points IS
  'Atomically award (or deduct) loyalty points for a user, update their tier, and append an event log entry. Called by API routes with the service-role key.';

-- get_loyalty_summary: safe read for authenticated users
CREATE OR REPLACE FUNCTION get_loyalty_summary(p_user_id uuid)
RETURNS TABLE (
  balance      integer,
  lifetime_pts integer,
  tier         text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT balance, lifetime_pts, tier
  FROM   loyalty_points
  WHERE  user_id = p_user_id;
$$;

COMMENT ON FUNCTION get_loyalty_summary IS
  'Returns the loyalty balance, lifetime points, and tier for the requesting user.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SUPABASE STORAGE BUCKET  (run once via Supabase Dashboard or CLI)
-- ─────────────────────────────────────────────────────────────────────────────
-- These statements use the Supabase-specific storage schema.
-- Uncomment and run manually if storage_api schema is available:
--
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'looks', 'looks', false, 5242880,  -- 5 MB limit
--   ARRAY['image/jpeg','image/webp','image/png']
-- )
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "Users upload own looks"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'looks' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users read own looks"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'looks' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users delete own looks"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'looks' AND auth.uid()::text = (storage.foldername(name))[1]);
