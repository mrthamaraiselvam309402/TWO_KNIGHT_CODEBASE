-- ============================================================
-- CHESSKIDOO PAYMENT AUTOMATION v3 — FULL SYSTEM
-- ============================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- STEP 1: ADD payment_status COLUMN to students if missing
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE students ADD COLUMN payment_status TEXT DEFAULT 'Pending';
    RAISE NOTICE 'Added payment_status column to students';
  END IF;
END $$;

-- ============================================================
-- STEP 2: PARAMETERIZED CLASSIFICATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_year   INT,
  p_month1 INT,
  p_month2 INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_month2 INT;
  v_paid   INT := 0;
  v_pending INT := 0;
  v_due    INT := 0;
BEGIN
  v_month2 := COALESCE(p_month2, p_month1);

  -- STEP A: Roll last cycle's Pending → Due
  UPDATE public.students
  SET payment_status = 'Due'
  WHERE payment_status = 'Pending'
    AND id NOT IN (
      SELECT DISTINCT student_id FROM public.payments
      WHERE EXTRACT(YEAR  FROM payment_date::DATE) = p_year
        AND EXTRACT(MONTH FROM payment_date::DATE) IN (p_month1, v_month2)
        AND status = 'paid'
    );

  -- STEP B: Mark as Paid if they have a payment this cycle
  UPDATE public.students s
  SET payment_status = 'Paid'
  WHERE EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.student_id = s.id
      AND EXTRACT(YEAR  FROM p.payment_date::DATE) = p_year
      AND EXTRACT(MONTH FROM p.payment_date::DATE) IN (p_month1, v_month2)
      AND p.status = 'paid'
  );

  -- STEP C: Remaining → Pending
  UPDATE public.students
  SET payment_status = 'Pending'
  WHERE payment_status NOT IN ('Paid', 'Due');

  SELECT COUNT(*) INTO v_paid   FROM public.students WHERE payment_status = 'Paid';
  SELECT COUNT(*) INTO v_pending FROM public.students WHERE payment_status = 'Pending';
  SELECT COUNT(*) INTO v_due    FROM public.students WHERE payment_status = 'Due';

  RETURN jsonb_build_object(
    'paid',    v_paid,
    'pending', v_pending,
    'due',     v_due,
    'year',    p_year,
    'month1',  p_month1,
    'month2',  v_month2,
    'run_at',  NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 3: DYNAMIC VIEW FUNCTION
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
  v_month2 INT;
BEGIN
  v_month2 := COALESCE(p_month2, p_month1);

  RETURN QUERY
  SELECT
    s.id                                   AS student_id,
    COALESCE(s.name, '')                   AS student_name,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.student_id = s.id
          AND EXTRACT(YEAR  FROM p.payment_date::DATE) = p_year
          AND EXTRACT(MONTH FROM p.payment_date::DATE) IN (p_month1, v_month2)
          AND p.status = 'paid'
      ) THEN 'Paid'
      WHEN s.payment_status = 'Due'
        OR (
          NOT EXISTS (
            SELECT 1 FROM public.payments p2
            WHERE p2.student_id = s.id
              AND p2.status = 'paid'
              AND p2.payment_date::DATE >= (
                DATE_TRUNC('month', TO_DATE(p_year||'-'||p_month1||'-01', 'YYYY-MM-DD'))
                - INTERVAL '1 month'
              )
              AND p2.payment_date::DATE <
                DATE_TRUNC('month', TO_DATE(p_year||'-'||p_month1||'-01', 'YYYY-MM-DD'))
          )
        )
      THEN 'Due'
      ELSE 'Pending'
    END                                    AS live_status,
    COALESCE(s.monthly_fee, 0)             AS monthly_fee
  FROM public.students s
  WHERE s.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 4: CYCLE SUMMARY FUNCTION
-- ============================================================
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
  v_month2 INT;
BEGIN
  v_month2 := COALESCE(p_month2, p_month1);

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
-- STEP 5: MONTHLY ROLLOVER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.monthly_rollover_job()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT public.update_payment_status(
    EXTRACT(YEAR  FROM CURRENT_DATE)::INT,
    EXTRACT(MONTH FROM CURRENT_DATE)::INT
  ) INTO v_result;

  INSERT INTO public.audit_logs(table_name, action, new_value)
  VALUES ('students', 'AUTO_PAYMENT_ROLLOVER', v_result);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 6: SCHEDULE CRON
-- ============================================================
SELECT cron.unschedule('monthly-payment-rollover') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-payment-rollover');
SELECT cron.unschedule('daily-payment-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-payment-sync');

SELECT cron.schedule(
  'monthly-payment-rollover',
  '1 0 1 * *',
  $$ SELECT public.monthly_rollover_job(); $$
);

SELECT cron.schedule(
  'daily-payment-sync',
  '5 0 * * *',
  $$ SELECT public.update_payment_status(
       EXTRACT(YEAR FROM CURRENT_DATE)::INT,
       EXTRACT(MONTH FROM CURRENT_DATE)::INT
     ); $$
);
