-- =====================================================================
-- ANIMAVOTE (identifiant technique : vote) - AnimaJet
-- Migration ADDITIVE uniquement. À exécuter dans Supabase > SQL Editor.
--
-- Garanties :
--   - une seule colonne ajoutée à sessions (vote_active, défaut false) :
--     les autres jeux ne voient aucune différence ; aucun trigger sur sessions ;
--   - scrutins, candidats, participants et bulletins vivent dans des tables
--     FERMÉES (RLS sans policy, droits retirés à anon et authenticated) :
--     un téléphone ne peut ni les lire ni y écrire, même avec la clé publique ;
--   - le téléphone n'a qu'une porte : vote_cast. Elle vérifie le jeton, le
--     scrutin, son statut, l'heure de fermeture et le candidat ;
--   - UNIQUE (event_id, participant_id) : un bulletin par téléphone et par
--     scrutin, même si deux envois arrivent en même temps ;
--   - personne ne reçoit les bulletins individuels : seulement des totaux.
--     En mode caché, seul le nombre de bulletins sort avant la révélation ;
--   - diffusions sur canaux PRIVÉS : « vote:<session> » (changements d'étape,
--     écouté par les téléphones) et « vote-live:<session> » (totaux à chaque
--     bulletin, écouté par l'écran géant). Personne ne peut y émettre ;
--   - tables hors publication realtime : leurs écritures ne notifient personne.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Colonne publique sur sessions : « AnimaVote est lancé ».
--    Lue par /invite et /live. Rien d'autre sur sessions.
-- ---------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS vote_active boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 2. Brouillon de l'éditeur (1 ligne par session) : titre, réglages et
--    candidats en cours de préparation, retrouvés après un rechargement.
--    Validé par la route API avant écriture.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_drafts (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. État d'une partie (1 ligne par session). Verrouillée (FOR UPDATE) par
--    chaque action animateur : tout passe un par un.
--    game_id : change à chaque lancement (les anciens téléphones sont oubliés).
--    event_id : scrutin affiché (1er tour, second tour, nouveau vote).
--    version : +1 à chaque changement d'étape diffusé.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_runtime (
  session_id   uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id      uuid NOT NULL,
  event_id     uuid,
  version      bigint NOT NULL DEFAULT 1,
  launched_at  timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_runtime_heartbeat_idx ON public.vote_runtime (heartbeat_at);

-- ---------------------------------------------------------------------
-- 4. Scrutins. Un second tour est un NOUVEAU scrutin (parent_id = tour
--    précédent) : nouveau droit de vote, l'ancien reste verrouillé.
--    status : lobby → open → closed → revealed.
--    closes_at : heure de fin fixée par le serveur (compte à rebours). Un
--    bulletin reçu à partir de cette heure est refusé, même si la page de
--    l'animateur ne passe jamais le scrutin à « closed ».
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id       uuid NOT NULL,
  parent_id     uuid REFERENCES public.vote_events(id) ON DELETE SET NULL,
  round_no      integer NOT NULL DEFAULT 1 CHECK (round_no BETWEEN 1 AND 50),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  subtitle      text CHECK (subtitle IS NULL OR char_length(subtitle) BETWEEN 1 AND 120),
  intro         text CHECK (intro IS NULL OR char_length(intro) BETWEEN 1 AND 280),
  thanks        text CHECK (thanks IS NULL OR char_length(thanks) BETWEEN 1 AND 280),
  display_mode  text NOT NULL DEFAULT 'photo' CHECK (display_mode IN ('photo', 'card', 'text')),
  results_mode  text NOT NULL DEFAULT 'hidden' CHECK (results_mode IN ('live', 'hidden')),
  allow_blank   boolean NOT NULL DEFAULT false,
  shuffle       boolean NOT NULL DEFAULT true,
  countdown_s   integer NOT NULL DEFAULT 10 CHECK (countdown_s IN (0, 5, 10, 15)),
  reveal_mode   text NOT NULL DEFAULT 'podium' CHECK (reveal_mode IN ('winner', 'podium', 'full')),
  status        text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'open', 'closed', 'revealed')),
  reveal_step   integer NOT NULL DEFAULT 0 CHECK (reveal_step BETWEEN 0 AND 10),
  created_at    timestamptz NOT NULL DEFAULT now(),
  opened_at     timestamptz,
  closes_at     timestamptz,
  closed_at     timestamptz,
  revealed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS vote_events_session_idx ON public.vote_events (session_id);
CREATE INDEX IF NOT EXISTS vote_events_game_idx ON public.vote_events (game_id);

-- ---------------------------------------------------------------------
-- 5. Candidats d'un scrutin. image_url : photo déposée par l'animateur dans
--    le stockage AnimaJet (vérifiée par la route API).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_candidates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.vote_events(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  number      text CHECK (number IS NULL OR char_length(number) BETWEEN 1 AND 6),
  description text CHECK (description IS NULL OR char_length(description) BETWEEN 1 AND 80),
  image_url   text CHECK (image_url IS NULL OR char_length(image_url) BETWEEN 1 AND 500),
  emoji       text CHECK (emoji IS NULL OR char_length(emoji) BETWEEN 1 AND 16),
  color       text CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  integer NOT NULL CHECK (sort_order BETWEEN 0 AND 99)
);

CREATE INDEX IF NOT EXISTS vote_candidates_event_idx ON public.vote_candidates (event_id, sort_order);
CREATE INDEX IF NOT EXISTS vote_candidates_session_idx ON public.vote_candidates (session_id);

-- ---------------------------------------------------------------------
-- 6. Participants : un téléphone dans la partie, sans pseudo. Le même
--    participant vote à chaque tour sans rescanner. token_hash : SHA-256
--    du jeton remis au téléphone.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  game_id      uuid NOT NULL,
  token_hash   text NOT NULL CHECK (char_length(token_hash) = 64),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_participants_session_idx ON public.vote_participants (session_id);
CREATE INDEX IF NOT EXISTS vote_participants_game_idx ON public.vote_participants (game_id);

-- ---------------------------------------------------------------------
-- 7. Bulletins. candidate_id NULL = vote blanc (seulement si autorisé).
--    UNIQUE (event_id, participant_id) : jamais deux bulletins d'un même
--    téléphone pour un même scrutin.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_ballots (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id       uuid NOT NULL REFERENCES public.vote_events(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.vote_participants(id) ON DELETE CASCADE,
  candidate_id   uuid REFERENCES public.vote_candidates(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT vote_ballots_event_participant_key UNIQUE (event_id, participant_id)
);

CREATE INDEX IF NOT EXISTS vote_ballots_event_candidate_idx ON public.vote_ballots (event_id, candidate_id);
CREATE INDEX IF NOT EXISTS vote_ballots_participant_idx ON public.vote_ballots (participant_id);
CREATE INDEX IF NOT EXISTS vote_ballots_session_idx ON public.vote_ballots (session_id);

-- ---------------------------------------------------------------------
-- 8. Tables fermées : aucune policy = aucun accès anon / authenticated.
-- ---------------------------------------------------------------------
ALTER TABLE public.vote_drafts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_runtime      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_candidates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_ballots      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vote_drafts, public.vote_runtime, public.vote_events, public.vote_candidates,
              public.vote_participants, public.vote_ballots
  FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Statut réel d'un scrutin : « open » dont l'heure de fin est passée
--    = « closed », même si personne ne l'a encore écrit. VOLATILE : lit
--    l'heure réelle (clock_timestamp), jamais mise en cache.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_effective_status(p_status text, p_closes_at timestamptz)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_status = 'open' AND p_closes_at IS NOT NULL AND clock_timestamp() >= p_closes_at THEN 'closed'
    ELSE p_status
  END;
$$;

-- ---------------------------------------------------------------------
-- 10. Totaux d'un scrutin : nombre de bulletins par candidat (+ blancs).
--     Jamais qui a voté pour qui.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_tally(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.vote_ballots b WHERE b.event_id = p_event_id),
    'blank', (SELECT count(*) FROM public.vote_ballots b WHERE b.event_id = p_event_id AND b.candidate_id IS NULL),
    'counts', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'votes', coalesce(t.n, 0)) ORDER BY c.sort_order)
        FROM public.vote_candidates c
        LEFT JOIN (
          SELECT b.candidate_id, count(*) AS n FROM public.vote_ballots b
           WHERE b.event_id = p_event_id AND b.candidate_id IS NOT NULL
           GROUP BY b.candidate_id
        ) t ON t.candidate_id = c.id
       WHERE c.event_id = p_event_id
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- 11. État public d'une partie : ce que voient l'écran géant
--     (p_for_phone = false) et les téléphones (p_for_phone = true).
--     Résultats par candidat inclus seulement :
--       - pour l'écran, en mode direct pendant et après le vote, ou après
--         la révélation en mode caché ;
--       - jamais pour les téléphones (ils regardent l'écran géant).
--     En mode caché, avant la révélation : seulement le nombre de bulletins.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_public_state(p_session_id uuid, p_for_phone boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r          public.vote_runtime;
  e          public.vote_events;
  v_status   text;
  v_cands    jsonb;
  v_tally    jsonb;
  v_people   integer;
  v_results  jsonb := NULL;
BEGIN
  SELECT * INTO r FROM public.vote_runtime WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'serverNow', clock_timestamp());
  END IF;

  SELECT count(*) INTO v_people FROM public.vote_participants WHERE game_id = r.game_id;

  IF r.event_id IS NULL THEN
    RETURN jsonb_build_object(
      'active', true, 'v', r.version, 'event', NULL, 'participants', v_people,
      'total', 0, 'results', NULL, 'serverNow', clock_timestamp()
    );
  END IF;

  SELECT * INTO e FROM public.vote_events WHERE id = r.event_id;
  v_status := public.vote_effective_status(e.status, e.closes_at);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'label', c.label, 'number', c.number, 'description', c.description,
           'imageUrl', c.image_url, 'emoji', c.emoji, 'color', c.color, 'sortOrder', c.sort_order
         ) ORDER BY c.sort_order), '[]'::jsonb)
    INTO v_cands
    FROM public.vote_candidates c WHERE c.event_id = e.id;

  v_tally := public.vote_tally(e.id);

  IF NOT p_for_phone AND (
       (e.results_mode = 'live' AND v_status IN ('open', 'closed', 'revealed'))
       OR v_status = 'revealed'
     ) THEN
    v_results := jsonb_build_object('blank', v_tally -> 'blank', 'counts', v_tally -> 'counts');
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'v', r.version,
    'event', jsonb_build_object(
      'id', e.id, 'roundNo', e.round_no, 'parentId', e.parent_id,
      'title', e.title, 'subtitle', e.subtitle, 'intro', e.intro, 'thanks', e.thanks,
      'displayMode', e.display_mode, 'resultsMode', e.results_mode, 'allowBlank', e.allow_blank,
      'shuffle', e.shuffle, 'countdownS', e.countdown_s, 'revealMode', e.reveal_mode,
      'status', v_status, 'closesAt', CASE WHEN v_status = 'open' THEN e.closes_at END,
      'revealStep', e.reveal_step, 'candidates', v_cands
    ),
    'participants', v_people,
    'total', (v_tally ->> 'total')::integer,
    'results', v_results,
    'serverNow', clock_timestamp()
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 12. Diffusions. Un échec de diffusion n'annule JAMAIS un vote ni une
--     action : il est ignoré (les écrans relisent l'état à la reconnexion).
--     vote_notify : changement d'étape → téléphones ET écran géant.
--     vote_notify_tally : nouveau bulletin → écran géant seulement.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_notify(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.vote_public_state(p_session_id, true), 'state', 'vote:' || p_session_id::text, true);
    PERFORM realtime.send(public.vote_public_state(p_session_id, false), 'state', 'vote-live:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AnimaVote] diffusion impossible : %', SQLERRM;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_notify_tally(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM realtime.send(public.vote_public_state(p_session_id, false), 'state', 'vote-live:' || p_session_id::text, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[AnimaVote] diffusion impossible : %', SQLERRM;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 13. LE VOTE. Seule écriture possible depuis un téléphone. Vérifie tout :
--     jeton valide, scrutin de la même partie, ouvert, heure de fin pas
--     dépassée, candidat de ce scrutin (ou vote blanc autorisé).
--     Le scrutin est pris en lecture partagée (FOR SHARE) : les votes passent
--     en parallèle, mais la fermeture attend qu'ils soient finis, puis plus
--     aucun ne passe.
--     Réponses : recorded | already (avec le choix déjà enregistré) |
--     closed | invalid | unknown_participant | no_game.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_cast(
  p_session_id     uuid,
  p_participant_id uuid,
  p_token          text,
  p_event_id       uuid,
  p_candidate_id   uuid,
  p_blank          boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e        public.vote_events;
  p        public.vote_participants;
  v_id     bigint;
  v_prev   uuid;
BEGIN
  IF p_session_id IS NULL OR p_participant_id IS NULL OR p_event_id IS NULL OR p_token IS NULL
     OR char_length(p_token) NOT BETWEEN 32 AND 128
     OR (coalesce(p_blank, false) AND p_candidate_id IS NOT NULL)
     OR (NOT coalesce(p_blank, false) AND p_candidate_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO p FROM public.vote_participants
   WHERE id = p_participant_id
     AND session_id = p_session_id
     AND token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unknown_participant');
  END IF;

  SELECT * INTO e FROM public.vote_events
   WHERE id = p_event_id AND session_id = p_session_id AND game_id = p.game_id
   FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;

  -- Déjà voté : on redonne SON choix, quel que soit le statut (double appui,
  -- renvoi après coupure réseau, confirmation arrivée après la fermeture).
  SELECT candidate_id INTO v_prev FROM public.vote_ballots
   WHERE event_id = e.id AND participant_id = p.id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'candidateId', v_prev, 'blank', v_prev IS NULL);
  END IF;

  -- Heure lue APRÈS avoir obtenu le scrutin : une fermeture validée avant
  -- est forcément vue ici.
  IF e.status <> 'open' OR (e.closes_at IS NOT NULL AND clock_timestamp() >= e.closes_at) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed');
  END IF;

  IF coalesce(p_blank, false) THEN
    IF NOT e.allow_blank THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.vote_candidates WHERE id = p_candidate_id AND event_id = e.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  INSERT INTO public.vote_ballots (event_id, session_id, participant_id, candidate_id)
  VALUES (e.id, p_session_id, p.id, CASE WHEN coalesce(p_blank, false) THEN NULL ELSE p_candidate_id END)
  ON CONFLICT (event_id, participant_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Deux envois simultanés : l'autre est passé en premier.
    SELECT candidate_id INTO v_prev FROM public.vote_ballots
     WHERE event_id = e.id AND participant_id = p.id;
    RETURN jsonb_build_object('ok', true, 'already', true, 'candidateId', v_prev, 'blank', v_prev IS NULL);
  END IF;

  UPDATE public.vote_participants SET last_seen_at = now() WHERE id = p.id;
  PERFORM public.vote_notify_tally(p_session_id);
  RETURN jsonb_build_object('ok', true, 'already', false,
    'candidateId', CASE WHEN coalesce(p_blank, false) THEN NULL ELSE p_candidate_id END,
    'blank', coalesce(p_blank, false));
END;
$$;

-- ---------------------------------------------------------------------
-- 14. Arrivée d'un téléphone (appelée par le serveur seulement). Plafond
--     vérifié sous le verrou de la partie : deux arrivées simultanées ne
--     peuvent pas le dépasser.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_join(
  p_session_id      uuid,
  p_token_hash      text,
  p_max_participants integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r       public.vote_runtime;
  v_count integer;
  v_id    uuid;
BEGIN
  SELECT * INTO r FROM public.vote_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;

  SELECT count(*) INTO v_count FROM public.vote_participants WHERE game_id = r.game_id;
  IF v_count >= p_max_participants THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  INSERT INTO public.vote_participants (session_id, game_id, token_hash)
  VALUES (p_session_id, r.game_id, p_token_hash)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'participantId', v_id, 'gameId', r.game_id);
END;
$$;

-- ---------------------------------------------------------------------
-- 15. Création d'un scrutin et de ses candidats à partir du JSON validé par
--     la route API (lancement, nouveau vote, modification dans le lobby).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_insert_candidates(p_session_id uuid, p_event_id uuid, p_candidates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.vote_candidates (event_id, session_id, label, number, description, image_url, emoji, color, sort_order)
  SELECT p_event_id, p_session_id,
         c ->> 'label', c ->> 'number', c ->> 'description', c ->> 'imageUrl', c ->> 'emoji', c ->> 'color',
         (ord - 1)::integer
    FROM jsonb_array_elements(p_candidates) WITH ORDINALITY AS x(c, ord);
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_create_event(
  p_session_id uuid,
  p_game_id    uuid,
  p_args       jsonb,
  p_parent_id  uuid,
  p_round_no   integer,
  p_status     text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.vote_events (
    session_id, game_id, parent_id, round_no, title, subtitle, intro, thanks,
    display_mode, results_mode, allow_blank, shuffle, countdown_s, reveal_mode, status, opened_at
  ) VALUES (
    p_session_id, p_game_id, p_parent_id, p_round_no,
    p_args ->> 'title', p_args ->> 'subtitle', p_args ->> 'intro', p_args ->> 'thanks',
    p_args ->> 'displayMode', p_args ->> 'resultsMode',
    (p_args ->> 'allowBlank')::boolean, (p_args ->> 'shuffle')::boolean,
    (p_args ->> 'countdownS')::integer, p_args ->> 'revealMode',
    p_status, CASE WHEN p_status = 'open' THEN clock_timestamp() END
  ) RETURNING id INTO v_id;
  PERFORM public.vote_insert_candidates(p_session_id, v_id, coalesce(p_args -> 'candidates', '[]'::jsonb));
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 16. Actions de l'animateur (appelées par le serveur après vérification
--     du propriétaire de la session). Chaque action n'est acceptée qu'à
--     l'étape prévue : un double appui (souris ou télécommande) ne
--     s'applique qu'une fois. Erreurs : « no_game », « wrong_step »,
--     « invalid » (traduites par la route API).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_admin(
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
  r        public.vote_runtime;
  e        public.vote_events;
  v_status text;
  v_game   uuid;
  v_event  uuid;
  v_ids    uuid[];
  v_n      integer;
BEGIN
  -- Lancer (ou relancer) : nouvelle partie, anciennes données effacées,
  -- 1er scrutin dans le lobby, les autres jeux sont désactivés.
  IF p_action = 'launch' THEN
    DELETE FROM public.vote_events WHERE session_id = p_session_id;
    DELETE FROM public.vote_participants WHERE session_id = p_session_id;
    v_game := gen_random_uuid();
    INSERT INTO public.vote_runtime AS t (session_id, game_id, event_id, version, launched_at, heartbeat_at)
    VALUES (p_session_id, v_game, NULL, 1, v_now, v_now)
    ON CONFLICT (session_id) DO UPDATE SET
      game_id = EXCLUDED.game_id, event_id = NULL, version = t.version + 1,
      launched_at = v_now, heartbeat_at = v_now;
    v_event := public.vote_create_event(p_session_id, v_game, p_args, NULL, 1, 'lobby');
    UPDATE public.vote_runtime SET event_id = v_event WHERE session_id = p_session_id;
    UPDATE public.sessions
       SET vote_active = true,
           quiz_active = false, quiz_lobby_visible = false, lineup_active = false,
           wheel_active = false, mystery_photo_active = false, affinity_active = false,
           buzzer_active = false
     WHERE id = p_session_id;
    PERFORM public.vote_notify(p_session_id);
    RETURN public.vote_public_state(p_session_id, false);
  END IF;

  -- Quitter : tout est effacé (scrutins, candidats, participants, bulletins).
  -- Le brouillon de l'éditeur est gardé.
  IF p_action = 'exit' THEN
    DELETE FROM public.vote_events WHERE session_id = p_session_id;
    DELETE FROM public.vote_participants WHERE session_id = p_session_id;
    DELETE FROM public.vote_runtime WHERE session_id = p_session_id;
    UPDATE public.sessions SET vote_active = false WHERE id = p_session_id AND vote_active;
    PERFORM public.vote_notify(p_session_id);
    RETURN jsonb_build_object('active', false, 'serverNow', v_now);
  END IF;

  SELECT * INTO r FROM public.vote_runtime WHERE session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_game';
  END IF;

  IF p_action = 'heartbeat' THEN
    UPDATE public.vote_runtime SET heartbeat_at = v_now WHERE session_id = p_session_id;
    RETURN jsonb_build_object('v', r.version);
  END IF;

  IF r.event_id IS NOT NULL THEN
    SELECT * INTO e FROM public.vote_events WHERE id = r.event_id FOR UPDATE;
    -- Compte à rebours écoulé : le scrutin est fermé pour de bon.
    IF e.status = 'open' AND e.closes_at IS NOT NULL AND v_now >= e.closes_at THEN
      UPDATE public.vote_events SET status = 'closed', closed_at = e.closes_at WHERE id = e.id;
      e.status := 'closed';
    END IF;
    v_status := e.status;
  END IF;

  IF p_action = 'edit' THEN
    -- Corriger le scrutin avant l'ouverture (faute de frappe, photo).
    IF v_status IS DISTINCT FROM 'lobby' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.vote_events SET
      title = p_args ->> 'title', subtitle = p_args ->> 'subtitle', intro = p_args ->> 'intro', thanks = p_args ->> 'thanks',
      display_mode = p_args ->> 'displayMode', results_mode = p_args ->> 'resultsMode',
      allow_blank = (p_args ->> 'allowBlank')::boolean, shuffle = (p_args ->> 'shuffle')::boolean,
      countdown_s = (p_args ->> 'countdownS')::integer, reveal_mode = p_args ->> 'revealMode'
     WHERE id = e.id;
    DELETE FROM public.vote_candidates WHERE event_id = e.id;
    PERFORM public.vote_insert_candidates(p_session_id, e.id, coalesce(p_args -> 'candidates', '[]'::jsonb));

  ELSIF p_action = 'open' THEN
    IF v_status IS DISTINCT FROM 'lobby' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.vote_events SET status = 'open', opened_at = v_now, closes_at = NULL WHERE id = e.id;

  ELSIF p_action = 'close' THEN
    -- Fermeture : immédiate, ou heure de fin dans N secondes (compte à rebours).
    IF v_status IS DISTINCT FROM 'open' OR e.closes_at IS NOT NULL THEN RAISE EXCEPTION 'wrong_step'; END IF;
    IF e.countdown_s = 0 THEN
      UPDATE public.vote_events SET status = 'closed', closes_at = v_now, closed_at = v_now WHERE id = e.id;
    ELSE
      UPDATE public.vote_events SET closes_at = v_now + make_interval(secs => e.countdown_s) WHERE id = e.id;
    END IF;

  ELSIF p_action = 'cancel_close' THEN
    IF v_status IS DISTINCT FROM 'open' OR e.closes_at IS NULL THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.vote_events SET closes_at = NULL WHERE id = e.id;

  ELSIF p_action = 'settle' THEN
    -- Fin du compte à rebours vue par la page animateur : déjà traitée plus
    -- haut si l'heure est passée. Sinon, rien à faire.
    IF v_status IS DISTINCT FROM 'closed' THEN RAISE EXCEPTION 'wrong_step'; END IF;

  ELSIF p_action = 'reveal' THEN
    IF v_status IS DISTINCT FROM 'closed' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    UPDATE public.vote_events SET status = 'revealed', reveal_step = 0, revealed_at = v_now WHERE id = e.id;

  ELSIF p_action = 'reveal_next' THEN
    -- Étapes de la révélation (le nombre d'étapes dépend du mode, décidé par
    -- l'application) : on refuse une étape qui n'est pas la suivante attendue,
    -- donc un double appui n'en saute pas deux.
    IF v_status IS DISTINCT FROM 'revealed' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    IF (p_args ->> 'from') IS NULL OR (p_args ->> 'from')::integer <> e.reveal_step OR e.reveal_step >= 10 THEN
      RAISE EXCEPTION 'wrong_step';
    END IF;
    UPDATE public.vote_events SET reveal_step = reveal_step + 1 WHERE id = e.id;

  ELSIF p_action = 'second_round' THEN
    -- Nouveau scrutin, ouvert tout de suite, avec les candidats choisis
    -- parmi ceux du scrutin fermé. Mêmes réglages. Pas de rescan.
    IF v_status NOT IN ('closed', 'revealed') THEN RAISE EXCEPTION 'wrong_step'; END IF;
    SELECT array_agg(DISTINCT x::uuid) INTO v_ids FROM jsonb_array_elements_text(coalesce(p_args -> 'candidateIds', '[]'::jsonb)) x;
    v_n := coalesce(cardinality(v_ids), 0);
    IF v_n < 2 OR v_n <> (SELECT count(*) FROM public.vote_candidates WHERE event_id = e.id AND id = ANY (v_ids)) THEN
      RAISE EXCEPTION 'invalid';
    END IF;
    INSERT INTO public.vote_events (
      session_id, game_id, parent_id, round_no, title, subtitle, intro, thanks,
      display_mode, results_mode, allow_blank, shuffle, countdown_s, reveal_mode, status, opened_at
    ) VALUES (
      p_session_id, r.game_id, e.id, least(e.round_no + 1, 50), e.title, e.subtitle, e.intro, e.thanks,
      e.display_mode, e.results_mode, e.allow_blank, e.shuffle, e.countdown_s, e.reveal_mode, 'open', v_now
    ) RETURNING id INTO v_event;
    INSERT INTO public.vote_candidates (event_id, session_id, label, number, description, image_url, emoji, color, sort_order)
    SELECT v_event, p_session_id, c.label, c.number, c.description, c.image_url, c.emoji, c.color,
           (row_number() OVER (ORDER BY c.sort_order) - 1)::integer
      FROM public.vote_candidates c
     WHERE c.event_id = e.id AND c.id = ANY (v_ids);
    UPDATE public.vote_runtime SET event_id = v_event WHERE session_id = p_session_id;

  ELSIF p_action = 'new_vote' THEN
    -- Nouveau scrutin (autre élection), dans le lobby. Les téléphones restent
    -- connectés. Interdit pendant un vote ouvert.
    IF v_status = 'open' THEN RAISE EXCEPTION 'wrong_step'; END IF;
    v_event := public.vote_create_event(p_session_id, r.game_id, p_args, NULL, 1, 'lobby');
    UPDATE public.vote_runtime SET event_id = v_event WHERE session_id = p_session_id;

  ELSE
    RAISE EXCEPTION 'invalid';
  END IF;

  UPDATE public.vote_runtime SET version = version + 1, heartbeat_at = v_now WHERE session_id = p_session_id;
  PERFORM public.vote_notify(p_session_id);
  RETURN public.vote_public_state(p_session_id, false);
END;
$$;

-- ---------------------------------------------------------------------
-- 17. Droits sur les fonctions. Par défaut, Supabase les ouvre à tous :
--     on ferme tout, puis on ouvre au strict nécessaire.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.vote_effective_status(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_tally(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_public_state(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_notify_tally(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_cast(uuid, uuid, text, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_join(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_insert_candidates(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_create_event(uuid, uuid, jsonb, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_admin(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Téléphones (clé publique) : le vote uniquement.
GRANT EXECUTE ON FUNCTION public.vote_cast(uuid, uuid, text, uuid, uuid, boolean) TO anon, authenticated;
-- Serveur (routes API) : le reste.
GRANT EXECUTE ON FUNCTION public.vote_cast(uuid, uuid, text, uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.vote_tally(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vote_public_state(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.vote_join(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.vote_admin(uuid, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------
-- 18. Canaux privés « vote:<session> » et « vote-live:<session> » : les
--     invités, l'écran géant et l'animateur peuvent RECEVOIR. Aucune policy
--     d'envoi : personne ne peut y émettre depuis un navigateur.
--     Sans effet sur les canaux des autres jeux.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'vote_broadcast_receive'
  ) THEN
    CREATE POLICY vote_broadcast_receive ON realtime.messages
      FOR SELECT TO anon, authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND ((SELECT realtime.topic()) LIKE 'vote:%' OR (SELECT realtime.topic()) LIKE 'vote-live:%')
      );
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Vérification (lecture seule) après exécution
-- ---------------------------------------------------------------------
-- SELECT column_name, column_default FROM information_schema.columns
--  WHERE table_name = 'sessions' AND column_name = 'vote_active';
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'vote\_%';
-- SELECT * FROM pg_policies WHERE tablename LIKE 'vote\_%';               -- doit être vide
-- SELECT * FROM pg_publication_tables WHERE tablename LIKE 'vote\_%';     -- doit être vide
-- SELECT policyname FROM pg_policies WHERE schemaname = 'realtime' AND policyname = 'vote_broadcast_receive';

-- ---------------------------------------------------------------------
-- Retour arrière (NE PAS exécuter sauf décision explicite)
-- ---------------------------------------------------------------------
-- DROP POLICY IF EXISTS vote_broadcast_receive ON realtime.messages;
-- DROP FUNCTION IF EXISTS public.vote_admin(uuid, text, jsonb);
-- DROP FUNCTION IF EXISTS public.vote_create_event(uuid, uuid, jsonb, uuid, integer, text);
-- DROP FUNCTION IF EXISTS public.vote_insert_candidates(uuid, uuid, jsonb);
-- DROP FUNCTION IF EXISTS public.vote_join(uuid, text, integer);
-- DROP FUNCTION IF EXISTS public.vote_cast(uuid, uuid, text, uuid, uuid, boolean);
-- DROP FUNCTION IF EXISTS public.vote_notify_tally(uuid);
-- DROP FUNCTION IF EXISTS public.vote_notify(uuid);
-- DROP FUNCTION IF EXISTS public.vote_public_state(uuid, boolean);
-- DROP FUNCTION IF EXISTS public.vote_tally(uuid);
-- DROP FUNCTION IF EXISTS public.vote_effective_status(text, timestamptz);
-- DROP TABLE IF EXISTS public.vote_ballots;
-- DROP TABLE IF EXISTS public.vote_participants;
-- DROP TABLE IF EXISTS public.vote_candidates;
-- DROP TABLE IF EXISTS public.vote_events;
-- DROP TABLE IF EXISTS public.vote_runtime;
-- DROP TABLE IF EXISTS public.vote_drafts;
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS vote_active;
