-- Ajout du toggle affichage logo sur le diaporama
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS show_logo boolean NOT NULL DEFAULT true;
