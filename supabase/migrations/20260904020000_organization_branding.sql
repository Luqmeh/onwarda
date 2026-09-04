-- Organization branding foundation.
-- One branding record per organization. Logos live in private Storage.
-- Property-specific brand overrides are intentionally not modeled yet.

-- ---------------------------------------------------------------------------
-- organization_branding
-- ---------------------------------------------------------------------------

create table public.organization_branding (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete restrict,
  display_name text,
  logo_path text,
  primary_color text,
  secondary_color text,
  accent_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_branding_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
  constraint organization_branding_primary_color_check
    check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_branding_secondary_color_check
    check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_branding_accent_color_check
    check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint organization_branding_logo_path_check
    check (
      logo_path is null
      or logo_path ~ '^organizations/[0-9a-fA-F-]{36}/branding/logo\.(png|jpg|jpeg|webp)$'
    )
);

create index organization_branding_organization_id_idx
  on public.organization_branding (organization_id);

revoke all on table public.organization_branding from anon, public, authenticated;
grant select, update on table public.organization_branding to authenticated;

alter table public.organization_branding enable row level security;
alter table public.organization_branding force row level security;

create trigger organization_branding_set_updated_at
  before update on public.organization_branding
  for each row execute function public.set_updated_at();

create or replace function public.enforce_branding_logo_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed'
      using errcode = 'P0001';
  end if;

  if new.logo_path is not null
     and split_part(new.logo_path, '/', 2) is distinct from new.organization_id::text then
    raise exception 'logo path is not scoped to the organization'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_branding_logo_scope() from public;
create trigger organization_branding_prevent_reparent
  before update on public.organization_branding
  for each row execute function public.enforce_branding_logo_scope();

create or replace function public.ensure_organization_branding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_branding (organization_id, display_name)
  values (new.id, new.name)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

revoke all on function public.ensure_organization_branding() from public, anon, authenticated;
grant execute on function public.ensure_organization_branding() to postgres;

create trigger organizations_ensure_branding
  after insert on public.organizations
  for each row execute function public.ensure_organization_branding();

insert into public.organization_branding (organization_id, display_name)
select id, name
from public.organizations
on conflict (organization_id) do nothing;

create policy organization_branding_select_member
  on public.organization_branding
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy organization_branding_select_support
  on public.organization_branding
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create policy organization_branding_select_platform_admin
  on public.organization_branding
  for select
  to authenticated
  using (public.is_active_platform_admin());

create policy organization_branding_update_owner_admin
  on public.organization_branding
  for update
  to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- Admin branding RPCs
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_organization_branding(
  p_organization_id uuid,
  p_display_name text,
  p_primary_color text,
  p_secondary_color text,
  p_accent_color text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_name text;
  previous_primary text;
  previous_secondary text;
  previous_accent text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found'
      using errcode = 'P0002';
  end if;

  if p_display_name is not null and (
    length(btrim(p_display_name)) < 1
    or length(btrim(p_display_name)) > 120
  ) then
    raise exception 'invalid display name'
      using errcode = '22023';
  end if;

  if p_primary_color is not null and p_primary_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid brand color'
      using errcode = '22023';
  end if;

  if p_secondary_color is not null and p_secondary_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid brand color'
      using errcode = '22023';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid brand color'
      using errcode = '22023';
  end if;

  insert into public.organization_branding (organization_id, display_name)
  values (p_organization_id, null)
  on conflict (organization_id) do nothing;

  select display_name, primary_color, secondary_color, accent_color
    into previous_name, previous_primary, previous_secondary, previous_accent
  from public.organization_branding
  where organization_id = p_organization_id
  for update;

  update public.organization_branding
    set
      display_name = nullif(btrim(p_display_name), ''),
      primary_color = p_primary_color,
      secondary_color = p_secondary_color,
      accent_color = p_accent_color
  where organization_id = p_organization_id;

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
    'organization.branding_updated',
    'organization_branding',
    p_organization_id,
    p_organization_id,
    jsonb_build_object(
      'previousDisplayName', previous_name,
      'displayName', nullif(btrim(p_display_name), ''),
      'previousPrimaryColor', previous_primary,
      'primaryColor', p_primary_color,
      'previousSecondaryColor', previous_secondary,
      'secondaryColor', p_secondary_color,
      'previousAccentColor', previous_accent,
      'accentColor', p_accent_color
    )
  );
end;
$$;

create or replace function public.admin_set_organization_branding_logo(
  p_organization_id uuid,
  p_logo_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_path text;
begin
  if not public.is_active_platform_admin() then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization not found'
      using errcode = 'P0002';
  end if;

  if p_logo_path is not null
     and p_logo_path !~ '^organizations/[0-9a-fA-F-]{36}/branding/logo\.(png|jpg|jpeg|webp)$' then
    raise exception 'invalid logo path'
      using errcode = '22023';
  end if;

  if p_logo_path is not null
     and split_part(p_logo_path, '/', 2) is distinct from p_organization_id::text then
    raise exception 'logo path is not scoped to the organization'
      using errcode = 'P0001';
  end if;

  insert into public.organization_branding (organization_id, display_name)
  values (p_organization_id, null)
  on conflict (organization_id) do nothing;

  select logo_path
    into previous_path
  from public.organization_branding
  where organization_id = p_organization_id
  for update;

  update public.organization_branding
    set logo_path = p_logo_path
  where organization_id = p_organization_id;

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
    case
      when p_logo_path is null then 'organization.branding_logo_removed'
      else 'organization.branding_logo_uploaded'
    end,
    'organization_branding',
    p_organization_id,
    p_organization_id,
    jsonb_build_object(
      'hadLogo', previous_path is not null,
      'hasLogo', p_logo_path is not null
    )
  );
end;
$$;

revoke all on function public.admin_set_organization_branding(uuid, text, text, text, text)
  from public, anon, service_role;
grant execute on function public.admin_set_organization_branding(uuid, text, text, text, text)
  to authenticated;

revoke all on function public.admin_set_organization_branding_logo(uuid, text)
  from public, anon, service_role;
grant execute on function public.admin_set_organization_branding_logo(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Private branding bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-branding',
  'organization-branding',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists branding_select_storage_objects on storage.objects;
drop policy if exists branding_insert_storage_objects on storage.objects;
drop policy if exists branding_update_storage_objects on storage.objects;
drop policy if exists branding_delete_storage_objects on storage.objects;

create policy branding_select_storage_objects
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organization-branding'
    and (
      public.storage_object_organization_id(name) in (
        select public.current_user_organization_ids()
      )
      or public.has_active_support_access(public.storage_object_organization_id(name))
    )
  );

create policy branding_insert_storage_objects
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization-branding'
    and name ~ '^organizations/[0-9a-fA-F-]{36}/branding/logo\.(png|jpg|jpeg|webp)$'
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin']
    )
  );

create policy branding_update_storage_objects
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization-branding'
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin']
    )
  )
  with check (
    bucket_id = 'organization-branding'
    and name ~ '^organizations/[0-9a-fA-F-]{36}/branding/logo\.(png|jpg|jpeg|webp)$'
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin']
    )
  );

create policy branding_delete_storage_objects
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization-branding'
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin']
    )
  );
