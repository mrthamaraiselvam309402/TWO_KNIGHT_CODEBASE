-- =====================================================
-- Distributed rate-limit storage for edge functions
-- Date: 2026-05-30
-- Reason: supabase/functions/*/rate_limit.js queries this table to
--         enforce per-IP / per-key request quotas across instances.
--         Live probe confirmed the table did not exist on the project,
--         so every call was falling back to in-memory state (which is
--         lost between cold starts and not shared across functions).
-- Idempotent: safe to re-run.
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL,
  endpoint   TEXT        NOT NULL DEFAULT 'default',
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Hot lookup path: (key, timestamp >= window_start)
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_ts
  ON rate_limits (key, timestamp DESC);

-- Sweep path: delete rows older than window
CREATE INDEX IF NOT EXISTS idx_rate_limits_ts
  ON rate_limits (timestamp);

-- Optional: endpoint scoping
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint
  ON rate_limits (endpoint, timestamp DESC);

-- RLS: only service_role should ever read/write this. Anon/auth must be denied.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role only" ON rate_limits;
CREATE POLICY "service_role only" ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Optional GC helper (call from a cron or pg_cron job to keep the table tiny)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits(older_than_minutes INTEGER DEFAULT 60)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE timestamp < timezone('utc', now()) - (older_than_minutes || ' minutes')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'rate_limits table ready' AS result;
