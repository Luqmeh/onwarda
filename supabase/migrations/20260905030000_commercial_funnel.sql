-- Commercial website funnel: pending subscriptions, self-serve onboarding,
-- marketing events, and contact inquiries. Payment is intentionally absent.

create or replace function public.is_reserved_organization_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_slug in (
    'about', 'admin', 'app', 'api', 'auth', 'contact', 'demo', 'faq', 'features',
    'g', 'guest', 'guest-experience', 'login', 'logout', 'o', 'onwarda',
    'operations', 'p', 'portfolio', 'pricing', 'privacy', 'product',
    'property-experience', 'services', 'settings', 'signup', 'solutions',
    'status', 'support', 'terms', 'www'
  );
$$;

revoke all on function public.is_reserved_organization_slug(text) from public;
grant execute on function public.is_reserved_organization_slug(text)
  to anon, authenticated, service_role;

alter table public.organization_subscriptions
  drop constraint organization_subscriptions_status_check;

alter table public.organization_subscriptions
  add constraint organization_subscriptions_status_check
  check (status in ('pending', 'trialing', 'active', 'past_due', 'cancelled', 'paused'));

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

  if public.is_reserved_organization_slug(p_slug) then
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
  subscription_id uuid;
  started_at_value timestamptz;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_plan not in ('free', 'starter', 'professional', 'enterprise') then
    raise exception 'invalid subscription plan'
      using errcode = '22023';
  end if;

  if p_status not in ('pending', 'trialing', 'active', 'past_due', 'cancelled', 'paused') then
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
    cancelled_at
    into
      existing_id,
      previous_plan,
      previous_status,
      previous_interval,
      previous_started,
      previous_renews,
      previous_cancelled
  from public.organization_subscriptions
  where organization_id = p_organization_id
  for update;

  if existing_id is null then
    insert into public.organization_subscriptions (
      organization_id,
      plan,
      status,
      billing_interval,
      started_at,
      renews_at,
      cancelled_at
    ) values (
      p_organization_id,
      p_plan,
      p_status,
      p_billing_interval,
      started_at_value,
      p_renews_at,
      p_cancelled_at
    )
    returning id into subscription_id;
  else
    update public.organization_subscriptions
      set
        plan = p_plan,
        status = p_status,
        billing_interval = p_billing_interval,
        started_at = started_at_value,
        renews_at = p_renews_at,
        cancelled_at = p_cancelled_at
    where id = existing_id;

    subscription_id := existing_id;
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
    select s.status into v_subscription_status
    from public.organization_subscriptions s
    where s.organization_id = v_organization_id;

    if v_subscription_status is null then
      insert into public.organization_subscriptions (
        organization_id, plan, status, billing_interval
      ) values (
        v_organization_id, p_plan, 'pending', 'month'
      );
    elsif v_subscription_status = 'pending' then
      update public.organization_subscriptions
      set plan = p_plan
      where organization_id = v_organization_id
        and status = 'pending';
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

revoke all on function public.complete_commercial_onboarding(text, text, text)
  from public, anon;
grant execute on function public.complete_commercial_onboarding(text, text, text)
  to authenticated;

create table public.commercial_inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  name text not null,
  email text not null,
  company_name text,
  property_count text,
  message text not null,
  plan text,
  created_at timestamptz not null default now(),
  constraint commercial_inquiries_kind_check check (kind in ('contact', 'demo')),
  constraint commercial_inquiries_name_length check (char_length(name) between 1 and 120),
  constraint commercial_inquiries_email_length check (char_length(email) between 3 and 160),
  constraint commercial_inquiries_message_length check (char_length(message) between 3 and 4000)
);

revoke all on table public.commercial_inquiries from anon, public, authenticated;
grant select on table public.commercial_inquiries to authenticated;

alter table public.commercial_inquiries enable row level security;
alter table public.commercial_inquiries force row level security;

create policy commercial_inquiries_select_platform_admin
  on public.commercial_inquiries
  for select
  to authenticated
  using (public.is_active_platform_admin());

create or replace function public.submit_commercial_inquiry(
  p_kind text,
  p_name text,
  p_email text,
  p_company_name text,
  p_property_count text,
  p_message text,
  p_plan text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('contact', 'demo') then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_name is null or length(btrim(p_name)) < 1 or length(btrim(p_name)) > 120
     or p_email is null or p_email !~ '^[^@]+@[^@]+\.[^@]+$'
     or length(p_email) > 160
     or p_message is null or length(btrim(p_message)) < 3
     or length(btrim(p_message)) > 4000 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_plan is not null and p_plan not in ('starter', 'professional', 'enterprise') then
    p_plan := null;
  end if;

  insert into public.commercial_inquiries (
    kind, name, email, company_name, property_count, message, plan
  ) values (
    p_kind,
    btrim(p_name),
    lower(btrim(p_email)),
    nullif(btrim(p_company_name), ''),
    nullif(btrim(p_property_count), ''),
    btrim(p_message),
    p_plan
  );

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.submit_commercial_inquiry(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_commercial_inquiry(text, text, text, text, text, text, text)
  to service_role;

create or replace function public.record_marketing_event(
  p_event_type text,
  p_path text default null,
  p_plan text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in (
    'marketing_page_viewed',
    'pricing_viewed',
    'pricing_plan_selected',
    'signup_started',
    'signup_completed',
    'demo_requested',
    'contact_submitted',
    'login_started'
  ) then
    return;
  end if;

  insert into public.events (
    organization_id,
    event_type,
    metadata
  ) values (
    null,
    p_event_type,
    jsonb_strip_nulls(jsonb_build_object(
      'path', left(coalesce(p_path, ''), 120),
      'plan', case
        when p_plan in ('starter', 'professional', 'enterprise') then p_plan
        else null
      end
    ))
  );
end;
$$;

revoke all on function public.record_marketing_event(text, text, text) from public;
grant execute on function public.record_marketing_event(text, text, text)
  to anon, authenticated;
