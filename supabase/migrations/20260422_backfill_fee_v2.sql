-- =====================================================
-- FIX REVENUE: Robust monthly_fee backfill
-- Extracts numbers from notes like "Fee: 900", "fee:2000", "Fee 3500"
-- =====================================================

-- Backfill: extract first number after the word "fee" (case-insensitive)
UPDATE students
SET monthly_fee = 
  COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        LOWER(notes),
        '.*?fee[^0-9]*([0-9]+).*',
        '\1'
      ),
      notes  -- If no replacement happened (pattern didn't match), this equals notes
    )::INTEGER,
    5000  -- Default fallback
  )
WHERE monthly_fee IS NULL OR monthly_fee = 0;

-- Check results
SELECT id, name, notes, monthly_fee, status
FROM students
ORDER BY monthly_fee DESC;
