-- =====================================================
-- SCRIPT DE SÉCURISATION RLS - AnimaJet/PhotoJet
-- À exécuter dans Supabase Dashboard > SQL Editor
-- =====================================================
-- Ce script :
-- 1. Supprime les anciennes policies (nettoyage)
-- 2. Crée des policies sécurisées
-- 3. Active RLS sur les tables
-- =====================================================

-- =====================================================
-- ÉTAPE 1 : NETTOYAGE DES ANCIENNES POLICIES
-- =====================================================

-- Sessions
DROP POLICY IF EXISTS "Anyone can read active sessions by code" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can insert sessions" ON sessions;
DROP POLICY IF EXISTS "Insertion publique sessions" ON sessions;
DROP POLICY IF EXISTS "Lecture publique sessions" ON sessions;
DROP POLICY IF EXISTS "Modification publique sessions" ON sessions;
DROP POLICY IF EXISTS "Suppression publique sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update sessions" ON sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;

-- Photos
DROP POLICY IF EXISTS "Anyone can delete photos" ON photos;
DROP POLICY IF EXISTS "Anyone can insert photos" ON photos;
DROP POLICY IF EXISTS "Anyone can read photos" ON photos;
DROP POLICY IF EXISTS "Anyone can update photos" ON photos;
DROP POLICY IF EXISTS "Insertion publique photos" ON photos;
DROP POLICY IF EXISTS "Lecture publique photos" ON photos;
DROP POLICY IF EXISTS "Modification publique photos" ON photos;
DROP POLICY IF EXISTS "Suppression publique photos" ON photos;
DROP POLICY IF EXISTS "Anyone can view approved photos" ON photos;
DROP POLICY IF EXISTS "Users can manage own session photos" ON photos;

-- Messages
DROP POLICY IF EXISTS "Gestion messages" ON messages;
DROP POLICY IF EXISTS "Insertion messages publique" ON messages;
DROP POLICY IF EXISTS "Messages approuvés publics" ON messages;

-- =====================================================
-- ÉTAPE 2 : NOUVELLES POLICIES SÉCURISÉES - SESSIONS
-- =====================================================

-- Les invités peuvent lire les sessions actives (pour rejoindre via code)
CREATE POLICY "sessions_select_active_public" ON sessions
  FOR SELECT
  USING (is_active = true);

-- Les propriétaires peuvent lire toutes leurs sessions (même inactives)
CREATE POLICY "sessions_select_owner" ON sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Seuls les utilisateurs authentifiés peuvent créer des sessions (pour leur compte)
CREATE POLICY "sessions_insert_auth" ON sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Seuls les propriétaires peuvent modifier leurs sessions
CREATE POLICY "sessions_update_owner" ON sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seuls les propriétaires peuvent supprimer leurs sessions
CREATE POLICY "sessions_delete_owner" ON sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- ÉTAPE 3 : NOUVELLES POLICIES SÉCURISÉES - PHOTOS
-- =====================================================

-- Les invités peuvent voir les photos approuvées (pour le diaporama)
CREATE POLICY "photos_select_approved_public" ON photos
  FOR SELECT
  USING (status = 'approved');

-- Les propriétaires de session peuvent voir TOUTES les photos (pour modération)
CREATE POLICY "photos_select_session_owner" ON photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = photos.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Les invités peuvent uploader des photos vers des sessions actives
CREATE POLICY "photos_insert_active_session" ON photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_id
      AND sessions.is_active = true
    )
  );

-- Les propriétaires peuvent modifier les photos (modération : approve/reject)
CREATE POLICY "photos_update_session_owner" ON photos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = photos.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Les propriétaires peuvent supprimer les photos de leurs sessions
CREATE POLICY "photos_delete_session_owner" ON photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = photos.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- ÉTAPE 4 : NOUVELLES POLICIES SÉCURISÉES - MESSAGES
-- =====================================================

-- Les invités peuvent voir les messages approuvés (pour le diaporama)
CREATE POLICY "messages_select_approved_public" ON messages
  FOR SELECT
  USING (status = 'approved');

-- Les propriétaires de session peuvent voir TOUS les messages (pour modération)
CREATE POLICY "messages_select_session_owner" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = messages.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Les invités peuvent envoyer des messages vers des sessions actives
CREATE POLICY "messages_insert_active_session" ON messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_id
      AND sessions.is_active = true
    )
  );

-- Les propriétaires peuvent modifier les messages (modération)
CREATE POLICY "messages_update_session_owner" ON messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = messages.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Les propriétaires peuvent supprimer les messages
CREATE POLICY "messages_delete_session_owner" ON messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = messages.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- ÉTAPE 5 : ACTIVER RLS SUR LES TABLES
-- =====================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VÉRIFICATION
-- =====================================================

SELECT 'RLS activé avec succès sur sessions, photos et messages' as result;

-- Pour vérifier les policies créées :
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('sessions', 'photos', 'messages');
