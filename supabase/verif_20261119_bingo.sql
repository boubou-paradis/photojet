-- Vérification AnimaBingo (lecture seule). À lancer APRÈS la migration 20261119_create_bingo.sql.
-- Attendu : 10 lignes, toutes avec ok = true.
SELECT 1 AS n, 'colonne sessions.bingo_active' AS controle, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'bingo_active') AS ok
UNION ALL SELECT 2, '4 tables bingo_ avec RLS', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('bingo_runtime', 'bingo_players', 'bingo_cards', 'bingo_claims') AND rowsecurity) = 4
UNION ALL SELECT 3, 'aucune policy sur les tables', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'bingo_%') = 0
UNION ALL SELECT 4, 'tables hors publication realtime', (SELECT count(*) FROM pg_publication_tables WHERE tablename LIKE 'bingo_%') = 0
UNION ALL SELECT 5, '7 fonctions bingo_', (SELECT count(*) FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'public' AND p.proname IN ('bingo_complete_lines', 'bingo_public_state', 'bingo_notify', 'bingo_join', 'bingo_claim', 'bingo_admin', 'bingo_purge_stale')) = 7
UNION ALL SELECT 6, 'anon ne peut lire aucune table', NOT (has_table_privilege('anon', 'public.bingo_runtime', 'SELECT') OR has_table_privilege('anon', 'public.bingo_players', 'SELECT') OR has_table_privilege('anon', 'public.bingo_cards', 'SELECT') OR has_table_privilege('anon', 'public.bingo_claims', 'SELECT'))
UNION ALL SELECT 7, 'anon ne peut appeler aucune fonction', NOT (has_function_privilege('anon', 'public.bingo_admin(uuid,text,jsonb)', 'EXECUTE') OR has_function_privilege('anon', 'public.bingo_join(uuid,text,text,jsonb)', 'EXECUTE') OR has_function_privilege('anon', 'public.bingo_claim(uuid,uuid,text,uuid,smallint[])', 'EXECUTE'))
UNION ALL SELECT 8, 'service_role peut appeler bingo_admin', has_function_privilege('service_role', 'public.bingo_admin(uuid,text,jsonb)', 'EXECUTE')
UNION ALL SELECT 9, 'canal privé bingo: en réception', EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'bingo_broadcast_receive')
UNION ALL SELECT 10, 'calcul des lignes (1 ligne complète)', public.bingo_complete_lines('{1,0,22,0,41,0,63,0,80,0,12,0,35,0,57,0,74,85,5,0,28,0,49,0,66,0,90}', '{1,22,41,63,80,12}') = 1
ORDER BY n;
