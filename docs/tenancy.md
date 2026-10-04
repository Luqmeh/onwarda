# Tenancy

Onwarda uses one PostgreSQL database and strict logical multi-tenancy.

`organizations.id` is the only tenant identity. Slugs and URLs are routing identifiers.

## Model

```
organizations
    └── organization_branding   (exactly one; default client brand)
    └── organization_users
    └── properties              (canonical CMS object)
          └── property_languages
          └── property_amenities
          └── property_house_rules
          └── property_content     (visibility: public | guest | private)
          └── property_media       (images in Storage; external https URLs)
          └── property_knowledge   (instructions; visibility + published state)
          └── reservations  → guests (organization-scoped, many reservations)
          └── guest_portal_tokens
          └── guest_rule_acceptances
          └── issues
          └── property_cleaning_agents
          └── cleaning_tasks
                └── cleaning_task_items
          └── (future) optional property branding override — not implemented
    └── cleaning_agents
          └── cleaning_agent_links   (hash only; one active link)
    └── events
```

Every organization-owned row has `organization_id`. Branding is organization-scoped, not a second tenant identity.

The Guest Portal resolves `token → reservation → organization → organization_branding` and then `getGuestPropertyContent(property)`. Public routes are `/p/{organizationSlug}` and `/p/{organizationSlug}/{propertySlug}` and use `getPublicPropertyContent(property)` after slug-scoped RPCs. `/o/{slug}` remains the operator workspace entry. Storage paths may include the internal organization UUID. Internal identifiers, private notes, and guest-only access fields must not appear in public-safe loaders.

## Membership

Users join an organization through `organization_users`.

Roles: `owner`, `admin`, `manager`, `staff`.

A user may have memberships in more than one organization later. The application still fails closed if multiple **active** memberships exist, so the product cannot silently merge tenants.

Platform administrators are not organization members by default.

## Resolution

```
authenticated user
    → organization_users (active)
    → organization.id
    → allowed rows
```

Server helpers:

| Helper | Behavior |
| --- | --- |
| `getCurrentOrganization()` | Active membership + organization, or `null` |
| `requireCurrentOrganization()` | Same, fail closed |
| `requireOrganizationMembership(id)` | Rejects a foreign organization |
| `requireOrganizationRole(roles)` | Membership plus role |
| `resolveTrustedOrganizationId()` | Rejects a client-supplied foreign id |

RLS uses the same membership source through `current_user_organization_ids()`.

## Soft deletion

Important entities are archived, suspended, cancelled, or revoked instead of being hard-deleted.

- organizations / properties / property_knowledge: `archived`
- organization_users: `suspended`
- reservations: `cancelled`
- guest portal tokens: `revoked_at`

Normal member queries do not return archived properties or knowledge unless the caller is owner/admin.

## Support access

Support mode is an explicit, time-limited platform-admin session stored in `support_sessions`.

It must:

- verify a platform administrator
- require confirmation and a reason
- create a support session with start, expiry, and end
- write `support_session.started` / `support_session.ended` audit logs
- show a visible support-mode banner in Internal Admin
- never insert `organization_users` rows
- never authorize with `?organizationId=`

Support mode does not make the administrator a client user and does not disable RLS. When a valid support session exists, `has_active_support_access(organization_id)` may grant **read** access to that organization's tenant rows only. Writes still require a real `organization_users` membership. The organization always comes from the support session, never from `?organizationId=`.
