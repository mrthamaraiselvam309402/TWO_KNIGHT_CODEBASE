-- Add attachment_urls column to homework_assignments for file uploads
ALTER TABLE IF EXISTS public.homework_assignments 
ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';

-- Update RLS policy to allow service role access
DROP POLICY IF EXISTS "service_role_all_homework_assignments" ON homework_assignments;
CREATE POLICY "service_role_all_homework_assignments" ON homework_assignments
FOR ALL TO service_role USING (true) WITH CHECK (true);