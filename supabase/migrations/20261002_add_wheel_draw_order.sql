-- Roue de la Destinée : mode "ordre prédéfini"
-- JSON texte : {"enabled": boolean, "order": ["<segmentId>", ...]}
-- NULL = mode aléatoire (comportement historique, aucune donnée existante modifiée)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS wheel_draw_order text;
