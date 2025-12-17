-- Fix sessions table - Add all required columns with defaults
-- Run this in Supabase SQL Editor

-- First, let's check current structure and add missing columns with proper defaults

-- Basic session settings (should already exist)
ALTER TABLE sessions ALTER COLUMN name SET DEFAULT 'Mon evenement';
ALTER TABLE sessions ALTER COLUMN moderation_enabled SET DEFAULT true;
ALTER TABLE sessions ALTER COLUMN show_qr_on_screen SET DEFAULT true;
ALTER TABLE sessions ALTER COLUMN transition_type SET DEFAULT 'fade';
ALTER TABLE sessions ALTER COLUMN transition_duration SET DEFAULT 5;
ALTER TABLE sessions ALTER COLUMN is_active SET DEFAULT true;

-- Borne settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_enabled BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_qr_code VARCHAR DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_countdown BOOLEAN DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_countdown_duration INTEGER DEFAULT 3;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_return_delay INTEGER DEFAULT 5;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_default_camera VARCHAR DEFAULT 'front';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_show_event_name BOOLEAN DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_lock_enabled BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS borne_lock_code VARCHAR DEFAULT '0000';

-- Customization settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS background_type VARCHAR DEFAULT 'color';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS background_color VARCHAR DEFAULT '#1a1a2e';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS background_image VARCHAR DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS background_opacity DECIMAL DEFAULT 1.0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS custom_logo VARCHAR DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS logo_size VARCHAR DEFAULT 'medium';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS logo_position VARCHAR DEFAULT 'bottom-left';

-- Messages settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS messages_enabled BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS messages_frequency INTEGER DEFAULT 5;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS messages_duration INTEGER DEFAULT 5;

-- Mystery Photo Game settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_enabled BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_url VARCHAR DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_grid VARCHAR DEFAULT '6x4';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_speed VARCHAR DEFAULT 'medium';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photo_state TEXT DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_photos JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_current_round INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_total_rounds INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_is_playing BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mystery_revealed_tiles INTEGER[] DEFAULT '{}';

-- Album settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS album_enabled BOOLEAN DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS album_password VARCHAR DEFAULT NULL;

-- Lineup Game settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team_size INTEGER DEFAULT 5;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_clock_duration INTEGER DEFAULT 30;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team1_name VARCHAR DEFAULT 'Equipe 1';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team2_name VARCHAR DEFAULT 'Equipe 2';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team1_score INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_team2_score INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_current_number VARCHAR DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_time_left INTEGER DEFAULT 30;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_is_running BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_is_paused BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_is_game_over BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_current_points INTEGER DEFAULT 5;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_show_winner BOOLEAN DEFAULT false;

-- Vote Photo settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_photos JSONB DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_votes JSONB DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_is_open BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_show_results BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_show_podium BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_timer INTEGER DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vote_timer_left INTEGER DEFAULT NULL;

-- Wheel (Roue de la Destinee) settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wheel_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wheel_segments JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wheel_is_spinning BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wheel_result VARCHAR DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wheel_history JSONB DEFAULT '[]';

-- Challenges (Defis Photo) settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS challenges_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS challenges_list JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS challenges_submissions JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS challenges_current VARCHAR DEFAULT NULL;

-- Quiz settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_questions JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_current_question INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_is_answering BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_show_results BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_time_left INTEGER DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_answers JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS quiz_participants JSONB DEFAULT '[]';

-- Blind Test settings
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_active BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_songs JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_current_song INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_is_playing BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_show_answer BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_time_left INTEGER DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_answers JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS blindtest_participants JSONB DEFAULT '[]';

-- Update CHECK constraints if needed
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_borne_default_camera_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_borne_default_camera_check
  CHECK (borne_default_camera IS NULL OR borne_default_camera IN ('front', 'back'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_background_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_background_type_check
  CHECK (background_type IS NULL OR background_type IN ('color', 'image'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_logo_size_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_logo_size_check
  CHECK (logo_size IS NULL OR logo_size IN ('small', 'medium', 'large'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_logo_position_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_logo_position_check
  CHECK (logo_position IS NULL OR logo_position IN ('bottom-left', 'top-center'));

-- Verify the fix
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'sessions'
ORDER BY ordinal_position;
