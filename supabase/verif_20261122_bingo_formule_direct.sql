-- Vérification de 20261122_bingo_formule_direct.sql (LECTURE SEULE).
-- Chaque ligne doit afficher ok = true.
SELECT 'bingo_admin connaît l''action formula' AS controle,
       pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure) LIKE '%ELSIF p_action = ''formula''%' AS ok
UNION ALL
SELECT 'étapes jouées protégées',
       pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure) LIKE '%v_phases[1:r.phase_index + 1] IS DISTINCT FROM r.phases[1:r.phase_index + 1]%'
UNION ALL
SELECT 'jamais sous les lots gagnés',
       pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure) LIKE '%v_lots[r.phase_index + 1] < v_used%'
UNION ALL
SELECT 'nouvelle partie garde les cartons (20261121 intact)',
       pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure) LIKE '%round_no = round_no + 1%'
UNION ALL
SELECT 'saut au carton plein présent (20261121 intact)',
       pg_get_functiondef('public.bingo_admin(uuid, text, jsonb)'::regprocedure) LIKE '%jump_final%'
UNION ALL
SELECT 'fonction toujours SECURITY DEFINER',
       (SELECT prosecdef FROM pg_proc WHERE oid = 'public.bingo_admin(uuid, text, jsonb)'::regprocedure)
UNION ALL
SELECT 'anon ne peut pas l''appeler',
       NOT has_function_privilege('anon', 'public.bingo_admin(uuid, text, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'authenticated ne peut pas l''appeler',
       NOT has_function_privilege('authenticated', 'public.bingo_admin(uuid, text, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'service_role peut l''appeler',
       has_function_privilege('service_role', 'public.bingo_admin(uuid, text, jsonb)', 'EXECUTE')
UNION ALL
SELECT 'aucun trigger ajouté sur sessions',
       NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.sessions'::regclass AND NOT tgisinternal AND tgname ILIKE '%bingo%');
