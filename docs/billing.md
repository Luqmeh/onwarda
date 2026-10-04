# Billing

Phase 6A is the provider-neutral billing foundation. There is no payment processor.

```
Onwarda
  ↓
Billing domain (`src/lib/billing`)
  ↓
PaymentProvider interface
  ↓
UnavailablePaymentProvider   ← current default
  ↓
Future: Payzone / CMI / Stripe adapter
```

The application works with zero payment configuration.

## Commercial identity

The **organization** is the customer. Do not add a separate billing-account table yet.

```
Organization
  ↓
organization_subscriptions   ← canonical commercial record
  ↓
Future provider customer
  ↓
Future provider subscription
```

Do not create `subscriptions_v2`, `plans_v2`, or `billing_accounts_v2`.

## Canonical sources

| Concern | Source |
| --- | --- |
| Public price list and plan catalog | `src/config/pricing.ts` |
| Selected plan ID and commercial status | `organization_subscriptions` |
| Subscription history | `organization_subscription_events` |
| Product telemetry | `events` |
| Administrator mutations | `audit_logs` |

Price display and indicative totals come from `pricing.ts`. The database stores a stable plan ID (`starter`, `professional`, `enterprise`, or admin-only `free`). It does not store calculated prices.

`free` exists as a hidden catalog entry so complimentary admin assignments have a name. It is not selectable at signup.

## Subscription status

`organization_subscriptions.status` is the commercial lifecycle:

| Status | Meaning in Phase 6A |
| --- | --- |
| `pending` | Expected state after signup. Plan selected. Not paid. Not activated. |
| `trialing` | Legacy / manual trial. Not created by signup. |
| `active` | Explicitly activated, usually by a platform administrator. **Not** payment confirmed. |
| `past_due` | Reserved for a future verified provider failure. |
| `grace_period` | Reserved for a future retry window. |
| `suspended` | Manual or future provider suspension. |
| `paused` | Legacy synonym kept for existing rows. Treat like suspended. |
| `cancelled` | Cancellation completed. The row is kept. |

`organizations.subscription_status` remains a separate coarse org-level flag (`none` / `trial` / `active` / `past_due` / `cancelled`). Do not treat it as the billing record.

**`active` is never created by signup, plan selection, organization creation, or a customer button.**

A customer may:

- select a plan on a pending subscription
- request a plan change on an activated subscription (`requested_plan`)
- request cancellation (`cancellation_requested_at`)
- withdraw that cancellation request

A customer may not set `active`, invent a price, invent a plan, or edit another organization.

## Request vs activate

`requestPlanChange("professional")` stores intent.

- Pending subscription: the selected plan updates. Status stays `pending`.
- Activated subscription: `requested_plan` is stored. Current plan and status do not change.

Cancellation is the same split: requested, then completed. No refunds.

## Workspace access vs billing status

`pending` is not `suspended`.

Phase 6A does **not** lock the client workspace because a subscription is pending. Operators need the workspace for onboarding and testing. Future production policy may restrict access after a payment provider exists. `doesBillingRestrictWorkspace()` currently always returns `false`.

## Payment provider

`PaymentProvider` in `src/lib/billing/provider.ts` is the extension point.

Current implementation: `UnavailablePaymentProvider`. Every method reports `Payment provider not configured.` It does not fake checkouts, webhooks, or successful payments.

Future adapters (`PayzoneProvider`, `CMIProvider`, `StripeProvider`) must:

- live behind this interface
- activate a subscription only after a verified server-side provider event
- write history with `source = provider` and a unique `provider_event_id`

Do not import payment SDKs or require their environment variables in this phase.

## Future provider status triggers

These transitions are documented, not automated:

| Future provider event | Subscription status |
| --- | --- |
| Verified activation / first paid invoice | `active` |
| Payment failed | `past_due` |
| Retry window still open | `grace_period` |
| Retry abandoned | `suspended` |
| Provider cancellation | `cancelled` |

Provider webhook processing must be idempotent via `organization_subscription_events.provider_event_id`. Phase 6A does not fabricate provider events.

## Indicative pricing

`calculatePlanPrice({ planId, activePropertyCount })` is preparation for later invoicing.

- Starter: 299 MAD / month
- Professional: 699 MAD / month + 39 MAD per active property
- Enterprise: 1290 MAD / month + 29 MAD per active property

The active-property count is derived from `properties` with `status = active`. The browser cannot supply the count or the total. The result is **indicative**. It is not an invoice and not a charge.

Only the existing monthly interval is priced. Yearly rows may exist on a subscription record; do not invent yearly public prices.

## Surfaces

- `/app/billing` — customer workspace. Owner/admin manage. Manager read-only. Staff hidden.
- `/admin/clients/[organizationId]` — platform admin. Manual plan/status changes are audited and written to history. Manual activation is **not** labeled payment confirmed.

Organization context is derived server-side. Do not trust `organization_id` from the browser.

## Event sources

Allowed history sources: `system`, `admin`, `customer`, `provider`.

Phase 6A writes `system`, `admin`, and `customer` only. Do not invent a provider source.

## What this phase does not do

- Stripe, CMI, Payzone, PayPal, or any gateway
- Checkout URLs, card capture, or webhook simulation that marks a subscription active
- Invoices, refunds, or contractual billing
- Yearly public pricing or discounts
- Automatic workspace lockouts from pending status
- Phase 6B
