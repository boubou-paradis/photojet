-- PhotoJet Database Migration - Mystery Photo Game
-- Run this in your Supabase SQL Editor

-- Add Mystery Photo Game columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_enabled BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_url VARCHAR(500);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_grid VARCHAR(10) DEFAULT '8x6';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_speed VARCHAR(10) DEFAULT 'medium';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_state TEXT;

-- Add index for mystery photo active state (for realtime queries)
CREATE INDEX IF NOT EXISTS idx_sessions_mystery_photo_active ON sessions(mystery_photo_active);

-- Add constraint for grid values
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS mystery_photo_grid_check;
ALTER TABLE sessions ADD CONSTRAINT mystery_photo_grid_check
  CHECK (mystery_photo_grid IS NULL OR mystery_photo_grid IN ('6x4', '8x6', '10x8'));

-- Add constraint for speed values
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS mystery_photo_speed_check;
ALTER TABLE sessions ADD CONSTRAINT mystery_photo_speed_check
  CHECK (mystery_photo_speed IS NULL OR mystery_photo_speed IN ('slow', 'medium', 'fast'));

-- Enable realtime for sessions table updates (if not already enabled)
-- This allows the live slideshow to react to mystery photo game state changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
  END IF;
END $$;
