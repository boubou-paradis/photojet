-- Frein contre l'essai de tous les codes de session et de borne.
-- Une ligne par adresse et par code inexistant tenté, conservée une heure, adresse
-- et code uniquement sous forme d'empreinte. Lue et écrite par le serveur seul.
--
-- RETOUR ARRIÈRE (le code laisse tout passer si la table manque) :
--   drop table if exists public.code_failures;

create table if not exists public.code_failures (
  ip_hash   text        not null,
  code_hash text        not null,
  failed_at timestamptz not null default now(),
  primary key (ip_hash, code_hash)
);

create index if not exists code_failures_failed_at_idx on public.code_failures (failed_at);

alter table public.code_failures enable row level security;

revoke all on public.code_failures from public, anon, authenticated;
grant select, insert, update, delete on public.code_failures to service_role;
