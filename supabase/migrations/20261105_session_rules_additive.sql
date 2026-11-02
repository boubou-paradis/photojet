-- Lot lecture publique, étape 1 : additive, aucun retrait de lecture.
-- Les règles d'envoi ne lisent plus sessions avec les droits de l'invité,
-- et les règles de propriétaire sont réservées aux comptes connectés.
begin;

create or replace function public.session_is_active(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sessions s where s.id = p_session_id and s.is_active = true)
$$;

create or replace function public.session_folder_is_active(p_folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sessions s where s.id::text = p_folder and s.is_active = true)
$$;

create or replace function public.session_accepts_print(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sessions s where s.id = p_session_id and s.is_active = true and s.print_enabled = true)
$$;

revoke all on function public.session_is_active(uuid) from public;
revoke all on function public.session_folder_is_active(text) from public;
revoke all on function public.session_accepts_print(uuid) from public;
grant execute on function public.session_is_active(uuid) to anon, authenticated, service_role;
grant execute on function public.session_folder_is_active(text) to anon, authenticated, service_role;
grant execute on function public.session_accepts_print(uuid) to anon, authenticated, service_role;

alter policy photos_insert_active_session on public.photos
  with check (public.session_is_active(session_id));
alter policy messages_insert_active_session on public.messages
  with check (public.session_is_active(session_id));
alter policy borne_insert_active_session on public.borne_connections
  with check (public.session_is_active(session_id));
alter policy print_insert_active_session on public.print_requests
  with check (public.session_accepts_print(session_id));
alter policy photos_insert_active_session_folder on storage.objects
  with check (bucket_id = 'photos' and public.session_folder_is_active((storage.foldername(objects.name))[1]));

alter policy session_owner_can_read on public.sessions to authenticated;
alter policy sessions_delete_owner on public.sessions to authenticated;
alter policy sessions_insert_auth on public.sessions to authenticated;
alter policy sessions_select_owner on public.sessions to authenticated;
alter policy sessions_update_owner on public.sessions to authenticated;
alter policy photos_delete_session_owner on public.photos to authenticated;
alter policy photos_select_session_owner on public.photos to authenticated;
alter policy photos_update_session_owner on public.photos to authenticated;
alter policy messages_delete_session_owner on public.messages to authenticated;
alter policy messages_select_session_owner on public.messages to authenticated;
alter policy messages_update_session_owner on public.messages to authenticated;
alter policy borne_delete_session_owner on public.borne_connections to authenticated;
alter policy print_delete_session_owner on public.print_requests to authenticated;
alter policy print_update_session_owner on public.print_requests to authenticated;

commit;
