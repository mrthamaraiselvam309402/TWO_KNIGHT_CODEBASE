-- =====================================================
-- TWO KNIGHTS ACADEMY — Expenditure Management Module
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

-- 5. No sample data for fresh setups
SELECT 'Expenditures table ready! ✅' AS result;
