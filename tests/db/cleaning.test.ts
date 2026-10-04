import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { hashCleanerToken } from "@/lib/cleaning/tokens";
import { asAuthenticated, requireLocalPostgres } from "./postgres";
import { seedRlsFixture, type RlsFixture } from "./seed";

let client: Client;
let fixture: RlsFixture;
let agentA: string;
let agentB: string;

beforeAll(async () => {
  client = await requireLocalPostgres();
  fixture = await seedRlsFixture(client);

  const createdA = await client.query<{ id: string }>(
    `
      insert into public.cleaning_agents (organization_id, display_name)
      values ($1, 'Fatima')
      returning id
    `,
    [fixture.orgA],
  );
  const createdB = await client.query<{ id: string }>(
    `
      insert into public.cleaning_agents (organization_id, display_name)
      values ($1, 'Sara')
      returning id
    `,
    [fixture.orgB],
  );
  agentA = createdA.rows[0]!.id;
  agentB = createdB.rows[0]!.id;

  await client.query(
    `
      insert into public.property_cleaning_agents (
        organization_id, property_id, cleaning_agent_id, active
      ) values ($1, $2, $3, true)
    `,
    [fixture.orgA, fixture.propertyA, agentA],
  );
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe("cleaning tenancy", () => {
  it("hides organization B cleaners, assignments, and tasks from organization A", async () => {
    await asAuthenticated(client, fixture.userA, async () => {
      const agents = await client.query("select id from public.cleaning_agents");
      expect(agents.rows.map((row) => row.id)).toContain(agentA);
      expect(agents.rows.map((row) => row.id)).not.toContain(agentB);

      const assignments = await client.query(
        "select id from public.property_cleaning_agents where organization_id = $1",
        [fixture.orgB],
      );
      expect(assignments.rowCount).toBe(0);
    });
  });

  it("rejects cross-organization assignment and reparenting", async () => {
    await expect(
      client.query(
        `
          insert into public.property_cleaning_agents (
            organization_id, property_id, cleaning_agent_id
          ) values ($1, $2, $3)
        `,
        [fixture.orgA, fixture.propertyA, agentB],
      ),
    ).rejects.toThrow(/organization mismatch/i);

    await expect(
      client.query("update public.cleaning_agents set organization_id = $1 where id = $2", [
        fixture.orgB,
        agentA,
      ]),
    ).rejects.toThrow(/organization_id cannot be changed/i);
  });

  it("lets an owner create one checkout task and keeps a retry idempotent", async () => {
    const first = await client.query<{ guest_complete_checkout: { status: string; taskId: string } }>(
      "select public.guest_complete_checkout($1)",
      [fixture.tokenA.hash],
    );
    expect(first.rows[0]?.guest_complete_checkout.status).toBe("ok");
    expect(first.rows[0]?.guest_complete_checkout.taskId).toBeTruthy();

    const second = await client.query<{ guest_complete_checkout: { status: string; taskId: string | null } }>(
      "select public.guest_complete_checkout($1)",
      [fixture.tokenA.hash],
    );
    expect(second.rows[0]?.guest_complete_checkout.status).toBe("ok");
    expect(second.rows[0]?.guest_complete_checkout.taskId).toBeNull();

    const tasks = await client.query<{ status: string; assigned_agent_id: string | null; trigger_type: string }>(
      "select status, assigned_agent_id, trigger_type from public.cleaning_tasks where reservation_id = $1",
      [fixture.reservationA],
    );
    expect(tasks.rowCount).toBe(1);
    expect(tasks.rows[0]?.status).toBe("queued");
    expect(tasks.rows[0]?.trigger_type).toBe("guest_checkout");
    expect(tasks.rows[0]?.assigned_agent_id).toBe(agentA);

    const property = await client.query<{ operational_readiness: string }>(
      "select operational_readiness from public.properties where id = $1",
      [fixture.propertyA],
    );
    expect(property.rows[0]?.operational_readiness).toBe("cleaning_required");

    const items = await client.query(
      "select id from public.cleaning_task_items where cleaning_task_id = $1",
      [first.rows[0]?.guest_complete_checkout.taskId],
    );
    expect(items.rowCount).toBe(17);
  });

  it("stops staff from creating cleaners and managers from rotating links", async () => {
    await asAuthenticated(client, fixture.staffA, async () => {
      await expect(
        client.query(
          "insert into public.cleaning_agents (organization_id, display_name) values ($1, 'Nope')",
          [fixture.orgA],
        ),
      ).rejects.toThrow(/permission denied|row-level security/i);
    });

    await asAuthenticated(client, fixture.userA, async () => {
      const visible = await client.query("select id from public.cleaning_tasks");
      expect(visible.rowCount).toBe(1);
    });
  });
});

describe("cleaner link and completion", () => {
  it("shows only assigned work, rejects an incomplete finish, then releases the property", async () => {
    const raw = "cleaner-token-fatima-permanent-link-value";
    const hash = hashCleanerToken(raw);
    const task = await client.query<{ id: string }>(
      "select id from public.cleaning_tasks where reservation_id = $1",
      [fixture.reservationA],
    );
    const taskId = task.rows[0]!.id;

    await client.query(
      `
        insert into public.cleaning_agent_links (organization_id, cleaning_agent_id, token_hash)
        values ($1, $2, $3)
      `,
      [fixture.orgA, agentA, hash],
    );

    const home = await client.query<{ get_cleaner_home: { status: string; active: Array<{ taskId: string }> } }>(
      "select public.get_cleaner_home($1)",
      [hash],
    );
    expect(home.rows[0]?.get_cleaner_home.status).toBe("valid");
    expect(home.rows[0]?.get_cleaner_home.active.map((row) => row.taskId)).toContain(taskId);

    const foreign = await client.query<{ get_cleaner_task: { status: string } }>(
      "select public.get_cleaner_task($1, $2)",
      [hash, fixture.propertyB],
    );
    expect(foreign.rows[0]?.get_cleaner_task.status).not.toBe("ok");

    const blocked = await client.query<{ cleaner_finish_task: { status: string } }>(
      "select public.cleaner_finish_task($1, $2, true, true)",
      [hash, taskId],
    );
    expect(blocked.rows[0]?.cleaner_finish_task.status).toBe("not_started");

    await client.query("select public.cleaner_start_task($1, $2)", [hash, taskId]);
    const started = await client.query<{ operational_readiness: string }>(
      "select operational_readiness from public.properties where id = $1",
      [fixture.propertyA],
    );
    expect(started.rows[0]?.operational_readiness).toBe("cleaning_in_progress");

    const incomplete = await client.query<{ cleaner_finish_task: { status: string } }>(
      "select public.cleaner_finish_task($1, $2, true, true)",
      [hash, taskId],
    );
    expect(incomplete.rows[0]?.cleaner_finish_task.status).toBe("checklist_incomplete");

    const held = await client.query<{ operational_readiness: string }>(
      "select operational_readiness from public.properties where id = $1",
      [fixture.propertyA],
    );
    expect(held.rows[0]?.operational_readiness).toBe("cleaning_in_progress");

    const items = await client.query<{ item_key: string }>(
      "select item_key from public.cleaning_task_items where cleaning_task_id = $1",
      [taskId],
    );
    for (const item of items.rows) {
      await client.query("select public.cleaner_set_task_item($1, $2, $3, true)", [
        hash,
        taskId,
        item.item_key,
      ]);
    }

    const finished = await client.query<{ cleaner_finish_task: { status: string; readiness: string } }>(
      "select public.cleaner_finish_task($1, $2, true, true)",
      [hash, taskId],
    );
    expect(finished.rows[0]?.cleaner_finish_task.status).toBe("ok");
    expect(finished.rows[0]?.cleaner_finish_task.readiness).toBe("ready");

    const again = await client.query<{ cleaner_finish_task: { status: string } }>(
      "select public.cleaner_finish_task($1, $2, true, true)",
      [hash, taskId],
    );
    expect(again.rows[0]?.cleaner_finish_task.status).toBe("already_completed");

    const sameLink = await client.query<{ get_cleaner_home: { status: string } }>(
      "select public.get_cleaner_home($1)",
      [hash],
    );
    expect(sameLink.rows[0]?.get_cleaner_home.status).toBe("valid");

    await client.query(
      "update public.cleaning_agent_links set revoked_at = now() where token_hash = $1",
      [hash],
    );
    const revoked = await client.query<{ status: string }>(
      "select status from public.inspect_cleaner_link($1)",
      [hash],
    );
    expect(revoked.rows[0]?.status).toBe("revoked");
  });

  it("lets the organization owner issue a link and blocks another organization", async () => {
    const hash = hashCleanerToken("owner-issued-cleaner-link-value-aaaa");

    await asAuthenticated(client, fixture.userB, async () => {
      await expect(
        client.query("select public.workspace_issue_cleaning_link($1, $2)", [agentA, hash]),
      ).rejects.toThrow(/not authorized|permission denied/i);
    });

    await asAuthenticated(client, fixture.userA, async () => {
      const issued = await client.query(
        "select public.workspace_issue_cleaning_link($1, $2)",
        [agentA, hash],
      );
      expect(issued.rowCount).toBe(1);
    });

    await asAuthenticated(client, fixture.userB, async () => {
      const tasks = await client.query("select id from public.cleaning_tasks");
      expect(tasks.rowCount).toBe(0);
    });
  });
});

async function asMember<T>(userId: string, work: () => Promise<T>) {
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);

  try {
    return await work();
  } finally {
    await client.query("select set_config('request.jwt.claim.sub', '', false)");
    await client.query("select set_config('request.jwt.claims', '{}', false)");
  }
}

describe("manual cleaning and task assignment", () => {
  it("creates one queued manual task, replays the same request, and holds the property", async () => {
    const created = await asMember(fixture.userA, async () => {
      const key = await client.query<{ id: string }>("select gen_random_uuid() as id");
      const first = await client.query<{
        workspace_create_manual_cleaning: { status: string; taskId: string; readiness: string };
      }>("select public.workspace_create_manual_cleaning($1, $2, $3, false)", [
        fixture.propertyA,
        agentA,
        key.rows[0]!.id,
      ]);
      const replay = await client.query<{
        workspace_create_manual_cleaning: { status: string; taskId: string };
      }>("select public.workspace_create_manual_cleaning($1, $2, $3, false)", [
        fixture.propertyA,
        agentA,
        key.rows[0]!.id,
      ]);
      const secondKey = await client.query<{ id: string }>("select gen_random_uuid() as id");
      const conflict = await client.query<{
        workspace_create_manual_cleaning: { status: string; taskId: string };
      }>("select public.workspace_create_manual_cleaning($1, $2, $3, false)", [
        fixture.propertyA,
        null,
        secondKey.rows[0]!.id,
      ]);

      return { first: first.rows[0]!.workspace_create_manual_cleaning, replay: replay.rows[0]!.workspace_create_manual_cleaning, conflict: conflict.rows[0]!.workspace_create_manual_cleaning };
    });

    expect(created.first.status).toBe("created");
    expect(created.first.readiness).toBe("cleaning_required");
    expect(created.replay).toEqual({ status: "exists", taskId: created.first.taskId });
    expect(created.conflict.status).toBe("conflict");

    const task = await client.query<{
      reservation_id: string | null;
      status: string;
      trigger_type: string;
      assigned_agent_id: string | null;
    }>("select reservation_id, status, trigger_type, assigned_agent_id from public.cleaning_tasks where id = $1", [
      created.first.taskId,
    ]);
    expect(task.rows[0]).toMatchObject({
      reservation_id: null,
      status: "queued",
      trigger_type: "manual",
      assigned_agent_id: agentA,
    });

    const items = await client.query("select id from public.cleaning_task_items where cleaning_task_id = $1", [
      created.first.taskId,
    ]);
    expect(items.rowCount).toBe(17);

    const open = await client.query(
      "select id from public.cleaning_tasks where property_id = $1 and status in ('queued', 'in_progress') and trigger_type = 'manual'",
      [fixture.propertyA],
    );
    expect(open.rowCount).toBe(1);
  });

  it("lets a confirmed second manual cleaning keep the first task", async () => {
    const before = await client.query<{ id: string }>(
      "select id from public.cleaning_tasks where property_id = $1 and trigger_type = 'manual'",
      [fixture.propertyA],
    );
    const created = await asMember(fixture.userA, async () => {
      const key = await client.query<{ id: string }>("select gen_random_uuid() as id");
      const result = await client.query<{
        workspace_create_manual_cleaning: { status: string; taskId: string };
      }>("select public.workspace_create_manual_cleaning($1, null, $2, true)", [
        fixture.propertyA,
        key.rows[0]!.id,
      ]);
      return result.rows[0]!.workspace_create_manual_cleaning;
    });

    expect(created.status).toBe("created");
    const after = await client.query<{ id: string }>(
      "select id from public.cleaning_tasks where property_id = $1 and trigger_type = 'manual'",
      [fixture.propertyA],
    );
    expect(after.rowCount).toBe((before.rowCount ?? 0) + 1);
    expect(after.rows.map((row) => row.id)).toContain(before.rows[0]!.id);
    expect(after.rows.map((row) => row.id)).toContain(created.taskId);
  });

  it("rejects staff, another organization, and a disabled or foreign cleaner", async () => {
    await expect(
      asMember(fixture.staffA, () =>
        client.query("select public.workspace_create_manual_cleaning($1, $2, gen_random_uuid(), false)", [
          fixture.propertyA,
          agentA,
        ]),
      ),
    ).rejects.toThrow(/not authorized/i);

    await expect(
      asMember(fixture.userB, () =>
        client.query("select public.workspace_create_manual_cleaning($1, $2, gen_random_uuid(), true)", [
          fixture.propertyA,
          agentB,
        ]),
      ),
    ).rejects.toThrow(/not authorized/i);

    const task = await client.query<{ id: string }>(
      "select id from public.cleaning_tasks where property_id = $1 and status = 'queued' limit 1",
      [fixture.propertyA],
    );

    await expect(
      asMember(fixture.userA, () =>
        client.query("select public.workspace_assign_cleaning_task($1, $2)", [task.rows[0]!.id, agentB]),
      ),
    ).rejects.toThrow(/cleaner unavailable|organization mismatch/i);

    const disabled = await client.query<{ id: string }>(
      "insert into public.cleaning_agents (organization_id, display_name, active) values ($1, 'Nabil', false) returning id",
      [fixture.orgA],
    );

    await expect(
      asMember(fixture.userA, () =>
        client.query("select public.workspace_assign_cleaning_task($1, $2)", [
          task.rows[0]!.id,
          disabled.rows[0]!.id,
        ]),
      ),
    ).rejects.toThrow(/cleaner unavailable/i);

    await expect(
      client.query(
        "insert into public.property_cleaning_agents (organization_id, property_id, cleaning_agent_id, active) values ($1, $2, $3, true)",
        [fixture.orgA, fixture.propertyA, disabled.rows[0]!.id],
      ),
    ).rejects.toThrow(/cleaner unavailable/i);
  });

  it("keeps the task assignee when property defaults change, and moves cleaner access on reassignment", async () => {
    const omar = await client.query<{ id: string }>(
      "insert into public.cleaning_agents (organization_id, display_name) values ($1, 'Omar') returning id",
      [fixture.orgA],
    );
    const omarId = omar.rows[0]!.id;
    const task = await client.query<{ id: string; assigned_agent_id: string }>(
      "select id, assigned_agent_id from public.cleaning_tasks where property_id = $1 and status = 'queued' and assigned_agent_id = $2 limit 1",
      [fixture.propertyA, agentA],
    );
    const taskId = task.rows[0]!.id;

    await client.query(
      "insert into public.property_cleaning_agents (organization_id, property_id, cleaning_agent_id, active) values ($1, $2, $3, true)",
      [fixture.orgA, fixture.propertyA, omarId],
    );
    await expect(
      client.query(
        "insert into public.property_cleaning_agents (organization_id, property_id, cleaning_agent_id, active) values ($1, $2, $3, true)",
        [fixture.orgA, fixture.propertyA, omarId],
      ),
    ).rejects.toThrow(/duplicate|unique/i);

    await client.query(
      "update public.property_cleaning_agents set active = false where property_id = $1 and cleaning_agent_id = $2",
      [fixture.propertyA, agentA],
    );

    const unchanged = await client.query<{ assigned_agent_id: string }>(
      "select assigned_agent_id from public.cleaning_tasks where id = $1",
      [taskId],
    );
    expect(unchanged.rows[0]?.assigned_agent_id).toBe(agentA);

    const fatimaHash = hashCleanerToken("fatima-reassignment-link-value-0001");
    const omarHash = hashCleanerToken("omar-reassignment-link-value-000001");
    await client.query(
      "insert into public.cleaning_agent_links (organization_id, cleaning_agent_id, token_hash) values ($1, $2, $3), ($1, $4, $5)",
      [fixture.orgA, agentA, fatimaHash, omarId, omarHash],
    );

    const before = await client.query<{ get_cleaner_home: { active: Array<{ taskId: string | null }> } }>(
      "select public.get_cleaner_home($1)",
      [fatimaHash],
    );
    expect(before.rows[0]?.get_cleaner_home.active.map((row) => row.taskId)).toContain(taskId);

    const reassigned = await asMember(fixture.userA, () =>
      client.query<{ workspace_assign_cleaning_task: { status: string } }>(
        "select public.workspace_assign_cleaning_task($1, $2)",
        [taskId, omarId],
      ),
    );
    expect(reassigned.rows[0]?.workspace_assign_cleaning_task.status).toBe("reassigned");

    const fatimaAfter = await client.query<{ get_cleaner_task: { status: string } }>(
      "select public.get_cleaner_task($1, $2)",
      [fatimaHash, taskId],
    );
    const omarAfter = await client.query<{ get_cleaner_home: { active: Array<{ taskId: string | null }> } }>(
      "select public.get_cleaner_home($1)",
      [omarHash],
    );
    expect(fatimaAfter.rows[0]?.get_cleaner_task.status).toBe("forbidden");
    expect(omarAfter.rows[0]?.get_cleaner_home.active.map((row) => row.taskId)).toContain(taskId);

    const cleared = await asMember(fixture.userA, () =>
      client.query<{ workspace_assign_cleaning_task: { status: string } }>(
        "select public.workspace_assign_cleaning_task($1, null)",
        [taskId],
      ),
    );
    expect(cleared.rows[0]?.workspace_assign_cleaning_task.status).toBe("unassigned");

    const unassigned = await client.query<{ status: string; assigned_agent_id: string | null }>(
      "select status, assigned_agent_id from public.cleaning_tasks where id = $1",
      [taskId],
    );
    expect(unassigned.rows[0]).toMatchObject({ status: "queued", assigned_agent_id: null });

    const omarBlocked = await client.query<{ get_cleaner_task: { status: string } }>(
      "select public.get_cleaner_task($1, $2)",
      [omarHash, taskId],
    );
    expect(omarBlocked.rows[0]?.get_cleaner_task.status).toBe("forbidden");

    const restored = await asMember(fixture.userA, () =>
      client.query<{ workspace_assign_cleaning_task: { status: string } }>(
        "select public.workspace_assign_cleaning_task($1, $2)",
        [taskId, omarId],
      ),
    );
    expect(restored.rows[0]?.workspace_assign_cleaning_task.status).toBe("assigned");
    const omarRestored = await client.query<{ get_cleaner_task: { status: string } }>(
      "select public.get_cleaner_task($1, $2)",
      [omarHash, taskId],
    );
    expect(omarRestored.rows[0]?.get_cleaner_task.status).toBe("ok");
  });
});
