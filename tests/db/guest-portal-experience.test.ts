import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { hashGuestPortalToken } from "@/lib/guest-portal/tokens";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);

  await client.query(
    `
      insert into public.property_content (
        organization_id, property_id, field_key, body, visibility
      ) values
        ($1, $2, 'lockbox_instructions', 'Guest lockbox 2222', 'guest'),
        ($1, $2, 'private_notes', 'Never for guests', 'private')
      on conflict do nothing
    `,
    [fixture.orgA, fixture.propertyA],
  );

  await client.query(
    `
      update public.property_knowledge
      set visibility = 'guest'
      where id = $1
    `,
    [fixture.knowledgeA],
  );
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("guest portal token isolation", () => {
  it("lets a valid token see only its reservation stay", async () => {
    const result = await client.query<{ get_guest_stay_bundle: Record<string, unknown> }>(
      "select public.get_guest_stay_bundle($1)",
      [fixture.tokenA.hash],
    );
    const payload = result.rows[0]?.get_guest_stay_bundle;
    const serialized = JSON.stringify(payload);

    expect(payload?.status).toBe("ok");
    expect(serialized).toContain("Amelia");
    expect(serialized).toContain("Guest lockbox 2222");
    expect(serialized).not.toContain("Noah");
    expect(serialized).not.toContain("villa-wifi");
    expect(serialized).not.toContain(fixture.reservationB);
    expect(serialized).not.toContain("Never for guests");
  });

  it("does not let token A open reservation B or property B", async () => {
    const bundleA = await client.query<{ get_guest_stay_bundle: Record<string, unknown> }>(
      "select public.get_guest_stay_bundle($1)",
      [fixture.tokenA.hash],
    );
    const bundleB = await client.query<{ get_guest_stay_bundle: Record<string, unknown> }>(
      "select public.get_guest_stay_bundle($1)",
      [fixture.tokenB.hash],
    );

    expect(JSON.stringify(bundleA.rows[0]?.get_guest_stay_bundle)).not.toContain("Villa One");
    expect(JSON.stringify(bundleB.rows[0]?.get_guest_stay_bundle)).not.toContain("Riad Suite");
    expect(JSON.stringify(bundleA.rows[0]?.get_guest_stay_bundle)).not.toContain(fixture.propertyB);
  });

  it("rejects invalid, expired, and revoked tokens with distinct known-hash states", async () => {
    const invalid = await client.query(
      "select status from public.inspect_guest_portal_token($1)",
      [hashGuestPortalToken("z".repeat(40))],
    );
    const expired = await client.query(
      "select status from public.inspect_guest_portal_token($1)",
      [fixture.expiredTokenA.hash],
    );
    const revoked = await client.query(
      "select status from public.inspect_guest_portal_token($1)",
      [fixture.revokedTokenA.hash],
    );

    expect(invalid.rowCount).toBe(0);
    expect(expired.rows[0]?.status).toBe("expired");
    expect(revoked.rows[0]?.status).toBe("revoked");
  });

  it("derives issue, onboarding, and checkout from the token, not client IDs", async () => {
    const issue = await client.query<{ guest_create_issue: Record<string, unknown> }>(
      "select public.guest_create_issue($1, $2, $3)",
      [fixture.tokenA.hash, "wifi", "Guest wifi outage"],
    );
    expect(issue.rows[0]?.guest_create_issue.status).toBe("ok");

    const stolen = await client.query(
      `
        select id, organization_id, reservation_id, property_id
        from public.issues
        where description = 'Guest wifi outage'
      `,
    );
    expect(stolen.rows[0]?.organization_id).toBe(fixture.orgA);
    expect(stolen.rows[0]?.reservation_id).toBe(fixture.reservationA);
    expect(stolen.rows[0]?.property_id).toBe(fixture.propertyA);
    expect(stolen.rows[0]?.reservation_id).not.toBe(fixture.reservationB);

    const onboarding = await client.query<{ guest_update_onboarding: Record<string, unknown> }>(
      "select public.guest_update_onboarding($1, $2, $3, $4, $5, $6, $7)",
      [fixture.tokenA.hash, "Amelia", "Guest", "amelia@onwarda-rls.test", "+100", 3, "Late taxi"],
    );
    expect(onboarding.rows[0]?.guest_update_onboarding.status).toBe("ok");

    const guest = await client.query<{ first_name: string; phone: string }>(
      "select first_name, phone from public.guests where id = $1",
      [fixture.guestA],
    );
    expect(guest.rows[0]?.phone).toBe("+100");

    const otherGuest = await client.query<{ phone: string | null }>(
      "select phone from public.guests where id = $1",
      [fixture.guestB],
    );
    expect(otherGuest.rows[0]?.phone).toBeNull();

    const checkout = await client.query<{ guest_complete_checkout: Record<string, unknown> }>(
      "select public.guest_complete_checkout($1)",
      [fixture.tokenA.hash],
    );
    expect(checkout.rows[0]?.guest_complete_checkout.status).toBe("ok");

    const reservation = await client.query<{ journey_status: string }>(
      "select journey_status from public.reservations where id = $1",
      [fixture.reservationA],
    );
    expect(reservation.rows[0]?.journey_status).toBe("checked_out");

    const otherReservation = await client.query<{ journey_status: string }>(
      "select journey_status from public.reservations where id = $1",
      [fixture.reservationB],
    );
    expect(otherReservation.rows[0]?.journey_status).toBe("not_started");
  });

  it("does not let a guest token write another reservation's issue", async () => {
    const before = await client.query<{ count: string }>(
      "select count(*)::text as count from public.issues where reservation_id = $1",
      [fixture.reservationB],
    );

    await client.query("select public.guest_create_issue($1, $2, $3)", [
      fixture.tokenA.hash,
      "cleaning",
      "Should stay on reservation A",
    ]);

    const after = await client.query<{ count: string }>(
      "select count(*)::text as count from public.issues where reservation_id = $1",
      [fixture.reservationB],
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);

    const created = await client.query<{ reservation_id: string }>(
      "select reservation_id from public.issues where description = 'Should stay on reservation A'",
    );
    expect(created.rows[0]?.reservation_id).toBe(fixture.reservationA);
  });

  it("does not authorize another property's media from a guest token", async () => {
    const result = await client.query<{ authorize_guest_property_media: string | null }>(
      "select public.authorize_guest_property_media($1, $2)",
      [fixture.tokenA.hash, fixture.knowledgeB],
    );
    expect(result.rows[0]?.authorize_guest_property_media).toBeNull();
  });

  it("does not create an organization membership for a guest action", async () => {
    await client.query("select public.guest_accept_rules($1)", [fixture.tokenA.hash]);

    const memberships = await client.query(
      "select id from public.organization_users where organization_id = $1 and user_id is not null",
      [fixture.orgA],
    );
    const guestUsers = await client.query(
      `
        select 1
        from public.organization_users ou
        join public.profiles p on p.id = ou.user_id
        where p.email = 'amelia@onwarda-rls.test'
      `,
    );
    expect(guestUsers.rowCount).toBe(0);
    expect(memberships.rowCount).toBeGreaterThan(0);
  });

  it("does not create a rule acceptance when no guest-visible rules exist", async () => {
    const before = await client.query<{ count: string }>(
      "select count(*)::text as count from public.guest_rule_acceptances where reservation_id = $1",
      [fixture.reservationB],
    );

    const result = await client.query<{ guest_accept_rules: Record<string, unknown> }>(
      "select public.guest_accept_rules($1)",
      [fixture.tokenB.hash],
    );

    expect(result.rows[0]?.guest_accept_rules.status).toBe("not_applicable");

    const reservation = await client.query<{
      rules_accepted_at: string | null;
      journey_status: string;
    }>(
      "select rules_accepted_at, journey_status from public.reservations where id = $1",
      [fixture.reservationB],
    );
    expect(reservation.rows[0]?.rules_accepted_at).toBeNull();

    const after = await client.query<{ count: string }>(
      "select count(*)::text as count from public.guest_rule_acceptances where reservation_id = $1",
      [fixture.reservationB],
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });

  it("scopes rule acceptance and arrival notes to the token reservation", async () => {
    await client.query(
      `
        insert into public.property_house_rules (
          organization_id, property_id, rule_key, state, visibility
        ) values ($1, $2, 'quiet_hours', 'limited', 'guest')
        on conflict (property_id, rule_key) do update
          set visibility = 'guest', state = 'limited'
      `,
      [fixture.orgA, fixture.propertyA],
    );

    const accepted = await client.query<{ guest_accept_rules: Record<string, unknown> }>(
      "select public.guest_accept_rules($1)",
      [fixture.tokenA.hash],
    );
    expect(accepted.rows[0]?.guest_accept_rules.status).toBe("ok");

    const otherRules = await client.query<{ rules_accepted_at: string | null }>(
      "select rules_accepted_at from public.reservations where id = $1",
      [fixture.reservationB],
    );
    expect(otherRules.rows[0]?.rules_accepted_at).toBeNull();

    const arrival = await client.query<{ guest_update_arrival_notes: Record<string, unknown> }>(
      "select public.guest_update_arrival_notes($1, $2)",
      [fixture.tokenA.hash, "Evening taxi from the airport"],
    );
    expect(arrival.rows[0]?.guest_update_arrival_notes.status).toBe("ok");

    const notes = await client.query<{
      arrival_notes: string | null;
      other_notes: string | null;
    }>(
      `
        select
          a.arrival_notes,
          b.arrival_notes as other_notes
        from public.reservations a
        join public.reservations b on b.id = $2
        where a.id = $1
      `,
      [fixture.reservationA, fixture.reservationB],
    );
    expect(notes.rows[0]?.arrival_notes).toBe("Evening taxi from the airport");
    expect(notes.rows[0]?.other_notes).toBeNull();
  });

  it("does not let guests escalate into the operator workspace", async () => {
    await asAuthenticated(client, fixture.userB, async () => {
      const result = await client.query(
        "select id from public.reservations where id = $1",
        [fixture.reservationA],
      );
      expect(result.rowCount).toBe(0);
    });
  });
});
