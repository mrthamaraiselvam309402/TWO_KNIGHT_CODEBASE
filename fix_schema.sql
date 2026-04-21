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

-- 3. Create Attendance Table for History
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'present',
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on attendance" ON attendance;
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true);

-- 5. Verify tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('students', 'coaches', 'payments', 'attendance');
