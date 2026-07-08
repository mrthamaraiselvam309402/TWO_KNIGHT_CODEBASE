-- ============================================================
-- SIMPLIFY PAYMENT STATUS
-- Remove the debt-first / credit-rollover collection engine.
-- A student's payment status for a month is now derived
-- directly from recorded payments (payment_date / applied_month)
-- plus their due_date. No credit carry-over, no arrears
-- allocation. The enrollment `status` column is never touched.
-- ============================================================

-- 1. Unschedule every legacy / competing cron job
SELECT cron.unschedule('update-overdue-payments-job')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-overdue-payments-job');
SELECT cron.unschedule('daily-payment-sync')           WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-payment-sync');
SELECT cron.unschedule('daily-payment-sync-v4')        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-payment-sync-v4');
SELECT cron.unschedule('monthly-payment-rollover')     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-payment-rollover');
SELECT cron.unschedule('monthly-payment-rollover-v4')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-payment-rollover-v4');
SELECT cron.unschedule('daily-payment-audit')          WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-payment-audit');

-- 2. Drop the debt-first engine objects
DROP TRIGGER IF EXISTS recalc_balances_trigger ON payment_allocations;
DROP FUNCTION IF EXISTS public.recalc_student_balances() CASCADE;
DROP FUNCTION IF EXISTS public.apply_payment_debt_first(TEXT, TEXT, NUMERIC, TIMESTAMP WITH TIME ZONE, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.monthly_rollover_job_v4() CASCADE;
DROP FUNCTION IF EXISTS public.update_payment_status(INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.automate_payment_rollover() CASCADE;
DROP FUNCTION IF EXISTS public.update_overdue_payments() CASCADE;

-- ============================================================
-- 3. Canonical per-month status derivation
--    Paid  : a 'paid' payment is dated / applied to this month
--    else due-date based: Pending -> Due -> Overdue
-- ============================================================
CREATE OR REPLACE FUNCTION public.payment_status_for_month(
  p_student_id TEXT,
  p_year INT,
  p_month INT
)
RETURNS TEXT AS $$
DECLARE
  v_key TEXT := p_year || '-' || LPAD(p_month::TEXT, 2, '0');
  v_due_day INT;
  v_due_date DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Already paid for this month?
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.student_id = p_student_id
      AND p.status = 'paid'
      AND COALESCE(p.applied_month, TO_CHAR(p.payment_date::DATE, 'YYYY-MM')) = v_key
  ) THEN
    RETURN 'Paid';
  END IF;

  SELECT COALESCE(EXTRACT(DAY FROM due_date)::INT, 5)
    INTO v_due_day
  FROM public.students
  WHERE id = p_student_id;

  v_due_date := MAKE_DATE(p_year, p_month, v_due_day);

  IF (p_year > EXTRACT(YEAR FROM v_today)::INT)
     OR (p_year = EXTRACT(YEAR FROM v_today)::INT AND p_month > EXTRACT(MONTH FROM v_today)::INT)
     OR v_today < v_due_date THEN
    RETURN 'Pending';
  END IF;

  IF (v_today - v_due_date) > 3 THEN
    RETURN 'Overdue';
  END IF;

  RETURN 'Due';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 4. Daily job: refresh the stored `payment_status` (current month)
--    for every active student. Never writes `status`.
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_payment_statuses()
RETURNS JSONB AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  v_paid INT := 0;
  v_pending INT := 0;
  v_due INT := 0;
  v_overdue INT := 0;
BEGIN
  UPDATE public.students s
  SET payment_status = public.payment_status_for_month(s.id, v_year, v_month)
  WHERE s.status = 'active';

  SELECT COUNT(*) FILTER (WHERE payment_status = 'Paid')    INTO v_paid    FROM public.students;
  SELECT COUNT(*) FILTER (WHERE payment_status = 'Pending') INTO v_pending FROM public.students;
  SELECT COUNT(*) FILTER (WHERE payment_status = 'Due')     INTO v_due     FROM public.students;
  SELECT COUNT(*) FILTER (WHERE payment_status = 'Overdue') INTO v_overdue FROM public.students;

  RETURN jsonb_build_object(
    'paid', v_paid, 'pending', v_pending, 'due', v_due, 'overdue', v_overdue,
    'year', v_year, 'month', v_month, 'run_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Cycle reporting views (rewritten to the simple model)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_payment_status_for_cycle(
  p_year   INT,
  p_month1 INT,
  p_month2 INT DEFAULT NULL
)
RETURNS TABLE(
  student_id   TEXT,
  student_name TEXT,
  live_status  TEXT,
  monthly_fee  INT
) AS $$
DECLARE
  v_month2 INT := COALESCE(p_month2, p_month1);
  v_key1 TEXT := p_year || '-' || LPAD(p_month1::TEXT, 2, '0');
  v_key2 TEXT := p_year || '-' || LPAD(v_month2::TEXT, 2, '0');
BEGIN
  RETURN QUERY
  SELECT
    s.id                                          AS student_id,
    COALESCE(s.name, '')                          AS student_name,
    public.payment_status_for_month(s.id, p_year, p_month1) AS live_status,
    COALESCE(s.monthly_fee, 0)                    AS monthly_fee
  FROM public.students s
  WHERE s.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_cycle_summary(
  p_year   INT,
  p_month1 INT,
  p_month2 INT DEFAULT NULL
)
RETURNS TABLE(
  status        TEXT,
  count         BIGINT,
  total_revenue BIGINT
) AS $$
DECLARE
  v_month2 INT := COALESCE(p_month2, p_month1);
BEGIN
  RETURN QUERY
  SELECT
    x.live_status                           AS status,
    COUNT(*)                                AS count,
    COALESCE(SUM(x.monthly_fee), 0)::BIGINT AS total_revenue
  FROM public.get_payment_status_for_cycle(p_year, p_month1, v_month2) x
  GROUP BY x.live_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Single consolidated cron job
-- ============================================================
SELECT cron.schedule(
  'daily-payment-status-sync',
  '5 0 * * *',
  $$ SELECT public.recompute_payment_statuses(); $$
);

-- Repair any enrollment statuses the old engine may have left stuck.
UPDATE public.students
SET status = 'active', account_status = 'active'
WHERE status IN ('Due', 'Overdue', 'Pending', 'Paid');

SELECT 'Payment status simplified to per-month derivation' AS result;
