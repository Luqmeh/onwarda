-- Platform-admin organization provisioning and status mutations.
-- These SECURITY DEFINER functions exist because authenticated users cannot
-- INSERT organizations or audit_logs under RLS. They still fail closed:
-- is_active_platform_admin() must be true for the calling JWT.

create or replace function public.provision_organization(
  p_name text,
  p_slug text,
  p_status text,
  p_owner_user_id uuid,
  p_owner_membership_status text,
  p_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_name is null or length(btrim(p_name)) < 1 or length(p_name) > 120 then
    raise exception 'invalid organization name'
      using errcode = '22023';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug) > 63 then
    raise exception 'invalid organization slug'
      using errcode = '22023';
  end if;

  if p_slug in (
    'admin', 'app', 'api', 'auth', 'g', 'guest', 'login', 'logout',
    'o', 'onwarda', 'settings', 'status', 'support', 'www'
  ) then
    raise exception 'slug is reserved'
      using errcode = '22023';
  end if;

  if p_status not in ('active', 'pending', 'suspended') then
    raise exception 'invalid organization status'
      using errcode = '22023';
  end if;

  if p_owner_membership_status not in ('invited', 'active') then
    raise exception 'invalid membership status'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.platform_admins
    where user_id = p_owner_user_id
  ) then
    raise exception 'owner is a platform administrator'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.organization_users
    where user_id = p_owner_user_id
  ) then
    raise exception 'owner already belongs to an organization'
      using errcode = 'P0001';
  end if;

  insert into public.organizations (
    name,
    slug,
    status,
    onboarding_status
  ) values (
    btrim(p_name),
    p_slug,
    p_status,
    'in_progress'
  )
  returning id into new_organization_id;

  insert into public.organization_users (
    organization_id,
    user_id,
    role,
    status
  ) values (
    new_organization_id,
    p_owner_user_id,
    'owner',
    p_owner_membership_status
  );

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
    'organization.created',
    'organization',
    new_organization_id,
    new_organization_id,
    jsonb_build_object(
      'name', btrim(p_name),
      'slug', p_slug,
      'status', p_status
    )
  );

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
    'organization.owner_invited',
    'organization_user',
    p_owner_user_id,
    new_organization_id,
    jsonb_build_object(
      'email', p_owner_email,
      'role', 'owner',
      'membershipStatus', p_owner_membership_status
    )
  );

  return new_organization_id;
exception
  when unique_violation then
    if sqlerrm ilike '%organizations_slug%' or sqlerrm ilike '%slug%' then
      raise exception 'slug already exists'
        using errcode = '23505';
    end if;
    raise;
end;
$$;

create or replace function public.set_organization_status(
  p_organization_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
  current_slug text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'invalid organization status'
      using errcode = '22023';
  end if;

  select status, slug
    into current_status, current_slug
  from public.organizations
  where id = p_organization_id
  for update;

  if current_status is null then
    raise exception 'organization not found'
      using errcode = 'P0002';
  end if;

  if current_status = 'archived' then
    raise exception 'archived organizations cannot change status'
      using errcode = 'P0001';
  end if;

  if current_status = p_status then
    return;
  end if;

  if p_status = 'suspended' and current_status not in ('active', 'pending') then
    raise exception 'organization cannot be suspended from the current status'
      using errcode = 'P0001';
  end if;

  if p_status = 'active' and current_status not in ('suspended', 'pending') then
    raise exception 'organization cannot be activated from the current status'
      using errcode = 'P0001';
  end if;

  update public.organizations
    set status = p_status
  where id = p_organization_id;

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
    case
      when p_status = 'suspended' then 'organization.suspended'
      else 'organization.activated'
    end,
    'organization',
    p_organization_id,
    p_organization_id,
    jsonb_build_object(
      'previousStatus', current_status,
      'status', p_status,
      'slug', current_slug
    )
  );
end;
$$;

revoke all on function public.provision_organization(text, text, text, uuid, text, text)
  from public, anon, service_role;
grant execute on function public.provision_organization(text, text, text, uuid, text, text)
  to authenticated;

revoke all on function public.set_organization_status(uuid, text)
  from public, anon, service_role;
grant execute on function public.set_organization_status(uuid, text)
  to authenticated;
