-- =====================================================
-- HOTFIX: Fix update_overdue_payments() cron function
-- Run this file in: Supabase Dashboard -> SQL Editor -> New Query
-- =====================================================
-- This fix ensures that when a student's payment is due or overdue,
-- only the 'payment_status' column is updated.
-- The student's enrollment 'status' is left intact (active/pending/etc.)
-- and is not corrupted to 'Due' or 'Overdue'.
-- =====================================================

CREATE OR REPLACE FUNCTION update_overdue_payments()
RETURNS void AS $$
BEGIN
  -- Change pending/due students to 'Overdue' or 'Due' based on due_date
  UPDATE public.students
  SET 
    payment_status = 'Due'
  WHERE payment_status = 'Pending' 
    AND due_date IS NOT NULL 
    AND due_date <= CURRENT_DATE;
    
  UPDATE public.students
  SET 
    payment_status = 'Overdue'
  WHERE payment_status = 'Due' 
    AND due_date IS NOT NULL 
    AND due_date < (CURRENT_DATE - INTERVAL '3 days');
END;
$$ LANGUAGE plpgsql;

-- Also check if any students are currently in 'Due' or 'Overdue' enrollment status, and restore to 'active'
UPDATE public.students
SET status = 'active', account_status = 'active'
WHERE status IN ('Due', 'Overdue');

SELECT 'Payment status cron fix applied successfully' AS result;
