-- Create audit_logs table for tracking login attempts and actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  user_name TEXT,
  user_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  role TEXT,
  student_id TEXT,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  logout_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_name);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anon reads
CREATE POLICY "Allow audit read" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow sessions read" ON user_sessions FOR SELECT USING (true);
CREATE POLICY "Allow sessions insert" ON user_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow sessions update" ON user_sessions FOR UPDATE USING (true);