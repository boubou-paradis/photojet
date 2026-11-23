-- =====================================================================
-- DEMANDES DE MUSIQUE (identifiant technique : music) - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Les invités demandent un morceau au DJ depuis /invite (Titre + Artiste,
-- texte libre, aucun service externe). Le DJ les voit regroupées dans le
-- tableau de bord, onglet « Musique ».
--
-- Garanties :
--   - AUCUNE colonne ni AUCUN trigger sur sessions ;
--   - 4 tables FERMÉES (RLS activé sans policy, droits retirés à anon et
--     authenticated) : seul le serveur (clé de service) lit et écrit ;
--   - aucune fonction, aucune diffusion : tables hors publication realtime ;
--   - aucune donnée personnelle : ni prénom, ni identifiant d'invité ;
--   - tout part avec la session (ON DELETE CASCADE) ;
--   - fonction désactivée par défaut (pas de ligne de réglage = désactivée).
-- Retour arrière : bloc ROLLBACK en fin de fichier.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Réglage par session. Pas de ligne = demandes désactivées.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.music_request_settings (
  session_id  uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. Demandes : une ligne par envoi du formulaire.
--    norm_key : clé de regroupement calculée par le serveur
--      (« titre|artiste » en minuscules, sans accents, ponctuation
--      ni espaces en trop). Le texte saisi est gardé tel quel pour l'affichage.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.music_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  artist      text CHECK (artist IS NULL OR char_length(artist) BETWEEN 1 AND 60),
  norm_key    text NOT NULL CHECK (char_length(norm_key) BETWEEN 1 AND 160),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS music_requests_session_idx ON public.music_requests (session_id, created_at);

-- ---------------------------------------------------------------------
-- 3. Regroupements manuels du DJ (fautes de frappe) :
--    toutes les demandes de clé from_key comptent dans la ligne to_key,
--    y compris celles qui arriveront plus tard. « Séparer » = supprimer.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.music_request_aliases (
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  from_key    text NOT NULL CHECK (char_length(from_key) BETWEEN 1 AND 160),
  to_key      text NOT NULL CHECK (char_length(to_key) BETWEEN 1 AND 160),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, from_key),
  CHECK (from_key <> to_key)
);

-- ---------------------------------------------------------------------
-- 4. Décision du DJ par ligne regroupée. Pas de ligne = « À traiter ».
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.music_request_decisions (
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  group_key   text NOT NULL CHECK (char_length(group_key) BETWEEN 1 AND 160),
  status      text NOT NULL CHECK (status IN ('played', 'skipped')),
  decided_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, group_key)
);

-- ---------------------------------------------------------------------
-- 5. Tables fermées : aucune policy, aucun droit public.
-- ---------------------------------------------------------------------
ALTER TABLE public.music_request_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_request_aliases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_request_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.music_request_settings, public.music_requests,
              public.music_request_aliases, public.music_request_decisions
  FROM anon, authenticated;

COMMIT;

-- =====================================================================
-- ROLLBACK (seulement pour retirer entièrement la fonction) :
-- BEGIN;
--   DROP TABLE IF EXISTS public.music_request_decisions;
--   DROP TABLE IF EXISTS public.music_request_aliases;
--   DROP TABLE IF EXISTS public.music_requests;
--   DROP TABLE IF EXISTS public.music_request_settings;
-- COMMIT;
-- =====================================================================
