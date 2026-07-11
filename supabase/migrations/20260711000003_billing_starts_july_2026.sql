-- ============================================================
-- BILLING STARTS JULY 2026
-- The academy began collecting fees in July 2026. Any month
-- before 2026-07 must never be billable: no Due/Overdue, no
-- June (or earlier) arrears. Add an early return to the
-- per-month status function so historical months are neutral.
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
  -- Academy billing floor: nothing before July 2026 is collectable.
  IF (p_year < 2026) OR (p_year = 2026 AND p_month < 7) THEN
    RETURN 'Not Enrolled';
  END IF;

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

-- Refresh the cached statuses so the change is immediately visible.
SELECT public.recompute_payment_statuses();

SELECT 'Billing floor set to July 2026' AS result;
