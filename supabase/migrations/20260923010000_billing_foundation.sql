-- Phase 6A: provider-neutral billing foundation.
-- organization_subscriptions remains the canonical commercial record.
-- No payment processor, invoices, or provider customer IDs.

-- ---------------------------------------------------------------------------
-- Subscription lifecycle
-- Conceptual states: pending, active, past_due, grace_period, suspended,
-- cancelled. Existing trialing/paused values are kept so current rows stay
-- valid. paused is treated as a legacy suspended-equivalent.
-- active is NEVER implied by signup, plan selection, or organization create.
-- ---------------------------------------------------------------------------

alter table public.organization_subscriptions
  drop constraint organization_subscriptions_status_check;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_status_check
    check (status in (
      'pending',
      'trialing',
      'active',
      'past_due',
      'grace_period',
      'suspended',
      'cancelled',
      'paused'
    ));

alter table public.organization_subscriptions
  add column if not exists requested_plan text;

alter table public.organization_subscriptions
  add column if not exists cancellation_requested_at timestamptz;

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_requested_plan_check;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_requested_plan_check
    check (
      requested_plan is null
      or requested_plan in ('free', 'starter', 'professional', 'enterprise')
    );

create trigger organization_subscriptions_prevent_reparent
  before update on public.organization_subscriptions
  for each row execute function public.prevent_tenant_reparent();

-- ---------------------------------------------------------------------------
-- organization_subscription_events
-- Auditable history + future webhook idempotency (provider_event_id).
-- Writes are security-definer only. Members may read their own org.
-- ---------------------------------------------------------------------------

create table public.organization_subscription_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  subscription_id uuid not null references public.organization_subscriptions (id) on delete restrict,
  event_type text not null,
  previous_status text,
  new_status text,
  previous_plan text,
  new_plan text,
  source text not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint organization_subscription_events_type_check
    check (event_type in (
      'subscription.created',
      'subscription.plan_selected',
      'subscription.plan_change_requested',
      'subscription.status_changed',
      'subscription.suspended',
      'subscription.reactivated',
      'subscription.cancelled',
      'subscription.cancellation_requested',
      'subscription.cancellation_completed',
      'subscription.admin_updated'
    )),
  constraint organization_subscription_events_source_check
    check (source in ('system', 'admin', 'customer', 'provider')),
  constraint organization_subscription_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index organization_subscription_events_org_created_idx
  on public.organization_subscription_events (organization_id, created_at desc);

create index organization_subscription_events_subscription_idx
  on public.organization_subscription_events (subscription_id, created_at desc);

create unique index organization_subscription_events_provider_event_uidx
  on public.organization_subscription_events (provider_event_id)
  where provider_event_id is not null;

revoke all on table public.organization_subscription_events from anon, public, authenticated;
grant select on table public.organization_subscription_events to authenticated;

alter table public.organization_subscription_events enable row level security;
alter table public.organization_subscription_events force row level security;

create trigger organization_subscription_events_prevent_reparent
  before update on public.organization_subscription_events
  for each row execute function public.prevent_tenant_reparent();

create or replace function public.enforce_subscription_event_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.organization_subscriptions s
    where s.id = new.subscription_id
      and s.organization_id = new.organization_id
  ) then
    raise exception 'subscription event organization mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_subscription_event_organization() from public;

create trigger organization_subscription_events_organization_consistency
  before insert or update on public.organization_subscription_events
  for each row execute function public.enforce_subscription_event_organization();

create policy organization_subscription_events_select_member
  on public.organization_subscription_events
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy organization_subscription_events_select_platform_admin
  on public.organization_subscription_events
  for select
  to authenticated
  using (public.is_active_platform_admin());

create policy organization_subscription_events_select_support
  on public.organization_subscription_events
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

-- ---------------------------------------------------------------------------
-- History writer (security definer). Idempotent on provider_event_id.
-- ---------------------------------------------------------------------------

create or replace function public.record_organization_subscription_event(
  p_organization_id uuid,
  p_subscription_id uuid,
  p_event_type text,
  p_previous_status text,
  p_new_status text,
  p_previous_plan text,
  p_new_plan text,
  p_source text,
  p_actor_user_id uuid,
  p_metadata jsonb default '{}'::jsonb,
  p_provider_event_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
begin
  if p_provider_event_id is not null then
    select id into event_id
    from public.organization_subscription_events
    where provider_event_id = p_provider_event_id;

    if event_id is not null then
      return event_id;
    end if;
  end if;

  insert into public.organization_subscription_events (
    organization_id,
    subscription_id,
    event_type,
    previous_status,
    new_status,
    previous_plan,
    new_plan,
    source,
    actor_user_id,
    provider_event_id,
    metadata
  ) values (
    p_organization_id,
    p_subscription_id,
    p_event_type,
    p_previous_status,
    p_new_status,
    p_previous_plan,
    p_new_plan,
    p_source,
    p_actor_user_id,
    p_provider_event_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into event_id;

  insert into public.events (
    organization_id,
    actor_user_id,
    event_type,
    metadata
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_event_type,
    jsonb_build_object(
      'subscriptionId', p_subscription_id,
      'source', p_source,
      'previousStatus', p_previous_status,
      'newStatus', p_new_status,
      'previousPlan', p_previous_plan,
      'newPlan', p_new_plan
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  return event_id;
end;
$$;

revoke all on function public.record_organization_subscription_event(
  uuid, uuid, text, text, text, text, text, text, uuid, jsonb, text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin mutation: keep the existing signature. Manual activation is not
-- payment confirmation. Writes history with source = admin.
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_organization_subscription(
  p_organization_id uuid,
  p_plan text,
  p_status text,
  p_billing_interval text,
  p_started_at timestamptz,
  p_renews_at timestamptz,
  p_cancelled_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  previous_plan text;
  previous_status text;
  previous_interval text;
  previous_started timestamptz;
  previous_renews timestamptz;
  previous_cancelled timestamptz;
  previous_requested_plan text;
  previous_cancellation_requested timestamptz;
  subscription_id uuid;
  started_at_value timestamptz;
  next_requested_plan text;
  next_cancellation_requested timestamptz;
  history_type text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_plan not in ('free', 'starter', 'professional', 'enterprise') then
    raise exception 'invalid subscription plan'
      using errcode = '22023';
  end if;

  if p_status not in (
    'pending',
    'trialing',
    'active',
    'past_due',
    'grace_period',
    'suspended',
    'cancelled',
    'paused'
  ) then
    raise exception 'invalid subscription status'
      using errcode = '22023';
  end if;

  if p_billing_interval not in ('month', 'year') then
    raise exception 'invalid billing interval'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found'
      using errcode = 'P0002';
  end if;

  started_at_value := coalesce(p_started_at, now());

  if p_cancelled_at is not null and p_cancelled_at < started_at_value then
    raise exception 'cancellation cannot precede the start date'
      using errcode = '22023';
  end if;

  select
    id,
    plan,
    status,
    billing_interval,
    started_at,
    renews_at,
    cancelled_at,
    requested_plan,
    cancellation_requested_at
    into
      existing_id,
      previous_plan,
      previous_status,
      previous_interval,
      previous_started,
      previous_renews,
      previous_cancelled,
      previous_requested_plan,
      previous_cancellation_requested
  from public.organization_subscriptions
  where organization_id = p_organization_id
  for update;

  next_requested_plan := previous_requested_plan;
  next_cancellation_requested := previous_cancellation_requested;

  if next_requested_plan is not distinct from p_plan then
    next_requested_plan := null;
  end if;

  if p_status = 'cancelled' then
    next_cancellation_requested := coalesce(next_cancellation_requested, now());
  elsif p_status in ('pending', 'trialing', 'active') then
    next_cancellation_requested := null;
  end if;

  if existing_id is null then
    insert into public.organization_subscriptions (
      organization_id,
      plan,
      status,
      billing_interval,
      started_at,
      renews_at,
      cancelled_at,
      requested_plan,
      cancellation_requested_at
    ) values (
      p_organization_id,
      p_plan,
      p_status,
      p_billing_interval,
      started_at_value,
      p_renews_at,
      p_cancelled_at,
      next_requested_plan,
      next_cancellation_requested
    )
    returning id into subscription_id;

    perform public.record_organization_subscription_event(
      p_organization_id,
      subscription_id,
      'subscription.created',
      null,
      p_status,
      null,
      p_plan,
      'admin',
      auth.uid(),
      jsonb_build_object(
        'activationKind', 'manual_admin',
        'paymentConfirmed', false
      ),
      null
    );
  else
    update public.organization_subscriptions
      set
        plan = p_plan,
        status = p_status,
        billing_interval = p_billing_interval,
        started_at = started_at_value,
        renews_at = p_renews_at,
        cancelled_at = p_cancelled_at,
        requested_plan = next_requested_plan,
        cancellation_requested_at = next_cancellation_requested
    where id = existing_id;

    subscription_id := existing_id;

    history_type := 'subscription.admin_updated';
    if previous_status is distinct from p_status then
      if p_status = 'suspended' then
        history_type := 'subscription.suspended';
      elsif p_status = 'cancelled' then
        history_type := 'subscription.cancelled';
      elsif previous_status in ('cancelled', 'suspended', 'paused')
        and p_status in ('pending', 'trialing', 'active') then
        history_type := 'subscription.reactivated';
      else
        history_type := 'subscription.status_changed';
      end if;
    elsif previous_plan is distinct from p_plan then
      history_type := 'subscription.plan_selected';
    end if;

    perform public.record_organization_subscription_event(
      p_organization_id,
      subscription_id,
      history_type,
      previous_status,
      p_status,
      previous_plan,
      p_plan,
      'admin',
      auth.uid(),
      jsonb_build_object(
        'activationKind', 'manual_admin',
        'paymentConfirmed', false,
        'billingInterval', p_billing_interval
      ),
      null
    );
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
    'organization.subscription_updated',
    'organization_subscription',
    subscription_id,
    p_organization_id,
    jsonb_build_object(
      'plan', p_plan,
      'status', p_status,
      'billingInterval', p_billing_interval,
      'activationKind', 'manual_admin',
      'paymentConfirmed', false,
      'previous', jsonb_build_object(
        'plan', previous_plan,
        'status', previous_status,
        'billingInterval', previous_interval,
        'startedAt', previous_started,
        'renewsAt', previous_renews,
        'cancelledAt', previous_cancelled
      )
    )
  );

  return subscription_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer mutations: request vs activate. Never set active.
-- Organization is derived from membership. Plan IDs only — no prices.
-- ---------------------------------------------------------------------------

create or replace function public.customer_current_billing_organization_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select count(*) into org_count
  from public.organization_users
  where user_id = auth.uid()
    and status = 'active';

  if org_count = 0 then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if org_count > 1 then
    raise exception 'multiple organization memberships are not selected automatically'
      using errcode = 'P0001';
  end if;

  select organization_id into org_id
  from public.organization_users
  where user_id = auth.uid()
    and status = 'active';

  return org_id;
end;
$$;

revoke all on function public.customer_current_billing_organization_id() from public, anon;
grant execute on function public.customer_current_billing_organization_id() to authenticated;

create or replace function public.customer_request_subscription_plan_change(p_plan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  existing_id uuid;
  previous_plan text;
  previous_status text;
  previous_requested text;
  event_type text;
begin
  org_id := public.customer_current_billing_organization_id();

  if not public.current_user_has_org_role(org_id, array['owner', 'admin']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_plan not in ('starter', 'professional', 'enterprise') then
    raise exception 'invalid subscription plan'
      using errcode = '22023';
  end if;

  select id, plan, status, requested_plan
    into existing_id, previous_plan, previous_status, previous_requested
  from public.organization_subscriptions
  where organization_id = org_id
  for update;

  if existing_id is null then
    insert into public.organization_subscriptions (
      organization_id,
      plan,
      status,
      billing_interval
    ) values (
      org_id,
      p_plan,
      'pending',
      'month'
    )
    returning id into existing_id;

    perform public.record_organization_subscription_event(
      org_id,
      existing_id,
      'subscription.created',
      null,
      'pending',
      null,
      p_plan,
      'customer',
      auth.uid(),
      jsonb_build_object('paymentConfirmed', false),
      null
    );

    return existing_id;
  end if;

  if previous_status = 'pending' then
    update public.organization_subscriptions
      set plan = p_plan,
          requested_plan = null
    where id = existing_id;

    event_type := 'subscription.plan_selected';
  else
    if previous_status = 'cancelled' then
      raise exception 'cancelled subscriptions cannot request a plan change'
        using errcode = '22023';
    end if;

    update public.organization_subscriptions
      set requested_plan = p_plan
    where id = existing_id;

    event_type := 'subscription.plan_change_requested';
  end if;

  if previous_status = 'pending' and previous_plan is not distinct from p_plan then
    return existing_id;
  end if;

  if previous_status <> 'pending' and previous_requested is not distinct from p_plan then
    return existing_id;
  end if;

  perform public.record_organization_subscription_event(
    org_id,
    existing_id,
    event_type,
    previous_status,
    previous_status,
    previous_plan,
    p_plan,
    'customer',
    auth.uid(),
    jsonb_build_object(
      'requestedOnly', previous_status <> 'pending',
      'paymentConfirmed', false
    ),
    null
  );

  return existing_id;
end;
$$;

revoke all on function public.customer_request_subscription_plan_change(text)
  from public, anon;
grant execute on function public.customer_request_subscription_plan_change(text)
  to authenticated;

create or replace function public.customer_request_subscription_cancellation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  existing_id uuid;
  previous_plan text;
  previous_status text;
  already_requested timestamptz;
begin
  org_id := public.customer_current_billing_organization_id();

  if not public.current_user_has_org_role(org_id, array['owner', 'admin']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select id, plan, status, cancellation_requested_at
    into existing_id, previous_plan, previous_status, already_requested
  from public.organization_subscriptions
  where organization_id = org_id
  for update;

  if existing_id is null then
    raise exception 'subscription not found'
      using errcode = 'P0002';
  end if;

  if previous_status = 'cancelled' then
    raise exception 'subscription is already cancelled'
      using errcode = '22023';
  end if;

  if already_requested is not null then
    return existing_id;
  end if;

  update public.organization_subscriptions
    set cancellation_requested_at = now()
  where id = existing_id;

  perform public.record_organization_subscription_event(
    org_id,
    existing_id,
    'subscription.cancellation_requested',
    previous_status,
    previous_status,
    previous_plan,
    previous_plan,
    'customer',
    auth.uid(),
    jsonb_build_object('paymentConfirmed', false),
    null
  );

  return existing_id;
end;
$$;

revoke all on function public.customer_request_subscription_cancellation()
  from public, anon;
grant execute on function public.customer_request_subscription_cancellation()
  to authenticated;

create or replace function public.customer_reactivate_subscription()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  existing_id uuid;
  previous_plan text;
  previous_status text;
  already_requested timestamptz;
begin
  org_id := public.customer_current_billing_organization_id();

  if not public.current_user_has_org_role(org_id, array['owner', 'admin']) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select id, plan, status, cancellation_requested_at
    into existing_id, previous_plan, previous_status, already_requested
  from public.organization_subscriptions
  where organization_id = org_id
  for update;

  if existing_id is null then
    raise exception 'subscription not found'
      using errcode = 'P0002';
  end if;

  if previous_status = 'cancelled' then
    raise exception 'cancelled subscriptions cannot be reactivated by the customer'
      using errcode = '22023';
  end if;

  if already_requested is null then
    return existing_id;
  end if;

  update public.organization_subscriptions
    set cancellation_requested_at = null
  where id = existing_id;

  perform public.record_organization_subscription_event(
    org_id,
    existing_id,
    'subscription.reactivated',
    previous_status,
    previous_status,
    previous_plan,
    previous_plan,
    'customer',
    auth.uid(),
    jsonb_build_object(
      'kind', 'cancellation_withdrawn',
      'paymentConfirmed', false
    ),
    null
  );

  return existing_id;
end;
$$;

revoke all on function public.customer_reactivate_subscription()
  from public, anon;
grant execute on function public.customer_reactivate_subscription()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Commercial onboarding: keep pending. Write history with source = system.
-- ---------------------------------------------------------------------------

create or replace function public.complete_commercial_onboarding(
  p_organization_name text,
  p_plan text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_base_slug text;
  v_slug text;
  v_attempt integer := 1;
  v_organization_id uuid;
  v_subscription_status text;
  v_subscription_id uuid;
  v_previous_plan text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return jsonb_build_object('status', 'unauthenticated');
  end if;

  if exists (
    select 1 from public.platform_admins where user_id = v_user_id
  ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_organization_name is null or length(btrim(p_organization_name)) < 2
     or length(btrim(p_organization_name)) > 120 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_plan not in ('starter', 'professional', 'enterprise') then
    return jsonb_build_object('status', 'invalid_plan');
  end if;

  if p_phone is not null and length(p_phone) > 40 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select ou.organization_id into v_organization_id
  from public.organization_users ou
  where ou.user_id = v_user_id
  limit 1;

  if v_organization_id is not null then
    select s.id, s.status, s.plan
      into v_subscription_id, v_subscription_status, v_previous_plan
    from public.organization_subscriptions s
    where s.organization_id = v_organization_id
    for update;

    if v_subscription_status is null then
      insert into public.organization_subscriptions (
        organization_id, plan, status, billing_interval
      ) values (
        v_organization_id, p_plan, 'pending', 'month'
      )
      returning id into v_subscription_id;

      perform public.record_organization_subscription_event(
        v_organization_id,
        v_subscription_id,
        'subscription.created',
        null,
        'pending',
        null,
        p_plan,
        'system',
        v_user_id,
        jsonb_build_object('source', 'commercial_signup', 'paymentConfirmed', false),
        null
      );
    elsif v_subscription_status = 'pending' then
      update public.organization_subscriptions
        set plan = p_plan
      where organization_id = v_organization_id
        and status = 'pending';

      if v_previous_plan is distinct from p_plan then
        perform public.record_organization_subscription_event(
          v_organization_id,
          v_subscription_id,
          'subscription.plan_selected',
          'pending',
          'pending',
          v_previous_plan,
          p_plan,
          'system',
          v_user_id,
          jsonb_build_object('source', 'commercial_signup', 'paymentConfirmed', false),
          null
        );
      end if;
    end if;

    return jsonb_build_object(
      'status', 'ok',
      'organizationId', v_organization_id,
      'subscriptionStatus', coalesce(v_subscription_status, 'pending'),
      'existing', true
    );
  end if;

  select email into v_email from public.profiles where id = v_user_id;
  v_base_slug := lower(regexp_replace(btrim(p_organization_name), '[^a-z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug is null or v_base_slug = '' then
    v_base_slug := 'operator';
  end if;
  v_base_slug := left(v_base_slug, 55);
  v_slug := v_base_slug;

  while public.is_reserved_organization_slug(v_slug)
     or exists (select 1 from public.organizations where slug = v_slug)
  loop
    v_attempt := v_attempt + 1;
    v_slug := left(v_base_slug, 50) || '-' || v_attempt::text;
    if v_attempt > 30 then
      return jsonb_build_object('status', 'slug_unavailable');
    end if;
  end loop;

  insert into public.organizations (
    name,
    slug,
    status,
    subscription_status,
    onboarding_status,
    phone
  ) values (
    btrim(p_organization_name),
    v_slug,
    'active',
    'none',
    'in_progress',
    nullif(btrim(p_phone), '')
  )
  returning id into v_organization_id;

  insert into public.organization_users (
    organization_id,
    user_id,
    role,
    status
  ) values (
    v_organization_id,
    v_user_id,
    'owner',
    'active'
  );

  insert into public.organization_subscriptions (
    organization_id,
    plan,
    status,
    billing_interval
  ) values (
    v_organization_id,
    p_plan,
    'pending',
    'month'
  )
  returning id into v_subscription_id;

  perform public.record_organization_subscription_event(
    v_organization_id,
    v_subscription_id,
    'subscription.created',
    null,
    'pending',
    null,
    p_plan,
    'system',
    v_user_id,
    jsonb_build_object('source', 'commercial_signup', 'paymentConfirmed', false),
    null
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
    v_user_id,
    'organization_user',
    'organization.created',
    'organization',
    v_organization_id,
    v_organization_id,
    jsonb_build_object(
      'source', 'commercial_signup',
      'plan', p_plan,
      'subscriptionStatus', 'pending'
    )
  );

  return jsonb_build_object(
    'status', 'ok',
    'organizationId', v_organization_id,
    'subscriptionStatus', 'pending',
    'existing', false
  );
end;
$$;
