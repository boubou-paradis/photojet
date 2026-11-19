-- =====================================================================
-- ANIMABINGO (identifiant technique : bingo) - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Garanties :
--   - une seule colonne ajoutée à sessions (bingo_active, défaut false) ;
--     aucun trigger sur sessions ; le signal de vie est dans bingo_runtime ;
--   - partie, joueurs, cartons et demandes vivent dans des tables FERMÉES
--     (RLS sans policy, droits retirés à anon et authenticated) ;
--   - AUCUNE fonction n'est ouverte aux téléphones : tout passe par les
--     routes du serveur (clé service_role), qui vérifient le jeton du joueur ;
--   - LÉGÈRETÉ : les téléphones n'ouvrent aucune connexion temps réel. Ils
--     lisent l'état public (mis en cache 1 s par le CDN) toutes les 3 s.
--     Leurs coches restent sur le téléphone et ne sont envoyées qu'avec une
--     demande de quine. Aucune écriture par boule et par joueur ;
--   - temps réel réservé à l'écran géant et à la régie : canal PRIVÉ
--     « bingo:<session> », réception seulement, seul le serveur diffuse ;
--   - tables hors publication realtime : leurs écritures ne notifient personne.
--
-- Partage des rôles :
--   - le serveur (TypeScript) fabrique les cartons (séries de 6 conformes au
--     loto français) et calcule le détail des vérifications pour la régie ;
--   - la base tranche tout ce qui doit être atomique : tirage (hasard tiré
--     ici, sous le verrou de la partie, jamais deux boules pour un double
--     clic), attribution des numéros de carton, demandes de quine, décisions.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Colonne publique sur sessions : « AnimaBingo est lancé ».
-- ---------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS bingo_active boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 2. Partie en cours (1 ligne par session), verrouillée (FOR UPDATE) par
--    chaque action. La ligne sessions n'est jamais verrouillée.
--    game_id  : change à chaque lancement (nouveaux joueurs et cartons).
--    round_no : « Nouvelle partie » garde joueurs et cartons, remet le
--               tirage à zéro.
--    settings : réglages (validés par le serveur). settings.public = ce que
--               l'écran et les téléphones peuvent lire (dernier numéro
--               affiché, surnoms...).
--    phases   : ordre choisi parmi quine (1 ligne), double (2), plein (3).
--    status   : lobby | running | checking (demande en vérification) |
--               celebrating | finished.
--    reveal_at: instant où le numéro tiré est face au public (voix et
--               image synchronisées sur cette heure).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_runtime (
  session_id    uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id       uuid NOT NULL,
  round_no      integer NOT NULL DEFAULT 1 CHECK (round_no >= 1),
  version       bigint NOT NULL DEFAULT 1,
  settings      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 20000),
  phases        text[] NOT NULL DEFAULT '{quine,double,plein}'
                CHECK (cardinality(phases) BETWEEN 1 AND 3 AND phases <@ ARRAY['quine','double','plein']::text[]),
  phase_index   smallint NOT NULL DEFAULT 0 CHECK (phase_index BETWEEN 0 AND 3),
  status        text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'running', 'checking', 'celebrating', 'finished')),
  drawn         smallint[] NOT NULL DEFAULT '{}' CHECK (cardinality(drawn) <= 90),
  auto_mode     text NOT NULL DEFAULT 'manual' CHECK (auto_mode IN ('manual', 'auto', 'paused')),
  auto_ms       integer NOT NULL DEFAULT 8000 CHECK (auto_ms BETWEEN 4000 AND 20000),
  next_serial   integer NOT NULL DEFAULT 1 CHECK (next_serial BETWEEN 1 AND 5000),
  last_draw_at  timestamptz,
  reveal_at     timestamptz,
  launched_at   timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  heartbeat_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bingo_runtime_heartbeat_idx ON public.bingo_runtime (heartbeat_at);

-- ---------------------------------------------------------------------
-- 3. Joueurs (téléphones). token_hash = SHA-256 du jeton gardé par le
--    téléphone : c'est lui qui permet de retrouver ses cartons et de
--    réclamer une quine. Aucun suivi de présence.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_players (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id      uuid NOT NULL,
  token_hash   text NOT NULL CHECK (char_length(token_hash) = 64),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 20),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bingo_players_game_token_key UNIQUE (game_id, token_hash)
);

CREATE INDEX IF NOT EXISTS bingo_players_session_idx ON public.bingo_players (session_id);

-- ---------------------------------------------------------------------
-- 4. Cartons. cells = 27 cases lues ligne par ligne (0 = case vide).
--    Téléphone : rattaché à la partie (game_id), numéros 1 à 4999.
--    Papier    : rattaché à la SESSION (imprimé à l'avance, survit aux
--                relances), numéros à partir de 5001, game_id NULL.
--    signature : les 15 numéros triés, unique par partie / par session.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_cards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('phone', 'paper')),
  game_id    uuid,
  player_id  uuid REFERENCES public.bingo_players(id) ON DELETE CASCADE,
  serial     integer NOT NULL CHECK (serial BETWEEN 1 AND 9999),
  cells      smallint[] NOT NULL CHECK (cardinality(cells) = 27 AND 0 <= ALL (cells) AND 90 >= ALL (cells)),
  signature  text NOT NULL CHECK (char_length(signature) BETWEEN 29 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bingo_cards_shape_check CHECK (
    (kind = 'phone' AND game_id IS NOT NULL AND player_id IS NOT NULL AND serial < 5000)
    OR (kind = 'paper' AND game_id IS NULL AND player_id IS NULL AND serial > 5000))
);

CREATE UNIQUE INDEX IF NOT EXISTS bingo_cards_phone_serial_key ON public.bingo_cards (game_id, serial) WHERE kind = 'phone';
CREATE UNIQUE INDEX IF NOT EXISTS bingo_cards_phone_sig_key    ON public.bingo_cards (game_id, signature) WHERE kind = 'phone';
CREATE UNIQUE INDEX IF NOT EXISTS bingo_cards_paper_serial_key ON public.bingo_cards (session_id, serial) WHERE kind = 'paper';
CREATE UNIQUE INDEX IF NOT EXISTS bingo_cards_paper_sig_key    ON public.bingo_cards (session_id, signature) WHERE kind = 'paper';
CREATE INDEX IF NOT EXISTS bingo_cards_player_idx ON public.bingo_cards (player_id);

-- ---------------------------------------------------------------------
-- 5. Demandes de quine (et gagnants papier saisis par l'animateur).
--    draw_count     : nombre de boules sorties au moment de la demande
--                     (la vérification se fait sur ces boules-là).
--    complete_lines : lignes complètes à cet instant (calculé ici).
--    Une seule demande en attente par carton et par partie.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bingo_claims (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id     uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id        uuid NOT NULL,
  round_no       integer NOT NULL,
  phase          text NOT NULL CHECK (phase IN ('quine', 'double', 'plein')),
  card_id        uuid NOT NULL REFERENCES public.bingo_cards(id) ON DELETE CASCADE,
  player_id      uuid REFERENCES public.bingo_players(id) ON DELETE CASCADE,
  display_name   text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 20),
  draw_count     smallint NOT NULL CHECK (draw_count BETWEEN 0 AND 90),
  marks          smallint[] NOT NULL DEFAULT '{}' CHECK (cardinality(marks) <= 15 AND 1 <= ALL (marks) AND 90 >= ALL (marks)),
  complete_lines smallint NOT NULL CHECK (complete_lines BETWEEN 0 AND 3),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  decided_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS bingo_claims_one_pending_key ON public.bingo_claims (card_id, round_no) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS bingo_claims_session_idx ON public.bingo_claims (session_id, round_no);

-- ---------------------------------------------------------------------
-- 6. Tables fermées : aucune policy = aucun accès anon / authenticated.
-- ---------------------------------------------------------------------
ALTER TABLE public.bingo_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_cards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bingo_claims  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bingo_runtime, public.bingo_players, public.bingo_cards, public.bingo_claims
  FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Lignes complètes d'un carton pour une liste de boules sorties.
--    Pure ; utilisée pour les demandes et les cartons papier.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_complete_lines(p_cells smallint[], p_drawn smallint[])
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT count(*)::smallint
    FROM generate_series(0, 2) AS r
   WHERE NOT EXISTS (
     SELECT 1 FROM generate_series(1, 9) AS c
      WHERE p_cells[r * 9 + c] <> 0 AND NOT (p_cells[r * 9 + c] = ANY (p_drawn))
   );
$$;

-- ---------------------------------------------------------------------
-- 8. État public : ce que voient l'écran géant et les téléphones.
--    Identique pour tous (mis en cache par le CDN). Ni jeton, ni carton,
--    ni coche. Les gagnants (prénom ou numéro de carton) sont de toute
--    façon affichés sur l'écran géant.
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
BEGIN
  SELECT * INTO r FROM public.bingo_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;
  v_count := cardinality(r.drawn);

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
    'drawn', to_jsonb(r.drawn),
    'count', v_count,
    'last', CASE WHEN v_count > 0 THEN r.drawn[v_count] END,
    'lastDrawAt', r.last_draw_at,
    'revealAt', r.reveal_at,
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
-- 9. Diffusion sur le canal privé (écran + régie seulement). Un échec de
--    diffusion n'annule JAMAIS une action : les écrans relisent l'état.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_notify(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.bingo_public_state(p_session_id), 'state', 'bingo:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AnimaBingo] diffusion impossible : %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 10. Arrivée d'un joueur (serveur seulement). p_cards = tableau de 1 à 4
--     cartons {cells:[27], signature} fabriqués par le serveur. Idempotent :
--     le même jeton renvoie le joueur existant sans créer de carton.
--     Signature déjà prise → exception 'duplicate' (le serveur refabrique).
--     Renvoie {playerId, cards:[{id, serial, cells}]}.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_join(
  p_session_id uuid,
  p_token_hash text,
  p_name       text,
  p_cards      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r         public.bingo_runtime;
  v_player  uuid;
  v_n       integer;
  v_card    jsonb;
BEGIN
  SELECT * INTO r FROM public.bingo_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;

  SELECT id INTO v_player FROM public.bingo_players WHERE game_id = r.game_id AND token_hash = p_token_hash;
  IF v_player IS NULL THEN
    IF jsonb_typeof(p_cards) <> 'array' THEN
      RAISE EXCEPTION 'invalid';
    END IF;
    v_n := jsonb_array_length(p_cards);
    IF v_n NOT BETWEEN 1 AND 4 THEN
      RAISE EXCEPTION 'invalid';
    END IF;
    IF (SELECT count(*) FROM public.bingo_players WHERE game_id = r.game_id) >= 600 THEN
      RAISE EXCEPTION 'full';
    END IF;
    IF r.next_serial + v_n > 5000 THEN
      RAISE EXCEPTION 'full';
    END IF;

    INSERT INTO public.bingo_players (session_id, game_id, token_hash, display_name)
    VALUES (p_session_id, r.game_id, p_token_hash, p_name)
    RETURNING id INTO v_player;

    FOR v_card IN SELECT value FROM jsonb_array_elements(p_cards) LOOP
      BEGIN
        INSERT INTO public.bingo_cards (session_id, kind, game_id, player_id, serial, cells, signature)
        VALUES (p_session_id, 'phone', r.game_id, v_player, r.next_serial,
                ARRAY(SELECT e::smallint FROM jsonb_array_elements_text(v_card -> 'cells') WITH ORDINALITY AS t(e, i) ORDER BY i), v_card ->> 'signature');
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'duplicate';
      END;
      r.next_serial := r.next_serial + 1;
    END LOOP;

    UPDATE public.bingo_runtime SET next_serial = r.next_serial, version = version + 1, updated_at = now()
     WHERE session_id = p_session_id;
  END IF;

  RETURN jsonb_build_object(
    'playerId', v_player,
    'cards', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'serial', serial, 'cells', to_jsonb(cells)) ORDER BY serial), '[]'::jsonb)
                FROM public.bingo_cards WHERE player_id = v_player)
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 11. Demande de quine (serveur seulement, après lecture du jeton).
--     Vérifie : joueur et carton de cette partie, partie en jeu, pas déjà
--     une demande en attente, 5 s après un refus. Enregistre les boules
--     sorties à cet instant et les lignes complètes. Si réglé
--     (settings.pauseOnClaim, vrai par défaut) : partie en vérification,
--     tirage automatique en pause.
--     Renvoie {claimId, status}.
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
  SELECT id INTO v_id FROM public.bingo_claims
   WHERE card_id = p_card_id AND round_no = r.round_no AND status = 'accepted' AND phase = r.phases[r.phase_index + 1];
  IF FOUND THEN
    RETURN jsonb_build_object('claimId', v_id, 'status', 'accepted', 'already', true);
  END IF;
  IF EXISTS (SELECT 1 FROM public.bingo_claims
              WHERE card_id = p_card_id AND round_no = r.round_no AND status = 'rejected'
                AND decided_at > clock_timestamp() - interval '5 seconds') THEN
    RAISE EXCEPTION 'cooldown';
  END IF;

  INSERT INTO public.bingo_claims (session_id, game_id, round_no, phase, card_id, player_id, display_name, draw_count, marks, complete_lines)
  VALUES (p_session_id, r.game_id, r.round_no, r.phases[r.phase_index + 1], p_card_id, p_player_id, v_name,
          cardinality(r.drawn), coalesce(p_marks, '{}'), public.bingo_complete_lines(v_cells, r.drawn))
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
-- 12. Régie (serveur seulement, après vérification de l'animateur).
--     Une seule porte, une action par appel :
--       launch      {settings, phases}   lance OU REPREND la partie existante (rien effacé)
--       new_game    {settings, phases}   nouvelle partie de zéro (confirmée par l animateur)
--       settings    {settings, phases?}  phases modifiables tant qu'aucune boule n'est sortie
--       start                            lobby → running
--       draw        {expect}             tire une boule si expect = nombre déjà sorti
--                                        (sinon rien : double clic sans effet)
--       auto        {mode, ms}           manual | auto | paused
--       decide      {claimId, accept, name?}
--       paper_win   {serial}             carton papier gagnant (vérifié ici)
--       resume                           checking / celebrating → running
--       next_phase                       phase suivante (les demandes en attente sont refusées)
--       new_round                        même joueurs et cartons, tirage remis à zéro
--       paper_add   {cards:[{cells, signature}]}  ajoute des cartons papier (numéros suivants)
--       paper_clear                      supprime les cartons papier de la session
--       heartbeat                        signal de vie (pas de diffusion sauf reprise)
--       exit                             quitte : tout est effacé sauf les cartons papier
--     Erreurs (exception) : no_game, invalid, not_running, too_fast,
--     empty, not_valid, full, duplicate.
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
    SELECT coalesce(max(serial), 5000) INTO v_serial FROM public.bingo_cards WHERE session_id = p_session_id AND kind = 'paper';
    IF v_serial + jsonb_array_length(p_args -> 'cards') > 9999 THEN
      RAISE EXCEPTION 'full';
    END IF;
    FOR v_card IN SELECT value FROM jsonb_array_elements(p_args -> 'cards') LOOP
      v_serial := v_serial + 1;
      BEGIN
        INSERT INTO public.bingo_cards (session_id, kind, serial, cells, signature)
        VALUES (p_session_id, 'paper', v_serial, ARRAY(SELECT e::smallint FROM jsonb_array_elements_text(v_card -> 'cells') WITH ORDINALITY AS t(e, i) ORDER BY i), v_card ->> 'signature');
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'duplicate';
      END;
    END LOOP;
    RETURN jsonb_build_object('first', v_serial - jsonb_array_length(p_args -> 'cards') + 1, 'last', v_serial);
  END IF;

  IF p_action = 'paper_clear' THEN
    DELETE FROM public.bingo_cards WHERE session_id = p_session_id AND kind = 'paper';
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
      r.settings := p_args -> 'settings';
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
    v_left := ARRAY(SELECT n::smallint FROM generate_series(1, 90) AS n WHERE NOT (n::smallint = ANY (r.drawn)));
    IF cardinality(v_left) = 0 THEN RAISE EXCEPTION 'empty'; END IF;
    -- Hasard fort (gen_random_uuid repose sur pg_strong_random), biais négligeable.
    v_pick := v_left[1 + (('x' || lpad(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8), 16, '0'))::bit(64)::bigint % cardinality(v_left))];
    UPDATE public.bingo_runtime
       SET drawn = drawn || v_pick, last_draw_at = v_now, reveal_at = v_now + interval '900 milliseconds'
     WHERE session_id = p_session_id;

  ELSIF p_action = 'auto' THEN
    IF NOT (p_args ->> 'mode') = ANY (ARRAY['manual', 'auto', 'paused']) THEN RAISE EXCEPTION 'invalid'; END IF;
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
     WHERE session_id = p_session_id AND kind = 'paper' AND serial = (p_args ->> 'serial')::integer;
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
-- 12 bis. Nettoyage : uniquement les parties SANS AUCUNE activité depuis
--     plus de 24 h (dernier signal de la régie ET dernière action). Une
--     partie de moins de 24 h n'est jamais touchée. Les cartons papier ne
--     sont jamais supprimés ici (ils partent avec la session).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bingo_purge_stale()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(session_id), '{}') INTO v_ids
    FROM public.bingo_runtime
   WHERE greatest(heartbeat_at, updated_at, launched_at) < clock_timestamp() - interval '24 hours';
  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('games', 0);
  END IF;
  DELETE FROM public.bingo_claims  WHERE session_id = ANY (v_ids);
  DELETE FROM public.bingo_cards   WHERE session_id = ANY (v_ids) AND kind = 'phone';
  DELETE FROM public.bingo_players WHERE session_id = ANY (v_ids);
  DELETE FROM public.bingo_runtime WHERE session_id = ANY (v_ids);
  UPDATE public.sessions SET bingo_active = false WHERE id = ANY (v_ids) AND bingo_active;
  RETURN jsonb_build_object('games', cardinality(v_ids));
END;
$$;

-- ---------------------------------------------------------------------
-- 13. Droits sur les fonctions : tout fermé, puis service_role seulement.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.bingo_complete_lines(smallint[], smallint[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_public_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_join(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_claim(uuid, uuid, text, uuid, smallint[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bingo_purge_stale() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bingo_complete_lines(smallint[], smallint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_public_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_join(uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_claim(uuid, uuid, text, uuid, smallint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_admin(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bingo_purge_stale() TO service_role;

-- ---------------------------------------------------------------------
-- 14. Canal privé « bingo:<session> » : écran et régie peuvent RECEVOIR.
--     Aucune policy d'envoi : seul le serveur diffuse.
--     Sans effet sur les canaux des autres jeux.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'bingo_broadcast_receive'
  ) THEN
    CREATE POLICY bingo_broadcast_receive ON realtime.messages
      FOR SELECT TO anon, authenticated
      USING (realtime.messages.extension = 'broadcast' AND (SELECT realtime.topic()) LIKE 'bingo:%');
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) : supabase/verif_20261119_bingo.sql
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- Efface toutes les parties ET les cartons papier AnimaBingo.
-- ---------------------------------------------------------------------
-- BEGIN;
-- DROP POLICY IF EXISTS bingo_broadcast_receive ON realtime.messages;
-- DROP FUNCTION IF EXISTS public.bingo_purge_stale();
-- DROP FUNCTION IF EXISTS public.bingo_admin(uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.bingo_claim(uuid, uuid, text, uuid, smallint[]);
-- DROP FUNCTION IF EXISTS public.bingo_join(uuid, text, text, jsonb);
-- DROP FUNCTION IF EXISTS public.bingo_notify(uuid);
-- DROP FUNCTION IF EXISTS public.bingo_public_state(uuid);
-- DROP FUNCTION IF EXISTS public.bingo_complete_lines(smallint[], smallint[]);
-- DROP TABLE IF EXISTS public.bingo_claims;
-- DROP TABLE IF EXISTS public.bingo_cards;
-- DROP TABLE IF EXISTS public.bingo_players;
-- DROP TABLE IF EXISTS public.bingo_runtime;
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS bingo_active;
-- COMMIT;
