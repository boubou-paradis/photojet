-- © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
-- Migration additive : unicité de subscriptions.stripe_subscription_id
--
-- Pourquoi : le webhook Stripe (checkout.session.completed, nouveau client)
-- fait un upsert avec onConflict 'stripe_subscription_id'. Sans contrainte
-- unique sur cette colonne, Postgres refuse (erreur 42P10) : le premier envoi
-- de Stripe échoue et le compte n'est finalisé qu'au renvoi automatique.
--
-- Sans risque pour les données existantes : vérifié le 03/11/2026, 0 doublon
-- (23 lignes, 19 avec un id Stripe). Les lignes sans id Stripe (Pass
-- Événement, comptes à vie) restent autorisées : en Postgres, plusieurs NULL
-- ne violent pas une contrainte unique.
--
-- Retour arrière :
--   alter table public.subscriptions drop constraint if exists subscriptions_stripe_subscription_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_stripe_subscription_id_key'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_stripe_subscription_id_key unique (stripe_subscription_id);
  end if;
end $$;
