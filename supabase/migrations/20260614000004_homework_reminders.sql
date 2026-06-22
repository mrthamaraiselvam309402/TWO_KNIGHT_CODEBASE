-- Homework Reminders
-- Tracks assignment, due-date, overdue, submission confirmation, and final feedback reminders.

CREATE TABLE IF NOT EXISTS homework_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
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
