-- Add img_url column to achievements table
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS img_url TEXT;