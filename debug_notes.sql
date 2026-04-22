-- =====================================================
-- SIMPLE BACKFILL: Parse fee from notes using string functions
-- =====================================================

-- First, let's see what we're working with
SELECT id, name, notes, LOWER(notes) as lower_notes, monthly_fee, status
FROM students
WHERE notes IS NOT NULL
ORDER BY id
LIMIT 20;
