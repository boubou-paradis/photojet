-- PhotoJet Database Schema for Supabase (v2 - avec Borne Photo)
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE photo_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE transition_type AS ENUM ('fade', 'slide', 'zoom');
CREATE TYPE photo_source AS ENUM ('invite', 'borne');
CREATE TYPE camera_type AS ENUM ('front', 'back');
CREATE TYPE device_type AS ENUM ('ipad', 'android_tablet', 'other');

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(4) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  moderation_enabled BOOLEAN DEFAULT true,
  show_qr_on_screen BOOLEAN DEFAULT true,
  transition_type transition_type DEFAULT 'fade',
  transition_duration INTEGER DEFAULT 5 CHECK (transition_duration >= 3 AND transition_duration <= 15),
  album_qr_code VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Borne photo settings
  borne_enabled BOOLEAN DEFAULT false,
  borne_qr_code VARCHAR(255),
  borne_countdown BOOLEAN DEFAULT true,
  borne_countdown_duration INTEGER DEFAULT 3 CHECK (borne_countdown_duration >= 1 AND borne_countdown_duration <= 10),
  borne_return_delay INTEGER DEFAULT 5 CHECK (borne_return_delay >= 3 AND borne_return_delay <= 10),
  borne_default_camera camera_type DEFAULT 'front',
  borne_show_event_name BOOLEAN DEFAULT true
);

-- Borne connections table
CREATE TABLE borne_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_type device_type DEFAULT 'other',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT true,
  UNIQUE(session_id, device_id)
);

-- Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL,
  status photo_status DEFAULT 'pending',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  uploader_name VARCHAR(100),
  source photo_source DEFAULT 'invite'
);

-- Indexes for better performance
CREATE INDEX idx_sessions_code ON sessions(code);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_sessions_borne_qr ON sessions(borne_qr_code);
CREATE INDEX idx_photos_session_id ON photos(session_id);
CREATE INDEX idx_photos_status ON photos(status);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX idx_photos_source ON photos(source);
CREATE INDEX idx_borne_connections_session ON borne_connections(session_id);
CREATE INDEX idx_borne_connections_device ON borne_connections(device_id);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE borne_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Anyone can read active sessions by code" ON sessions
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can insert sessions" ON sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update sessions" ON sessions
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete sessions" ON sessions
  FOR DELETE
  USING (true);

-- RLS Policies for photos
CREATE POLICY "Anyone can read photos" ON photos
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert photos" ON photos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update photos" ON photos
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete photos" ON photos
  FOR DELETE
  USING (true);

-- RLS Policies for borne_connections
CREATE POLICY "Anyone can read borne connections" ON borne_connections
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert borne connections" ON borne_connections
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update borne connections" ON borne_connections
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete borne connections" ON borne_connections
  FOR DELETE
  USING (true);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload photos" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can view photos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'photos');

CREATE POLICY "Anyone can delete photos" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'photos');

-- Enable Realtime for photos and borne_connections tables
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
ALTER PUBLICATION supabase_realtime ADD TABLE borne_connections;

-- Function to auto-expire sessions
CREATE OR REPLACE FUNCTION check_session_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at < NOW() THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check expiry on update
CREATE TRIGGER check_session_expiry_trigger
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_session_expiry();

-- Function to update borne connection last_seen
CREATE OR REPLACE FUNCTION update_borne_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen on borne_connections update
CREATE TRIGGER update_borne_last_seen_trigger
  BEFORE UPDATE ON borne_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_borne_last_seen();

-- Function to mark borne as offline if not seen for 30 seconds
CREATE OR REPLACE FUNCTION mark_offline_bornes()
RETURNS void AS $$
BEGIN
  UPDATE borne_connections
  SET is_online = false
  WHERE last_seen < NOW() - INTERVAL '30 seconds'
  AND is_online = true;
END;
$$ LANGUAGE plpgsql;
