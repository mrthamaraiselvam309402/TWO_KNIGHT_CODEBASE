-- ============================================================
-- COACH VISIBLE PASSWORD
-- Admin requirement: passwords must be viewable/editable from
-- the Access Control page. Students already have a plaintext
-- `password` column alongside `password_hash`; this adds the
-- same for coaches. Login continues to verify against
-- password_hash (bcrypt) — the plaintext column is only read
-- by the service-role access_control function for admin display.
-- ============================================================

ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS password TEXT;

COMMENT ON COLUMN public.coaches.password IS
  'Admin-visible plaintext password (service-role access only; login uses password_hash).';
