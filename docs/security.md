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

| Role | Organization settings | Property CMS | Operational writes | Issues | Delete important records |
| --- | --- | --- | --- | --- | --- |
| owner / admin | yes | yes | yes | yes | yes |
| manager | no | yes | yes | yes | no |
| staff | no | no | no | yes | no |

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
- guest token hash lookup through `inspect_guest_portal_token` / `resolve_guest_portal_token`
- guest stay reads and mutations after the token hash is authorized
- private signed URLs after a public slug or guest-token authorization RPC returns a path

Any service-role operation on tenant data must still authorize in application code first.

## Guest tokens

- Cryptographically random (`32` bytes, base64url)
- Stored only as SHA-256 hashes
- Compared with `timingSafeEqual` in application code
- Optionally expirable (`expires_at`) and revocable (`revoked_at`)
- Never include reservation IDs
- Resolved by `SECURITY DEFINER` functions granted only to `service_role`
- Guest mutations accept the token hash only. They never trust browser-supplied organization, property, reservation, or guest ids.

Anon and authenticated roles cannot call `resolve_guest_portal_token`, `inspect_guest_portal_token`, or guest mutation RPCs.

## Organization branding

- One `organization_branding` row per organization. Members and support can read their own row. Owner/admin can update it. Authenticated users cannot insert or delete rows; a trigger creates the default row.
- Platform admins change branding through `admin_set_organization_branding` and `admin_set_organization_branding_logo` after `requirePlatformAdmin()`. Those RPCs write `organization.branding_updated`, `organization.branding_logo_uploaded`, and `organization.branding_logo_removed` audit events. Metadata is limited to display name, colors, and whether a logo existed.
- Client owner/admin updates use the user-scoped client and RLS. Staff and managers cannot update branding. The organization id comes from `requireOrganizationRole()`, never from a client-supplied id.
- Colors must be `#RRGGBB`. `url(...)`, `javascript:`, HTML, CSS declarations, and CSS variables are rejected in application validation and by database checks.
- Logos accept PNG, JPEG, and WebP only. Magic bytes are checked server-side. Browser MIME types are not trusted. SVG is rejected. Maximum size is 2 MB.

## Storage

Private buckets: `organization-assets`, `property-media`, `guest-documents`, `organization-branding`.

Object keys must start with `organizations/{organizationId}/...`. Storage RLS uses that prefix. Signed URLs are issued server-side.

`property-media` objects must match `organizations/{organizationId}/properties/{propertyId}/media/{uuid}.{png|jpg|jpeg|webp}` and the property must belong to that organization. Owner, admin, and manager may upload, replace, or delete those objects. Staff cannot. Support mode may read them. Magic bytes are checked in application code; SVG, HTML, and executables are rejected. Maximum image size is 8 MB.

`organization-branding` and `property-media` stay private. Public pages authorize a logo or image through slug-scoped RPCs, then sign the returned path. Guest pages authorize through the token hash. Arbitrary storage paths from the browser are rejected.

## IDOR prevention

Lookups by UUID still pass through RLS. Requesting another organization's property, reservation, guest, issue, media, knowledge, house rule, or file by id returns no row. Inserts that carry a foreign `organization_id` fail the policy. Cross-tenant foreign keys are rejected by consistency triggers. Property media paths must include both the organization UUID and the property UUID; a Client A prefix with a Client B property id is rejected.

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
- `inspect_guest_portal_token(hash)` — `service_role` only
- `get_guest_stay_bundle(hash)` and guest mutation RPCs — `service_role` only
- `get_public_operator_portfolio(slug)` / `get_public_property_showcase(org_slug, property_slug)` — `anon` and `authenticated`, public fields only
- `authorize_public_property_media` / `authorize_public_operator_logo` — path only, after slug checks
- `record_public_event` — allowlisted public event types derived from slugs

Each sets `search_path = public` and is revoked from `PUBLIC`. Do not grant `anon` SELECT on tenant tables.

## Known limitations

- Support workspace access is read-only and session-scoped. It never inserts `organization_users`.
- Subscription records are maintained manually by platform admins. Stripe and other payment providers are not integrated yet.
- Service role can still read all data; operators must treat that key as production-secret.
- Archived records are hidden from manager/staff by RLS, but remain visible to owner/admin.
- Guest ID/document upload is not implemented. The `guest-documents` bucket remains private.
- Inspecting a guessed token that does not match a stored hash returns the same invalid state as a malformed token. Expired and revoked are distinguished only after a hash match.

## Testing

- `tests/security` — application-level isolation helpers and token rules
- `tests/db` — real PostgreSQL RLS, IDOR, role, and guest-token tests against local Supabase
