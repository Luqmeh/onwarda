import { randomUUID } from "node:crypto";

import type { Client } from "pg";

import { hashGuestPortalToken } from "@/lib/guest-portal/tokens";

export type RlsFixture = {
  orgA: string;
  orgB: string;
  userA: string;
  userB: string;
  staffA: string;
  invitedA: string;
  suspendedA: string;
  platformAdmin: string;
  propertyA: string;
  propertyB: string;
  guestA: string;
  guestB: string;
  reservationA: string;
  reservationB: string;
  issueA: string;
  issueB: string;
  knowledgeA: string;
  knowledgeB: string;
  tokenA: { raw: string; hash: string };
  tokenB: { raw: string; hash: string };
  expiredTokenA: { raw: string; hash: string };
  revokedTokenA: { raw: string; hash: string };
};

export async function insertAuthUser(client: Client, email: string) {
  const id = randomUUID();

  await client.query(
    `
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        $1,
        'authenticated',
        'authenticated',
        $2,
        crypt('test-password-123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now(),
        '',
        '',
        '',
        ''
      )
    `,
    [id, email],
  );

  return id;
}

export async function seedRlsFixture(client: Client): Promise<RlsFixture> {
  await client.query(`
    delete from public.audit_logs;
    delete from public.events;
    delete from public.commercial_inquiries;
    delete from public.support_sessions;
    delete from public.cleaning_task_items;
    delete from public.cleaning_tasks;
    delete from public.property_cleaning_agents;
    delete from public.cleaning_agent_links;
    delete from public.cleaning_agents;
    delete from public.organization_subscription_events;
    delete from public.organization_subscriptions;
    delete from public.guest_rule_acceptances;
    delete from public.guest_portal_tokens;
    delete from public.issues;
    delete from public.property_knowledge;
    delete from public.property_media where true;
    delete from public.property_content where true;
    delete from public.property_house_rules where true;
    delete from public.property_amenities where true;
    delete from public.property_languages where true;
    delete from public.reservations;
    delete from public.guests;
    delete from public.properties;
    delete from public.organization_users;
    delete from public.platform_admins;
    delete from public.organization_branding;
    delete from public.organizations;
    delete from public.profiles
      where email like '%@onwarda-rls.test';
    delete from auth.users
      where email like '%@onwarda-rls.test';
  `);

  const userA = await insertAuthUser(client, "user-a@onwarda-rls.test");
  const userB = await insertAuthUser(client, "user-b@onwarda-rls.test");
  const staffA = await insertAuthUser(client, "staff-a@onwarda-rls.test");
  const invitedA = await insertAuthUser(client, "invited-a@onwarda-rls.test");
  const suspendedA = await insertAuthUser(
    client,
    "suspended-a@onwarda-rls.test",
  );
  const platformAdmin = await insertAuthUser(
    client,
    "platform-admin@onwarda-rls.test",
  );

  const orgA = randomUUID();
  const orgB = randomUUID();

  await client.query(
    `
      insert into public.organizations (
        id, name, slug, status, subscription_status, onboarding_status
      ) values
        ($1, 'Riad Atlas', 'riad-atlas', 'active', 'trial', 'in_progress'),
        ($2, 'Luxury Villas', 'luxury-villas', 'active', 'active', 'complete')
    `,
    [orgA, orgB],
  );

  await client.query(
    `
      insert into public.organization_users (
        organization_id, user_id, role, status
      ) values
        ($1, $3, 'owner', 'active'),
        ($2, $4, 'owner', 'active'),
        ($1, $5, 'staff', 'active'),
        ($1, $6, 'manager', 'invited'),
        ($1, $7, 'staff', 'suspended')
    `,
    [orgA, orgB, userA, userB, staffA, invitedA, suspendedA],
  );

  await client.query(
    `
      insert into public.platform_admins (user_id, role, status)
      values ($1, 'super_admin', 'active')
    `,
    [platformAdmin],
  );

  const propertyA = randomUUID();
  const propertyB = randomUUID();

  await client.query(
    `
      insert into public.properties (
        id, organization_id, name, slug, status, city, country,
        capacity, bedrooms, bathrooms, is_listed_publicly, booking_url
      ) values
        ($1, $3, 'Riad Suite', 'riad-suite', 'active', 'Marrakech', 'Morocco', 4, 2, 2, true, 'https://example.com/book-atlas'),
        ($2, $4, 'Villa One', 'villa-one', 'active', 'Lisbon', 'Portugal', 6, 3, 3, true, 'https://example.com/book-villa')
    `,
    [propertyA, propertyB, orgA, orgB],
  );

  const guestA = randomUUID();
  const guestB = randomUUID();

  await client.query(
    `
      insert into public.guests (
        id, organization_id, first_name, last_name, email
      ) values
        ($1, $3, 'Amelia', 'Guest', 'amelia@onwarda-rls.test'),
        ($2, $4, 'Noah', 'Guest', 'noah@onwarda-rls.test')
    `,
    [guestA, guestB, orgA, orgB],
  );

  const reservationA = randomUUID();
  const reservationB = randomUUID();

  await client.query(
    `
      insert into public.reservations (
        id, organization_id, property_id, guest_id,
        reservation_reference, booking_source, check_in, check_out, status
      ) values
        ($1, $5, $3, $7, 'RA-100', 'direct', current_date + 7, current_date + 10, 'upcoming'),
        ($2, $6, $4, $8, 'LV-200', 'airbnb', current_date + 3, current_date + 6, 'upcoming')
    `,
    [
      reservationA,
      reservationB,
      propertyA,
      propertyB,
      orgA,
      orgB,
      guestA,
      guestB,
    ],
  );

  const issueA = randomUUID();
  const issueB = randomUUID();

  await client.query(
    `
      insert into public.issues (
        id, organization_id, property_id, reservation_id, guest_id,
        category, description, priority, status
      ) values
        ($1, $3, $5, $7, $9, 'wifi', 'Wifi is slow', 'medium', 'open'),
        ($2, $4, $6, $8, $10, 'cleaning', 'Needs extra towels', 'low', 'open')
    `,
    [
      issueA,
      issueB,
      orgA,
      orgB,
      propertyA,
      propertyB,
      reservationA,
      reservationB,
      guestA,
      guestB,
    ],
  );

  const knowledgeA = randomUUID();
  const knowledgeB = randomUUID();

  await client.query(
    `
      insert into public.property_knowledge (
        id, organization_id, property_id, category, title, body, locale, status
      ) values
        ($1, $3, $5, 'wifi', 'Wifi', 'atlas-wifi', 'en', 'published'),
        ($2, $4, $6, 'wifi', 'Wifi', 'villa-wifi', 'en', 'published')
    `,
    [knowledgeA, knowledgeB, orgA, orgB, propertyA, propertyB],
  );

  const tokenA = {
    raw: "a".repeat(32) + "tokenAvalidvalue____",
    hash: hashGuestPortalToken("a".repeat(32) + "tokenAvalidvalue____"),
  };
  const tokenB = {
    raw: "b".repeat(32) + "tokenBvalidvalue____",
    hash: hashGuestPortalToken("b".repeat(32) + "tokenBvalidvalue____"),
  };
  const expiredTokenA = {
    raw: "e".repeat(32) + "expiredtokenvalue___",
    hash: hashGuestPortalToken("e".repeat(32) + "expiredtokenvalue___"),
  };
  const revokedTokenA = {
    raw: "r".repeat(32) + "revokedtokenvalue___",
    hash: hashGuestPortalToken("r".repeat(32) + "revokedtokenvalue___"),
  };

  await client.query(
    `
      insert into public.guest_portal_tokens (
        organization_id, reservation_id, property_id, token_hash, expires_at, revoked_at
      ) values
        ($1, $3, $5, $7, now() + interval '7 days', null),
        ($2, $4, $6, $8, now() + interval '7 days', null),
        ($1, $3, $5, $9, now() - interval '1 day', null),
        ($1, $3, $5, $10, now() + interval '7 days', now())
    `,
    [
      orgA,
      orgB,
      reservationA,
      reservationB,
      propertyA,
      propertyB,
      tokenA.hash,
      tokenB.hash,
      expiredTokenA.hash,
      revokedTokenA.hash,
    ],
  );

  await client.query(
    `
      insert into public.events (organization_id, property_id, event_type)
      values
        ($1, $3, 'property_created'),
        ($2, $4, 'property_created')
    `,
    [orgA, orgB, propertyA, propertyB],
  );

  await client.query(
    `
      insert into public.audit_logs (
        actor_user_id, actor_type, action, target_type, target_id, organization_id
      ) values
        ($1, 'platform_admin', 'organization.created', 'organization', $2, $2)
    `,
    [platformAdmin, orgA],
  );

  return {
    orgA,
    orgB,
    userA,
    userB,
    staffA,
    invitedA,
    suspendedA,
    platformAdmin,
    propertyA,
    propertyB,
    guestA,
    guestB,
    reservationA,
    reservationB,
    issueA,
    issueB,
    knowledgeA,
    knowledgeB,
    tokenA,
    tokenB,
    expiredTokenA,
    revokedTokenA,
  };
}
