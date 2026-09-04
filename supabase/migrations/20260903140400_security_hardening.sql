-- Hardening from the Phase 2.5 red-team review.
-- Does not change the tenant model; it closes leftover grants and mutation paths.

-- ---------------------------------------------------------------------------
-- Least-privilege EXECUTE on SECURITY DEFINER functions
-- Default privileges had re-granted EXECUTE to anon.
-- ---------------------------------------------------------------------------

revoke all on function public.current_user_organization_ids() from public, anon;
grant execute on function public.current_user_organization_ids() to authenticated;

revoke all on function public.current_user_has_org_role(uuid, text[]) from public, anon;
grant execute on function public.current_user_has_org_role(uuid, text[]) to authenticated;

revoke all on function public.is_active_platform_admin() from public, anon;
grant execute on function public.is_active_platform_admin() to authenticated;

revoke all on function public.shares_organization_with(uuid) from public, anon;
grant execute on function public.shares_organization_with(uuid) to authenticated;

revoke all on function public.can_view_archived(uuid) from public, anon;
grant execute on function public.can_view_archived(uuid) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end
$$;

revoke all on function public.resolve_guest_portal_token(text) from public, anon, authenticated;
grant execute on function public.resolve_guest_portal_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- Peer profile visibility: do not expose suspended members
-- ---------------------------------------------------------------------------

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
      and theirs.status in ('active', 'invited')
  );
$$;

-- ---------------------------------------------------------------------------
-- organization_id is immutable after insert
-- ---------------------------------------------------------------------------

create or replace function public.prevent_tenant_reparent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_tenant_reparent() from public;

create trigger organization_users_prevent_reparent
  before update on public.organization_users
  for each row execute function public.prevent_tenant_reparent();

create trigger properties_prevent_reparent
  before update on public.properties
  for each row execute function public.prevent_tenant_reparent();

create trigger guests_prevent_reparent
  before update on public.guests
  for each row execute function public.prevent_tenant_reparent();

create trigger reservations_prevent_reparent
  before update on public.reservations
  for each row execute function public.prevent_tenant_reparent();

create trigger guest_portal_tokens_prevent_reparent
  before update on public.guest_portal_tokens
  for each row execute function public.prevent_tenant_reparent();

create trigger issues_prevent_reparent
  before update on public.issues
  for each row execute function public.prevent_tenant_reparent();

create trigger property_knowledge_prevent_reparent
  before update on public.property_knowledge
  for each row execute function public.prevent_tenant_reparent();

create trigger events_prevent_reparent
  before update on public.events
  for each row execute function public.prevent_tenant_reparent();

create trigger audit_logs_prevent_reparent
  before update on public.audit_logs
  for each row execute function public.prevent_tenant_reparent();

-- ---------------------------------------------------------------------------
-- Events must not reference another tenant's records
-- Authenticated inserts cannot omit organization_id
-- ---------------------------------------------------------------------------

create or replace function public.enforce_same_organization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'reservations' then
    if not exists (
      select 1 from public.properties p
      where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'property does not belong to the reservation organization';
    end if;

    if not exists (
      select 1 from public.guests g
      where g.id = new.guest_id and g.organization_id = new.organization_id
    ) then
      raise exception 'guest does not belong to the reservation organization';
    end if;
  elsif tg_table_name = 'guest_portal_tokens' then
    if not exists (
      select 1 from public.reservations r
      where r.id = new.reservation_id
        and r.organization_id = new.organization_id
        and r.property_id = new.property_id
    ) then
      raise exception 'guest portal token is not scoped to the reservation organization';
    end if;
  elsif tg_table_name in ('issues', 'events') then
    if tg_table_name = 'events' and new.organization_id is null and auth.uid() is not null then
      raise exception 'authenticated events must include organization_id';
    end if;

    if new.property_id is not null and not exists (
      select 1 from public.properties p
      where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'related property does not belong to the organization';
    end if;

    if new.reservation_id is not null and not exists (
      select 1 from public.reservations r
      where r.id = new.reservation_id and r.organization_id = new.organization_id
    ) then
      raise exception 'related reservation does not belong to the organization';
    end if;

    if new.guest_id is not null and not exists (
      select 1 from public.guests g
      where g.id = new.guest_id and g.organization_id = new.organization_id
    ) then
      raise exception 'related guest does not belong to the organization';
    end if;
  elsif tg_table_name = 'property_knowledge' then
    if not exists (
      select 1 from public.properties p
      where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'property knowledge does not belong to the property organization';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_same_organization on public.events;

create trigger events_same_organization
  before insert or update on public.events
  for each row execute function public.enforce_same_organization();
