-- =====================================================================
-- ANIMABINGO — FORMULES ET LOTS (quine suivie, passage d'étape) - AnimaJet
-- Migration ADDITIVE. À exécuter dans Supabase > SQL Editor, APRÈS
-- 20261120_bingo_musical.sql. Sur animajet-test d'abord.
--
-- Garanties :
--   - rien sur sessions (ni colonne, ni trigger), aucune table d'un autre
--     jeu touchée ;
--   - bingo_runtime.phase_lots : colonne ajoutée, vide par défaut = 1 lot par
--     étape. Les parties existantes se jouent EXACTEMENT comme avant ;
--   - aucun nouveau stockage pour les lots gagnés : ils se recalculent à
--     partir des gagnants déjà enregistrés (bingo_claims). Après une panne ou
--     un rechargement, le lot en jeu est donc toujours juste ;
--   - bingo_public_state, bingo_claim, bingo_admin remplacées par le texte
--     de 20261120 / 20261119 repris à l'identique, avec ces seuls ajouts :
--       * état public : lots, lotsUsed, phaseDone, advance, lastWinAt,
--         numéro de lot de chaque gagnant ;
--       * settings.tie = 'shared' (défaut, ex aequo d'une même boule = un
--         seul lot) | 'each' (chacun un lot) ;
--       * settings.repeatCard (défaut faux) : un même carton peut regagner
--         dans une étape à plusieurs lots, avec de NOUVELLES lignes ;
--       * settings.advance = 'manual' (défaut) | 'auto' (8 s après le
--         dernier gagnant) ;
--       * « continuer l'étape » refusé quand tous ses lots sont gagnés ;
--       * next_phase / advance / jump_final {expect} : jamais deux étapes
--         d'un coup, jamais avec une demande en attente de vérification
--         (avant : les demandes en attente étaient refusées d'office) ;
--       * lancement / réglages : {lots: [n, …]} (1 à 20 par étape).
--       * new_game / new_round sur une partie existante = nouvelle partie
--         de la SOIRÉE : mêmes joueurs, mêmes cartons (téléphones et
--         papier), même playlist ; tirage, demandes et coches remis à
--         zéro, formule et réglages modifiables. AVANT : new_game
--         effaçait joueurs et cartons téléphone. Seul exit les efface.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Nombre de lots par étape (même ordre que phases). Vide = 1 partout.
-- ---------------------------------------------------------------------
ALTER TABLE public.bingo_runtime
  ADD COLUMN IF NOT EXISTS phase_lots smallint[] NOT NULL DEFAULT '{}'
  CHECK (cardinality(phase_lots) <= 3 AND 1 <= ALL (phase_lots) AND 20 >= ALL (phase_lots));

-- ---------------------------------------------------------------------
-- 2. Petites fonctions de calcul (serveur seulement).
-- ---------------------------------------------------------------------
-- Lots déjà gagnés dans une étape : un lot par boule gagnante (ex aequo
-- partagés) ou un lot par gagnant (settings.tie = 'each').
CREATE OR REPLACE FUNCTION public.bingo_lots_used(p_game_id uuid, p_round integer, p_phase text, p_shared boolean)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN p_shared THEN count(DISTINCT draw_count) ELSE count(*) END::integer
    FROM public.bingo_claims
   WHERE game_id = p_game_id AND round_no = p_round AND phase = p_phase AND status = 'accepted';
$$;

-- Étape en cours terminée (tous ses lots gagnés) ?
CREATE OR REPLACE FUNCTION public.bingo_phase_done(r public.bingo_runtime)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT r.phase_index < cardinality(r.phases)
     AND public.bingo_lots_used(r.game_id, r.round_no, r.phases[r.phase_index + 1],
                                coalesce(r.settings ->> 'tie', 'shared') <> 'each')
         >= coalesce(r.phase_lots[r.phase_index + 1], 1);
$$;

-- Lecture de {lots: [n, …]} : absent = 1 lot par étape ; sinon un nombre
-- (1 à 20) par étape, sinon refus.
CREATE OR REPLACE FUNCTION public.bingo_parse_lots(p_lots jsonb, p_phases integer)
RETURNS smallint[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v smallint[];
BEGIN
  IF p_lots IS NULL OR jsonb_typeof(p_lots) = 'null' THEN
    RETURN '{}';
  END IF;
  IF jsonb_typeof(p_lots) <> 'array' OR jsonb_array_length(p_lots) <> p_phases
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_lots) e WHERE jsonb_typeof(e) <> 'number') THEN
    RAISE EXCEPTION 'invalid';
  END IF;
  v := ARRAY(SELECT (e #>> '{}')::smallint FROM jsonb_array_elements(p_lots) WITH ORDINALITY AS t(e, i) ORDER BY i);
  IF NOT (1 <= ALL (v) AND 20 >= ALL (v)) THEN
    RAISE EXCEPTION 'invalid';
  END IF;
  RETURN v;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. État public (texte de 20261120 + lots).
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
  v_phase   text;
  v_shared  boolean;
  v_used    integer;
  v_lot_n   integer;
  v_win_at  timestamptz;
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

  -- Lots : étape en cours, lots déjà gagnés (ex aequo d'une même boule = un
  -- seul lot, sauf réglage « chacun un lot »), dernier gagnant validé.
  v_phase  := CASE WHEN r.phase_index < cardinality(r.phases) THEN r.phases[r.phase_index + 1] END;
  v_shared := coalesce(r.settings ->> 'tie', 'shared') <> 'each';
  v_lot_n  := coalesce(r.phase_lots[r.phase_index + 1], 1);
  v_used   := public.bingo_lots_used(r.game_id, r.round_no, v_phase, v_shared);
  SELECT max(decided_at) INTO v_win_at FROM public.bingo_claims
   WHERE game_id = r.game_id AND round_no = r.round_no AND phase = v_phase AND status = 'accepted';

  SELECT count(*) INTO v_players FROM public.bingo_players WHERE game_id = r.game_id;
  SELECT count(*) INTO v_pending FROM public.bingo_claims
   WHERE session_id = p_session_id AND game_id = r.game_id AND round_no = r.round_no AND status = 'pending';
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'phase', w.phase, 'serial', w.serial, 'kind', w.kind,
           'name', w.display_name, 'lines', w.complete_lines, 'drawCount', w.draw_count, 'lot', w.lot
         ) ORDER BY w.decided_at, w.id), '[]'::jsonb)
    INTO v_winners
    FROM (SELECT cl.id, cl.phase, cl.display_name, cl.complete_lines, cl.draw_count, cl.decided_at, ca.serial, ca.kind,
                 CASE WHEN v_shared THEN dense_rank() OVER (PARTITION BY cl.phase ORDER BY cl.draw_count)
                      ELSE row_number() OVER (PARTITION BY cl.phase ORDER BY cl.decided_at, cl.id) END AS lot
            FROM public.bingo_claims cl JOIN public.bingo_cards ca ON ca.id = cl.card_id
           WHERE cl.session_id = p_session_id AND cl.game_id = r.game_id AND cl.round_no = r.round_no AND cl.status = 'accepted') w;

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
    'lots', to_jsonb(ARRAY(SELECT coalesce(r.phase_lots[i], 1) FROM generate_subscripts(r.phases, 1) AS i ORDER BY i)),
    'lotsUsed', v_used,
    'phaseDone', v_phase IS NOT NULL AND v_used >= v_lot_n,
    'advance', CASE WHEN r.settings ->> 'advance' = 'auto' THEN 'auto' ELSE 'manual' END,
    'lastWinAt', v_win_at,
    'paused', r.heartbeat_at < clock_timestamp() - interval '90 seconds',
    'serverNow', clock_timestamp()
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Demande de quine du téléphone (texte de 20261119 + « même carton
--    deux fois »).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_claim(
  p_session_id uuid,
  p_player_id  uuid,
  p_token_hash text,
  p_card_id    uuid,
  p_marks      smallint[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r       public.bingo_runtime;
  v_cells smallint[];
  v_name  text;
  v_id    bigint;
  v_pause boolean;
  v_lines smallint;
  v_prev  smallint;
  v_need  smallint;
BEGIN
  SELECT * INTO r FROM public.bingo_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;
  IF r.status NOT IN ('running', 'checking', 'celebrating') OR r.phase_index >= cardinality(r.phases) THEN
    RAISE EXCEPTION 'not_running';
  END IF;

  SELECT p.display_name, c.cells INTO v_name, v_cells
    FROM public.bingo_players p JOIN public.bingo_cards c ON c.player_id = p.id
   WHERE p.id = p_player_id AND p.game_id = r.game_id AND p.token_hash = p_token_hash AND c.id = p_card_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_id FROM public.bingo_claims WHERE card_id = p_card_id AND round_no = r.round_no AND status = 'pending';
  IF FOUND THEN
    RETURN jsonb_build_object('claimId', v_id, 'status', 'pending', 'already', true);
  END IF;
  -- Demande renvoyée après une coupure alors qu'elle a déjà été validée pour
  -- cette phase : on renvoie la décision, sans créer de doublon.
  -- Étape à plusieurs lots avec « même carton deux fois » (settings.repeatCard) :
  -- une nouvelle victoire exige de nouvelles lignes complètes.
  v_lines := public.bingo_complete_lines(v_cells, r.drawn);
  v_need  := CASE r.phases[r.phase_index + 1] WHEN 'quine' THEN 1 WHEN 'double' THEN 2 ELSE 3 END;
  SELECT max(complete_lines), max(id) INTO v_prev, v_id FROM public.bingo_claims
   WHERE card_id = p_card_id AND round_no = r.round_no AND status = 'accepted' AND phase = r.phases[r.phase_index + 1];
  IF v_prev IS NOT NULL AND (NOT coalesce((r.settings ->> 'repeatCard')::boolean, false) OR v_lines < v_prev + v_need) THEN
    RETURN jsonb_build_object('claimId', v_id, 'status', 'accepted', 'already', true);
  END IF;
  IF EXISTS (SELECT 1 FROM public.bingo_claims
              WHERE card_id = p_card_id AND round_no = r.round_no AND status = 'rejected'
                AND decided_at > clock_timestamp() - interval '5 seconds') THEN
    RAISE EXCEPTION 'cooldown';
  END IF;

  INSERT INTO public.bingo_claims (session_id, game_id, round_no, phase, card_id, player_id, display_name, draw_count, marks, complete_lines)
  VALUES (p_session_id, r.game_id, r.round_no, r.phases[r.phase_index + 1], p_card_id, p_player_id, v_name,
          cardinality(r.drawn), coalesce(p_marks, '{}'), v_lines)
  RETURNING id INTO v_id;

  v_pause := coalesce((r.settings ->> 'pauseOnClaim')::boolean, true);
  UPDATE public.bingo_runtime
     SET status = CASE WHEN v_pause AND status = 'running' THEN 'checking' ELSE status END,
         auto_mode = CASE WHEN v_pause AND auto_mode = 'auto' THEN 'paused' ELSE auto_mode END,
         version = version + 1, updated_at = now()
   WHERE session_id = p_session_id;
  PERFORM public.bingo_notify(p_session_id);
  RETURN jsonb_build_object('claimId', v_id, 'status', 'pending');
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Régie (texte de 20261120 + lots, passage d'étape, saut au carton plein).
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

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  UPDATE public.bingo_runtime SET version = version + 1, updated_at = v_now, heartbeat_at = v_now WHERE session_id = p_session_id;
  PERFORM public.bingo_notify(p_session_id);
  RETURN public.bingo_public_state(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Droits : fonctions serveur uniquement.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.bingo_lots_used(uuid, integer, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_phase_done(public.bingo_runtime) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_parse_lots(jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_public_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_claim(uuid, uuid, text, uuid, smallint[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_lots_used(uuid, integer, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_phase_done(public.bingo_runtime) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_parse_lots(jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_public_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_claim(uuid, uuid, text, uuid, smallint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_admin(uuid, text, jsonb) TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) : supabase/verif_20261121_bingo_lots.sql
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- 1. Réexécuter la section 11 (bingo_claim) de 20261119_create_bingo.sql,
--    puis les sections 4 (bingo_public_state) et 5 (bingo_admin) de
--    20261120_bingo_musical.sql : logique d'avant rétablie.
-- 2. Puis :
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.bingo_phase_done(public.bingo_runtime);
-- DROP FUNCTION IF EXISTS public.bingo_lots_used(uuid, integer, text, boolean);
-- DROP FUNCTION IF EXISTS public.bingo_parse_lots(jsonb, integer);
-- ALTER TABLE public.bingo_runtime DROP COLUMN IF EXISTS phase_lots;
-- COMMIT;
-- ---------------------------------------------------------------------
