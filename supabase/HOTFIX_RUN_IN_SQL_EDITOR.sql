-- =====================================================
-- ONE-SHOT HOTFIX for production: vseombfkrvpffnpgbsnk
-- Run this file in: Supabase Dashboard -> SQL Editor -> New Query
-- =====================================================
-- A live REST probe (2026-05-30) against the project found:
--   1. messages.sender_name and messages.receiver_id columns are MISSING
--      => POST /api/messages currently returns 400/42703 when backend
--         tries to persist either field.
--   2. messages RLS policy is "FOR ALL USING (true)" with NO WITH CHECK
--      => every anon INSERT is silently denied with 42501 RLS violation.
--   3. messages CHECK constraints don't allow 'coach' / 'student' types
--      => parent->coach flow violates the constraint.
--   4. public.rate_limits table doesn't exist
--      => every edge function's distributed rate-limiter falls back to
--         per-instance in-memory state (lost on cold start).
--
-- This script applies all four fixes idempotently. Safe to re-run.
-- =====================================================

-- ─── 1. messages: add missing columns ────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id TEXT;

-- ─── 2. messages: relax CHECK constraints ────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_type_check') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sender_type_check;
  END IF;
END $$;
ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check
  CHECK (sender_type IN ('parent', 'admin', 'system', 'coach', 'student'));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_receiver_type_check') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_receiver_type_check;
  END IF;
END $$;
ALTER TABLE messages ADD CONSTRAINT messages_receiver_type_check
  CHECK (receiver_type IN ('parent', 'admin', 'system', 'coach'));

-- ─── 3. messages: fix RLS so anon can INSERT ─────────────────────────
DROP POLICY IF EXISTS "Allow all on messages" ON messages;
CREATE POLICY "Allow all on messages" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── 4. messages: helpful index for the receiver join ────────────────
CREATE INDEX IF NOT EXISTS idx_messages_receiver  ON messages(receiver_type, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created   ON messages(created_at DESC);

-- ─── 5. messages: auto read_at trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION set_messages_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = TRUE AND (OLD.is_read IS DISTINCT FROM TRUE) THEN
    NEW.read_at := COALESCE(NEW.read_at, timezone('utc', now()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_read_at ON messages;
CREATE TRIGGER trg_messages_read_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_messages_read_at();

-- ─── 6. rate_limits: create missing table ────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL,
  endpoint   TEXT        NOT NULL DEFAULT 'default',
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_ts   ON rate_limits (key, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ts       ON rate_limits (timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits (endpoint, timestamp DESC);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role only" ON rate_limits;
CREATE POLICY "service_role only" ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Done ────────────────────────────────────────────────────────────
SELECT 'Hotfix applied OK' AS result;
