-- =====================================================
-- TWO KNIGHTS DATABASE SETUP - Run this in Supabase SQL Editor
-- =====================================================

-- 1. AUDIT LOGS TABLE - For tracking failed logins and actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  user_name TEXT,
  user_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. USER SESSIONS TABLE - For tracking currently online users
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  role TEXT,
  student_id TEXT,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  logout_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- INDEXES - For faster queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_name);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_name);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login ON user_sessions(login_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to audit logs and sessions
DROP POLICY IF EXISTS "Allow public read audit" ON audit_logs;
CREATE POLICY "Allow public read audit" ON audit_logs FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow public read sessions" ON user_sessions;
CREATE POLICY "Allow public read sessions" ON user_sessions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Allow public insert sessions" ON user_sessions;
CREATE POLICY "Allow public insert sessions" ON user_sessions FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow public update sessions" ON user_sessions;
CREATE POLICY "Allow public update sessions" ON user_sessions FOR UPDATE USING (TRUE);

-- =====================================================
-- CONFIRMATION
-- =====================================================

SELECT 'Tables created successfully!' as status;

-- Verify tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('audit_logs', 'user_sessions', 'students', 'coaches', 'messages', 'payments', 'achievements', 'events', 'attendance');