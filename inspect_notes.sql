-- =====================================================
-- ROBUST BACKFILL: Extract monthly_fee from notes
-- Handles: "fee:2000", "Fee: 3500", "fee 5000", etc.
-- =====================================================

-- First, see what fee patterns actually exist in the notes
SELECT DISTINCT notes 
FROM students 
WHERE notes IS NOT NULL 
  AND (LOWER(notes) LIKE '%fee%' OR LOWER(notes) LIKE '%cost%')
ORDER BY notes
LIMIT 30;
