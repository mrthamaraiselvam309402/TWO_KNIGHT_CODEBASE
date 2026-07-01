-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to update payment status
CREATE OR REPLACE FUNCTION update_overdue_payments()
RETURNS void AS $$
BEGIN
  -- Change pending/due students to 'Overdue' or 'Due' based on due_date
  UPDATE public.students
  SET 
    payment_status = 'Due',
    status = 'Due'
  WHERE payment_status = 'Pending' 
    AND due_date IS NOT NULL 
    AND due_date <= CURRENT_DATE;
    
  UPDATE public.students
  SET 
    payment_status = 'Overdue',
    status = 'Overdue'
  WHERE payment_status = 'Due' 
    AND due_date IS NOT NULL 
    AND due_date < (CURRENT_DATE - INTERVAL '3 days');
END;
$$ LANGUAGE plpgsql;

-- Schedule the job to run every day at midnight (00:00)
SELECT cron.schedule(
  'update-overdue-payments-job',
  '0 0 * * *',
  'SELECT update_overdue_payments();'
);
