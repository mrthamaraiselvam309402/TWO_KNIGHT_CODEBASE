-- Fix schema_migrations version column type to prevent bigint/text casting errors in Supabase CLI
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'supabase_migrations' 
    AND table_name = 'schema_migrations' 
    AND column_name = 'version'
  ) THEN
    ALTER TABLE supabase_migrations.schema_migrations ALTER COLUMN version TYPE text;
  END IF;
END $$;
