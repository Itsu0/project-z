// ── Warstwa provisioningu (pluggable) ────────────────────────────────────────
// Po opłaceniu zamówienia wybrany provider tworzy zasób dla klienta.
// - inAppProvisioning: serwer w obrębie współdzielonej aplikacji (działa teraz)
// - gportalProvisioning: dedykowany VPS przez API G-Portal (DO IMPLEMENTACJI)

import { provisionServer } from './provisionServer'
import type { SlotTier } from '../config/plans'

export interface ProvisionInput {
  orderId: string
  userId:  string
  tier:    SlotTier
  meta:    { name: string; iconColor?: string | null; description?: string | null }
}

export interface ProvisionOutput {
  status:     'provisioned' | 'pending'
  serverId?:  string
  accessInfo?: Record<string, unknown> | null
}

export interface ProvisioningProvider {
  readonly id: string
  provision(input: ProvisionInput): Promise<ProvisionOutput>
}

// Model współdzielonej platformy — tworzy serwer w aplikacji z limitem slotów.
export const inAppProvisioning: ProvisioningProvider = {
  id: 'inapp',
  async provision(input: ProvisionInput): Promise<ProvisionOutput> {
    const { serverId } = await provisionServer({
      name:        input.meta.name,
      ownerId:     input.userId,
      memberLimit: input.tier.slots,
      iconColor:   input.meta.iconColor ?? undefined,
      description: input.meta.description ?? undefined,
    })
    return { status: 'provisioned', serverId }
  },
}

// Dedykowany VPS przez API G-Portal — DO IMPLEMENTACJI.
// Flow (Dokumentacja Techniczna, sekcja 7.1):
//   utwórz instancję (G-Portal API) → czekaj na 'running' (~20-60 s) →
//   SSH skrypt instalacyjny → docker-compose up (Node+MySQL+LiveKit+coturn) →
//   nginx + SSL (Let's Encrypt) → schema.sql + migracje → e-mail z dostępami.
export const gportalProvisioning: ProvisioningProvider = {
  id: 'gportal',
  async provision(input: ProvisionInput): Promise<ProvisionOutput> {
    // TODO: wywołanie API G-Portal (utworzenie VPS wg input.tier: ram/vcpu/disk).
    // Na razie zamówienie czeka na provisioning — status 'pending'.
    console.warn('[provisioning/gportal] niezaimplementowane — zamówienie', input.orderId, 'oczekuje')
    return { status: 'pending', accessInfo: null }
  },
}

export function getProvisioningProvider(): ProvisioningProvider {
  return process.env.PROVISIONING_PROVIDER === 'gportal' ? gportalProvisioning : inAppProvisioning
}
