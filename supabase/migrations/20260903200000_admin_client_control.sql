-- Internal Admin client management and support-session control plane.
-- Privileged mutations stay in SECURITY DEFINER RPCs that require
-- is_active_platform_admin(). They do not grant tenant RLS to platform admins
-- and they do not insert organization_users rows for support access.

-- ---------------------------------------------------------------------------
-- support_sessions
-- ---------------------------------------------------------------------------

create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  platform_admin_user_id uuid not null references public.profiles (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint support_sessions_reason_length
    check (reason is null or char_length(reason) <= 500),
  constraint support_sessions_expiry_check
    check (expires_at > started_at),
  constraint support_sessions_ended_check
    check (ended_at is null or ended_at >= started_at)
);

create index support_sessions_admin_idx
  on public.support_sessions (platform_admin_user_id, started_at desc);
create index support_sessions_organization_idx
  on public.support_sessions (organization_id, started_at desc);
create unique index support_sessions_one_open_per_admin
  on public.support_sessions (platform_admin_user_id)
  where ended_at is null;

revoke all on table public.support_sessions from anon, public;
grant select on table public.support_sessions to authenticated;

alter table public.support_sessions enable row level security;
alter table public.support_sessions force row level security;

create policy support_sessions_select_self
  on public.support_sessions
  for select
  to authenticated
  using (
    platform_admin_user_id = auth.uid()
    and public.is_active_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------

create or replace function public.organization_acting_owner_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.organization_users
  where organization_id = p_organization_id
    and role = 'owner'
    and status in ('active', 'invited');
$$;

revoke all on function public.organization_acting_owner_count(uuid) from public, anon, service_role;
grant execute on function public.organization_acting_owner_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invite an organization user (not an owner, not a platform admin)
-- ---------------------------------------------------------------------------

create or replace function public.admin_invite_organization_user(
  p_organization_id uuid,
  p_user_id uuid,
  p_email text,
  p_role text,
  p_membership_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_membership_id uuid;
  current_org_status text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_role not in ('admin', 'manager', 'staff') then
    raise exception 'invalid organization role'
      using errcode = '22023';
  end if;

  if p_membership_status not in ('invited', 'active') then
    raise exception 'invalid membership status'
      using errcode = '22023';
  end if;

  select status
    into current_org_status
  from public.organizations
  where id = p_organization_id
  for update;

  if current_org_status is null then
    raise exception 'organization not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.platform_admins
    where user_id = p_user_id
  ) then
    raise exception 'user is a platform administrator'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.organization_users
    where user_id = p_user_id
      and organization_id <> p_organization_id
  ) then
    raise exception 'user already belongs to another organization'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.organization_users
    where user_id = p_user_id
      and organization_id = p_organization_id
  ) then
    raise exception 'user already belongs to this organization'
      using errcode = 'P0001';
  end if;

  insert into public.organization_users (
    organization_id,
    user_id,
    role,
    status
  ) values (
    p_organization_id,
    p_user_id,
    p_role,
    p_membership_status
  )
  returning id into new_membership_id;

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
    'organization.user_invited',
    'organization_user',
    p_user_id,
    p_organization_id,
    jsonb_build_object(
      'email', p_email,
      'role', p_role,
      'membershipStatus', p_membership_status
    )
  );

  return new_membership_id;
end;
$$;

revoke all on function public.admin_invite_organization_user(uuid, uuid, text, text, text)
  from public, anon, service_role;
grant execute on function public.admin_invite_organization_user(uuid, uuid, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Change a non-owner role, or refuse last-owner demotion
-- ---------------------------------------------------------------------------

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
  current_role text;
  current_status text;
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
    into current_role, current_status
  from public.organization_users ou
  where ou.organization_id = p_organization_id
    and ou.user_id = p_user_id
  for update;

  if current_role is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if current_role = p_role then
    return;
  end if;

  if current_role = 'owner'
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
      'previousRole', current_role,
      'role', p_role,
      'membershipStatus', current_status
    )
  );
end;
$$;

revoke all on function public.admin_set_organization_user_role(uuid, uuid, text)
  from public, anon, service_role;
grant execute on function public.admin_set_organization_user_role(uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Suspend / reactivate membership without leaving zero owners
-- ---------------------------------------------------------------------------

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
  current_role text;
  current_status text;
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
    into current_role, current_status
  from public.organization_users ou
  where ou.organization_id = p_organization_id
    and ou.user_id = p_user_id
  for update;

  if current_role is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if current_status = p_status then
    return;
  end if;

  if p_status = 'suspended'
    and current_role = 'owner'
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
      'role', current_role,
      'previousStatus', current_status,
      'status', p_status
    )
  );
end;
$$;

revoke all on function public.admin_set_organization_user_status(uuid, uuid, text)
  from public, anon, service_role;
grant execute on function public.admin_set_organization_user_status(uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic ownership transfer
-- ---------------------------------------------------------------------------

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
  new_owner_role text;
  new_owner_status text;
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
    into new_owner_role, new_owner_status
  from public.organization_users ou
  where ou.organization_id = p_organization_id
    and ou.user_id = p_new_owner_user_id
  for update;

  if new_owner_role is null then
    raise exception 'membership not found'
      using errcode = 'P0002';
  end if;

  if new_owner_status <> 'active' then
    raise exception 'new owner must be an active organization member'
      using errcode = 'P0001';
  end if;

  if new_owner_role = 'owner' then
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

revoke all on function public.admin_transfer_organization_ownership(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.admin_transfer_organization_ownership(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Support sessions
-- ---------------------------------------------------------------------------

create or replace function public.start_support_session(
  p_organization_id uuid,
  p_reason text,
  p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_session_id uuid;
  duration integer;
  trimmed_reason text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  duration := coalesce(p_duration_minutes, 120);

  if duration < 15 or duration > 480 then
    raise exception 'invalid support session duration'
      using errcode = '22023';
  end if;

  trimmed_reason := nullif(btrim(coalesce(p_reason, '')), '');

  if trimmed_reason is null or char_length(trimmed_reason) < 3 then
    raise exception 'support reason is required'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'organization not found'
      using errcode = 'P0002';
  end if;

  update public.support_sessions
    set ended_at = now()
  where platform_admin_user_id = auth.uid()
    and ended_at is null;

  insert into public.support_sessions (
    platform_admin_user_id,
    organization_id,
    reason,
    expires_at
  ) values (
    auth.uid(),
    p_organization_id,
    left(trimmed_reason, 500),
    now() + make_interval(mins => duration)
  )
  returning id into new_session_id;

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
    'support_session.started',
    'support_session',
    new_session_id,
    p_organization_id,
    jsonb_build_object(
      'reason', left(trimmed_reason, 500),
      'durationMinutes', duration
    )
  );

  return new_session_id;
end;
$$;

revoke all on function public.start_support_session(uuid, text, integer)
  from public, anon, service_role;
grant execute on function public.start_support_session(uuid, text, integer)
  to authenticated;

create or replace function public.end_support_session(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_org uuid;
  already_ended timestamptz;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select organization_id, ended_at
    into session_org, already_ended
  from public.support_sessions
  where id = p_session_id
    and platform_admin_user_id = auth.uid()
  for update;

  if session_org is null then
    raise exception 'support session not found'
      using errcode = 'P0002';
  end if;

  if already_ended is not null then
    return;
  end if;

  update public.support_sessions
    set ended_at = now()
  where id = p_session_id
    and platform_admin_user_id = auth.uid()
    and ended_at is null;

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
    'support_session.ended',
    'support_session',
    p_session_id,
    session_org,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.end_support_session(uuid)
  from public, anon, service_role;
grant execute on function public.end_support_session(uuid)
  to authenticated;
