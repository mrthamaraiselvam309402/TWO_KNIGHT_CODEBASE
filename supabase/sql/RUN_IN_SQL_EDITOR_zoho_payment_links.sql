-- ============================================================
-- ZOHO PAYMENT LINKS
-- Tracks Zoho Payments hosted links per student per billing
-- month (roadmap: one link per cycle, reused by every
-- reminder; reminders stop when it turns paid).
-- The LMS stays the source of truth: actual money movement is
-- still recorded as rows in public.payments by the webhook.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.zoho_payment_links (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_link_id TEXT UNIQUE,              -- Zoho's id (null in simulated mode)
  reference_id TEXT NOT NULL UNIQUE,        -- TKCA-{studentId}-{YYYYMM}
  student_id TEXT NOT NULL,
  applied_month TEXT NOT NULL,              -- 'YYYY-MM'
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',    -- active | paid | canceled | expired | simulated
  reminder_stage INT NOT NULL DEFAULT 0,    -- 0 created, 1 first reminder (15th), 2 final (20th)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One live link per student per billing month.
CREATE UNIQUE INDEX IF NOT EXISTS zoho_links_student_month_active
  ON public.zoho_payment_links (student_id, applied_month)
  WHERE status IN ('active', 'simulated');

CREATE INDEX IF NOT EXISTS zoho_links_status_idx
  ON public.zoho_payment_links (status, applied_month);

ALTER TABLE public.zoho_payment_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON public.zoho_payment_links;
CREATE POLICY "service_role_only" ON public.zoho_payment_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);
