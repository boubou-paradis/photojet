-- =====================================================================
-- ANIMABUZZ — POINTS ET CLASSEMENT - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Garanties :
--   - AUCUNE table ni fonction existante modifiée : buzzer_runtime,
--     buzzer_players, buzzer_rounds, buzzer_buzzes, buzzer_admin,
--     buzzer_buzz, buzzer_public_state, buzzer_prep_admin, buzzer_vote…
--     restent tels quels. Le jeu fonctionne exactement comme avant, avec
--     ou sans points ;
--   - rien sur sessions (ni colonne, ni trigger) ;
--   - les points sont ÉCRITS À CÔTÉ : la route serveur appelle
--     buzzer_score_admin après une bonne réponse ou la clôture d'un vote.
--     Une erreur de points n'annule jamais une action de jeu ;
--   - attribution idempotente : une manche (ou un vote d'un joueur) ne
--     rapporte qu'une fois, même si l'action est envoyée deux fois ;
--   - tables FERMÉES (RLS sans policy, droits retirés à anon et
--     authenticated), hors publication realtime ;
--   - aucune nouvelle porte pour le téléphone : il reçoit le classement
--     sur le canal privé existant « buzzer:<session> », événement
--     « scores » (les pages actuelles ne l'écoutent pas : elles l'ignorent).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Réglages et affichage des points (1 ligne par session, pour la partie
--    en cours : game_id). Une nouvelle partie repart de zéro.
--    points_per_round : points d'une bonne réponse au buzzer (0 = pas de
--    points). Une manche préparée peut avoir sa propre valeur.
--    vote_points : points d'un bon vote de la salle (mode individuel).
--    shown : classement affiché sur l'écran géant.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_score_state (
  session_id       uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id          uuid NOT NULL,
  points_per_round integer NOT NULL DEFAULT 1 CHECK (points_per_round BETWEEN 0 AND 100),
  vote_points      integer NOT NULL DEFAULT 1 CHECK (vote_points BETWEEN 0 AND 100),
  shown            boolean NOT NULL DEFAULT false,
  version          bigint NOT NULL DEFAULT 1,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. Points gagnés (ou corrigés à la main). Le score d'un joueur (ou d'une
--    équipe) est la somme de ses lignes pour la partie en cours.
--    unit_key : « p:<joueur> » ou « t:<équipe> » (comme les buzz).
--    ref : clé d'unicité des attributions automatiques
--    (« round:<manche> », « vote:<scrutin>:<joueur> ») ; NULL à la main.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_score_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id     uuid NOT NULL,
  unit_key    text NOT NULL CHECK (char_length(unit_key) BETWEEN 3 AND 64),
  unit_label  text NOT NULL CHECK (char_length(unit_label) BETWEEN 1 AND 24),
  points      integer NOT NULL CHECK (points BETWEEN -100 AND 100 AND points <> 0),
  kind        text NOT NULL CHECK (kind IN ('round', 'vote', 'manual')),
  ref         text CHECK (ref IS NULL OR char_length(ref) BETWEEN 1 AND 120),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS buzzer_score_events_game_ref_key
  ON public.buzzer_score_events (game_id, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS buzzer_score_events_game_idx ON public.buzzer_score_events (game_id, unit_key);
CREATE INDEX IF NOT EXISTS buzzer_score_events_session_idx ON public.buzzer_score_events (session_id);

ALTER TABLE public.buzzer_score_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_score_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.buzzer_score_state, public.buzzer_score_events FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Classement public (écran géant, téléphones, animateur). Tous les
--    joueurs (ou équipes) présents y figurent, même à 0 point ; un joueur
--    retiré par l'animateur n'y figure plus. Rang avec ex æquo (1, 1, 3).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_scores_public(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r        public.buzzer_runtime;
  s        public.buzzer_score_state;
  v_scores jsonb;
BEGIN
  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;
  -- Réglages gardés d'une partie à l'autre ; version toujours croissante
  -- (un écran ne rejette jamais l'état d'une nouvelle partie).
  SELECT * INTO s FROM public.buzzer_score_state WHERE session_id = p_session_id;

  WITH units AS (
    SELECT DISTINCT ON (u.unit_key) u.unit_key, u.unit_label
      FROM (
        SELECT CASE WHEN r.mode = 'team' THEN 't:' || pl.team_key ELSE 'p:' || pl.id::text END AS unit_key,
               CASE WHEN r.mode = 'team' THEN pl.team_label ELSE pl.nickname END AS unit_label,
               pl.joined_at
          FROM public.buzzer_players pl
         WHERE pl.session_id = p_session_id AND pl.game_id = r.game_id AND pl.removed_at IS NULL
           AND (CASE WHEN r.mode = 'team' THEN pl.team_key ELSE pl.nickname END) IS NOT NULL
      ) u
     ORDER BY u.unit_key, u.joined_at
  ), totals AS (
    SELECT u.unit_key, u.unit_label, coalesce(sum(e.points), 0)::integer AS points
      FROM units u
      LEFT JOIN public.buzzer_score_events e
        ON e.game_id = r.game_id AND e.unit_key = u.unit_key
     GROUP BY u.unit_key, u.unit_label
  ), ranked AS (
    SELECT t.*, rank() OVER (ORDER BY t.points DESC) AS rnk
      FROM totals t
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('unit', unit_key, 'label', unit_label, 'points', points, 'rank', rnk)
                            ORDER BY points DESC, lower(unit_label)), '[]'::jsonb)
    INTO v_scores
    FROM (SELECT * FROM ranked ORDER BY points DESC, lower(unit_label) LIMIT 300) x;

  RETURN jsonb_build_object(
    'active', true,
    'v', coalesce(s.version, 0),
    'shown', coalesce(s.shown AND s.game_id = r.game_id, false),
    'pointsPerRound', coalesce(s.points_per_round, 1),
    'votePoints', coalesce(s.vote_points, 1),
    'scores', v_scores,
    'serverNow', clock_timestamp()
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Diffusion sur le canal privé existant, événement « scores ». Un échec
--    de diffusion n'annule jamais une action (comme buzzer_notify).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_scores_notify(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.buzzer_scores_public(p_session_id), 'scores', 'buzzer:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AnimaBuzz] diffusion classement impossible : %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Actions sur les points (appelées par le serveur après vérification du
--    propriétaire). Erreurs : « no_game », « invalid ».
--    award_round : bonne réponse de la manche en cours (après « right »).
--      Points = valeur de la manche préparée si elle en a une, sinon le
--      réglage général. Une seule fois par manche.
--    award_vote  : bons votes du scrutin clôturé (mode individuel, si le
--      vote a une bonne réponse). Une seule fois par joueur et par vote.
--    adjust      : correction à la main { unit, delta } (-100 à 100).
--    settings    : { pointsPerRound?, votePoints? } (0 à 100).
--    show / hide : classement sur l'écran géant.
--    reset       : remise à zéro des points de la partie.
--    Renvoie le classement public.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_score_admin(
  p_session_id uuid,
  p_action     text,
  p_args       jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r         public.buzzer_runtime;
  s         public.buzzer_score_state;
  p         public.buzzer_prep_runtime;
  v_unit    text;
  v_label   text;
  v_points  integer;
  v_round   jsonb;
  v_correct integer;
  v_delta   integer;
  v_changed boolean := true;
BEGIN
  -- Même ordre de verrouillage que buzzer_admin (buzzer_runtime d'abord).
  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;

  -- Réglages de la partie en cours ; une nouvelle partie repart de zéro
  -- (les points de l'ancienne sont effacés, les réglages gardés).
  SELECT * INTO s FROM public.buzzer_score_state WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.buzzer_score_state (session_id, game_id) VALUES (p_session_id, r.game_id)
    RETURNING * INTO s;
  ELSIF s.game_id <> r.game_id THEN
    DELETE FROM public.buzzer_score_events WHERE session_id = p_session_id AND game_id <> r.game_id;
    UPDATE public.buzzer_score_state SET game_id = r.game_id, shown = false
     WHERE session_id = p_session_id RETURNING * INTO s;
  END IF;

  IF p_action = 'award_round' THEN
    v_changed := false;
    IF r.outcome = 'won' AND r.round_id IS NOT NULL THEN
      SELECT b.unit_key, b.unit_label INTO v_unit, v_label
        FROM public.buzzer_buzzes b
       WHERE b.round_id = r.round_id AND b.status = 'won'
       LIMIT 1;
      IF v_unit IS NOT NULL THEN
        v_points := s.points_per_round;
        SELECT * INTO p FROM public.buzzer_prep_runtime WHERE session_id = p_session_id AND game_id = r.game_id;
        IF FOUND AND p.round_idx < jsonb_array_length(p.rounds) THEN
          v_round := p.rounds -> p.round_idx;
          IF jsonb_typeof(v_round -> 'points') = 'number' THEN
            v_points := least(greatest(round((v_round ->> 'points')::numeric)::integer, 0), 100);
          END IF;
        END IF;
        IF v_points > 0 THEN
          INSERT INTO public.buzzer_score_events (session_id, game_id, unit_key, unit_label, points, kind, ref)
          VALUES (p_session_id, r.game_id, v_unit, v_label, v_points, 'round', 'round:' || r.round_id::text)
          ON CONFLICT (game_id, ref) WHERE ref IS NOT NULL DO NOTHING;
          v_changed := FOUND;
        END IF;
      END IF;
    END IF;

  ELSIF p_action = 'award_vote' THEN
    v_changed := false;
    SELECT * INTO p FROM public.buzzer_prep_runtime WHERE session_id = p_session_id AND game_id = r.game_id;
    IF FOUND AND r.mode = 'solo' AND s.vote_points > 0 AND p.step = 'vote_closed' AND p.vote_id IS NOT NULL
       AND p.round_idx < jsonb_array_length(p.rounds) THEN
      v_round := p.rounds -> p.round_idx;
      IF jsonb_typeof(v_round -> 'vote' -> 'correct') = 'number' THEN
        v_correct := round((v_round -> 'vote' ->> 'correct')::numeric)::integer;
        INSERT INTO public.buzzer_score_events (session_id, game_id, unit_key, unit_label, points, kind, ref)
        SELECT p_session_id, r.game_id, 'p:' || pl.id::text, pl.nickname, s.vote_points, 'vote',
               'vote:' || p.vote_id::text || ':' || pl.id::text
          FROM public.buzzer_votes bv
          JOIN public.buzzer_players pl ON pl.id = bv.player_id AND pl.removed_at IS NULL AND pl.nickname IS NOT NULL
         WHERE bv.vote_id = p.vote_id AND bv.choice = v_correct
        ON CONFLICT (game_id, ref) WHERE ref IS NOT NULL DO NOTHING;
        v_changed := FOUND;
      END IF;
    END IF;

  ELSIF p_action = 'adjust' THEN
    v_unit := p_args ->> 'unit';
    IF jsonb_typeof(p_args -> 'delta') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid'; END IF;
    v_delta := round((p_args ->> 'delta')::numeric)::integer;
    IF v_unit IS NULL OR v_delta = 0 OR v_delta NOT BETWEEN -100 AND 100 THEN RAISE EXCEPTION 'invalid'; END IF;
    IF r.mode = 'team' AND v_unit LIKE 't:%' THEN
      SELECT pl.team_label INTO v_label FROM public.buzzer_players pl
       WHERE pl.session_id = p_session_id AND pl.game_id = r.game_id AND pl.removed_at IS NULL
         AND 't:' || pl.team_key = v_unit
       LIMIT 1;
    ELSIF r.mode = 'solo' AND v_unit LIKE 'p:%' THEN
      SELECT pl.nickname INTO v_label FROM public.buzzer_players pl
       WHERE pl.session_id = p_session_id AND pl.game_id = r.game_id AND pl.removed_at IS NULL
         AND 'p:' || pl.id::text = v_unit;
    END IF;
    IF v_label IS NULL THEN RAISE EXCEPTION 'invalid'; END IF;
    INSERT INTO public.buzzer_score_events (session_id, game_id, unit_key, unit_label, points, kind)
    VALUES (p_session_id, r.game_id, v_unit, v_label, v_delta, 'manual');

  ELSIF p_action = 'settings' THEN
    IF p_args ? 'pointsPerRound' THEN
      IF jsonb_typeof(p_args -> 'pointsPerRound') IS DISTINCT FROM 'number'
         OR (p_args ->> 'pointsPerRound')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid'; END IF;
      UPDATE public.buzzer_score_state SET points_per_round = round((p_args ->> 'pointsPerRound')::numeric)::integer WHERE session_id = p_session_id;
    END IF;
    IF p_args ? 'votePoints' THEN
      IF jsonb_typeof(p_args -> 'votePoints') IS DISTINCT FROM 'number'
         OR (p_args ->> 'votePoints')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'invalid'; END IF;
      UPDATE public.buzzer_score_state SET vote_points = round((p_args ->> 'votePoints')::numeric)::integer WHERE session_id = p_session_id;
    END IF;

  ELSIF p_action = 'show' THEN
    UPDATE public.buzzer_score_state SET shown = true WHERE session_id = p_session_id;

  ELSIF p_action = 'hide' THEN
    UPDATE public.buzzer_score_state SET shown = false WHERE session_id = p_session_id;

  ELSIF p_action = 'reset' THEN
    DELETE FROM public.buzzer_score_events WHERE session_id = p_session_id;

  ELSIF p_action = 'snapshot' THEN
    v_changed := false;

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  IF v_changed THEN
    UPDATE public.buzzer_score_state SET version = version + 1, updated_at = now() WHERE session_id = p_session_id;
    PERFORM public.buzzer_scores_notify(p_session_id);
  END IF;
  RETURN public.buzzer_scores_public(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Droits sur les fonctions : tout fermé, puis le serveur uniquement.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.buzzer_scores_public(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_scores_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_score_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.buzzer_scores_public(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.buzzer_score_admin(uuid, text, jsonb) TO service_role;

-- Canal : la policy existante buzzer_broadcast_receive (topic LIKE 'buzzer:%')
-- couvre déjà l'événement « scores ». Rien à ajouter.

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) après exécution
-- ---------------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename IN ('buzzer_score_state', 'buzzer_score_events');                 -- 2 lignes, rowsecurity = true
-- SELECT tablename, policyname FROM pg_policies
--  WHERE tablename IN ('buzzer_score_state', 'buzzer_score_events');                 -- doit être vide
-- SELECT * FROM pg_publication_tables WHERE tablename LIKE 'buzzer_score%';         -- doit être vide
-- SELECT proname FROM pg_proc WHERE proname IN ('buzzer_scores_public', 'buzzer_scores_notify', 'buzzer_score_admin');  -- 3 lignes

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite) — ne touche à
-- rien d'existant : le jeu continue de fonctionner, sans points.
-- ---------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.buzzer_score_admin(uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.buzzer_scores_notify(uuid);
-- DROP FUNCTION IF EXISTS public.buzzer_scores_public(uuid);
-- DROP TABLE IF EXISTS public.buzzer_score_events;
-- DROP TABLE IF EXISTS public.buzzer_score_state;
