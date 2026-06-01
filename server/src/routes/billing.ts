import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'
import {
  SLOT_TIERS, getTierForSlots, isExactTier, tierPrice,
  isBillingEnabled, publicSlotCatalog, type BillingPeriod,
} from '../config/plans'
import { getPaymentProvider } from '../services/payment'
import { getProvisioningProvider } from '../services/provisioning'
import { serverQueries } from '../db/queries'

const router = Router()

async function isDevOrCreator(userId: string): Promise<boolean> {
  const row = await queryOne<{ is_dev: number; is_creator: number }>(
    'SELECT is_dev, COALESCE(is_creator, 0) AS is_creator FROM users WHERE id = ?', [userId]
  )
  return !!(row && (row.is_dev || row.is_creator))
}

// Dostęp dozwolony, gdy płatności włączone globalnie LUB użytkownik to dev/creator.
async function billingAccess(userId: string): Promise<boolean> {
  if (isBillingEnabled()) return true
  return isDevOrCreator(userId)
}

// Uruchamia provisioning dla opłaconego zamówienia i aktualizuje jego status.
async function runProvisioning(order: any): Promise<{ status: string; serverId?: string }> {
  const tier = getTierForSlots(Number(order.slots) || SLOT_TIERS[0].slots)
  let meta: any = {}
  try { meta = order.meta ? (typeof order.meta === 'string' ? JSON.parse(order.meta) : order.meta) : {} } catch {}
  const provider = getProvisioningProvider()
  const result = await provider.provision({
    orderId: order.id,
    userId: order.user_id,
    tier,
    meta: { name: meta.name ?? 'Serwer', iconColor: meta.iconColor ?? null, description: meta.description ?? null },
  })
  if (result.status === 'provisioned') {
    await execute('UPDATE billing_orders SET status = ?, server_id = ?, provider = ? WHERE id = ?',
      ['provisioned', result.serverId ?? null, provider.id, order.id])
  } else {
    await execute('UPDATE billing_orders SET status = ?, provider = ? WHERE id = ?',
      ['paid', provider.id, order.id])
  }
  return { status: result.status, serverId: result.serverId }
}

// ── Katalog slotów ───────────────────────────────────────────────────────────
router.get('/plans', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await billingAccess(req.user!.userId))) {
      return res.status(403).json({ error: 'Funkcja niedostępna', billingEnabled: false })
    }
    return res.json({ billingEnabled: isBillingEnabled(), ...publicSlotCatalog() })
  } catch (err) {
    console.error('[billing/plans]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Checkout — wybór liczby slotów ───────────────────────────────────────────
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    if (!(await billingAccess(userId))) {
      return res.status(403).json({ error: 'Funkcja niedostępna' })
    }

    const { slots, period, name, iconColor, description } = req.body as {
      slots?: number; period?: BillingPeriod; name?: string; iconColor?: string; description?: string
    }

    const slotCount = Number(slots)
    if (!Number.isInteger(slotCount) || !isExactTier(slotCount)) {
      return res.status(400).json({ error: 'Nieprawidłowa liczba slotów' })
    }
    const tier = getTierForSlots(slotCount)

    const billingPeriod: BillingPeriod = period === 'yearly' ? 'yearly' : 'monthly'

    if (!name?.trim() || name.trim().length > 100) {
      return res.status(400).json({ error: 'Nazwa serwera musi mieć 1-100 znaków' })
    }

    const amount = tierPrice(tier, billingPeriod) // może być null (cena nieustalona)
    const orderId = uuid()

    await execute(
      `INSERT INTO billing_orders (id, user_id, server_id, plan, slots, amount_grosze, currency, billing_period, status, meta)
       VALUES (?, ?, NULL, ?, ?, ?, 'PLN', ?, 'pending', ?)`,
      [orderId, userId, `slots_${tier.slots}`, tier.slots, amount ?? 0, billingPeriod,
       JSON.stringify({ name: name.trim(), iconColor: iconColor ?? null, description: description ?? null })]
    )

    // Cena nieustalona — nie ma czego pobrać.
    if (amount == null) {
      return res.status(202).json({
        provisioned: false,
        order: { id: orderId, status: 'pending', slots: tier.slots, amount: null, period: billingPeriod },
        checkoutUrl: null,
        message: 'Cennik jest w przygotowaniu — zamówienie zapisano jako oczekujące.',
      })
    }

    // Spróbuj utworzyć płatność u operatora (stub → brak URL).
    const payment = getPaymentProvider()
    const checkout = await payment.createCheckout({
      orderId, amountGrosze: amount, currency: 'PLN',
      description: `Serwer ${tier.slots} slotów (${billingPeriod === 'yearly' ? 'rocznie' : 'miesięcznie'})`,
      userId,
    })
    if (checkout.providerRef) {
      await execute('UPDATE billing_orders SET provider = ?, provider_ref = ? WHERE id = ?',
        [payment.id, checkout.providerRef, orderId])
    }

    if (checkout.checkoutUrl) {
      return res.status(200).json({
        provisioned: false,
        order: { id: orderId, status: 'pending', slots: tier.slots, amount, period: billingPeriod },
        checkoutUrl: checkout.checkoutUrl,
      })
    }

    return res.status(202).json({
      provisioned: false,
      order: { id: orderId, status: 'pending', slots: tier.slots, amount, period: billingPeriod },
      checkoutUrl: null,
      message: 'Procesor płatności nie jest jeszcze aktywny — zamówienie zapisano jako oczekujące.',
    })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Webhook operatora płatności (raw body montowany w index.ts) ──────────────
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const payment = getPaymentProvider()
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}))
    const result = await payment.parseWebhook(req.headers as Record<string, string | undefined>, raw)
    if (!result) return res.status(200).json({ ignored: true }) // stub / nierozpoznane

    const order = await queryOne<any>('SELECT * FROM billing_orders WHERE id = ?', [result.orderId])
    if (!order) return res.status(404).json({ error: 'Zamówienie nieznane' })

    if (result.status === 'paid' && order.status === 'pending') {
      await execute('UPDATE billing_orders SET status = ?, provider_ref = ? WHERE id = ?',
        ['paid', result.providerRef, result.orderId])
      await runProvisioning({ ...order, status: 'paid' })
    } else if (result.status !== 'paid') {
      await execute('UPDATE billing_orders SET status = ? WHERE id = ?', [result.status, result.orderId])
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[billing/webhook]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── DEV: symulacja opłacenia (test całego flow bez bramki) ───────────────────
router.post('/orders/:id/simulate-paid', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await isDevOrCreator(req.user!.userId))) {
      return res.status(403).json({ error: 'Tylko dev/creator' })
    }
    const order = await queryOne<any>('SELECT * FROM billing_orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId])
    if (!order) return res.status(404).json({ error: 'Zamówienie nie znalezione' })
    if (order.status === 'provisioned') return res.status(409).json({ error: 'Już sprovisionowane' })

    const r = await runProvisioning({ ...order, status: 'paid' })
    const server = r.serverId ? await serverQueries.findById(r.serverId) : null
    return res.json({ result: r, server })
  } catch (err) {
    console.error('[billing/simulate-paid]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Panel: wszystkie zamówienia + podsumowanie (dev/creator) ─────────────────
router.get('/admin/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await isDevOrCreator(req.user!.userId))) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    const status = typeof req.query.status === 'string' ? req.query.status : null
    const allowed = ['pending', 'paid', 'cancelled', 'failed', 'provisioned']
    const where = status && allowed.includes(status) ? 'WHERE o.status = ?' : ''
    const params = where ? [status] : []

    const orders = await queryMany(
      `SELECT o.id, o.user_id, o.server_id, o.plan, o.slots, o.amount_grosze, o.currency,
              o.billing_period, o.status, o.provider, o.provider_ref, o.created_at, o.updated_at,
              u.username, u.display_name, u.avatar_color, u.avatar_url,
              s.name AS server_name
       FROM billing_orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN servers s ON s.id = o.server_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT 200`,
      params
    )

    const summary = await queryOne<any>(
      `SELECT
         COUNT(*)                                                                AS total,
         SUM(status = 'pending')                                                 AS pending,
         SUM(status = 'paid')                                                    AS paid,
         SUM(status = 'provisioned')                                             AS provisioned,
         SUM(status IN ('cancelled','failed'))                                   AS failed,
         COALESCE(SUM(CASE WHEN status IN ('paid','provisioned') THEN amount_grosze ELSE 0 END), 0) AS revenue_grosze
       FROM billing_orders`
    )

    return res.json({ orders, summary })
  } catch (err) {
    console.error('[billing/admin/orders]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Moje zamówienia ──────────────────────────────────────────────────────────
router.get('/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await billingAccess(req.user!.userId))) {
      return res.status(403).json({ error: 'Funkcja niedostępna' })
    }
    const orders = await queryMany(
      `SELECT id, server_id, plan, slots, amount_grosze, currency, billing_period, status, created_at
       FROM billing_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user!.userId]
    )
    return res.json({ orders })
  } catch (err) {
    console.error('[billing/orders]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
