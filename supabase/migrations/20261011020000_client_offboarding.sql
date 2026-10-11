-- Platform-admin client offboarding.
-- Suspension stays on set_organization_status. This migration adds the
-- irreversible purge, which only service_role can execute, and makes
-- suspended or archived organizations fail guest and cleaner token lookup.

-- ---------------------------------------------------------------------------
-- Guest and cleaner links follow the suspended-organization rule
-- ---------------------------------------------------------------------------

create or replace function public.inspect_guest_portal_token(p_token_hash text)
returns table (
  status text,
  token_id uuid,
  organization_id uuid,
  reservation_id uuid,
  property_id uuid,
  guest_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
  select
    case
      when t.revoked_at is not null then 'revoked'
      when t.expires_at is not null and t.expires_at <= now() then 'expired'
      when o.status in ('suspended', 'archived') then 'unavailable'
      when r.id is null or r.status = 'cancelled' or p.id is null then 'unavailable'
      else 'valid'
    end,
    t.id,
    t.organization_id,
    t.reservation_id,
    t.property_id,
    r.guest_id
  from public.guest_portal_tokens t
  left join public.organizations o on o.id = t.organization_id
  left join public.reservations r
    on r.id = t.reservation_id
   and r.organization_id = t.organization_id
  left join public.properties p
    on p.id = t.property_id
   and p.organization_id = t.organization_id
  where t.token_hash = p_token_hash
  limit 1;
end;
$$;

revoke all on function public.inspect_guest_portal_token(text)
  from public, anon, authenticated;
grant execute on function public.inspect_guest_portal_token(text)
  to service_role;

create or replace function public.inspect_cleaner_link(p_token_hash text)
returns table (
  status text,
  cleaning_agent_id uuid,
  organization_id uuid,
  display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.cleaning_agent_links%rowtype;
  v_agent public.cleaning_agents%rowtype;
  v_org_status text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select * into v_link
  from public.cleaning_agent_links
  where token_hash = p_token_hash;

  if not found then
    return;
  end if;

  select * into v_agent
  from public.cleaning_agents
  where id = v_link.cleaning_agent_id;

  select o.status into v_org_status
  from public.organizations o
  where o.id = v_agent.organization_id;

  if v_link.revoked_at is not null then
    status := 'revoked';
  elsif v_link.expires_at is not null and v_link.expires_at <= now() then
    status := 'expired';
  elsif v_org_status in ('suspended', 'archived') or v_org_status is null then
    status := 'disabled';
  elsif not v_agent.active then
    status := 'disabled';
  else
    status := 'valid';
  end if;

  cleaning_agent_id := v_agent.id;
  organization_id := v_agent.organization_id;
  display_name := v_agent.display_name;
  return next;
end;
$$;

revoke all on function public.inspect_cleaner_link(text) from public, anon, authenticated;
grant execute on function public.inspect_cleaner_link(text) to service_role;

-- ---------------------------------------------------------------------------
-- Recoverable deletion job. Identifying fields are cleared after success.
-- ---------------------------------------------------------------------------

create table public.platform_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  phase text not null default 'blocked',
  storage_removed boolean not null default false,
  database_removed boolean not null default false,
  auth_removed boolean not null default false,
  auth_user_ids uuid[] not null default '{}',
  storage_error text,
  database_error text,
  auth_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint platform_deletion_jobs_phase_check
    check (phase in ('blocked', 'storage', 'database', 'auth', 'complete', 'incomplete'))
);

create unique index platform_deletion_jobs_open_org_idx
  on public.platform_deletion_jobs (organization_id)
  where completed_at is null and organization_id is not null;

alter table public.platform_deletion_jobs enable row level security;
alter table public.platform_deletion_jobs force row level security;

revoke all on table public.platform_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_deletion_jobs to service_role;

-- ---------------------------------------------------------------------------
-- Authorization shared by the destructive functions
-- ---------------------------------------------------------------------------

create or replace function public.assert_platform_deletion_actor(p_actor_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.platform_admins
    where user_id = p_actor_user_id
      and status = 'active'
  ) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_platform_deletion_actor(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Preview. Shared definitions are counted as preserved, never deleted.
-- Auth classification uses membership and platform_admins, never email.
-- ---------------------------------------------------------------------------

create or replace function public.admin_organization_deletion_preview(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_eligible uuid[];
  v_shared integer;
  v_admins integer;
  v_review integer;
  v_storage integer;
begin
  select exists (select 1 from public.organizations where id = p_organization_id)
    into v_exists;

  if not v_exists then
    return jsonb_build_object('status', 'not_found');
  end if;

  select coalesce(array_agg(member.user_id), '{}')
    into v_eligible
  from public.organization_users member
  where member.organization_id = p_organization_id
    and exists (select 1 from auth.users account where account.id = member.user_id)
    and not exists (
      select 1
      from public.platform_admins admin
      where admin.user_id = member.user_id
    )
    and not exists (
      select 1
      from public.organization_users other
      where other.user_id = member.user_id
        and other.organization_id <> p_organization_id
    );

  select count(*)::integer into v_shared
  from public.organization_users member
  where member.organization_id = p_organization_id
    and not exists (
      select 1 from public.platform_admins admin where admin.user_id = member.user_id
    )
    and exists (
      select 1
      from public.organization_users other
      where other.user_id = member.user_id
        and other.organization_id <> p_organization_id
    );

  select count(*)::integer into v_admins
  from public.organization_users member
  where member.organization_id = p_organization_id
    and exists (
      select 1 from public.platform_admins admin where admin.user_id = member.user_id
    );

  select count(*)::integer into v_review
  from public.organization_users member
  where member.organization_id = p_organization_id
    and not exists (select 1 from auth.users account where account.id = member.user_id);

  select count(*)::integer into v_storage
  from storage.objects object
  where object.bucket_id in (
      'organization-assets',
      'property-media',
      'guest-documents',
      'organization-branding'
    )
    and object.name like 'organizations/' || p_organization_id::text || '/%';

  return jsonb_build_object(
    'status', 'ok',
    'eligibleUserIds', to_jsonb(v_eligible),
    'auth', jsonb_build_object(
      'eligible', coalesce(array_length(v_eligible, 1), 0),
      'shared', v_shared,
      'platformAdmins', v_admins,
      'review', v_review
    ),
    'counts', jsonb_build_object(
      'organizations', 1,
      'onboarding', (select count(*) from public.organization_onboarding where organization_id = p_organization_id),
      'branding', (select count(*) from public.organization_branding where organization_id = p_organization_id),
      'members', (select count(*) from public.organization_users where organization_id = p_organization_id),
      'properties', (select count(*) from public.properties where organization_id = p_organization_id),
      'reservations', (select count(*) from public.reservations where organization_id = p_organization_id),
      'guests', (select count(*) from public.guests where organization_id = p_organization_id),
      'guestPortalTokens', (select count(*) from public.guest_portal_tokens where organization_id = p_organization_id),
      'guestRuleAcceptances', (select count(*) from public.guest_rule_acceptances where organization_id = p_organization_id),
      'propertyLanguages', (select count(*) from public.property_languages where organization_id = p_organization_id),
      'propertyAmenities', (select count(*) from public.property_amenities where organization_id = p_organization_id),
      'propertyHouseRules', (select count(*) from public.property_house_rules where organization_id = p_organization_id),
      'propertyContent', (select count(*) from public.property_content where organization_id = p_organization_id),
      'propertyKnowledge', (select count(*) from public.property_knowledge where organization_id = p_organization_id),
      'propertyMedia', (select count(*) from public.property_media where organization_id = p_organization_id),
      'issues', (select count(*) from public.issues where organization_id = p_organization_id),
      'events', (select count(*) from public.events where organization_id = p_organization_id),
      'cleaningAgents', (select count(*) from public.cleaning_agents where organization_id = p_organization_id),
      'cleaningAgentLinks', (select count(*) from public.cleaning_agent_links where organization_id = p_organization_id),
      'propertyCleaningAgents', (select count(*) from public.property_cleaning_agents where organization_id = p_organization_id),
      'cleaningTasks', (select count(*) from public.cleaning_tasks where organization_id = p_organization_id),
      'cleaningTaskItems', (select count(*) from public.cleaning_task_items where organization_id = p_organization_id),
      'subscriptions', (select count(*) from public.organization_subscriptions where organization_id = p_organization_id),
      'subscriptionEvents', (select count(*) from public.organization_subscription_events where organization_id = p_organization_id),
      'supportSessions', (select count(*) from public.support_sessions where organization_id = p_organization_id),
      'auditLogs', (select count(*) from public.audit_logs where organization_id = p_organization_id),
      'storageObjects', v_storage
    ),
    'preservedShared', jsonb_build_array(
      'amenity_definitions',
      'house_rule_definitions',
      'cleaning_checklist_definitions',
      'commercial_inquiries'
    )
  );
end;
$$;

revoke all on function public.admin_organization_deletion_preview(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_organization_deletion_preview(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Immediately block workspace-adjacent tokens. Idempotent.
-- Status change for active/pending organizations uses the existing suspended state.
-- ---------------------------------------------------------------------------

create or replace function public.admin_block_organization_for_deletion(
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform public.assert_platform_deletion_actor(p_actor_user_id);

  select status into v_status
  from public.organizations
  where id = p_organization_id
  for update;

  if v_status is null then
    return;
  end if;

  if v_status in ('active', 'pending') then
    update public.organizations
      set status = 'suspended'
    where id = p_organization_id;
  end if;

  update public.guest_portal_tokens
    set revoked_at = coalesce(revoked_at, now())
  where organization_id = p_organization_id
    and revoked_at is null;

  update public.cleaning_agent_links
    set revoked_at = coalesce(revoked_at, now())
  where organization_id = p_organization_id
    and revoked_at is null;
end;
$$;

revoke all on function public.admin_block_organization_for_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_block_organization_for_deletion(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Transactional tenant purge. Does not delete shared definitions, other
-- organizations, platform administrators, or Auth users.
-- ---------------------------------------------------------------------------

create or replace function public.admin_purge_organization_data(
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  perform public.assert_platform_deletion_actor(p_actor_user_id);

  select exists (select 1 from public.organizations where id = p_organization_id)
    into v_exists;

  if not v_exists then
    return jsonb_build_object('status', 'already_removed', 'counts', v_counts);
  end if;

  perform 1 from public.organizations where id = p_organization_id for update;

  delete from public.cleaning_task_items where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cleaningTaskItems', v_n);

  delete from public.cleaning_tasks where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cleaningTasks', v_n);

  delete from public.property_cleaning_agents where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('propertyCleaningAgents', v_n);

  delete from public.cleaning_agent_links where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cleaningAgentLinks', v_n);

  delete from public.cleaning_agents where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('cleaningAgents', v_n);

  delete from public.guest_rule_acceptances where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('guestRuleAcceptances', v_n);

  delete from public.guest_portal_tokens where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('guestPortalTokens', v_n);

  delete from public.issues where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('issues', v_n);

  delete from public.events
  where organization_id = p_organization_id
     or property_id in (select id from public.properties where organization_id = p_organization_id)
     or reservation_id in (select id from public.reservations where organization_id = p_organization_id)
     or guest_id in (select id from public.guests where organization_id = p_organization_id);
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('events', v_n);

  delete from public.property_knowledge where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('propertyKnowledge', v_n);

  delete from public.property_media where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('propertyMedia', v_n);

  delete from public.property_content where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('propertyContent', v_n);

  delete from public.property_house_rules where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('propertyHouseRules', v_n);

  delete from public.property_amenities where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('propertyAmenities', v_n);

  delete from public.property_languages where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('propertyLanguages', v_n);

  delete from public.reservations where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('reservations', v_n);

  delete from public.guests where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('guests', v_n);

  delete from public.properties where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('properties', v_n);

  delete from public.organization_subscription_events where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('subscriptionEvents', v_n);

  delete from public.organization_subscriptions where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('subscriptions', v_n);

  delete from public.organization_branding where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('branding', v_n);

  delete from public.organization_onboarding where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('onboarding', v_n);

  delete from public.support_sessions where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('supportSessions', v_n);

  delete from public.audit_logs where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('auditLogs', v_n);

  delete from public.organization_users where organization_id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('members', v_n);

  delete from public.organizations where id = p_organization_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('organizations', v_n);

  insert into public.audit_logs (
    actor_user_id,
    actor_type,
    action,
    target_type,
    target_id,
    organization_id,
    metadata
  ) values (
    p_actor_user_id,
    'platform_admin',
    'organization.permanently_deleted',
    'platform',
    null,
    null,
    jsonb_build_object('outcome', 'database_removed')
  );

  return jsonb_build_object('status', 'removed', 'counts', v_counts);
end;
$$;

revoke all on function public.admin_purge_organization_data(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_purge_organization_data(uuid, uuid)
  to service_role;
