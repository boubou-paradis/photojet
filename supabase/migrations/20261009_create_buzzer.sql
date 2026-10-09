-- =====================================================================
-- ANIMABUZZ (identifiant technique : buzzer) - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Garanties :
--   - une seule colonne ajoutée à sessions (buzzer_active, défaut false) :
--     les autres jeux ne voient aucune différence ; aucun trigger sur sessions ;
--   - joueurs, buzz, manches et état vivent dans des tables FERMÉES (RLS sans
--     policy, droits retirés à anon et authenticated) : un téléphone ne peut
--     ni les lire ni y écrire, même avec la clé publique ;
--   - le téléphone n'a que deux portes : buzzer_buzz (buzz ou test) et
--     buzzer_ping (connexion maintenue). Toutes deux vérifient le jeton ;
--   - les diffusions passent par des canaux PRIVÉS « buzzer:<session> » :
--     les invités peuvent les recevoir, personne ne peut y émettre ;
--   - tables hors publication realtime : leurs écritures ne notifient personne.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Colonne publique sur sessions : « AnimaBuzz est lancé ».
--    Lue par /invite et /live. Rien d'autre sur sessions.
-- ---------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS buzzer_active boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 2. État d'une partie (1 ligne par session). Verrouillée (FOR UPDATE) par
--    chaque buzz et chaque action animateur : tout passe un par un, dans
--    l'ordre d'arrivée. La ligne sessions n'est jamais verrouillée.
--    version : +1 à chaque changement d'état diffusé.
--    heartbeat_at : signal de vie de la page animateur (pause après 90 s).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_runtime (
  session_id       uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id          uuid NOT NULL,
  mode             text NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo', 'team')),
  teams            text[] NOT NULL DEFAULT '{}' CHECK (cardinality(teams) <= 30),
  window_ms        integer NOT NULL DEFAULT 1500 CHECK (window_ms BETWEEN 0 AND 5000),
  timer_s          integer CHECK (timer_s IS NULL OR timer_s IN (5, 10, 15, 20, 30)),
  phase            text NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'test', 'waiting', 'open', 'buzzed', 'closed')),
  round_id         uuid,
  round_no         integer NOT NULL DEFAULT 0 CHECK (round_no >= 0),
  attempt          integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  opened_at        timestamptz,
  deadline_at      timestamptz,
  first_buzz_at    timestamptz,
  priority_buzz_id bigint,
  outcome          text CHECK (outcome IS NULL OR outcome IN ('won', 'no_answer', 'cancelled')),
  version          bigint NOT NULL DEFAULT 1,
  launched_at      timestamptz NOT NULL DEFAULT now(),
  heartbeat_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buzzer_runtime_heartbeat_idx ON public.buzzer_runtime (heartbeat_at);

-- ---------------------------------------------------------------------
-- 3. Joueurs. Mode individuel : pseudo (unique par partie, comparaison
--    insensible à la casse et aux espaces via nickname_key). Mode équipe :
--    équipe seulement. token_hash : SHA-256 du jeton remis au téléphone.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_players (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id      uuid NOT NULL,
  nickname     text CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 24),
  nickname_key text CHECK (nickname_key IS NULL OR char_length(nickname_key) BETWEEN 1 AND 24),
  team_key     text CHECK (team_key IS NULL OR char_length(team_key) BETWEEN 1 AND 24),
  team_label   text CHECK (team_label IS NULL OR char_length(team_label) BETWEEN 1 AND 24),
  token_hash   text NOT NULL CHECK (char_length(token_hash) = 64),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_rtt_ms  integer CHECK (last_rtt_ms IS NULL OR last_rtt_ms BETWEEN 0 AND 60000),
  tested_at    timestamptz,
  removed_at   timestamptz,
  CONSTRAINT buzzer_players_identity_check CHECK (nickname IS NOT NULL OR team_key IS NOT NULL),
  CONSTRAINT buzzer_players_nickname_pair_check CHECK ((nickname IS NULL) = (nickname_key IS NULL)),
  CONSTRAINT buzzer_players_team_pair_check CHECK ((team_key IS NULL) = (team_label IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS buzzer_players_game_nickname_key
  ON public.buzzer_players (game_id, nickname_key) WHERE nickname_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS buzzer_players_session_idx ON public.buzzer_players (session_id);
CREATE INDEX IF NOT EXISTS buzzer_players_game_idx ON public.buzzer_players (game_id);

-- ---------------------------------------------------------------------
-- 4. Manches (historique de la soirée, effacé avec la partie).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_rounds (
  id           uuid PRIMARY KEY,
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id      uuid NOT NULL,
  round_no     integer NOT NULL CHECK (round_no >= 1),
  outcome      text CHECK (outcome IS NULL OR outcome IN ('won', 'no_answer', 'cancelled')),
  winner_label text CHECK (winner_label IS NULL OR char_length(winner_label) BETWEEN 1 AND 24),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  CONSTRAINT buzzer_rounds_game_round_key UNIQUE (game_id, round_no)
);

CREATE INDEX IF NOT EXISTS buzzer_rounds_session_idx ON public.buzzer_rounds (session_id);

-- ---------------------------------------------------------------------
-- 5. Buzz. L'identifiant auto-incrémenté EST l'ordre : attribué sous le
--    verrou de buzzer_runtime, il suit l'ordre d'arrivée en base, sans
--    ex æquo possible, et ne change jamais.
--    unit_key : « p:<joueur> » en individuel, « t:<équipe> » en équipe.
--    UNIQUE (round_id, unit_key) : un seul buzz par joueur (ou par équipe)
--    et par manche. C'est aussi ce qui exclut les bloqués d'une réouverture.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buzzer_buzzes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  round_id    uuid NOT NULL REFERENCES public.buzzer_rounds(id) ON DELETE CASCADE,
  attempt     integer NOT NULL CHECK (attempt >= 1),
  unit_key    text NOT NULL CHECK (char_length(unit_key) BETWEEN 3 AND 64),
  unit_label  text NOT NULL CHECK (char_length(unit_label) BETWEEN 1 AND 24),
  player_id   uuid NOT NULL REFERENCES public.buzzer_players(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'priority', 'blocked', 'won')),
  CONSTRAINT buzzer_buzzes_round_unit_key UNIQUE (round_id, unit_key)
);

CREATE INDEX IF NOT EXISTS buzzer_buzzes_round_attempt_idx ON public.buzzer_buzzes (round_id, attempt, id);
CREATE INDEX IF NOT EXISTS buzzer_buzzes_player_idx ON public.buzzer_buzzes (player_id);
CREATE INDEX IF NOT EXISTS buzzer_buzzes_session_idx ON public.buzzer_buzzes (session_id);

-- ---------------------------------------------------------------------
-- 6. Tables fermées : aucune policy = aucun accès anon / authenticated.
-- ---------------------------------------------------------------------
ALTER TABLE public.buzzer_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_rounds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buzzer_buzzes  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.buzzer_runtime, public.buzzer_players, public.buzzer_rounds, public.buzzer_buzzes
  FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. État public d'une partie : ce que voient l'écran géant et les
--    téléphones (pseudos affichés de toute façon sur l'écran géant).
--    File : 5 premiers de la tentative en cours, avec l'écart au 1er.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_public_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r          public.buzzer_runtime;
  v_queue    jsonb;
  v_blocked  jsonb;
  v_priority jsonb;
  v_winner   text;
BEGIN
  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'rank', q.rank, 'unit', q.unit_key, 'label', q.unit_label, 'status', q.status, 'gapMs', q.gap_ms
         ) ORDER BY q.rank), '[]'::jsonb)
    INTO v_queue
    FROM (
      SELECT row_number() OVER (ORDER BY b.id) AS rank,
             b.unit_key, b.unit_label, b.status,
             round(extract(epoch FROM b.received_at - first_value(b.received_at) OVER (ORDER BY b.id)) * 1000)::integer AS gap_ms
        FROM public.buzzer_buzzes b
       WHERE b.round_id = r.round_id AND b.attempt = r.attempt
       ORDER BY b.id
       LIMIT 5
    ) q;

  SELECT coalesce(jsonb_agg(x.unit_label ORDER BY x.id), '[]'::jsonb)
    INTO v_blocked
    FROM (
      SELECT b.id, b.unit_label FROM public.buzzer_buzzes b
       WHERE b.round_id = r.round_id AND b.status = 'blocked'
       ORDER BY b.id LIMIT 20
    ) x;

  IF r.priority_buzz_id IS NOT NULL THEN
    SELECT jsonb_build_object('unit', b.unit_key, 'label', b.unit_label)
      INTO v_priority
      FROM public.buzzer_buzzes b WHERE b.id = r.priority_buzz_id;
  END IF;

  IF r.round_id IS NOT NULL THEN
    SELECT winner_label INTO v_winner FROM public.buzzer_rounds WHERE id = r.round_id;
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'v', r.version,
    'phase', r.phase,
    'mode', r.mode,
    'teams', to_jsonb(r.teams),
    'windowMs', r.window_ms,
    'timerS', r.timer_s,
    'roundNo', r.round_no,
    'attempt', r.attempt,
    'openedAt', r.opened_at,
    'deadlineAt', r.deadline_at,
    'firstBuzzAt', r.first_buzz_at,
    'priority', v_priority,
    'queue', v_queue,
    'blocked', v_blocked,
    'outcome', r.outcome,
    'winner', v_winner,
    'paused', r.heartbeat_at < clock_timestamp() - interval '90 seconds',
    'serverNow', clock_timestamp()
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 8. Diffusion de l'état sur le canal privé de la session. Un échec de
--    diffusion n'annule JAMAIS un buzz ni une action : il est ignoré
--    (les téléphones relisent l'état à la reconnexion).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_notify(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.buzzer_public_state(p_session_id), 'state', 'buzzer:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AnimaBuzz] diffusion impossible : %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 9. LE BUZZ (et le test des buzzers). Seule écriture possible depuis un
--    téléphone. Vérifie tout, sous le verrou de la partie :
--    partie lancée, animateur présent, jeton valide, joueur non retiré,
--    buzzers ouverts (ou fenêtre après le 1er buzz), chrono, pas déjà buzzé,
--    pas bloqué. Le rang renvoyé est calculé ici, jamais par le téléphone.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_buzz(
  p_session_id uuid,
  p_player_id  uuid,
  p_token      text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now     timestamptz := clock_timestamp();
  r         public.buzzer_runtime;
  p         public.buzzer_players;
  v_unit    text;
  v_label   text;
  v_first   boolean;
  v_id      bigint;
  v_rank    integer;
  v_gap     integer;
  v_status  text;
  v_attempt integer;
BEGIN
  IF p_session_id IS NULL OR p_player_id IS NULL OR p_token IS NULL
     OR char_length(p_token) NOT BETWEEN 32 AND 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;
  -- Heure relevée APRÈS avoir pris son tour : elle suit toujours l'ordre des
  -- rangs, donc les écarts affichés (+0,14 s) restent cohérents.
  v_now := clock_timestamp();

  SELECT * INTO p FROM public.buzzer_players
   WHERE id = p_player_id
     AND session_id = p_session_id
     AND game_id = r.game_id
     AND token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_player');
  END IF;
  IF p.removed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'removed');
  END IF;

  IF r.heartbeat_at < v_now - interval '90 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'paused');
  END IF;

  -- Test des buzzers : on note seulement que ce téléphone fonctionne.
  IF r.phase = 'test' THEN
    UPDATE public.buzzer_players SET tested_at = coalesce(tested_at, v_now), last_seen_at = v_now WHERE id = p.id;
    RETURN jsonb_build_object('ok', true, 'kind', 'test');
  END IF;

  IF r.phase NOT IN ('open', 'buzzed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  IF r.mode = 'team' THEN
    v_unit := 't:' || p.team_key;
    v_label := p.team_label;
  ELSE
    v_unit := 'p:' || p.id::text;
    v_label := p.nickname;
  END IF;
  IF v_label IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_player');
  END IF;

  -- Déjà buzzé dans cette manche (double appui, renvoi après coupure réseau,
  -- équipier) : on redonne SON rang, même après la fenêtre. Vérifié AVANT la
  -- fenêtre, sinon le premier recevrait « trop tard » sur un appui en retard.
  SELECT id, status, attempt INTO v_id, v_status, v_attempt
    FROM public.buzzer_buzzes WHERE round_id = r.round_id AND unit_key = v_unit;
  IF FOUND THEN
    IF v_status = 'blocked' OR v_attempt <> r.attempt THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
    END IF;
    SELECT count(*) INTO v_rank FROM public.buzzer_buzzes
     WHERE round_id = r.round_id AND attempt = r.attempt AND id <= v_id;
    SELECT round(extract(epoch FROM b.received_at - r.first_buzz_at) * 1000)::integer INTO v_gap
      FROM public.buzzer_buzzes b WHERE b.id = v_id;
    RETURN jsonb_build_object('ok', true, 'kind', 'buzz', 'already', true, 'rank', v_rank, 'gapMs', coalesce(v_gap, 0), 'first', v_rank = 1);
  END IF;
  v_id := NULL;

  IF r.phase = 'open' THEN
    IF r.deadline_at IS NOT NULL AND v_now > r.deadline_at THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'closed');
    END IF;
    v_first := true;
  ELSE
    IF r.first_buzz_at IS NULL OR v_now > r.first_buzz_at + make_interval(secs => r.window_ms / 1000.0) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_late');
    END IF;
    v_first := false;
  END IF;

  INSERT INTO public.buzzer_buzzes (session_id, round_id, attempt, unit_key, unit_label, player_id, received_at, status)
  VALUES (p_session_id, r.round_id, r.attempt, v_unit, v_label, p.id, v_now, CASE WHEN v_first THEN 'priority' ELSE 'queued' END)
  ON CONFLICT (round_id, unit_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Déjà buzzé dans cette manche (double appui, équipier, ou bloqué).
    SELECT id, status, attempt INTO v_id, v_status, v_attempt
      FROM public.buzzer_buzzes WHERE round_id = r.round_id AND unit_key = v_unit;
    IF v_status = 'blocked' OR v_attempt <> r.attempt THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
    END IF;
    SELECT count(*) INTO v_rank FROM public.buzzer_buzzes
     WHERE round_id = r.round_id AND attempt = r.attempt AND id <= v_id;
    SELECT round(extract(epoch FROM b.received_at - r.first_buzz_at) * 1000)::integer INTO v_gap
      FROM public.buzzer_buzzes b WHERE b.id = v_id;
    RETURN jsonb_build_object('ok', true, 'kind', 'buzz', 'already', true, 'rank', v_rank, 'gapMs', coalesce(v_gap, 0), 'first', v_rank = 1);
  END IF;

  UPDATE public.buzzer_players SET last_seen_at = v_now WHERE id = p.id;

  IF v_first THEN
    UPDATE public.buzzer_runtime
       SET phase = 'buzzed', first_buzz_at = v_now, priority_buzz_id = v_id, version = version + 1
     WHERE session_id = p_session_id;
    PERFORM public.buzzer_notify(p_session_id);
    RETURN jsonb_build_object('ok', true, 'kind', 'buzz', 'rank', 1, 'gapMs', 0, 'first', true);
  END IF;

  SELECT count(*) INTO v_rank FROM public.buzzer_buzzes
   WHERE round_id = r.round_id AND attempt = r.attempt AND id <= v_id;
  v_gap := round(extract(epoch FROM v_now - r.first_buzz_at) * 1000)::integer;
  RETURN jsonb_build_object('ok', true, 'kind', 'buzz', 'rank', v_rank, 'gapMs', v_gap, 'first', false);
END;
$$;

-- ---------------------------------------------------------------------
-- 10. Ping du téléphone : garde la connexion ouverte avant l'ouverture des
--     buzzers et mesure la latence (affichée à l'animateur seulement).
--     Ne verrouille rien, ne diffuse rien.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_ping(
  p_session_id uuid,
  p_player_id  uuid,
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
  UPDATE public.buzzer_players
     SET last_seen_at = now(),
         last_rtt_ms = CASE WHEN p_rtt_ms BETWEEN 0 AND 60000 THEN p_rtt_ms ELSE last_rtt_ms END
   WHERE id = p_player_id
     AND session_id = p_session_id
     AND removed_at IS NULL
     AND token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  RETURN jsonb_build_object('ok', FOUND, 'serverNow', clock_timestamp());
END;
$$;

-- ---------------------------------------------------------------------
-- 11. Inscription (appelée par le serveur seulement). Plafond de joueurs
--     vérifié sous le verrou de la partie : deux inscriptions simultanées
--     ne peuvent pas le dépasser. Pseudo pris : contrainte unique.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_join(
  p_session_id   uuid,
  p_nickname     text,
  p_nickname_key text,
  p_team_key     text,
  p_team_label   text,
  p_token_hash   text,
  p_max_players  integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r       public.buzzer_runtime;
  v_count integer;
  v_id    uuid;
BEGIN
  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;
  IF (r.mode = 'solo' AND p_nickname IS NULL) OR (r.mode = 'team' AND p_team_key IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT count(*) INTO v_count FROM public.buzzer_players WHERE game_id = r.game_id AND removed_at IS NULL;
  IF v_count >= p_max_players THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  BEGIN
    INSERT INTO public.buzzer_players (session_id, game_id, nickname, nickname_key, team_key, team_label, token_hash)
    VALUES (p_session_id, r.game_id,
            CASE WHEN r.mode = 'solo' THEN p_nickname END,
            CASE WHEN r.mode = 'solo' THEN p_nickname_key END,
            CASE WHEN r.mode = 'team' THEN p_team_key END,
            CASE WHEN r.mode = 'team' THEN p_team_label END,
            p_token_hash)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nickname_taken');
  END;

  RETURN jsonb_build_object('ok', true, 'playerId', v_id, 'gameId', r.game_id, 'mode', r.mode);
END;
$$;

-- ---------------------------------------------------------------------
-- 12. Le prioritaire perd la main (mauvaise réponse ou joueur retiré) :
--     le suivant de la file la prend ; sinon réouverture pour ceux qui
--     n'ont pas encore buzzé ; s'il n'en reste aucun, manche sans réponse.
--     Appelée sous le verrou de la partie, par buzzer_admin uniquement.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_pass_hand(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now      timestamptz := clock_timestamp();
  r          public.buzzer_runtime;
  v_next     bigint;
  v_eligible integer;
BEGIN
  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id;

  SELECT b.id INTO v_next FROM public.buzzer_buzzes b
   WHERE b.round_id = r.round_id AND b.attempt = r.attempt AND b.status = 'queued'
   ORDER BY b.id LIMIT 1;

  IF v_next IS NOT NULL THEN
    UPDATE public.buzzer_buzzes SET status = 'priority' WHERE id = v_next;
    UPDATE public.buzzer_runtime SET priority_buzz_id = v_next WHERE session_id = p_session_id;
    RETURN;
  END IF;

  IF r.mode = 'team' THEN
    SELECT count(DISTINCT pl.team_key) INTO v_eligible FROM public.buzzer_players pl
     WHERE pl.game_id = r.game_id AND pl.removed_at IS NULL AND pl.team_key IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.buzzer_buzzes b WHERE b.round_id = r.round_id AND b.unit_key = 't:' || pl.team_key);
  ELSE
    SELECT count(*) INTO v_eligible FROM public.buzzer_players pl
     WHERE pl.game_id = r.game_id AND pl.removed_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.buzzer_buzzes b WHERE b.round_id = r.round_id AND b.unit_key = 'p:' || pl.id::text);
  END IF;

  IF v_eligible = 0 THEN
    UPDATE public.buzzer_runtime
       SET phase = 'closed', outcome = 'no_answer', priority_buzz_id = NULL, deadline_at = NULL
     WHERE session_id = p_session_id;
    UPDATE public.buzzer_rounds SET outcome = 'no_answer', ended_at = v_now WHERE id = r.round_id;
  ELSE
    UPDATE public.buzzer_runtime
       SET phase = 'open', attempt = attempt + 1, opened_at = v_now,
           deadline_at = CASE WHEN timer_s IS NULL THEN NULL ELSE v_now + make_interval(secs => timer_s) END,
           first_buzz_at = NULL, priority_buzz_id = NULL
     WHERE session_id = p_session_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 13. Actions de l'animateur (appelées par le serveur après vérification
--     du propriétaire de la session). Chaque action n'est acceptée que dans
--     les phases prévues : un double appui (souris ou télécommande) ne
--     s'applique qu'une fois. Erreurs : « no_game », « wrong_step »,
--     « invalid » (traduites par la route API).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buzzer_admin(
  p_session_id uuid,
  p_action     text,
  p_args       jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now    timestamptz := clock_timestamp();
  r        public.buzzer_runtime;
  v_round  uuid;
  v_label  text;
  v_player public.buzzer_players;
  v_changed boolean := true;
BEGIN
  -- Lancer (ou relancer) : nouvelle partie, anciennes données effacées,
  -- les autres jeux sont désactivés depuis AnimaBuzz.
  IF p_action = 'launch' THEN
    DELETE FROM public.buzzer_players WHERE session_id = p_session_id;
    DELETE FROM public.buzzer_rounds WHERE session_id = p_session_id;
    INSERT INTO public.buzzer_runtime AS t (session_id, game_id, mode, teams, window_ms, timer_s, phase, version, launched_at, heartbeat_at)
    VALUES (
      p_session_id, gen_random_uuid(),
      p_args ->> 'mode',
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_args -> 'teams', '[]'::jsonb))),
      (p_args ->> 'windowMs')::integer,
      (p_args ->> 'timerS')::integer,
      'lobby', 1, v_now, v_now)
    ON CONFLICT (session_id) DO UPDATE SET
      game_id = EXCLUDED.game_id, mode = EXCLUDED.mode, teams = EXCLUDED.teams,
      window_ms = EXCLUDED.window_ms, timer_s = EXCLUDED.timer_s,
      phase = 'lobby', round_id = NULL, round_no = 0, attempt = 0,
      opened_at = NULL, deadline_at = NULL, first_buzz_at = NULL, priority_buzz_id = NULL, outcome = NULL,
      version = t.version + 1, launched_at = v_now, heartbeat_at = v_now;
    UPDATE public.sessions
       SET buzzer_active = true,
           quiz_active = false, quiz_lobby_visible = false, lineup_active = false,
           wheel_active = false, mystery_photo_active = false, affinity_active = false
     WHERE id = p_session_id;
    PERFORM public.buzzer_notify(p_session_id);
    RETURN public.buzzer_public_state(p_session_id);
  END IF;

  -- Quitter : tout est effacé (joueurs, buzz, manches, état).
  IF p_action = 'exit' THEN
    DELETE FROM public.buzzer_players WHERE session_id = p_session_id;
    DELETE FROM public.buzzer_rounds WHERE session_id = p_session_id;
    DELETE FROM public.buzzer_runtime WHERE session_id = p_session_id;
    UPDATE public.sessions SET buzzer_active = false WHERE id = p_session_id AND buzzer_active;
    PERFORM public.buzzer_notify(p_session_id);
    RETURN jsonb_build_object('active', false, 'serverNow', v_now);
  END IF;

  SELECT * INTO r FROM public.buzzer_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;

  -- Signal de vie. Au retour d'une pause, une manche ouverte est remise en
  -- attente (personne ne buzze dans le vide) et les téléphones sont prévenus.
  IF p_action = 'heartbeat' THEN
    IF r.heartbeat_at >= v_now - interval '90 seconds' THEN
      UPDATE public.buzzer_runtime SET heartbeat_at = v_now WHERE session_id = p_session_id;
      RETURN jsonb_build_object('v', r.version, 'resumed', false);
    END IF;
    UPDATE public.buzzer_runtime
       SET heartbeat_at = v_now, version = version + 1,
           phase = CASE WHEN phase = 'open' THEN 'waiting' ELSE phase END,
           opened_at = CASE WHEN phase = 'open' THEN NULL ELSE opened_at END,
           deadline_at = CASE WHEN phase = 'open' THEN NULL ELSE deadline_at END
     WHERE session_id = p_session_id;
    PERFORM public.buzzer_notify(p_session_id);
    RETURN public.buzzer_public_state(p_session_id);
  END IF;

  IF p_action = 'settings' THEN
    IF r.phase NOT IN ('lobby', 'test', 'waiting', 'closed') THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_runtime
       SET window_ms = coalesce((p_args ->> 'windowMs')::integer, window_ms),
           timer_s = CASE WHEN p_args ? 'timerS' THEN (p_args ->> 'timerS')::integer ELSE timer_s END
     WHERE session_id = p_session_id;

  ELSIF p_action = 'test_start' THEN
    IF r.phase NOT IN ('lobby', 'waiting', 'closed') THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_runtime SET phase = 'test' WHERE session_id = p_session_id;

  ELSIF p_action = 'test_stop' THEN
    IF r.phase <> 'test' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_runtime
       SET phase = CASE WHEN round_no = 0 THEN 'lobby' ELSE 'waiting' END
     WHERE session_id = p_session_id;

  ELSIF p_action = 'new_round' THEN
    IF r.phase NOT IN ('lobby', 'test', 'closed') THEN RAISE EXCEPTION 'wrong_step'; END IF;
    v_round := gen_random_uuid();
    INSERT INTO public.buzzer_rounds (id, session_id, game_id, round_no, started_at)
    VALUES (v_round, p_session_id, r.game_id, r.round_no + 1, v_now);
    UPDATE public.buzzer_runtime
       SET phase = 'waiting', round_id = v_round, round_no = round_no + 1, attempt = 0,
           opened_at = NULL, deadline_at = NULL, first_buzz_at = NULL, priority_buzz_id = NULL, outcome = NULL
     WHERE session_id = p_session_id;

  ELSIF p_action = 'open' THEN
    IF r.phase <> 'waiting' OR r.round_id IS NULL THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_runtime
       SET phase = 'open', attempt = attempt + 1, opened_at = v_now,
           deadline_at = CASE WHEN timer_s IS NULL THEN NULL ELSE v_now + make_interval(secs => timer_s) END,
           first_buzz_at = NULL, priority_buzz_id = NULL
     WHERE session_id = p_session_id;

  ELSIF p_action = 'timeout' THEN
    -- Fin du chrono sans buzz (tolérance d'une demi-seconde sur l'horloge de la page).
    IF r.phase <> 'open' OR r.deadline_at IS NULL OR v_now < r.deadline_at - interval '500 milliseconds' THEN
      RAISE EXCEPTION 'wrong_step';
    END IF;
    UPDATE public.buzzer_runtime SET phase = 'closed', outcome = 'no_answer', deadline_at = NULL WHERE session_id = p_session_id;
    UPDATE public.buzzer_rounds SET outcome = 'no_answer', ended_at = v_now WHERE id = r.round_id;

  ELSIF p_action = 'right' THEN
    IF r.phase <> 'buzzed' OR r.priority_buzz_id IS NULL THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_buzzes SET status = 'won' WHERE id = r.priority_buzz_id RETURNING unit_label INTO v_label;
    UPDATE public.buzzer_rounds SET outcome = 'won', winner_label = v_label, ended_at = v_now WHERE id = r.round_id;
    UPDATE public.buzzer_runtime SET phase = 'closed', outcome = 'won' WHERE session_id = p_session_id;

  ELSIF p_action = 'wrong' THEN
    IF r.phase <> 'buzzed' OR r.priority_buzz_id IS NULL THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_buzzes SET status = 'blocked' WHERE id = r.priority_buzz_id;
    PERFORM public.buzzer_pass_hand(p_session_id);

  ELSIF p_action = 'cancel' THEN
    IF r.phase NOT IN ('waiting', 'open', 'buzzed') OR r.round_id IS NULL THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.buzzer_rounds SET outcome = 'cancelled', ended_at = v_now WHERE id = r.round_id;
    UPDATE public.buzzer_runtime
       SET phase = 'closed', outcome = 'cancelled', deadline_at = NULL, priority_buzz_id = NULL
     WHERE session_id = p_session_id;

  ELSIF p_action = 'remove_player' THEN
    UPDATE public.buzzer_players SET removed_at = v_now
     WHERE id = (p_args ->> 'playerId')::uuid AND session_id = p_session_id AND game_id = r.game_id AND removed_at IS NULL
    RETURNING * INTO v_player;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid'; END IF;
    -- En individuel, ses buzz de la manche ne comptent plus ; s'il avait la main, elle passe.
    IF r.mode = 'solo' AND r.round_id IS NOT NULL THEN
      UPDATE public.buzzer_buzzes SET status = 'blocked'
       WHERE round_id = r.round_id AND player_id = v_player.id AND status IN ('queued', 'priority');
      IF r.phase = 'buzzed' AND r.priority_buzz_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.buzzer_buzzes WHERE id = r.priority_buzz_id AND player_id = v_player.id) THEN
        PERFORM public.buzzer_pass_hand(p_session_id);
      END IF;
    END IF;

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  UPDATE public.buzzer_runtime SET version = version + 1, heartbeat_at = v_now WHERE session_id = p_session_id;
  PERFORM public.buzzer_notify(p_session_id);
  RETURN public.buzzer_public_state(p_session_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 14. Droits sur les fonctions. Par défaut, Supabase les ouvre à tous :
--     on ferme tout, puis on ouvre au strict nécessaire.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.buzzer_public_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_pass_hand(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_join(uuid, text, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_buzz(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buzzer_ping(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- Téléphones (clé publique) : buzz et ping uniquement.
GRANT EXECUTE ON FUNCTION public.buzzer_buzz(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buzzer_ping(uuid, uuid, text, integer) TO anon, authenticated;
-- Serveur (routes API) : le reste.
GRANT EXECUTE ON FUNCTION public.buzzer_public_state(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.buzzer_join(uuid, text, text, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.buzzer_admin(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.buzzer_buzz(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.buzzer_ping(uuid, uuid, text, integer) TO service_role;

-- ---------------------------------------------------------------------
-- 15. Canaux privés « buzzer:<session> » : les invités et l'animateur
--     peuvent RECEVOIR. Aucune policy d'envoi : personne ne peut y émettre
--     depuis un navigateur (seul le serveur diffuse, via buzzer_notify).
--     Sans effet sur les canaux publics existants des autres jeux.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'buzzer_broadcast_receive'
  ) THEN
    CREATE POLICY buzzer_broadcast_receive ON realtime.messages
      FOR SELECT TO anon, authenticated
      USING (realtime.messages.extension = 'broadcast' AND (SELECT realtime.topic()) LIKE 'buzzer:%');
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) après exécution
-- ---------------------------------------------------------------------
-- SELECT column_name, column_default FROM information_schema.columns
--  WHERE table_name = 'sessions' AND column_name = 'buzzer_active';
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'buzzer_%';
-- SELECT * FROM pg_policies WHERE tablename LIKE 'buzzer_%';               -- doit être vide
-- SELECT * FROM pg_publication_tables WHERE tablename LIKE 'buzzer_%';     -- doit être vide
-- SELECT policyname FROM pg_policies WHERE schemaname = 'realtime' AND policyname = 'buzzer_broadcast_receive';
-- SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'realtime' AND p.proname = 'send';                   -- doit renvoyer 1 ligne

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- ---------------------------------------------------------------------
-- DROP POLICY IF EXISTS buzzer_broadcast_receive ON realtime.messages;
-- DROP FUNCTION IF EXISTS public.buzzer_admin(uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.buzzer_pass_hand(uuid);
-- DROP FUNCTION IF EXISTS public.buzzer_join(uuid, text, text, text, text, text, integer);
-- DROP FUNCTION IF EXISTS public.buzzer_ping(uuid, uuid, text, integer);
-- DROP FUNCTION IF EXISTS public.buzzer_buzz(uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.buzzer_notify(uuid);
-- DROP FUNCTION IF EXISTS public.buzzer_public_state(uuid);
-- DROP TABLE IF EXISTS public.buzzer_buzzes;
-- DROP TABLE IF EXISTS public.buzzer_rounds;
-- DROP TABLE IF EXISTS public.buzzer_players;
-- DROP TABLE IF EXISTS public.buzzer_runtime;
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS buzzer_active;
