-- ============================================================
-- REMOVE DEAD DEBT-FIRST SCHEMA
-- The debt-first / credit-rollover engine (apply_payment_debt_first,
-- monthly_rollover_job_v4, recalc_student_balances, payment_allocations)
-- was removed in 20260709000001. Nothing references these objects
-- anymore (the frontend counts paid months per-calendar-month locally).
-- Drop the leftover table and columns so the schema matches the
-- simplified per-month model.
-- ============================================================

-- 1. Drop the allocation ledger (cascade removes its RLS policy + trigger)
DROP TABLE IF EXISTS public.payment_allocations CASCADE;

-- 2. Drop the now-unused student columns the engine maintained
ALTER TABLE public.students
  DROP COLUMN IF EXISTS credit_balance,
  DROP COLUMN IF EXISTS outstanding_balance,
  DROP COLUMN IF EXISTS billing_anchor_year,
  DROP COLUMN IF EXISTS billing_anchor_month,
  DROP COLUMN IF EXISTS last_payment_applied_month;

SELECT 'Debt-first schema removed' AS result;
