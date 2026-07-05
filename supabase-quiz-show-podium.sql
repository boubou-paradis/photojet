-- Migration : persistance du podium quiz (audit sync jeux 2026-07-06)
-- À exécuter dans le SQL Editor Supabase (prod) AVANT de déployer le code.
-- Avant : le podium n'existait qu'en broadcast → un F5 de /live pendant le
-- podium retombait sur l'écran de jeu au lieu du podium.

alter table public.sessions
  add column if not exists quiz_show_podium boolean not null default false;
