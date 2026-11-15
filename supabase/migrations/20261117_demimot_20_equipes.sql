-- =====================================================================
-- À DEMI-MOT : de 2 à 20 équipes (au lieu de 10)
-- © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
--
-- Ne touche QUE les tables et la fonction d'À Demi-Mot : rien sur
-- public.sessions, aucun trigger, aucune donnée réécrite.
--   1. demimot_teams.position : 0..19 (au lieu de 0..9)
--   2. demimot_runtime.gate_blocked : jusqu'à 20 équipes bloquées sur une
--      même énigme (au lieu de 10)
--   3. demimot_commit : accepte jusqu'à 20 équipes (au lieu de 10). Corps
--      recopié à l'identique de 20261116, seule la limite change.
--
-- Sans effet tant que le nouveau code n'est pas en ligne : l'ancien code
-- n'envoie jamais plus de 10 équipes, qui restent valides. On peut donc
-- l'appliquer AVANT le déploiement.
-- Contrôle après application : supabase/verif_20261117_demimot_20_equipes.sql
-- =====================================================================

BEGIN;

-- Les tables d'À Demi-Mot sont minuscules : verrou très court. Si une
-- écriture de partie le retient plus de 5 s, la migration s'arrête
-- proprement (rien n'est changé) : la relancer un peu plus tard.
SET LOCAL lock_timeout = '5s';

-- 1. Numéro d'équipe 0..19
ALTER TABLE public.demimot_teams DROP CONSTRAINT IF EXISTS demimot_teams_position_check;
ALTER TABLE public.demimot_teams
  ADD CONSTRAINT demimot_teams_position_check CHECK (position BETWEEN 0 AND 19);

-- 2. Jusqu'à 20 équipes bloquées sur une même énigme
ALTER TABLE public.demimot_runtime DROP CONSTRAINT IF EXISTS demimot_runtime_gate_blocked_check;
ALTER TABLE public.demimot_runtime
  ADD CONSTRAINT demimot_runtime_gate_blocked_check CHECK (cardinality(gate_blocked) <= 20);

-- 3. demimot_commit : jusqu'à 20 équipes
CREATE OR REPLACE FUNCTION public.demimot_commit(
  p_session_id uuid,
  p_version    bigint,
  p_state      jsonb,
  p_view       jsonb,
  p_gate       jsonb,
  p_teams      jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now  timestamptz := clock_timestamp();
  r      public.demimot_runtime;
  v_gate text := p_gate ->> 'state';
BEGIN
  SELECT * INTO r FROM public.demimot_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;
  IF r.version <> p_version THEN
    RAISE EXCEPTION 'conflict';
  END IF;
  IF v_gate IS NULL OR v_gate NOT IN ('closed', 'open', 'buzzed') THEN
    RAISE EXCEPTION 'invalid';
  END IF;

  IF p_teams IS NOT NULL THEN
    IF jsonb_typeof(p_teams) <> 'array' OR jsonb_array_length(p_teams) > 20 THEN
      RAISE EXCEPTION 'invalid';
    END IF;
    DELETE FROM public.demimot_teams
     WHERE session_id = p_session_id
       AND id NOT IN (SELECT (e ->> 'id')::uuid FROM jsonb_array_elements(p_teams) e);
    INSERT INTO public.demimot_teams AS t (id, session_id, game_id, position, name, color)
    SELECT (e ->> 'id')::uuid, p_session_id, r.game_id, (e ->> 'position')::smallint, e ->> 'name', e ->> 'color'
      FROM jsonb_array_elements(p_teams) e
    ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, name = EXCLUDED.name, color = EXCLUDED.color
     WHERE t.session_id = p_session_id AND t.game_id = r.game_id;
  END IF;

  UPDATE public.demimot_runtime
     SET state = p_state,
         public_view = p_view,
         gate = v_gate,
         gate_window = (p_gate ->> 'window')::integer,
         gate_blocked = ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gate -> 'blocked', '[]'::jsonb))::uuid),
         gate_until = (p_gate ->> 'until')::timestamptz,
         answer_ms = coalesce((p_gate ->> 'answerMs')::integer, answer_ms),
         buzz_team_id = CASE WHEN v_gate = 'buzzed' THEN (p_gate ->> 'teamId')::uuid END,
         buzz_window = CASE WHEN v_gate = 'buzzed' THEN (p_gate ->> 'window')::integer END,
         buzz_at = CASE WHEN v_gate = 'buzzed' THEN (p_gate ->> 'at')::timestamptz END,
         version = version + 1,
         updated_at = v_now,
         heartbeat_at = v_now
   WHERE session_id = p_session_id;
  PERFORM public.demimot_notify(p_session_id);
  RETURN public.demimot_public_state(p_session_id);
END;
$$;

-- Droits inchangés (CREATE OR REPLACE les conserve) ; réaffirmés par sécurité :
-- appelable par le serveur seulement, jamais par un téléphone.
REVOKE ALL ON FUNCTION public.demimot_commit(uuid, bigint, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demimot_commit(uuid, bigint, jsonb, jsonb, jsonb, jsonb) TO service_role;

COMMIT;

-- =====================================================================
-- RETOUR ARRIÈRE (à copier sans les « -- » de début de ligne)
-- Possible seulement si aucune partie en cours n'a plus de 10 équipes ni
-- plus de 10 équipes bloquées : sinon il échoue SANS RIEN CHANGER (quitter
-- d'abord ces parties dans la régie, puis relancer).
-- À appliquer APRÈS être revenu à l'ancien code (sinon une partie à plus
-- de 10 équipes ne pourrait plus enregistrer).
-- =====================================================================
-- BEGIN;
-- SET LOCAL lock_timeout = '5s';
-- ALTER TABLE public.demimot_teams DROP CONSTRAINT IF EXISTS demimot_teams_position_check;
-- ALTER TABLE public.demimot_teams ADD CONSTRAINT demimot_teams_position_check CHECK (position BETWEEN 0 AND 9);
-- ALTER TABLE public.demimot_runtime DROP CONSTRAINT IF EXISTS demimot_runtime_gate_blocked_check;
-- ALTER TABLE public.demimot_runtime ADD CONSTRAINT demimot_runtime_gate_blocked_check CHECK (cardinality(gate_blocked) <= 10);
-- CREATE OR REPLACE FUNCTION public.demimot_commit(
--   p_session_id uuid,
--   p_version    bigint,
--   p_state      jsonb,
--   p_view       jsonb,
--   p_gate       jsonb,
--   p_teams      jsonb DEFAULT NULL
-- ) RETURNS jsonb
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = ''
-- AS $$
-- DECLARE
--   v_now  timestamptz := clock_timestamp();
--   r      public.demimot_runtime;
--   v_gate text := p_gate ->> 'state';
-- BEGIN
--   SELECT * INTO r FROM public.demimot_runtime WHERE session_id = p_session_id FOR UPDATE;
--   IF NOT FOUND THEN
--     RAISE EXCEPTION 'no_game';
--   END IF;
--   IF r.version <> p_version THEN
--     RAISE EXCEPTION 'conflict';
--   END IF;
--   IF v_gate IS NULL OR v_gate NOT IN ('closed', 'open', 'buzzed') THEN
--     RAISE EXCEPTION 'invalid';
--   END IF;
-- 
--   IF p_teams IS NOT NULL THEN
--     IF jsonb_typeof(p_teams) <> 'array' OR jsonb_array_length(p_teams) > 10 THEN
--       RAISE EXCEPTION 'invalid';
--     END IF;
--     DELETE FROM public.demimot_teams
--      WHERE session_id = p_session_id
--        AND id NOT IN (SELECT (e ->> 'id')::uuid FROM jsonb_array_elements(p_teams) e);
--     INSERT INTO public.demimot_teams AS t (id, session_id, game_id, position, name, color)
--     SELECT (e ->> 'id')::uuid, p_session_id, r.game_id, (e ->> 'position')::smallint, e ->> 'name', e ->> 'color'
--       FROM jsonb_array_elements(p_teams) e
--     ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, name = EXCLUDED.name, color = EXCLUDED.color
--      WHERE t.session_id = p_session_id AND t.game_id = r.game_id;
--   END IF;
-- 
--   UPDATE public.demimot_runtime
--      SET state = p_state,
--          public_view = p_view,
--          gate = v_gate,
--          gate_window = (p_gate ->> 'window')::integer,
--          gate_blocked = ARRAY(SELECT jsonb_array_elements_text(coalesce(p_gate -> 'blocked', '[]'::jsonb))::uuid),
--          gate_until = (p_gate ->> 'until')::timestamptz,
--          answer_ms = coalesce((p_gate ->> 'answerMs')::integer, answer_ms),
--          buzz_team_id = CASE WHEN v_gate = 'buzzed' THEN (p_gate ->> 'teamId')::uuid END,
--          buzz_window = CASE WHEN v_gate = 'buzzed' THEN (p_gate ->> 'window')::integer END,
--          buzz_at = CASE WHEN v_gate = 'buzzed' THEN (p_gate ->> 'at')::timestamptz END,
--          version = version + 1,
--          updated_at = v_now,
--          heartbeat_at = v_now
--    WHERE session_id = p_session_id;
--   PERFORM public.demimot_notify(p_session_id);
--   RETURN public.demimot_public_state(p_session_id);
-- END;
-- $$;
-- REVOKE ALL ON FUNCTION public.demimot_commit(uuid, bigint, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.demimot_commit(uuid, bigint, jsonb, jsonb, jsonb, jsonb) TO service_role;
-- COMMIT;
