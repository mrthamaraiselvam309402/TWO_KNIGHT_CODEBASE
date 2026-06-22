-- ============================================================
-- CHESSKIDOO PAYMENT SYSTEM v4 — DEBT-FIRST + CREDIT ENGINE
-- ============================================================
-- Adds: credit_balance, billing_anchor, allocation ledger,
--       debt-first payment application, advance payment support.
-- ============================================================

-- ============================================================
-- STEP 1: ADD NEW COLUMNS TO students
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='credit_balance') THEN
    ALTER TABLE students ADD COLUMN credit_balance NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='outstanding_balance') THEN
    ALTER TABLE students ADD COLUMN outstanding_balance NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='billing_anchor_year') THEN
    ALTER TABLE students ADD COLUMN billing_anchor_year INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='billing_anchor_month') THEN
    ALTER TABLE students ADD COLUMN billing_anchor_month INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='last_payment_applied_month') THEN
    ALTER TABLE students ADD COLUMN last_payment_applied_month TEXT;
  END IF;
END $$;

-- Add applied_month to payments so frontend can do advance-aware counting
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='applied_month') THEN
    ALTER TABLE payments ADD COLUMN applied_month TEXT;
    RAISE NOTICE 'Added applied_month to payments';
  END IF;
END $$;

-- ============================================================
-- STEP 2: PAYMENT ALLOCATION LEDGER
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  payment_id TEXT REFERENCES payments(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  allocated_month TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  allocation_type TEXT DEFAULT 'DIRECT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_alloc_student ON payment_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_month ON payment_allocations(allocated_month);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on payment_allocations' AND tablename = 'payment_allocations') THEN
    CREATE POLICY "Allow all on payment_allocations" ON payment_allocations FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================
-- STEP 3: BACKFILL billing_anchor for existing students
-- Late-join >= day 26 => billing starts next month
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_enroll_date DATE;
  v_baseline DATE := DATE '2026-04-01';
  v_year INT;
  v_month INT;
BEGIN
  FOR r IN SELECT id, enrollment_date, created_at FROM students WHERE billing_anchor_year IS NULL LOOP
    v_enroll_date := COALESCE(
      r.enrollment_date::DATE,
      r.created_at::DATE,
      v_baseline
    );
    IF v_enroll_date < v_baseline THEN v_enroll_date := v_baseline; END IF;
    v_year := EXTRACT(YEAR FROM v_enroll_date)::INT;
    v_month := EXTRACT(MONTH FROM v_enroll_date)::INT;
    IF EXTRACT(DAY FROM v_enroll_date) >= 26 THEN
      v_month := v_month + 1;
      IF v_month > 12 THEN v_month := 1; v_year := v_year + 1; END IF;
    END IF;
    UPDATE students SET billing_anchor_year = v_year, billing_anchor_month = v_month WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================
-- STEP 4: apply_payment_debt_first
-- Core function: clear oldest overdue debts first, then current, then roll excess forward
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_payment_debt_first(
  p_student_id  TEXT,
  p_payment_id  TEXT,
  p_amount       NUMERIC,
  p_paid_on      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  p_target_month TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_student    RECORD;
  v_anchor_year INT;
  v_anchor_month INT;
  v_target_key TEXT;
  v_target_year INT;
  v_target_month_num INT;
  v_remaining NUMERIC := p_amount;
  v_allocated NUMERIC := 0;
  v_result JSONB := '[]'::JSONB;
  v_owed NUMERIC;
  v_allocation NUMERIC;
  v_fee NUMERIC;
  v_next_month_num INT;
  v_next_year INT;
  v_next_key TEXT;
  v_cursor_year INT;
  v_cursor_month_num INT;
  v_cursor_key TEXT;
BEGIN
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Student not found'); END IF;

  v_anchor_year := COALESCE(v_student.billing_anchor_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);
  v_anchor_month := COALESCE(v_student.billing_anchor_month, EXTRACT(MONTH FROM CURRENT_DATE)::INT);
  v_fee := COALESCE(v_student.monthly_fee, 5000);

  IF p_target_month IS NULL THEN
    v_target_key := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  ELSE
    v_target_key := p_target_month;
  END IF;
  v_target_year := SUBSTRING(v_target_key FROM 1 FOR 4)::INT;
  v_target_month_num := SUBSTRING(v_target_key FROM 6 FOR 2)::INT;

  -- DEBT-FIRST: iterate from anchor to just before target month
  v_cursor_year := v_anchor_year;
  v_cursor_month_num := v_anchor_month;

  WHILE (v_cursor_year < v_target_year OR (v_cursor_year = v_target_year AND v_cursor_month_num < v_target_month_num))
    AND v_remaining > 0 LOOP

    v_cursor_key := v_cursor_year || '-' || LPAD(v_cursor_month_num::TEXT, 2, '0');

    SELECT COALESCE(SUM(amount), 0) INTO v_owed
    FROM payment_allocations
    WHERE student_id = p_student_id AND allocated_month = v_cursor_key;

    IF COALESCE(v_owed, 0) < v_fee THEN
      v_owed := v_fee - COALESCE(v_owed, 0);

      IF v_remaining >= v_owed THEN
        v_allocation := v_owed;
        v_remaining := v_remaining - v_owed;
      ELSE
        v_allocation := v_remaining;
        v_remaining := 0;
      END IF;

      INSERT INTO payment_allocations (payment_id, student_id, allocated_month, amount, allocation_type, description)
      VALUES (p_payment_id, p_student_id, v_cursor_key, v_allocation, 'DEBT_CLEAR',
              'Applied to ' || v_cursor_key);

      v_result := v_result || jsonb_build_object('month', v_cursor_key, 'allocated', v_allocation, 'type', 'DEBT_CLEAR');
      v_allocated := v_allocated + v_allocation;
    END IF;

    v_cursor_month_num := v_cursor_month_num + 1;
    IF v_cursor_month_num > 12 THEN v_cursor_month_num := 1; v_cursor_year := v_cursor_year + 1; END IF;
  END LOOP;

  -- Phase 2: Apply to target
  IF v_remaining > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_owed
    FROM payment_allocations
    WHERE student_id = p_student_id AND allocated_month = v_target_key;
    v_owed := v_fee - COALESCE(v_owed, 0);

    IF v_remaining >= v_owed THEN
      v_allocation := v_owed;
      v_remaining := v_remaining - v_owed;
    ELSE
      v_allocation := v_remaining;
      v_remaining := 0;
    END IF;

    INSERT INTO payment_allocations (payment_id, student_id, allocated_month, amount, allocation_type, description)
    VALUES (p_payment_id, p_student_id, v_target_key, v_allocation, 'DIRECT',
            'Applied to ' || v_target_key);

    v_result := v_result || jsonb_build_object('month', v_target_key, 'allocated', v_allocation, 'type', 'DIRECT');
    v_allocated := v_allocated + v_allocation;
  END IF;

  -- Phase 3: Roll excess forward
  IF v_remaining > 0 THEN
    v_next_month_num := v_target_month_num + 1;
    v_next_year := v_target_year;
    IF v_next_month_num > 12 THEN v_next_month_num := 1; v_next_year := v_next_year + 1; END IF;
    v_next_key := v_next_year || '-' || LPAD(v_next_month_num::TEXT, 2, '0');

    INSERT INTO payment_allocations (payment_id, student_id, allocated_month, amount, allocation_type, description)
    VALUES (p_payment_id, p_student_id, v_next_key, v_remaining, 'CREDIT_ROLLOVER',
            'Excess from ' || v_target_key || ' rolled forward to ' || v_next_key);

    v_result := v_result || jsonb_build_object('month', v_next_key, 'allocated', v_remaining, 'type', 'CREDIT_ROLLOVER');
    v_allocated := v_allocated + v_remaining;
    v_remaining := 0;
  END IF;

  -- Update denormalized student fields
  UPDATE payments SET applied_month = v_target_key WHERE id = p_payment_id;

  UPDATE students SET
    credit_balance = 0,
    last_payment_applied_month = v_target_key
  WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'allocations', v_result,
    'carry_forward', v_remaining,
    'total_allocated', v_allocated,
    'target_month', v_target_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 5: get_student_financial_state
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_student_financial_state(
  p_student_id TEXT,
  p_month TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_student RECORD;
  v_month TEXT;
  v_year INT;
  v_month_num INT;
  v_anchor_year INT;
  v_anchor_month INT;
  v_fee NUMERIC;
  v_month_allocated NUMERIC;
  v_credit NUMERIC;
  v_status TEXT;
  v_due_date DATE;
  v_today DATE := CURRENT_DATE;
  v_days_late INT;
BEGIN
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Student not found'); END IF;

  v_fee := COALESCE(v_student.monthly_fee, 5000);
  v_credit := COALESCE(v_student.credit_balance, 0);
  v_anchor_year := COALESCE(v_student.billing_anchor_year, EXTRACT(YEAR FROM v_today)::INT);
  v_anchor_month := COALESCE(v_student.billing_anchor_month, EXTRACT(MONTH FROM v_today)::INT);

  IF p_month IS NULL THEN
    v_month := TO_CHAR(v_today, 'YYYY-MM');
  ELSE
    v_month := p_month;
  END IF;
  v_year := SUBSTRING(v_month FROM 1 FOR 4)::INT;
  v_month_num := SUBSTRING(v_month FROM 6 FOR 2)::INT;

  SELECT COALESCE(SUM(amount), 0) INTO v_month_allocated
  FROM payment_allocations
  WHERE student_id = p_student_id AND allocated_month = v_month;

  v_due_date := COALESCE(v_student.due_date, MAKE_DATE(v_year, v_month_num, 5));

  IF v_month_allocated >= v_fee THEN
    v_status := 'Paid';
  ELSIF v_today < v_due_date THEN
    v_status := 'Pending';
  ELSE
    v_days_late := (v_today - v_due_date);
    IF v_days_late > 5 THEN
      v_status := 'Overdue';
    ELSE
      v_status := 'Due';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'month', v_month,
    'monthly_fee', v_fee,
    'month_allocated', v_month_allocated,
    'month_outstanding', GREATEST(0, v_fee - v_month_allocated),
    'credit_balance', v_credit,
    'status', v_status,
    'due_date', TO_CHAR(v_due_date, 'YYYY-MM-DD'),
    'billing_anchor', v_anchor_year || '-' || LPAD(v_anchor_month::TEXT, 2, '0')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 6: monthly_rollover_job_v4
-- ============================================================
CREATE OR REPLACE FUNCTION public.monthly_rollover_job_v4()
RETURNS JSONB AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_old_month TEXT := TO_CHAR((v_today - INTERVAL '1 month'), 'YYYY-MM');
  v_new_month TEXT := TO_CHAR(v_today, 'YYYY-MM');
  v_student RECORD;
  v_old_allocated NUMERIC;
  v_fee NUMERIC;
  v_carry_credit NUMERIC := 0;
  v_new_status TEXT;
  v_count INT := 0;
  v_due_date DATE;
  v_days_late INT;
BEGIN
  FOR v_student IN SELECT * FROM students WHERE status = 'active' LOOP
    v_fee := COALESCE(v_student.monthly_fee, 5000);

    SELECT COALESCE(SUM(amount), 0) INTO v_old_allocated
    FROM payment_allocations
    WHERE student_id = v_student.id AND allocated_month = v_old_month;

    IF v_old_allocated >= v_fee THEN
      v_carry_credit := v_old_allocated - v_fee;
      IF v_carry_credit > 0 THEN
        INSERT INTO payment_allocations (student_id, allocated_month, amount, allocation_type, description)
        VALUES (v_student.id, v_new_month, v_carry_credit, 'CREDIT_ROLLOVER',
          'Auto-rollover credit from ' || v_old_month);
      END IF;
      v_new_status := 'Paid';
    ELSE
      v_carry_credit := 0;
      v_due_date := COALESCE(v_student.due_date, MAKE_DATE(EXTRACT(YEAR FROM v_today)::INT, EXTRACT(MONTH FROM v_today)::INT, 5));
      IF v_today < v_due_date THEN
        v_new_status := 'Pending';
      ELSE
        v_days_late := (v_today - v_due_date);
        IF v_days_late > 5 THEN
          v_new_status := 'Overdue';
        ELSE
          v_new_status := 'Due';
        END IF;
      END IF;
    END IF;

    v_count := v_count + 1;

    UPDATE students SET
      credit_balance = GREATEST(0, v_carry_credit),
      payment_status = v_new_status,
      last_payment_applied_month = v_new_month
    WHERE id = v_student.id;
  END LOOP;

  INSERT INTO audit_logs(table_name, action, new_value)
  VALUES ('students', 'MONTHLY_ROLLOVER_V4', jsonb_build_object('old_month', v_old_month, 'new_month', v_new_month, 'count', v_count));

  RETURN jsonb_build_object('old_month', v_old_month, 'new_month', v_new_month, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 7: TRIGGER — log allocation changes (outstanding_balance maintained by RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_student_balances()
RETURNS TRIGGER AS $$
DECLARE
  sid TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sid := OLD.student_id;
  ELSE
    sid := NEW.student_id;
  END IF;

  -- outstanding_balance is maintained by apply_payment_debt_first and monthly_rollover_job_v4
  -- This trigger only exists as a hook point if future logic needs to react to allocation changes.

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalc_balances_trigger ON payment_allocations;
CREATE TRIGGER recalc_balances_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recalc_student_balances();

-- ============================================================
-- STEP 8: CRON SCHEDULES
-- ============================================================
SELECT cron.unschedule('monthly-payment-rollover') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-payment-rollover');
SELECT cron.unschedule('daily-payment-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-payment-sync');

SELECT cron.schedule('monthly-payment-rollover-v4', '1 0 1 * *', $$ SELECT public.monthly_rollover_job_v4(); $$);
SELECT cron.schedule('daily-payment-sync-v4', '5 0 * * *', $$ SELECT public.update_payment_status(EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM CURRENT_DATE)::INT); $$);
