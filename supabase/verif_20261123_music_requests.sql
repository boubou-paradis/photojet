-- Vérification de 20261123_music_requests.sql (LECTURE SEULE).
-- Chaque ligne doit afficher ok = true.
SELECT '4 tables créées' AS controle,
       (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'
         AND tablename IN ('music_request_settings', 'music_requests', 'music_request_aliases', 'music_request_decisions')) = 4 AS ok
UNION ALL
SELECT 'RLS activé sur les 4 tables',
       (SELECT bool_and(rowsecurity) FROM pg_tables WHERE schemaname = 'public'
         AND tablename IN ('music_request_settings', 'music_requests', 'music_request_aliases', 'music_request_decisions'))
UNION ALL
SELECT 'aucune policy (tables fermées)',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'music_request%')
UNION ALL
SELECT 'anon ne peut ni lire ni écrire',
       NOT has_table_privilege('anon', 'public.music_requests', 'SELECT')
   AND NOT has_table_privilege('anon', 'public.music_requests', 'INSERT')
   AND NOT has_table_privilege('anon', 'public.music_request_settings', 'SELECT')
UNION ALL
SELECT 'authenticated ne peut ni lire ni écrire',
       NOT has_table_privilege('authenticated', 'public.music_requests', 'SELECT')
   AND NOT has_table_privilege('authenticated', 'public.music_request_settings', 'UPDATE')
   AND NOT has_table_privilege('authenticated', 'public.music_request_decisions', 'INSERT')
UNION ALL
SELECT 'hors publication realtime',
       NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE tablename LIKE 'music_request%')
UNION ALL
SELECT 'suppression en cascade avec la session (4 clés)',
       (SELECT count(*) FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
         WHERE c.contype = 'f' AND c.confdeltype = 'c'
           AND c.confrelid = 'public.sessions'::regclass
           AND t.relname IN ('music_request_settings', 'music_requests', 'music_request_aliases', 'music_request_decisions')) = 4
UNION ALL
SELECT 'longueurs titre 80 / artiste 60 imposées',
       pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid = 'public.music_requests'::regclass AND pg_get_constraintdef(oid) LIKE '%char_length(title)%')) LIKE '%80%'
   AND pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid = 'public.music_requests'::regclass AND pg_get_constraintdef(oid) LIKE '%char_length(artist)%')) LIKE '%60%'
UNION ALL
SELECT 'désactivé par défaut',
       (SELECT column_default FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'music_request_settings' AND column_name = 'enabled') = 'false'
UNION ALL
SELECT 'aucune colonne music ajoutée à sessions',
       NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name LIKE 'music%');
