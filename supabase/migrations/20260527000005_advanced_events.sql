-- Advanced Event Manager Migration

-- We add a new JSONB column to store detailed student registrations (name, payment status, attendance, etc.)
-- This avoids breaking backwards compatibility with the old string array if any old code relies on it.

ALTER TABLE events ADD COLUMN IF NOT EXISTS registrations_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_advanced BOOLEAN DEFAULT true;
