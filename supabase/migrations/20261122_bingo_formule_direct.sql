-- =====================================================================
-- ANIMABINGO — FORMULE CHOISIE EN DIRECT - AnimaJet
-- Migration ADDITIVE. À exécuter dans Supabase > SQL Editor, APRÈS
-- 20261121_bingo_lots.sql.
--
-- Garanties :
--   - aucune table ni colonne ajoutée ou modifiée ; rien sur sessions (ni
--     colonne, ni trigger) ; aucune table d'un autre jeu touchée ;
--   - seule bingo_admin est remplacée : texte de 20261121 repris À
--     L'IDENTIQUE, avec une seule action en plus, « formula »
--     {phases, lots, expect} :
--       * avant la première boule : formule libre (étapes, ordre, 1 à 20
--         lots par étape) ;
--       * pendant la partie : étapes jouées et étape en cours inchangées et
--         à la même place, lots des étapes jouées inchangés, étape en cours
--         jamais sous le nombre de lots déjà gagnés, étapes pas encore
--         commencées ajoutées / retirées / réordonnées librement ; lots
--         ramenés au nombre déjà gagné = étape gagnée (bouton « Passer à… ») ;
--       * {expect} = étape affichée en régie : si elle a changé entre-temps,
--         sans effet (double clic, renvoi après coupure) ;
--       * partie terminée : refusé (« Nouvelle partie » d'abord) ;
--       * boules, cartons, coches, gagnants : jamais touchés ;
--   - pas de nom de lot (ni saisi, ni enregistré, ni affiché).
-- Le saut au carton plein reste l'action jump_final (20261121).
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Régie (texte de 20261121 + action « formula »).
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
  v_lots   smallint[];
  v_used   integer;
  v_shared boolean;
  v_prev   smallint;
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

  -- Nouvelle partie de la SOIRÉE (une partie existe déjà) : mêmes joueurs, mêmes
  -- cartons (téléphones et papier), même jeu de titres. Seuls le tirage, les
  -- demandes et les coches (manche suivante) repartent de zéro ; la formule
  -- (étapes, lots) et les réglages peuvent changer. Les cartons ne sont
  -- effacés que par « Quitter AnimaBingo » (exit).
  IF p_action IN ('new_game', 'new_round') AND EXISTS (SELECT 1 FROM public.bingo_runtime WHERE session_id = p_session_id) THEN
    SELECT * INTO r FROM public.bingo_runtime WHERE session_id = p_session_id FOR UPDATE;
    IF p_args ? 'phases' THEN
      v_phases := ARRAY(SELECT e FROM jsonb_array_elements_text(p_args -> 'phases') WITH ORDINALITY AS t(e, i) ORDER BY i);
      IF cardinality(v_phases) = 0 THEN v_phases := r.phases; END IF;
      v_lots := public.bingo_parse_lots(p_args -> 'lots', cardinality(v_phases));
    ELSE
      v_phases := r.phases;
      v_lots := CASE WHEN p_args ? 'lots' THEN public.bingo_parse_lots(p_args -> 'lots', cardinality(r.phases)) ELSE r.phase_lots END;
    END IF;
    v_set := CASE WHEN jsonb_typeof(p_args -> 'settings') = 'object' THEN (p_args -> 'settings') - 'music' ELSE r.settings - 'music' END;
    IF r.settings ? 'music' THEN v_set := v_set || jsonb_build_object('music', r.settings -> 'music'); END IF;
    DELETE FROM public.bingo_claims WHERE session_id = p_session_id;
    UPDATE public.bingo_runtime
       SET round_no = round_no + 1, version = version + 1, settings = v_set, phases = v_phases, phase_lots = v_lots,
           phase_index = 0, status = 'lobby', drawn = '{}', auto_mode = 'manual', last_draw_at = NULL, reveal_at = NULL,
           updated_at = v_now, heartbeat_at = v_now
     WHERE session_id = p_session_id;
    UPDATE public.sessions
       SET bingo_active = true,
           quiz_active = false, quiz_lobby_visible = false, lineup_active = false,
           wheel_active = false, mystery_photo_active = false, affinity_active = false,
           buzzer_active = false, vote_active = false, demimot_active = false
     WHERE id = p_session_id;
    PERFORM public.bingo_notify(p_session_id);
    RETURN public.bingo_public_state(p_session_id);
  END IF;

  -- Premier lancement de la soirée (aucune partie) : avant tout verrou sur
  -- bingo_runtime (la ligne n'existe pas encore).
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
    v_lots := public.bingo_parse_lots(p_args -> 'lots', cardinality(v_phases));
    DELETE FROM public.bingo_claims  WHERE session_id = p_session_id;
    DELETE FROM public.bingo_cards   WHERE session_id = p_session_id AND kind = 'phone';
    DELETE FROM public.bingo_players WHERE session_id = p_session_id;
    INSERT INTO public.bingo_runtime AS x (session_id, game_id, round_no, version, settings, phases, phase_lots, phase_index, status, drawn,
                                           auto_mode, next_serial, last_draw_at, reveal_at, launched_at, updated_at, heartbeat_at)
    VALUES (p_session_id, gen_random_uuid(), 1, 1, coalesce(p_args -> 'settings', '{}'::jsonb), v_phases, v_lots, 0, 'lobby', '{}',
            'manual', 1, NULL, NULL, v_now, v_now, v_now)
    ON CONFLICT (session_id) DO UPDATE SET
      game_id = EXCLUDED.game_id, round_no = 1, version = x.version + 1, settings = EXCLUDED.settings, phases = EXCLUDED.phases, phase_lots = EXCLUDED.phase_lots,
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
      r.phase_lots := '{}';                                          -- étapes changées : 1 lot chacune sauf « lots » fourni
    END IF;
    IF p_args ? 'lots' THEN
      IF cardinality(r.drawn) > 0 THEN RAISE EXCEPTION 'invalid'; END IF;
      r.phase_lots := public.bingo_parse_lots(p_args -> 'lots', cardinality(r.phases));
    END IF;
    UPDATE public.bingo_runtime SET settings = r.settings, phases = r.phases, phase_lots = r.phase_lots WHERE session_id = p_session_id;

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
    SELECT max(complete_lines) INTO v_prev FROM public.bingo_claims WHERE card_id = v_cid AND round_no = r.round_no AND game_id = r.game_id
       AND phase = r.phases[r.phase_index + 1] AND status = 'accepted';
    IF v_prev IS NOT NULL AND (NOT coalesce((r.settings ->> 'repeatCard')::boolean, false) OR v_lines < v_prev + v_need) THEN
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
    IF r.status = 'celebrating' AND public.bingo_phase_done(r) THEN RAISE EXCEPTION 'phase_done'; END IF;
    UPDATE public.bingo_runtime SET status = 'running' WHERE session_id = p_session_id;

  ELSIF p_action IN ('next_phase', 'advance', 'jump_final') THEN
    -- {expect: étape affichée} : un double clic ou un renvoi après coupure ne
    -- saute jamais deux étapes. Jamais tant qu'une demande attend sa
    -- vérification (ex aequo de la même boule).
    IF p_args ? 'expect' AND (p_args ->> 'expect')::integer IS DISTINCT FROM r.phase_index THEN
      RETURN public.bingo_public_state(p_session_id);              -- déjà fait : sans effet
    END IF;
    IF r.status NOT IN ('running', 'checking', 'celebrating') OR r.phase_index >= cardinality(r.phases) THEN RAISE EXCEPTION 'not_running'; END IF;
    IF EXISTS (SELECT 1 FROM public.bingo_claims WHERE session_id = p_session_id AND game_id = r.game_id
                AND round_no = r.round_no AND status = 'pending') THEN
      RAISE EXCEPTION 'pending';
    END IF;
    IF p_action = 'advance' THEN
      -- Passage automatique (réglage advance = auto) : étape gagnée, fête de 8 s finie.
      IF r.settings ->> 'advance' IS DISTINCT FROM 'auto' OR r.status <> 'celebrating' OR NOT public.bingo_phase_done(r)
         OR EXISTS (SELECT 1 FROM public.bingo_claims WHERE game_id = r.game_id AND round_no = r.round_no
                     AND phase = r.phases[r.phase_index + 1] AND status = 'accepted' AND decided_at > v_now - interval '8 seconds') THEN
        RETURN public.bingo_public_state(p_session_id);            -- pas encore : sans effet
      END IF;
    END IF;
    IF p_action = 'jump_final' THEN
      IF r.phase_index + 1 >= cardinality(r.phases) THEN
        RETURN public.bingo_public_state(p_session_id);            -- déjà à la dernière étape
      END IF;
      UPDATE public.bingo_runtime
         SET phase_index = cardinality(phases) - 1, status = 'running',
             auto_mode = CASE WHEN auto_mode = 'auto' THEN 'paused' ELSE auto_mode END
       WHERE session_id = p_session_id;
    ELSE
      UPDATE public.bingo_runtime
         SET phase_index = least(phase_index + 1, cardinality(phases)),
             status = CASE WHEN phase_index + 1 >= cardinality(phases) THEN 'finished' ELSE 'running' END,
             auto_mode = CASE WHEN auto_mode = 'auto' THEN 'paused' ELSE auto_mode END
       WHERE session_id = p_session_id;
    END IF;

  ELSIF p_action = 'formula' THEN
    -- Formule choisie en direct (avant ou pendant la partie), avec
    -- {phases, lots, expect}. Pendant la partie : les étapes jouées et
    -- l'étape en cours restent à leur place, les lots des étapes jouées ne
    -- changent pas, l'étape en cours garde au moins les lots déjà gagnés ;
    -- seules les étapes pas encore commencées s'ajoutent ou se retirent.
    -- Boules, cartons, coches et gagnants : intouchés.
    IF p_args ? 'expect' AND (p_args ->> 'expect')::integer IS DISTINCT FROM r.phase_index THEN
      RETURN public.bingo_public_state(p_session_id);              -- étape changée entre-temps : sans effet
    END IF;
    IF r.status = 'finished' OR r.phase_index >= cardinality(r.phases) THEN RAISE EXCEPTION 'invalid'; END IF;
    IF jsonb_typeof(p_args -> 'phases') <> 'array' THEN RAISE EXCEPTION 'invalid'; END IF;
    v_phases := ARRAY(SELECT e FROM jsonb_array_elements_text(p_args -> 'phases') WITH ORDINALITY AS t(e, i) ORDER BY i);
    IF cardinality(v_phases) NOT BETWEEN 1 AND 3
       OR EXISTS (SELECT 1 FROM unnest(v_phases) p WHERE p NOT IN ('quine', 'double', 'plein'))
       OR (SELECT count(DISTINCT p) FROM unnest(v_phases) p) <> cardinality(v_phases) THEN
      RAISE EXCEPTION 'invalid';
    END IF;
    v_lots := public.bingo_parse_lots(p_args -> 'lots', cardinality(v_phases));
    IF cardinality(v_lots) = 0 THEN
      v_lots := ARRAY(SELECT 1::smallint FROM generate_series(1, cardinality(v_phases)));
    END IF;
    IF r.status <> 'lobby' OR cardinality(r.drawn) > 0 THEN
      -- Étapes jouées + étape en cours : mêmes étapes, à la même place.
      IF cardinality(v_phases) <= r.phase_index
         OR v_phases[1:r.phase_index + 1] IS DISTINCT FROM r.phases[1:r.phase_index + 1] THEN
        RAISE EXCEPTION 'invalid';
      END IF;
      -- Étapes jouées : lots inchangés (1 si jamais précisé).
      FOR k IN 1 .. r.phase_index LOOP
        IF v_lots[k] IS DISTINCT FROM coalesce(r.phase_lots[k], 1)::smallint THEN RAISE EXCEPTION 'invalid'; END IF;
      END LOOP;
      -- Étape en cours : jamais moins de lots que ceux déjà gagnés.
      v_shared := coalesce(r.settings ->> 'tie', 'shared') <> 'each';
      v_used := public.bingo_lots_used(r.game_id, r.round_no, r.phases[r.phase_index + 1], v_shared);
      IF v_lots[r.phase_index + 1] < v_used THEN RAISE EXCEPTION 'invalid'; END IF;
      -- Une demande attend sa vérification : on ne ferme pas l'étape sous elle.
      IF r.status = 'checking' AND v_lots[r.phase_index + 1] <= v_used THEN RAISE EXCEPTION 'pending'; END IF;
      UPDATE public.bingo_runtime
         SET phases = v_phases, phase_lots = v_lots,
             -- lots ramenés au nombre déjà gagné : l'étape est gagnée, le
             -- bouton « Passer à… » apparaît (tirage arrêté).
             status = CASE WHEN status = 'running' AND v_used > 0 AND v_lots[phase_index + 1] <= v_used THEN 'celebrating' ELSE status END,
             auto_mode = CASE WHEN status = 'running' AND v_used > 0 AND v_lots[phase_index + 1] <= v_used AND auto_mode = 'auto' THEN 'paused' ELSE auto_mode END
       WHERE session_id = p_session_id;
    ELSE
      -- Avant la première boule : formule libre.
      UPDATE public.bingo_runtime SET phases = v_phases, phase_lots = v_lots, phase_index = 0 WHERE session_id = p_session_id;
    END IF;

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  UPDATE public.bingo_runtime SET version = version + 1, updated_at = v_now, heartbeat_at = v_now WHERE session_id = p_session_id;
  PERFORM public.bingo_notify(p_session_id);
  RETURN public.bingo_public_state(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Droits : fonction serveur uniquement (inchangés).
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.bingo_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_admin(uuid, text, jsonb) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) : supabase/verif_20261122_bingo_formule_direct.sql
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- Réexécuter la section 5 (bingo_admin) et la section 6 (droits) de
-- 20261121_bingo_lots.sql : l'action « formula » disparaît, tout le reste
-- est identique. Aucune donnée à reprendre.
-- ---------------------------------------------------------------------
