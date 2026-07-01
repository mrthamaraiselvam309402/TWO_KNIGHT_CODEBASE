-- Full Batches Table Schema
-- Extends existing batches table with all required columns

ALTER TABLE batches ADD COLUMN IF NOT EXISTS coach_id TEXT REFERENCES coaches(id) ON DELETE SET NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS days TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS time_slot TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS chessable_url TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batches_updated_at ON batches;
CREATE TRIGGER trg_batches_updated_at
BEFORE UPDATE ON batches
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS for batches
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_batches" ON batches;
CREATE POLICY "service_role_all_batches" ON batches
FOR ALL TO service_role USING (true) WITH CHECK (true);