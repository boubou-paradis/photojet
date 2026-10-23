-- Sécurisation du Storage : bucket `photos`.
--
-- Constat (audit 2026-10-23, mesuré en prod) : avec la seule clé publique du
-- site, un visiteur pouvait lister tout le bucket `photos` et SUPPRIMER
-- n'importe quel fichier (règles « Anyone can … » de supabase-schema.sql).
-- (Les buckets lineup-audio / wheel-audio ne sont pas modifiés ici.)
--
-- Après : le bucket reste public en lecture PAR LIEN (diaporama, album,
-- impression inchangés). Seuls changent l'envoi, le listage et la suppression :
--   • invité / borne (sans compte) : envoi uniquement dans <id de session active>/
--   • animateur connecté : envoi dans les dossiers de l'admin ; listage et
--     suppression de ses propres fichiers et des photos de ses sessions
--   • serveur (service_role : purge, album ZIP, templates) : non concerné.
-- Aucune modification de table, aucun trigger.
-- ATTENTION : dans les sous-requêtes sur sessions, toujours écrire
-- objects.name (sessions a aussi une colonne « name » : sans préfixe, c'est
-- le nom de la session qui est lu et aucun envoi n'est accepté).

-- 1. Anciennes règles ouvertes du bucket photos
drop policy if exists "Anyone can upload photos" on storage.objects;
drop policy if exists "Anyone can view photos" on storage.objects;
drop policy if exists "Anyone can delete photos" on storage.objects;

-- 2. Envoi : photos des invités et de la borne, dans le dossier d'une session active
create policy "photos_insert_active_session_folder"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.sessions s
      where s.id::text = (storage.foldername(objects.name))[1]
        and s.is_active = true
    )
  );

-- 3. Envoi : médias de l'admin (fond, logo, affiches, Photo Mystère, Quiz)
create policy "photos_insert_admin_media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (
      'backgrounds', 'logos', 'promos',
      'mystery-photos', 'mystery-audio',
      'quiz-audio', 'quiz-photos', 'quiz-question-audio'
    )
  );

-- 4. Lecture via l'API (listage, et préalable à la suppression) : ses propres
--    fichiers + les photos de ses sessions. Les liens publics ne passent pas par ici.
create policy "photos_select_owner_or_own_session"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      owner = (select auth.uid())
      or owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.sessions s
        where s.id::text = (storage.foldername(objects.name))[1]
          and s.user_id = (select auth.uid())
      )
    )
  );

-- 5. Suppression : mêmes fichiers
create policy "photos_delete_owner_or_own_session"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      owner = (select auth.uid())
      or owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.sessions s
        where s.id::text = (storage.foldername(objects.name))[1]
          and s.user_id = (select auth.uid())
      )
    )
  );

-- Rollback (rétablit exactement les règles d'avant) :
-- drop policy if exists "photos_insert_active_session_folder" on storage.objects;
-- drop policy if exists "photos_insert_admin_media" on storage.objects;
-- drop policy if exists "photos_select_owner_or_own_session" on storage.objects;
-- drop policy if exists "photos_delete_owner_or_own_session" on storage.objects;
-- create policy "Anyone can upload photos" on storage.objects for insert with check (bucket_id = 'photos');
-- create policy "Anyone can view photos" on storage.objects for select using (bucket_id = 'photos');
-- create policy "Anyone can delete photos" on storage.objects for delete using (bucket_id = 'photos');
