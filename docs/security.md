# Security

The highest-priority requirement is that data never crosses admin, tenant, or guest boundaries. Isolation is enforced by PostgreSQL RLS, not by the UI.

## Authentication

Supabase Auth issues sessions for two user categories:

- Platform administrators (`platform_admins.role = super_admin`)
- Organization users (`organization_users.role` in `owner | admin | manager | staff`)

Guests do not use Supabase Auth. They use opaque reservation tokens.

## Authorization

Route protection is layered:

1. `src/proxy.ts` refreshes the Supabase session and redirects unauthenticated users away from `/admin` (except `/admin/login`) and `/app`. It is not a security boundary.
2. Server layouts call `requirePlatformAdmin()` or `requireCurrentOrganization()`.
3. PostgreSQL RLS independently filters every table by `auth.uid()` membership.

A client-supplied `organization_id` is never treated as proof of access. Policies compare it to `current_user_organization_ids()`, which reads only the authenticated user's active memberships.

A client user who reaches `/admin` is rejected after authentication.

## Platform admin separation

- `platform_admins` is a separate table from `organization_users`.
- Authenticated users may `SELECT` only their own admin row.
- There are no insert/update/delete policies for authenticated users.
- Platform admins do not inherit tenant data access.
- Support access uses an audited `support_sessions` row, a time limit, and a visible banner. Never `?organizationId=`.
- Support mode does not create organization memberships or disable RLS.

## Role foundation

| Role | Organization settings | Operational writes | Issues | Delete important records |
| --- | --- | --- | --- | --- |
| owner / admin | yes | yes | yes | yes |
| manager | no | yes | yes | no |
| staff | no | no | yes | no |

Guests are not organization members.

## Secrets / service role

| Key | Allowed location |
| --- | --- |
| Anon key | Browser and server, RLS required |
| Service role key | Server only, via `src/lib/database/admin.ts` |

`src/config/env.server.ts` is marked `server-only`.

Service role bypasses RLS. It is permitted only for:

- platform-admin provisioning and client directory
- support-session lookup after `requirePlatformAdmin()`
- guest token hash lookup through `resolve_guest_portal_token`
- private signed URLs

Any service-role operation on tenant data must still authorize in application code first.

## Guest tokens

- Cryptographically random (`32` bytes, base64url)
- Stored only as SHA-256 hashes
- Compared with `timingSafeEqual` in application code
- Optionally expirable (`expires_at`) and revocable (`revoked_at`)
- Never include reservation IDs
- Resolved by a `SECURITY DEFINER` function granted only to `service_role`

Anon and authenticated roles cannot call `resolve_guest_portal_token`.

## Organization branding

- One `organization_branding` row per organization. Members and support can read their own row. Owner/admin can update it. Authenticated users cannot insert or delete rows; a trigger creates the default row.
- Platform admins change branding through `admin_set_organization_branding` and `admin_set_organization_branding_logo` after `requirePlatformAdmin()`. Those RPCs write `organization.branding_updated`, `organization.branding_logo_uploaded`, and `organization.branding_logo_removed` audit events. Metadata is limited to display name, colors, and whether a logo existed.
- Client owner/admin updates use the user-scoped client and RLS. Staff and managers cannot update branding. The organization id comes from `requireOrganizationRole()`, never from a client-supplied id.
- Colors must be `#RRGGBB`. `url(...)`, `javascript:`, HTML, CSS declarations, and CSS variables are rejected in application validation and by database checks.
- Logos accept PNG, JPEG, and WebP only. Magic bytes are checked server-side. Browser MIME types are not trusted. SVG is rejected. Maximum size is 2 MB.

## Storage

Private buckets: `organization-assets`, `property-media`, `guest-documents`, `organization-branding`.

Object keys must start with `organizations/{organizationId}/...`. Storage RLS uses that prefix. Signed URLs are issued server-side.

`organization-branding` is private. Members and support may read objects under their organization prefix. Owner/admin may write or delete only `.../branding/logo.{png|jpg|jpeg|webp}` under their own organization. Platform admins upload through the service-role client after `requirePlatformAdmin()`, never from the browser. Do not make this bucket public for a future Guest Portal; add a token-authorized signed URL helper instead.

## IDOR prevention

Lookups by UUID still pass through RLS. Requesting another organization's property, reservation, guest, issue, or file by id returns no row. Inserts that carry a foreign `organization_id` fail the policy. Cross-tenant foreign keys are rejected by consistency triggers.

## SECURITY DEFINER functions

Used only to avoid RLS recursion and to resolve hashed guest tokens:

- `current_user_organization_ids()`
- `current_user_has_org_role(org_id, roles)`
- `is_active_platform_admin()`
- `shares_organization_with(user_id)`
- `can_view_archived(org_id)`
- `has_active_support_access(org_id)`
- `admin_set_organization_subscription(...)`
- `admin_set_organization_branding(...)`
- `admin_set_organization_branding_logo(...)`
- `handle_new_user()`
- `resolve_guest_portal_token(hash)` — `service_role` only

Each sets `search_path = public` and is revoked from `PUBLIC`.

## Known limitations

- Support workspace access is read-only and session-scoped. It never inserts `organization_users`.
- `/g/[token]` currently validates token format only; reservation lookup uses `resolveGuestPortalToken()` when the guest portal is implemented.
- Subscription records are maintained manually by platform admins. Stripe and other payment providers are not integrated yet.
- Service role can still read all data; operators must treat that key as production-secret.
- Archived records are hidden from manager/staff by RLS, but remain visible to owner/admin.
- `createPrivateSignedUrl` now requires an authenticated organization membership derived from the object path. Guest-document signed URLs will need a separate, token-bound helper later.
- Workspace branding logos use a user-scoped signed URL plus storage RLS. Admin logo preview uses the service role only after `requirePlatformAdmin()`. Guest Portal logo rendering is not implemented yet.

## Testing

- `tests/security` — application-level isolation helpers and token rules
- `tests/db` — real PostgreSQL RLS, IDOR, role, and guest-token tests against local Supabase
