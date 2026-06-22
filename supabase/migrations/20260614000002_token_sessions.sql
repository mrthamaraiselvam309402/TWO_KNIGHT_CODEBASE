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
