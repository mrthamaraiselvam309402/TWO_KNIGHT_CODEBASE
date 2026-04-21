-- SQL to fix Student and Coach tables for high-integrity dashboard reporting
-- Run this in the Supabase SQL Editor

-- 1. Ensure students table has monthly_fee and session columns
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS monthly_fee INTEGER DEFAULT 5000,
ADD COLUMN IF NOT EXISTS session_mode TEXT,
ADD COLUMN IF NOT EXISTS session_time TEXT;

-- 2. Ensure coaches table has salary column if not present
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS salary INTEGER DEFAULT 0;

-- 3. Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'students' AND column_name IN ('monthly_fee', 'session_mode', 'session_time');
