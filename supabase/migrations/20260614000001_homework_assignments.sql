-- Homework Management System
-- Adds persistent homework assignments that can target a batch, an individual student,
-- or all active students. Parent-facing access is handled by the homework Edge Function.

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  student_ids JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'student' CHECK (target_type IN ('student', 'batch', 'all')),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT homework_target_student CHECK (
    (target_type = 'student' AND student_id IS NOT NULL AND batch_id IS NULL) OR
    (target_type = 'batch' AND batch_id IS NOT NULL AND student_id IS NULL) OR
    (target_type = 'all' AND student_id IS NULL AND batch_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_homework_assignments_student ON homework_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_batch ON homework_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_due_date ON homework_assignments(due_date DESC);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_status ON homework_assignments(status);
CREATE INDEX IF NOT EXISTS idx_homework_assignments_created_at ON homework_assignments(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_homework_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homework_assignments_updated_at ON homework_assignments;
CREATE TRIGGER trg_homework_assignments_updated_at
BEFORE UPDATE ON homework_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_homework_updated_at();

ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_homework_assignments" ON homework_assignments;
CREATE POLICY "service_role_all_homework_assignments" ON homework_assignments
FOR ALL TO service_role USING (true) WITH CHECK (true);
