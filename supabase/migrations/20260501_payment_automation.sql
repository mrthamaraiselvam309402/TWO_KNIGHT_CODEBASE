-- ==========================================
-- CHESSKIDOO PAYMENT AUTOMATION (CRON JOB)
-- ==========================================

-- 1. Enable pg_cron if available (requires superuser in some environments)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Refined Automation Function
-- This handles the transition from Pending to Due and resets Paid to Pending on the 1st
CREATE OR REPLACE FUNCTION public.automate_payment_rollover()
RETURNS void AS $$
DECLARE
    today_day INTEGER;
BEGIN
    today_day := EXTRACT(DAY FROM CURRENT_DATE);

    -- STEP A: Mark overdue students as 'Due'
    -- Runs every time the cron runs (daily)
    -- April 1, 2026 baseline (Month 4)
    UPDATE public.students 
    SET payment_status = 'Due' 
    WHERE (payment_status = 'Pending' OR payment_status IS NULL)
      AND (due_date < CURRENT_DATE OR (due_date IS NULL AND today_day > 5 AND CURRENT_DATE >= '2026-04-01')); 

    -- STEP B: On the 1st of the month, roll over 'Paid' to 'Pending' for the new month
    IF today_day = 1 THEN
        UPDATE public.students 
        SET payment_status = 'Pending'
        WHERE payment_status = 'Paid';
        
        -- Log the rollover event so the frontend can notify the admin
        INSERT INTO public.audit_logs (table_name, action, new_value)
        VALUES ('students', 'MONTHLY_ROLLOVER', jsonb_build_object('month', EXTRACT(MONTH FROM CURRENT_DATE), 'year', EXTRACT(YEAR FROM CURRENT_DATE)));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule the job to run at 00:01 AM every day
-- Running daily is safer than once a month in case of temporary database downtime
SELECT cron.schedule('daily-payment-audit', '1 0 * * *', 'SELECT public.automate_payment_rollover()');

-- 4. Initial Run
SELECT public.automate_payment_rollover();
