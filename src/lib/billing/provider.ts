import { AppError } from "@/lib/errors";
import {
  PAYMENT_PROVIDER_UNAVAILABLE,
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type ProviderCustomer,
  type ProviderSubscriptionChange,
  type WebhookVerificationInput,
} from "@/lib/billing/types";

export class PaymentProviderUnavailableError extends AppError {
  constructor(message = PAYMENT_PROVIDER_UNAVAILABLE) {
    super("payment_provider_unavailable", message, 503);
    this.name = "PaymentProviderUnavailableError";
  }
}

export class UnavailablePaymentProvider implements PaymentProvider {
  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    void input;
    throw new PaymentProviderUnavailableError();
  }

  async retrieveCheckout(checkoutId: string): Promise<CheckoutSession> {
    void checkoutId;
    throw new PaymentProviderUnavailableError();
  }

  async cancelSubscription(organizationId: string): Promise<void> {
    void organizationId;
    throw new PaymentProviderUnavailableError();
  }

  async changeSubscription(input: ProviderSubscriptionChange): Promise<void> {
    void input;
    throw new PaymentProviderUnavailableError();
  }

  async getCustomer(organizationId: string): Promise<ProviderCustomer> {
    void organizationId;
    throw new PaymentProviderUnavailableError();
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<{ eventId: string }> {
    void input;
    throw new PaymentProviderUnavailableError();
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new UnavailablePaymentProvider();
}

export function isPaymentProviderConfigured() {
  return false;
}
