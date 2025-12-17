-- Script de création des tables pour AnimaJet/PhotoJet
-- À exécuter dans Supabase Dashboard > SQL Editor

-- 1. Table user_profiles (liée à auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  role VARCHAR DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table promo_codes (codes promotionnels)
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  discount_percent INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table subscriptions (abonnements Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR,
  stripe_subscription_id VARCHAR,
  stripe_price_id VARCHAR,
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'canceled', 'expired', 'past_due')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  promo_code_id UUID REFERENCES promo_codes(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table promo_code_uses (utilisation des codes promo)
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES promo_codes(id),
  user_id UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Table sessions (sessions d'événements)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(4) NOT NULL UNIQUE,
  name VARCHAR NOT NULL DEFAULT 'Mon événement',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  moderation_enabled BOOLEAN DEFAULT true,
  show_qr_on_screen BOOLEAN DEFAULT true,
  transition_type VARCHAR DEFAULT 'fade' CHECK (transition_type IN ('fade', 'slide', 'zoom')),
  transition_duration INTEGER DEFAULT 5,
  album_qr_code VARCHAR,
  is_active BOOLEAN DEFAULT true,
  borne_enabled BOOLEAN DEFAULT false,
  borne_qr_code VARCHAR,
  borne_countdown BOOLEAN DEFAULT true,
  borne_countdown_duration INTEGER DEFAULT 3,
  borne_return_delay INTEGER DEFAULT 5,
  borne_default_camera VARCHAR DEFAULT 'front' CHECK (borne_default_camera IN ('front', 'back')),
  borne_show_event_name BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Table photos
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  storage_path VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  uploader_name VARCHAR,
  source VARCHAR DEFAULT 'invite' CHECK (source IN ('invite', 'borne'))
);

-- 7. Table borne_connections (connexions des bornes photo)
CREATE TABLE IF NOT EXISTS borne_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  device_id VARCHAR NOT NULL,
  device_type VARCHAR DEFAULT 'other',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT true
);

-- 8. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_photos_session_id ON photos(session_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- 9. Activer RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE borne_connections ENABLE ROW LEVEL SECURITY;

-- 10. Policies RLS basiques (à ajuster selon les besoins)
-- Users can read their own profile
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can read their own subscriptions
CREATE POLICY IF NOT EXISTS "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own sessions
CREATE POLICY IF NOT EXISTS "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can read photos by session (for live display)
CREATE POLICY IF NOT EXISTS "Anyone can view approved photos" ON photos
  FOR SELECT USING (status = 'approved');

-- Users can manage photos in their sessions
CREATE POLICY IF NOT EXISTS "Users can manage own session photos" ON photos
  FOR ALL USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Service role bypass (pour le webhook)
-- Note: Le service role key bypass automatiquement RLS

SELECT 'Tables créées avec succès!' as result;
