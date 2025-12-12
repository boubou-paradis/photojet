-- PhotoJet Database Migration - Le Bon Ordre (Lineup Game)
-- Run this in your Supabase SQL Editor

-- Add Lineup Game columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team_size INTEGER DEFAULT 5;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_clock_duration INTEGER DEFAULT 60;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team1_name VARCHAR(100) DEFAULT 'Équipe 1';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team2_name VARCHAR(100) DEFAULT 'Équipe 2';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team1_score INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team2_score INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_current_number VARCHAR(10) DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_time_left INTEGER DEFAULT 60;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_is_running BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_is_paused BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_is_game_over BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_current_points INTEGER DEFAULT 10;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_show_winner BOOLEAN DEFAULT false;

-- Create index for faster lineup queries
CREATE INDEX IF NOT EXISTS idx_sessions_lineup_active ON sessions(lineup_active);
