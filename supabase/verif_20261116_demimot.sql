-- =====================================================================
-- À DEMI-MOT - vérification de la migration 20261116_create_demimot.sql
-- LECTURE SEULE : aucune écriture, à lancer dans Supabase > SQL Editor
-- juste après la migration (et de nouveau le lendemain si on le souhaite).
-- Résultat : une ligne par contrôle, colonne « ok » = true partout.
-- =====================================================================

WITH fn AS (
  SELECT p.proname, p.oid, p.prosecdef, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'demimot\_%'
)
SELECT * FROM (
  -- 1. La colonne existe, NOT NULL, défaut false.
  SELECT 1 AS n, 'colonne sessions.demimot_active (boolean, NOT NULL, défaut false)' AS controle,
         (SELECT data_type || ' / ' || is_nullable || ' / ' || coalesce(column_default, '-')
            FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'demimot_active') AS valeur,
         (SELECT data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'false'
            FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'demimot_active') AS ok
  UNION ALL
  -- 2. Aucune session n'a le jeu lancé (le code n'est pas encore en ligne).
  --    (lu seulement si la colonne existe : sinon « colonne absente », ok = false)
  SELECT 2, 'aucune session avec demimot_active = true', c2.valeur, c2.valeur = '0'
    FROM (SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                                    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'demimot_active')
                      THEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.sessions WHERE demimot_active', false, true, '')))[1]::text
                      ELSE 'colonne absente : migration non appliquée' END AS valeur) c2
  UNION ALL
  -- 3. Les 5 tables existent et ont la RLS activée.
  SELECT 3, '5 tables demimot_* avec RLS',
         (SELECT count(*)::text || ' tables, ' || count(*) FILTER (WHERE rowsecurity)::text || ' avec RLS'
            FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'demimot\_%'),
         (SELECT count(*) = 5 AND bool_and(rowsecurity)
            FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'demimot\_%')
  UNION ALL
  -- 4. Aucune policy sur ces tables (tables fermées).
  SELECT 4, 'aucune policy sur les tables demimot_*',
         (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'demimot\_%'),
         (SELECT count(*) = 0 FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'demimot\_%')
  UNION ALL
  -- 5. Aucun droit pour anon / authenticated sur ces tables.
  SELECT 5, 'aucun droit anon/authenticated sur les tables',
         (SELECT count(*)::text FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name LIKE 'demimot\_%' AND grantee IN ('anon', 'authenticated', 'PUBLIC')),
         (SELECT count(*) = 0 FROM information_schema.role_table_grants
           WHERE table_schema = 'public' AND table_name LIKE 'demimot\_%' AND grantee IN ('anon', 'authenticated', 'PUBLIC'))
  UNION ALL
  -- 6. Tables hors publication realtime (leurs écritures ne notifient personne).
  SELECT 6, 'tables demimot_* hors publication realtime',
         (SELECT count(*)::text FROM pg_publication_tables WHERE tablename LIKE 'demimot\_%'),
         (SELECT count(*) = 0 FROM pg_publication_tables WHERE tablename LIKE 'demimot\_%')
  UNION ALL
  -- 7. sessions reste dans la publication realtime (les autres jeux en dépendent).
  SELECT 7, 'sessions toujours dans la publication realtime',
         (SELECT string_agg(pubname, ', ') FROM pg_publication_tables WHERE schemaname = 'public' AND tablename = 'sessions'),
         (SELECT count(*) > 0 FROM pg_publication_tables WHERE schemaname = 'public' AND tablename = 'sessions')
  UNION ALL
  -- 8. Les 10 fonctions existent, toutes SECURITY DEFINER avec search_path fixé.
  SELECT 8, '10 fonctions demimot_*, SECURITY DEFINER, search_path fixé',
         (SELECT count(*)::text || ' fonctions, ' || count(*) FILTER (WHERE prosecdef)::text || ' definer, '
                 || count(*) FILTER (WHERE array_to_string(proconfig, ',') LIKE '%search_path%')::text || ' search_path' FROM fn),
         (SELECT count(*) = 10 AND bool_and(prosecdef) AND bool_and(array_to_string(proconfig, ',') LIKE '%search_path%') FROM fn)
  UNION ALL
  -- 9. Seules demimot_buzz et demimot_ping sont appelables par un téléphone.
  SELECT 9, 'anon/authenticated : seulement demimot_buzz et demimot_ping',
         (SELECT coalesce(string_agg(proname, ', ' ORDER BY proname), '-') FROM fn
           WHERE has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE')),
         (SELECT coalesce(array_agg(proname ORDER BY proname), '{}') = ARRAY['demimot_buzz', 'demimot_ping']::name[] FROM fn
           WHERE has_function_privilege('anon', oid, 'EXECUTE') OR has_function_privilege('authenticated', oid, 'EXECUTE'))
  UNION ALL
  -- 10. La policy de réception des canaux privés « demimot:<session> ».
  SELECT 10, 'policy realtime demimot_broadcast_receive (lecture seule)',
         (SELECT string_agg(cmd || ' ' || array_to_string(roles, ','), '; ') FROM pg_policies
           WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'demimot_broadcast_receive'),
         (SELECT count(*) = 1 AND bool_and(cmd = 'SELECT') FROM pg_policies
           WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'demimot_broadcast_receive')
  UNION ALL
  -- 11. Aucun déclencheur ajouté sur sessions par cette migration.
  SELECT 11, 'aucun trigger demimot sur sessions',
         (SELECT coalesce(string_agg(tgname, ', '), '-') FROM pg_trigger
           WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal AND tgname ILIKE '%demimot%'),
         (SELECT count(*) = 0 FROM pg_trigger
           WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal AND tgname ILIKE '%demimot%')
  UNION ALL
  -- 12. Tables vides (aucune partie, aucune bibliothèque avant la mise en ligne).
  --     (lu seulement si les 5 tables existent : sinon « tables absentes », ok = false)
  SELECT 12, 'tables demimot_* vides', c12.valeur, c12.valeur = '0'
    FROM (SELECT CASE WHEN (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'
                             AND tablename IN ('demimot_runtime', 'demimot_teams', 'demimot_buzzes', 'demimot_sets', 'demimot_puzzles')) = 5
                      THEN (xpath('/row/c/text()', query_to_xml(
                             'SELECT (SELECT count(*) FROM public.demimot_runtime) + (SELECT count(*) FROM public.demimot_teams)
                                   + (SELECT count(*) FROM public.demimot_buzzes) + (SELECT count(*) FROM public.demimot_sets)
                                   + (SELECT count(*) FROM public.demimot_puzzles) AS c', false, true, '')))[1]::text
                      ELSE 'tables absentes : migration non appliquée' END AS valeur) c12
) controles
ORDER BY n;

-- Témoin à comparer AVANT / APRÈS la migration (même nombre attendu,
-- sauf la policy demimot_broadcast_receive en plus côté realtime) :
-- SELECT schemaname, tablename, count(*) FROM pg_policies
--  WHERE (schemaname = 'public' AND tablename = 'sessions') OR (schemaname = 'realtime' AND tablename = 'messages')
--  GROUP BY 1, 2;
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal ORDER BY 1;
