-- L'audio de fond joué pendant la révélation progressive des tuiles
-- (sessions.mystery_reveal_audio) n'était pas capturé par la bibliothèque
-- de jeux sauvegardés — seules les photos (+ leur audio par manche) l'étaient.
alter table public.saved_mysteries
  add column if not exists reveal_audio_url text;
