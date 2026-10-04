import {
  ClientPageHeader,
  ClientSectionCard,
  ClientStatusBadge,
} from "@/components/workspace/client-ui";
import {
  CustomerCancellationForm,
  CustomerPlanForm,
} from "@/components/workspace/billing-forms";
import { canManageBilling, canViewBilling } from "@/config/client";
import { getCommercialPlan, formatPlanPrice } from "@/config/pricing";
import { getWorkspaceBillingSnapshot } from "@/lib/billing/service";
import {
  customerPlanChangeAppliesImmediately,
  subscriptionStatusLabel,
} from "@/lib/billing/status";
import { formatIndicativePrice } from "@/lib/billing/plans";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { formatDate, formatDateTime } from "@/lib/workspace/format";

export const metadata = {
  title: "Billing",
};

const NOTICE_COPY: Record<string, string> = {
  "plan-updated": "Selected plan updated. The subscription is still waiting for payment configuration.",
  "plan-change-requested": "Plan change requested. The current plan is unchanged until billing can apply it.",
  "cancellation-requested": "Cancellation requested. The subscription record is still here.",
  "cancellation-withdrawn": "Cancellation request withdrawn.",
};

export default async function ClientBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const view = await requireWorkspaceView();
  const role = view.kind === "membership" ? view.context.membership.role : null;
  const canView = view.kind === "support" || (role ? canViewBilling(role) : false);
  const canManage = view.kind === "membership" && role ? canManageBilling(role) : false;

  if (!canView) {
    return (
      <ClientSectionCard title="Billing">
        <p className="text-sm text-onwarda-muted">
          Billing is available to owners, admins, and managers.
        </p>
      </ClientSectionCard>
    );
  }

  const billing = await getWorkspaceBillingSnapshot(view);
  const plan = billing.subscription ? getCommercialPlan(billing.subscription.plan) : null;
  const query = await searchParams;
  const notice = query.notice ? NOTICE_COPY[query.notice] : null;
  const appliesImmediately = customerPlanChangeAppliesImmediately(
    billing.subscription?.status,
  );

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker="Workspace"
        title="Billing"
        description="Subscription status for this organization. Payment processing is not connected yet."
      />
      {notice ? (
        <p className="rounded-lg border bg-onwarda-white px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      ) : null}

      <ClientSectionCard
        title="Current subscription"
        description="This is the commercial record for your organization. It is not a payment receipt."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Current plan</dt>
            <dd className="mt-1 font-medium">{plan?.name ?? billing.subscription?.plan ?? "None"}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Status</dt>
            <dd className="mt-1">
              <ClientStatusBadge
                label={billing.status.label}
                tone={billing.status.isPendingSetup ? "neutral" : billing.status.isActivated ? "olive" : "coral"}
              />
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Billing interval</dt>
            <dd className="mt-1 font-medium capitalize">
              {billing.interval ?? "Not scheduled"}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Subscription start</dt>
            <dd className="mt-1 font-medium">
              {billing.subscription?.started_at
                ? formatDate(billing.subscription.started_at)
                : "Not started"}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Next billing date</dt>
            <dd className="mt-1 font-medium">
              {billing.subscription?.renews_at && billing.status.isActivated
                ? formatDate(billing.subscription.renews_at)
                : "Unknown until billing is configured"}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Created</dt>
            <dd className="mt-1 font-medium">
              {billing.subscription?.created_at
                ? formatDateTime(billing.subscription.created_at)
                : "No record yet"}
            </dd>
          </div>
        </dl>
        <div className="mt-5 space-y-2 text-sm">
          <p className="font-medium">{billing.status.description}</p>
          <p className="text-onwarda-muted">{billing.status.nextStep}</p>
          {plan ? (
            <p className="text-onwarda-muted">
              {plan.description} {formatPlanPrice(plan)}.
            </p>
          ) : null}
        </div>
      </ClientSectionCard>

      <ClientSectionCard
        title="Indicative amount"
        description="Prepared from the published price list and the current active-property count. This is not an invoice."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Active properties</dt>
            <dd className="mt-1 font-medium">{billing.activePropertyCount}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Indicative monthly total</dt>
            <dd className="mt-1 font-medium">
              {billing.price ? formatIndicativePrice(billing.price) : "No published plan to calculate"}
            </dd>
          </div>
        </dl>
        {billing.requestedPlan ? (
          <p className="mt-4 text-sm text-onwarda-muted">
            Requested plan: {getCommercialPlan(billing.requestedPlan)?.name ?? billing.requestedPlan}.
            This request is not billed.
          </p>
        ) : null}
      </ClientSectionCard>

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ClientSectionCard title="Plan">
            <CustomerPlanForm
              currentPlan={billing.subscription?.plan ?? null}
              appliesImmediately={appliesImmediately}
            />
          </ClientSectionCard>
          <ClientSectionCard title="Cancellation">
            <CustomerCancellationForm
              cancellationRequested={billing.status.cancellationRequested}
            />
          </ClientSectionCard>
        </div>
      ) : (
        <ClientSectionCard title="Billing actions">
          <p className="text-sm text-onwarda-muted">
            Owners and admins can request plan changes or cancellation. Managers have read-only
            visibility.
          </p>
        </ClientSectionCard>
      )}

      <ClientSectionCard
        title="History"
        description="Organization-scoped subscription history. Provider webhook events are not recorded yet."
      >
        {billing.history.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No subscription history yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {billing.history.map((event) => (
              <li key={event.id} className="rounded-lg border px-3 py-2">
                <p className="font-medium">{event.event_type.replaceAll("_", " ")}</p>
                <p className="text-onwarda-muted">
                  {formatDateTime(event.created_at)} · {event.source}
                  {event.previous_status || event.new_status
                    ? ` · ${subscriptionStatusLabel(event.previous_status)} → ${subscriptionStatusLabel(event.new_status)}`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ClientSectionCard>
    </div>
  );
}
