-- Productivity Module Tables
-- For admin todos, scheduled meetings, and notes

-- Admin & Student Todo Tasks
CREATE TABLE IF NOT EXISTS productivity_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_productivity_tasks_student_id ON productivity_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_productivity_tasks_created_at ON productivity_tasks(created_at DESC);

-- Scheduled Meetings
CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  platform TEXT DEFAULT 'gmeet' CHECK (platform IN ('gmeet', 'zoom')),
  time TIMESTAMPTZ NOT NULL,
  link TEXT,
  attendee TEXT, -- 'general', 'student_{id}', 'coach_{id}'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_time ON scheduled_meetings(time);

-- Productivity Notes (per student or admin)
CREATE TABLE IF NOT EXISTS productivity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT, -- NULL for admin notes
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT productivity_notes_unique UNIQUE (student_id)
);

-- Enable RLS
ALTER TABLE productivity_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_notes ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "allow_all_access" ON productivity_tasks;
DROP POLICY IF EXISTS "allow_all_access" ON scheduled_meetings;
DROP POLICY IF EXISTS "allow_all_access" ON productivity_notes;
CREATE POLICY "allow_all_access" ON productivity_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access" ON scheduled_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access" ON productivity_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypass
DROP POLICY IF EXISTS "service_role_all_productivity_tasks" ON productivity_tasks;
DROP POLICY IF EXISTS "service_role_all_scheduled_meetings" ON scheduled_meetings;
DROP POLICY IF EXISTS "service_role_all_productivity_notes" ON productivity_notes;
CREATE POLICY "service_role_all_productivity_tasks" ON productivity_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_scheduled_meetings" ON scheduled_meetings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_productivity_notes" ON productivity_notes FOR ALL TO service_role USING (true) WITH CHECK (true);