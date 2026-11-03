-- Réglages d'affichage par défaut du compte (fond, logo, QR, diaporama,
-- messages, affiches promo, accueil et cadres de la borne), appliqués à la
-- création d'une session et sur clic « Appliquer mes réglages par défaut ».
--
-- Migration ADDITIVE, à appliquer à la main par l'utilisateur :
--   • aucune session modifiée, aucune copie de réglages, aucun script ;
--   • aucun trigger, aucune clé étrangère vers sessions ;
--   • une ligne par compte, supprimée avec le compte (cascade) ; les fichiers
--     associés sont effacés par la purge (cleanup-expired / deleteUserData).
--
-- Écritures uniquement par la route serveur /api/account/display-defaults
-- (clé de service, liste fermée de réglages, valeurs vérifiées) : le
-- navigateur n'a que la lecture de SA ligne.

create table if not exists public.account_display_defaults (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  settings   jsonb not null,
  updated_at timestamptz not null default now()  -- mis à jour par l'application
);

alter table public.account_display_defaults enable row level security;

-- (select auth.uid()) : évaluée une seule fois par requête (recommandation Supabase)
create policy "Users can view their own display defaults"
  on public.account_display_defaults for select
  using ((select auth.uid()) = user_id);

-- Rollback :
-- drop table if exists public.account_display_defaults;
-- (les copies de fichiers backgrounds/defaults-*, logos/defaults-*,
--  promos/defaults-*/ restent alors dans le Storage, sans effet sur les sessions)
