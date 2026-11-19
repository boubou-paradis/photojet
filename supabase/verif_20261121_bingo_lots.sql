-- Vérification (LECTURE SEULE) après 20261121_bingo_lots.sql.
-- Chaque ligne doit afficher ok = true.

SELECT 'colonne bingo_runtime.phase_lots' AS controle, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bingo_runtime' AND column_name = 'phase_lots') AS ok
UNION ALL
SELECT 'parties existantes : 1 lot par étape', NOT EXISTS (SELECT 1 FROM public.bingo_runtime WHERE cardinality(phase_lots) > 0 AND launched_at < now() - interval '1 minute')
UNION ALL
SELECT 'fonction bingo_lots_used', to_regprocedure('public.bingo_lots_used(uuid, integer, text, boolean)') IS NOT NULL
UNION ALL
SELECT 'fonction bingo_phase_done', to_regprocedure('public.bingo_phase_done(public.bingo_runtime)') IS NOT NULL
UNION ALL
SELECT 'fonction bingo_parse_lots', to_regprocedure('public.bingo_parse_lots(jsonb, integer)') IS NOT NULL
UNION ALL
SELECT 'new_game garde les cartons (plus de DELETE avant la reprise)', position('Nouvelle partie de la SOIRÉE' IN pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_admin connaît jump_final', position('''jump_final''' IN pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_admin garde reveal (loto musical)', position('''reveal''' IN pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_public_state renvoie lotsUsed', position('''lotsUsed''' IN pg_get_functiondef('public.bingo_public_state(uuid)'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_public_state garde hidden', position('''hidden''' IN pg_get_functiondef('public.bingo_public_state(uuid)'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_claim connaît repeatCard', position('repeatCard' IN pg_get_functiondef('public.bingo_claim(uuid, uuid, text, uuid, smallint[])'::regprocedure)) > 0
UNION ALL
SELECT 'bingo_admin fermée à anon', NOT has_function_privilege('anon', 'public.bingo_admin(uuid, text, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'bingo_claim fermée à anon', NOT has_function_privilege('anon', 'public.bingo_claim(uuid, uuid, text, uuid, smallint[])', 'EXECUTE')
UNION ALL
SELECT 'bingo_lots_used fermée à anon', NOT has_function_privilege('anon', 'public.bingo_lots_used(uuid, integer, text, boolean)', 'EXECUTE')
UNION ALL
SELECT 'bingo_phase_done fermée à authenticated', NOT has_function_privilege('authenticated', 'public.bingo_phase_done(public.bingo_runtime)', 'EXECUTE')
UNION ALL
SELECT 'aucun trigger ajouté sur sessions', NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal AND tgname ILIKE '%bingo%');
