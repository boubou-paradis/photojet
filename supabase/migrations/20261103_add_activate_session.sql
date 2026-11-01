-- Une seule session active par compte : bascule atomique.
--
-- Additif : une fonction, sans trigger, sans index unique, sans règle RLS, sans
-- toucher aux données. Les comptes qui ont déjà plusieurs sessions actives les
-- gardent : rien ne bouge tant qu'ils n'activent pas une autre session.
--
-- Appelée uniquement par la route /api/sessions/activate (clé service), qui a
-- déjà vérifié l'utilisateur. Retours : not_found, already_active, conflict
-- (rien n'a changé, others = sessions actives) ou activated.
--
-- p_confirmed_ids : sessions que l'utilisateur a accepté de désactiver. Une
-- session devenue active entre-temps et absente de la liste ramène « conflict » :
-- on ne coupe jamais un événement que personne n'a confirmé.

create or replace function public.activate_session(
  p_session_id uuid,
  p_user_id uuid,
  p_confirmed_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_is_active boolean;
  v_others uuid[];
begin
  select user_id into v_owner from sessions where id = p_session_id;
  if v_owner is null or v_owner <> p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Verrou par compte, libéré à la fin de la transaction : deux activations
  -- simultanées passent l'une après l'autre. Tout se relit APRÈS le verrou.
  perform pg_advisory_xact_lock(hashtextextended('activate_session:' || p_user_id::text, 0));

  select is_active into v_is_active from sessions where id = p_session_id;
  if v_is_active is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_is_active then
    return jsonb_build_object('status', 'already_active');
  end if;

  select coalesce(array_agg(id order by created_at desc), '{}')
    into v_others
    from sessions
    where user_id = p_user_id and is_active = true and id <> p_session_id;

  if cardinality(v_others) > 0
     and (p_confirmed_ids is null or not (v_others <@ p_confirmed_ids)) then
    return jsonb_build_object('status', 'conflict', 'others', to_jsonb(v_others));
  end if;

  update sessions set is_active = false where id = any (v_others);
  update sessions set is_active = true where id = p_session_id;

  return jsonb_build_object('status', 'activated', 'deactivated', to_jsonb(v_others));
end;
$$;

revoke all on function public.activate_session(uuid, uuid, uuid[]) from public;
revoke all on function public.activate_session(uuid, uuid, uuid[]) from anon, authenticated;
grant execute on function public.activate_session(uuid, uuid, uuid[]) to service_role;

-- Rollback :
-- drop function if exists public.activate_session(uuid, uuid, uuid[]);
