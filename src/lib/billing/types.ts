import type {
  BillingInterval,
  OrganizationPlan,
  OrganizationSubscriptionStatus,
} from "@/types/enums";
import type {
  OrganizationSubscription,
  OrganizationSubscriptionEvent,
} from "@/types/database";

export const BILLING_SOURCES = {
  SYSTEM: "system",
  ADMIN: "admin",
  CUSTOMER: "customer",
  PROVIDER: "provider",
} as const;

export type BillingSource = (typeof BILLING_SOURCES)[keyof typeof BILLING_SOURCES];

export const SUBSCRIPTION_HISTORY_EVENT_TYPES = {
  CREATED: "subscription.created",
  PLAN_SELECTED: "subscription.plan_selected",
  PLAN_CHANGE_REQUESTED: "subscription.plan_change_requested",
  STATUS_CHANGED: "subscription.status_changed",
  SUSPENDED: "subscription.suspended",
  REACTIVATED: "subscription.reactivated",
  CANCELLED: "subscription.cancelled",
  CANCELLATION_REQUESTED: "subscription.cancellation_requested",
  CANCELLATION_COMPLETED: "subscription.cancellation_completed",
  ADMIN_UPDATED: "subscription.admin_updated",
} as const;

export type SubscriptionHistoryEventType =
  (typeof SUBSCRIPTION_HISTORY_EVENT_TYPES)[keyof typeof SUBSCRIPTION_HISTORY_EVENT_TYPES];

export const PAYMENT_PROVIDER_UNAVAILABLE = "Payment provider not configured.";

export type PlanPriceProjection = {
  planId: OrganizationPlan;
  currency: "MAD";
  billingInterval: "month";
  baseAmount: number;
  perPropertyAmount: number | null;
  activePropertyCount: number;
  variableAmount: number;
  indicativeTotal: number;
  indicative: true;
};

export type BillingStatusProjection = {
  status: OrganizationSubscriptionStatus | null;
  label: string;
  description: string;
  nextStep: string;
  isPendingSetup: boolean;
  isActivated: boolean;
  cancellationRequested: boolean;
  restrictsWorkspace: boolean;
};

export type BillingSnapshot = {
  organizationId: string;
  organizationName: string;
  subscription: OrganizationSubscription | null;
  history: OrganizationSubscriptionEvent[];
  activePropertyCount: number;
  price: PlanPriceProjection | null;
  status: BillingStatusProjection;
  interval: BillingInterval | null;
  requestedPlan: OrganizationPlan | null;
  paymentProviderConfigured: false;
};

export type CheckoutInput = {
  organizationId: string;
  planId: OrganizationPlan;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  id: string;
  url: string;
  status: string;
};

export type ProviderCustomer = {
  id: string;
  organizationId: string;
};

export type ProviderSubscriptionChange = {
  organizationId: string;
  planId: OrganizationPlan;
};

export type WebhookVerificationInput = {
  payload: string;
  signature: string;
};

export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  retrieveCheckout(checkoutId: string): Promise<CheckoutSession>;
  cancelSubscription(organizationId: string): Promise<void>;
  changeSubscription(input: ProviderSubscriptionChange): Promise<void>;
  getCustomer(organizationId: string): Promise<ProviderCustomer>;
  verifyWebhook(input: WebhookVerificationInput): Promise<{ eventId: string }>;
}
