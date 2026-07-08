-- =====================================================
-- PERMANENT FIX: ensure payment automation never corrupts
-- the enrollment 'status' column.
-- Idempotent + safe to re-run. Applies regardless of how
-- far previous migrations got.
-- =====================================================

-- 1. Authoritative definition: ONLY touch payment_status.
DROP FUNCTION IF EXISTS public.update_overdue_payments() CASCADE;
CREATE OR REPLACE FUNCTION public.update_overdue_payments()
RETURNS void AS $$
BEGIN
  UPDATE public.students
  SET payment_status = 'Due'
  WHERE payment_status = 'Pending'
    AND due_date IS NOT NULL
    AND due_date <= CURRENT_DATE;

  UPDATE public.students
  SET payment_status = 'Overdue'
  WHERE payment_status = 'Due'
    AND due_date IS NOT NULL
    AND due_date < (CURRENT_DATE - INTERVAL '3 days');
END;
$$ LANGUAGE plpgsql;

-- 2. Reschedule the cron job cleanly (unschedule old first so a
--    buggy leftover definition can never run again).
SELECT cron.unschedule('update-overdue-payments-job')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-overdue-payments-job');

SELECT cron.schedule(
  'update-overdue-payments-job',
  '0 0 * * *',
  'SELECT public.update_overdue_payments();'
);

-- 3. Repair any enrollment statuses that the old buggy cron
--    left stuck in payment-state values.
UPDATE public.students
SET status = 'active', account_status = 'active'
WHERE status IN ('Due', 'Overdue', 'Pending', 'Paid');

SELECT 'Payment automation hardened: status column protected' AS result;
