// ── Warstwa płatności (pluggable) ────────────────────────────────────────────
// Aby podpiąć realną bramkę (Stripe / Przelewy24 / PayU), wystarczy zaimplementować
// PaymentProvider i wskazać go w getPaymentProvider() przez zmienną środowiskową.

export interface CheckoutInput {
  orderId:      string
  amountGrosze: number
  currency:     string
  description:  string
  userId:       string
}

export interface CheckoutOutput {
  // Gdy bramka aktywna — URL do przekierowania klienta. null = brak procesora
  // (zamówienie pozostaje 'pending').
  checkoutUrl: string | null
  providerRef: string | null
  status:      'pending' | 'paid'
}

export interface WebhookResult {
  orderId:     string
  status:      'paid' | 'failed' | 'cancelled'
  providerRef: string | null
}

export interface PaymentProvider {
  readonly id: string
  createCheckout(input: CheckoutInput): Promise<CheckoutOutput>
  // Weryfikuje i parsuje webhook od operatora. null = nierozpoznany/niezweryfikowany.
  parseWebhook(headers: Record<string, string | undefined>, rawBody: Buffer): Promise<WebhookResult | null>
}

// ── Stub — brak realnej bramki. Zamówienia zostają 'pending'. ────────────────
// PODMIEŃ na implementację operatora płatności.
export const stubPaymentProvider: PaymentProvider = {
  id: 'stub',
  async createCheckout(): Promise<CheckoutOutput> {
    return { checkoutUrl: null, providerRef: null, status: 'pending' }
  },
  async parseWebhook(): Promise<WebhookResult | null> {
    return null
  },
}

export function getPaymentProvider(): PaymentProvider {
  // switch (process.env.PAYMENT_PROVIDER) {
  //   case 'stripe':      return stripeProvider
  //   case 'przelewy24':  return p24Provider
  //   case 'payu':        return payuProvider
  // }
  return stubPaymentProvider
}
