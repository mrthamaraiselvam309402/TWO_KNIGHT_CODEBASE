-- =====================================================
-- ADD ATTENDANCE TABLE
-- Track student attendance history
-- =====================================================

-- Create Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'present',
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Allow all access (admin dashboard via service role)
DROP POLICY IF EXISTS "Allow all on attendance" ON attendance;
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true);

-- Index for faster queries by student and date
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date DESC);
