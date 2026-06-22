-- ============================================================
-- VERIFY AND FIX JEEVAN + SAMIKSHA PAYMENTS
-- Paste this into Supabase SQL Editor and run it
-- ============================================================

-- Step 1: Check what currently exists
SELECT '=== SAMIKSHA allocations ===' AS section;
SELECT * FROM payment_allocations WHERE student_id = 'd881ddd8-4572-4f3a-bcda-0d3f6cec37f3';

SELECT '=== JEEVAN allocations ===' AS section;
SELECT * FROM payment_allocations WHERE student_id = 's1776570395859f9yles' ORDER BY allocated_month;

SELECT '=== JEEVAN payments ===' AS section;
SELECT id, amount, payment_date, payment_method, description, applied_month FROM payments WHERE student_id = 's1776570395859f9yles' ORDER BY payment_date DESC;

-- ============================================================
-- IF the above shows JEEVAN is missing June payment, run:
-- ============================================================

-- Find JEEVAN's May 28 payment (if it exists)
-- Then apply debt-first logic:
-- For a student with anchor=March, paying on May 28:
-- Phase 1 (clear debt): March + April = fully paid
-- Phase 2 (target May): May + June covered by the payment amount

-- Check if May 28 payment exists
SELECT '=== Check for May 28 payment ===' AS section;
SELECT * FROM payments 
WHERE student_id = 's1776570395859f9yles' 
  AND payment_date >= '2026-05-28' 
  AND payment_date < '2026-05-30'
ORDER BY payment_date;
