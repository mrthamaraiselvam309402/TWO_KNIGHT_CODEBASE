-- =====================================================
-- Messages table for parent-admin-coach communication
-- Idempotent: safe to re-run.
-- =====================================================

-- 1. TABLE CREATION
-- FIX: receiver_type now allows 'coach' (parent->coach via admin still works because
-- backend re-routes those to admin, but we also support direct coach messages).
-- FIX: use TIMESTAMPTZ everywhere so UTC math in app code stays correct across regions.
CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  sender_type   TEXT NOT NULL CHECK (sender_type   IN ('parent', 'admin', 'system', 'coach', 'student')),
  sender_id     TEXT,
  sender_name   TEXT,
  receiver_type TEXT NOT NULL CHECK (receiver_type IN ('parent', 'admin', 'system', 'coach')),
  receiver_id   TEXT,
  subject       TEXT,
  message       TEXT NOT NULL,
  is_read       BOOLEAN     DEFAULT false,
  read_at       TIMESTAMPTZ,
  priority      TEXT        DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  reply_to      TEXT,
  created_at    TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 2. Backfill columns on pre-existing tables (idempotent)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id TEXT;

-- Relax old CHECK constraints if a previous migration created a stricter one.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_type_check') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sender_type_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_sender_type_check
    CHECK (sender_type IN ('parent', 'admin', 'system', 'coach', 'student'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_receiver_type_check') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_receiver_type_check;
  END IF;
  ALTER TABLE messages ADD CONSTRAINT messages_receiver_type_check
    CHECK (receiver_type IN ('parent', 'admin', 'system', 'coach'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_messages_sender    ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver  ON messages(receiver_type, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_read      ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created   ON messages(created_at DESC);

-- 4. AUTO read_at trigger — keeps read_at in sync without the app having to remember.
CREATE OR REPLACE FUNCTION set_messages_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = TRUE AND (OLD.is_read IS DISTINCT FROM TRUE) THEN
    NEW.read_at := COALESCE(NEW.read_at, timezone('utc', now()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_read_at ON messages;
CREATE TRIGGER trg_messages_read_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_messages_read_at();

-- 5. ROW LEVEL SECURITY
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- FIX: previous policy used FOR ALL USING (true) without WITH CHECK,
--      which silently DENIED all INSERTs by anon users (USING applies to
--      SELECT/UPDATE/DELETE row-filtering only; INSERT requires WITH CHECK).
--      Live REST probe confirmed: messages POST returned 42501 RLS violation.
-- Also: drop existing policy before recreating so re-running this migration no longer errors.
DROP POLICY IF EXISTS "Allow all on messages" ON messages;
CREATE POLICY "Allow all on messages" ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

SELECT 'Messages table ready! OK' AS result;
