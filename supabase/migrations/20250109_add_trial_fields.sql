-- Migration: Ajout des champs pour l'essai gratuit 24h
-- Date: 2025-01-09

-- Ajouter les colonnes trial à la table subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;

-- Créer un index pour les requêtes sur trial_started_at
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_started_at
ON subscriptions(trial_started_at)
WHERE trial_started_at IS NOT NULL;

-- Commentaires pour documentation
COMMENT ON COLUMN subscriptions.trial_started_at IS 'Date de début de l''essai gratuit 24h';
COMMENT ON COLUMN subscriptions.trial_used IS 'Indique si l''utilisateur a déjà utilisé son essai gratuit';
