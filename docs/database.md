# Database

Onwarda uses a single local or hosted Supabase PostgreSQL database.

## Local setup

Docker Desktop must be running, then:

```bash
npx supabase start
npx supabase db reset   # reapplies all migrations
```

Default local connection:

`postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Point `.env.local` at the keys printed by `npx supabase status` when developing against local Supabase.

`npm run bootstrap:admin` is a local-development-only command. It reads `ONWARDA_DEV_ADMIN_EMAIL` and `ONWARDA_DEV_ADMIN_PASSWORD` from `.env.local`, creates or reuses the corresponding Auth user, ensures the `profiles` and active `platform_admins` rows exist, and verifies that `requirePlatformAdmin()` would accept the account. It will not run against a hosted Supabase project.

`npm run bootstrap:client` is the matching local-only command for a client user. It reads `ONWARDA_DEV_CLIENT_EMAIL` / `ONWARDA_DEV_CLIENT_PASSWORD` (or `--email` / `--password`), attaches the user to one organization (`ONWARDA_DEV_CLIENT_ORG_SLUG` or `--org`), and refuses platform-admin accounts and cross-organization attach. Payment provider credentials are never involved.

## Migrations

| File | Purpose |
| --- | --- |
| `20260903120000_extensions.sql` | `pgcrypto` |
| `20260903140000_schema.sql` | Tables, FKs, indexes, consistency triggers |
| `20260903140100_rls.sql` | Privileges, RLS policies, helper functions |
| `20260903140200_storage.sql` | Private buckets and storage policies |
| `20260903150000_admin_provisioning.sql` | Platform-admin provisioning RPCs |
| `20260903200000_admin_client_control.sql` | Client membership RPCs, ownership transfer, support sessions |
| `20260903201000_qualify_membership_role.sql` | Qualify membership `role` columns in plpgsql RPCs |
| `20260904010000_subscriptions_and_support_workspace.sql` | Subscription foundation and support-workspace read policies |
| `20260904020000_organization_branding.sql` | `organization_branding`, default-row trigger, admin RPCs, private branding bucket |

## Tables

Identity: `profiles`, `platform_admins`, `organizations`, `organization_branding`, `organization_users`, `support_sessions`, `organization_subscriptions`

Hospitality: `properties`, `guests`, `reservations`, `issues`, `property_knowledge`

Guest portal: `guest_portal_tokens`

Activity: `events` (product, append-only), `audit_logs` (security/admin)

`profiles.id` references `auth.users(id)`. A `SECURITY DEFINER` trigger copies new auth users into `profiles`.

## Indexes

Indexes exist for tenant filters (`organization_id`), membership lookup (`user_id`, `status`), reservation dates, guest email, token hash, active token expiry, and audit/event time.

## RLS

RLS is enabled and forced on every application table. `anon` has no table rights. `authenticated` is constrained by membership. `service_role` bypasses RLS and is server-only.

## Storage

Private buckets:

- `organization-assets`
- `property-media`
- `guest-documents`
- `organization-branding`

Key format: `organizations/{organization_id}/...`

`organization_branding` stores `display_name`, `logo_path`, and `#RRGGBB` colors only. Image bytes are never stored in PostgreSQL. A trigger creates a default branding row when an organization is inserted. `logo_path` must match `organizations/{organization_id}/branding/logo.{png|jpg|jpeg|webp}`. Property-specific branding is not a table yet.

## Tests

```bash
npm run test:db
```

These tests connect to the real local database, set `authenticated` + `auth.uid()`, and prove isolation at the PostgreSQL layer.

`npm run test:db` reseeds fixture data and deletes `platform_admins`, support sessions, and other local rows used by `bootstrap:admin` / `bootstrap:client`. Restore those accounts with the existing bootstrap scripts after database tests.
