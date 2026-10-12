-- Platform-admin MFA. Identity remains is_active_platform_admin().
-- Privileged admin RPCs and admin-only reads also require the session aal
-- claim to be aal2. Client, guest, and cleaner policies are unchanged.
-- Onboarding still uses is_active_platform_admin() so an aal1 administrator
-- cannot enter the client onboarding flow.

create or replace function public.is_mfa_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_platform_admin()
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.is_mfa_platform_admin() from public, anon;
grant execute on function public.is_mfa_platform_admin() to authenticated;

create or replace function public.has_active_support_access(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_mfa_platform_admin()
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

do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%if not public.is_active_platform_admin()%'
  loop
    definition := replace(
      pg_get_functiondef(fn.oid),
      'if not public.is_active_platform_admin()',
      'if not public.is_mfa_platform_admin()'
    );
    execute definition;
  end loop;
end $$;

drop policy if exists audit_logs_select_platform_admin on public.audit_logs;
create policy audit_logs_select_platform_admin
  on public.audit_logs
  for select
  to authenticated
  using (public.is_mfa_platform_admin());

drop policy if exists organization_subscriptions_select_platform_admin on public.organization_subscriptions;
create policy organization_subscriptions_select_platform_admin
  on public.organization_subscriptions
  for select
  to authenticated
  using (public.is_mfa_platform_admin());

drop policy if exists organization_subscription_events_select_platform_admin on public.organization_subscription_events;
create policy organization_subscription_events_select_platform_admin
  on public.organization_subscription_events
  for select
  to authenticated
  using (public.is_mfa_platform_admin());

drop policy if exists organization_branding_select_platform_admin on public.organization_branding;
create policy organization_branding_select_platform_admin
  on public.organization_branding
  for select
  to authenticated
  using (public.is_mfa_platform_admin());

drop policy if exists commercial_inquiries_select_platform_admin on public.commercial_inquiries;
create policy commercial_inquiries_select_platform_admin
  on public.commercial_inquiries
  for select
  to authenticated
  using (public.is_mfa_platform_admin());

drop policy if exists support_sessions_select_self on public.support_sessions;
create policy support_sessions_select_self
  on public.support_sessions
  for select
  to authenticated
  using (
    platform_admin_user_id = auth.uid()
    and public.is_mfa_platform_admin()
  );
