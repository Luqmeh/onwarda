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
import { getRequestI18n } from "@/i18n/get-locale";
import { clientMetadata } from "@/i18n/page-title";
import { formattingLocale } from "@/i18n/locale";
import { requireWorkspaceView } from "@/lib/tenancy/workspace-access";
import { formatDate, formatDateTime } from "@/lib/workspace/format";

export async function generateMetadata() {
  return clientMetadata((messages) => ({ title: messages.titles.billing }));
}

export default async function ClientBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ locale, messages }, view] = await Promise.all([
    getRequestI18n(),
    requireWorkspaceView(),
  ]);
  const dates = formattingLocale(locale);
  const role = view.kind === "membership" ? view.context.membership.role : null;
  const canView = view.kind === "support" || (role ? canViewBilling(role) : false);
  const canManage = view.kind === "membership" && role ? canManageBilling(role) : false;

  if (!canView) {
    return (
      <ClientSectionCard title={messages.nav.billing}>
        <p className="text-sm text-onwarda-muted">
          Billing is available to owners, admins, and managers.
        </p>
      </ClientSectionCard>
    );
  }

  const billing = await getWorkspaceBillingSnapshot(view);
  const plan = billing.subscription ? getCommercialPlan(billing.subscription.plan) : null;
  const query = await searchParams;
  const billingNotices: Record<string, string> = {
    "plan-updated": messages.screens.planUpdated,
    "plan-change-requested": messages.screens.planChangeRequested,
    "cancellation-requested": messages.screens.cancellationRequested,
    "cancellation-withdrawn": messages.screens.cancellationWithdrawn,
  };
  const notice = query.notice ? billingNotices[query.notice] : null;
  const appliesImmediately = customerPlanChangeAppliesImmediately(
    billing.subscription?.status,
  );

  return (
    <div className="space-y-6">
      <ClientPageHeader
        kicker={messages.screens.workspaceKicker}
        title={messages.nav.billing}
        description={messages.screens.billingIntro}
      />
      {notice ? (
        <p className="rounded-lg border bg-onwarda-white px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      ) : null}

      <ClientSectionCard
        title={messages.screens.currentSubscription}
        description={messages.screens.currentSubscriptionHelp}
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
              {billing.interval ?? messages.screens.notScheduled}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Subscription start</dt>
            <dd className="mt-1 font-medium">
              {billing.subscription?.started_at
                ? formatDate(billing.subscription.started_at, dates)
                : messages.screens.notStartedYet}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Next billing date</dt>
            <dd className="mt-1 font-medium">
              {billing.subscription?.renews_at && billing.status.isActivated
                ? formatDate(billing.subscription.renews_at, dates)
                : messages.screens.unknownUntilBilling}
            </dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Created</dt>
            <dd className="mt-1 font-medium">
              {billing.subscription?.created_at
                ? formatDateTime(billing.subscription.created_at, dates)
                : messages.screens.noRecordYet}
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
        title={messages.screens.indicativeAmount}
        description={messages.screens.indicativeAmountHelp}
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-onwarda-muted">Active properties</dt>
            <dd className="mt-1 font-medium">{billing.activePropertyCount}</dd>
          </div>
          <div>
            <dt className="text-onwarda-muted">Indicative monthly total</dt>
            <dd className="mt-1 font-medium">
              {billing.price ? formatIndicativePrice(billing.price) : messages.screens.noPublishedPlan}
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
          <ClientSectionCard title={messages.screens.cancellation}>
            <CustomerCancellationForm
              cancellationRequested={billing.status.cancellationRequested}
            />
          </ClientSectionCard>
        </div>
      ) : (
        <ClientSectionCard title={messages.screens.billingActions}>
          <p className="text-sm text-onwarda-muted">
            Owners and admins can request plan changes or cancellation. Managers have read-only
            visibility.
          </p>
        </ClientSectionCard>
      )}

      <ClientSectionCard
        title={messages.screens.history}
        description={messages.screens.historyHelp}
      >
        {billing.history.length === 0 ? (
          <p className="text-sm text-onwarda-muted">No subscription history yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {billing.history.map((event) => (
              <li key={event.id} className="rounded-lg border px-3 py-2">
                <p className="font-medium">{event.event_type.replaceAll("_", " ")}</p>
                <p className="text-onwarda-muted">
                  {formatDateTime(event.created_at, dates)} · {event.source}
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
