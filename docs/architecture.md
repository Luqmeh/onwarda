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
- `/app/*` — Client operator workspace. Organization-scoped. Visual system: [client-workspace.md](./client-workspace.md). `/app/billing` is the customer subscription page.
- `/o/[slug]` — Slug-based client access point. The organization UUID is the canonical identity.
- `/g/[token]` — Guest portal. Opaque reservation tokens, no Onwarda user account.
- `/cleaner/[token]` — Permanent cleaner profile link. Not an Onwarda user. Not a per-task URL.
- `/p/[organizationSlug]` — Public operator portfolio. Active, listed properties only.
- `/p/[organizationSlug]/[propertySlug]` — Public property showcase. Slugs only; no UUIDs.
- `/`, `/product`, `/pricing`, `/signup`, and related marketing routes — Onwarda company website. Not tenant-scoped.

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

The Guest Portal at `/g/{token}` resolves `token → reservation → guest → property → organization → organization_branding` after the opaque token is authorized. Public pages resolve `organization slug → organization → public property slug`. Do not make branding or property-media buckets public; issue slug-authorized or token-authorized signed URLs. Property-specific brand overrides are not modeled yet and should hang off `properties` when added, not replace organization branding. `organization_branding.public_description` is optional public copy for the operator portfolio.

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

- `/app/properties/[propertyId]` — Property CMS (canonical property content)
- `/app/reservations/new`
- `/app/reservations/[reservationId]`
- `/app/guests/[guestId]`

The **property is the canonical content object**. Name, type, location, amenities, house rules, arrival/access notes, instructions, and media are entered once in the Property CMS and reused by the Client Workspace, the public operator portfolio, the public property page, and the Guest Portal. Do not invent parallel content models.

Organization context always comes from membership (or support-mode read access). Property create is owner/admin. Property CMS content (including media and knowledge) is owner/admin/manager. Reservation and guest writes are owner/admin/manager. Staff remain read-only except for issues.

Content visibility is explicit: `public`, `guest`, or `private`. Server-side loaders `getPublicPropertyContent()` and `getGuestPropertyContent()` project a CMS snapshot. They never return internal identifiers, private notes, or guest-only access secrets on the public projection. Do not load everything and hide fields in React.

The operations calendar on `/app` and `/app/calendar` is a read-only projection in the same spirit. `getWorkspaceCalendar()` derives a property-row timeline from `properties`, `reservations`, and `cleaning_tasks`. It owns no tables and writes nothing, so reservations and cleaning tasks stay the single source of truth for what is booked and what needs turning over. See `docs/client-workspace.md`.

## Public and guest surfaces

Public pages call SECURITY DEFINER RPCs (`get_public_operator_portfolio`, `get_public_property_showcase`) granted to `anon`/`authenticated`, then project with `getPublicPropertyContent()`. Guest pages hash the URL token and call service-role-only RPCs (`inspect_guest_portal_token`, `get_guest_stay_bundle`, guest mutations), then project with `getGuestPropertyContent()`. Neither surface queries tenant tables as `anon`.

The guest portal journey is a server-side projection (`getGuestJourney()`) over existing reservation timestamps and guest-visible CMS data. It does not add a second journey store. House rules are required only when guest-visible rules exist; visiting a page does not complete a step.

A property is public only when `status = active` and `is_listed_publicly = true`. `properties.slug` is the public property identifier within an organization.

## What is not built yet

PMS/OTA integrations, Stripe / CMI / Payzone / any card processor, smart-lock APIs, AI guest agent, advanced CRM/analytics, property-specific branding overrides, custom domains, ID document upload, invoices, contractual recurring billing, cleaner accounts, and cleaning notifications. The public booking CTA is an optional https URL, not a payment engine.

Guest checkout creates one cleaning task and a property hold. Cleaners use one revocable `/cleaner/[token]` link. See [cleaning.md](./cleaning.md).

Billing is provider-neutral. `organization_subscriptions` is the canonical commercial record. `src/config/pricing.ts` is the canonical price catalog. `src/lib/billing` talks to a `PaymentProvider` interface whose current implementation is `UnavailablePaymentProvider`. `active` means explicitly activated, not “plan selected.” See [billing.md](./billing.md).
