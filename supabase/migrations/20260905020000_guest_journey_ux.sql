-- Guest journey UX: keep existing reservation timestamps as the source of truth.
-- Align mutations with data-driven required steps (rules only when they exist).

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
  v_arrival boolean;
  v_property_id uuid;
  v_organization_id uuid;
  v_rules_required boolean;
  v_rules_done boolean;
  v_next text;
begin
  select
    r.journey_status,
    r.onboarding_completed_at is not null,
    r.rules_accepted_at is not null,
    r.checkout_completed_at is not null,
    r.arrival_notes is not null and btrim(r.arrival_notes) <> '',
    r.property_id,
    r.organization_id
  into
    v_current,
    v_onboarded,
    v_rules,
    v_checked_out,
    v_arrival,
    v_property_id,
    v_organization_id
  from public.reservations r
  where r.id = p_reservation_id;

  if not found then
    return;
  end if;

  select exists (
    select 1
    from public.property_house_rules phr
    where phr.property_id = v_property_id
      and phr.organization_id = v_organization_id
      and phr.visibility in ('public', 'guest')
  ) into v_rules_required;

  v_rules_done := (not coalesce(v_rules_required, false)) or v_rules;

  if v_checked_out or v_current = 'checked_out' or p_target = 'checked_out' then
    v_next := 'checked_out';
  elsif v_current = 'needs_attention' then
    v_next := 'needs_attention';
  elsif v_onboarded and v_rules_done and v_arrival then
    v_next := 'complete';
  elsif v_onboarded or v_rules or v_arrival or p_target = 'in_progress' then
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
    arrival_notes = case
      when p_arrival_notes is null then arrival_notes
      else nullif(btrim(p_arrival_notes), '')
    end,
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

create or replace function public.guest_update_arrival_notes(
  p_token_hash text,
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

  if p_arrival_notes is null
     or btrim(p_arrival_notes) = ''
     or char_length(btrim(p_arrival_notes)) > 2000 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  update public.reservations
  set arrival_notes = btrim(p_arrival_notes)
  where id = v_inspect.reservation_id
    and organization_id = v_inspect.organization_id;

  perform public.guest_advance_journey(v_inspect.reservation_id, 'in_progress');

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.guest_update_arrival_notes(text, text)
  from public, anon, authenticated;
grant execute on function public.guest_update_arrival_notes(text, text)
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

  if v_snapshot is null or jsonb_array_length(v_snapshot) = 0 then
    return jsonb_build_object('status', 'not_applicable');
  end if;

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

  update public.reservations
  set journey_status = 'needs_attention'
  where id = v_inspect.reservation_id
    and organization_id = v_inspect.organization_id
    and journey_status is distinct from 'checked_out';

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.guest_create_issue(text, text, text)
  from public, anon, authenticated;
grant execute on function public.guest_create_issue(text, text, text)
  to service_role;
