-- =====================================================================
-- ANIMABUZZ — MANCHES PRÉPARÉES - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Garanties :
--   - AUCUNE table ni fonction existante modifiée : buzzer_runtime,
--     buzzer_players, buzzer_rounds, buzzer_buzzes, buzzer_admin,
--     buzzer_buzz, buzzer_public_state… restent tels quels. Le mode libre
--     fonctionne exactement comme avant ;
--   - rien sur sessions (ni colonne, ni trigger) ;
--   - buzzer_prep_admin APPELLE buzzer_admin (new_round, open, right, wrong,
--     cancel) sans la modifier : buzz, file, fenêtre et pause animateur
--     gardent leur logique actuelle ;
--   - tables de partie FERMÉES (RLS sans policy, droits retirés à anon et
--     authenticated), hors publication realtime ;
--   - le téléphone n'a qu'une porte de plus : buzzer_vote (jeton vérifié) ;
--   - diffusion sur le canal privé existant « buzzer:<session> », événement
--     « prep » (les pages actuelles n'écoutent que « state » : elles
--     l'ignorent). Aucune diffusion par vote : le compteur est relu.
--   - bibliothèque saved_buzzer_sets : RLS propriétaire, calquée sur
--     saved_matchings (vidée par la cascade à la suppression du compte).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Liste de manches en préparation (1 ligne par session), retrouvée après
--    un rechargement. data = { name, rounds: [...], settings: {...} }.
--    Validée par la route API avant écriture. Fermée.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_prep_sets (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  data       jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 500000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. Bibliothèque personnelle (calquée sur saved_matchings).
--    100 manches au maximum par liste.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_buzzer_sets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  rounds     jsonb NOT NULL CHECK (
               CASE WHEN jsonb_typeof(rounds) = 'array'
                    THEN jsonb_array_length(rounds) <= 100 AND octet_length(rounds::text) <= 500000
                    ELSE false END),
  settings   jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_buzzer_sets_user_id_idx ON public.saved_buzzer_sets (user_id);

ALTER TABLE public.saved_buzzer_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own saved buzzer sets" ON public.saved_buzzer_sets;
CREATE POLICY "Users can view their own saved buzzer sets"
  ON public.saved_buzzer_sets FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own saved buzzer sets" ON public.saved_buzzer_sets;
CREATE POLICY "Users can insert their own saved buzzer sets"
  ON public.saved_buzzer_sets FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own saved buzzer sets" ON public.saved_buzzer_sets;
CREATE POLICY "Users can update their own saved buzzer sets"
  ON public.saved_buzzer_sets FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own saved buzzer sets" ON public.saved_buzzer_sets;
CREATE POLICY "Users can delete their own saved buzzer sets"
  ON public.saved_buzzer_sets FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 3. Déroulé des manches préparées (1 ligne par session).
--    rounds : copie FIGÉE au lancement (modifier la liste ensuite ne
--    change pas la soirée en cours).
--    game_id : celui de buzzer_runtime au lancement. Si AnimaBuzz est
--    relancé ou quitté, game_id ne correspond plus : la ligne est ignorée
--    (mode libre) puis effacée par purge-buzzer.
--    step : ready (manche pas commencée) → question (buzzers) → reveal
--    → vote_open → vote_closed → manche suivante … → end.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_prep_runtime (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id    uuid NOT NULL,
  rounds     jsonb NOT NULL CHECK (
               CASE WHEN jsonb_typeof(rounds) = 'array'
                    THEN jsonb_array_length(rounds) BETWEEN 1 AND 100
                    ELSE false END),
  round_idx  integer NOT NULL DEFAULT 0 CHECK (round_idx >= 0),
  step       text NOT NULL DEFAULT 'ready' CHECK (step IN ('ready', 'question', 'reveal', 'vote_open', 'vote_closed', 'end')),
  revealed   boolean NOT NULL DEFAULT false,
  vote_id    uuid,
  version    bigint NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buzzer_prep_runtime_game_idx ON public.buzzer_prep_runtime (game_id);

-- ---------------------------------------------------------------------
-- 4. Votes de la salle : un vote par téléphone et par scrutin, modifiable
--    jusqu'à la clôture. Effacés avec le joueur (relance ou sortie
--    d'AnimaBuzz, purge) par la cascade sur buzzer_players.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_votes (
  vote_id    uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES public.buzzer_players(id) ON DELETE CASCADE,
  choice     smallint NOT NULL CHECK (choice BETWEEN 0 AND 3),
  voted_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (vote_id, player_id)
);

CREATE INDEX IF NOT EXISTS buzzer_votes_session_idx ON public.buzzer_votes (session_id);
CREATE INDEX IF NOT EXISTS buzzer_votes_player_idx ON public.buzzer_votes (player_id);

-- ---------------------------------------------------------------------
-- 5. Tables fermées : aucune policy = aucun accès anon / authenticated.
-- ---------------------------------------------------------------------
ALTER TABLE public.buzzer_prep_sets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_prep_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_votes        ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.buzzer_prep_sets, public.buzzer_prep_runtime, public.buzzer_votes
  FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. État public des manches préparées (écran géant et téléphones).
--    La réponse et l'image ne sortent qu'après la révélation ; la question
--    seulement une fois la manche lancée. Pendant le vote : nombre total de
--    votes, sans détail. Résultats par choix et bonne réponse : à la
--    clôture seulement. Le chemin de l'extrait audio ne sort jamais.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_prep_public(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r         public.buzzer_runtime;
  p         public.buzzer_prep_runtime;
  v_total   integer;
  v_round   jsonb;
  v_vote    jsonb;
  v_choices integer;
  v_count   integer;
  v_results jsonb;
  v_out     jsonb;
BEGIN
  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;
  SELECT * INTO p FROM public.buzzer_prep_runtime WHERE session_id = p_session_id AND game_id = r.game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;

  v_total := jsonb_array_length(p.rounds);
  IF p.step = 'end' OR p.round_idx >= v_total THEN
    RETURN jsonb_build_object('active', true, 'v', p.version, 'step', 'end',
                              'roundIndex', v_total, 'total', v_total, 'serverNow', clock_timestamp());
  END IF;

  v_round := p.rounds -> p.round_idx;
  IF jsonb_typeof(v_round -> 'vote') = 'object' AND jsonb_typeof(v_round -> 'vote' -> 'choices') = 'array' THEN
    v_vote := v_round -> 'vote';
  END IF;

  v_out := jsonb_build_object(
    'active', true,
    'v', p.version,
    'step', p.step,
    'roundIndex', p.round_idx,
    'total', v_total,
    'question', CASE WHEN p.step <> 'ready' THEN v_round ->> 'question' END,
    'revealed', p.revealed,
    'answer', CASE WHEN p.revealed THEN v_round ->> 'answer' END,
    'imagePath', CASE WHEN p.revealed THEN v_round ->> 'imagePath' END,
    'hasVote', v_vote IS NOT NULL,
    'vote', NULL,
    'serverNow', clock_timestamp()
  );

  IF v_vote IS NOT NULL AND p.step IN ('vote_open', 'vote_closed') AND p.vote_id IS NOT NULL THEN
    v_choices := jsonb_array_length(v_vote -> 'choices');
    -- Les votes d'un joueur retiré par l'animateur ne comptent pas.
    SELECT count(*) INTO v_count
      FROM public.buzzer_votes bv
      JOIN public.buzzer_players pl ON pl.id = bv.player_id AND pl.removed_at IS NULL
     WHERE bv.vote_id = p.vote_id AND bv.choice < v_choices;

    IF p.step = 'vote_closed' THEN
      SELECT coalesce(jsonb_agg(coalesce(c.n, 0) ORDER BY g.i), '[]'::jsonb)
        INTO v_results
        FROM generate_series(0, v_choices - 1) AS g(i)
        LEFT JOIN (
          SELECT bv.choice, count(*) AS n
            FROM public.buzzer_votes bv
            JOIN public.buzzer_players pl ON pl.id = bv.player_id AND pl.removed_at IS NULL
           WHERE bv.vote_id = p.vote_id
           GROUP BY bv.choice
        ) c ON c.choice = g.i;
    END IF;

    v_out := v_out || jsonb_build_object('vote', jsonb_build_object(
      'id', p.vote_id,
      'question', v_vote ->> 'question',
      'choices', v_vote -> 'choices',
      'count', v_count,
      'results', v_results,
      'correct', CASE WHEN p.step = 'vote_closed' THEN v_vote -> 'correct' END
    ));
  END IF;

  RETURN v_out;
END;
$$;

-- ---------------------------------------------------------------------
-- 7. Diffusion sur le canal privé existant, événement « prep ». Un échec
--    de diffusion n'annule jamais une action (comme buzzer_notify).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_prep_notify(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.buzzer_prep_public(p_session_id), 'prep', 'buzzer:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AnimaBuzz] diffusion manches impossible : %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 8. LE VOTE (téléphone). p_choice NULL = relire son vote (après un
--    rechargement). Vérifie : partie et manches lancées, animateur présent,
--    jeton valide, joueur non retiré, vote ouvert, choix existant.
--    FOR SHARE : les votes passent en parallèle, mais la clôture (FOR
--    UPDATE) attend ceux en cours puis refuse les suivants.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_vote(
  p_session_id uuid,
  p_player_id  uuid,
  p_token      text,
  p_choice     integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r         public.buzzer_runtime;
  p         public.buzzer_prep_runtime;
  v_player  public.buzzer_players;
  v_vote    jsonb;
  v_current smallint;
BEGIN
  IF p_session_id IS NULL OR p_player_id IS NULL OR p_token IS NULL
     OR char_length(p_token) NOT BETWEEN 32 AND 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;
  SELECT * INTO p FROM public.buzzer_prep_runtime
   WHERE session_id = p_session_id AND game_id = r.game_id
   FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;

  SELECT * INTO v_player FROM public.buzzer_players
   WHERE id = p_player_id
     AND session_id = p_session_id
     AND game_id = r.game_id
     AND token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_player');
  END IF;
  IF v_player.removed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'removed');
  END IF;

  IF p_choice IS NULL THEN
    IF p.vote_id IS NOT NULL THEN
      SELECT choice INTO v_current FROM public.buzzer_votes WHERE vote_id = p.vote_id AND player_id = v_player.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'voteId', p.vote_id, 'choice', v_current);
  END IF;

  IF r.heartbeat_at < clock_timestamp() - interval '90 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paused');
  END IF;
  IF p.step <> 'vote_open' OR p.vote_id IS NULL OR p.round_idx >= jsonb_array_length(p.rounds) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  v_vote := p.rounds -> p.round_idx -> 'vote';
  IF jsonb_typeof(v_vote -> 'choices') IS DISTINCT FROM 'array'
     OR p_choice < 0 OR p_choice >= jsonb_array_length(v_vote -> 'choices') OR p_choice > 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  INSERT INTO public.buzzer_votes (vote_id, session_id, player_id, choice, voted_at)
  VALUES (p.vote_id, p_session_id, v_player.id, p_choice, clock_timestamp())
  ON CONFLICT (vote_id, player_id) DO UPDATE SET choice = EXCLUDED.choice, voted_at = EXCLUDED.voted_at;

  RETURN jsonb_build_object('ok', true, 'voteId', p.vote_id, 'choice', p_choice);
END;
$$;

-- ---------------------------------------------------------------------
-- 9. Actions de l'animateur en manches préparées (appelées par le serveur
--    après vérification du propriétaire). Les actions de buzzer passent
--    par buzzer_admin, INCHANGÉE : même verrou, mêmes contrôles d'étape.
--    Tout se fait dans une seule transaction : si buzzer_admin refuse
--    (wrong_step…), rien n'est changé. Erreurs : « no_game », « no_prep »,
--    « wrong_step », « invalid ».
--    Renvoie { state: état buzzer, prep: état des manches }.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_prep_admin(
  p_session_id uuid,
  p_action     text,
  p_args       jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r          public.buzzer_runtime;
  p          public.buzzer_prep_runtime;
  v_rounds   jsonb;
  v_total    integer;
  v_round    jsonb;
  v_has_vote boolean;
  v_phase    text;
BEGIN
  -- Même ordre de verrouillage que buzzer_admin (buzzer_runtime d'abord) :
  -- pas d'interblocage avec les buzz ni avec les actions du mode libre.
  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;

  -- Lancer les manches : copie figée de la liste, manche 1 prête.
  IF p_action = 'start' THEN
    v_rounds := p_args -> 'rounds';
    IF jsonb_typeof(v_rounds) IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_rounds) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid';
    END IF;
    IF r.phase NOT IN ('lobby', 'test', 'closed') THEN
      RAISE EXCEPTION 'wrong_step';
    END IF;
    DELETE FROM public.buzzer_votes WHERE session_id = p_session_id;
    INSERT INTO public.buzzer_prep_runtime AS t (session_id, game_id, rounds, round_idx, step, revealed, vote_id, version, started_at)
    VALUES (p_session_id, r.game_id, v_rounds, 0, 'ready', false, NULL, 1, now())
    ON CONFLICT (session_id) DO UPDATE SET
      game_id = EXCLUDED.game_id, rounds = EXCLUDED.rounds, round_idx = 0, step = 'ready',
      revealed = false, vote_id = NULL, version = t.version + 1, started_at = now();
    PERFORM public.buzzer_prep_notify(p_session_id);
    RETURN jsonb_build_object('state', public.buzzer_public_state(p_session_id), 'prep', public.buzzer_prep_public(p_session_id));
  END IF;

  -- Arrêter les manches : retour au mode libre (la partie continue).
  IF p_action = 'stop' THEN
    SELECT phase INTO v_phase FROM public.buzzer_runtime WHERE session_id = p_session_id;
    IF v_phase IN ('waiting', 'open', 'buzzed') THEN
      PERFORM public.buzzer_admin(p_session_id, 'cancel');
    END IF;
    DELETE FROM public.buzzer_prep_runtime WHERE session_id = p_session_id;
    DELETE FROM public.buzzer_votes WHERE session_id = p_session_id;
    PERFORM public.buzzer_prep_notify(p_session_id);
    RETURN jsonb_build_object('state', public.buzzer_public_state(p_session_id), 'prep', public.buzzer_prep_public(p_session_id));
  END IF;

  SELECT * INTO p FROM public.buzzer_prep_runtime
   WHERE session_id = p_session_id AND game_id = r.game_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_prep';
  END IF;

  v_total := jsonb_array_length(p.rounds);
  IF p.step = 'end' OR p.round_idx >= v_total THEN
    RAISE EXCEPTION 'wrong_step';
  END IF;
  v_round := p.rounds -> p.round_idx;
  -- coalesce : sans vote, jsonb_typeof renvoie NULL (et non false).
  v_has_vote := coalesce(jsonb_typeof(v_round -> 'vote') = 'object'
                         AND jsonb_typeof(v_round -> 'vote' -> 'choices') = 'array', false);
  SELECT phase INTO v_phase FROM public.buzzer_runtime WHERE session_id = p_session_id;

  -- Lancer la manche : nouvelle manche buzzer + buzzers ouverts.
  IF p_action = 'round_start' THEN
    IF p.step <> 'ready' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    PERFORM public.buzzer_admin(p_session_id, 'new_round');
    PERFORM public.buzzer_admin(p_session_id, 'open');
    UPDATE public.buzzer_prep_runtime SET step = 'question' WHERE session_id = p_session_id;

  -- Bonne réponse : la main est validée et la réponse révélée d'un coup.
  ELSIF p_action = 'right' THEN
    IF p.step <> 'question' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    PERFORM public.buzzer_admin(p_session_id, 'right');
    UPDATE public.buzzer_prep_runtime SET step = 'reveal', revealed = true WHERE session_id = p_session_id;

  -- Mauvaise réponse : logique du mode libre (main au suivant ou réouverture).
  ELSIF p_action = 'wrong' THEN
    IF p.step <> 'question' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    PERFORM public.buzzer_admin(p_session_id, 'wrong');

  -- Révéler sans gagnant (personne n'a trouvé) : la manche buzzer est annulée si besoin.
  ELSIF p_action = 'reveal' THEN
    IF p.step <> 'question' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    IF v_phase IN ('waiting', 'open', 'buzzed') THEN
      PERFORM public.buzzer_admin(p_session_id, 'cancel');
    END IF;
    UPDATE public.buzzer_prep_runtime SET step = 'reveal', revealed = true WHERE session_id = p_session_id;

  -- Lancer le vote de la salle (nouveau scrutin).
  ELSIF p_action = 'vote_open' THEN
    IF NOT v_has_vote OR p.step NOT IN ('ready', 'question', 'reveal') THEN RAISE EXCEPTION 'wrong_step'; END IF;
    IF v_phase IN ('waiting', 'open', 'buzzed') THEN
      PERFORM public.buzzer_admin(p_session_id, 'cancel');
    END IF;
    UPDATE public.buzzer_prep_runtime SET step = 'vote_open', vote_id = gen_random_uuid() WHERE session_id = p_session_id;

  ELSIF p_action = 'vote_close' THEN
    IF p.step <> 'vote_open' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_prep_runtime SET step = 'vote_closed' WHERE session_id = p_session_id;

  -- Manche suivante, ou « Passer la manche » (sans révélation).
  ELSIF p_action = 'next_round' THEN
    IF v_phase IN ('waiting', 'open', 'buzzed') THEN
      PERFORM public.buzzer_admin(p_session_id, 'cancel');
    END IF;
    UPDATE public.buzzer_prep_runtime
       SET round_idx = round_idx + 1,
           step = CASE WHEN round_idx + 1 >= v_total THEN 'end' ELSE 'ready' END,
           revealed = false, vote_id = NULL
     WHERE session_id = p_session_id;

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  UPDATE public.buzzer_prep_runtime SET version = version + 1 WHERE session_id = p_session_id;
  PERFORM public.buzzer_prep_notify(p_session_id);
  RETURN jsonb_build_object('state', public.buzzer_public_state(p_session_id), 'prep', public.buzzer_prep_public(p_session_id));
END;
$$;

-- ---------------------------------------------------------------------
-- 10. Droits sur les fonctions : tout fermé, puis le strict nécessaire.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.buzzer_prep_public(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_prep_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_prep_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_vote(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- Téléphones (clé publique) : le vote uniquement.
GRANT EXECUTE ON FUNCTION public.buzzer_vote(uuid, uuid, text, integer) TO anon, authenticated;
-- Serveur (routes API) : le reste.
GRANT EXECUTE ON FUNCTION public.buzzer_vote(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.buzzer_prep_public(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.buzzer_prep_admin(uuid, text, jsonb) TO service_role;

-- Canal : la policy existante buzzer_broadcast_receive (topic LIKE 'buzzer:%')
-- couvre déjà l'événement « prep ». Rien à ajouter.

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) après exécution
-- ---------------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename IN ('buzzer_prep_sets', 'buzzer_prep_runtime', 'buzzer_votes', 'saved_buzzer_sets');   -- 4 lignes, rowsecurity = true
-- SELECT tablename, policyname FROM pg_policies
--  WHERE tablename IN ('buzzer_prep_sets', 'buzzer_prep_runtime', 'buzzer_votes');                     -- doit être vide
-- SELECT policyname FROM pg_policies WHERE tablename = 'saved_buzzer_sets';                             -- 4 lignes
-- SELECT * FROM pg_publication_tables WHERE tablename LIKE 'buzzer_%';                                  -- doit être vide
-- SELECT proname FROM pg_proc WHERE proname IN ('buzzer_prep_public', 'buzzer_prep_notify', 'buzzer_prep_admin', 'buzzer_vote');  -- 4 lignes

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite) — ne touche à
-- rien d'existant : le mode libre continue de fonctionner.
-- ---------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.buzzer_prep_admin(uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.buzzer_vote(uuid, uuid, text, integer);
-- DROP FUNCTION IF EXISTS public.buzzer_prep_notify(uuid);
-- DROP FUNCTION IF EXISTS public.buzzer_prep_public(uuid);
-- DROP TABLE IF EXISTS public.buzzer_votes;
-- DROP TABLE IF EXISTS public.buzzer_prep_runtime;
-- DROP TABLE IF EXISTS public.buzzer_prep_sets;
-- DROP TABLE IF EXISTS public.saved_buzzer_sets;
