-- Property CMS: canonical property content, amenities, house rules, media.
-- Extends properties and property_knowledge. Does not introduce a second
-- property content model for future public or guest surfaces.

-- ---------------------------------------------------------------------------
-- Catalogs (global, not tenant-owned)
-- ---------------------------------------------------------------------------

create table public.amenity_definitions (
  key text primary key,
  label text not null,
  sort_order integer not null,
  constraint amenity_definitions_key_format check (key ~ '^[a-z][a-z0-9_]*$')
);

create table public.house_rule_definitions (
  key text primary key,
  label text not null,
  sort_order integer not null,
  constraint house_rule_definitions_key_format check (key ~ '^[a-z][a-z0-9_]*$')
);

insert into public.amenity_definitions (key, label, sort_order) values
  ('wifi', 'Wi-Fi', 10),
  ('air_conditioning', 'Air conditioning', 20),
  ('heating', 'Heating', 30),
  ('kitchen', 'Kitchen', 40),
  ('tv', 'TV', 50),
  ('washer', 'Washer', 60),
  ('parking', 'Parking', 70),
  ('pool', 'Pool', 80),
  ('workspace', 'Workspace', 90),
  ('balcony', 'Balcony', 100),
  ('terrace', 'Terrace', 110);

insert into public.house_rule_definitions (key, label, sort_order) values
  ('smoking', 'Smoking', 10),
  ('pets', 'Pets', 20),
  ('parties', 'Parties', 30),
  ('visitors', 'Visitors', 40),
  ('quiet_hours', 'Quiet hours', 50),
  ('checkout', 'Checkout requirements', 60);

revoke all on table public.amenity_definitions from anon, public, authenticated;
revoke all on table public.house_rule_definitions from anon, public, authenticated;
grant select on table public.amenity_definitions to authenticated;
grant select on table public.house_rule_definitions to authenticated;

alter table public.amenity_definitions enable row level security;
alter table public.amenity_definitions force row level security;
alter table public.house_rule_definitions enable row level security;
alter table public.house_rule_definitions force row level security;

create policy amenity_definitions_select_authenticated
  on public.amenity_definitions
  for select
  to authenticated
  using (true);

create policy house_rule_definitions_select_authenticated
  on public.house_rule_definitions
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Properties: structured identity fields
-- ---------------------------------------------------------------------------

update public.properties
set property_type = 'other'
where property_type is not null
  and property_type not in (
    'apartment', 'house', 'riad', 'villa', 'room', 'hotel_room', 'guesthouse', 'other'
  );

alter table public.properties
  drop constraint if exists properties_property_type_check,
  drop constraint if exists properties_capacity_check,
  drop constraint if exists properties_bedrooms_check,
  drop constraint if exists properties_bathrooms_check,
  drop constraint if exists properties_internal_identifier_check,
  drop constraint if exists properties_description_length;

alter table public.properties
  add constraint properties_property_type_check
    check (
      property_type is null
      or property_type in (
        'apartment', 'house', 'riad', 'villa', 'room', 'hotel_room', 'guesthouse', 'other'
      )
    ),
  add constraint properties_capacity_check
    check (capacity is null or (capacity >= 1 and capacity <= 100)),
  add constraint properties_bedrooms_check
    check (bedrooms is null or (bedrooms >= 0 and bedrooms <= 50)),
  add constraint properties_bathrooms_check
    check (bathrooms is null or (bathrooms >= 0 and bathrooms <= 50)),
  add constraint properties_internal_identifier_check
    check (
      internal_identifier is null
      or char_length(btrim(internal_identifier)) between 1 and 80
    ),
  add constraint properties_description_length
    check (description is null or char_length(description) <= 500);

-- ---------------------------------------------------------------------------
-- property_languages
-- ---------------------------------------------------------------------------

create table public.property_languages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  language_code text not null,
  created_at timestamptz not null default now(),
  constraint property_languages_code_check
    check (language_code in ('en', 'fr', 'ar', 'es', 'de', 'it')),
  constraint property_languages_unique unique (property_id, language_code)
);

-- ---------------------------------------------------------------------------
-- property_amenities
-- ---------------------------------------------------------------------------

create table public.property_amenities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  amenity_key text not null references public.amenity_definitions (key),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint property_amenities_unique unique (property_id, amenity_key)
);

-- ---------------------------------------------------------------------------
-- property_house_rules
-- ---------------------------------------------------------------------------

create table public.property_house_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  rule_key text not null references public.house_rule_definitions (key),
  state text not null default 'unspecified',
  details text,
  visibility text not null default 'public',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_house_rules_state_check
    check (state in ('allowed', 'not_allowed', 'limited', 'unspecified')),
  constraint property_house_rules_visibility_check
    check (visibility in ('public', 'guest', 'private')),
  constraint property_house_rules_details_length
    check (details is null or char_length(details) <= 2000),
  constraint property_house_rules_unique unique (property_id, rule_key)
);

-- ---------------------------------------------------------------------------
-- property_content (narrative + access, with explicit visibility)
-- ---------------------------------------------------------------------------

create table public.property_content (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  field_key text not null,
  body text not null,
  visibility text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_content_field_check
    check (field_key in (
      'neighborhood',
      'nearby_attractions',
      'transportation',
      'local_information',
      'arrival_instructions',
      'parking_instructions',
      'building_entry',
      'key_retrieval',
      'lockbox_instructions',
      'smart_lock_instructions',
      'reception_instructions',
      'contact_information',
      'private_notes'
    )),
  constraint property_content_visibility_check
    check (visibility in ('public', 'guest', 'private')),
  constraint property_content_body_length
    check (char_length(body) between 1 and 8000),
  constraint property_content_sensitive_visibility_check
    check (
      (field_key = 'private_notes' and visibility = 'private')
      or (
        field_key in (
          'building_entry',
          'key_retrieval',
          'lockbox_instructions',
          'smart_lock_instructions',
          'reception_instructions'
        )
        and visibility in ('guest', 'private')
      )
      or field_key not in (
        'private_notes',
        'building_entry',
        'key_retrieval',
        'lockbox_instructions',
        'smart_lock_instructions',
        'reception_instructions'
      )
    ),
  constraint property_content_unique unique (property_id, field_key)
);

-- ---------------------------------------------------------------------------
-- property_media
-- ---------------------------------------------------------------------------

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  media_type text not null,
  role text,
  storage_path text,
  external_url text,
  sort_order integer not null default 0,
  caption text,
  alt_text text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_media_type_check
    check (media_type in ('image', 'video', 'tour_360', 'instructional_video')),
  constraint property_media_role_check
    check (role is null or role in ('hero', 'gallery')),
  constraint property_media_visibility_check
    check (visibility in ('public', 'guest', 'private')),
  constraint property_media_caption_length
    check (caption is null or char_length(caption) <= 200),
  constraint property_media_alt_length
    check (alt_text is null or char_length(alt_text) <= 200),
  constraint property_media_payload_check
    check (
      (
        media_type = 'image'
        and storage_path is not null
        and external_url is null
        and role in ('hero', 'gallery')
      )
      or (
        media_type in ('video', 'tour_360', 'instructional_video')
        and storage_path is null
        and external_url is not null
        and role is null
      )
    ),
  constraint property_media_storage_path_format
    check (
      storage_path is null
      or storage_path ~ '^organizations/[0-9a-fA-F-]{36}/properties/[0-9a-fA-F-]{36}/media/[0-9a-fA-F-]{36}\.(png|jpg|jpeg|webp)$'
    ),
  constraint property_media_external_url_format
    check (
      external_url is null
      or external_url ~ '^https://[A-Za-z0-9.-]+(/.*)?$'
    )
);

create unique index property_media_one_hero
  on public.property_media (property_id)
  where role = 'hero';

create unique index property_media_one_external_type
  on public.property_media (property_id, media_type)
  where media_type in ('video', 'tour_360', 'instructional_video');

-- ---------------------------------------------------------------------------
-- property_knowledge CMS fields
-- ---------------------------------------------------------------------------

drop index if exists public.property_knowledge_unique_published;

alter table public.property_knowledge
  drop constraint if exists property_knowledge_category_check;

alter table public.property_knowledge
  add column if not exists visibility text,
  add column if not exists sort_order integer not null default 0;

update public.property_knowledge
set visibility = case
  when status = 'published' then 'guest'
  else 'private'
end
where visibility is null;

alter table public.property_knowledge
  alter column visibility set default 'guest',
  alter column visibility set not null;

alter table public.property_knowledge
  add constraint property_knowledge_category_check
    check (category in (
      'house_rules',
      'check_in',
      'check_out',
      'wifi',
      'access',
      'faq',
      'tutorial',
      'ac',
      'tv',
      'stove',
      'washer',
      'hot_water',
      'coffee_machine',
      'garbage',
      'pool',
      'door_access',
      'other'
    )),
  add constraint property_knowledge_visibility_check
    check (visibility in ('public', 'guest', 'private'));

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index property_languages_organization_id_idx
  on public.property_languages (organization_id);
create index property_languages_property_id_idx
  on public.property_languages (property_id);

create index property_amenities_organization_id_idx
  on public.property_amenities (organization_id);
create index property_amenities_property_id_idx
  on public.property_amenities (property_id);

create index property_house_rules_organization_id_idx
  on public.property_house_rules (organization_id);
create index property_house_rules_property_id_idx
  on public.property_house_rules (property_id);

create index property_content_organization_id_idx
  on public.property_content (organization_id);
create index property_content_property_visibility_idx
  on public.property_content (property_id, visibility);

create index property_media_organization_id_idx
  on public.property_media (organization_id);
create index property_media_property_id_idx
  on public.property_media (property_id);
create index property_media_property_visibility_idx
  on public.property_media (property_id, visibility);

create index property_knowledge_property_visibility_idx
  on public.property_knowledge (property_id, visibility, status);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger property_house_rules_set_updated_at
  before update on public.property_house_rules
  for each row execute function public.set_updated_at();

create trigger property_content_set_updated_at
  before update on public.property_content
  for each row execute function public.set_updated_at();

create trigger property_media_set_updated_at
  before update on public.property_media
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant consistency and reparent protection
-- ---------------------------------------------------------------------------

create or replace function public.prevent_property_reparent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.property_id is distinct from old.property_id then
    raise exception 'property_id cannot be changed';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_property_reparent() from public;

create trigger property_languages_prevent_reparent
  before update on public.property_languages
  for each row execute function public.prevent_tenant_reparent();

create trigger property_languages_prevent_property_reparent
  before update on public.property_languages
  for each row execute function public.prevent_property_reparent();

create trigger property_amenities_prevent_reparent
  before update on public.property_amenities
  for each row execute function public.prevent_tenant_reparent();

create trigger property_amenities_prevent_property_reparent
  before update on public.property_amenities
  for each row execute function public.prevent_property_reparent();

create trigger property_house_rules_prevent_reparent
  before update on public.property_house_rules
  for each row execute function public.prevent_tenant_reparent();

create trigger property_house_rules_prevent_property_reparent
  before update on public.property_house_rules
  for each row execute function public.prevent_property_reparent();

create trigger property_content_prevent_reparent
  before update on public.property_content
  for each row execute function public.prevent_tenant_reparent();

create trigger property_content_prevent_property_reparent
  before update on public.property_content
  for each row execute function public.prevent_property_reparent();

create trigger property_media_prevent_reparent
  before update on public.property_media
  for each row execute function public.prevent_tenant_reparent();

create trigger property_media_prevent_property_reparent
  before update on public.property_media
  for each row execute function public.prevent_property_reparent();

create or replace function public.enforce_property_media_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.storage_path is not null then
    if split_part(new.storage_path, '/', 2) is distinct from new.organization_id::text then
      raise exception 'media path is not scoped to the organization';
    end if;

    if split_part(new.storage_path, '/', 4) is distinct from new.property_id::text then
      raise exception 'media path is not scoped to the property';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_property_media_scope() from public;

create trigger property_media_scope
  before insert or update on public.property_media
  for each row execute function public.enforce_property_media_scope();

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
  elsif tg_table_name in (
    'property_knowledge',
    'property_languages',
    'property_amenities',
    'property_house_rules',
    'property_content',
    'property_media'
  ) then
    if not exists (
      select 1 from public.properties p
      where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'child record does not belong to the property organization';
    end if;
  end if;

  return new;
end;
$$;

create trigger property_languages_same_organization
  before insert or update on public.property_languages
  for each row execute function public.enforce_same_organization();

create trigger property_amenities_same_organization
  before insert or update on public.property_amenities
  for each row execute function public.enforce_same_organization();

create trigger property_house_rules_same_organization
  before insert or update on public.property_house_rules
  for each row execute function public.enforce_same_organization();

create trigger property_content_same_organization
  before insert or update on public.property_content
  for each row execute function public.enforce_same_organization();

create trigger property_media_same_organization
  before insert or update on public.property_media
  for each row execute function public.enforce_same_organization();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on table public.property_languages from anon, public, authenticated;
revoke all on table public.property_amenities from anon, public, authenticated;
revoke all on table public.property_house_rules from anon, public, authenticated;
revoke all on table public.property_content from anon, public, authenticated;
revoke all on table public.property_media from anon, public, authenticated;

grant select, insert, update, delete on table public.property_languages to authenticated;
grant select, insert, update, delete on table public.property_amenities to authenticated;
grant select, insert, update, delete on table public.property_house_rules to authenticated;
grant select, insert, update, delete on table public.property_content to authenticated;
grant select, insert, update, delete on table public.property_media to authenticated;

alter table public.property_languages enable row level security;
alter table public.property_languages force row level security;
alter table public.property_amenities enable row level security;
alter table public.property_amenities force row level security;
alter table public.property_house_rules enable row level security;
alter table public.property_house_rules force row level security;
alter table public.property_content enable row level security;
alter table public.property_content force row level security;
alter table public.property_media enable row level security;
alter table public.property_media force row level security;

-- Select: members + support
create policy property_languages_select_member
  on public.property_languages for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));
create policy property_languages_select_support
  on public.property_languages for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy property_amenities_select_member
  on public.property_amenities for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));
create policy property_amenities_select_support
  on public.property_amenities for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy property_house_rules_select_member
  on public.property_house_rules for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));
create policy property_house_rules_select_support
  on public.property_house_rules for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy property_content_select_member
  on public.property_content for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));
create policy property_content_select_support
  on public.property_content for select to authenticated
  using (public.has_active_support_access(organization_id));

create policy property_media_select_member
  on public.property_media for select to authenticated
  using (organization_id in (select public.current_user_organization_ids()));
create policy property_media_select_support
  on public.property_media for select to authenticated
  using (public.has_active_support_access(organization_id));

-- Writes: owner/admin/manager. Staff and support cannot mutate.
create policy property_languages_write_operational
  on public.property_languages for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_languages_update_operational
  on public.property_languages for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_languages_delete_operational
  on public.property_languages for delete to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy property_amenities_write_operational
  on public.property_amenities for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_amenities_update_operational
  on public.property_amenities for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_amenities_delete_operational
  on public.property_amenities for delete to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy property_house_rules_write_operational
  on public.property_house_rules for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_house_rules_update_operational
  on public.property_house_rules for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_house_rules_delete_operational
  on public.property_house_rules for delete to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy property_content_write_operational
  on public.property_content for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_content_update_operational
  on public.property_content for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_content_delete_operational
  on public.property_content for delete to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

create policy property_media_write_operational
  on public.property_media for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_media_update_operational
  on public.property_media for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']))
  with check (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));
create policy property_media_delete_operational
  on public.property_media for delete to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists property_knowledge_delete_owner_admin on public.property_knowledge;

create policy property_knowledge_delete_operational
  on public.property_knowledge for delete to authenticated
  using (public.current_user_has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- ---------------------------------------------------------------------------
-- Property media storage: tighter path, support read, manager write
-- ---------------------------------------------------------------------------

create or replace function public.storage_object_property_id(object_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  parts text[];
begin
  parts := string_to_array(object_name, '/');

  if array_length(parts, 1) is null or array_length(parts, 1) < 4 then
    return null;
  end if;

  if parts[1] <> 'organizations' or parts[3] <> 'properties' then
    return null;
  end if;

  begin
    return parts[4]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

revoke all on function public.storage_object_property_id(text) from public, anon;
grant execute on function public.storage_object_property_id(text) to authenticated;

create or replace function public.property_media_object_is_valid(object_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    object_name ~ '^organizations/[0-9a-fA-F-]{36}/properties/[0-9a-fA-F-]{36}/media/[0-9a-fA-F-]{36}\.(png|jpg|jpeg|webp)$'
    and exists (
      select 1
      from public.properties p
      where p.id = public.storage_object_property_id(object_name)
        and p.organization_id = public.storage_object_organization_id(object_name)
    );
$$;

revoke all on function public.property_media_object_is_valid(text) from public, anon;
grant execute on function public.property_media_object_is_valid(text) to authenticated;

update storage.buckets
set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'property-media';

drop policy if exists tenant_select_storage_objects on storage.objects;
drop policy if exists tenant_insert_storage_objects on storage.objects;
drop policy if exists tenant_update_storage_objects on storage.objects;
drop policy if exists tenant_delete_storage_objects on storage.objects;

create policy tenant_select_storage_objects
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('organization-assets', 'guest-documents')
    and public.storage_object_organization_id(name) in (
      select public.current_user_organization_ids()
    )
  );

create policy tenant_insert_storage_objects
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('organization-assets', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  );

create policy tenant_update_storage_objects
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('organization-assets', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  )
  with check (
    bucket_id in ('organization-assets', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  );

create policy tenant_delete_storage_objects
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('organization-assets', 'guest-documents')
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin']
    )
  );

drop policy if exists property_media_select_storage_objects on storage.objects;
drop policy if exists property_media_insert_storage_objects on storage.objects;
drop policy if exists property_media_update_storage_objects on storage.objects;
drop policy if exists property_media_delete_storage_objects on storage.objects;

create policy property_media_select_storage_objects
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'property-media'
    and public.property_media_object_is_valid(name)
    and (
      public.storage_object_organization_id(name) in (
        select public.current_user_organization_ids()
      )
      or public.has_active_support_access(public.storage_object_organization_id(name))
    )
  );

create policy property_media_insert_storage_objects
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'property-media'
    and public.property_media_object_is_valid(name)
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  );

create policy property_media_update_storage_objects
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'property-media'
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  )
  with check (
    bucket_id = 'property-media'
    and public.property_media_object_is_valid(name)
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  );

create policy property_media_delete_storage_objects
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'property-media'
    and public.property_media_object_is_valid(name)
    and public.current_user_has_org_role(
      public.storage_object_organization_id(name),
      array['owner', 'admin', 'manager']
    )
  );
