-- Add missing student profiles and social integration columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS chesscom_username TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS lichess_username TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS chessable_username TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_phone TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_phone TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS place TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- Recreate view to include these new columns (requires dropping the view first in PG)
DROP VIEW IF EXISTS public.students_decrypted CASCADE;
CREATE OR REPLACE VIEW public.students_decrypted AS
SELECT 
  id,
  name,
  decrypt_pii(phone) as phone,
  decrypt_pii(parent_phone) as parent_phone,
  decrypt_pii(email) as email,
  age,
  grade,
  parent_name,
  decrypt_pii(address) as address,
  enrollment_date,
  status,
  coach_id,
  rating,
  session_mode,
  session_time,
  monthly_fee,
  notes,
  account_status,
  due_date,
  chesscom_username,
  lichess_username,
  chessable_username,
  school_name,
  father_name,
  father_phone,
  mother_name,
  mother_phone,
  dob,
  place,
  special_notes,
  created_at,
  updated_at
FROM public.students;

-- Re-grant permissions since dropping the view drops all grants
GRANT SELECT ON public.students_decrypted TO anon, authenticated, service_role;
