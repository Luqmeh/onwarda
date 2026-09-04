# Architecture

Onwarda is a modular monolith. One Next.js application and one PostgreSQL database serve three security contexts.

```
                 ONWARDA
                    |
        +-----------+-----------+
        |                       |
  INTERNAL ADMIN          CLIENT PLATFORM
                                    |
                      +-------------+-------------+
                      |             |             |
                   CLIENT A      CLIENT B      CLIENT C
                      |             |             |
                   guests        guests        guests
```

## Application contexts

- `/admin/*` — Onwarda internal admin. Platform administrators only.
- `/app/*` — Client operator workspace. Organization-scoped.
- `/o/[slug]` — Slug-based client access point. The organization UUID is the canonical identity.
- `/g/[token]` — Guest portal. Opaque reservation tokens, no Onwarda user account.

The proxy layer (`src/proxy.ts`) performs session refresh and optimistic redirects. It is not the authorization boundary.

Authorization is enforced in server-side modules:

- `requireUser()`
- `requirePlatformAdmin()`
- `requireCurrentOrganization()`
- `requireOrganizationMembership()`
- `requireOrganizationRole()`
- `requireWorkspaceView()` / `resolveValidSupportWorkspace()`

React components do not decide access.

## Project layout

```
src/
  app/           Route handlers and pages
  components/    UI by context
  config/        App and environment configuration
  features/      Feature-specific UI
  i18n/          Locale catalogs and RTL helpers
  lib/           Auth, tenancy, validation, storage
  types/         Shared domain types
tests/
  security/      Isolation and token tests
  unit/          Schema and config tests
  db/            Real PostgreSQL RLS and IDOR tests
supabase/
  migrations/    Versioned SQL
```

Authorization is enforced twice: server helpers and PostgreSQL RLS. The UI is not a control.

## Organization branding

Each organization has exactly one `organization_branding` row. `organizations.id` remains the tenant identity. Branding is presentation data: display name, private logo path, and validated hex colors.

The Client Workspace reads branding through the user-scoped Supabase client and applies centralized tokens (`--client-primary`, `--client-secondary`, `--client-accent`, `--client-background`). Onwarda design-system colors are the fallback when a field is empty. Internal Admin stays neutral and configures branding during onboarding and from `/admin/clients/[organizationId]`.

Logos are stored in the private `organization-branding` bucket at `organizations/{organization_id}/branding/logo.{png|jpg|jpeg|webp}`. The database stores only that path. Uploaded files are treated as untrusted rasters and rendered with `<img>`, never as inline SVG or HTML.

A future Guest Portal at `/g/{token}` should resolve `reservation → organization → organization_branding` after the opaque token is authorized. Do not make the branding bucket public; issue a token-bound signed URL later. Property-specific brand overrides are not modeled yet and should hang off `properties` when added, not replace organization branding.

## Hosting and URLs

`NEXT_PUBLIC_APP_URL` is the only origin used to build links.

Current client URL shape:

`{APP_URL}/o/{slug}`

The resolver is isolated so later versions can add:

- `{slug}.onwarda.com`
- customer custom domains

Do not hard-code production hostnames in feature code.

## Internationalization

English, French, and Arabic catalogs live in `src/i18n/messages`. Arabic is RTL-capable through `getTextDirection()`. Full translation coverage is not part of this milestone.

## Client operations

The Client Workspace now has operational detail routes for properties, reservations, and guests:

- `/app/properties/[propertyId]`
- `/app/reservations/new`
- `/app/reservations/[reservationId]`
- `/app/guests/[guestId]`

Organization context always comes from membership (or support-mode read access). Property create/edit is owner/admin. Reservation and guest writes are owner/admin/manager. Staff remain read-only except for issues.

## What is not built yet

Guest Portal UI, guest authentication, PMS/OTA integrations, Stripe, smart locks, AI guest agent, advanced CRM/analytics, property-specific branding overrides, custom domains, and white-label billing.
