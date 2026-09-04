# Onwarda

Onwarda is a multi-tenant SaaS platform for hospitality and property operators.

This repository is being built from zero. The current milestone is the **project foundation**: Next.js, Supabase, authentication boundaries, tenant isolation primitives, and the three application contexts.

## Product contexts

| Context | Route | Audience |
| --- | --- | --- |
| Internal Admin | `/admin` | Onwarda platform operators |
| Client workspace | `/app` | Organization users |
| Client access URL | `/o/[slug]` | Organization entry point |
| Guest portal | `/g/[token]` | Reservation guests |

These are security contexts inside one application, not three products.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Supabase (Auth, PostgreSQL, Storage)
- Zod 4
- Vitest

## Setup

1. Copy `.env.example` to `.env.local` and add your Supabase project values.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run dev
```

## Local Supabase

Docker Desktop must be running.

```bash
npx supabase start
npx supabase db reset
```

Then copy the local keys from `npx supabase status` into `.env.local`.

### Local platform administrator

This bootstrap is **local-development-only**. It refuses to run against a hosted or production Supabase project. It does not bypass Auth, RLS, or `requirePlatformAdmin()`.

```bash
npm run bootstrap:admin
```

It creates or reuses the local Onwarda platform administrator so you can sign in at `/admin/login`. Credentials are read from `.env.local` (`ONWARDA_DEV_ADMIN_EMAIL` and `ONWARDA_DEV_ADMIN_PASSWORD`). Never commit `.env.local` or use this mechanism in production.

### Local client user

This bootstrap is also **local-development-only**. It refuses hosted Supabase, refuses platform-admin accounts, and attaches the user to one selected organization.

```bash
npm run bootstrap:client
```

Credentials and target tenant come from `.env.local` or CLI arguments:

- `ONWARDA_DEV_CLIENT_EMAIL` or `--email`
- `ONWARDA_DEV_CLIENT_PASSWORD` or `--password`
- `ONWARDA_DEV_CLIENT_ORG_SLUG` or `--org` (defaults to `riad-atlas`)
- `ONWARDA_DEV_CLIENT_ROLE` or `--role` (defaults to `owner`)

Example: create a local owner for Riad Atlas, then sign in at `/login`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit, security, and database RLS tests |
| `npm run test:db` | PostgreSQL RLS / IDOR tests only |
| `npm run bootstrap:admin` | Create or reuse the local platform administrator (local Supabase only) |
| `npm run bootstrap:client` | Create or reuse a local client user for a selected organization (local Supabase only) |

## Environment variables

| Name | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Public anon key, RLS-enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged admin operations |
| `NEXT_PUBLIC_APP_URL` | Browser + server | Canonical app origin for links |

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Documentation

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Tenancy](docs/tenancy.md)
- [Database](docs/database.md)

## Current milestone

Client authentication, `/app` workspace, Internal Admin client control, support-mode workspace access, and a subscription foundation. Payment processing and the Guest Portal are not built yet.
