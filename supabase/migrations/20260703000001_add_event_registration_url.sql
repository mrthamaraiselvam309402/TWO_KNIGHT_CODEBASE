-- Migration to add registration_url column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_url TEXT;
