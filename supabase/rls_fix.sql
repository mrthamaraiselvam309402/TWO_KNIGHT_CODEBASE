-- =====================================================
-- FIX RLS POLICIES - Run in Supabase SQL Editor
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Public can read students" ON students;
DROP POLICY IF EXISTS "Public can insert students" ON students;
DROP POLICY IF EXISTS "Public can update students" ON students;
DROP POLICY IF EXISTS "Public can delete students" ON students;
DROP POLICY IF EXISTS "Allow all students" ON students;
DROP POLICY IF EXISTS "Auth can insert students" ON students;
DROP POLICY IF EXISTS "Auth can update students" ON students;
DROP POLICY IF EXISTS "Auth can delete students" ON students;

-- Allow everyone full access to students
CREATE POLICY "everyone_students" ON students 
  FOR ALL USING (true) WITH CHECK (true);

-- Coaches policies
DROP POLICY IF EXISTS "everyone_coaches" ON coaches;
CREATE POLICY "everyone_coaches" ON coaches 
  FOR ALL USING (true) WITH CHECK (true);

-- Events policies
DROP POLICY IF EXISTS "everyone_events" ON events;
CREATE POLICY "everyone_events" ON events 
  FOR ALL USING (true) WITH CHECK (true);

-- Achievements policies
DROP POLICY IF EXISTS "everyone_achievements" ON achievements;
CREATE POLICY "everyone_achievements" ON achievements 
  FOR ALL USING (true) WITH CHECK (true);

-- Payments policies
DROP POLICY IF EXISTS "everyone_payments" ON payments;
CREATE POLICY "everyone_payments" ON payments 
  FOR ALL USING (true) WITH CHECK (true);

-- Messages policies
DROP POLICY IF EXISTS "everyone_messages" ON messages;
CREATE POLICY "everyone_messages" ON messages 
  FOR ALL USING (true) WITH CHECK (true);