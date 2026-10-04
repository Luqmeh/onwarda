# Cleaning

Phase 7 connects guest checkout to turnover. A cleaner is an operational profile with one permanent link, not a Supabase Auth user.

```
Guest checkout
  → one cleaning task
  → property hold (cleaning_required)
  → assigned cleaner opens /cleaner/[token]
  → checklist
  → completion
  → property ready
```

## Cleaner profile

`cleaning_agents` belongs to exactly one organization. It stores a display name, active flag, and optional notes. It does not require email, phone, or a password.

`property_cleaning_agents` is the default team for a property. A property may have several active cleaners. Duplicate pairs are rejected. Adding or removing a default cleaner does not move an open task. Disabling a cleaner deactivates those defaults and revokes the link. The task keeps its assignee and shows them as unavailable until someone reassigns it. Historical tasks stay.

## Permanent link

`/cleaner/[token]` is constant for that cleaner until an owner or admin rotates or disables it.

- 32 random bytes, base64url
- only the SHA-256 hash is stored on `cleaning_agent_links`
- one active link per cleaner
- revoke sets `revoked_at`; rotate issues a new hash and revokes the old one
- `expires_at` exists but is not set in this phase
- the raw token is returned once from the generate action and is not written to events, audit metadata, or the database

The same URL lists tasks whose `assigned_agent_id` is that cleaner, plus properties where they are a default and have no open task of their own. Reassigning a task removes it from the previous cleaner and shows it to the new one. Completing a task does not rotate the link. An unassigned task is not visible to any cleaner.

## Tasks

`cleaning_tasks` is the only turnover record. `trigger_type` is `guest_checkout` or `manual`. A manual task has `reservation_id` null. `assigned_agent_id` is the one cleaner doing that task, which is separate from the property's default team.

`guest_complete_checkout` is one transaction:

1. mark the reservation checked out
2. insert one `guest_checkout` task for that reservation (`ON CONFLICT DO NOTHING`)
3. set `assigned_agent_id` to the earliest active default cleaner, or leave it null
4. snapshot the canonical checklist into `cleaning_task_items`
5. set property readiness from open tasks

A second checkout click does not create a second task. A task is still created when no cleaner is assigned.

`workspace_create_manual_cleaning` inserts the same kind of row with `trigger_type = manual`. It locks the property, replays a repeated `request_key`, and refuses a second open task until `p_confirm_extra` is true. The task starts `queued` and the property moves to `cleaning_required`.

`workspace_assign_cleaning_task` changes only `assigned_agent_id` on that open task. It does not copy the change onto `property_cleaning_agents` and it does not insert another task. Owner, admin, and manager may create and assign. Staff and support stay read-only.

Statuses: `queued`, `in_progress`, `completed`, `cancelled`.

## Property readiness

`properties.status` stays the publication lifecycle (`draft` / `active` / `inactive` / `archived`).

`properties.operational_readiness` is separate:

| State | When |
| --- | --- |
| `ready` | No queued or in-progress task |
| `cleaning_required` | A task is queued |
| `cleaning_in_progress` | A task is in progress |

Public `/p/*` listing does not look at readiness. Cleaning does not unpublish a home.

## Checklist

Definitions live in `cleaning_checklist_definitions` and `src/lib/cleaning/catalog.ts`. Each new task copies them. Later catalog edits do not rewrite old tasks. Required items must be complete, and the cleaner must confirm the work and that they left, before `cleaner_finish_task` completes the task and releases the hold. A failed finish does not change readiness. A second finish returns `already_completed`.

## Authorization

| Actor | Access |
| --- | --- |
| Owner / admin | Create cleaners, assign properties, create manual cleaning, assign and reassign tasks, issue and rotate links, disable, reopen, cancel |
| Manager | Create cleaners, assign properties, create manual cleaning, assign and reassign tasks. Cannot issue links, disable, reopen, or cancel |
| Staff | Read cleaning in `/app` |
| Support | Read-only through an active support session |
| Guest | Checkout only, via the existing guest token |
| Cleaner | `/cleaner/[token]` and assigned tasks only. No `/app`, `/admin`, `/g`, or `/p` |

Cleaner mutations are service-role RPCs. The token hash is the authorization boundary. A task id in the URL is not enough.

The cleaner projection returns property name, address, and city plus the checklist. It does not return guest contact details, private notes, lock codes, or billing.

## Events

Checkout, task creation, assignment, reassignment, unassignment, hold start/release, start, item completion, completion, reopen, cancel, link generate/rotate, and agent create/disable are written to `events` and important changes also to `audit_logs`. Reassignment stores `previousAgentId` and `agentId`. Audit actor types include `cleaner`. Raw tokens are not included.

## Not in this phase

Cleaner passwords, email/SMS/WhatsApp, payroll, scheduling, recurring cleans, and task notes. `cleaning_tasks` has no notes column, so the create form does not collect one. Smart-lock credentials and a dedicated cleaner-visible access field are still absent. Add that field before exposing entry codes.
