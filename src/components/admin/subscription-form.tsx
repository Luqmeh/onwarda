"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setOrganizationSubscriptionAction,
} from "@/lib/admin/subscriptions";
import type { AdminMutationState } from "@/lib/admin/provision";
import {
  BILLING_INTERVALS,
  ORGANIZATION_PLANS,
  ORGANIZATION_SUBSCRIPTION_STATUSES,
} from "@/types/enums";
import type { OrganizationSubscription } from "@/types/database";

const initialState: AdminMutationState = {};

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function OrganizationSubscriptionForm({
  organizationId,
  subscription,
}: {
  organizationId: string;
  subscription: OrganizationSubscription | null;
}) {
  const [state, formAction, pending] = useActionState(
    setOrganizationSubscriptionAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Plan</span>
          <select
            name="plan"
            defaultValue={subscription?.plan ?? "free"}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {Object.values(ORGANIZATION_PLANS).map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Subscription status</span>
          <select
            name="status"
            defaultValue={subscription?.status ?? "pending"}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {Object.values(ORGANIZATION_SUBSCRIPTION_STATUSES).map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Billing interval</span>
          <select
            name="billingInterval"
            defaultValue={subscription?.billing_interval ?? "month"}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {Object.values(BILLING_INTERVALS).map((interval) => (
              <option key={interval} value={interval}>
                {interval}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="startedAt">Started</Label>
          <Input
            id="startedAt"
            name="startedAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(subscription?.started_at)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="renewsAt">Renews</Label>
          <Input
            id="renewsAt"
            name="renewsAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(subscription?.renews_at)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cancelledAt">Cancelled</Label>
          <Input
            id="cancelledAt"
            name="cancelledAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(subscription?.cancelled_at)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Manual subscription record only. Setting a status to active is an administrator
        activation, not payment confirmation. No payment provider is connected.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save subscription"}
      </Button>
    </form>
  );
}
