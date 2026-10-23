-- AnimaBooth : bibliothèque de templates (cadres PNG transparents) de la
-- borne photo, calquée sur saved_mysteries, + choix du cadre par session.
-- Appliquée à la main par l'utilisateur le 2026-10-23 (ce fichier reflète
-- exactement ce qui a été exécuté). Migration additive : les sessions
-- existantes gardent cadre désactivé.

create table if not exists public.borne_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  storage_path text not null unique,          -- borne-templates/<user_id>/<uuid>.png
  orientation text not null check (orientation in ('portrait','landscape')),
  width int not null, height int not null,
  photo_zones jsonb not null,                 -- [{x,y,w,h}] : 1 zone en MVP, bandelettes plus tard
  file_size int not null,
  source text not null default 'import' check (source in ('import','animajet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sert à la fois la clé étrangère et les policies RLS ci-dessous
create index if not exists borne_templates_user_id_idx on public.borne_templates (user_id);

alter table public.borne_templates enable row level security;

-- (select auth.uid()) plutôt que auth.uid() nu : évite l'appel de fonction
-- ligne par ligne, recommandation Supabase pour les policies RLS.
create policy "Users can view their own borne templates"
  on public.borne_templates for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own borne templates"
  on public.borne_templates for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own borne templates"
  on public.borne_templates for update
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own borne templates"
  on public.borne_templates for delete
  using ((select auth.uid()) = user_id);

-- Pas de clé étrangère vers borne_templates : elle créerait des triggers
-- internes sur sessions. La suppression d'un template retire ses id des
-- sessions côté application, et la borne passe « sans cadre » si l'id ne
-- pointe plus sur rien.
alter table sessions
  add column if not exists borne_template_enabled boolean not null default false,
  add column if not exists borne_template_portrait_id uuid,
  add column if not exists borne_template_landscape_id uuid,
  add column if not exists borne_template_guest_choice boolean not null default true;

-- Rollback :
-- alter table sessions
--   drop column if exists borne_template_enabled,
--   drop column if exists borne_template_portrait_id,
--   drop column if exists borne_template_landscape_id,
--   drop column if exists borne_template_guest_choice;
-- drop table if exists public.borne_templates;
