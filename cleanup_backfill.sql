-- ============================================================
-- WIPE + CLEAN BACKFILL FOR SAMIKSHA & JEEVAN
-- Run this AFTER the main migration succeeds
-- ============================================================

-- Step 1: Wipe everything for these two students
DELETE FROM payment_allocations WHERE student_id IN (
  'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
  's1776570395859f9yles'
);

-- Step 2: Clear applied_month (frontend double-count guard)
UPDATE payments SET applied_month = NULL WHERE student_id IN (
  'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
  's1776570395859f9yles'
);

-- ============================================================
-- SAMIKSHA — enrollment 2026-05-29 (late-join ≥26 → June billing)
-- ============================================================
-- Payment on 2026-05-28 (4800) is intended for June 2026
-- RPC target_month = 2026-06
SELECT public.apply_payment_debt_first(
  p_student_id => 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
  p_payment_id => 'pay_1779987664313_z37tt69x6',
  p_amount       => 4800,
  p_paid_on      => '2026-05-28T17:01:04+00',
  p_target_month => '2026-06'
);

UPDATE students
SET billing_anchor_year  = 2026,
    billing_anchor_month = 6,
    payment_status       = 'Paid'
WHERE id = 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3';

UPDATE payments SET applied_month = '2026-06'
WHERE id = 'pay_1779987664313_z37tt69x6';

-- ============================================================
-- JEEVAN BASIC — enrollment 2026-03-15 (billing anchor = March 2026)
-- ============================================================
-- 3 existing payments in chronological order:
--
--   #1  Apr 01  | 2300  | target = 2026-04
--       Phase1 (Mar..before Apr clears March debt = 2300 of 3300)
--       March still owes: 3300 - 2300 = 1000
--
--   #2  Apr 30  | 2300  | target = 2026-04
--       Phase1: clears remaining March debt (1000)  → March now PAID
--       Phase2: applies remaining 1300 to April       → April owes 2000
--
--   #3  May 27  | 3300  | target = 2026-05
--       Phase1 (Mar..before May): April owes 2000    → clears 2000  → April PAID
--       Phase2: applies remaining 1300 to May         → May owes 2000
--       *(Note: the RPC target_month controls where the cursor stops.
--         Target = May means cursor covers Mar and Apr, then Phase2 hits May.)*

-- Payment #1
SELECT public.apply_payment_debt_first(
  p_student_id => 's1776570395859f9yles',
  p_payment_id => 'pay_1777935995990_xuk1blua5',
  p_amount       => 2300,
  p_paid_on      => '2026-04-01T12:00:00+00',
  p_target_month => '2026-04'
);

-- Payment #2
SELECT public.apply_payment_debt_first(
  p_student_id => 's1776570395859f9yles',
  p_payment_id => 'apr26_fix_s1776570395859f9yles',
  p_amount       => 2300,
  p_paid_on      => '2026-04-30T12:00:00+00',
  p_target_month => '2026-04'
);

-- Payment #3 — this clears any remaining April debt and covers May
SELECT public.apply_payment_debt_first(
  p_student_id => 's1776570395859f9yles',
  p_payment_id => 'pay_toggle_1779925683319_6okm2kome',
  p_amount       => 3300,
  p_paid_on      => '2026-05-27T23:48:03+00',
  p_target_month => '2026-05'
);

UPDATE students
SET billing_anchor_year  = 2026,
    billing_anchor_month = 3,
    payment_status       = 'Paid'
WHERE id = 's1776570395859f9yles';

-- ============================================================
-- APPLIED_MONTH TAGS (so frontend advance-aware counting works)
-- ============================================================
UPDATE payments SET applied_month = '2026-06' WHERE id = 'pay_1779987664313_z37tt69x6';   -- SAMIKSHA → June
UPDATE payments SET applied_month = '2026-03' WHERE id = 'pay_1777935995990_xuk1blua5';  -- JEEVAN #1 → March
UPDATE payments SET applied_month = '2026-04' WHERE id = 'apr26_fix_s1776570395859f9yles'; -- JEEVAN #2 → April
UPDATE payments SET applied_month = '2026-05' WHERE id = 'pay_toggle_1779925683319_6okm2kome'; -- JEEVAN #3 → May

-- ============================================================
-- VERIFY
-- ============================================================
SELECT s.name, pa.allocated_month, SUM(pa.amount) AS total_allocated,
       s.monthly_fee AS fee,
       s.monthly_fee - SUM(pa.amount) AS outstanding,
       pa.allocation_type,
       pa.description
FROM payment_allocations pa
JOIN students s ON s.id = pa.student_id
WHERE pa.student_id IN (
  'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
  's1776570395859f9yles'
)
GROUP BY s.name, pa.allocated_month, s.monthly_fee, pa.allocation_type, pa.description
ORDER BY s.name, pa.allocated_month;

-- Student summary
SELECT s.name, s.payment_status, s.credit_balance,
       s.billing_anchor_year, s.billing_anchor_month
FROM students s
WHERE s.id IN (
  'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3',
  's1776570395859f9yles'
);
