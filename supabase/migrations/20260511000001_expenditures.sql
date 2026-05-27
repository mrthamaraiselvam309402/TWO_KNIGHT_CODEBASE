-- =====================================================
-- CHESSKIDOO ACADEMY — Expenditure Management Module
-- Run in: Supabase SQL Editor (Dashboard → SQL Editor)
-- Date: 2026-05-11
-- =====================================================

-- 1. TABLE CREATION
CREATE TABLE IF NOT EXISTS expenditures (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  category      TEXT        NOT NULL DEFAULT 'Miscellaneous',
  description   TEXT        NOT NULL,
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_mode  TEXT        NOT NULL DEFAULT 'Cash',
  bill_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT expenditures_category_check CHECK (
    category IN (
      'Rent', 'Coach Salary', 'Equipment', 'Snacks', 'Travel',
      'Tournament', 'Utilities', 'Marketing', 'Maintenance',
      'Platform & Software', 'Miscellaneous'
    )
  ),
  CONSTRAINT expenditures_payment_mode_check CHECK (
    payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque')
  )
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_expenditures_date     ON expenditures(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenditures_category ON expenditures(category);
CREATE INDEX IF NOT EXISTS idx_expenditures_created  ON expenditures(created_at DESC);

-- 3. AUTO-UPDATE updated_at trigger
CREATE OR REPLACE FUNCTION update_expenditures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expenditures_updated_at ON expenditures;
CREATE TRIGGER trg_expenditures_updated_at
  BEFORE UPDATE ON expenditures
  FOR EACH ROW EXECUTE FUNCTION update_expenditures_updated_at();

-- 4. ROW LEVEL SECURITY
ALTER TABLE expenditures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on expenditures" ON expenditures;
CREATE POLICY "Allow all on expenditures"
  ON expenditures FOR ALL USING (true);

-- 5. SAMPLE DATA (comment out if not needed)
INSERT INTO expenditures (date, category, description, amount, payment_mode) VALUES
  (CURRENT_DATE - INTERVAL '2 days', 'Rent',         'Monthly academy hall rent - May 2026',              12000, 'Bank Transfer'),
  (CURRENT_DATE - INTERVAL '5 days', 'Coach Salary', 'Coach Priya salary - May 2026',                      8000, 'Bank Transfer'),
  (CURRENT_DATE - INTERVAL '7 days', 'Equipment',    'Chess sets x10 + DGT boards x2',                    4500, 'UPI'),
  (CURRENT_DATE - INTERVAL '9 days', 'Snacks',       'Student refreshments for weekend tournament prep',    800, 'Cash'),
  (CURRENT_DATE - INTERVAL '12 days','Tournament',   'FIDE rated event registration fees - 5 students',   2500, 'UPI'),
  (CURRENT_DATE - INTERVAL '15 days','Utilities',    'Internet + electricity for hall - April billing',   1200, 'Bank Transfer'),
  (CURRENT_DATE - INTERVAL '20 days','Travel',       'Coach travel reimbursement - outstation match',      600, 'Cash'),
  (CURRENT_DATE - INTERVAL '25 days','Marketing',    'Instagram / Google Ads spend - April',              1800, 'UPI')
ON CONFLICT DO NOTHING;

SELECT 'Expenditures table ready! ✅' AS result;
