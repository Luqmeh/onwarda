-- First-time client onboarding. Organization identity always comes from auth.uid().

create table public.organization_onboarding (
  organization_id uuid primary key references public.organizations (id) on delete restrict,
  status text not null default 'not_started',
  current_step text not null default 'welcome',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_onboarding_status_check
    check (status in ('not_started', 'in_progress', 'completed')),
  constraint organization_onboarding_step_check
    check (current_step in (
      'welcome',
      'business',
      'branding',
      'properties',
      'guides',
      'operations',
      'review'
    ))
);

create trigger organization_onboarding_set_updated_at
  before update on public.organization_onboarding
  for each row execute function public.set_updated_at();

alter table public.organization_onboarding enable row level security;
alter table public.organization_onboarding force row level security;

revoke all on table public.organization_onboarding from anon, public, authenticated;
grant select on table public.organization_onboarding to authenticated;

create policy organization_onboarding_select_member
  on public.organization_onboarding for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy organization_onboarding_select_support
  on public.organization_onboarding for select to authenticated
  using (public.has_active_support_access(organization_id));

create or replace function public.accept_client_invitation()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_membership public.organization_users%rowtype;
  v_row public.organization_onboarding%rowtype;
  v_was_invited boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if public.is_active_platform_admin() then
    return jsonb_build_object('status', 'admin');
  end if;

  select count(*) into v_count
  from public.organization_users membership
  where membership.user_id = auth.uid()
    and membership.status in ('invited', 'active');

  if v_count = 0 then
    return jsonb_build_object('status', 'none');
  end if;

  if v_count > 1 then
    return jsonb_build_object('status', 'ambiguous');
  end if;

  select * into v_membership
  from public.organization_users
  where user_id = auth.uid()
    and status in ('invited', 'active')
  for update;

  if v_membership.status = 'invited' then
    update public.organization_users
      set status = 'active'
    where id = v_membership.id;
    v_was_invited := true;
  end if;

  select * into v_row
  from public.organization_onboarding
  where organization_id = v_membership.organization_id;

  if v_row.organization_id is null then
    insert into public.organization_onboarding (organization_id, status, current_step)
    values (v_membership.organization_id, 'in_progress', 'welcome')
    returning * into v_row;

    update public.organizations
      set onboarding_status = 'in_progress'
    where id = v_membership.organization_id
      and onboarding_status <> 'complete';

    insert into public.events (organization_id, actor_user_id, event_type, metadata)
    values (
      v_membership.organization_id,
      auth.uid(),
      'onboarding.started',
      jsonb_build_object('role', v_membership.role)
    );

    insert into public.audit_logs (
      actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
    ) values (
      auth.uid(),
      'organization_user',
      'onboarding.started',
      'organization',
      v_membership.organization_id,
      v_membership.organization_id,
      jsonb_build_object('wasInvited', v_was_invited)
    );
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'organizationId', v_membership.organization_id,
    'role', v_membership.role,
    'wasInvited', v_was_invited,
    'onboardingStatus', v_row.status,
    'currentStep', v_row.current_step
  );
end;
$$;

revoke all on function public.accept_client_invitation() from public, anon;
grant execute on function public.accept_client_invitation() to authenticated;

create or replace function public.workspace_set_onboarding_step(p_step text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_status text;
begin
  if auth.uid() is null or public.is_active_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_step not in ('welcome', 'business', 'branding', 'properties', 'guides', 'operations', 'review') then
    raise exception 'invalid onboarding step' using errcode = '22023';
  end if;

  select organization_id into v_org
  from public.organization_users
  where user_id = auth.uid()
    and status = 'active'
    and role in ('owner', 'admin');

  if v_org is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select status into v_status
  from public.organization_onboarding
  where organization_id = v_org
  for update;

  if v_status is null or v_status = 'completed' then
    return jsonb_build_object('status', 'completed', 'currentStep', 'review');
  end if;

  update public.organization_onboarding
    set status = 'in_progress', current_step = p_step
  where organization_id = v_org;

  update public.organizations
    set onboarding_status = 'in_progress'
  where id = v_org
    and onboarding_status <> 'complete';

  return jsonb_build_object('status', 'ok', 'currentStep', p_step);
end;
$$;

revoke all on function public.workspace_set_onboarding_step(text) from public, anon;
grant execute on function public.workspace_set_onboarding_step(text) to authenticated;

create or replace function public.workspace_complete_onboarding()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null or public.is_active_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select organization_id into v_org
  from public.organization_users
  where user_id = auth.uid()
    and status = 'active'
    and role in ('owner', 'admin');

  if v_org is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.organization_onboarding
    set status = 'completed', current_step = 'review', completed_at = coalesce(completed_at, now())
  where organization_id = v_org;

  if not found then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.organizations
    set onboarding_status = 'complete'
  where id = v_org;

  insert into public.events (organization_id, actor_user_id, event_type, metadata)
  values (v_org, auth.uid(), 'onboarding.completed', '{}'::jsonb);

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    auth.uid(), 'organization_user', 'onboarding.completed', 'organization', v_org, v_org, '{}'::jsonb
  );

  return jsonb_build_object('status', 'completed', 'organizationId', v_org);
end;
$$;

revoke all on function public.workspace_complete_onboarding() from public, anon;
grant execute on function public.workspace_complete_onboarding() to authenticated;
