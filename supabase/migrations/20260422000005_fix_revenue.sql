-- =====================================================
-- FIX REVENUE: Add missing columns and backfill from notes
-- =====================================================

-- 1. Add missing columns (if not already present)
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS due_date DATE;

-- 2. Backfill monthly_fee by parsing notes field
-- Extract the first number after "fee" (case insensitive)
UPDATE students
SET monthly_fee = 
  CASE 
    WHEN notes ~* 'fee[:\s]*([0-9]+)' THEN
      CAST(SUBSTRING(notes FROM 'fee[:\s]*([0-9]+)') AS INTEGER)
    ELSE 5000  -- Default fallback
  END
WHERE monthly_fee IS NULL OR monthly_fee = 0;

-- 3. Ensure default for future inserts
ALTER TABLE students ALTER COLUMN monthly_fee SET DEFAULT 5000;

-- 4. Verify
SELECT id, name, monthly_fee, notes 
FROM students 
WHERE monthly_fee > 0 
ORDER BY monthly_fee DESC 
LIMIT 10;
