-- Bibliothèque personnelle de jeux Photo Mystère (calquée sur saved_quizzes)
create table if not exists public.saved_mysteries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  photos jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sert à la fois la clé étrangère et les policies RLS ci-dessous
create index if not exists saved_mysteries_user_id_idx on public.saved_mysteries (user_id);

alter table public.saved_mysteries enable row level security;

-- (select auth.uid()) plutôt que auth.uid() nu : évite l'appel de fonction
-- ligne par ligne, recommandation Supabase pour les policies RLS.
create policy "Users can view their own saved mysteries"
  on public.saved_mysteries for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own saved mysteries"
  on public.saved_mysteries for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved mysteries"
  on public.saved_mysteries for update
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own saved mysteries"
  on public.saved_mysteries for delete
  using ((select auth.uid()) = user_id);
