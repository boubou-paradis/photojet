-- AnimaBooth : écran d'accueil optionnel de la borne (« Touchez l'écran
-- pour prendre une photo »). Migration additive, sans trigger : les sessions
-- existantes gardent l'écran désactivé (borne inchangée).

alter table sessions
  add column if not exists borne_welcome_enabled boolean not null default false,
  add column if not exists borne_welcome_message text;

-- Rollback :
-- alter table sessions
--   drop column if exists borne_welcome_enabled,
--   drop column if exists borne_welcome_message;
