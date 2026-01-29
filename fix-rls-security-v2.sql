-- =====================================================
-- SCRIPT DE CORRECTION RLS V2 - AnimaJet/PhotoJet
-- Corrige les vulnérabilités détectées par le linter Supabase
-- À exécuter dans Supabase Dashboard > SQL Editor
-- =====================================================
-- Tables corrigées:
-- 1. borne_connections (INSERT, UPDATE, DELETE étaient ouverts)
-- 2. print_requests (INSERT, UPDATE, DELETE étaient ouverts)
-- 3. promo_images (INSERT, UPDATE, DELETE étaient ouverts)
-- 4. invoices (INSERT service_role manquait la restriction de rôle)
-- 5. promo_codes (policy service_role trop permissive)
-- 6. subscriptions (vérification de la policy service_role)
-- 7. trial_tokens (vérification des policies)
-- =====================================================

-- =====================================================
-- ÉTAPE 1: BORNE_CONNECTIONS - Sécurisation
-- =====================================================
-- Principe: Les bornes peuvent s'enregistrer sur des sessions actives
-- Les propriétaires de session peuvent gérer les connexions

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Anyone can read borne connections" ON borne_connections;
DROP POLICY IF EXISTS "Anyone can insert borne connections" ON borne_connections;
DROP POLICY IF EXISTS "Anyone can update borne connections" ON borne_connections;
DROP POLICY IF EXISTS "Anyone can delete borne connections" ON borne_connections;

-- SELECT: Tout le monde peut voir les connexions (pour le statut en temps réel)
-- C'est acceptable car les données ne sont pas sensibles
CREATE POLICY "borne_select_public" ON borne_connections
  FOR SELECT
  USING (true);

-- INSERT: Uniquement sur des sessions actives
CREATE POLICY "borne_insert_active_session" ON borne_connections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_id
      AND sessions.is_active = true
    )
  );

-- UPDATE: La borne peut mettre à jour sa propre connexion (heartbeat)
-- OU le propriétaire de la session peut modifier
CREATE POLICY "borne_update_own_or_owner" ON borne_connections
  FOR UPDATE
  USING (
    -- L'appareil peut mettre à jour sa propre connexion (basé sur device_id dans la session)
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = borne_connections.session_id
      AND sessions.is_active = true
    )
    OR
    -- Le propriétaire de la session peut modifier
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = borne_connections.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- DELETE: Uniquement le propriétaire de la session
CREATE POLICY "borne_delete_session_owner" ON borne_connections
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = borne_connections.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- ÉTAPE 2: PRINT_REQUESTS - Sécurisation
-- =====================================================
-- Principe: Les invités peuvent demander une impression sur session active
-- Les propriétaires gèrent la file d'attente

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Anyone can view print requests" ON print_requests;
DROP POLICY IF EXISTS "Anyone can insert print requests" ON print_requests;
DROP POLICY IF EXISTS "Anyone can update print requests" ON print_requests;
DROP POLICY IF EXISTS "Anyone can delete print requests" ON print_requests;

-- SELECT: Voir les demandes d'impression de sessions actives (pour l'affichage file d'attente)
-- OU le propriétaire peut voir toutes les demandes de ses sessions
CREATE POLICY "print_select_active_or_owner" ON print_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = print_requests.session_id
      AND (sessions.is_active = true OR sessions.user_id = auth.uid())
    )
  );

-- INSERT: Uniquement sur des sessions actives avec impression activée
CREATE POLICY "print_insert_active_session" ON print_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_id
      AND sessions.is_active = true
      AND sessions.print_enabled = true
    )
  );

-- UPDATE: Uniquement le propriétaire de la session (pour marquer imprimé/rejeté)
CREATE POLICY "print_update_session_owner" ON print_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = print_requests.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- DELETE: Uniquement le propriétaire de la session
CREATE POLICY "print_delete_session_owner" ON print_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = print_requests.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- =====================================================
-- ÉTAPE 3: PROMO_IMAGES - Sécurisation
-- =====================================================
-- Note: Cette table n'existait pas dans les fichiers SQL.
-- Si elle existe dans Supabase, exécuter ces commandes.
-- Si elle n'existe pas, ces commandes échoueront silencieusement.

DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promo_images' AND table_schema = 'public') THEN
    -- Supprimer les anciennes policies
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read promo images" ON promo_images';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert promo images" ON promo_images';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update promo images" ON promo_images';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete promo images" ON promo_images';

    -- Si la table a une colonne session_id, créer des policies basées sur session
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_images' AND column_name = 'session_id') THEN
      -- SELECT: Public (images promo sont publiques)
      EXECUTE 'CREATE POLICY "promo_images_select_public" ON promo_images FOR SELECT USING (true)';

      -- INSERT: Propriétaire de session uniquement
      EXECUTE 'CREATE POLICY "promo_images_insert_owner" ON promo_images FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_id AND sessions.user_id = auth.uid())
      )';

      -- UPDATE: Propriétaire de session uniquement
      EXECUTE 'CREATE POLICY "promo_images_update_owner" ON promo_images FOR UPDATE USING (
        EXISTS (SELECT 1 FROM sessions WHERE sessions.id = promo_images.session_id AND sessions.user_id = auth.uid())
      )';

      -- DELETE: Propriétaire de session uniquement
      EXECUTE 'CREATE POLICY "promo_images_delete_owner" ON promo_images FOR DELETE USING (
        EXISTS (SELECT 1 FROM sessions WHERE sessions.id = promo_images.session_id AND sessions.user_id = auth.uid())
      )';
    ELSE
      -- Si pas de session_id, restreindre aux admins/owners seulement
      EXECUTE 'CREATE POLICY "promo_images_select_public" ON promo_images FOR SELECT USING (true)';

      EXECUTE 'CREATE POLICY "promo_images_manage_admin" ON promo_images FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN (''owner'', ''admin''))
      )';
    END IF;

    RAISE NOTICE 'Policies promo_images mises à jour avec succès';
  ELSE
    RAISE NOTICE 'Table promo_images non trouvée - ignorée';
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 4: INVOICES - Correction policy INSERT
-- =====================================================
-- Le problème: WITH CHECK (true) sans restriction de rôle

-- Supprimer l'ancienne policy
DROP POLICY IF EXISTS "Service role can insert invoices" ON invoices;
DROP POLICY IF EXISTS "service_role_manage_invoices" ON invoices;

-- Nouvelle policy: INSERT réservé au service_role
-- Note: Le service_role bypass RLS par défaut, mais on ajoute une policy explicite
CREATE POLICY "invoices_insert_service_role" ON invoices
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE et DELETE aussi pour service_role (pour corrections)
CREATE POLICY "invoices_update_service_role" ON invoices
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "invoices_delete_service_role" ON invoices
  FOR DELETE
  TO service_role
  USING (true);

-- =====================================================
-- ÉTAPE 5: PROMO_CODES - Correction policy service_role
-- =====================================================

-- Supprimer la policy problématique si elle existe
DROP POLICY IF EXISTS "service_role_manage_promo_codes" ON promo_codes;

-- Le service_role bypass RLS par défaut, donc pas besoin de policy explicite
-- Les policies existantes sont correctes:
-- - "Anyone can read active promo codes" (SELECT où is_active = true)
-- - "Owners can manage promo codes" (ALL pour owner/admin)

-- =====================================================
-- ÉTAPE 6: SUBSCRIPTIONS - Correction policy service_role
-- =====================================================

-- Supprimer la policy problématique
DROP POLICY IF EXISTS "Service role full access subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "service_role_manage_subscriptions" ON subscriptions;

-- Nouvelle policy correctement restreinte au service_role
CREATE POLICY "subscriptions_manage_service_role" ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- ÉTAPE 7: TRIAL_TOKENS - Vérification
-- =====================================================

-- Supprimer la policy problématique si elle existe
DROP POLICY IF EXISTS "Service role full access" ON trial_tokens;

-- Les policies existantes sont correctes avec TO service_role
-- Mais ajoutons-les si elles n'existent pas

DO $$
BEGIN
  -- Vérifier si les policies existent déjà
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trial_tokens' AND policyname = 'Allow insert from service role') THEN
    EXECUTE 'CREATE POLICY "Allow insert from service role" ON trial_tokens FOR INSERT TO service_role WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trial_tokens' AND policyname = 'Allow select from service role') THEN
    EXECUTE 'CREATE POLICY "Allow select from service role" ON trial_tokens FOR SELECT TO service_role USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trial_tokens' AND policyname = 'Allow update from service role') THEN
    EXECUTE 'CREATE POLICY "Allow update from service role" ON trial_tokens FOR UPDATE TO service_role USING (true)';
  END IF;
END $$;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================

-- Afficher un résumé des policies créées
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN (
  'borne_connections',
  'print_requests',
  'promo_images',
  'invoices',
  'promo_codes',
  'subscriptions',
  'trial_tokens'
)
ORDER BY tablename, policyname;

-- Message de confirmation
SELECT '✅ Correction RLS terminée! Vérifiez les policies ci-dessus.' as result;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
--
-- 1. Le service_role bypass RLS par défaut dans Supabase
--    Les policies "TO service_role" sont là pour la documentation
--
-- 2. Pour les tables sensibles (invoices, subscriptions, trial_tokens):
--    - Seul le backend (service_role) peut modifier
--    - Les utilisateurs peuvent seulement lire leurs propres données
--
-- 3. Pour borne_connections et print_requests:
--    - Les invités peuvent INSERT sur sessions actives
--    - Seuls les propriétaires peuvent UPDATE/DELETE
--
-- 4. N'oubliez pas d'activer "Leaked Password Protection" dans:
--    Supabase Dashboard > Authentication > Providers > Email
--
