-- ================================================
-- SETUP AUDIO POUR "LE BON ORDRE" (LINEUP)
-- ================================================
-- Exécuter ces commandes dans l'éditeur SQL de Supabase

-- 1. Ajouter la colonne lineup_audio à la table sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lineup_audio TEXT;

-- 2. Créer le bucket de stockage pour les fichiers audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('lineup-audio', 'lineup-audio', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Politique pour permettre l'upload (utilisateurs authentifiés)
CREATE POLICY "Allow authenticated uploads to lineup-audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lineup-audio');

-- 4. Politique pour permettre la lecture publique
CREATE POLICY "Allow public read access to lineup-audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lineup-audio');

-- 5. Politique pour permettre la suppression (utilisateurs authentifiés)
CREATE POLICY "Allow authenticated deletes from lineup-audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lineup-audio');

-- 6. Politique pour permettre la mise à jour (utilisateurs authentifiés)
CREATE POLICY "Allow authenticated updates to lineup-audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lineup-audio');
