-- Phase 8C: manual cleaning tasks and a single assignee per task.
-- Property defaults stay on property_cleaning_agents and are not rewritten onto open tasks.

alter table public.cleaning_tasks
  alter column reservation_id drop not null;

alter table public.cleaning_tasks
  drop constraint cleaning_tasks_trigger_check;

alter table public.cleaning_tasks
  add constraint cleaning_tasks_trigger_check
    check (trigger_type in ('guest_checkout', 'manual'));

alter table public.cleaning_tasks
  add column assigned_agent_id uuid,
  add column request_key uuid;

alter table public.cleaning_tasks
  add constraint cleaning_tasks_assigned_agent_id_fkey
    foreign key (assigned_agent_id) references public.cleaning_agents (id) on delete restrict;

create unique index cleaning_tasks_request_key_idx
  on public.cleaning_tasks (organization_id, request_key)
  where request_key is not null;

create index cleaning_tasks_assigned_agent_idx
  on public.cleaning_tasks (assigned_agent_id, status)
  where assigned_agent_id is not null;

-- ---------------------------------------------------------------------------
-- Consistency. A manual task has no reservation. Guest checkout still requires one.
-- An assignee may stay after they are disabled. A new assignee must be active.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_cleaning_task_organization()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_assignee_changed boolean;
begin
  if tg_op = 'UPDATE' and new.property_id is distinct from old.property_id then
    raise exception 'cleaning task property cannot be changed'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.properties property
    where property.id = new.property_id
      and property.organization_id = new.organization_id
  ) then
    raise exception 'cleaning task organization mismatch'
      using errcode = '23514';
  end if;

  if new.trigger_type = 'guest_checkout' and new.reservation_id is null then
    raise exception 'guest checkout cleaning requires a reservation'
      using errcode = '23514';
  end if;

  if new.trigger_type = 'manual' and new.reservation_id is not null then
    raise exception 'manual cleaning cannot be tied to a reservation'
      using errcode = '23514';
  end if;

  if new.reservation_id is not null and not exists (
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

  if tg_op = 'INSERT' then
    v_assignee_changed := true;
  else
    v_assignee_changed := new.assigned_agent_id is distinct from old.assigned_agent_id;
  end if;

  if new.assigned_agent_id is not null and v_assignee_changed then
    if not exists (
      select 1
      from public.cleaning_agents agent
      where agent.id = new.assigned_agent_id
        and agent.organization_id = new.organization_id
        and agent.active
    ) then
      raise exception 'cleaner unavailable'
        using errcode = '23514';
    end if;
  elsif new.assigned_agent_id is not null then
    if not exists (
      select 1
      from public.cleaning_agents agent
      where agent.id = new.assigned_agent_id
        and agent.organization_id = new.organization_id
    ) then
      raise exception 'cleaning assignment organization mismatch'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

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

  if new.active and not exists (
    select 1
    from public.cleaning_agents agent
    where agent.id = new.cleaning_agent_id
      and agent.organization_id = new.organization_id
      and agent.active
  ) then
    raise exception 'cleaner unavailable'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Earliest active default. Used when guest checkout opens a task.
create or replace function public.default_cleaning_agent(p_property_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select assignment.cleaning_agent_id
  from public.property_cleaning_agents assignment
  join public.cleaning_agents agent on agent.id = assignment.cleaning_agent_id
  where assignment.property_id = p_property_id
    and assignment.active
    and agent.active
  order by assignment.created_at asc, assignment.id asc
  limit 1;
$$;

revoke all on function public.default_cleaning_agent(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest checkout. Same reservation update and one-task insert.
-- The property's earliest active cleaner is the task assignee when one exists.
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
  v_agent_id uuid;
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

  v_agent_id := public.default_cleaning_agent(v_inspect.property_id);

  insert into public.cleaning_tasks (
    organization_id,
    property_id,
    reservation_id,
    status,
    trigger_type,
    assigned_agent_id
  ) values (
    v_inspect.organization_id,
    v_inspect.property_id,
    v_inspect.reservation_id,
    'queued',
    'guest_checkout',
    v_agent_id
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
      jsonb_build_object('trigger', 'guest_checkout', 'taskId', v_task_id, 'agentId', v_agent_id)
    );

    insert into public.audit_logs (
      actor_type, action, target_type, target_id, organization_id, metadata
    ) values (
      'guest',
      'cleaning.task_created',
      'cleaning_task',
      v_task_id,
      v_inspect.organization_id,
      jsonb_build_object('trigger', 'guest_checkout', 'agentId', v_agent_id)
    );

    if v_agent_id is not null then
      insert into public.events (organization_id, reservation_id, property_id, event_type, metadata)
      values (
        v_inspect.organization_id,
        v_inspect.reservation_id,
        v_inspect.property_id,
        'cleaning.task_assigned',
        jsonb_build_object('taskId', v_task_id, 'agentId', v_agent_id, 'trigger', 'guest_checkout')
      );

      insert into public.audit_logs (
        actor_type, action, target_type, target_id, organization_id, metadata
      ) values (
        'guest',
        'cleaning.task_assigned',
        'cleaning_task',
        v_task_id,
        v_inspect.organization_id,
        jsonb_build_object('agentId', v_agent_id)
      );
    end if;
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

-- A cleaner may work a task only when they are its assignee.
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

  if v_task.assigned_agent_id is distinct from v_inspect.cleaning_agent_id then
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
      task.created_at as "createdAt",
      0 as "sortRank",
      (
        select count(*) from public.cleaning_task_items item
        where item.cleaning_task_id = task.id and item.required and item.completed_at is not null
      ) as "completedCount",
      (
        select count(*) from public.cleaning_task_items item
        where item.cleaning_task_id = task.id and item.required
      ) as "totalCount"
    from public.cleaning_tasks task
    join public.properties property
      on property.id = task.property_id
     and property.organization_id = task.organization_id
    left join public.reservations reservation
      on reservation.id = task.reservation_id
    where task.assigned_agent_id = v_inspect.cleaning_agent_id
      and task.organization_id = v_inspect.organization_id
      and task.status in ('queued', 'in_progress')

    union all

    select
      property.id as "propertyId",
      property.name as "propertyName",
      property.city,
      property.address,
      null::uuid as "taskId",
      null::text as status,
      null::timestamptz as "checkedOutAt",
      assignment.created_at as "createdAt",
      1 as "sortRank",
      0::bigint as "completedCount",
      0::bigint as "totalCount"
    from public.property_cleaning_agents assignment
    join public.properties property
      on property.id = assignment.property_id
     and property.organization_id = assignment.organization_id
    where assignment.cleaning_agent_id = v_inspect.cleaning_agent_id
      and assignment.organization_id = v_inspect.organization_id
      and assignment.active
      and not exists (
        select 1
        from public.cleaning_tasks open_task
        where open_task.property_id = property.id
          and open_task.assigned_agent_id = v_inspect.cleaning_agent_id
          and open_task.status in ('queued', 'in_progress')
      )
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
    where task.organization_id = v_inspect.organization_id
      and task.status = 'completed'
      and task.completed_at >= date_trunc('day', now())
      and (
        task.assigned_agent_id = v_inspect.cleaning_agent_id
        or task.completed_by_agent_id = v_inspect.cleaning_agent_id
      )
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
  left join public.reservations reservation on reservation.id = task.reservation_id
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

-- ---------------------------------------------------------------------------
-- Workspace mutations. Organization comes from the property or task row.
-- ---------------------------------------------------------------------------

create or replace function public.workspace_create_manual_cleaning(
  p_property_id uuid,
  p_assignee uuid,
  p_request_key uuid,
  p_confirm_extra boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_existing uuid;
  v_active uuid;
  v_task_id uuid;
  v_readiness text;
begin
  if p_request_key is null then
    raise exception 'invalid cleaning request'
      using errcode = '22023';
  end if;

  select organization_id into v_org
  from public.properties
  where id = p_property_id
    and status <> 'archived'
  for update;

  if v_org is null or not public.current_user_has_org_role(v_org, array['owner', 'admin', 'manager']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_assignee is not null and not exists (
    select 1
    from public.cleaning_agents agent
    where agent.id = p_assignee
      and agent.organization_id = v_org
      and agent.active
  ) then
    raise exception 'cleaner unavailable'
      using errcode = '23514';
  end if;

  select id into v_existing
  from public.cleaning_tasks
  where organization_id = v_org
    and request_key = p_request_key;

  if v_existing is not null then
    return jsonb_build_object('status', 'exists', 'taskId', v_existing);
  end if;

  select id into v_active
  from public.cleaning_tasks
  where property_id = p_property_id
    and organization_id = v_org
    and status in ('queued', 'in_progress')
  order by created_at asc
  limit 1;

  if v_active is not null and not coalesce(p_confirm_extra, false) then
    return jsonb_build_object('status', 'conflict', 'taskId', v_active);
  end if;

  insert into public.cleaning_tasks (
    organization_id,
    property_id,
    reservation_id,
    status,
    trigger_type,
    assigned_agent_id,
    request_key
  ) values (
    v_org,
    p_property_id,
    null,
    'queued',
    'manual',
    p_assignee,
    p_request_key
  )
  returning id into v_task_id;

  perform public.snapshot_cleaning_checklist(v_org, v_task_id);
  v_readiness := public.refresh_property_cleaning_readiness(p_property_id);

  insert into public.events (organization_id, property_id, actor_user_id, event_type, metadata)
  values (
    v_org,
    p_property_id,
    auth.uid(),
    'cleaning.task_created',
    jsonb_build_object('trigger', 'manual', 'taskId', v_task_id, 'agentId', p_assignee)
  );

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    auth.uid(),
    'organization_user',
    'cleaning.task_created',
    'cleaning_task',
    v_task_id,
    v_org,
    jsonb_build_object('trigger', 'manual', 'agentId', p_assignee)
  );

  if p_assignee is not null then
    insert into public.events (organization_id, property_id, actor_user_id, event_type, metadata)
    values (
      v_org,
      p_property_id,
      auth.uid(),
      'cleaning.task_assigned',
      jsonb_build_object('taskId', v_task_id, 'agentId', p_assignee)
    );

    insert into public.audit_logs (
      actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
    ) values (
      auth.uid(),
      'organization_user',
      'cleaning.task_assigned',
      'cleaning_task',
      v_task_id,
      v_org,
      jsonb_build_object('agentId', p_assignee)
    );
  end if;

  return jsonb_build_object('status', 'created', 'taskId', v_task_id, 'readiness', v_readiness);
end;
$$;

revoke all on function public.workspace_create_manual_cleaning(uuid, uuid, uuid, boolean)
  from public, anon;
grant execute on function public.workspace_create_manual_cleaning(uuid, uuid, uuid, boolean)
  to authenticated;

create or replace function public.workspace_assign_cleaning_task(
  p_task_id uuid,
  p_assignee uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.cleaning_tasks%rowtype;
  v_change text;
begin
  select * into v_task
  from public.cleaning_tasks
  where id = p_task_id
  for update;

  if v_task.id is null or not public.current_user_has_org_role(
    v_task.organization_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if v_task.status not in ('queued', 'in_progress') then
    raise exception 'only an open cleaning task can be reassigned'
      using errcode = '22023';
  end if;

  if p_assignee is not null and not exists (
    select 1
    from public.cleaning_agents agent
    where agent.id = p_assignee
      and agent.organization_id = v_task.organization_id
      and agent.active
  ) then
    raise exception 'cleaner unavailable'
      using errcode = '23514';
  end if;

  if v_task.assigned_agent_id is not distinct from p_assignee then
    return jsonb_build_object('status', 'unchanged', 'taskId', p_task_id);
  end if;

  if v_task.assigned_agent_id is null then
    v_change := 'assigned';
  elsif p_assignee is null then
    v_change := 'unassigned';
  else
    v_change := 'reassigned';
  end if;

  update public.cleaning_tasks
    set assigned_agent_id = p_assignee
  where id = p_task_id;

  insert into public.events (organization_id, property_id, actor_user_id, event_type, metadata)
  values (
    v_task.organization_id,
    v_task.property_id,
    auth.uid(),
    'cleaning.task_' || v_change,
    jsonb_build_object(
      'taskId', p_task_id,
      'previousAgentId', v_task.assigned_agent_id,
      'agentId', p_assignee
    )
  );

  insert into public.audit_logs (
    actor_user_id, actor_type, action, target_type, target_id, organization_id, metadata
  ) values (
    auth.uid(),
    'organization_user',
    'cleaning.task_' || v_change,
    'cleaning_task',
    p_task_id,
    v_task.organization_id,
    jsonb_build_object('previousAgentId', v_task.assigned_agent_id, 'agentId', p_assignee)
  );

  return jsonb_build_object('status', v_change, 'taskId', p_task_id);
end;
$$;

revoke all on function public.workspace_assign_cleaning_task(uuid, uuid) from public, anon;
grant execute on function public.workspace_assign_cleaning_task(uuid, uuid) to authenticated;
