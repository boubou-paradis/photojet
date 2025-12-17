-- Script pour corriger la subscription de mg.events35@gmail.com
-- À exécuter dans Supabase Dashboard > SQL Editor

-- 1. D'abord, vérifions l'état actuel
SELECT
  s.id as subscription_id,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.stripe_subscription_id,
  u.email,
  u.id as user_id
FROM subscriptions s
JOIN user_profiles u ON s.user_id = u.id
WHERE u.email = 'mg.events35@gmail.com';

-- 2. Mettre à jour la subscription
UPDATE subscriptions
SET
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days'
WHERE user_id = (
  SELECT id FROM user_profiles WHERE email = 'mg.events35@gmail.com'
);

-- 3. S'assurer que la session est active aussi
UPDATE sessions
SET is_active = true
WHERE user_id = (
  SELECT id FROM user_profiles WHERE email = 'mg.events35@gmail.com'
);

-- 4. Vérifier le résultat
SELECT
  s.id as subscription_id,
  s.status,
  s.current_period_start,
  s.current_period_end,
  ses.code as session_code,
  ses.is_active as session_active,
  u.email
FROM subscriptions s
JOIN user_profiles u ON s.user_id = u.id
LEFT JOIN sessions ses ON ses.user_id = u.id
WHERE u.email = 'mg.events35@gmail.com';
