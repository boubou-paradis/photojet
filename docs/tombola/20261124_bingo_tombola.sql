-- =====================================================================
-- ANIMABINGO — MODE TOMBOLA - AnimaJet
-- Migration ADDITIVE. À exécuter dans Supabase > SQL Editor, APRÈS
-- 20261122_bingo_formule_direct.sql et 20261123_music_requests.sql.
-- Vérification ensuite : supabase/verif_20261124_bingo_tombola.sql.
--
-- Garanties :
--   - 3 tables NOUVELLES, FERMÉES (RLS sans policy, droits retirés à anon et
--     authenticated) : seul le serveur (service_role) les lit et les écrit ;
--   - rien sur sessions (aucune colonne, aucun trigger). La tombola utilise
--     la colonne existante bingo_active (« AnimaBingo à l'écran ») exactement
--     comme le loto : même extinction des autres jeux au lancement ;
--   - AUCUNE fonction ni table du loto modifiée : bingo_runtime, bingo_admin,
--     bingo_public_state, bingo_cards… restent tels quels. Le loto classique
--     et le loto musical fonctionnent exactement comme avant ;
--   - un seul jeu AnimaBingo à la fois : la tombola refuse de démarrer tant
--     qu'un loto existe (« loto_running ») ; le serveur refuse le loto tant
--     qu'une tombola existe ;
--   - tout est en base (plages papier, tickets téléphone, numéros sortis,
--     gagnants, absents) : une régie rouverte, un téléphone rechargé ou un
--     autre jeu lancé entre-temps retrouvent la tombola à l'identique ;
--   - un numéro ne sort qu'une fois : contrainte UNIQUE (tombola, numéro) ;
--     tirage sous verrou de la ligne tombola (jamais deux numéros pour un
--     double clic : {expect} = nombre de numéros déjà sortis) ;
--   - numéros papier et téléphone jamais en conflit : les plages papier
--     restent sous le premier numéro téléphone (vérifié à chaque réglage) ;
--   - pas de temps réel sur les téléphones : ils lisent l'état public mis en
--     cache 1 s, toutes les 3 s. Écran et régie : canal privé existant
--     « bingo:<session> », événement « tombola » (policy existante, réception
--     seulement, seul le serveur diffuse).
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Tombola en cours (1 ligne par session).
--    tombola_id : change à chaque nouvelle tombola (le téléphone sait si son
--                 ticket appartient bien à celle-ci).
--    paper      : numéros papier distribués (une ou plusieurs plages).
--    phone_from : premier numéro téléphone (NULL = pas de tickets téléphone).
--    next_phone : prochain numéro téléphone à donner.
--    phone_open : distribution ouverte (fermée automatiquement au 1er tirage,
--                 « Rouvrir » dans la régie pour les retardataires).
--    reveal_at  : instant où le numéro tiré apparaît (suspense de 0,9 s,
--                 comme le loto) ; avant, ni écran ni téléphone ne le voient.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_tombola (
  session_id   uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  tombola_id   uuid NOT NULL DEFAULT gen_random_uuid(),
  version      bigint NOT NULL DEFAULT 1,
  status       text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'running')),
  paper        int4multirange NOT NULL DEFAULT '{}'
               CHECK (paper <@ int4multirange(int4range(1, 10000))),
  phone_from   integer CHECK (phone_from IS NULL OR phone_from BETWEEN 1 AND 9999),
  next_phone   integer CHECK (next_phone IS NULL OR next_phone BETWEEN 1 AND 10000),
  phone_open   boolean NOT NULL DEFAULT true,
  settings     jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 4000),
  last_draw_at timestamptz,
  reveal_at    timestamptz,
  launched_at  timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bingo_tombola_tombola_id_key UNIQUE (tombola_id),
  -- Papier toujours SOUS les numéros téléphone : aucun conflit possible.
  CONSTRAINT bingo_tombola_no_overlap CHECK (phone_from IS NULL OR NOT (paper && int4multirange(int4range(phone_from, NULL))))
);

CREATE INDEX IF NOT EXISTS bingo_tombola_heartbeat_idx ON public.bingo_tombola (heartbeat_at);

-- ---------------------------------------------------------------------
-- 2. Tickets téléphone : 1 par téléphone (jeton gardé par le téléphone,
--    seule son empreinte SHA-256 est stockée). Aucune donnée personnelle.
--    Effacés avec la tombola.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_tombola_tickets (
  tombola_id uuid NOT NULL REFERENCES public.bingo_tombola(tombola_id) ON DELETE CASCADE,
  number     integer NOT NULL CHECK (number BETWEEN 1 AND 9999),
  token_hash text NOT NULL CHECK (char_length(token_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tombola_id, number),
  CONSTRAINT bingo_tombola_tickets_token_key UNIQUE (tombola_id, token_hash)
);

-- ---------------------------------------------------------------------
-- 3. Numéros sortis, dans l'ordre (seq = 1, 2, 3…).
--    outcome : winner (gagnant, par défaut) | absent | already (déjà
--    gagnant). Le numéro de lot n'est PAS stocké : lot = rang parmi les
--    gagnants (recalculé), donc toujours juste après « Absent ».
--    UNIQUE (tombola_id, number) : un numéro ne sort jamais deux fois.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_tombola_draws (
  tombola_id uuid NOT NULL REFERENCES public.bingo_tombola(tombola_id) ON DELETE CASCADE,
  seq        integer NOT NULL CHECK (seq BETWEEN 1 AND 10000),
  number     integer NOT NULL CHECK (number BETWEEN 1 AND 9999),
  outcome    text NOT NULL DEFAULT 'winner' CHECK (outcome IN ('winner', 'absent', 'already')),
  drawn_at   timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  PRIMARY KEY (tombola_id, seq),
  CONSTRAINT bingo_tombola_draws_number_key UNIQUE (tombola_id, number)
);

-- ---------------------------------------------------------------------
-- 4. Tables fermées.
-- ---------------------------------------------------------------------
ALTER TABLE public.bingo_tombola         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_tombola_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_tombola_draws   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bingo_tombola, public.bingo_tombola_tickets, public.bingo_tombola_draws FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Plages papier : [[1,250],[400,450]] → multirange. 1 à 20 plages,
--    numéros 1 à 9999. Erreur 'invalid' sinon.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_tombola_parse_ranges(p jsonb)
RETURNS int4multirange
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v  int4multirange := '{}';
  e  jsonb;
  a  integer;
  b  integer;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) > 20 THEN RAISE EXCEPTION 'invalid'; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(e) <> 'array' OR jsonb_array_length(e) <> 2 THEN RAISE EXCEPTION 'invalid'; END IF;
    a := (e ->> 0)::integer;
    b := (e ->> 1)::integer;
    IF a IS NULL OR b IS NULL OR a < 1 OR b > 9999 OR a > b THEN RAISE EXCEPTION 'invalid'; END IF;
    v := v + int4multirange(int4range(a, b, '[]'));
  END LOOP;
  RETURN v;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. État public (écran, téléphones, régie). Le numéro en cours de
--    révélation (reveal_at futur) reste caché, comme le loto.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_tombola_public_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t         public.bingo_tombola;
  v_hidden  boolean;
  v_draws   jsonb;
  v_n_draws integer;
  v_phones  integer;
  v_paper   integer;
BEGIN
  SELECT * INTO t FROM public.bingo_tombola WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;
  v_hidden := t.reveal_at IS NOT NULL AND t.reveal_at > clock_timestamp();
  SELECT count(*) INTO v_n_draws FROM public.bingo_tombola_draws WHERE tombola_id = t.tombola_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('seq', d.seq, 'n', d.number, 'o', d.outcome,
                                               'lot', CASE WHEN d.outcome = 'winner' THEN d.lot END) ORDER BY d.seq), '[]'::jsonb)
    INTO v_draws
    FROM (SELECT seq, number, outcome,
                 count(*) FILTER (WHERE outcome = 'winner') OVER (ORDER BY seq) AS lot
            FROM public.bingo_tombola_draws WHERE tombola_id = t.tombola_id) d
   WHERE NOT (v_hidden AND d.seq = v_n_draws);
  SELECT count(*) INTO v_phones FROM public.bingo_tombola_tickets WHERE tombola_id = t.tombola_id;
  SELECT coalesce(sum(upper(r) - lower(r)), 0) INTO v_paper FROM unnest(t.paper) AS r;

  RETURN jsonb_build_object(
    'active', true,
    'mode', 'tombola',
    'v', t.version,
    'tombolaId', t.tombola_id,
    'status', t.status,
    'paper', (SELECT coalesce(jsonb_agg(jsonb_build_array(lower(r), upper(r) - 1) ORDER BY lower(r)), '[]'::jsonb) FROM unnest(t.paper) AS r),
    'paperCount', v_paper,
    'phoneFrom', t.phone_from,
    'phoneCount', v_phones,
    'phoneOpen', t.phone_open AND t.phone_from IS NOT NULL,
    'total', v_paper + v_phones,
    'left', v_paper + v_phones - v_n_draws,
    'draws', v_draws,
    'hidden', v_hidden,
    'lastDrawAt', t.last_draw_at,
    'revealAt', CASE WHEN v_hidden THEN NULL ELSE t.reveal_at END,
    'display', coalesce(t.settings -> 'public', '{}'::jsonb),
    'paused', t.heartbeat_at < clock_timestamp() - interval '90 seconds',
    'serverNow', clock_timestamp()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bingo_tombola_notify(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.bingo_tombola_public_state(p_session_id), 'tombola', 'bingo:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AnimaBingo tombola] diffusion impossible : %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 7. Ticket téléphone (serveur seulement, après lecture du jeton).
--    Idempotent : le même jeton retrouve TOUJOURS son numéro (même tickets
--    fermés, même tombola en pause). Renvoie {tombolaId, number}.
--    Erreurs : no_game | no_phone | closed | full.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_tombola_ticket(p_session_id uuid, p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t     public.bingo_tombola;
  v_num integer;
BEGIN
  SELECT * INTO t FROM public.bingo_tombola WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_game'; END IF;
  SELECT number INTO v_num FROM public.bingo_tombola_tickets WHERE tombola_id = t.tombola_id AND token_hash = p_token_hash;
  IF v_num IS NULL THEN
    IF t.phone_from IS NULL THEN RAISE EXCEPTION 'no_phone'; END IF;
    IF NOT t.phone_open THEN RAISE EXCEPTION 'closed'; END IF;
    IF t.next_phone > 9999 OR (SELECT count(*) FROM public.bingo_tombola_tickets WHERE tombola_id = t.tombola_id) >= 2000 THEN
      RAISE EXCEPTION 'full';
    END IF;
    v_num := t.next_phone;
    INSERT INTO public.bingo_tombola_tickets (tombola_id, number, token_hash) VALUES (t.tombola_id, v_num, p_token_hash);
    UPDATE public.bingo_tombola SET next_phone = v_num + 1, version = version + 1, updated_at = now() WHERE session_id = p_session_id;
  END IF;
  RETURN jsonb_build_object('tombolaId', t.tombola_id, 'number', v_num);
END;
$$;

-- ---------------------------------------------------------------------
-- 8. Régie (serveur seulement, propriétaire vérifié par la route).
--    launch    {paper, phoneFrom|null} : crée, ou REPREND la tombola
--              existante telle quelle (rien n'est effacé).
--    exit      : termine et efface la tombola (double confirmation).
--    heartbeat : signal de vie de la régie (90 s), comme le loto.
--    config    {paper, phoneFrom|null} : avant le 1er tirage, libre ;
--              après, plages papier seulement AJOUTÉES (jamais retirées).
--              Premier numéro téléphone figé dès le premier ticket.
--    phones    {open} : ouvrir / fermer la distribution des tickets.
--    draw      {expect} : tire un numéro parmi ceux distribués et pas
--              encore sortis. Ferme la distribution au 1er tirage.
--    mark      {seq, outcome} : DERNIER numéro sorti seulement :
--              absent | already (on peut retirer) | winner (annuler).
--    display   {settings} : réglages d'affichage (settings.public).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_tombola_admin(
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
  t        public.bingo_tombola;
  v_paper  int4multirange;
  v_from   integer;
  v_count  integer;
  v_left   bigint;   -- nombre au hasard (64 bits)
  v_pick   integer;
  v_last   integer;
BEGIN
  p_args := coalesce(p_args, '{}'::jsonb);

  IF p_action = 'launch' THEN
    -- Un seul jeu AnimaBingo à la fois : un loto existant doit d'abord être quitté.
    IF EXISTS (SELECT 1 FROM public.bingo_runtime WHERE session_id = p_session_id) THEN RAISE EXCEPTION 'loto_running'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.bingo_tombola WHERE session_id = p_session_id) THEN
      v_paper := public.bingo_tombola_parse_ranges(coalesce(p_args -> 'paper', '[]'::jsonb));
      v_from  := (p_args ->> 'phoneFrom')::integer;
      IF v_paper = '{}'::int4multirange AND v_from IS NULL THEN RAISE EXCEPTION 'invalid'; END IF;  -- aucun ticket
      INSERT INTO public.bingo_tombola (session_id, paper, phone_from, next_phone, launched_at, updated_at, heartbeat_at)
      VALUES (p_session_id, v_paper, v_from, v_from, v_now, v_now, v_now);
    ELSE
      UPDATE public.bingo_tombola SET version = version + 1, updated_at = v_now, heartbeat_at = v_now WHERE session_id = p_session_id;
    END IF;
    UPDATE public.sessions
       SET bingo_active = true,
           quiz_active = false, quiz_lobby_visible = false, lineup_active = false,
           wheel_active = false, mystery_photo_active = false, affinity_active = false,
           buzzer_active = false, vote_active = false, demimot_active = false
     WHERE id = p_session_id;
    PERFORM public.bingo_tombola_notify(p_session_id);
    RETURN public.bingo_tombola_public_state(p_session_id);
  END IF;

  IF p_action = 'exit' THEN
    DELETE FROM public.bingo_tombola WHERE session_id = p_session_id;      -- tickets et tirages : en cascade
    IF NOT EXISTS (SELECT 1 FROM public.bingo_runtime WHERE session_id = p_session_id) THEN
      UPDATE public.sessions SET bingo_active = false WHERE id = p_session_id AND bingo_active;
    END IF;
    PERFORM public.bingo_tombola_notify(p_session_id);
    RETURN jsonb_build_object('active', false, 'serverNow', v_now);
  END IF;

  SELECT * INTO t FROM public.bingo_tombola WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_game'; END IF;
  SELECT count(*) INTO v_count FROM public.bingo_tombola_draws WHERE tombola_id = t.tombola_id;

  IF p_action = 'heartbeat' THEN
    IF t.heartbeat_at >= v_now - interval '90 seconds' THEN
      UPDATE public.bingo_tombola SET heartbeat_at = v_now WHERE session_id = p_session_id;
      RETURN jsonb_build_object('v', t.version, 'resumed', false);
    END IF;
    UPDATE public.bingo_tombola SET heartbeat_at = v_now, version = version + 1, updated_at = v_now WHERE session_id = p_session_id;
    PERFORM public.bingo_tombola_notify(p_session_id);
    RETURN jsonb_build_object('v', t.version + 1, 'resumed', true);

  ELSIF p_action = 'config' THEN
    v_paper := public.bingo_tombola_parse_ranges(coalesce(p_args -> 'paper', '[]'::jsonb));
    v_from  := (p_args ->> 'phoneFrom')::integer;
    IF v_count > 0 AND NOT (v_paper @> t.paper) THEN RAISE EXCEPTION 'invalid'; END IF;          -- tirage commencé : ajouts seulement
    IF EXISTS (SELECT 1 FROM public.bingo_tombola_tickets WHERE tombola_id = t.tombola_id)
       AND v_from IS DISTINCT FROM t.phone_from THEN
      RAISE EXCEPTION 'invalid';                                                                   -- tickets déjà donnés : départ figé
    END IF;
    IF v_from IS NOT NULL AND v_paper && int4multirange(int4range(v_from, NULL)) THEN RAISE EXCEPTION 'overlap'; END IF;
    IF v_paper = '{}'::int4multirange AND v_from IS NULL THEN RAISE EXCEPTION 'invalid'; END IF;
    UPDATE public.bingo_tombola
       SET paper = v_paper, phone_from = v_from,
           next_phone = CASE WHEN v_from IS DISTINCT FROM phone_from THEN v_from ELSE next_phone END
     WHERE session_id = p_session_id;

  ELSIF p_action = 'phones' THEN
    -- « Rouvrir » reste possible après le 1er tirage (retardataires).
    UPDATE public.bingo_tombola SET phone_open = coalesce((p_args ->> 'open')::boolean, phone_open) WHERE session_id = p_session_id;

  ELSIF p_action = 'draw' THEN
    IF (p_args ->> 'expect')::integer IS DISTINCT FROM v_count THEN
      RETURN public.bingo_tombola_public_state(p_session_id);                                     -- déjà tiré : sans effet
    END IF;
    IF t.last_draw_at > v_now - interval '2500 milliseconds' THEN RAISE EXCEPTION 'too_fast'; END IF;
    -- Numéros distribués (papier + téléphone) moins ceux déjà sortis ; au plus
    -- 9 999 numéros : calcul instantané. Hasard fort (gen_random_uuid repose
    -- sur pg_strong_random), comme le loto.
    v_left := ('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 16, '0'))::bit(64)::bigint;
    WITH pool AS MATERIALIZED (
      SELECT g AS n FROM unnest(t.paper) AS r, generate_series(lower(r), upper(r) - 1) AS g
      UNION
      SELECT number FROM public.bingo_tombola_tickets WHERE tombola_id = t.tombola_id
      EXCEPT
      SELECT number FROM public.bingo_tombola_draws WHERE tombola_id = t.tombola_id
    )
    SELECT x.n INTO v_pick
      FROM (SELECT n, row_number() OVER (ORDER BY n) - 1 AS i, count(*) OVER () AS c FROM pool) x
     WHERE x.i = v_left % x.c;
    IF v_pick IS NULL THEN RAISE EXCEPTION 'empty'; END IF;                                        -- tous les numéros sont sortis
    INSERT INTO public.bingo_tombola_draws (tombola_id, seq, number, drawn_at) VALUES (t.tombola_id, v_count + 1, v_pick, v_now);
    UPDATE public.bingo_tombola
       SET status = 'running', phone_open = false, last_draw_at = v_now, reveal_at = v_now + interval '900 milliseconds'
     WHERE session_id = p_session_id;

  ELSIF p_action = 'mark' THEN
    IF coalesce(p_args ->> 'outcome', '') <> ALL (ARRAY['winner', 'absent', 'already']) THEN RAISE EXCEPTION 'invalid'; END IF;
    SELECT max(seq) INTO v_last FROM public.bingo_tombola_draws WHERE tombola_id = t.tombola_id;
    IF v_last IS NULL OR (p_args ->> 'seq')::integer IS DISTINCT FROM v_last THEN RAISE EXCEPTION 'not_last'; END IF;
    UPDATE public.bingo_tombola_draws
       SET outcome = p_args ->> 'outcome', decided_at = v_now
     WHERE tombola_id = t.tombola_id AND seq = v_last AND outcome IS DISTINCT FROM p_args ->> 'outcome';
    IF NOT FOUND THEN RETURN public.bingo_tombola_public_state(p_session_id); END IF;              -- déjà fait : sans effet

  ELSIF p_action = 'display' THEN
    IF jsonb_typeof(p_args -> 'settings') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid'; END IF;
    UPDATE public.bingo_tombola SET settings = p_args -> 'settings' WHERE session_id = p_session_id;

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  UPDATE public.bingo_tombola SET version = version + 1, updated_at = v_now, heartbeat_at = v_now WHERE session_id = p_session_id;
  PERFORM public.bingo_tombola_notify(p_session_id);
  RETURN public.bingo_tombola_public_state(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 9. Purge (cron purge-bingo existant, appel ajouté) : tombola sans
--    activité depuis 24 h, comme le loto.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_tombola_purge_stale()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(session_id), '{}') INTO v_ids
    FROM public.bingo_tombola
   WHERE greatest(heartbeat_at, updated_at, launched_at) < clock_timestamp() - interval '24 hours';
  IF cardinality(v_ids) = 0 THEN RETURN jsonb_build_object('tombolas', 0); END IF;
  DELETE FROM public.bingo_tombola WHERE session_id = ANY (v_ids);
  UPDATE public.sessions s SET bingo_active = false
   WHERE s.id = ANY (v_ids) AND s.bingo_active
     AND NOT EXISTS (SELECT 1 FROM public.bingo_runtime b WHERE b.session_id = s.id);
  RETURN jsonb_build_object('tombolas', cardinality(v_ids));
END;
$$;

-- ---------------------------------------------------------------------
-- 10. Droits : fonctions serveur uniquement.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.bingo_tombola_parse_ranges(jsonb)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_tombola_public_state(uuid)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_tombola_notify(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_tombola_ticket(uuid, text)           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_tombola_admin(uuid, text, jsonb)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_tombola_purge_stale()                FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bingo_tombola_parse_ranges(jsonb)       TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_tombola_public_state(uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_tombola_ticket(uuid, text)        TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_tombola_admin(uuid, text, jsonb)  TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_tombola_purge_stale()             TO service_role;

COMMIT;

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite). Le loto n'est
-- pas concerné : rien de ce qui précède ne le modifie.
-- ---------------------------------------------------------------------
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.bingo_tombola_purge_stale();
-- DROP FUNCTION IF EXISTS public.bingo_tombola_admin(uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.bingo_tombola_ticket(uuid, text);
-- DROP FUNCTION IF EXISTS public.bingo_tombola_notify(uuid);
-- DROP FUNCTION IF EXISTS public.bingo_tombola_public_state(uuid);
-- DROP FUNCTION IF EXISTS public.bingo_tombola_parse_ranges(jsonb);
-- UPDATE public.sessions s SET bingo_active = false
--  WHERE s.bingo_active AND EXISTS (SELECT 1 FROM public.bingo_tombola t WHERE t.session_id = s.id)
--    AND NOT EXISTS (SELECT 1 FROM public.bingo_runtime b WHERE b.session_id = s.id);
-- DROP TABLE IF EXISTS public.bingo_tombola_draws;
-- DROP TABLE IF EXISTS public.bingo_tombola_tickets;
-- DROP TABLE IF EXISTS public.bingo_tombola;
-- COMMIT;
