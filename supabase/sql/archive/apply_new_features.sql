-- Homework Management System
-- Adds persistent homework assignments that can target a batch, an individual student,
-- or all active students. Parent-facing access is handled by the homework Edge Function.

CREATE TABLE IF NOT EXISTS homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'student' CHECK (target_type IN ('student', 'batch', 'all')),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
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


-- Token Session Tracking
-- Stores revocable custom login tokens issued by the auth Edge Function.
-- Supabase Auth sessions remain managed by Supabase and do not use this table.

CREATE TABLE IF NOT EXISTS token_sessions (
  jti UUID PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'master', 'parent')),
  user_name TEXT NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_sessions_jti_revoked ON token_sessions(jti, revoked_at);
CREATE INDEX IF NOT EXISTS idx_token_sessions_expires_at ON token_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_sessions_user_name ON token_sessions(user_name);
CREATE INDEX IF NOT EXISTS idx_token_sessions_student_id ON token_sessions(student_id);

ALTER TABLE token_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_token_sessions" ON token_sessions;
CREATE POLICY "service_role_all_token_sessions" ON token_sessions
FOR ALL TO service_role USING (true) WITH CHECK (true);


-- Homework Submissions
-- Tracks student submissions, teacher feedback, revision requests, and final approval.

CREATE TABLE IF NOT EXISTS homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'needs_revision', 'approved', 'closed')),
  submission_text TEXT DEFAULT '',
  submission_url TEXT DEFAULT '',
  feedback TEXT DEFAULT '',
  score NUMERIC,
  revision_count INTEGER NOT NULL DEFAULT 0,
  excused BOOLEAN NOT NULL DEFAULT false,
  excuse_reason TEXT DEFAULT '',
  confirmation_sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT homework_submission_unique_assignment_student UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_assignment ON homework_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_status ON homework_submissions(status);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_updated_at ON homework_submissions(updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_homework_submission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homework_submissions_updated_at ON homework_submissions;
CREATE TRIGGER trg_homework_submissions_updated_at
BEFORE UPDATE ON homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_homework_submission_updated_at();

ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_homework_submissions" ON homework_submissions;
CREATE POLICY "service_role_all_homework_submissions" ON homework_submissions
FOR ALL TO service_role USING (true) WITH CHECK (true);


-- Homework Reminders
-- Tracks assignment, due-date, overdue, submission confirmation, and final feedback reminders.

CREATE TABLE IF NOT EXISTS homework_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('assignment', 'due_soon', 'overdue', 'submission_confirmation', 'final_feedback')),
  message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT homework_reminders_unique_assignment_student_type UNIQUE (assignment_id, student_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_homework_reminders_assignment ON homework_reminders(assignment_id);
CREATE INDEX IF NOT EXISTS idx_homework_reminders_student ON homework_reminders(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_reminders_type ON homework_reminders(reminder_type);
CREATE INDEX IF NOT EXISTS idx_homework_reminders_sent_at ON homework_reminders(sent_at DESC);

ALTER TABLE homework_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_homework_reminders" ON homework_reminders;
CREATE POLICY "service_role_all_homework_reminders" ON homework_reminders
FOR ALL TO service_role USING (true) WITH CHECK (true);


