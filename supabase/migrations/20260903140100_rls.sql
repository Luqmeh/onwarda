-- Row Level Security.
-- Tenant context is derived from auth.uid() and organization_users.
-- Client-supplied organization_id is never trusted unless it matches membership.

-- ---------------------------------------------------------------------------
-- Privileged lookup helpers
-- These functions are SECURITY DEFINER only to avoid RLS recursion.
-- They take no foreign user/organization arguments except values already
-- constrained by auth.uid() or a caller-owned organization check.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_users
  where user_id = auth.uid()
    and status = 'active';
$$;

create or replace function public.current_user_has_org_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_users
    where user_id = auth.uid()
      and organization_id = p_organization_id
      and status = 'active'
      and role = any (p_roles)
  );
$$;

create or replace function public.is_active_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.shares_organization_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_users mine
    join public.organization_users theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = p_user_id
  );
$$;

create or replace function public.can_view_archived(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_org_role(p_organization_id, array['owner', 'admin']);
$$;

-- Guest token resolution is service-role only. Guests never receive
-- organization authentication. The raw token never enters the database.
create or replace function public.resolve_guest_portal_token(p_token_hash text)
returns table (
  token_id uuid,
  organization_id uuid,
  reservation_id uuid,
  property_id uuid,
  guest_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.organization_id,
    t.reservation_id,
    t.property_id,
    r.guest_id
  from public.guest_portal_tokens t
  join public.reservations r on r.id = t.reservation_id
  where t.token_hash = p_token_hash
    and t.revoked_at is null
    and (t.expires_at is null or t.expires_at > now());
$$;

revoke all on function public.current_user_organization_ids() from public;
revoke all on function public.current_user_has_org_role(uuid, text[]) from public;
revoke all on function public.is_active_platform_admin() from public;
revoke all on function public.shares_organization_with(uuid) from public;
revoke all on function public.can_view_archived(uuid) from public;
revoke all on function public.resolve_guest_portal_token(text) from public;

grant execute on function public.current_user_organization_ids() to authenticated;
grant execute on function public.current_user_has_org_role(uuid, text[]) to authenticated;
grant execute on function public.is_active_platform_admin() to authenticated;
grant execute on function public.shares_organization_with(uuid) to authenticated;
grant execute on function public.can_view_archived(uuid) to authenticated;
grant execute on function public.resolve_guest_portal_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from anon, public;
revoke all on table public.platform_admins from anon, public;
revoke all on table public.organizations from anon, public;
revoke all on table public.organization_users from anon, public;
revoke all on table public.properties from anon, public;
revoke all on table public.guests from anon, public;
revoke all on table public.reservations from anon, public;
revoke all on table public.guest_portal_tokens from anon, public;
revoke all on table public.issues from anon, public;
revoke all on table public.property_knowledge from anon, public;
revoke all on table public.events from anon, public;
revoke all on table public.audit_logs from anon, public;

grant select, update on table public.profiles to authenticated;
grant select on table public.platform_admins to authenticated;
grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_users to authenticated;
grant select, insert, update, delete on table public.properties to authenticated;
grant select, insert, update, delete on table public.guests to authenticated;
grant select, insert, update, delete on table public.reservations to authenticated;
grant select, insert, update, delete on table public.guest_portal_tokens to authenticated;
grant select, insert, update, delete on table public.issues to authenticated;
grant select, insert, update, delete on table public.property_knowledge to authenticated;
grant select, insert on table public.events to authenticated;
grant select on table public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_users enable row level security;
alter table public.properties enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.guest_portal_tokens enable row level security;
alter table public.issues enable row level security;
alter table public.property_knowledge enable row level security;
alter table public.events enable row level security;
alter table public.audit_logs enable row level security;

alter table public.profiles force row level security;
alter table public.platform_admins force row level security;
alter table public.organizations force row level security;
alter table public.organization_users force row level security;
alter table public.properties force row level security;
alter table public.guests force row level security;
alter table public.reservations force row level security;
alter table public.guest_portal_tokens force row level security;
alter table public.issues force row level security;
alter table public.property_knowledge force row level security;
alter table public.events force row level security;
alter table public.audit_logs force row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_self_or_org_peer
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.shares_organization_with(id)
  );

create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- platform_admins
-- Users may read only their own row so the app can resolve admin status.
-- No write policies: authenticated users cannot create or modify admins.
-- ---------------------------------------------------------------------------

create policy platform_admins_select_self
  on public.platform_admins
  for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (id in (select public.current_user_organization_ids()));

create policy organizations_update_owner_admin
  on public.organizations
  for update
  to authenticated
  using (public.current_user_has_org_role(id, array['owner', 'admin']))
  with check (public.current_user_has_org_role(id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- organization_users
-- ---------------------------------------------------------------------------

create policy organization_users_select_member
  on public.organization_users
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy organization_users_insert_owner_admin
  on public.organization_users
  for insert
  to authenticated
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin'])
  );

create policy organization_users_update_owner_admin
  on public.organization_users
  for update
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

create policy organization_users_delete_owner_admin
  on public.organization_users
  for delete
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- Shared tenant predicates
-- ---------------------------------------------------------------------------

-- properties
create policy properties_select_member
  on public.properties
  for select
  to authenticated
  using (
    organization_id in (select public.current_user_organization_ids())
    and (
      status <> 'archived'
      or public.can_view_archived(organization_id)
    )
  );

create policy properties_insert_operational
  on public.properties
  for insert
  to authenticated
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy properties_update_operational
  on public.properties
  for update
  to authenticated
  using (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  )
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy properties_delete_owner_admin
  on public.properties
  for delete
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- guests
create policy guests_select_member
  on public.guests
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy guests_insert_operational
  on public.guests
  for insert
  to authenticated
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy guests_update_operational
  on public.guests
  for update
  to authenticated
  using (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  )
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy guests_delete_owner_admin
  on public.guests
  for delete
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- reservations
create policy reservations_select_member
  on public.reservations
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy reservations_insert_operational
  on public.reservations
  for insert
  to authenticated
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy reservations_update_operational
  on public.reservations
  for update
  to authenticated
  using (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  )
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy reservations_delete_owner_admin
  on public.reservations
  for delete
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- guest_portal_tokens
create policy guest_portal_tokens_select_member
  on public.guest_portal_tokens
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy guest_portal_tokens_insert_operational
  on public.guest_portal_tokens
  for insert
  to authenticated
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy guest_portal_tokens_update_operational
  on public.guest_portal_tokens
  for update
  to authenticated
  using (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  )
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy guest_portal_tokens_delete_owner_admin
  on public.guest_portal_tokens
  for delete
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- issues (staff may write)
create policy issues_select_member
  on public.issues
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy issues_insert_staff
  on public.issues
  for insert
  to authenticated
  with check (
    public.current_user_has_org_role(
      organization_id,
      array['owner', 'admin', 'manager', 'staff']
    )
  );

create policy issues_update_staff
  on public.issues
  for update
  to authenticated
  using (
    public.current_user_has_org_role(
      organization_id,
      array['owner', 'admin', 'manager', 'staff']
    )
  )
  with check (
    public.current_user_has_org_role(
      organization_id,
      array['owner', 'admin', 'manager', 'staff']
    )
  );

create policy issues_delete_owner_admin
  on public.issues
  for delete
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- property_knowledge
create policy property_knowledge_select_member
  on public.property_knowledge
  for select
  to authenticated
  using (
    organization_id in (select public.current_user_organization_ids())
    and (
      status <> 'archived'
      or public.can_view_archived(organization_id)
    )
  );

create policy property_knowledge_insert_operational
  on public.property_knowledge
  for insert
  to authenticated
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy property_knowledge_update_operational
  on public.property_knowledge
  for update
  to authenticated
  using (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  )
  with check (
    public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager'])
  );

create policy property_knowledge_delete_owner_admin
  on public.property_knowledge
  for delete
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- events are append-only
create policy events_select_member
  on public.events
  for select
  to authenticated
  using (
    organization_id in (select public.current_user_organization_ids())
  );

create policy events_insert_member
  on public.events
  for insert
  to authenticated
  with check (
    organization_id in (select public.current_user_organization_ids())
  );

-- audit_logs: platform administrators only. No write policies.
create policy audit_logs_select_platform_admin
  on public.audit_logs
  for select
  to authenticated
  using (public.is_active_platform_admin());
