-- =============================================
-- Configuration Supabase pour l'audio de la roue
-- Exécuter dans: Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Ajouter la colonne wheel_audio à la table sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS wheel_audio TEXT;

-- 2. Créer le bucket de stockage pour les fichiers audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('wheel-audio', 'wheel-audio', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Politique: Lecture publique des fichiers audio
CREATE POLICY "wheel_audio_public_read" ON storage.objects
FOR SELECT
USING (bucket_id = 'wheel-audio');

-- 4. Politique: Upload pour utilisateurs authentifiés
CREATE POLICY "wheel_audio_auth_insert" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'wheel-audio' AND auth.role() = 'authenticated');

-- 5. Politique: Suppression pour utilisateurs authentifiés
CREATE POLICY "wheel_audio_auth_delete" ON storage.objects
FOR DELETE
USING (bucket_id = 'wheel-audio' AND auth.role() = 'authenticated');

-- 6. Politique: Mise à jour pour utilisateurs authentifiés
CREATE POLICY "wheel_audio_auth_update" ON storage.objects
FOR UPDATE
USING (bucket_id = 'wheel-audio' AND auth.role() = 'authenticated');
