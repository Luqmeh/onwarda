-- Phase 5B: public portfolio/showcase reads, guest stay journey, and
-- token-authorized guest mutations. No anon table grants.

-- ---------------------------------------------------------------------------
-- Property public listing
-- ---------------------------------------------------------------------------

alter table public.properties
  add column if not exists is_listed_publicly boolean not null default false,
  add column if not exists booking_url text;

alter table public.properties
  drop constraint if exists properties_booking_url_https;

alter table public.properties
  add constraint properties_booking_url_https
    check (
      booking_url is null
      or (
        char_length(booking_url) between 12 and 500
        and booking_url ~ '^https://'
      )
    );

create index if not exists properties_public_listing_idx
  on public.properties (organization_id, slug)
  where status = 'active' and is_listed_publicly = true;

-- ---------------------------------------------------------------------------
-- Organization public description (branding presentation, not a new identity)
-- ---------------------------------------------------------------------------

alter table public.organization_branding
  add column if not exists public_description text;

alter table public.organization_branding
  drop constraint if exists organization_branding_public_description_length;

alter table public.organization_branding
  add constraint organization_branding_public_description_length
    check (
      public_description is null
      or char_length(btrim(public_description)) between 1 and 500
    );

-- ---------------------------------------------------------------------------
-- Reservation journey (canonical stay, not a second journey system)
-- ---------------------------------------------------------------------------

alter table public.reservations
  add column if not exists journey_status text not null default 'not_started',
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists rules_accepted_at timestamptz,
  add column if not exists rules_accepted_version text,
  add column if not exists checkout_completed_at timestamptz,
  add column if not exists arrival_notes text;

alter table public.reservations
  drop constraint if exists reservations_journey_status_check;

alter table public.reservations
  add constraint reservations_journey_status_check
    check (journey_status in (
      'not_started',
      'in_progress',
      'complete',
      'needs_attention',
      'checked_out'
    ));

alter table public.reservations
  drop constraint if exists reservations_arrival_notes_length;

alter table public.reservations
  add constraint reservations_arrival_notes_length
    check (arrival_notes is null or char_length(arrival_notes) <= 2000);

alter table public.reservations
  drop constraint if exists reservations_rules_version_length;

alter table public.reservations
  add constraint reservations_rules_version_length
    check (
      rules_accepted_version is null
      or char_length(rules_accepted_version) <= 128
    );

create index if not exists reservations_journey_status_idx
  on public.reservations (organization_id, journey_status);

-- ---------------------------------------------------------------------------
-- Guest rule acceptances
-- ---------------------------------------------------------------------------

create table if not exists public.guest_rule_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete restrict,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete restrict,
  rules_version text not null,
  rules_snapshot jsonb not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint guest_rule_acceptances_version_length
    check (char_length(rules_version) between 8 and 128),
  constraint guest_rule_acceptances_unique_reservation unique (reservation_id)
);

create index if not exists guest_rule_acceptances_organization_id_idx
  on public.guest_rule_acceptances (organization_id);

create index if not exists guest_rule_acceptances_reservation_id_idx
  on public.guest_rule_acceptances (reservation_id);

revoke all on table public.guest_rule_acceptances from anon, public, authenticated;
grant select on table public.guest_rule_acceptances to authenticated;

alter table public.guest_rule_acceptances enable row level security;
alter table public.guest_rule_acceptances force row level security;

create policy guest_rule_acceptances_select_member
  on public.guest_rule_acceptances
  for select
  to authenticated
  using (organization_id in (select public.current_user_organization_ids()));

create policy guest_rule_acceptances_select_support
  on public.guest_rule_acceptances
  for select
  to authenticated
  using (public.has_active_support_access(organization_id));

create trigger guest_rule_acceptances_prevent_reparent
  before update on public.guest_rule_acceptances
  for each row execute function public.prevent_tenant_reparent();

-- ---------------------------------------------------------------------------
-- Tenant consistency for guest rule acceptances
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
  elsif tg_table_name = 'guest_rule_acceptances' then
    if not exists (
      select 1 from public.reservations r
      where r.id = new.reservation_id
        and r.organization_id = new.organization_id
        and r.property_id = new.property_id
        and r.guest_id = new.guest_id
    ) then
      raise exception 'rule acceptance is not scoped to the reservation organization';
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

create trigger guest_rule_acceptances_same_organization
  before insert or update on public.guest_rule_acceptances
  for each row execute function public.enforce_same_organization();

-- ---------------------------------------------------------------------------
-- Shared snapshot builder (SECURITY DEFINER, not granted to clients)
-- ---------------------------------------------------------------------------

create or replace function public.property_cms_snapshot_for_audience(
  p_property_id uuid,
  p_audience text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_property public.properties%rowtype;
  v_visibilities text[];
begin
  if p_audience not in ('public', 'guest') then
    raise exception 'invalid content audience';
  end if;

  select * into v_property
  from public.properties
  where id = p_property_id;

  if not found then
    return null;
  end if;

  if p_audience = 'public' then
    v_visibilities := array['public'];
  else
    v_visibilities := array['public', 'guest'];
  end if;

  return jsonb_build_object(
    'id', v_property.id,
    'organizationId', v_property.organization_id,
    'name', v_property.name,
    'slug', v_property.slug,
    'propertyType', v_property.property_type,
    'address', v_property.address,
    'city', v_property.city,
    'country', v_property.country,
    'capacity', v_property.capacity,
    'bedrooms', v_property.bedrooms,
    'bathrooms', v_property.bathrooms,
    'checkInTime', v_property.check_in_time,
    'checkOutTime', v_property.check_out_time,
    'description', v_property.description,
    'status', v_property.status,
    'languages', coalesce((
      select jsonb_agg(pl.language_code order by pl.language_code)
      from public.property_languages pl
      where pl.property_id = v_property.id
        and pl.organization_id = v_property.organization_id
    ), '[]'::jsonb),
    'amenities', coalesce((
      select jsonb_agg(pa.amenity_key order by pa.sort_order, pa.amenity_key)
      from public.property_amenities pa
      where pa.property_id = v_property.id
        and pa.organization_id = v_property.organization_id
    ), '[]'::jsonb),
    'houseRules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ruleKey', phr.rule_key,
          'state', phr.state,
          'details', phr.details,
          'visibility', phr.visibility,
          'sortOrder', phr.sort_order
        )
        order by phr.sort_order, phr.rule_key
      )
      from public.property_house_rules phr
      where phr.property_id = v_property.id
        and phr.organization_id = v_property.organization_id
        and phr.visibility = any(v_visibilities)
    ), '[]'::jsonb),
    'content', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fieldKey', pc.field_key,
          'body', pc.body,
          'visibility', pc.visibility
        )
        order by pc.field_key
      )
      from public.property_content pc
      where pc.property_id = v_property.id
        and pc.organization_id = v_property.organization_id
        and pc.visibility = any(v_visibilities)
        and pc.field_key <> 'private_notes'
        and (
          p_audience = 'guest'
          or pc.field_key not in (
            'building_entry',
            'key_retrieval',
            'lockbox_instructions',
            'smart_lock_instructions',
            'reception_instructions'
          )
        )
    ), '[]'::jsonb),
    'knowledge', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pk.id,
          'title', pk.title,
          'category', pk.category,
          'body', pk.body,
          'locale', pk.locale,
          'status', pk.status,
          'visibility', pk.visibility,
          'sortOrder', pk.sort_order
        )
        order by pk.sort_order, pk.created_at
      )
      from public.property_knowledge pk
      where pk.property_id = v_property.id
        and pk.organization_id = v_property.organization_id
        and pk.status = 'published'
        and pk.visibility = any(v_visibilities)
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pm.id,
          'mediaType', pm.media_type,
          'role', pm.role,
          'storagePath', pm.storage_path,
          'externalUrl', pm.external_url,
          'sortOrder', pm.sort_order,
          'caption', pm.caption,
          'altText', pm.alt_text,
          'visibility', pm.visibility
        )
        order by pm.sort_order, pm.created_at
      )
      from public.property_media pm
      where pm.property_id = v_property.id
        and pm.organization_id = v_property.organization_id
        and pm.visibility = any(v_visibilities)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.property_cms_snapshot_for_audience(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public branding helper
-- ---------------------------------------------------------------------------

create or replace function public.public_operator_branding_json(p_organization public.organizations)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug', p_organization.slug,
    'name', p_organization.name,
    'displayName', coalesce(nullif(btrim(ob.display_name), ''), p_organization.name),
    'publicDescription', nullif(btrim(ob.public_description), ''),
    'logoPath', ob.logo_path,
    'primaryColor', ob.primary_color,
    'secondaryColor', ob.secondary_color,
    'accentColor', ob.accent_color
  )
  from public.organization_branding ob
  where ob.organization_id = p_organization.id
  union all
  select jsonb_build_object(
    'slug', p_organization.slug,
    'name', p_organization.name,
    'displayName', p_organization.name,
    'publicDescription', null,
    'logoPath', null,
    'primaryColor', null,
    'secondaryColor', null,
    'accentColor', null
  )
  where not exists (
    select 1 from public.organization_branding ob
    where ob.organization_id = p_organization.id
  )
  limit 1;
$$;

revoke all on function public.public_operator_branding_json(public.organizations)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public portfolio
-- ---------------------------------------------------------------------------

create or replace function public.get_public_operator_portfolio(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_org
  from public.organizations
  where slug = p_slug
    and status = 'active';

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'organization', public.public_operator_branding_json(v_org),
    'properties', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'slug', p.slug,
          'name', p.name,
          'city', p.city,
          'country', p.country,
          'capacity', p.capacity,
          'bedrooms', p.bedrooms,
          'bathrooms', p.bathrooms,
          'amenities', coalesce((
            select jsonb_agg(pa.amenity_key order by pa.sort_order)
            from public.property_amenities pa
            where pa.property_id = p.id
              and pa.organization_id = p.organization_id
          ), '[]'::jsonb),
          'heroMediaId', (
            select pm.id
            from public.property_media pm
            where pm.property_id = p.id
              and pm.organization_id = p.organization_id
              and pm.visibility = 'public'
              and pm.media_type = 'image'
              and pm.storage_path is not null
            order by case when pm.role = 'hero' then 0 else 1 end, pm.sort_order
            limit 1
          ),
          'hasVideo', exists (
            select 1
            from public.property_media pm
            where pm.property_id = p.id
              and pm.organization_id = p.organization_id
              and pm.visibility = 'public'
              and pm.media_type = 'video'
          ),
          'hasTour', exists (
            select 1
            from public.property_media pm
            where pm.property_id = p.id
              and pm.organization_id = p.organization_id
              and pm.visibility = 'public'
              and pm.media_type = 'tour_360'
          )
        )
        order by p.name
      )
      from public.properties p
      where p.organization_id = v_org.id
        and p.status = 'active'
        and p.is_listed_publicly = true
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_public_operator_portfolio(text)
  from public;
grant execute on function public.get_public_operator_portfolio(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public property showcase
-- ---------------------------------------------------------------------------

create or replace function public.get_public_property_showcase(
  p_org_slug text,
  p_property_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_property public.properties%rowtype;
begin
  if p_org_slug is null or p_org_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_property_slug is null or p_property_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return jsonb_build_object('status', 'org_not_found');
  end if;

  select * into v_org
  from public.organizations
  where slug = p_org_slug
    and status = 'active';

  if not found then
    return jsonb_build_object('status', 'org_not_found');
  end if;

  select * into v_property
  from public.properties
  where organization_id = v_org.id
    and slug = p_property_slug;

  if not found then
    return jsonb_build_object('status', 'property_not_found');
  end if;

  if v_property.status <> 'active' or not v_property.is_listed_publicly then
    return jsonb_build_object('status', 'not_public');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'organization', public.public_operator_branding_json(v_org),
    'bookingUrl', v_property.booking_url,
    'snapshot', public.property_cms_snapshot_for_audience(v_property.id, 'public')
  );
end;
$$;

revoke all on function public.get_public_property_showcase(text, text)
  from public;
grant execute on function public.get_public_property_showcase(text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public media / logo authorization (path only; app signs after validation)
-- ---------------------------------------------------------------------------

create or replace function public.authorize_public_property_media(
  p_org_slug text,
  p_property_slug text,
  p_media_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if p_org_slug is null or p_property_slug is null or p_media_id is null then
    return null;
  end if;

  select pm.storage_path into v_path
  from public.property_media pm
  join public.properties p
    on p.id = pm.property_id
   and p.organization_id = pm.organization_id
  join public.organizations o
    on o.id = p.organization_id
  where o.slug = p_org_slug
    and o.status = 'active'
    and p.slug = p_property_slug
    and p.status = 'active'
    and p.is_listed_publicly = true
    and pm.id = p_media_id
    and pm.visibility = 'public'
    and pm.media_type = 'image'
    and pm.storage_path is not null;

  return v_path;
end;
$$;

revoke all on function public.authorize_public_property_media(text, text, uuid)
  from public;
grant execute on function public.authorize_public_property_media(text, text, uuid)
  to anon, authenticated;

create or replace function public.authorize_public_operator_logo(p_slug text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if p_slug is null then
    return null;
  end if;

  select ob.logo_path into v_path
  from public.organizations o
  join public.organization_branding ob
    on ob.organization_id = o.id
  where o.slug = p_slug
    and o.status = 'active'
    and ob.logo_path is not null;

  return v_path;
end;
$$;

revoke all on function public.authorize_public_operator_logo(text)
  from public;
grant execute on function public.authorize_public_operator_logo(text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public / guest product events
-- ---------------------------------------------------------------------------

create or replace function public.record_public_event(
  p_event_type text,
  p_org_slug text,
  p_property_slug text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_property_id uuid;
begin
  if p_event_type not in (
    'public_operator_viewed',
    'public_property_viewed',
    'public_property_media_viewed',
    'public_booking_cta_clicked'
  ) then
    return;
  end if;

  select * into v_org
  from public.organizations
  where slug = p_org_slug
    and status = 'active';

  if not found then
    return;
  end if;

  if p_property_slug is not null then
    select p.id into v_property_id
    from public.properties p
    where p.organization_id = v_org.id
      and p.slug = p_property_slug
      and p.status = 'active'
      and p.is_listed_publicly = true;
  end if;

  insert into public.events (
    organization_id,
    property_id,
    event_type,
    metadata
  ) values (
    v_org.id,
    v_property_id,
    p_event_type,
    coalesce(p_metadata, '{}'::jsonb) - 'token' - 'guestToken' - 'rawToken'
  );
end;
$$;

revoke all on function public.record_public_event(text, text, text, jsonb)
  from public;
grant execute on function public.record_public_event(text, text, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest token inspect (service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.inspect_guest_portal_token(p_token_hash text)
returns table (
  status text,
  token_id uuid,
  organization_id uuid,
  reservation_id uuid,
  property_id uuid,
  guest_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
  select
    case
      when t.revoked_at is not null then 'revoked'
      when t.expires_at is not null and t.expires_at <= now() then 'expired'
      when r.id is null or r.status = 'cancelled' or p.id is null then 'unavailable'
      else 'valid'
    end,
    t.id,
    t.organization_id,
    t.reservation_id,
    t.property_id,
    r.guest_id
  from public.guest_portal_tokens t
  left join public.reservations r
    on r.id = t.reservation_id
   and r.organization_id = t.organization_id
  left join public.properties p
    on p.id = t.property_id
   and p.organization_id = t.organization_id
  where t.token_hash = p_token_hash
  limit 1;
end;
$$;

revoke all on function public.inspect_guest_portal_token(text)
  from public, anon, authenticated;
grant execute on function public.inspect_guest_portal_token(text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Guest stay bundle
-- ---------------------------------------------------------------------------

create or replace function public.get_guest_stay_bundle(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inspect record;
  v_org public.organizations%rowtype;
  v_reservation public.reservations%rowtype;
  v_guest public.guests%rowtype;
begin
  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_inspect.status <> 'valid' then
    return jsonb_build_object('status', v_inspect.status);
  end if;

  select * into v_org from public.organizations where id = v_inspect.organization_id;
  select * into v_reservation from public.reservations where id = v_inspect.reservation_id;
  select * into v_guest from public.guests where id = v_inspect.guest_id;

  if v_org.id is null or v_reservation.id is null or v_guest.id is null then
    return jsonb_build_object('status', 'unavailable');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'organization', public.public_operator_branding_json(v_org),
    'guest', jsonb_build_object(
      'firstName', v_guest.first_name,
      'lastName', v_guest.last_name,
      'email', v_guest.email,
      'phone', v_guest.phone
    ),
    'reservation', jsonb_build_object(
      'checkIn', v_reservation.check_in,
      'checkOut', v_reservation.check_out,
      'status', v_reservation.status,
      'numberOfGuests', v_reservation.number_of_guests,
      'journeyStatus', v_reservation.journey_status,
      'onboardingCompletedAt', v_reservation.onboarding_completed_at,
      'rulesAcceptedAt', v_reservation.rules_accepted_at,
      'rulesAcceptedVersion', v_reservation.rules_accepted_version,
      'checkoutCompletedAt', v_reservation.checkout_completed_at,
      'arrivalNotes', v_reservation.arrival_notes
    ),
    'snapshot', public.property_cms_snapshot_for_audience(v_inspect.property_id, 'guest'),
    'issues', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category', i.category,
          'description', i.description,
          'status', i.status,
          'priority', i.priority,
          'createdAt', i.created_at
        )
        order by i.created_at desc
      )
      from public.issues i
      where i.reservation_id = v_reservation.id
        and i.organization_id = v_reservation.organization_id
        and i.guest_id = v_guest.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_guest_stay_bundle(text)
  from public, anon, authenticated;
grant execute on function public.get_guest_stay_bundle(text)
  to service_role;

create or replace function public.authorize_guest_property_media(
  p_token_hash text,
  p_media_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inspect record;
  v_path text;
begin
  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found or v_inspect.status <> 'valid' or p_media_id is null then
    return null;
  end if;

  select pm.storage_path into v_path
  from public.property_media pm
  where pm.id = p_media_id
    and pm.property_id = v_inspect.property_id
    and pm.organization_id = v_inspect.organization_id
    and pm.visibility in ('public', 'guest')
    and pm.media_type = 'image'
    and pm.storage_path is not null;

  return v_path;
end;
$$;

revoke all on function public.authorize_guest_property_media(text, uuid)
  from public, anon, authenticated;
grant execute on function public.authorize_guest_property_media(text, uuid)
  to service_role;

create or replace function public.record_guest_event(
  p_token_hash text,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspect record;
begin
  if p_event_type not in (
    'guest_portal_opened',
    'guest_onboarding_started',
    'guest_onboarding_completed',
    'guest_rules_viewed',
    'guest_rules_accepted',
    'guest_knowledge_viewed',
    'guest_access_viewed',
    'guest_issue_created',
    'guest_checkout_started',
    'guest_checkout_completed'
  ) then
    return;
  end if;

  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found or v_inspect.status <> 'valid' then
    return;
  end if;

  insert into public.events (
    organization_id,
    property_id,
    reservation_id,
    guest_id,
    event_type,
    metadata
  ) values (
    v_inspect.organization_id,
    v_inspect.property_id,
    v_inspect.reservation_id,
    v_inspect.guest_id,
    p_event_type,
    coalesce(p_metadata, '{}'::jsonb) - 'token' - 'guestToken' - 'rawToken'
  );
end;
$$;

revoke all on function public.record_guest_event(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_guest_event(text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Guest mutations (token hash only; never accept tenant IDs)
-- ---------------------------------------------------------------------------

create or replace function public.guest_advance_journey(
  p_reservation_id uuid,
  p_target text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_onboarded boolean;
  v_rules boolean;
  v_checked_out boolean;
  v_next text;
begin
  select
    journey_status,
    onboarding_completed_at is not null,
    rules_accepted_at is not null,
    checkout_completed_at is not null
  into v_current, v_onboarded, v_rules, v_checked_out
  from public.reservations
  where id = p_reservation_id;

  if v_checked_out or v_current = 'checked_out' or p_target = 'checked_out' then
    v_next := 'checked_out';
  elsif v_onboarded and v_rules then
    v_next := 'complete';
  elsif v_current = 'needs_attention' then
    v_next := 'needs_attention';
  elsif v_onboarded or v_rules or p_target = 'in_progress' then
    v_next := 'in_progress';
  else
    v_next := coalesce(v_current, 'not_started');
  end if;

  update public.reservations
  set journey_status = v_next
  where id = p_reservation_id;
end;
$$;

revoke all on function public.guest_advance_journey(uuid, text)
  from public, anon, authenticated;

create or replace function public.guest_update_onboarding(
  p_token_hash text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_number_of_guests integer,
  p_arrival_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspect record;
begin
  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_inspect.status <> 'valid' then
    return jsonb_build_object('status', v_inspect.status);
  end if;

  if p_first_name is null or btrim(p_first_name) = '' or char_length(btrim(p_first_name)) > 80
     or p_last_name is null or btrim(p_last_name) = '' or char_length(btrim(p_last_name)) > 80
     or p_number_of_guests is null or p_number_of_guests < 1 or p_number_of_guests > 50 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_email is not null and (
    char_length(p_email) > 160
    or p_email !~ '^[^@]+@[^@]+\.[^@]+$'
  ) then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_phone is not null and char_length(p_phone) > 40 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_arrival_notes is not null and char_length(p_arrival_notes) > 2000 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  update public.guests
  set
    first_name = btrim(p_first_name),
    last_name = btrim(p_last_name),
    email = nullif(lower(btrim(p_email)), ''),
    phone = nullif(btrim(p_phone), '')
  where id = v_inspect.guest_id
    and organization_id = v_inspect.organization_id;

  update public.reservations
  set
    number_of_guests = p_number_of_guests,
    arrival_notes = nullif(btrim(p_arrival_notes), ''),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_inspect.reservation_id
    and organization_id = v_inspect.organization_id;

  perform public.guest_advance_journey(v_inspect.reservation_id, 'in_progress');

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.guest_update_onboarding(text, text, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.guest_update_onboarding(text, text, text, text, text, integer, text)
  to service_role;

create or replace function public.guest_accept_rules(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspect record;
  v_snapshot jsonb;
  v_version text;
begin
  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_inspect.status <> 'valid' then
    return jsonb_build_object('status', v_inspect.status);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'ruleKey', phr.rule_key,
      'state', phr.state,
      'details', phr.details,
      'visibility', phr.visibility
    )
    order by phr.sort_order, phr.rule_key
  ), '[]'::jsonb)
  into v_snapshot
  from public.property_house_rules phr
  where phr.property_id = v_inspect.property_id
    and phr.organization_id = v_inspect.organization_id
    and phr.visibility in ('public', 'guest');

  v_version := encode(sha256(convert_to(v_snapshot::text, 'UTF8')), 'hex');

  insert into public.guest_rule_acceptances (
    organization_id,
    property_id,
    reservation_id,
    guest_id,
    rules_version,
    rules_snapshot
  ) values (
    v_inspect.organization_id,
    v_inspect.property_id,
    v_inspect.reservation_id,
    v_inspect.guest_id,
    v_version,
    v_snapshot
  )
  on conflict (reservation_id) do update
    set
      rules_version = excluded.rules_version,
      rules_snapshot = excluded.rules_snapshot,
      accepted_at = now();

  update public.reservations
  set
    rules_accepted_at = coalesce(rules_accepted_at, now()),
    rules_accepted_version = v_version
  where id = v_inspect.reservation_id
    and organization_id = v_inspect.organization_id;

  perform public.guest_advance_journey(v_inspect.reservation_id, 'complete');

  return jsonb_build_object('status', 'ok', 'rulesVersion', v_version);
end;
$$;

revoke all on function public.guest_accept_rules(text)
  from public, anon, authenticated;
grant execute on function public.guest_accept_rules(text)
  to service_role;

create or replace function public.guest_create_issue(
  p_token_hash text,
  p_category text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspect record;
begin
  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_inspect.status <> 'valid' then
    return jsonb_build_object('status', v_inspect.status);
  end if;

  if p_category not in (
    'access_problem',
    'wifi',
    'hot_water',
    'air_conditioning',
    'cleaning',
    'something_broken',
    'other'
  ) then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  if p_description is null
     or char_length(btrim(p_description)) < 3
     or char_length(btrim(p_description)) > 2000 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  insert into public.issues (
    organization_id,
    property_id,
    reservation_id,
    guest_id,
    category,
    description,
    priority,
    status
  ) values (
    v_inspect.organization_id,
    v_inspect.property_id,
    v_inspect.reservation_id,
    v_inspect.guest_id,
    p_category,
    btrim(p_description),
    'medium',
    'open'
  );

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.guest_create_issue(text, text, text)
  from public, anon, authenticated;
grant execute on function public.guest_create_issue(text, text, text)
  to service_role;

create or replace function public.guest_complete_checkout(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspect record;
begin
  select * into v_inspect
  from public.inspect_guest_portal_token(p_token_hash);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_inspect.status <> 'valid' then
    return jsonb_build_object('status', v_inspect.status);
  end if;

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

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.guest_complete_checkout(text)
  from public, anon, authenticated;
grant execute on function public.guest_complete_checkout(text)
  to service_role;
