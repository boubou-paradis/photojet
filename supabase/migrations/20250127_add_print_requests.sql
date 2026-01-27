-- =============================================
-- Migration: Ajout de la fonctionnalité d'impression
-- =============================================

-- 1. Ajouter les colonnes d'impression à la table sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS print_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS print_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS print_limit integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS print_count integer NOT NULL DEFAULT 0;

-- 2. Créer la table print_requests
CREATE TABLE IF NOT EXISTS print_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  guest_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz
);

-- 3. Index pour les requêtes de file d'attente
CREATE INDEX IF NOT EXISTS idx_print_requests_session_status
  ON print_requests(session_id, status);

CREATE INDEX IF NOT EXISTS idx_print_requests_created_at
  ON print_requests(created_at DESC);

-- 4. Activer RLS
ALTER TABLE print_requests ENABLE ROW LEVEL SECURITY;

-- 5. Policies RLS permissives (comme le reste du projet)
CREATE POLICY "Anyone can view print requests"
  ON print_requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert print requests"
  ON print_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update print requests"
  ON print_requests FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete print requests"
  ON print_requests FOR DELETE
  USING (true);

-- 6. Activer Realtime sur print_requests
ALTER PUBLICATION supabase_realtime ADD TABLE print_requests;
