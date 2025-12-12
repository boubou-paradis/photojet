-- PhotoJet Database Migration - Album Post-Event
-- Run this in your Supabase SQL Editor

-- Add album settings columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS album_enabled BOOLEAN DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS album_password VARCHAR(100) DEFAULT NULL;

-- Create index for faster album queries
CREATE INDEX IF NOT EXISTS idx_sessions_album_enabled ON sessions(album_enabled);
