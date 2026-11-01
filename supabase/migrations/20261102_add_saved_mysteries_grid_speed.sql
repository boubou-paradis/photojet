-- Bibliothèque Photo Mystère : la grille et la vitesse sont enregistrées avec le jeu.
--
-- Additive et sans effet sur les lignes existantes : elles gardent NULL, et un
-- jeu sans grille se charge comme aujourd'hui (la grille de la session est conservée).
-- Mêmes valeurs autorisées que sessions.mystery_photo_grid et mystery_photo_speed.

alter table public.saved_mysteries
  add column if not exists grid text,
  add column if not exists speed text;

alter table public.saved_mysteries
  drop constraint if exists saved_mysteries_grid_check;
alter table public.saved_mysteries
  add constraint saved_mysteries_grid_check
  check (grid is null or grid in ('6x4', '8x6', '10x8', '12x8', '15x10', '20x12'));

alter table public.saved_mysteries
  drop constraint if exists saved_mysteries_speed_check;
alter table public.saved_mysteries
  add constraint saved_mysteries_speed_check
  check (speed is null or speed in ('slow', 'medium', 'fast'));

-- Rollback :
-- alter table public.saved_mysteries drop constraint if exists saved_mysteries_speed_check;
-- alter table public.saved_mysteries drop constraint if exists saved_mysteries_grid_check;
-- alter table public.saved_mysteries drop column if exists speed, drop column if exists grid;
