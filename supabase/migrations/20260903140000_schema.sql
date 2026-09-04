-- Canonical Onwarda identity, tenancy, and operational schema.
-- organization.id is the only tenant identity. Slugs are routing identifiers.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admins_role_check check (role in ('super_admin')),
  constraint platform_admins_status_check check (status in ('active', 'suspended'))
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text,
  status text not null default 'pending',
  subscription_status text not null default 'none',
  onboarding_status text not null default 'not_started',
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  website text,
  phone text,
  country text,
  timezone text,
  default_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_status_check
    check (status in ('active', 'suspended', 'pending', 'archived')),
  constraint organizations_subscription_status_check
    check (subscription_status in ('none', 'trial', 'active', 'past_due', 'cancelled')),
  constraint organizations_onboarding_status_check
    check (onboarding_status in ('not_started', 'in_progress', 'complete', 'needs_attention')),
  constraint organizations_default_language_check
    check (default_language in ('en', 'fr', 'ar')),
  constraint organizations_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_users_role_check
    check (role in ('owner', 'admin', 'manager', 'staff')),
  constraint organization_users_status_check
    check (status in ('active', 'invited', 'suspended')),
  constraint organization_users_unique_membership unique (organization_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Hospitality
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  slug text not null,
  internal_identifier text,
  description text,
  property_type text,
  address text,
  city text,
  country text,
  latitude numeric,
  longitude numeric,
  capacity integer,
  bedrooms integer,
  bathrooms numeric,
  check_in_time time,
  check_out_time time,
  timezone text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_status_check
    check (status in ('draft', 'active', 'inactive', 'archived')),
  constraint properties_unique_slug unique (organization_id, slug)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  nationality text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index guests_organization_email_unique
  on public.guests (organization_id, lower(email))
  where email is not null;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete restrict,
  guest_id uuid not null references public.guests (id) on delete restrict,
  reservation_reference text not null,
  booking_source text not null,
  check_in date not null,
  check_out date not null,
  number_of_guests integer not null default 1,
  notes text,
  status text not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_booking_source_check
    check (booking_source in ('airbnb', 'booking_com', 'direct', 'other')),
  constraint reservations_status_check
    check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  constraint reservations_dates_check check (check_out > check_in),
  constraint reservations_guest_count_check check (number_of_guests >= 1),
  constraint reservations_unique_reference unique (organization_id, reservation_reference)
);

create table public.guest_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete restrict,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_portal_tokens_hash_format_check
    check (token_hash ~ '^[0-9a-f]{64}$')
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid references public.properties (id) on delete restrict,
  reservation_id uuid references public.reservations (id) on delete restrict,
  guest_id uuid references public.guests (id) on delete restrict,
  category text not null,
  description text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint issues_category_check
    check (category in (
      'access_problem',
      'wifi',
      'hot_water',
      'air_conditioning',
      'cleaning',
      'something_broken',
      'other'
    )),
  constraint issues_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint issues_status_check
    check (status in ('open', 'in_progress', 'resolved'))
);

create table public.property_knowledge (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  property_id uuid not null references public.properties (id) on delete cascade,
  category text not null,
  title text,
  body text not null,
  locale text not null default 'en',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_knowledge_category_check
    check (category in (
      'house_rules',
      'check_in',
      'check_out',
      'wifi',
      'access',
      'faq',
      'tutorial',
      'other'
    )),
  constraint property_knowledge_locale_check
    check (locale in ('en', 'fr', 'ar')),
  constraint property_knowledge_status_check
    check (status in ('draft', 'published', 'archived'))
);

create unique index property_knowledge_unique_published
  on public.property_knowledge (property_id, category, locale)
  where status <> 'archived';

-- ---------------------------------------------------------------------------
-- Activity
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete restrict,
  property_id uuid references public.properties (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_type text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  organization_id uuid references public.organizations (id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_type_check
    check (actor_type in ('platform_admin', 'organization_user', 'guest', 'system'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index profiles_email_idx on public.profiles (email);
create index platform_admins_status_idx on public.platform_admins (status);
create index organizations_status_created_idx on public.organizations (status, created_at desc);
create index organization_users_user_status_idx
  on public.organization_users (user_id, status);
create index organization_users_organization_id_idx
  on public.organization_users (organization_id);
create index properties_organization_status_idx
  on public.properties (organization_id, status);
create index guests_organization_id_idx on public.guests (organization_id);
create index reservations_organization_dates_idx
  on public.reservations (organization_id, check_in, check_out);
create index reservations_property_id_idx on public.reservations (property_id);
create index reservations_guest_id_idx on public.reservations (guest_id);
create index guest_portal_tokens_reservation_id_idx
  on public.guest_portal_tokens (reservation_id);
create index guest_portal_tokens_organization_id_idx
  on public.guest_portal_tokens (organization_id);
create index guest_portal_tokens_active_expiry_idx
  on public.guest_portal_tokens (expires_at)
  where revoked_at is null;
create index issues_organization_status_idx on public.issues (organization_id, status);
create index issues_property_id_idx on public.issues (property_id);
create index property_knowledge_property_id_idx
  on public.property_knowledge (property_id);
create index property_knowledge_organization_id_idx
  on public.property_knowledge (organization_id);
create index events_organization_created_idx
  on public.events (organization_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger platform_admins_set_updated_at
  before update on public.platform_admins
  for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger organization_users_set_updated_at
  before update on public.organization_users
  for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

create trigger guests_set_updated_at
  before update on public.guests
  for each row execute function public.set_updated_at();

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

create trigger guest_portal_tokens_set_updated_at
  before update on public.guest_portal_tokens
  for each row execute function public.set_updated_at();

create trigger issues_set_updated_at
  before update on public.issues
  for each row execute function public.set_updated_at();

create trigger property_knowledge_set_updated_at
  before update on public.property_knowledge
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant consistency (prevents cross-tenant foreign keys)
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
  elsif tg_table_name = 'issues' then
    if new.property_id is not null and not exists (
      select 1 from public.properties p
      where p.id = new.property_id and p.organization_id = new.organization_id
    ) then
      raise exception 'issue property does not belong to the organization';
    end if;

    if new.reservation_id is not null and not exists (
      select 1 from public.reservations r
      where r.id = new.reservation_id and r.organization_id = new.organization_id
    ) then
      raise exception 'issue reservation does not belong to the organization';
    end if;

    if new.guest_id is not null and not exists (
      select 1 from public.guests g
      where g.id = new.guest_id and g.organization_id = new.organization_id
    ) then
      raise exception 'issue guest does not belong to the organization';
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

revoke all on function public.enforce_same_organization() from public;

create trigger reservations_same_organization
  before insert or update on public.reservations
  for each row execute function public.enforce_same_organization();

create trigger guest_portal_tokens_same_organization
  before insert or update on public.guest_portal_tokens
  for each row execute function public.enforce_same_organization();

create trigger issues_same_organization
  before insert or update on public.issues
  for each row execute function public.enforce_same_organization();

create trigger property_knowledge_same_organization
  before insert or update on public.property_knowledge
  for each row execute function public.enforce_same_organization();

-- ---------------------------------------------------------------------------
-- Profile provisioning from Auth
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
