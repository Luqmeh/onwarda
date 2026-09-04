-- Subscription foundation (no payment provider) and support-workspace
-- read access. Platform admins never become organization_users.

-- ---------------------------------------------------------------------------
-- organization_subscriptions
-- Payment processing is intentionally out of scope. Platform admins maintain
-- these records manually until a billing provider is added later.
-- ---------------------------------------------------------------------------

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete restrict,
  plan text not null default 'free',
  status text not null default 'trialing',
  billing_interval text not null default 'month',
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_plan_check
    check (plan in ('free', 'starter', 'professional', 'enterprise')),
  constraint organization_subscriptions_status_check
    check (status in ('trialing', 'active', 'past_due', 'cancelled', 'paused')),
  constraint organization_subscriptions_interval_check
    check (billing_interval in ('month', 'year')),
  constraint organization_subscriptions_cancelled_check
    check (cancelled_at is null or cancelled_at >= started_at)
);

create index organization_subscriptions_status_idx
  on public.organization_subscriptions (status, renews_at);

revoke all on table public.organization_subscriptions from anon, public, authenticated;
grant select on table public.organization_subscriptions to authenticated;

alter table public.organization_subscriptions enable row level security;
alter table public.organization_subscriptions force row level security;

create trigger organization_subscriptions_set_updated_at
  before update on public.organization_subscriptions
  for each row execute function public.set_updated_at();

-- Members may see their own organization's subscription. They cannot change it.
create policy organization_subscriptions_select_member
  on public.organization_subscriptions
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy organization_subscriptions_select_platform_admin
  on public.organization_subscriptions
  for select
  to authenticated
  using (public.is_active_platform_admin());

-- ---------------------------------------------------------------------------
-- Support workspace access
-- A valid, unexpired, unended support session may read the selected
-- organization's tenant rows. It does not create membership and does not
-- grant writes. Organization identity comes from the session row only.
-- ---------------------------------------------------------------------------

create or replace function public.has_active_support_access(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_platform_admin()
    and exists (
      select 1
      from public.support_sessions ss
      where ss.platform_admin_user_id = auth.uid()
        and ss.organization_id = p_organization_id
        and ss.ended_at is null
        and ss.expires_at > now()
    );
$$;

revoke all on function public.has_active_support_access(uuid) from public, anon;
grant execute on function public.has_active_support_access(uuid) to authenticated;

create policy organizations_select_support
  on public.organizations
  for select
  to authenticated
  using (public.has_active_support_access(id));

create policy organization_users_select_support
  on public.organization_users
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy properties_select_support
  on public.properties
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy guests_select_support
  on public.guests
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy reservations_select_support
  on public.reservations
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy issues_select_support
  on public.issues
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy property_knowledge_select_support
  on public.property_knowledge
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy events_select_support
  on public.events
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy organization_subscriptions_select_support
  on public.organization_subscriptions
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy profiles_select_support_org_peer
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_users ou
      where ou.user_id = profiles.id
        and public.has_active_support_access(ou.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Admin subscription mutation
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

  if p_status not in ('trialing', 'active', 'past_due', 'cancelled', 'paused') then
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
      'previousPlan', previous_plan,
      'plan', p_plan,
      'previousStatus', previous_status,
      'status', p_status,
      'previousBillingInterval', previous_interval,
      'billingInterval', p_billing_interval,
      'previousStartedAt', previous_started,
      'startedAt', started_at_value,
      'previousRenewsAt', previous_renews,
      'renewsAt', p_renews_at,
      'previousCancelledAt', previous_cancelled,
      'cancelledAt', p_cancelled_at
    )
  );

  return subscription_id;
end;
$$;

revoke all on function public.admin_set_organization_subscription(
  uuid, text, text, text, timestamptz, timestamptz, timestamptz
) from public, anon, service_role;
grant execute on function public.admin_set_organization_subscription(
  uuid, text, text, text, timestamptz, timestamptz, timestamptz
) to authenticated;
