-- =====================================================================
-- MATCHING (identifiant technique : affinity) - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Garanties :
--   - aucune colonne existante modifiée, aucune donnée copiée entre sessions ;
--   - aucun trigger sur sessions ;
--   - les nouvelles colonnes de sessions ont une valeur par défaut neutre
--     (Matching inactif) : les 4 autres jeux ne voient aucune différence ;
--   - les réponses et les joueurs vivent dans des tables fermées (RLS sans
--     policy) que seul le serveur lit, et qui ne sont PAS dans la publication
--     realtime : aucune notification vers /live, /invite ou les autres jeux.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Colonnes publiques sur sessions
--    Lues par /live et les téléphones via le realtime existant. Rien de
--    nominatif : la ligne sessions est lisible par les invités.
--    Écrites seulement aux changements de phase (jamais par réponse, jamais
--    par seconde : le chrono est une heure de fin).
-- ---------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS affinity_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affinity_phase text,
  ADD COLUMN IF NOT EXISTS affinity_questions jsonb,
  ADD COLUMN IF NOT EXISTS affinity_current_question integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affinity_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS affinity_reveal jsonb,
  ADD COLUMN IF NOT EXISTS affinity_final_stats jsonb;

-- Contrainte nommée, ajoutée à part (idempotente) : toutes les lignes
-- existantes ont affinity_phase = NULL, donc la validation passe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_affinity_phase_check'
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_affinity_phase_check
      CHECK (affinity_phase IS NULL OR affinity_phase IN ('lobby', 'question', 'closed', 'revealed', 'finished'));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. État serveur d'une partie (1 ligne par session)
--    heartbeat_at : signal de vie écrit toutes les 60 s par la page admin.
--    Table hors realtime : ces écritures ne notifient personne.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affinity_runtime (
  session_id            uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_id              uuid NOT NULL,
  launched_at           timestamptz NOT NULL DEFAULT now(),
  heartbeat_at          timestamptz NOT NULL DEFAULT now(),
  revealed_question_ids text[] NOT NULL DEFAULT '{}',
  finished_at           timestamptz
);

CREATE INDEX IF NOT EXISTS affinity_runtime_launched_idx ON public.affinity_runtime (launched_at);

-- ---------------------------------------------------------------------
-- 3. Joueurs d'une partie
--    nickname_key : pseudo normalisé (minuscules, sans espaces) pour refuser
--    les doublons « Luna » / « luna » / « Lu na ».
--    token_hash : SHA-256 du jeton secret remis au téléphone (le jeton en
--    clair n'est jamais stocké).
--    top5 : résultat calculé une seule fois à la fin, déjà filtré
--    (consentement) et limité à 5 entrées.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affinity_players (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_id     uuid NOT NULL,
  nickname     text NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 24),
  nickname_key text NOT NULL CHECK (char_length(nickname_key) BETWEEN 1 AND 24),
  table_label  text CHECK (table_label IS NULL OR char_length(table_label) BETWEEN 1 AND 12),
  consent      boolean NOT NULL DEFAULT false,
  token_hash   text NOT NULL CHECK (char_length(token_hash) = 64),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  top5         jsonb,
  CONSTRAINT affinity_players_round_nickname_key UNIQUE (round_id, nickname_key)
);

CREATE INDEX IF NOT EXISTS affinity_players_session_idx ON public.affinity_players (session_id);
CREATE INDEX IF NOT EXISTS affinity_players_joined_idx  ON public.affinity_players (joined_at);

-- ---------------------------------------------------------------------
-- 4. Réponses (1 ligne par joueur et par question, modifiable tant que le
--    vote est ouvert). Suppression en cascade avec le joueur.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affinity_answers (
  player_id    uuid NOT NULL REFERENCES public.affinity_players(id) ON DELETE CASCADE,
  question_id  text NOT NULL CHECK (char_length(question_id) BETWEEN 1 AND 64),
  answer_index smallint NOT NULL CHECK (answer_index BETWEEN 0 AND 3),
  round_id     uuid NOT NULL,
  answered_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, question_id)
);

-- Comptage des réponses d'une question (compteur, révélation, calcul final).
CREATE INDEX IF NOT EXISTS affinity_answers_round_question_idx ON public.affinity_answers (round_id, question_id);

-- ---------------------------------------------------------------------
-- 5. Sécurité : tables fermées. Aucune policy = aucun accès anon ou
--    authenticated, même en lecture. Seul service_role (routes API) y accède.
-- ---------------------------------------------------------------------
ALTER TABLE public.affinity_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affinity_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affinity_answers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.affinity_runtime, public.affinity_players, public.affinity_answers FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Enregistrement d'une réponse, atomique
--    FOR SHARE sur la ligne sessions : une révélation (UPDATE de la phase)
--    attend la fin des réponses en cours, et une réponse arrivée après voit
--    la phase à jour. Aucune réponse ne peut donc se glisser après la
--    fermeture du vote ni après le comptage de la révélation.
--    Rejette : jeu inactif, vote fermé, chrono dépassé (1 s de tolérance
--    réseau), mauvaise question, index de réponse hors bornes, joueur
--    inconnu ou jeton invalide.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.affinity_submit_answer(
  p_session_id   uuid,
  p_player_id    uuid,
  p_token_hash   text,
  p_question_id  text,
  p_answer_index integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active    boolean;
  v_phase     text;
  v_deadline  timestamptz;
  v_questions jsonb;
  v_current   integer;
  v_question  jsonb;
  v_round     uuid;
BEGIN
  SELECT affinity_active, affinity_phase, affinity_deadline, affinity_questions, affinity_current_question
    INTO v_active, v_phase, v_deadline, v_questions, v_current
    FROM sessions
   WHERE id = p_session_id
     FOR SHARE;

  IF NOT FOUND OR v_active IS NOT TRUE OR v_phase IS DISTINCT FROM 'question' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  IF v_deadline IS NOT NULL AND now() > v_deadline + interval '1 second' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  v_question := v_questions -> v_current;
  IF v_question IS NULL OR v_question ->> 'id' IS DISTINCT FROM p_question_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_question');
  END IF;

  IF p_answer_index IS NULL
     OR p_answer_index < 0
     OR p_answer_index >= jsonb_array_length(v_question -> 'answers') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_answer');
  END IF;

  SELECT round_id INTO v_round FROM affinity_runtime WHERE session_id = p_session_id;

  IF v_round IS NULL OR NOT EXISTS (
    SELECT 1 FROM affinity_players
     WHERE id = p_player_id
       AND session_id = p_session_id
       AND round_id = v_round
       AND token_hash = p_token_hash
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_player');
  END IF;

  INSERT INTO affinity_answers (player_id, question_id, answer_index, round_id)
  VALUES (p_player_id, p_question_id, p_answer_index, v_round)
  ON CONFLICT (player_id, question_id)
  DO UPDATE SET answer_index = EXCLUDED.answer_index, answered_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.affinity_submit_answer(uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affinity_submit_answer(uuid, uuid, text, text, integer) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) après exécution
-- ---------------------------------------------------------------------
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name = 'sessions' AND column_name LIKE 'affinity_%' ORDER BY column_name;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'affinity_%';
-- SELECT * FROM pg_policies WHERE tablename LIKE 'affinity_%';            -- doit être vide
-- SELECT * FROM pg_publication_tables WHERE tablename LIKE 'affinity_%';  -- doit être vide

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- ---------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.affinity_submit_answer(uuid, uuid, text, text, integer);
-- DROP TABLE IF EXISTS public.affinity_answers;
-- DROP TABLE IF EXISTS public.affinity_players;
-- DROP TABLE IF EXISTS public.affinity_runtime;
-- ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_affinity_phase_check;
-- ALTER TABLE public.sessions
--   DROP COLUMN IF EXISTS affinity_final_stats, DROP COLUMN IF EXISTS affinity_reveal,
--   DROP COLUMN IF EXISTS affinity_deadline, DROP COLUMN IF EXISTS affinity_current_question,
--   DROP COLUMN IF EXISTS affinity_questions, DROP COLUMN IF EXISTS affinity_phase,
--   DROP COLUMN IF EXISTS affinity_active;
