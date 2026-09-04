import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { asAnon, asAuthenticated, requireLocalPostgres } from "./postgres";
import { insertAuthUser, seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("client membership RPCs", () => {
  it("prevents a client user from inviting another organization's member", async () => {
    const invitee = await insertAuthUser(
      client,
      `invitee-${randomUUID()}@onwarda-rls.test`,
    );

    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          `
            select public.admin_invite_organization_user(
              $1, $2, 'invitee@onwarda-rls.test', 'staff', 'invited'
            )
          `,
          [fixture.orgB, invitee],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("prevents a client user from changing another organization's roles", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "select public.admin_set_organization_user_role($1, $2, 'staff')",
          [fixture.orgB, fixture.userB],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("prevents suspending the last owner", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await expect(
        client.query(
          "select public.admin_set_organization_user_status($1, $2, 'suspended')",
          [fixture.orgA, fixture.userA],
        ),
      ).rejects.toThrow(/at least one owner/i);
    });
  });

  it("lets a platform admin invite, change role, suspend, and reactivate inside one organization", async () => {
    const invitee = await insertAuthUser(
      client,
      `member-${randomUUID()}@onwarda-rls.test`,
    );

    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await client.query(
        `
          select public.admin_invite_organization_user(
            $1, $2, 'member@onwarda-rls.test', 'staff', 'active'
          )
        `,
        [fixture.orgA, invitee],
      );

      await client.query(
        "select public.admin_set_organization_user_role($1, $2, 'manager')",
        [fixture.orgA, invitee],
      );
      await client.query(
        "select public.admin_set_organization_user_status($1, $2, 'suspended')",
        [fixture.orgA, invitee],
      );
      await client.query(
        "select public.admin_set_organization_user_status($1, $2, 'active')",
        [fixture.orgA, invitee],
      );

      await client.query("reset role");
      const membership = await client.query<{ role: string; status: string }>(
        `
          select role, status
          from public.organization_users
          where organization_id = $1 and user_id = $2
        `,
        [fixture.orgA, invitee],
      );
      expect(membership.rows).toEqual([{ role: "manager", status: "active" }]);

      const audit = await client.query<{ action: string }>(
        `
          select action
          from public.audit_logs
          where organization_id = $1
            and target_id = $2
          order by created_at
        `,
        [fixture.orgA, invitee],
      );
      expect(audit.rows.map((row) => row.action)).toEqual([
        "organization.user_invited",
        "organization.user_role_changed",
        "organization.user_suspended",
        "organization.user_reactivated",
      ]);
    });
  });

  it("transfers ownership atomically and refuses cross-organization transfer", async () => {
    const successor = await insertAuthUser(
      client,
      `successor-${randomUUID()}@onwarda-rls.test`,
    );

    await client.query(
      `
        insert into public.organization_users (organization_id, user_id, role, status)
        values ($1, $2, 'admin', 'active')
      `,
      [fixture.orgA, successor],
    );

    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await client.query("savepoint before_cross_org");
      try {
        await client.query(
          "select public.admin_transfer_organization_ownership($1, $2)",
          [fixture.orgA, fixture.userB],
        );
        throw new Error("cross-organization transfer should have failed");
      } catch (error) {
        expect(String(error)).toMatch(/membership not found|platform administrator/i);
      }
      await client.query("rollback to savepoint before_cross_org");

      await client.query(
        "select public.admin_transfer_organization_ownership($1, $2)",
        [fixture.orgA, successor],
      );

      await client.query("reset role");
      const roles = await client.query<{ user_id: string; role: string }>(
        `
          select user_id, role
          from public.organization_users
          where organization_id = $1
            and user_id in ($2, $3)
          order by role desc
        `,
        [fixture.orgA, fixture.userA, successor],
      );

      expect(roles.rows).toEqual([
        { user_id: successor, role: "owner" },
        { user_id: fixture.userA, role: "admin" },
      ]);
    });
  });
});

describe("support sessions", () => {
  it("prevents client users and anonymous callers from starting support sessions", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query(
          "select public.start_support_session($1, 'help the guest', 120)",
          [fixture.orgA],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });

    await asAnon(client, async () => {
      await expect(
        client.query(
          "select public.start_support_session($1, 'help the guest', 120)",
          [fixture.orgA],
        ),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });

  it("prevents authenticated users from inserting support_sessions directly", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      await expect(
        client.query(
          `
            insert into public.support_sessions (
              platform_admin_user_id, organization_id, reason, expires_at
            ) values ($1, $2, 'direct insert', now() + interval '2 hours')
          `,
          [fixture.platformAdmin, fixture.orgA],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });
  });

  it("starts, expires conceptually, and ends a support session with audit logs", async () => {
    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const started = await client.query<{ start_support_session: string }>(
        "select public.start_support_session($1, 'Investigate check-in', 120)",
        [fixture.orgA],
      );
      const sessionId = started.rows[0]?.start_support_session;
      expect(sessionId).toBeTruthy();

      const open = await client.query<{ ended_at: string | null; expires_at: string }>(
        `
          select ended_at, expires_at
          from public.support_sessions
          where id = $1
        `,
        [sessionId],
      );
      expect(open.rows[0]?.ended_at).toBeNull();
      expect(new Date(open.rows[0]?.expires_at ?? 0).getTime()).toBeGreaterThan(
        Date.now(),
      );

      await client.query("select public.end_support_session($1)", [sessionId]);

      await client.query("reset role");
      const closed = await client.query<{ ended_at: string | null }>(
        "select ended_at from public.support_sessions where id = $1",
        [sessionId],
      );
      expect(closed.rows[0]?.ended_at).not.toBeNull();

      const audit = await client.query<{ action: string }>(
        `
          select action
          from public.audit_logs
          where target_id = $1
          order by created_at
        `,
        [sessionId],
      );
      expect(audit.rows.map((row) => row.action)).toEqual([
        "support_session.started",
        "support_session.ended",
      ]);
    });
  });

  it("does not let a client user end a platform admin support session", async () => {
    let sessionId = "";

    await asAuthenticated(client, fixture.platformAdmin, async () => {
      const started = await client.query<{ start_support_session: string }>(
        "select public.start_support_session($1, 'Second session', 120)",
        [fixture.orgA],
      );
      sessionId = started.rows[0]?.start_support_session ?? "";
    });

    await asAuthenticated(client, fixture.userA, async () => {
      await expect(
        client.query("select public.end_support_session($1)", [sessionId]),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });
  });
});

describe("cross-tenant membership isolation", () => {
  it("does not let a client user read another organization's users", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const users = await client.query(
        "select user_id from public.organization_users where organization_id = $1",
        [fixture.orgB],
      );
      expect(users.rowCount).toBe(0);
    });
  });
});
