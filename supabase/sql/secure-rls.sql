-- SECURE RLS POLICIES FOR CHESSKIDOO
-- Run this in Supabase SQL Editor

-- 1. Drop dangerous open policies
DROP POLICY IF EXISTS "Enable read access for all users" ON students;
DROP POLICY IF EXISTS "Enable read access for all users" ON payments;
DROP POLICY IF EXISTS "Enable read access for all users" ON coaches;
DROP POLICY IF EXISTS "Enable read access for all users" ON events;
DROP POLICY IF EXISTS "Enable read access for all users" ON achievements;
DROP POLICY IF EXISTS "Enable read access for all users" ON messages;

-- 2. Create secure policies - Only data owners AND admins can read
-- Students: Own record + Coaches assigned to them + Admins
CREATE POLICY "Students read own" ON students FOR SELECT 
TO authenticated USING (
  auth.uid() = user_id 
  OR auth.uid() IN (SELECT user_id FROM coaches WHERE id = students.coach_id)
  OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Coaches: Only see assigned students
CREATE POLICY "Coaches read assigned" ON students FOR SELECT 
TO authenticated USING (
  auth.uid() IN (SELECT user_id FROM coaches WHERE id = students.coach_id)
);

-- Payments: Only own payments + Admins
CREATE POLICY "Payments read own" ON payments FOR SELECT 
TO authenticated USING (
  auth.uid() = user_id 
  OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Events: Anyone authenticated can read (no sensitive data)
CREATE POLICY "Events read" ON events FOR SELECT 
TO authenticated USING (true);

-- Achievements: Read for all
CREATE POLICY "Achievements read" ON achievements FOR SELECT 
TO authenticated USING (true);

-- Messages: Only sender/receiver + Admins  
CREATE POLICY "Messages read own" ON messages FOR SELECT 
TO authenticated USING (
  sender_id = auth.uid() 
  OR receiver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Coaches: Read all (used for assignment dropdowns)
CREATE POLICY "Coaches read all" ON coaches FOR SELECT 
TO authenticated USING (true);

-- 3. Insert policies (Admin only)
CREATE POLICY "Admin insert student" ON students FOR INSERT 
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admin insert payment" ON payments FOR INSERT 
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);