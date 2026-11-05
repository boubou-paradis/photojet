-- © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
--
-- Purge des contenus 30 jours après la fin d'accès : détail de chaque passage
-- dans purge_log (compteurs, statut, détail par table, mode).
--
-- Additive : colonnes facultatives, sans valeur par défaut, sans trigger, sans
-- réécriture de lignes. purge_log n'est lu et écrit que par la clé service (crons).
--
-- À appliquer AVANT le déploiement du code : la purge écrit ces colonnes ; si
-- l'écriture du journal échoue, elle s'arrête sans rien supprimer.

alter table public.purge_log
  add column if not exists rows_deleted  integer,
  add column if not exists bytes_deleted bigint,
  add column if not exists status        text,   -- started | done | failed | dry_run
  add column if not exists details       jsonb;  -- compteurs par table, fichiers gardés, mode

-- Retour arrière :
-- alter table public.purge_log
--   drop column if exists details,
--   drop column if exists status,
--   drop column if exists bytes_deleted,
--   drop column if exists rows_deleted;
