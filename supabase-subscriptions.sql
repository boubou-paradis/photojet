-- PhotoJet Subscriptions Schema
-- Run this AFTER supabase-schema.sql

-- ===========================================
-- ENUM TYPES
-- ===========================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'user');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'canceled', 'expired', 'past_due');
CREATE TYPE promo_type AS ENUM ('trial', 'percent', 'fixed');

-- ===========================================
-- USERS PROFILE TABLE
-- ===========================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- PROMO CODES TABLE (must be created before subscriptions)
-- ===========================================

CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  type promo_type NOT NULL,
  -- For trial: duration in days, for percent: percentage off, for fixed: amount in cents
  value INTEGER NOT NULL,
  -- Optional: max number of uses (null = unlimited)
  max_uses INTEGER,
  -- Current number of uses
  uses_count INTEGER DEFAULT 0,
  -- Optional: expiration date
  expires_at TIMESTAMP WITH TIME ZONE,
  -- For influencer tracking
  influencer_name VARCHAR(255),
  influencer_commission_percent INTEGER DEFAULT 0,
  -- Is active
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ===========================================
-- SUBSCRIPTIONS TABLE
-- ===========================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  stripe_price_id VARCHAR(255),
  status subscription_status DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  promo_code_id UUID REFERENCES promo_codes(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(stripe_subscription_id)
);

-- ===========================================
-- PROMO CODE USAGE TRACKING
-- ===========================================

CREATE TABLE promo_code_uses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(promo_code_id, user_id)
);

-- ===========================================
-- UPDATE SESSIONS TABLE
-- ===========================================

-- Add subscription_id to sessions if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'subscription_id') THEN
    ALTER TABLE sessions ADD COLUMN subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_influencer ON promo_codes(influencer_name);
CREATE INDEX idx_sessions_subscription ON sessions(subscription_id);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_uses ENABLE ROW LEVEL SECURITY;

-- User profiles: users can read their own, owners can read all
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Owners can read all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: users can read their own
CREATE POLICY "Users can read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can read all subscriptions" ON subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role full access subscriptions" ON subscriptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Promo codes: anyone can read active codes, owners can manage
CREATE POLICY "Anyone can read active promo codes" ON promo_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Owners can manage promo codes" ON promo_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to check if subscription is valid
CREATE OR REPLACE FUNCTION is_subscription_valid(sub_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT * INTO sub_record FROM subscriptions WHERE id = sub_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if user is owner (always valid)
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = sub_record.user_id AND role = 'owner') THEN
    RETURN TRUE;
  END IF;

  -- Check subscription status and period
  IF sub_record.status IN ('active', 'trialing') AND sub_record.current_period_end > NOW() THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has valid subscription
CREATE OR REPLACE FUNCTION user_has_valid_subscription(uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is owner (always valid)
  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = uid AND role = 'owner') THEN
    RETURN TRUE;
  END IF;

  -- Check for valid subscription
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = uid
    AND status IN ('active', 'trialing')
    AND current_period_end > NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Function to apply promo code
CREATE OR REPLACE FUNCTION apply_promo_code(promo_code_text VARCHAR, uid UUID)
RETURNS JSON AS $$
DECLARE
  promo RECORD;
  result JSON;
BEGIN
  -- Find the promo code
  SELECT * INTO promo FROM promo_codes
  WHERE code = UPPER(promo_code_text)
  AND is_active = true
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Code promo invalide ou expiré');
  END IF;

  -- Check if already used by this user
  IF EXISTS (SELECT 1 FROM promo_code_uses WHERE promo_code_id = promo.id AND user_id = uid) THEN
    RETURN json_build_object('success', false, 'error', 'Code promo déjà utilisé');
  END IF;

  -- Return promo info
  RETURN json_build_object(
    'success', true,
    'promo_id', promo.id,
    'type', promo.type,
    'value', promo.value,
    'code', promo.code
  );
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER: Update updated_at
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- INSERT OWNER ACCOUNT (replace with your email)
-- ===========================================

-- This will be done after you create your account
-- INSERT INTO user_profiles (id, email, role)
-- VALUES ('your-user-id', 'your@email.com', 'owner');

-- ===========================================
-- DEFAULT PROMO CODES
-- ===========================================

-- Function to increment promo code uses
CREATE OR REPLACE FUNCTION increment_promo_uses(promo_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE promo_codes
  SET uses_count = uses_count + 1
  WHERE id = promo_id;
END;
$$ LANGUAGE plpgsql;

-- Trial code: 7 days free
INSERT INTO promo_codes (code, type, value, is_active)
VALUES ('ESSAI7', 'trial', 7, true)
ON CONFLICT (code) DO NOTHING;

-- Launch promo: 20% off
INSERT INTO promo_codes (code, type, value, max_uses, expires_at, is_active)
VALUES ('LAUNCH20', 'percent', 20, 100, NOW() + INTERVAL '3 months', true)
ON CONFLICT (code) DO NOTHING;
