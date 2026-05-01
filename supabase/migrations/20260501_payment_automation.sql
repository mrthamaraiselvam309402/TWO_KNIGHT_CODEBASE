-- Payment Status Automation Logic
-- 1. Function to mark Pending as Due at end of month
CREATE OR REPLACE FUNCTION public.handle_end_of_month_payments()
RETURNS void AS $$
BEGIN
    -- Change 'Pending' to 'Due' for all students who haven't paid by the end of the month
    UPDATE public.students 
    SET payment_status = 'Due' 
    WHERE payment_status = 'Pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to reset statuses to Pending at start of month
CREATE OR REPLACE FUNCTION public.handle_start_of_month_payments()
RETURNS void AS $$
BEGIN
    -- Every student (even those who were 'Paid' last month) starts the new month as 'Pending'
    -- This assumes they have a recurring monthly fee
    UPDATE public.students 
    SET payment_status = 'Pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attempting to schedule with pg_cron (requires pg_cron extension to be enabled)
-- Note: You may need to run 'CREATE EXTENSION IF NOT EXISTS pg_cron;' first in the SQL Editor.

/*
-- Schedule: 1st of every month at 00:01 AM
SELECT cron.schedule('start-of-month-fees', '1 0 1 * *', 'SELECT public.handle_start_of_month_payments()');

-- Schedule: Last day of every month at 23:55 PM
-- Since cron doesn't have a "last day" syntax easily, we can run it daily and check if tomorrow is the 1st
-- Or just run it on the 1st at 00:00 before the reset.
*/

-- Alternative: Combined logic that can be run safely
CREATE OR REPLACE FUNCTION public.automate_payment_statuses()
RETURNS void AS $$
DECLARE
    today DATE := CURRENT_DATE;
BEGIN
    -- If today is the 1st of the month
    IF EXTRACT(DAY FROM today) = 1 THEN
        -- Mark previous month's unpaid as Due (if not already done)
        -- Then reset everyone to Pending for the new month
        UPDATE public.students SET payment_status = 'Due' WHERE payment_status = 'Pending';
        UPDATE public.students SET payment_status = 'Pending';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
