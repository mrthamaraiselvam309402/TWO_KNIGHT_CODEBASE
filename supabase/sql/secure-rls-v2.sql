-- =====================================================
-- TWO KNIGHTS SECURE RLS POLICIES v2
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zznbanjdkwofsvpzybtr/sql
-- =====================================================

-- Step 1: Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing permissive policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('students', 'coaches', 'events', 'achievements', 'payments', 'messages')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Step 3: Service Role bypass policies
-- Edge Functions use SUPABASE_SERVICE_ROLE_KEY which automatically bypasses RLS.
-- No explicit policy needed for service_role — it's built into Supabase.

-- Step 4: Anon role policies (this is the key the frontend has)
-- PRINCIPLE: anon can only READ public data (events, achievements, coaches)
-- All writes go through Edge Functions (service_role) which bypass RLS

-- Events: Public read-only (anyone can see upcoming tournaments)
CREATE POLICY "anon_read_events" ON events
  FOR SELECT TO anon USING (true);

-- Achievements: Public read-only (wall of fame is public)
CREATE POLICY "anon_read_achievements" ON achievements
  FOR SELECT TO anon USING (true);

-- Coaches: Public read-only (coach list shown on frontend)
CREATE POLICY "anon_read_coaches" ON coaches
  FOR SELECT TO anon USING (true);

-- Students: NO anon access (sensitive data — names, phones, addresses)
-- Only accessible via Edge Functions (service_role)

-- Payments: NO anon access (financial data)
-- Only accessible via Edge Functions (service_role)

-- Messages: NO anon access (private communications)
-- Only accessible via Edge Functions (service_role)

-- Step 5: Block all writes for anon role on all tables
-- (Edge Functions use service_role which bypasses RLS, so writes still work through the API)

-- No INSERT/UPDATE/DELETE policies created for anon = all writes blocked by default

-- =====================================================
-- VERIFICATION: Run these queries to confirm
-- =====================================================
-- SELECT tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- Expected:
-- events       | anon_read_events       | PERMISSIVE | {anon} | SELECT
-- achievements | anon_read_achievements | PERMISSIVE | {anon} | SELECT
-- coaches      | anon_read_coaches      | PERMISSIVE | {anon} | SELECT
-- students     | (none for anon)
-- payments     | (none for anon)
-- messages     | (none for anon)
