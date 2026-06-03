// ── Provider płatności: Stripe ───────────────────────────────────────────────
// Wymaga zmiennych: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PAYMENT_PROVIDER=stripe
// Webhook (raw body) montowany jest w index.ts na /api/billing/webhook.

import Stripe from 'stripe'
import type { PaymentProvider, CheckoutInput, CheckoutOutput, WebhookResult } from './payment'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')
const FRONTEND = process.env.FRONTEND_URL ?? 'https://project-z.cloud'

export const stripeProvider: PaymentProvider = {
  id: 'stripe',

  async createCheckout(input: CheckoutInput): Promise<CheckoutOutput> {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: input.currency.toLowerCase(),     // 'pln'
          product_data: { name: input.description },
          unit_amount: input.amountGrosze,             // grosze
        },
        quantity: 1,
      }],
      success_url: `${FRONTEND}/billing/return?order=${input.orderId}`,
      cancel_url:  `${FRONTEND}/billing/return?order=${input.orderId}&cancelled=1`,
      client_reference_id: input.orderId,
      metadata: { orderId: input.orderId, userId: input.userId },
    })
    return { checkoutUrl: session.url, providerRef: session.id, status: 'pending' }
  },

  async parseWebhook(headers: Record<string, string | undefined>, rawBody: Buffer): Promise<WebhookResult | null> {
    const sig = headers['stripe-signature']
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!sig || !secret) return null
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret)
    } catch {
      return null // nieprawidłowy podpis
    }

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session
      const orderId = (s.metadata?.orderId as string) || (s.client_reference_id as string)
      if (orderId && s.payment_status === 'paid') {
        return { orderId, status: 'paid', providerRef: s.id }
      }
    }
    if (event.type === 'checkout.session.expired') {
      const s = event.data.object as Stripe.Checkout.Session
      const orderId = (s.metadata?.orderId as string) || (s.client_reference_id as string)
      if (orderId) return { orderId, status: 'cancelled', providerRef: s.id }
    }
    return null
  },
}
