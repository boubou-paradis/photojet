-- Ajout de la taille configurable du QR code sur le diaporama
-- Valeurs possibles : 'small', 'medium', 'large'
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS qr_size text NOT NULL DEFAULT 'medium';
