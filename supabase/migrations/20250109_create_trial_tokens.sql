-- Migration: Création de la table trial_tokens pour l'essai gratuit 24h via Magic Link
-- Date: 2025-01-09

-- Supprimer la table si elle existe (pour développement)
DROP TABLE IF EXISTS trial_tokens;

-- Créer la table trial_tokens
CREATE TABLE trial_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
);

-- Index pour recherche par email (vérifier si déjà utilisé)
CREATE INDEX idx_trial_tokens_email ON trial_tokens(email);

-- Index pour recherche par token (vérification du lien)
CREATE INDEX idx_trial_tokens_token ON trial_tokens(token);

-- Index pour les tokens expirés (nettoyage)
CREATE INDEX idx_trial_tokens_expires_at ON trial_tokens(expires_at);

-- Commentaires pour documentation
COMMENT ON TABLE trial_tokens IS 'Tokens pour les essais gratuits 24h via Magic Link';
COMMENT ON COLUMN trial_tokens.email IS 'Email du visiteur demandant l''essai';
COMMENT ON COLUMN trial_tokens.token IS 'Token unique pour le lien magique';
COMMENT ON COLUMN trial_tokens.created_at IS 'Date de création du token';
COMMENT ON COLUMN trial_tokens.used_at IS 'Date de première utilisation du token';
COMMENT ON COLUMN trial_tokens.expires_at IS 'Date d''expiration (created_at + 24h)';

-- RLS (Row Level Security) - Désactivé pour l'instant car accès via service role
ALTER TABLE trial_tokens ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre l'insertion depuis l'API
CREATE POLICY "Allow insert from service role" ON trial_tokens
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Policy pour permettre la lecture depuis l'API
CREATE POLICY "Allow select from service role" ON trial_tokens
  FOR SELECT TO service_role
  USING (true);

-- Policy pour permettre la mise à jour depuis l'API
CREATE POLICY "Allow update from service role" ON trial_tokens
  FOR UPDATE TO service_role
  USING (true);
