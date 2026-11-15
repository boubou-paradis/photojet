-- =====================================================================
-- À DEMI-MOT 20 ÉQUIPES - vérification de 20261117_demimot_20_equipes.sql
-- LECTURE SEULE : aucune écriture, à lancer dans Supabase > SQL Editor
-- après la migration. Résultat : une ligne par contrôle, « ok » = true
-- partout. Ne plante jamais : si la migration n'est pas passée, les
-- lignes concernées affichent ok = false.
-- =====================================================================

WITH fn AS (
  SELECT p.oid, p.prosecdef, p.proconfig, p.prosrc
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'demimot_commit'
),
pos AS (
  SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
   WHERE conrelid = 'public.demimot_teams'::regclass AND conname = 'demimot_teams_position_check'
),
blk AS (
  SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
   WHERE conrelid = 'public.demimot_runtime'::regclass AND conname = 'demimot_runtime_gate_blocked_check'
)
SELECT * FROM (
  -- 1. Numéro d'équipe 0..19
  SELECT 1 AS n, 'demimot_teams : numéro d''équipe de 0 à 19' AS controle,
         coalesce((SELECT d FROM pos), 'contrainte absente') AS valeur,
         coalesce((SELECT d LIKE '%<= 19%' FROM pos), false) AS ok
  UNION ALL
  -- 2. Jusqu'à 20 équipes bloquées sur une énigme
  SELECT 2, 'demimot_runtime : jusqu''à 20 équipes bloquées',
         coalesce((SELECT d FROM blk), 'contrainte absente'),
         coalesce((SELECT d LIKE '%<= 20%' FROM blk), false)
  UNION ALL
  -- 3. demimot_commit accepte 20 équipes (et plus l'ancienne limite de 10)
  SELECT 3, 'demimot_commit : limite à 20 équipes',
         coalesce((SELECT CASE WHEN prosrc LIKE '%jsonb_array_length(p_teams) > 20%' THEN 'limite 20'
                               WHEN prosrc LIKE '%jsonb_array_length(p_teams) > 10%' THEN 'limite 10 : migration non appliquée'
                               ELSE 'limite introuvable' END FROM fn), 'fonction absente'),
         coalesce((SELECT prosrc LIKE '%jsonb_array_length(p_teams) > 20%' AND prosrc NOT LIKE '%jsonb_array_length(p_teams) > 10%' FROM fn), false)
  UNION ALL
  -- 4. Toujours SECURITY DEFINER avec search_path fixé
  SELECT 4, 'demimot_commit : SECURITY DEFINER + search_path',
         coalesce((SELECT CASE WHEN prosecdef THEN 'definer' ELSE 'invoker' END || ' / ' || coalesce(array_to_string(proconfig, ','), '-') FROM fn), 'fonction absente'),
         coalesce((SELECT prosecdef AND array_to_string(proconfig, ',') LIKE '%search_path%' FROM fn), false)
  UNION ALL
  -- 5. Jamais appelable par un téléphone, toujours par le serveur
  SELECT 5, 'demimot_commit : serveur seulement (ni anon ni authenticated)',
         coalesce((SELECT 'anon=' || has_function_privilege('anon', oid, 'EXECUTE')::text
                       || ' authenticated=' || has_function_privilege('authenticated', oid, 'EXECUTE')::text
                       || ' service_role=' || has_function_privilege('service_role', oid, 'EXECUTE')::text FROM fn), 'fonction absente'),
         coalesce((SELECT NOT has_function_privilege('anon', oid, 'EXECUTE')
                      AND NOT has_function_privilege('authenticated', oid, 'EXECUTE')
                      AND has_function_privilege('service_role', oid, 'EXECUTE') FROM fn), false)
  UNION ALL
  -- 6. Une seule version de demimot_commit (pas de doublon de signature)
  SELECT 6, 'une seule fonction demimot_commit',
         (SELECT count(*)::text FROM fn),
         (SELECT count(*) = 1 FROM fn)
  UNION ALL
  -- 7. Les 10 fonctions d'À Demi-Mot toujours là
  SELECT 7, '10 fonctions demimot_* toujours présentes',
         (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'demimot\_%'),
         (SELECT count(*) = 10 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'demimot\_%')
  UNION ALL
  -- 8. Aucun trigger sur sessions lié à À Demi-Mot
  SELECT 8, 'aucun trigger demimot sur sessions',
         (SELECT coalesce(string_agg(tgname, ', '), '-') FROM pg_trigger
           WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal AND tgname ILIKE '%demimot%'),
         (SELECT count(*) = 0 FROM pg_trigger
           WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal AND tgname ILIKE '%demimot%')
) controles
ORDER BY n;
