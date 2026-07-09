-- Run this once in the Supabase SQL editor (same content as migration
-- 20260711000001_coach_visible_password.sql).
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS password TEXT;

COMMENT ON COLUMN public.coaches.password IS
  'Admin-visible plaintext password (service-role access only; login uses password_hash).';
