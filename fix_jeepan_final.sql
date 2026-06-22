-- ============================================================
-- COMPLETE FIX FOR JEEVAN + SAMIKSHA
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CHECK CURRENT STATE
-- ============================================================
SELECT '=== JEEVAN payments ===' AS section;
SELECT id, amount, payment_date, payment_method, applied_month 
FROM payments 
WHERE student_id = 's1776570395859f9yles'
ORDER BY payment_date;

SELECT '=== JEEVAN allocations ===' AS section;
SELECT id, allocated_month, amount, allocation_type, created_at
FROM payment_allocations
WHERE student_id = 's1776570395859f9yles'
ORDER BY allocated_month;

SELECT '=== SAMIKSHA allocations ===' AS section;
SELECT id, allocated_month, amount, allocation_type, created_at
FROM payment_allocations
WHERE student_id = 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3';

SELECT '=== JEEVAN student record ===' AS section;
SELECT id, name, payment_status, monthly_fee, billing_anchor_year, billing_anchor_month, credit_balance
FROM students WHERE id = 's1776570395859f9yles';

SELECT '=== SAMIKSHA student record ===' AS section;
SELECT id, name, payment_status, monthly_fee, billing_anchor_year, billing_anchor_month, credit_balance
FROM students WHERE id = 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3';

-- ============================================================
-- 2. CHECK IF MAY 28 PAYMENT EXISTS FOR JEEVAN
-- ============================================================
SELECT '=== JEEVAN May 28 payment check ===' AS section;
SELECT * FROM payments 
WHERE student_id = 's1776570395859f9yles'
  AND payment_date >= '2026-05-28'
  AND payment_date < '2026-06-01';

-- ============================================================
-- 3. IF NO MAY 28 PAYMENT EXISTS, ADD IT
-- (This is the advance payment for June that JEEVAN made on May 28)
-- ============================================================
-- Only insert if it doesn't already exist
INSERT INTO payments (
  id, student_id, amount, status, payment_method, 
  description, payment_date, created_at, applied_month
)
SELECT 
  'pay_jeepan_may28_final',
  's1776570395859f9yles',
  12000,  -- Amount that covers all months
  'paid',
  'Manual Entry',
  'Advance payment for March, April, May, June 2026',
  '2026-05-28T10:00:00+00',
  NOW(),
  '2026-06'
WHERE NOT EXISTS (
  SELECT 1 FROM payments 
  WHERE student_id = 's1776570395859f9yles'
    AND payment_date >= '2026-05-28'
    AND payment_date < '2026-06-01'
);

-- ============================================================
-- 4. RUN DEBT-FIRST ALLOCATION FOR JEEVAN
-- ============================================================
-- This will:
-- - Clear March debt first (3300)
-- - Clear April debt (3300)
-- - Clear May debt (3300)
-- - Apply remaining 2100 to June
-- ============================================================
SELECT public.apply_payment_debt_first(
  p_student_id => 's1776570395859f9yles',
  p_payment_id => 'pay_jeepan_may28_final',
  p_amount => 12000,
  p_target_month => '2026-06'
);

-- ============================================================
-- 5. FINAL VERIFICATION
-- ============================================================
SELECT '=== JEEVAN final allocations ===' AS section;
SELECT allocated_month, SUM(amount) AS total, s.monthly_fee AS fee,
       s.monthly_fee - SUM(amount) AS outstanding
FROM payment_allocations pa
JOIN students s ON s.id = pa.student_id
WHERE pa.student_id = 's1776570395859f9yles'
GROUP BY pa.allocated_month, s.monthly_fee
ORDER BY pa.allocated_month;

SELECT '=== JEEVAN final status ===' AS section;
SELECT name, payment_status, credit_balance, billing_anchor_year, billing_anchor_month
FROM students WHERE id = 's1776570395859f9yles';

SELECT '=== SAMIKSHA final status ===' AS section;
SELECT name, payment_status, credit_balance, billing_anchor_year, billing_anchor_month
FROM students WHERE id = 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3';
