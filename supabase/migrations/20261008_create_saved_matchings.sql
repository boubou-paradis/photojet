-- Bibliothèque personnelle de jeux Matching (calquée sur saved_quizzes / saved_mysteries).
-- Migration ADDITIVE : nouvelle table uniquement, aucune table existante modifiée.
-- La suppression d'un compte (deleteUserData → auth.admin.deleteUser) vide la
-- bibliothèque par la cascade sur auth.users : cleanup-expired n'a pas à changer.
create table if not exists public.saved_matchings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  questions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sert à la fois la clé étrangère et les policies RLS ci-dessous
create index if not exists saved_matchings_user_id_idx on public.saved_matchings (user_id);

alter table public.saved_matchings enable row level security;

-- (select auth.uid()) plutôt que auth.uid() nu : évite l'appel de fonction
-- ligne par ligne, recommandation Supabase pour les policies RLS.
create policy "Users can view their own saved matchings"
  on public.saved_matchings for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own saved matchings"
  on public.saved_matchings for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved matchings"
  on public.saved_matchings for update
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own saved matchings"
  on public.saved_matchings for delete
  using ((select auth.uid()) = user_id);
