import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { assertGuestPortalAccess } from "@/lib/guest-portal/access";
import { hashGuestPortalToken } from "@/lib/guest-portal/tokens";
import { guestPortalTokenSchema } from "@/lib/validation/guest-token";

import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("guest portal tokens in PostgreSQL", () => {
  it("resolves a valid hashed token to the issued reservation only", async () => {
    const result = await client.query<{ reservation_id: string }>(
      "select reservation_id from public.resolve_guest_portal_token($1)",
      [fixture.tokenA.hash],
    );

    expect(result.rows).toEqual([{ reservation_id: fixture.reservationA }]);
  });

  it("does not resolve an invalid hash", async () => {
    const result = await client.query(
      "select reservation_id from public.resolve_guest_portal_token($1)",
      [hashGuestPortalToken("z".repeat(40))],
    );

    expect(result.rowCount).toBe(0);
  });

  it("does not resolve an expired token", async () => {
    const result = await client.query(
      "select reservation_id from public.resolve_guest_portal_token($1)",
      [fixture.expiredTokenA.hash],
    );

    expect(result.rowCount).toBe(0);
  });

  it("does not resolve a revoked token", async () => {
    const result = await client.query(
      "select reservation_id from public.resolve_guest_portal_token($1)",
      [fixture.revokedTokenA.hash],
    );

    expect(result.rowCount).toBe(0);
  });

  it("does not let a token for reservation B open reservation A", async () => {
    const result = await client.query<{ reservation_id: string }>(
      "select reservation_id from public.resolve_guest_portal_token($1)",
      [fixture.tokenB.hash],
    );

    expect(result.rows[0]?.reservation_id).toBe(fixture.reservationB);
    expect(result.rows[0]?.reservation_id).not.toBe(fixture.reservationA);
  });

  it("rejects malformed tokens before any lookup", () => {
    expect(guestPortalTokenSchema.safeParse("12345").success).toBe(false);
    expect(guestPortalTokenSchema.safeParse("reservation-123").success).toBe(
      false,
    );
    expect(() =>
      assertGuestPortalAccess({
        token: "reservation-123",
        storedHash: fixture.tokenA.hash,
      }),
    ).toThrow(/invalid/i);
  });

  it("prevents organization A from reading organization B token hashes", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const result = await client.query(
        "select token_hash from public.guest_portal_tokens",
      );

      expect(result.rows.map((row) => row.token_hash)).not.toContain(
        fixture.tokenB.hash,
      );
    });
  });

  it("prevents organization A from inserting a token for organization B", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            insert into public.guest_portal_tokens (
              organization_id, reservation_id, property_id, token_hash
            ) values ($1, $2, $3, $4)
          `,
          [
            fixture.orgB,
            fixture.reservationB,
            fixture.propertyB,
            hashGuestPortalToken("x".repeat(40)),
          ],
        ),
      ).rejects.toThrow(/row-level security|does not belong|not scoped/i);
    });
  });

  it("does not grant execute on token resolution to authenticated users", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "select reservation_id from public.resolve_guest_portal_token($1)",
          [fixture.tokenA.hash],
        ),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});
