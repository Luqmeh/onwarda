-- Qualify organization_users.role in plpgsql. An unqualified `role` in a
-- SELECT list is interpreted as the session role name, not the column.

create or replace function public.admin_set_organization_user_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_role text;
  membership_status text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_role not in ('admin', 'manager', 'staff') then
    raise exception 'invalid organization role'
      using errcode = '22023';
  end if;

  select ou.role, ou.status
    into membership_role, membership_status
  from public.organization_users ou
  where ou.organization_id = p_organization_id
    and ou.user_id = p_user_id
  for update;

  if membership_role is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if membership_role = p_role then
    return;
  end if;

  if membership_role = 'owner'
    and public.organization_acting_owner_count(p_organization_id) <= 1 then
    raise exception 'organization must keep at least one owner'
      using errcode = 'P0001';
  end if;

  update public.organization_users
    set role = p_role
  where organization_id = p_organization_id
    and user_id = p_user_id;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    metadata
  ) values (
    auth.uid(),
    'platform_admin',
    'organization.user_role_changed',
    'organization_user',
    p_user_id,
    p_organization_id,
    jsonb_build_object(
      'previousRole', membership_role,
      'role', p_role,
      'membershipStatus', membership_status
    )
  );
end;
$$;

create or replace function public.admin_set_organization_user_status(
  p_organization_id uuid,
  p_user_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  membership_role text;
  membership_status text;
  audit_action text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'invalid membership status'
      using errcode = '22023';
  end if;

  select ou.role, ou.status
    into membership_role, membership_status
  from public.organization_users ou
  where ou.organization_id = p_organization_id
    and ou.user_id = p_user_id
  for update;

  if membership_role is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if membership_status = p_status then
    return;
  end if;

  if p_status = 'suspended'
    and membership_role = 'owner'
    and public.organization_acting_owner_count(p_organization_id) <= 1 then
    raise exception 'organization must keep at least one owner'
      using errcode = 'P0001';
  end if;

  update public.organization_users
    set status = p_status
  where organization_id = p_organization_id
    and user_id = p_user_id;

  audit_action := case
    when p_status = 'suspended' then 'organization.user_suspended'
    else 'organization.user_reactivated'
  end;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    metadata
  ) values (
    auth.uid(),
    'platform_admin',
    audit_action,
    'organization_user',
    p_user_id,
    p_organization_id,
    jsonb_build_object(
      'role', membership_role,
      'previousStatus', membership_status,
      'status', p_status
    )
  );
end;
$$;

create or replace function public.admin_transfer_organization_ownership(
  p_organization_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_role text;
  incoming_status text;
  previous_owner_ids uuid[];
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.platform_admins
    where user_id = p_new_owner_user_id
  ) then
    raise exception 'user is a platform administrator'
      using errcode = 'P0001';
  end if;

  select ou.role, ou.status
    into incoming_role, incoming_status
  from public.organization_users ou
  where ou.organization_id = p_organization_id
    and ou.user_id = p_new_owner_user_id
  for update;

  if incoming_role is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if incoming_status <> 'active' then
    raise exception 'new owner must be an active organization member'
      using errcode = 'P0001';
  end if;

  if incoming_role = 'owner' then
    return;
  end if;

  select coalesce(array_agg(ou.user_id), array[]::uuid[])
    into previous_owner_ids
  from public.organization_users ou
  where ou.organization_id = p_organization_id
    and ou.role = 'owner'
    and ou.user_id <> p_new_owner_user_id;

  update public.organization_users
    set role = 'admin'
  where organization_id = p_organization_id
    and role = 'owner'
    and user_id <> p_new_owner_user_id;

  update public.organization_users
    set role = 'owner',
        status = 'active'
  where organization_id = p_organization_id
    and user_id = p_new_owner_user_id;

  if public.organization_acting_owner_count(p_organization_id) < 1 then
    raise exception 'organization must keep at least one owner'
      using errcode = 'P0001';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    metadata
  ) values (
    auth.uid(),
    'platform_admin',
    'organization.ownership_transferred',
    'organization_user',
    p_new_owner_user_id,
    p_organization_id,
    jsonb_build_object(
      'previousOwnerUserIds', to_jsonb(previous_owner_ids),
      'newOwnerUserId', p_new_owner_user_id
    )
  );
end;
$$;
