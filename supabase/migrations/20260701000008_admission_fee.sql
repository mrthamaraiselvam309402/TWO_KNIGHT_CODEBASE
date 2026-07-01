-- Add admission_fee column for first-month fees
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS admission_fee INTEGER DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS admission_paid BOOLEAN DEFAULT FALSE;

-- Recreate view to include admission columns
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
  admission_fee,
  admission_paid,
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

GRANT SELECT ON public.students_decrypted TO anon, authenticated, service_role;