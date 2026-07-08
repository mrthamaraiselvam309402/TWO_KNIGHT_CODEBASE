-- Fix payment status cron to not overwrite status column
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
