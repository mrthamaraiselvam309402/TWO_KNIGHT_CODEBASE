-- =====================================================
-- COMPLETE BACKFILL: monthly_fee from notes
-- Handles "Fee: 900", "fee:2000", "Fee 3500", etc.
-- =====================================================

UPDATE students
SET monthly_fee = 
  COALESCE(
    -- Try to extract number after "fee" (case-insensitive, optional colon/space)
    NULLIF(
      SUBSTRING(
        notes FROM '(?i)fee[\s:]*([0-9]+)'
      ), 
      notes
    )::INTEGER,
    -- If extraction fails, use 5000 default
    5000
  )
WHERE monthly_fee IS NULL OR monthly_fee = 0;

-- Verify results
SELECT id, name, notes, monthly_fee, status
FROM students
ORDER BY monthly_fee DESC;
