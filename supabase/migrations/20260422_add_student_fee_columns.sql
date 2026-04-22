-- =====================================================
-- ADD MISSING COLUMNS TO STUDENTS TABLE
-- Monthly fee tracking and due dates
-- =====================================================

-- Add monthly_fee column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'monthly_fee'
  ) THEN
    ALTER TABLE students ADD COLUMN monthly_fee INTEGER DEFAULT 5000;
    RAISE NOTICE 'Added monthly_fee column';
  END IF;
END $$;

-- Add due_date column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE students ADD COLUMN due_date DATE;
    RAISE NOTICE 'Added due_date column';
  END IF;
END $$;

-- Also ensure session_mode and session_time exist (should already be there, but safe check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'session_mode'
  ) THEN
    ALTER TABLE students ADD COLUMN session_mode TEXT;
    RAISE NOTICE 'Added session_mode column';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'session_time'
  ) THEN
    ALTER TABLE students ADD COLUMN session_time TEXT;
    RAISE NOTICE 'Added session_time column';
  END IF;
END $$;

-- Verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'students' 
  AND column_name IN ('monthly_fee', 'due_date', 'session_mode', 'session_time')
ORDER BY ordinal_position;
