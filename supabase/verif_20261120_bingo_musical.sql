-- Vérification (LECTURE SEULE) après 20261120_bingo_musical.sql.
-- Chaque ligne doit afficher ok = true.

SELECT 'table saved_bingo_playlists' AS controle, to_regclass('public.saved_bingo_playlists') IS NOT NULL AS ok
UNION ALL
SELECT 'RLS saved_bingo_playlists', relrowsecurity FROM pg_class WHERE oid = 'public.saved_bingo_playlists'::regclass
UNION ALL
SELECT '4 règles propriétaire', (SELECT count(*) = 4 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_bingo_playlists')
UNION ALL
SELECT 'table bingo_music', to_regclass('public.bingo_music') IS NOT NULL
UNION ALL
SELECT 'bingo_music fermée (RLS, aucune règle)', relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bingo_music')
  FROM pg_class WHERE oid = 'public.bingo_music'::regclass
UNION ALL
SELECT 'bingo_music invisible pour anon', NOT has_table_privilege('anon', 'public.bingo_music', 'SELECT')
UNION ALL
SELECT 'bingo_music invisible pour authenticated', NOT has_table_privilege('authenticated', 'public.bingo_music', 'SELECT')
UNION ALL
SELECT 'colonne bingo_cards.music_sig', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bingo_cards' AND column_name = 'music_sig')
UNION ALL
SELECT 'bingo_admin connaît reveal', position('''reveal''' IN pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_public_state renvoie hidden', position('''hidden''' IN pg_get_functiondef('public.bingo_public_state(uuid)'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_admin fermée à anon', NOT has_function_privilege('anon', 'public.bingo_admin(uuid, text, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'bingo_admin fermée à authenticated', NOT has_function_privilege('authenticated', 'public.bingo_admin(uuid, text, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'bingo_public_state fermée à anon', NOT has_function_privilege('anon', 'public.bingo_public_state(uuid)', 'EXECUTE')
UNION ALL
SELECT 'aucun trigger ajouté sur sessions', NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal AND tgname ILIKE '%bingo%');
