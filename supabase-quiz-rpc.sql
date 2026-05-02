-- =====================================================
-- RPC QUIZ ATOMIQUES - AnimaJet
-- À exécuter dans Supabase Dashboard > SQL Editor
-- Ces fonctions éliminent les race conditions sur quiz_participants / quiz_answers
-- =====================================================

-- Enregistrement atomique d'un joueur
CREATE OR REPLACE FUNCTION register_quiz_player(
  p_session_id UUID,
  p_player_id  TEXT,
  p_player_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_raw  TEXT;
  v_arr  JSONB;
  i      INTEGER;
BEGIN
  SELECT quiz_participants INTO v_raw
  FROM sessions WHERE id = p_session_id FOR UPDATE;

  BEGIN v_arr := COALESCE(v_raw, '[]')::JSONB;
  EXCEPTION WHEN OTHERS THEN v_arr := '[]'::JSONB; END;

  FOR i IN 0..jsonb_array_length(v_arr)-1 LOOP
    IF v_arr->i->>'odientId' = p_player_id THEN
      RETURN jsonb_build_object('ok', true, 'existing', true);
    END IF;
  END LOOP;

  v_arr := v_arr || jsonb_build_array(jsonb_build_object(
    'odientId', p_player_id,
    'odientName', p_player_name,
    'totalScore', 0,
    'correctAnswers', 0
  ));

  UPDATE sessions SET quiz_participants = v_arr::TEXT WHERE id = p_session_id;
  RETURN jsonb_build_object('ok', true, 'existing', false);
END;
$$;

-- Sauvegarde atomique d'une réponse + mise à jour du score
CREATE OR REPLACE FUNCTION submit_quiz_answer(
  p_session_id   UUID,
  p_player_id    TEXT,
  p_player_name  TEXT,
  p_question_id  TEXT,
  p_answer_index INTEGER,
  p_points       INTEGER,
  p_is_correct   BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_raw_p TEXT; v_raw_a TEXT;
  v_parts JSONB; v_ans   JSONB;
  v_idx   INTEGER := -1;
  i       INTEGER;
BEGIN
  SELECT quiz_participants, quiz_answers
  INTO v_raw_p, v_raw_a
  FROM sessions WHERE id = p_session_id FOR UPDATE;

  BEGIN v_parts := COALESCE(v_raw_p, '[]')::JSONB;
  EXCEPTION WHEN OTHERS THEN v_parts := '[]'::JSONB; END;

  BEGIN v_ans := COALESCE(v_raw_a, '[]')::JSONB;
  EXCEPTION WHEN OTHERS THEN v_ans := '[]'::JSONB; END;

  -- Anti-doublon : ignorer si déjà répondu à cette question
  FOR i IN 0..jsonb_array_length(v_ans)-1 LOOP
    IF v_ans->i->>'odientId' = p_player_id AND v_ans->i->>'questionId' = p_question_id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_answered');
    END IF;
  END LOOP;

  -- Ajouter la réponse
  v_ans := v_ans || jsonb_build_array(jsonb_build_object(
    'odientId', p_player_id,
    'questionId', p_question_id,
    'answerIndex', p_answer_index,
    'timestamp', floor(extract(epoch from now()) * 1000)::BIGINT
  ));

  -- Mettre à jour le score
  FOR i IN 0..jsonb_array_length(v_parts)-1 LOOP
    IF v_parts->i->>'odientId' = p_player_id THEN
      v_idx := i; EXIT;
    END IF;
  END LOOP;

  IF v_idx >= 0 THEN
    v_parts := jsonb_set(v_parts, ARRAY[v_idx::TEXT, 'totalScore'],
      to_jsonb((v_parts->v_idx->>'totalScore')::INTEGER + p_points));
    IF p_is_correct THEN
      v_parts := jsonb_set(v_parts, ARRAY[v_idx::TEXT, 'correctAnswers'],
        to_jsonb((v_parts->v_idx->>'correctAnswers')::INTEGER + 1));
    END IF;
  ELSE
    v_parts := v_parts || jsonb_build_array(jsonb_build_object(
      'odientId', p_player_id,
      'odientName', p_player_name,
      'totalScore', p_points,
      'correctAnswers', CASE WHEN p_is_correct THEN 1 ELSE 0 END
    ));
  END IF;

  UPDATE sessions
  SET quiz_answers = v_ans::TEXT, quiz_participants = v_parts::TEXT
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

SELECT '✅ RPC quiz créés : register_quiz_player + submit_quiz_answer' AS result;
