import "server-only";

import { SUBSCRIPTION_HISTORY_EVENT_TYPES } from "@/lib/billing/types";

export const BILLING_EVENT_TYPES = SUBSCRIPTION_HISTORY_EVENT_TYPES;

export const FUTURE_PROVIDER_STATUS_TRIGGERS = {
  payment_failed: "past_due",
  payment_retry_window: "grace_period",
  payment_abandoned: "suspended",
  verified_activation: "active",
  provider_cancellation: "cancelled",
} as const;
