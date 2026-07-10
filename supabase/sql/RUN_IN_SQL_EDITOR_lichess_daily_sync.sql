-- ============================================================
-- DAILY LICHESS AUTO-SYNC
-- Refreshes the lichess_cache for every linked student once a
-- day by calling the lichess-sync edge function in bulk mode
-- (POST ?all=1). Runs at 21:45 UTC = 03:15 IST, before the
-- payment-status cron. Requires the pg_cron + pg_net extensions
-- (both available on Supabase; pg_net ships enabled).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('daily-lichess-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-lichess-sync');

SELECT cron.schedule(
  'daily-lichess-sync',
  '45 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zznbanjdkwofsvpzybtr.supabase.co/functions/v1/lichess-sync?all=1',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

SELECT 'daily-lichess-sync scheduled (21:45 UTC / 03:15 IST)' AS result;
