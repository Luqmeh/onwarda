-- Phase 7: cleaning profiles, permanent cleaner links, turnover tasks.
-- Guest checkout, task creation, and the property cleaning hold are one function.

alter table public.audit_logs
  drop constraint audit_logs_actor_type_check;

alter table public.audit_logs
  add constraint audit_logs_actor_type_check
    check (actor_type in ('platform_admin', 'organization_user', 'guest', 'system', 'cleaner'));

alter table public.properties
  add column if not exists operational_readiness text not null default 'ready';

alter table public.properties
  drop constraint if exists properties_operational_readiness_check;

alter table public.properties
  add constraint properties_operational_readiness_check
    check (operational_readiness in ('ready', 'cleaning_required', 'cleaning_in_progress'));

-- ---------------------------------------------------------------------------
-- Canonical checklist. Global, not tenant-owned. Snapshotted onto each task.
-- ---------------------------------------------------------------------------

create table public.cleaning_checklist_definitions (
  key text primary key,
  category text not null,
  label text not null,
  sort_order integer not null,
  required boolean not null default true,
  constraint cleaning_checklist_definitions_category_check
    check (category in ('bedrooms', 'bathrooms', 'kitchen', 'living', 'general'))
);

alter table public.cleaning_checklist_definitions enable row level security;
alter table public.cleaning_checklist_definitions force row level security;

revoke all on table public.cleaning_checklist_definitions from anon, public, authenticated;
grant select on table public.cleaning_checklist_definitions to authenticated;

create policy cleaning_checklist_definitions_select_authenticated
  on public.cleaning_checklist_definitions
  for select
  to authenticated
  using (true);

insert into public.cleaning_checklist_definitions (key, category, label, sort_order, required) values
  ('beds_linens', 'bedrooms', 'Beds made / linens changed', 10, true),
  ('bedroom_surfaces', 'bedrooms', 'Surfaces cleaned', 20, true),
  ('bedroom_floors', 'bedrooms', 'Floors cleaned', 30, true),
  ('toilet', 'bathrooms', 'Toilet cleaned', 40, true),
  ('shower', 'bathrooms', 'Shower / bath cleaned', 50, true),
  ('sink_mirror', 'bathrooms', 'Sink / mirror cleaned', 60, true),
  ('towels', 'bathrooms', 'Towels replaced', 70, true),
  ('counters', 'kitchen', 'Counters cleaned', 80, true),
  ('kitchen_sink', 'kitchen', 'Sink cleaned', 90, true),
  ('appliances', 'kitchen', 'Appliances checked', 100, true),
  ('kitchen_reset', 'kitchen', 'Kitchen items reset', 110, true),
  ('living_surfaces', 'living', 'Surfaces cleaned', 120, true),
  ('living_floors', 'living', 'Floors cleaned', 130, true),
  ('furniture_reset', 'living', 'Furniture reset', 140, true),
  ('trash', 'general', 'Trash removed', 150, true),
  ('supplies', 'general', 'Supplies/restocking checked', 160, true),
  ('final_inspection', 'general', 'Final property inspection', 170, true);

-- ---------------------------------------------------------------------------
-- cleaning_agents — operational identity, not a Supabase Auth user
-- ---------------------------------------------------------------------------

create table public.cleaning_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  display_name text not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cleaning_agents_name_length check (char_length(display_name) between 2 and 80),
  constraint cleaning_agents_notes_length check (notes is null or char_length(notes) <= 500)
);

create index cleaning_agents_organization_idx
  on public.cleaning_agents (organization_id, active);

create trigger cleaning_agents_set_updated_at
  before update on public.cleaning_agents
  for each row execute function public.set_updated_at();

create trigger cleaning_agents_prevent_reparent
  before update on public.cleaning_agents
  for each row execute function public.prevent_tenant_reparent();

create or replace function public.deactivate_cleaning_agent_access()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.active and not new.active then
    update public.property_cleaning_agents
      set active = false
    where cleaning_agent_id = new.id
      and active;

    update public.cleaning_agent_links
      set revoked_at = now()
    where cleaning_agent_id = new.id
      and revoked_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.deactivate_cleaning_agent_access() from public;

create trigger cleaning_agents_deactivate_access
  before update on public.cleaning_agents
  for each row execute function public.deactivate_cleaning_agent_access();

-- ---------------------------------------------------------------------------
-- One permanent link per cleaner. Raw token is never stored.
-- ---------------------------------------------------------------------------

create table public.cleaning_agent_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  cleaning_agent_id uuid not null references public.cleaning_agents (id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cleaning_agent_links_hash_format_check
    check (token_hash ~ '^[0-9a-f]{64}$')
);

create index cleaning_agent_links_agent_idx
  on public.cleaning_agent_links (cleaning_agent_id, created_at desc);

create unique index cleaning_agent_links_one_active_idx
  on public.cleaning_agent_links (cleaning_agent_id)
  where revoked_at is null;

create trigger cleaning_agent_links_prevent_reparent
  before update on public.cleaning_agent_links
  for each row execute function public.prevent_tenant_reparent();

create or replace function public.enforce_cleaning_agent_link_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.cleaning_agents agent
    where agent.id = new.cleaning_agent_id
      and agent.organization_id = new.organization_id
  ) then
    raise exception 'cleaning link organization mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_cleaning_agent_link_organization() from public;

create trigger cleaning_agent_links_organization_consistency
  before insert or update on public.cleaning_agent_links
  for each row execute function public.enforce_cleaning_agent_link_organization();

-- ---------------------------------------------------------------------------
-- property_cleaning_agents
-- ---------------------------------------------------------------------------

create table public.property_cleaning_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete restrict,
  cleaning_agent_id uuid not null references public.cleaning_agents (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_cleaning_agents_unique unique (property_id, cleaning_agent_id)
);

create index property_cleaning_agents_org_idx
  on public.property_cleaning_agents (organization_id);

create index property_cleaning_agents_agent_idx
  on public.property_cleaning_agents (cleaning_agent_id)
  where active;

create trigger property_cleaning_agents_set_updated_at
  before update on public.property_cleaning_agents
  for each row execute function public.set_updated_at();

create trigger property_cleaning_agents_prevent_reparent
  before update on public.property_cleaning_agents
  for each row execute function public.prevent_tenant_reparent();

create or replace function public.enforce_property_cleaning_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.properties property
    join public.cleaning_agents agent on agent.organization_id = property.organization_id
    where property.id = new.property_id
      and agent.id = new.cleaning_agent_id
      and property.organization_id = new.organization_id
  ) then
    raise exception 'cleaning assignment organization mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_property_cleaning_assignment() from public;

create trigger property_cleaning_agents_organization_consistency
  before insert or update on public.property_cleaning_agents
  for each row execute function public.enforce_property_cleaning_assignment();

-- ---------------------------------------------------------------------------
-- cleaning_tasks — one guest-checkout task per reservation
-- ---------------------------------------------------------------------------

create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete restrict,
  reservation_id uuid not null references public.reservations (id) on delete restrict,
  status text not null default 'queued',
  trigger_type text not null,
  started_at timestamptz,
  completed_at timestamptz,
  reopened_at timestamptz,
  cancelled_at timestamptz,
  started_by_agent_id uuid references public.cleaning_agents (id) on delete restrict,
  completed_by_agent_id uuid references public.cleaning_agents (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cleaning_tasks_status_check
    check (status in ('queued', 'in_progress', 'completed', 'cancelled')),
  constraint cleaning_tasks_trigger_check
    check (trigger_type in ('guest_checkout'))
);

create unique index cleaning_tasks_one_guest_checkout_idx
  on public.cleaning_tasks (reservation_id)
  where trigger_type = 'guest_checkout';

create index cleaning_tasks_org_status_idx
  on public.cleaning_tasks (organization_id, status, created_at desc);

create index cleaning_tasks_property_idx
  on public.cleaning_tasks (property_id, status);

create trigger cleaning_tasks_set_updated_at
  before update on public.cleaning_tasks
  for each row execute function public.set_updated_at();

create trigger cleaning_tasks_prevent_reparent
  before update on public.cleaning_tasks
  for each row execute function public.prevent_tenant_reparent();

create or replace function public.enforce_cleaning_task_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.reservations reservation
    join public.properties property on property.id = reservation.property_id
    where reservation.id = new.reservation_id
      and property.id = new.property_id
      and reservation.organization_id = new.organization_id
      and property.organization_id = new.organization_id
  ) then
    raise exception 'cleaning task organization mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_cleaning_task_organization() from public;

create trigger cleaning_tasks_organization_consistency
  before insert or update on public.cleaning_tasks
  for each row execute function public.enforce_cleaning_task_organization();

create table public.cleaning_task_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  cleaning_task_id uuid not null references public.cleaning_tasks (id) on delete restrict,
  item_key text not null,
  category text not null,
  label text not null,
  sort_order integer not null,
  required boolean not null default true,
  completed_at timestamptz,
  completed_by_agent_id uuid references public.cleaning_agents (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint cleaning_task_items_unique unique (cleaning_task_id, item_key)
);

create index cleaning_task_items_org_idx
  on public.cleaning_task_items (organization_id, cleaning_task_id);

create trigger cleaning_task_items_prevent_reparent
  before update on public.cleaning_task_items
  for each row execute function public.prevent_tenant_reparent();

create or replace function public.enforce_cleaning_task_item_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.cleaning_tasks task
    where task.id = new.cleaning_task_id
      and task.organization_id = new.organization_id
  ) then
    raise exception 'cleaning item organization mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_cleaning_task_item_organization() from public;

create trigger cleaning_task_items_organization_consistency
  before insert or update on public.cleaning_task_items
  for each row execute function public.enforce_cleaning_task_item_organization();

-- ---------------------------------------------------------------------------
-- Privileges
-- token_hash is not granted to authenticated.
-- Task and item writes go through security-definer functions.
-- ---------------------------------------------------------------------------

revoke all on table public.cleaning_agents from anon, public, authenticated;
revoke all on table public.cleaning_agent_links from anon, public, authenticated;
revoke all on table public.property_cleaning_agents from anon, public, authenticated;
revoke all on table public.cleaning_tasks from anon, public, authenticated;
revoke all on table public.cleaning_task_items from anon, public, authenticated;

grant select, insert, update on table public.cleaning_agents to authenticated;
grant select (
  id, organization_id, cleaning_agent_id, expires_at, revoked_at, rotated_at, created_at
) on table public.cleaning_agent_links to authenticated;
grant insert (
  organization_id, cleaning_agent_id, token_hash, rotated_at
) on table public.cleaning_agent_links to authenticated;
grant update (
  revoked_at
) on table public.cleaning_agent_links to authenticated;
grant select, insert, update on table public.property_cleaning_agents to authenticated;
grant select on table public.cleaning_tasks to authenticated;
grant select on table public.cleaning_task_items to authenticated;

alter table public.cleaning_agents enable row level security;
alter table public.cleaning_agents force row level security;
alter table public.cleaning_agent_links enable row level security;
alter table public.cleaning_agent_links force row level security;
alter table public.property_cleaning_agents enable row level security;
alter table public.property_cleaning_agents force row level security;
alter table public.cleaning_tasks enable row level security;
alter table public.cleaning_tasks force row level security;
alter table public.cleaning_task_items enable row level security;
alter table public.cleaning_task_items force row level security;

create policy cleaning_agents_select_member
  on public.cleaning_agents for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy cleaning_agents_select_support
  on public.cleaning_agents for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy cleaning_agents_insert_operational
  on public.cleaning_agents for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy cleaning_agents_update_operational
  on public.cleaning_agents for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy cleaning_agent_links_select_member
  on public.cleaning_agent_links for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy cleaning_agent_links_select_support
  on public.cleaning_agent_links for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy property_cleaning_agents_select_member
  on public.property_cleaning_agents for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy property_cleaning_agents_select_support
  on public.property_cleaning_agents for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy property_cleaning_agents_insert_operational
  on public.property_cleaning_agents for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy property_cleaning_agents_update_operational
  on public.property_cleaning_agents for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy cleaning_tasks_select_member
  on public.cleaning_tasks for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy cleaning_tasks_select_support
  on public.cleaning_tasks for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy cleaning_task_items_select_member
  on public.cleaning_task_items for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy cleaning_task_items_select_support
  on public.cleaning_task_items for select to authenticated
  using (public.has_active_support_access(organization_id));

-- ---------------------------------------------------------------------------
-- Readiness + snapshots
-- ---------------------------------------------------------------------------

create or replace function public.refresh_property_cleaning_readiness(p_property_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_state text;
begin
  if exists (
    select 1 from public.cleaning_tasks
    where property_id = p_property_id
      and status = 'in_progress'
  ) then
    next_state := 'cleaning_in_progress';
  elsif exists (
    select 1 from public.cleaning_tasks
    where property_id = p_property_id
      and status = 'queued'
  ) then
    next_state := 'cleaning_required';
  else
    next_state := 'ready';
  end if;

  update public.properties
    set operational_readiness = next_state
  where id = p_property_id;

  return next_state;
end;
$$;

revoke all on function public.refresh_property_cleaning_readiness(uuid)
  from public, anon, authenticated;

create or replace function public.snapshot_cleaning_checklist(
  p_organization_id uuid,
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cleaning_task_items (
    organization_id,
    cleaning_task_id,
    item_key,
    category,
    label,
    sort_order,
    required
  )
  select
    p_organization_id,
    p_task_id,
    definition.key,
    definition.category,
    definition.label,
    definition.sort_order,
    definition.required
  from public.cleaning_checklist_definitions definition
  order by definition.sort_order;
end;
$$;

revoke all on function public.snapshot_cleaning_checklist(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest checkout creates exactly one cleaning task and holds the property.
-- ---------------------------------------------------------------------------

create or replace function public.guest_complete_checkout(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspect record;
  v_previous_checkout timestamptz;
  v_task_id uuid;
  v_readiness text;
begin
  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_inspect.status <> 'valid' then
    return jsonb_build_object('status', v_inspect.status);
  end if;

  select checkout_completed_at into v_previous_checkout
  from public.reservations
  where id = v_inspect.reservation_id
  for update;

  update public.reservations
  set
    checkout_completed_at = coalesce(checkout_completed_at, now()),
    journey_status = 'checked_out',
    status = case
      when status in ('upcoming', 'active') then 'completed'
      else status
    end
  where id = v_inspect.reservation_id
    and organization_id = v_inspect.organization_id;

  insert into public.cleaning_tasks (
    organization_id,
    property_id,
    reservation_id,
    status,
    trigger_type
  ) values (
    v_inspect.organization_id,
    v_inspect.property_id,
    v_inspect.reservation_id,
    'queued',
    'guest_checkout'
  )
  on conflict (reservation_id) where trigger_type = 'guest_checkout'
  do nothing
  returning id into v_task_id;

  if v_task_id is not null then
    perform public.snapshot_cleaning_checklist(v_inspect.organization_id, v_task_id);

    insert into public.events (organization_id, reservation_id, property_id, event_type, metadata)
    values (
      v_inspect.organization_id,
      v_inspect.reservation_id,
      v_inspect.property_id,
      'cleaning.task_created',
      jsonb_build_object('trigger', 'guest_checkout', 'taskId', v_task_id)
    );

    insert into public.audit_logs (
      actor_type, action, target_type, target_id, organization_id, metadata
    ) values (
      'guest',
      'cleaning.task_created',
      'cleaning_task',
      v_task_id,
      v_inspect.organization_id,
      jsonb_build_object('trigger', 'guest_checkout')
    );
  end if;

  v_readiness := public.refresh_property_cleaning_readiness(v_inspect.property_id);

  if v_task_id is not null then
    insert into public.events (organization_id, property_id, event_type, metadata)
    values (
      v_inspect.organization_id,
      v_inspect.property_id,
      'property.cleaning_hold_started',
      jsonb_build_object('readiness', v_readiness, 'taskId', v_task_id)
    );
  end if;

  if v_previous_checkout is null then
    insert into public.events (organization_id, reservation_id, property_id, event_type, metadata)
    values (
      v_inspect.organization_id,
      v_inspect.reservation_id,
      v_inspect.property_id,
      'guest.checkout_completed',
      jsonb_build_object('taskId', v_task_id)
    );

    insert into public.audit_logs (
      actor_type, action, target_type, target_id, organization_id, metadata
    ) values (
      'guest',
      'guest.checkout_completed',
      'reservation',
      v_inspect.reservation_id,
      v_inspect.organization_id,
      '{}'::jsonb
    );
  end if;

  return jsonb_build_object('status', 'ok', 'taskId', v_task_id, 'readiness', v_readiness);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cleaner token resolution. Service role only. Hash in, no raw token out.
-- ---------------------------------------------------------------------------

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

  if v_link.revoked_at is not null then
    status := 'revoked';
  elsif v_link.expires_at is not null and v_link.expires_at <= now() then
    status := 'expired';
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

create or replace function public.cleaner_require_assignment(
  p_token_hash text,
  p_task_id uuid
)
returns table (
  status text,
  cleaning_agent_id uuid,
  organization_id uuid,
  display_name text,
  task_status text,
  property_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspect record;
  v_task public.cleaning_tasks%rowtype;
begin
  select * into v_inspect
  from public.inspect_cleaner_link(p_token_hash);

  if not found then
    status := 'invalid';
    return next;
    return;
  end if;

  if v_inspect.status <> 'valid' then
    status := v_inspect.status;
    return next;
    return;
  end if;

  select * into v_task
  from public.cleaning_tasks
  where id = p_task_id
  for update;

  if not found or v_task.organization_id <> v_inspect.organization_id then
    status := 'forbidden';
    return next;
    return;
  end if;

  if not exists (
    select 1
    from public.property_cleaning_agents assignment
    where assignment.property_id = v_task.property_id
      and assignment.cleaning_agent_id = v_inspect.cleaning_agent_id
      and assignment.organization_id = v_inspect.organization_id
      and assignment.active
  ) then
    status := 'forbidden';
    return next;
    return;
  end if;

  status := 'ok';
  cleaning_agent_id := v_inspect.cleaning_agent_id;
  organization_id := v_inspect.organization_id;
  display_name := v_inspect.display_name;
  task_status := v_task.status;
  property_id := v_task.property_id;
  return next;
end;
$$;

revoke all on function public.cleaner_require_assignment(text, uuid)
  from public, anon, authenticated;
grant execute on function public.cleaner_require_assignment(text, uuid) to service_role;

create or replace function public.get_cleaner_home(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inspect record;
  v_org_name text;
  v_active jsonb;
  v_completed jsonb;
begin
  select * into v_inspect from public.inspect_cleaner_link(p_token_hash);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_inspect.status <> 'valid' then
    return jsonb_build_object('status', v_inspect.status);
  end if;

  select name into v_org_name
  from public.organizations
  where id = v_inspect.organization_id;

  select coalesce(jsonb_agg(row_to_json(task_row)::jsonb order by task_row."sortRank", task_row."propertyName"), '[]'::jsonb)
    into v_active
  from (
    select
      property.id as "propertyId",
      property.name as "propertyName",
      property.city,
      property.address,
      task.id as "taskId",
      task.status,
      reservation.checkout_completed_at as "checkedOutAt",
      coalesce(task.created_at, assignment.created_at) as "createdAt",
      case when task.id is null then 1 else 0 end as "sortRank",
      (
        select count(*) from public.cleaning_task_items item
        where item.cleaning_task_id = task.id and item.required and item.completed_at is not null
      ) as "completedCount",
      (
        select count(*) from public.cleaning_task_items item
        where item.cleaning_task_id = task.id and item.required
      ) as "totalCount"
    from public.property_cleaning_agents assignment
    join public.properties property
      on property.id = assignment.property_id
     and property.organization_id = assignment.organization_id
    left join public.cleaning_tasks task
      on task.property_id = property.id
     and task.organization_id = assignment.organization_id
     and task.status in ('queued', 'in_progress')
    left join public.reservations reservation
      on reservation.id = task.reservation_id
    where assignment.cleaning_agent_id = v_inspect.cleaning_agent_id
      and assignment.organization_id = v_inspect.organization_id
      and assignment.active
    order by case when task.id is null then 1 else 0 end, property.name
  ) task_row;

  select coalesce(jsonb_agg(row_to_json(done_row)::jsonb), '[]'::jsonb)
    into v_completed
  from (
    select
      task.id as "taskId",
      property.name as "propertyName",
      task.completed_at as "completedAt"
    from public.cleaning_tasks task
    join public.properties property on property.id = task.property_id
    join public.property_cleaning_agents assignment
      on assignment.property_id = task.property_id
     and assignment.cleaning_agent_id = v_inspect.cleaning_agent_id
     and assignment.active
    where task.organization_id = v_inspect.organization_id
      and task.status = 'completed'
      and task.completed_at >= date_trunc('day', now())
    order by task.completed_at desc
    limit 8
  ) done_row;

  return jsonb_build_object(
    'status', 'valid',
    'cleanerName', v_inspect.display_name,
    'organizationName', v_org_name,
    'active', v_active,
    'completedToday', v_completed
  );
end;
$$;

revoke all on function public.get_cleaner_home(text) from public, anon, authenticated;
grant execute on function public.get_cleaner_home(text) to service_role;

create or replace function public.get_cleaner_task(p_token_hash text, p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_property record;
  v_task record;
  v_items jsonb;
begin
  select * into v_access
  from public.cleaner_require_assignment(p_token_hash, p_task_id);

  if v_access.status <> 'ok' then
    return jsonb_build_object('status', v_access.status);
  end if;

  select
    task.id,
    task.status,
    task.started_at,
    task.completed_at,
    reservation.checkout_completed_at
    into v_task
  from public.cleaning_tasks task
  join public.reservations reservation on reservation.id = task.reservation_id
  where task.id = p_task_id;

  select name, address, city into v_property
  from public.properties
  where id = v_access.property_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', item.item_key,
    'category', item.category,
    'label', item.label,
    'sortOrder', item.sort_order,
    'required', item.required,
    'completedAt', item.completed_at
  ) order by item.sort_order), '[]'::jsonb)
    into v_items
  from public.cleaning_task_items item
  where item.cleaning_task_id = p_task_id;

  return jsonb_build_object(
    'status', 'ok',
    'cleanerName', v_access.display_name,
    'taskId', v_task.id,
    'taskStatus', v_task.status,
    'startedAt', v_task.started_at,
    'completedAt', v_task.completed_at,
    'checkedOutAt', v_task.checkout_completed_at,
    'propertyName', v_property.name,
    'address', v_property.address,
    'city', v_property.city,
    'items', v_items
  );
end;
$$;

revoke all on function public.get_cleaner_task(text, uuid) from public, anon, authenticated;
grant execute on function public.get_cleaner_task(text, uuid) to service_role;

create or replace function public.cleaner_start_task(p_token_hash text, p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_readiness text;
begin
  select * into v_access from public.cleaner_require_assignment(p_token_hash, p_task_id);

  if v_access.status <> 'ok' then
    return jsonb_build_object('status', v_access.status);
  end if;

  if v_access.task_status = 'completed' or v_access.task_status = 'cancelled' then
    return jsonb_build_object('status', 'closed');
  end if;

  update public.cleaning_tasks
    set
      status = 'in_progress',
      started_at = coalesce(started_at, now()),
      started_by_agent_id = coalesce(started_by_agent_id, v_access.cleaning_agent_id)
  where id = p_task_id
    and status in ('queued', 'in_progress');

  v_readiness := public.refresh_property_cleaning_readiness(v_access.property_id);

  insert into public.events (organization_id, property_id, event_type, metadata)
  values (
    v_access.organization_id,
    v_access.property_id,
    'cleaning.started',
    jsonb_build_object('taskId', p_task_id, 'agentId', v_access.cleaning_agent_id)
  );

  insert into public.audit_logs (
    actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    'cleaner', 'cleaning.started', 'cleaning_task', p_task_id, v_access.organization_id,
    jsonb_build_object('agentId', v_access.cleaning_agent_id)
  );

  return jsonb_build_object('status', 'ok', 'readiness', v_readiness);
end;
$$;

revoke all on function public.cleaner_start_task(text, uuid) from public, anon, authenticated;
grant execute on function public.cleaner_start_task(text, uuid) to service_role;

create or replace function public.cleaner_set_task_item(
  p_token_hash text,
  p_task_id uuid,
  p_item_key text,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
begin
  select * into v_access from public.cleaner_require_assignment(p_token_hash, p_task_id);

  if v_access.status <> 'ok' then
    return jsonb_build_object('status', v_access.status);
  end if;

  if v_access.task_status <> 'in_progress' then
    return jsonb_build_object('status', 'not_started');
  end if;

  update public.cleaning_task_items
    set
      completed_at = case when p_completed then coalesce(completed_at, now()) else null end,
      completed_by_agent_id = case when p_completed then v_access.cleaning_agent_id else null end
  where cleaning_task_id = p_task_id
    and item_key = p_item_key
    and organization_id = v_access.organization_id;

  if not found then
    return jsonb_build_object('status', 'invalid_item');
  end if;

  if p_completed then
    insert into public.events (organization_id, property_id, event_type, metadata)
    values (
      v_access.organization_id,
      v_access.property_id,
      'cleaning.item_completed',
      jsonb_build_object('taskId', p_task_id, 'itemKey', p_item_key)
    );
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.cleaner_set_task_item(text, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.cleaner_set_task_item(text, uuid, text, boolean) to service_role;

create or replace function public.cleaner_finish_task(
  p_token_hash text,
  p_task_id uuid,
  p_confirm_cleaning boolean,
  p_confirm_left boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_missing integer;
  v_readiness text;
  v_current_status text;
begin
  select * into v_access from public.cleaner_require_assignment(p_token_hash, p_task_id);

  if v_access.status <> 'ok' then
    return jsonb_build_object('status', v_access.status);
  end if;

  select status into v_current_status
  from public.cleaning_tasks
  where id = p_task_id
  for update;

  if v_current_status = 'completed' then
    return jsonb_build_object('status', 'already_completed');
  end if;

  if v_current_status <> 'in_progress' then
    return jsonb_build_object('status', 'not_started');
  end if;

  if not p_confirm_cleaning or not p_confirm_left then
    return jsonb_build_object('status', 'confirmation_required');
  end if;

  select count(*) into v_missing
  from public.cleaning_task_items
  where cleaning_task_id = p_task_id
    and required
    and completed_at is null;

  if v_missing > 0 then
    return jsonb_build_object('status', 'checklist_incomplete', 'missing', v_missing);
  end if;

  update public.cleaning_tasks
    set
      status = 'completed',
      completed_at = now(),
      completed_by_agent_id = v_access.cleaning_agent_id
  where id = p_task_id
    and status = 'in_progress';

  if not found then
    return jsonb_build_object('status', 'already_completed');
  end if;

  v_readiness := public.refresh_property_cleaning_readiness(v_access.property_id);

  insert into public.events (organization_id, property_id, event_type, metadata)
  values
    (
      v_access.organization_id,
      v_access.property_id,
      'cleaning.completed',
      jsonb_build_object('taskId', p_task_id, 'agentId', v_access.cleaning_agent_id)
    ),
    (
      v_access.organization_id,
      v_access.property_id,
      'property.cleaning_hold_released',
      jsonb_build_object('taskId', p_task_id, 'readiness', v_readiness)
    );

  insert into public.audit_logs (
    actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    'cleaner',
    'cleaning.completed',
    'cleaning_task',
    p_task_id,
    v_access.organization_id,
    jsonb_build_object('agentId', v_access.cleaning_agent_id, 'readiness', v_readiness)
  );

  return jsonb_build_object('status', 'ok', 'readiness', v_readiness);
end;
$$;

revoke all on function public.cleaner_finish_task(text, uuid, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.cleaner_finish_task(text, uuid, boolean, boolean) to service_role;

create or replace function public.cleaner_mark_done(
  p_token_hash text,
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access record;
  v_readiness text;
  v_current_status text;
begin
  select * into v_access from public.cleaner_require_assignment(p_token_hash, p_task_id);

  if v_access.status <> 'ok' then
    return jsonb_build_object('status', v_access.status);
  end if;

  select status into v_current_status
  from public.cleaning_tasks
  where id = p_task_id
  for update;

  if v_current_status = 'completed' then
    return jsonb_build_object('status', 'already_completed');
  end if;

  if v_current_status not in ('queued', 'in_progress') then
    return jsonb_build_object('status', 'closed');
  end if;

  update public.cleaning_tasks
    set
      status = 'completed',
      started_at = coalesce(started_at, now()),
      started_by_agent_id = coalesce(started_by_agent_id, v_access.cleaning_agent_id),
      completed_at = now(),
      completed_by_agent_id = v_access.cleaning_agent_id
  where id = p_task_id
    and status in ('queued', 'in_progress');

  if not found then
    return jsonb_build_object('status', 'already_completed');
  end if;

  v_readiness := public.refresh_property_cleaning_readiness(v_access.property_id);

  insert into public.events (organization_id, property_id, event_type, metadata)
  values
    (
      v_access.organization_id,
      v_access.property_id,
      'cleaning.completed',
      jsonb_build_object('taskId', p_task_id, 'agentId', v_access.cleaning_agent_id, 'source', 'cleaner_done')
    ),
    (
      v_access.organization_id,
      v_access.property_id,
      'property.cleaning_hold_released',
      jsonb_build_object('taskId', p_task_id, 'readiness', v_readiness)
    );

  insert into public.audit_logs (
    actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    'cleaner',
    'cleaning.completed',
    'cleaning_task',
    p_task_id,
    v_access.organization_id,
    jsonb_build_object('agentId', v_access.cleaning_agent_id, 'readiness', v_readiness, 'source', 'cleaner_done')
  );

  return jsonb_build_object('status', 'ok', 'readiness', v_readiness);
end;
$$;

revoke all on function public.cleaner_mark_done(text, uuid) from public, anon, authenticated;
grant execute on function public.cleaner_mark_done(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Client administration. Organization comes from membership, never the browser.
-- ---------------------------------------------------------------------------

create or replace function public.workspace_issue_cleaning_link(
  p_agent_id uuid,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_link_id uuid;
  v_rotated boolean;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid cleaning link'
      using errcode = '22023';
  end if;

  select organization_id into v_org
  from public.cleaning_agents
  where id = p_agent_id
  for update;

  if v_org is null or not public.current_user_has_org_role(v_org, array['owner', 'admin']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  v_rotated := exists (
    select 1 from public.cleaning_agent_links
    where cleaning_agent_id = p_agent_id
      and revoked_at is null
  );

  update public.cleaning_agent_links
    set revoked_at = now()
  where cleaning_agent_id = p_agent_id
    and revoked_at is null;

  insert into public.cleaning_agent_links (
    organization_id,
    cleaning_agent_id,
    token_hash,
    rotated_at
  ) values (
    v_org,
    p_agent_id,
    p_token_hash,
    case when v_rotated then now() else null end
  )
  returning id into v_link_id;

  insert into public.events (organization_id, actor_user_id, event_type, metadata)
  values (
    v_org,
    auth.uid(),
    case when v_rotated then 'cleaning.link_rotated' else 'cleaning.link_generated' end,
    jsonb_build_object('agentId', p_agent_id)
  );

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    auth.uid(),
    'organization_user',
    case when v_rotated then 'cleaning.link_rotated' else 'cleaning.link_generated' end,
    'cleaning_agent',
    p_agent_id,
    v_org,
    '{}'::jsonb
  );

  return v_link_id;
end;
$$;

revoke all on function public.workspace_issue_cleaning_link(uuid, text) from public, anon;
grant execute on function public.workspace_issue_cleaning_link(uuid, text) to authenticated;

create or replace function public.workspace_set_cleaning_agent_active(
  p_agent_id uuid,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org
  from public.cleaning_agents
  where id = p_agent_id
  for update;

  if v_org is null or not public.current_user_has_org_role(v_org, array['owner', 'admin']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  update public.cleaning_agents
    set active = p_active
  where id = p_agent_id;

  if not p_active then
    update public.property_cleaning_agents
      set active = false
    where cleaning_agent_id = p_agent_id;

    update public.cleaning_agent_links
      set revoked_at = coalesce(revoked_at, now())
    where cleaning_agent_id = p_agent_id
      and revoked_at is null;
  end if;

  insert into public.events (organization_id, actor_user_id, event_type, metadata)
  values (
    v_org,
    auth.uid(),
    case when p_active then 'cleaning.agent_enabled' else 'cleaning.agent_disabled' end,
    jsonb_build_object('agentId', p_agent_id)
  );

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    auth.uid(),
    'organization_user',
    case when p_active then 'cleaning.agent_enabled' else 'cleaning.agent_disabled' end,
    'cleaning_agent',
    p_agent_id,
    v_org,
    '{}'::jsonb
  );

  return p_agent_id;
end;
$$;

revoke all on function public.workspace_set_cleaning_agent_active(uuid, boolean) from public, anon;
grant execute on function public.workspace_set_cleaning_agent_active(uuid, boolean) to authenticated;

create or replace function public.workspace_reopen_cleaning_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.cleaning_tasks%rowtype;
  v_readiness text;
begin
  select * into v_task
  from public.cleaning_tasks
  where id = p_task_id
  for update;

  if v_task.id is null or not public.current_user_has_org_role(v_task.organization_id, array['owner', 'admin']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if v_task.status <> 'completed' then
    raise exception 'only a completed cleaning task can be reopened'
      using errcode = '22023';
  end if;

  update public.cleaning_tasks
    set
      status = 'queued',
      reopened_at = now(),
      started_at = null,
      completed_at = null
  where id = p_task_id;

  v_readiness := public.refresh_property_cleaning_readiness(v_task.property_id);

  insert into public.events (organization_id, property_id, actor_user_id, event_type, metadata)
  values (
    v_task.organization_id,
    v_task.property_id,
    auth.uid(),
    'cleaning.reopened',
    jsonb_build_object(
      'taskId', p_task_id,
      'previousCompletedAt', v_task.completed_at,
      'previousCompletedBy', v_task.completed_by_agent_id
    )
  );

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    auth.uid(),
    'organization_user',
    'cleaning.reopened',
    'cleaning_task',
    p_task_id,
    v_task.organization_id,
    jsonb_build_object('previousCompletedAt', v_task.completed_at, 'readiness', v_readiness)
  );

  return p_task_id;
end;
$$;

revoke all on function public.workspace_reopen_cleaning_task(uuid) from public, anon;
grant execute on function public.workspace_reopen_cleaning_task(uuid) to authenticated;

create or replace function public.workspace_cancel_cleaning_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.cleaning_tasks%rowtype;
  v_readiness text;
begin
  select * into v_task
  from public.cleaning_tasks
  where id = p_task_id
  for update;

  if v_task.id is null or not public.current_user_has_org_role(v_task.organization_id, array['owner', 'admin']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if v_task.status in ('completed', 'cancelled') then
    raise exception 'this cleaning task cannot be cancelled'
      using errcode = '22023';
  end if;

  update public.cleaning_tasks
    set status = 'cancelled', cancelled_at = now()
  where id = p_task_id;

  v_readiness := public.refresh_property_cleaning_readiness(v_task.property_id);

  insert into public.events (organization_id, property_id, actor_user_id, event_type, metadata)
  values (
    v_task.organization_id,
    v_task.property_id,
    auth.uid(),
    'cleaning.cancelled',
    jsonb_build_object('taskId', p_task_id, 'readiness', v_readiness)
  );

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    auth.uid(),
    'organization_user',
    'cleaning.cancelled',
    'cleaning_task',
    p_task_id,
    v_task.organization_id,
    jsonb_build_object('readiness', v_readiness)
  );

  return p_task_id;
end;
$$;

revoke all on function public.workspace_cancel_cleaning_task(uuid) from public, anon;
grant execute on function public.workspace_cancel_cleaning_task(uuid) to authenticated;
