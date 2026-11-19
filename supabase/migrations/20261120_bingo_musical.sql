-- =====================================================================
-- ANIMABINGO — LOTO MUSICAL - AnimaJet
-- Migration ADDITIVE. À exécuter dans Supabase > SQL Editor, APRÈS
-- 20261119_create_bingo.sql.
--
-- Garanties :
--   - rien sur sessions (ni colonne, ni trigger), aucune table d'un autre
--     jeu touchée ;
--   - mode numéros INCHANGÉ : bingo_public_state et bingo_admin sont
--     remplacées par la même logique (texte d'origine repris à l'identique),
--     les ajouts ne jouent que lorsque settings.music existe ;
--   - bingo_music (playlist figée de la partie) : table FERMÉE comme les
--     autres tables bingo, effacée avec la partie (cascade sur bingo_runtime :
--     sortie, purge 24 h) ;
--   - saved_bingo_playlists (bibliothèque) : RLS propriétaire, calquée sur
--     saved_buzzer_sets, effacée avec le compte ;
--   - bingo_cards.music_sig : colonne ajoutée, NULL = carton « numéros »
--     (tous les cartons existants restent des cartons numéros) ;
--   - les fichiers audio ne sont référencés que par leur chemin dans le
--     stockage existant (photos/bingo-music/<compte>/…) : aucune règle de
--     stockage modifiée, les téléphones ne reçoivent jamais ces chemins.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Bibliothèque personnelle : playlists de 90 titres au plus.
--    tracks = [{id, title, artist, path, start, end}], validé par l'API.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_bingo_playlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  tracks     jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
               CASE WHEN jsonb_typeof(tracks) = 'array'
                    THEN jsonb_array_length(tracks) <= 90 AND octet_length(tracks::text) <= 200000
                    ELSE false END),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_bingo_playlists_user_id_idx ON public.saved_bingo_playlists (user_id);

ALTER TABLE public.saved_bingo_playlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bingo playlists" ON public.saved_bingo_playlists;
CREATE POLICY "Users can view their own bingo playlists"
  ON public.saved_bingo_playlists FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own bingo playlists" ON public.saved_bingo_playlists;
CREATE POLICY "Users can insert their own bingo playlists"
  ON public.saved_bingo_playlists FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own bingo playlists" ON public.saved_bingo_playlists;
CREATE POLICY "Users can update their own bingo playlists"
  ON public.saved_bingo_playlists FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own bingo playlists" ON public.saved_bingo_playlists;
CREATE POLICY "Users can delete their own bingo playlists"
  ON public.saved_bingo_playlists FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 2. Playlist FIGÉE de la partie en cours (copie faite au lancement :
--    modifier la bibliothèque ensuite ne change pas la soirée).
--    sig = empreinte des titres (16 caractères hexadécimaux), recopiée
--    dans settings.music et sur les cartons papier.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_music (
  session_id uuid PRIMARY KEY REFERENCES public.bingo_runtime(session_id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  tracks     jsonb NOT NULL CHECK (
               CASE WHEN jsonb_typeof(tracks) = 'array'
                    THEN jsonb_array_length(tracks) BETWEEN 30 AND 90 AND octet_length(tracks::text) <= 200000
                    ELSE false END),
  sig        text NOT NULL CHECK (sig ~ '^[0-9a-f]{16}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bingo_music ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bingo_music FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Cartons papier du loto musical : rattachés à leur playlist.
--    NULL = carton numéros (cas de tous les cartons existants).
-- ---------------------------------------------------------------------
ALTER TABLE public.bingo_cards
  ADD COLUMN IF NOT EXISTS music_sig text CHECK (music_sig IS NULL OR music_sig ~ '^[0-9a-f]{16}$');

-- ---------------------------------------------------------------------
-- 4. État public : en mode musical, le morceau en cours d'écoute n'est pas
--    renvoyé avant sa révélation (champs « music » et « hidden » ajoutés).
--    Mode numéros : mêmes valeurs qu'avant.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_public_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r         public.bingo_runtime;
  v_count   integer;
  v_winners jsonb;
  v_players integer;
  v_pending integer;
  v_drawn   smallint[];
  v_hidden  boolean;
BEGIN
  SELECT * INTO r FROM public.bingo_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;
  -- Loto musical : le morceau en cours d'écoute reste secret (titre caché)
  -- jusqu'à sa révélation. Mode numéros : résultat identique à avant.
  v_hidden := r.settings ? 'music' AND cardinality(r.drawn) > 0 AND r.reveal_at > clock_timestamp();
  v_drawn  := CASE WHEN v_hidden THEN r.drawn[1:cardinality(r.drawn) - 1] ELSE r.drawn END;
  v_count  := cardinality(v_drawn);

  SELECT count(*) INTO v_players FROM public.bingo_players WHERE game_id = r.game_id;
  SELECT count(*) INTO v_pending FROM public.bingo_claims
   WHERE session_id = p_session_id AND game_id = r.game_id AND round_no = r.round_no AND status = 'pending';
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'phase', cl.phase, 'serial', ca.serial, 'kind', ca.kind,
           'name', cl.display_name, 'lines', cl.complete_lines, 'drawCount', cl.draw_count
         ) ORDER BY cl.decided_at, cl.id), '[]'::jsonb)
    INTO v_winners
    FROM public.bingo_claims cl JOIN public.bingo_cards ca ON ca.id = cl.card_id
   WHERE cl.session_id = p_session_id AND cl.game_id = r.game_id AND cl.round_no = r.round_no AND cl.status = 'accepted';

  RETURN jsonb_build_object(
    'active', true,
    'v', r.version,
    'gameId', r.game_id,
    'round', r.round_no,
    'status', r.status,
    'phases', to_jsonb(r.phases),
    'phaseIndex', r.phase_index,
    'drawn', to_jsonb(v_drawn),
    'count', v_count,
    'last', CASE WHEN v_count > 0 THEN v_drawn[v_count] END,
    'lastDrawAt', r.last_draw_at,
    'revealAt', CASE WHEN v_hidden THEN NULL ELSE r.reveal_at END,
    'music', r.settings -> 'music',
    'hidden', v_hidden,
    'autoMode', r.auto_mode,
    'autoMs', r.auto_ms,
    'display', coalesce(r.settings -> 'public', '{}'::jsonb),
    'players', v_players,
    'pending', v_pending,
    'winners', v_winners,
    'paused', r.heartbeat_at < clock_timestamp() - interval '90 seconds',
    'serverNow', clock_timestamp()
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Régie : même logique que 20261119, avec :
--    - launch / new_game {…, music?: {name, sig, tracks}} : playlist figée ;
--    - draw : parmi les N titres (90 en mode numéros), titre caché en musical ;
--    - reveal : nouvelle action (titre en cours affiché) ;
--    - auto : refusé en mode musical ;
--    - réglages : le mode ne change jamais en cours de partie ;
--    - cartons papier : rattachés au jeu de titres en cours.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_admin(
  p_session_id uuid,
  p_action     text,
  p_args       jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now    timestamptz := clock_timestamp();
  r        public.bingo_runtime;
  v_left   smallint[];
  v_pick   smallint;
  v_card   jsonb;
  v_serial integer;
  v_cells  smallint[];
  v_cid    uuid;
  v_need   smallint;
  v_lines  smallint;
  v_phases text[];
  v_sig    text;
  v_music  boolean;
  v_set    jsonb;
BEGIN
  p_args := coalesce(p_args, '{}'::jsonb);

  -- Lancement / relance : une partie existante est REPRISE telle quelle
  -- (boules, phase, gagnants, joueurs, cartons). Rien n'est effacé ici : un
  -- autre jeu lancé entre-temps a seulement mis AnimaBingo en pause.
  IF p_action = 'launch' AND EXISTS (SELECT 1 FROM public.bingo_runtime WHERE session_id = p_session_id) THEN
    UPDATE public.bingo_runtime
       SET version = version + 1, updated_at = v_now, heartbeat_at = v_now,
           auto_mode = CASE WHEN auto_mode = 'auto' THEN 'paused' ELSE auto_mode END
     WHERE session_id = p_session_id;
    UPDATE public.sessions
       SET bingo_active = true,
           quiz_active = false, quiz_lobby_visible = false, lineup_active = false,
           wheel_active = false, mystery_photo_active = false, affinity_active = false,
           buzzer_active = false, vote_active = false, demimot_active = false
     WHERE id = p_session_id;
    PERFORM public.bingo_notify(p_session_id);
    RETURN public.bingo_public_state(p_session_id) || jsonb_build_object('resumedGame', true);
  END IF;

  -- Nouvelle partie (premier lancement, ou remise à zéro DEMANDÉE par l'animateur
  -- après confirmation) : avant tout verrou sur bingo_runtime (la ligne peut ne pas exister).
  IF p_action IN ('launch', 'new_game') THEN
    v_phases := coalesce(ARRAY(SELECT e FROM jsonb_array_elements_text(p_args -> 'phases') WITH ORDINALITY AS t(e, i) ORDER BY i), '{quine,double,plein}');
    v_set := coalesce(p_args -> 'settings', '{}'::jsonb) - 'music';
    IF jsonb_typeof(p_args -> 'music') = 'object' THEN
      IF jsonb_typeof(p_args -> 'music' -> 'tracks') <> 'array'
         OR jsonb_array_length(p_args -> 'music' -> 'tracks') NOT BETWEEN 30 AND 90
         OR coalesce(p_args -> 'music' ->> 'sig', '') !~ '^[0-9a-f]{16}$' THEN
        RAISE EXCEPTION 'invalid';
      END IF;
      v_set := v_set || jsonb_build_object('music', jsonb_build_object(
                 'sig', p_args -> 'music' ->> 'sig', 'n', jsonb_array_length(p_args -> 'music' -> 'tracks')));
    END IF;
    p_args := jsonb_set(p_args, '{settings}', v_set);
    IF cardinality(v_phases) = 0 THEN v_phases := '{quine,double,plein}'; END IF;
    DELETE FROM public.bingo_claims  WHERE session_id = p_session_id;
    DELETE FROM public.bingo_cards   WHERE session_id = p_session_id AND kind = 'phone';
    DELETE FROM public.bingo_players WHERE session_id = p_session_id;
    INSERT INTO public.bingo_runtime AS x (session_id, game_id, round_no, version, settings, phases, phase_index, status, drawn,
                                           auto_mode, next_serial, last_draw_at, reveal_at, launched_at, updated_at, heartbeat_at)
    VALUES (p_session_id, gen_random_uuid(), 1, 1, coalesce(p_args -> 'settings', '{}'::jsonb), v_phases, 0, 'lobby', '{}',
            'manual', 1, NULL, NULL, v_now, v_now, v_now)
    ON CONFLICT (session_id) DO UPDATE SET
      game_id = EXCLUDED.game_id, round_no = 1, version = x.version + 1, settings = EXCLUDED.settings, phases = EXCLUDED.phases,
      phase_index = 0, status = 'lobby', drawn = '{}', auto_mode = 'manual', next_serial = 1, last_draw_at = NULL, reveal_at = NULL,
      launched_at = v_now, updated_at = v_now, heartbeat_at = v_now;
    DELETE FROM public.bingo_music WHERE session_id = p_session_id;
    IF v_set ? 'music' THEN
      INSERT INTO public.bingo_music (session_id, name, tracks, sig)
      VALUES (p_session_id, left(coalesce(nullif(trim(p_args -> 'music' ->> 'name'), ''), 'Playlist'), 80),
              p_args -> 'music' -> 'tracks', p_args -> 'music' ->> 'sig');
    END IF;
    UPDATE public.sessions
       SET bingo_active = true,
           quiz_active = false, quiz_lobby_visible = false, lineup_active = false,
           wheel_active = false, mystery_photo_active = false, affinity_active = false,
           buzzer_active = false, vote_active = false, demimot_active = false
     WHERE id = p_session_id;
    PERFORM public.bingo_notify(p_session_id);
    RETURN public.bingo_public_state(p_session_id);
  END IF;

  IF p_action = 'exit' THEN
    DELETE FROM public.bingo_claims  WHERE session_id = p_session_id;
    DELETE FROM public.bingo_cards   WHERE session_id = p_session_id AND kind = 'phone';
    DELETE FROM public.bingo_players WHERE session_id = p_session_id;
    DELETE FROM public.bingo_runtime WHERE session_id = p_session_id;
    UPDATE public.sessions SET bingo_active = false WHERE id = p_session_id AND bingo_active;
    PERFORM public.bingo_notify(p_session_id);
    RETURN jsonb_build_object('active', false, 'serverNow', v_now);
  END IF;

  -- Cartons papier : liés à la session, possibles même sans partie lancée.
  IF p_action = 'paper_add' THEN
    IF jsonb_typeof(p_args -> 'cards') <> 'array' OR jsonb_array_length(p_args -> 'cards') NOT BETWEEN 1 AND 600 THEN
      RAISE EXCEPTION 'invalid';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('bingo_paper:' || p_session_id::text, 0));  -- un seul ajout à la fois par session (sessions jamais verrouillée)
    SELECT sig INTO v_sig FROM public.bingo_music WHERE session_id = p_session_id;
    SELECT coalesce(max(serial), 5000) INTO v_serial FROM public.bingo_cards WHERE session_id = p_session_id AND kind = 'paper';
    IF v_serial + jsonb_array_length(p_args -> 'cards') > 9999 THEN
      RAISE EXCEPTION 'full';
    END IF;
    FOR v_card IN SELECT value FROM jsonb_array_elements(p_args -> 'cards') LOOP
      v_serial := v_serial + 1;
      BEGIN
        INSERT INTO public.bingo_cards (session_id, kind, serial, cells, signature, music_sig)
        VALUES (p_session_id, 'paper', v_serial, ARRAY(SELECT e::smallint FROM jsonb_array_elements_text(v_card -> 'cells') WITH ORDINALITY AS t(e, i) ORDER BY i), v_card ->> 'signature', v_sig);
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'duplicate';
      END;
    END LOOP;
    RETURN jsonb_build_object('first', v_serial - jsonb_array_length(p_args -> 'cards') + 1, 'last', v_serial);
  END IF;

  IF p_action = 'paper_clear' THEN
    -- Seulement les cartons du jeu de titres en cours : ceux d'une autre
    -- playlist (ou du mode numéros) restent valables si on y revient.
    DELETE FROM public.bingo_cards WHERE session_id = p_session_id AND kind = 'paper'
       AND music_sig IS NOT DISTINCT FROM (SELECT sig FROM public.bingo_music WHERE session_id = p_session_id);
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT * INTO r FROM public.bingo_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;

  IF p_action = 'heartbeat' THEN
    IF r.heartbeat_at >= v_now - interval '90 seconds' THEN
      UPDATE public.bingo_runtime SET heartbeat_at = v_now WHERE session_id = p_session_id;
      RETURN jsonb_build_object('v', r.version, 'resumed', false);
    END IF;
    -- Retour de la régie après une coupure : rien n'est perdu ; le tirage auto
    -- reste en pause tant que l'animateur ne le relance pas.
    UPDATE public.bingo_runtime
       SET heartbeat_at = v_now, version = version + 1, updated_at = v_now,
           auto_mode = CASE WHEN auto_mode = 'auto' THEN 'paused' ELSE auto_mode END
     WHERE session_id = p_session_id;
    PERFORM public.bingo_notify(p_session_id);
    RETURN jsonb_build_object('v', r.version + 1, 'resumed', true);

  ELSIF p_action = 'settings' THEN
    IF jsonb_typeof(p_args -> 'settings') = 'object' THEN
      r.settings := CASE WHEN r.settings ? 'music'
                         THEN ((p_args -> 'settings') - 'music') || jsonb_build_object('music', r.settings -> 'music')
                         ELSE (p_args -> 'settings') - 'music' END;
    END IF;
    IF p_args ? 'phases' THEN
      IF cardinality(r.drawn) > 0 THEN RAISE EXCEPTION 'invalid'; END IF;
      r.phases := ARRAY(SELECT e FROM jsonb_array_elements_text(p_args -> 'phases') WITH ORDINALITY AS t(e, i) ORDER BY i);
    END IF;
    UPDATE public.bingo_runtime SET settings = r.settings, phases = r.phases WHERE session_id = p_session_id;

  ELSIF p_action = 'start' THEN
    IF r.status <> 'lobby' THEN RAISE EXCEPTION 'invalid'; END IF;
    UPDATE public.bingo_runtime SET status = 'running' WHERE session_id = p_session_id;

  ELSIF p_action = 'draw' THEN
    IF (p_args ->> 'expect')::integer IS DISTINCT FROM cardinality(r.drawn) THEN
      RETURN public.bingo_public_state(p_session_id);              -- déjà tiré : sans effet
    END IF;
    IF r.status <> 'running' THEN RAISE EXCEPTION 'not_running'; END IF;
    IF r.last_draw_at > v_now - interval '2500 milliseconds' THEN RAISE EXCEPTION 'too_fast'; END IF;
    v_music := r.settings ? 'music';
    v_left := ARRAY(SELECT n::smallint FROM generate_series(1, CASE WHEN v_music THEN least(greatest((r.settings -> 'music' ->> 'n')::integer, 1), 90) ELSE 90 END) AS n
                     WHERE NOT (n::smallint = ANY (r.drawn)));
    IF cardinality(v_left) = 0 THEN RAISE EXCEPTION 'empty'; END IF;
    -- Hasard fort (gen_random_uuid repose sur pg_strong_random), biais négligeable.
    v_pick := v_left[1 + (('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 16, '0'))::bit(64)::bigint % cardinality(v_left))];
    UPDATE public.bingo_runtime
       SET drawn = drawn || v_pick, last_draw_at = v_now,
           reveal_at = CASE WHEN v_music THEN v_now + interval '30 minutes' ELSE v_now + interval '900 milliseconds' END
     WHERE session_id = p_session_id;

  ELSIF p_action = 'auto' THEN
    IF NOT (p_args ->> 'mode') = ANY (ARRAY['manual', 'auto', 'paused']) THEN RAISE EXCEPTION 'invalid'; END IF;
    IF r.settings ? 'music' AND p_args ->> 'mode' = 'auto' THEN RAISE EXCEPTION 'invalid'; END IF;  -- loto musical : tirage au clic
    UPDATE public.bingo_runtime
       SET auto_mode = p_args ->> 'mode',
           auto_ms = coalesce(least(greatest((p_args ->> 'ms')::integer, 4000), 20000), auto_ms)
     WHERE session_id = p_session_id;

  ELSIF p_action = 'decide' THEN
    UPDATE public.bingo_claims
       SET status = CASE WHEN (p_args ->> 'accept')::boolean THEN 'accepted' ELSE 'rejected' END,
           display_name = coalesce(nullif(left(trim(p_args ->> 'name'), 20), ''), display_name),
           decided_at = v_now
     WHERE id = (p_args ->> 'claimId')::bigint AND session_id = p_session_id AND game_id = r.game_id
       AND round_no = r.round_no AND status = 'pending';
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid'; END IF;
    IF (p_args ->> 'accept')::boolean THEN
      UPDATE public.bingo_runtime SET status = 'celebrating' WHERE session_id = p_session_id;
    ELSIF r.status = 'checking' AND NOT EXISTS (
      SELECT 1 FROM public.bingo_claims WHERE session_id = p_session_id AND round_no = r.round_no AND game_id = r.game_id AND status = 'pending') THEN
      UPDATE public.bingo_runtime SET status = 'running' WHERE session_id = p_session_id;
    END IF;

  ELSIF p_action = 'paper_win' THEN
    IF r.status NOT IN ('running', 'checking', 'celebrating') OR r.phase_index >= cardinality(r.phases) THEN RAISE EXCEPTION 'not_running'; END IF;
    SELECT id, cells INTO v_cid, v_cells FROM public.bingo_cards
     WHERE session_id = p_session_id AND kind = 'paper' AND serial = (p_args ->> 'serial')::integer
       AND music_sig IS NOT DISTINCT FROM (SELECT sig FROM public.bingo_music WHERE session_id = p_session_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid'; END IF;
    v_lines := public.bingo_complete_lines(v_cells, r.drawn);
    v_need := CASE r.phases[r.phase_index + 1] WHEN 'quine' THEN 1 WHEN 'double' THEN 2 ELSE 3 END;
    IF v_lines < v_need THEN RAISE EXCEPTION 'not_valid'; END IF;
    IF EXISTS (SELECT 1 FROM public.bingo_claims WHERE card_id = v_cid AND round_no = r.round_no AND game_id = r.game_id
                AND phase = r.phases[r.phase_index + 1] AND status = 'accepted') THEN
      RETURN public.bingo_public_state(p_session_id);              -- déjà gagnant : sans effet
    END IF;
    INSERT INTO public.bingo_claims (session_id, game_id, round_no, phase, card_id, draw_count, complete_lines, status, decided_at)
    VALUES (p_session_id, r.game_id, r.round_no, r.phases[r.phase_index + 1], v_cid, cardinality(r.drawn), v_lines, 'accepted', v_now);
    UPDATE public.bingo_runtime SET status = 'celebrating' WHERE session_id = p_session_id;

  ELSIF p_action = 'reveal' THEN
    -- Loto musical : le titre en cours d'écoute apparaît (fin de l'extrait ou clic).
    IF r.reveal_at IS NULL OR r.reveal_at <= v_now THEN
      RETURN public.bingo_public_state(p_session_id);              -- déjà visible : sans effet
    END IF;
    UPDATE public.bingo_runtime SET reveal_at = v_now WHERE session_id = p_session_id;

  ELSIF p_action = 'resume' THEN
    IF r.status NOT IN ('checking', 'celebrating') THEN RAISE EXCEPTION 'invalid'; END IF;
    UPDATE public.bingo_runtime SET status = 'running' WHERE session_id = p_session_id;

  ELSIF p_action = 'next_phase' THEN
    UPDATE public.bingo_claims SET status = 'rejected', decided_at = v_now
     WHERE session_id = p_session_id AND game_id = r.game_id AND round_no = r.round_no AND status = 'pending';
    UPDATE public.bingo_runtime
       SET phase_index = least(phase_index + 1, cardinality(phases)),
           status = CASE WHEN phase_index + 1 >= cardinality(phases) THEN 'finished' ELSE 'running' END,
           auto_mode = CASE WHEN auto_mode = 'auto' THEN 'paused' ELSE auto_mode END
     WHERE session_id = p_session_id;

  ELSIF p_action = 'new_round' THEN
    DELETE FROM public.bingo_claims WHERE session_id = p_session_id AND game_id = r.game_id;
    UPDATE public.bingo_runtime
       SET round_no = round_no + 1, phase_index = 0, status = 'lobby', drawn = '{}', auto_mode = 'manual',
           last_draw_at = NULL, reveal_at = NULL
     WHERE session_id = p_session_id;

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  UPDATE public.bingo_runtime SET version = version + 1, updated_at = v_now, heartbeat_at = v_now WHERE session_id = p_session_id;
  PERFORM public.bingo_notify(p_session_id);
  RETURN public.bingo_public_state(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Droits : inchangés (CREATE OR REPLACE les conserve), réaffirmés.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.bingo_public_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_public_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_admin(uuid, text, jsonb) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) : supabase/verif_20261120_bingo_musical.sql
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- 1. Réexécuter les sections 8 (bingo_public_state) et 12 (bingo_admin)
--    de 20261119_create_bingo.sql : logique d'origine rétablie.
-- 2. Puis :
-- BEGIN;
-- DELETE FROM public.bingo_cards WHERE music_sig IS NOT NULL;   -- cartons papier musicaux
-- ALTER TABLE public.bingo_cards DROP COLUMN IF EXISTS music_sig;
-- DROP TABLE IF EXISTS public.bingo_music;
-- DROP TABLE IF EXISTS public.saved_bingo_playlists;            -- efface les playlists des comptes
-- COMMIT;
-- (les fichiers photos/bingo-music/ restent à effacer depuis le stockage)
