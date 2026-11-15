-- =====================================================================
-- À DEMI-MOT (identifiant technique : demimot) - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Garanties :
--   - une seule colonne ajoutée à sessions (demimot_active, défaut false) :
--     les autres jeux ne voient aucune différence ; aucun trigger sur sessions ;
--     le signal de vie est dans demimot_runtime, jamais sur sessions ;
--   - partie, équipes, buzz et bibliothèque vivent dans des tables FERMÉES
--     (RLS sans policy, droits retirés à anon et authenticated) : un téléphone
--     ne peut ni les lire ni y écrire, même avec la clé publique ;
--   - le téléphone n'a que deux portes : demimot_buzz et demimot_ping.
--     Toutes deux vérifient le jeton du capitaine ;
--   - la solution n'existe que dans demimot_runtime.state (lu par le serveur
--     seulement) ; l'écran et les téléphones ne reçoivent que public_view,
--     calculé par le serveur sans la solution ni les lettres à venir ;
--   - diffusions sur le canal PRIVÉ « demimot:<session> » : les invités
--     peuvent recevoir, personne ne peut y émettre ;
--   - tables hors publication realtime : leurs écritures ne notifient personne.
--
-- Partage des rôles :
--   - le déroulé des énigmes (révélation, tour de lettres, finale, points,
--     annulation) est calculé par le moteur du serveur (routes API) puis
--     enregistré par demimot_commit, qui refuse toute écriture basée sur un
--     état périmé (numéro de version) ;
--   - le BUZZ est décidé ici, sous le verrou de la partie, comme AnimaBuzz :
--     une seule équipe gagne une fenêtre de buzz, dans l'ordre d'arrivée.
-- =====================================================================

BEGIN;

-- L'ajout de colonne prend un verrou très bref sur sessions. Si une longue
-- requête le tient, on abandonne au bout de 5 s (rien n'est appliqué, à
-- relancer) plutôt que de faire attendre les écrans et téléphones derrière.
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Colonne publique sur sessions : « À Demi-Mot est lancé ».
--    Lue par /invite et /live. Rien d'autre sur sessions.
-- ---------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS demimot_active boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 2. Partie en cours (1 ligne par session). Verrouillée (FOR UPDATE) par
--    chaque buzz et chaque enregistrement du serveur. La ligne sessions
--    n'est jamais verrouillée.
--    state       : état complet du moteur (avec la solution). Serveur seul.
--    public_view : ce que voient l'écran géant et les téléphones.
--    gate_*      : la porte des buzzers (ouverte / prise / fermée), tenue
--                  ici pour que le buzz se décide en base. gate_until :
--                  heure exacte de fermeture (fin des derniers instants),
--                  un buzz arrivé après est refusé même si la régie n'a pas
--                  encore fermé la porte.
--    version     : +1 à chaque changement ; protège contre les écritures
--                  basées sur un état périmé.
--    heartbeat_at: signal de vie de la régie (pause après 90 s).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demimot_runtime (
  session_id       uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id          uuid NOT NULL,
  version          bigint NOT NULL DEFAULT 1,
  state            jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object' AND octet_length(state::text) <= 1000000),
  public_view      jsonb NOT NULL CHECK (jsonb_typeof(public_view) = 'object' AND octet_length(public_view::text) <= 100000),
  gate             text NOT NULL DEFAULT 'closed' CHECK (gate IN ('closed', 'open', 'buzzed')),
  gate_window      integer NOT NULL DEFAULT 0 CHECK (gate_window >= 0),
  gate_blocked     uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(gate_blocked) <= 10),
  gate_until       timestamptz,
  answer_ms        integer NOT NULL DEFAULT 8000 CHECK (answer_ms BETWEEN 2000 AND 60000),
  buzz_team_id     uuid,
  buzz_window      integer,
  buzz_at          timestamptz,
  launched_at      timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  heartbeat_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demimot_runtime_buzz_check CHECK ((gate = 'buzzed') = (buzz_team_id IS NOT NULL AND buzz_at IS NOT NULL AND buzz_window IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS demimot_runtime_heartbeat_idx ON public.demimot_runtime (heartbeat_at);

-- ---------------------------------------------------------------------
-- 3. Équipes de la partie (2 à 10). Les scores sont dans state (une seule
--    source). Un seul capitaine par équipe : captain_token_hash = SHA-256
--    du jeton remis à son téléphone ; « Remplacer » le remet à NULL.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demimot_teams (
  id                 uuid PRIMARY KEY,
  session_id         uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id            uuid NOT NULL,
  position           smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  name               text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 28),
  color              text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  captain_token_hash text CHECK (captain_token_hash IS NULL OR char_length(captain_token_hash) = 64),
  captain_since      timestamptz,
  captain_seen_at    timestamptz,
  captain_rtt_ms     integer CHECK (captain_rtt_ms IS NULL OR captain_rtt_ms BETWEEN 0 AND 60000),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demimot_teams_session_idx ON public.demimot_teams (session_id);
CREATE INDEX IF NOT EXISTS demimot_teams_game_idx ON public.demimot_teams (game_id);

-- ---------------------------------------------------------------------
-- 4. Buzz acceptés. L'identifiant auto-incrémenté EST l'ordre d'arrivée.
--    UNIQUE (game_id, window_no) : UNE seule équipe gagne une fenêtre de
--    buzz, garanti par la base elle-même en plus du verrou.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demimot_buzzes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id     uuid NOT NULL,
  window_no   integer NOT NULL CHECK (window_no >= 0),
  team_id     uuid NOT NULL REFERENCES public.demimot_teams(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT demimot_buzzes_game_window_key UNIQUE (game_id, window_no)
);

CREATE INDEX IF NOT EXISTS demimot_buzzes_session_idx ON public.demimot_buzzes (session_id);
CREATE INDEX IF NOT EXISTS demimot_buzzes_team_idx ON public.demimot_buzzes (team_id);

-- ---------------------------------------------------------------------
-- 5. Bibliothèque de l'animateur (par compte, gardée d'une soirée à
--    l'autre, effacée avec le compte). Lue et écrite par les routes serveur
--    après vérification de l'utilisateur connecté.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demimot_sets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demimot_sets_user_idx ON public.demimot_sets (user_id);

CREATE TABLE IF NOT EXISTS public.demimot_puzzles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id     uuid REFERENCES public.demimot_sets(id) ON DELETE CASCADE,
  category   text NOT NULL CHECK (char_length(category) BETWEEN 1 AND 60),
  solution   text NOT NULL CHECK (char_length(solution) BETWEEN 1 AND 120),
  variants   text[] NOT NULL DEFAULT '{}' CHECK (cardinality(variants) <= 10),
  difficulty text NOT NULL DEFAULT 'moyen' CHECK (difficulty IN ('facile', 'moyen', 'difficile')),
  points     integer CHECK (points IS NULL OR points BETWEEN 0 AND 10000),
  active     boolean NOT NULL DEFAULT true,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demimot_puzzles_user_idx ON public.demimot_puzzles (user_id);
CREATE INDEX IF NOT EXISTS demimot_puzzles_set_idx ON public.demimot_puzzles (set_id);

-- ---------------------------------------------------------------------
-- 6. Tables fermées : aucune policy = aucun accès anon / authenticated.
-- ---------------------------------------------------------------------
ALTER TABLE public.demimot_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demimot_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demimot_buzzes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demimot_sets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demimot_puzzles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.demimot_runtime, public.demimot_teams, public.demimot_buzzes,
              public.demimot_sets, public.demimot_puzzles
  FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. État public : ce que voient l'écran géant et les téléphones.
--    view = projection sans solution ; gate = porte des buzzers (pendant
--    les quelques dixièmes de seconde entre un buzz et sa prise en compte
--    par le moteur, l'écran affiche déjà l'équipe qui a la main).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_public_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r      public.demimot_runtime;
  v_team text;
BEGIN
  SELECT * INTO r FROM public.demimot_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;

  IF r.buzz_team_id IS NOT NULL THEN
    SELECT name INTO v_team FROM public.demimot_teams WHERE id = r.buzz_team_id;
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'v', r.version,
    'gameId', r.game_id,
    'view', r.public_view,
    'gate', jsonb_build_object(
      'state', r.gate,
      'window', r.gate_window,
      'blocked', to_jsonb(r.gate_blocked),
      'until', r.gate_until,
      'answerMs', r.answer_ms,
      'teamId', r.buzz_team_id,
      'teamName', v_team,
      'at', r.buzz_at
    ),
    'paused', r.heartbeat_at < clock_timestamp() - interval '90 seconds',
    'serverNow', clock_timestamp()
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 8. Diffusion sur le canal privé de la session. Un échec de diffusion
--    n'annule JAMAIS un buzz ni une action (les écrans relisent l'état).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_notify(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.demimot_public_state(p_session_id), 'state', 'demimot:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[À Demi-Mot] diffusion impossible : %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 9. LE BUZZ. Seule écriture possible depuis un téléphone. Tout est
--    vérifié sous le verrou de la partie : partie lancée, régie présente,
--    jeton du capitaine, fenêtre de buzz courante (un buzz envoyé pour une
--    fenêtre périmée est refusé), porte ouverte, équipe non bloquée.
--    La première équipe arrivée prend la main ; les suivantes reçoivent
--    « taken ». Un double appui de la gagnante renvoie ok (already).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_buzz(
  p_session_id uuid,
  p_team_id    uuid,
  p_token      text,
  p_window     integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz;
  r     public.demimot_runtime;
  t     public.demimot_teams;
BEGIN
  IF p_session_id IS NULL OR p_team_id IS NULL OR p_window IS NULL OR p_token IS NULL
     OR char_length(p_token) NOT BETWEEN 32 AND 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO r FROM public.demimot_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;
  -- Heure relevée APRÈS avoir pris son tour : elle suit l'ordre d'arrivée.
  v_now := clock_timestamp();

  SELECT * INTO t FROM public.demimot_teams
   WHERE id = p_team_id
     AND session_id = p_session_id
     AND game_id = r.game_id
     AND captain_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_captain');
  END IF;

  IF r.heartbeat_at < v_now - interval '90 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paused');
  END IF;

  UPDATE public.demimot_teams SET captain_seen_at = v_now WHERE id = t.id;

  -- Déjà gagnant de cette fenêtre (double appui, renvoi après coupure).
  IF r.gate = 'buzzed' AND r.buzz_team_id = t.id AND r.buzz_window = p_window THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  IF p_window <> r.gate_window THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale');
  END IF;
  IF r.gate = 'buzzed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
  END IF;
  IF r.gate <> 'open' OR (r.gate_until IS NOT NULL AND v_now > r.gate_until) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;
  IF t.id = ANY (r.gate_blocked) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
  END IF;

  INSERT INTO public.demimot_buzzes (session_id, game_id, window_no, team_id, received_at)
  VALUES (p_session_id, r.game_id, r.gate_window, t.id, v_now)
  ON CONFLICT (game_id, window_no) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
  END IF;

  UPDATE public.demimot_runtime
     SET gate = 'buzzed', buzz_team_id = t.id, buzz_window = r.gate_window, buzz_at = v_now,
         version = version + 1, updated_at = v_now
   WHERE session_id = p_session_id;
  PERFORM public.demimot_notify(p_session_id);
  RETURN jsonb_build_object('ok', true, 'first', true, 'at', v_now);
END;
$$;

-- ---------------------------------------------------------------------
-- 10. Ping du téléphone capitaine : connexion maintenue, latence mesurée
--     (affichée à l'animateur seulement). Ne verrouille rien, ne diffuse rien.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_ping(
  p_session_id uuid,
  p_team_id    uuid,
  p_token      text,
  p_rtt_ms     integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_token IS NULL OR char_length(p_token) NOT BETWEEN 32 AND 128 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  UPDATE public.demimot_teams
     SET captain_seen_at = now(),
         captain_rtt_ms = CASE WHEN p_rtt_ms BETWEEN 0 AND 60000 THEN p_rtt_ms ELSE captain_rtt_ms END
   WHERE id = p_team_id
     AND session_id = p_session_id
     AND captain_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  RETURN jsonb_build_object('ok', FOUND, 'serverNow', clock_timestamp());
END;
$$;

-- ---------------------------------------------------------------------
-- 11. Un téléphone devient capitaine d'une équipe (serveur seulement).
--     Équipe déjà prise : refusé ; l'animateur doit d'abord « Remplacer ».
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_join(
  p_session_id uuid,
  p_team_id    uuid,
  p_token_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.demimot_runtime;
  t public.demimot_teams;
BEGIN
  IF p_token_hash IS NULL OR char_length(p_token_hash) <> 64 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  SELECT * INTO r FROM public.demimot_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;
  SELECT * INTO t FROM public.demimot_teams
   WHERE id = p_team_id AND session_id = p_session_id AND game_id = r.game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_team');
  END IF;
  IF t.captain_token_hash IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'taken');
  END IF;
  UPDATE public.demimot_teams
     SET captain_token_hash = p_token_hash, captain_since = now(), captain_seen_at = now(), captain_rtt_ms = NULL
   WHERE id = t.id;
  UPDATE public.demimot_runtime SET version = version + 1, updated_at = now() WHERE session_id = p_session_id;
  PERFORM public.demimot_notify(p_session_id);
  RETURN jsonb_build_object('ok', true, 'gameId', r.game_id, 'teamName', t.name);
END;
$$;

-- ---------------------------------------------------------------------
-- 12. Lancer (serveur seulement, après vérification du propriétaire) :
--     nouvelle partie, anciennes données effacées, autres jeux désactivés.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_launch(
  p_session_id uuid,
  p_state      jsonb,
  p_view       jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  DELETE FROM public.demimot_teams WHERE session_id = p_session_id;
  DELETE FROM public.demimot_buzzes WHERE session_id = p_session_id;
  INSERT INTO public.demimot_runtime AS x (session_id, game_id, version, state, public_view, gate, gate_window, gate_blocked,
                                           buzz_team_id, buzz_window, buzz_at, launched_at, updated_at, heartbeat_at)
  VALUES (p_session_id, gen_random_uuid(), 1, p_state, p_view, 'closed', 0, '{}', NULL, NULL, NULL, v_now, v_now, v_now)
  ON CONFLICT (session_id) DO UPDATE SET
    game_id = EXCLUDED.game_id, version = x.version + 1, state = EXCLUDED.state, public_view = EXCLUDED.public_view,
    gate = 'closed', gate_window = 0, gate_blocked = '{}', gate_until = NULL, buzz_team_id = NULL, buzz_window = NULL, buzz_at = NULL,
    launched_at = v_now, updated_at = v_now, heartbeat_at = v_now;
  UPDATE public.sessions
     SET demimot_active = true,
         quiz_active = false, quiz_lobby_visible = false, lineup_active = false,
         wheel_active = false, mystery_photo_active = false, affinity_active = false,
         buzzer_active = false, vote_active = false
   WHERE id = p_session_id;
  PERFORM public.demimot_notify(p_session_id);
  RETURN public.demimot_public_state(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 13. Enregistrer un nouvel état calculé par le moteur (serveur seulement).
--     Refusé (« conflict ») si la partie a changé depuis la lecture
--     (un buzz arrivé entre-temps, par exemple) : le serveur relit et
--     recommence. p_teams (facultatif) : liste complète des équipes
--     [{id, position, name, color}] ; les équipes absentes sont retirées.
--     p_gate : {state, window, blocked[], until, answerMs, teamId, at}.
-- ---------------------------------------------------------------------
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
    IF jsonb_typeof(p_teams) <> 'array' OR jsonb_array_length(p_teams) > 10 THEN
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

-- ---------------------------------------------------------------------
-- 14. Signal de vie de la régie (serveur seulement). Renvoie si la partie
--     était en pause (le serveur met alors l'énigme en cours en pause dans
--     le moteur, comme au retour d'une coupure).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_heartbeat(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  r     public.demimot_runtime;
BEGIN
  SELECT * INTO r FROM public.demimot_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;
  IF r.heartbeat_at >= v_now - interval '90 seconds' THEN
    UPDATE public.demimot_runtime SET heartbeat_at = v_now WHERE session_id = p_session_id;
    RETURN jsonb_build_object('v', r.version, 'resumed', false);
  END IF;
  UPDATE public.demimot_runtime SET heartbeat_at = v_now, version = version + 1, updated_at = v_now
   WHERE session_id = p_session_id;
  PERFORM public.demimot_notify(p_session_id);
  RETURN jsonb_build_object('v', r.version + 1, 'resumed', true);
END;
$$;

-- ---------------------------------------------------------------------
-- 15. Libérer le capitaine d'une équipe (« Remplacer », serveur seulement).
--     L'ancien téléphone ne peut plus buzzer ; points et blocages gardés.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_release_captain(p_session_id uuid, p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r public.demimot_runtime;
BEGIN
  SELECT * INTO r FROM public.demimot_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;
  UPDATE public.demimot_teams
     SET captain_token_hash = NULL, captain_since = NULL, captain_seen_at = NULL, captain_rtt_ms = NULL
   WHERE id = p_team_id AND session_id = p_session_id AND game_id = r.game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid';
  END IF;
  UPDATE public.demimot_runtime SET version = version + 1, updated_at = now() WHERE session_id = p_session_id;
  PERFORM public.demimot_notify(p_session_id);
  RETURN public.demimot_public_state(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 16. Quitter (serveur seulement) : partie, équipes et buzz effacés.
--     La bibliothèque est gardée.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demimot_exit(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.demimot_buzzes WHERE session_id = p_session_id;
  DELETE FROM public.demimot_teams WHERE session_id = p_session_id;
  DELETE FROM public.demimot_runtime WHERE session_id = p_session_id;
  UPDATE public.sessions SET demimot_active = false WHERE id = p_session_id AND demimot_active;
  PERFORM public.demimot_notify(p_session_id);
  RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
END;
$$;

-- ---------------------------------------------------------------------
-- 17. Droits sur les fonctions. Par défaut, Supabase les ouvre à tous :
--     on ferme tout, puis on ouvre au strict nécessaire.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.demimot_public_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_buzz(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_ping(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_join(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_launch(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_commit(uuid, bigint, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_heartbeat(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_release_captain(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demimot_exit(uuid) FROM PUBLIC, anon, authenticated;

-- Téléphones (clé publique) : buzz et ping uniquement.
GRANT EXECUTE ON FUNCTION public.demimot_buzz(uuid, uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demimot_ping(uuid, uuid, text, integer) TO anon, authenticated;
-- Serveur (routes API) : le reste.
GRANT EXECUTE ON FUNCTION public.demimot_public_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_buzz(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_ping(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_join(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_launch(uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_commit(uuid, bigint, jsonb, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_heartbeat(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_release_captain(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.demimot_exit(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 18. Canaux privés « demimot:<session> » : invités et animateur peuvent
--     RECEVOIR. Aucune policy d'envoi : seul le serveur diffuse.
--     Sans effet sur les canaux des autres jeux.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'demimot_broadcast_receive'
  ) THEN
    CREATE POLICY demimot_broadcast_receive ON realtime.messages
      FOR SELECT TO anon, authenticated
      USING (realtime.messages.extension = 'broadcast' AND (SELECT realtime.topic()) LIKE 'demimot:%');
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) après exécution
-- Version complète (12 contrôles, colonne ok) : supabase/verif_20261116_demimot.sql
-- ---------------------------------------------------------------------
-- SELECT column_name, column_default FROM information_schema.columns
--  WHERE table_name = 'sessions' AND column_name = 'demimot_active';          -- 1 ligne, false
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'demimot_%'; -- 5 lignes, true
-- SELECT * FROM pg_policies WHERE tablename LIKE 'demimot_%';                 -- doit être vide
-- SELECT * FROM pg_publication_tables WHERE tablename LIKE 'demimot_%';       -- doit être vide
-- SELECT policyname FROM pg_policies WHERE schemaname = 'realtime' AND policyname = 'demimot_broadcast_receive'; -- 1 ligne

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- Efface toutes les parties ET les bibliothèques À Demi-Mot.
-- ---------------------------------------------------------------------
-- BEGIN;
-- DROP POLICY IF EXISTS demimot_broadcast_receive ON realtime.messages;
-- DROP FUNCTION IF EXISTS public.demimot_exit(uuid);
-- DROP FUNCTION IF EXISTS public.demimot_release_captain(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.demimot_heartbeat(uuid);
-- DROP FUNCTION IF EXISTS public.demimot_commit(uuid, bigint, jsonb, jsonb, jsonb, jsonb);
-- DROP FUNCTION IF EXISTS public.demimot_launch(uuid, jsonb, jsonb);
-- DROP FUNCTION IF EXISTS public.demimot_join(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.demimot_ping(uuid, uuid, text, integer);
-- DROP FUNCTION IF EXISTS public.demimot_buzz(uuid, uuid, text, integer);
-- DROP FUNCTION IF EXISTS public.demimot_notify(uuid);
-- DROP FUNCTION IF EXISTS public.demimot_public_state(uuid);
-- DROP TABLE IF EXISTS public.demimot_buzzes;
-- DROP TABLE IF EXISTS public.demimot_teams;
-- DROP TABLE IF EXISTS public.demimot_runtime;
-- DROP TABLE IF EXISTS public.demimot_puzzles;
-- DROP TABLE IF EXISTS public.demimot_sets;
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS demimot_active;
-- COMMIT;
