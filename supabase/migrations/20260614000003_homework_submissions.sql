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
