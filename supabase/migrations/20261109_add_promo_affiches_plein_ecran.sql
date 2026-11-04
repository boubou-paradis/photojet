-- © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
--
-- Affiches promotionnelles : choix « Plein écran » par affiche sur /live.
-- JSON array de chemins storage, sous-ensemble de promo_affiches (mêmes chemins).
-- NULL ou liste vide = toutes les affiches en « Ajuster » (comportement historique).
--
-- Additive : sans valeur par défaut, sans trigger, sans réécriture de lignes.
-- Aucun droit à ouvrir : /live lit cette colonne par la route serveur
-- /api/public/live (clé service, liste LIVE_SESSION_COLUMNS).
--
-- À appliquer AVANT le déploiement du code : la route serveur sélectionne
-- cette colonne, une colonne absente ferait échouer /live.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS promo_affiches_plein_ecran text NULL;

COMMENT ON COLUMN public.sessions.promo_affiches_plein_ecran IS
  'JSON array de chemins storage (sous-ensemble de promo_affiches) affichés en plein écran sur /live. NULL = Ajuster.';

-- Retour arrière (après avoir retiré le code qui lit la colonne) :
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS promo_affiches_plein_ecran;
