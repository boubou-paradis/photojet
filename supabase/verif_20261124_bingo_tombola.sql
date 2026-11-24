-- Vérification de 20261124_bingo_tombola.sql (LECTURE SEULE).
-- Chaque ligne doit afficher ok = true.
SELECT '3 tables créées' AS controle,
       (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'
         AND tablename IN ('bingo_tombola', 'bingo_tombola_tickets', 'bingo_tombola_draws')) = 3 AS ok
UNION ALL
SELECT 'RLS activé sur les 3 tables',
       (SELECT bool_and(rowsecurity) FROM pg_tables WHERE schemaname = 'public'
         AND tablename IN ('bingo_tombola', 'bingo_tombola_tickets', 'bingo_tombola_draws'))
UNION ALL
SELECT 'aucune policy (tables fermées)',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'bingo_tombola%')
UNION ALL
SELECT 'anon et authenticated sans accès',
       NOT has_table_privilege('anon', 'public.bingo_tombola', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.bingo_tombola_tickets', 'INSERT')
   AND NOT has_table_privilege('authenticated', 'public.bingo_tombola_draws', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.bingo_tombola', 'UPDATE')
UNION ALL
SELECT 'hors publication realtime',
       NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE tablename LIKE 'bingo_tombola%')
UNION ALL
SELECT '6 fonctions créées',
       (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname IN ('bingo_tombola_parse_ranges', 'bingo_tombola_public_state',
               'bingo_tombola_notify', 'bingo_tombola_ticket', 'bingo_tombola_admin', 'bingo_tombola_purge_stale')) = 6
UNION ALL
SELECT 'fonctions fermées à anon et authenticated',
       NOT has_function_privilege('anon', 'public.bingo_tombola_admin(uuid,text,jsonb)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.bingo_tombola_admin(uuid,text,jsonb)', 'EXECUTE')
   AND NOT has_function_privilege('anon', 'public.bingo_tombola_ticket(uuid,text)', 'EXECUTE')
   AND NOT has_function_privilege('authenticated', 'public.bingo_tombola_public_state(uuid)', 'EXECUTE')
UNION ALL
SELECT 'service_role peut appeler les fonctions',
       has_function_privilege('service_role', 'public.bingo_tombola_admin(uuid,text,jsonb)', 'EXECUTE')
   AND has_function_privilege('service_role', 'public.bingo_tombola_ticket(uuid,text)', 'EXECUTE')
   AND has_function_privilege('service_role', 'public.bingo_tombola_public_state(uuid)', 'EXECUTE')
   AND has_function_privilege('service_role', 'public.bingo_tombola_purge_stale()', 'EXECUTE')
UNION ALL
SELECT 'un numéro ne sort qu''une fois (contrainte unique)',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bingo_tombola_draws_number_key')
UNION ALL
SELECT 'papier et téléphone jamais en conflit (contrainte)',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bingo_tombola_no_overlap')
UNION ALL
SELECT 'suppression en cascade avec la session',
       EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE c.contype = 'f' AND c.confdeltype = 'c' AND t.relname = 'bingo_tombola'
                  AND c.confrelid = 'public.sessions'::regclass)
UNION ALL
SELECT 'aucune colonne ni trigger ajouté à sessions',
       NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name LIKE '%tombola%')
   AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.sessions'::regclass AND tgname LIKE '%tombola%')
UNION ALL
SELECT 'aucune tombola en base (tables vides)',
       NOT EXISTS (SELECT 1 FROM public.bingo_tombola);
