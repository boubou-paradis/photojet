-- PhotoJet Database Migration - Mystery Photo Game V2 (Multi-photos)
-- Run this in your Supabase SQL Editor

-- Add new columns for multi-photo support
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photos JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_current_round INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_total_rounds INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_is_playing BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_revealed_tiles INTEGER[] DEFAULT '{}';

-- Update constraint for grid values (if not already updated)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS mystery_photo_grid_check;
ALTER TABLE sessions ADD CONSTRAINT mystery_photo_grid_check
  CHECK (mystery_photo_grid IS NULL OR mystery_photo_grid IN ('6x4', '8x6', '10x8', '12x8', '15x10', '20x12'));

-- Add indexes for better realtime performance
CREATE INDEX IF NOT EXISTS idx_sessions_mystery_is_playing ON sessions(mystery_is_playing);
CREATE INDEX IF NOT EXISTS idx_sessions_mystery_current_round ON sessions(mystery_current_round);
