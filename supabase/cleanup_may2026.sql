-- ============================================
-- CLEANUP: Remove erroneous May 2026 payment records
-- Run this in Supabase SQL Editor
-- ============================================

-- IDs of the 3 May 2026 payments to delete:
-- may26_s1777040027196izu2po (ARUNA, Rs.2000)
-- may26_s1777284264580v7a39t (PRANISH P, Rs.1500)
-- may26_s177657041140598u6a3 (SAKTHI, Rs.3500)

DELETE FROM payments
WHERE id IN (
  'may26_s1777040027196izu2po',
  'may26_s1777284264580v7a39t',
  'may26_s177657041140598u6a3'
);

-- Verify deletion
SELECT COUNT(*) as remaining_may_payments
FROM payments
WHERE payment_date >= '2026-05-01' AND payment_date < '2026-06-01' AND status = 'paid';
-- Expected: 0

-- Optional: Re-classify student payment_status for May 2026
-- This updates students.payment_status based on actual payment history
SELECT update_payment_status(2026, 5);

-- ============================================
-- EXPECTED RESULT AFTER CLEANUP:
-- ============================================
-- Dashboard Collected Revenue (May 2026) => Rs.0
-- ARUNA, PRANISH P, SAKTHI status => Pending (they paid April only)
-- SUDARSAN, SURESHBABU status => Due (they have arrears)
-- All other students => Pending
-- ============================================
