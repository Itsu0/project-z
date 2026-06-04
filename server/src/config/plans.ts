// ── Katalog pojemności serwera (sloty) ───────────────────────────────────────
// Model: funkcje są IDENTYCZNE niezależnie od liczby slotów — różni się tylko
// pojemność (liczba jednoczesnych aktywnych użytkowników) i przypisany sprzęt VPS.
// Tiery i specyfikacje wg Dokumentacji Technicznej v2.0, sekcja 6.1.
//
// Ceny (priceMonthly/priceYearly) są w GROSZACH PLN i celowo = null
// (kwoty do ustalenia). Wystarczy je uzupełnić, by bramka płatności miała amount.

export type BillingPeriod = 'monthly' | 'yearly'
export const CURRENCY = 'PLN'
export const MIN_SLOTS = 10

export interface SlotTier {
  slots:        number
  label:        string          // zastosowanie (np. „Mała społeczność")
  ram:          string
  vcpu:         number
  disk:         string
  transfer:     string
  priceMonthly: number | null   // grosze PLN / mies. — do ustalenia
  priceYearly:  number | null   // grosze PLN / rok   — do ustalenia
  recommended?: boolean
}

// Punkty zatrzymania suwaka = tiery sprzętowe z dokumentacji.
// CENY TESTOWE: 2 zł (200 gr) dla każdego pakietu — minimum Stripe dla PLN.
// (10 gr jest poniżej minimum Stripe i zostałoby odrzucone.) Przywróć realne po teście.
export const SLOT_TIERS: SlotTier[] = [
  { slots: 10,   label: 'Znajomi',            ram: '2 GB',  vcpu: 1,  disk: '20 GB',  transfer: '100 Mbps', priceMonthly: 200, priceYearly: 200 },
  { slots: 25,   label: 'Mała społeczność',   ram: '2 GB',  vcpu: 1,  disk: '20 GB',  transfer: '100 Mbps', priceMonthly: 200, priceYearly: 200 },
  { slots: 50,   label: 'Mała społeczność',   ram: '2 GB',  vcpu: 2,  disk: '40 GB',  transfer: '200 Mbps', priceMonthly: 200, priceYearly: 200 },
  { slots: 100,  label: 'Średnia społeczność',ram: '4 GB',  vcpu: 2,  disk: '80 GB',  transfer: '500 Mbps', priceMonthly: 200, priceYearly: 200 },
  { slots: 250,  label: 'Duża platforma',     ram: '8 GB',  vcpu: 4,  disk: '150 GB', transfer: '1 Gbps',   priceMonthly: 200, priceYearly: 200, recommended: true },
  { slots: 500,  label: 'Enterprise',         ram: '16 GB', vcpu: 8,  disk: '300 GB', transfer: '2 Gbps',   priceMonthly: 200, priceYearly: 200 },
  { slots: 1000, label: 'Klaster',            ram: '32 GB', vcpu: 16, disk: '500 GB', transfer: '5 Gbps',   priceMonthly: 200, priceYearly: 200 },
]

// Funkcje wspólne — takie same dla każdej liczby slotów.
export const SHARED_FEATURES = [
  'Kanały tekstowe, głosowe, forum i ogłoszenia',
  'Własne emoji, role i granularne uprawnienia',
  'Ankiety, wątki i załączniki',
  'Pełna moderacja (mute / kick / ban, automod)',
  'Wiadomości prywatne (DM) i znajomi',
  'Aplikacja desktopowa z auto-aktualizacją',
]

export function isExactTier(slots: number): boolean {
  return SLOT_TIERS.some(t => t.slots === slots)
}

export function getTierForSlots(slots: number): SlotTier {
  // Najmniejszy tier o pojemności >= slots; powyżej maksimum → największy.
  for (const t of SLOT_TIERS) if (slots <= t.slots) return t
  return SLOT_TIERS[SLOT_TIERS.length - 1]
}

export function tierPrice(t: SlotTier, period: BillingPeriod): number | null {
  return period === 'yearly' ? t.priceYearly : t.priceMonthly
}

/** Flaga funkcji — pakiety/płatności ukryte, dopóki BILLING_ENABLED !== 'true'. */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true'
}

export function publicSlotCatalog() {
  return {
    minSlots: MIN_SLOTS,
    currency: CURRENCY,
    sharedFeatures: SHARED_FEATURES,
    tiers: SLOT_TIERS,
  }
}
