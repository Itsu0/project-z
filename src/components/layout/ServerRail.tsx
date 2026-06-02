'use client'
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { useStore } from '@/lib/store'
import { TicketsModal } from '@/components/tickets/TicketsModal'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export interface SlotTier {
  slots: number
  label: string
  ram: string
  vcpu: number
  disk: string
  transfer: string
  priceMonthly: number | null
  priceYearly: number | null
  recommended?: boolean
}

export interface SlotCatalog {
  minSlots: number
  currency: string
  sharedFeatures: string[]
  tiers: SlotTier[]
}

function formatPrice(grosze: number | null, period: 'monthly' | 'yearly'): string {
  if (grosze == null) return 'Wycena wkrótce'
  if (grosze === 0) return 'Darmowy'
  const zl = grosze / 100
  const val = Number.isInteger(zl) ? zl.toFixed(0) : zl.toFixed(2)
  return `${val} zł / ${period === 'yearly' ? 'rok' : 'mies.'}`
}

function AddServerPicker({
  onClose,
  onJoin,
  onCreate,
  canCreate,
}: {
  onClose: () => void
  onJoin: () => void
  onCreate: () => void
  canCreate: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-6 w-full max-w-sm"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        <h2 className="text-lg font-semibold mb-1 text-center" style={{ color: 'var(--eb-text1)' }}>
          Dodaj serwer
        </h2>
        <p className="text-xs text-center mb-6" style={{ color: 'var(--eb-text3)' }}>
          Dołącz do istniejącego serwera lub stwórz własny
        </p>

        <div className="flex flex-col gap-3">
          {}
          <button
            onClick={onJoin}
            className="group flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all duration-150"
            style={{
              background: 'var(--eb-bg3)',
              border: '1px solid var(--eb-border)',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.45)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--eb-border)')}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
                Dołącz do serwera
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                Wpisz kod lub wklej link zaproszenia
              </div>
            </div>
            <svg className="ml-auto opacity-40" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {}
          {canCreate ? (
            <button
              onClick={onCreate}
              className="group flex items-center gap-4 px-5 py-4 rounded-xl text-left transition-all duration-150"
              style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(168,85,247,0.45)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--eb-border)')}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
                  Załóż własny serwer
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                  Wybierz pakiet i liczbę slotów
                </div>
              </div>
              <svg className="ml-auto opacity-40" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ) : (
            <div
              className="flex items-center gap-4 px-5 py-4 rounded-xl text-left opacity-40 cursor-not-allowed select-none"
              style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}
              title="Tworzenie serwerów jest tymczasowo wyłączone"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
                  Załóż własny serwer
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                  Tymczasowo niedostępne
                </div>
              </div>
              <svg className="ml-auto opacity-40" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          )}
        </div>

        <button onClick={onClose}
          className="w-full mt-4 py-2 rounded-xl text-sm transition-all"
          style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg3)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--eb-text1)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text3)')}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

function JoinServerModal({
  onClose,
  onBack,
  onJoined,
}: {
  onClose: () => void
  onBack: () => void
  onJoined: () => void
}) {
  const { token, addServer, setCurrentServer, setChannels, setMembers, setCurrentChannel } = useStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function extractCode(raw: string): string {

    const match = raw.match(/(?:invite|join)[\/\s]+([A-Za-z0-9_-]+)/i)
    if (match) return match[1]
    return raw.trim()
  }

  async function join() {
    const inviteCode = extractCode(code)
    if (!inviteCode) { setError('Wpisz kod lub link zaproszenia'); return }
    setLoading(true); setError('')
    try {

      let res = await fetch(`${BASE}/api/servers/invite/${inviteCode}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 404) {
        res = await fetch(`${BASE}/api/servers/join/${inviteCode}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Nieprawidłowy kod zaproszenia'); return }

      addServer(data.server)
      setCurrentServer(data.server.id)

      const srvRes = await fetch(`${BASE}/api/servers/${data.server.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const srvData = await srvRes.json()
      setChannels(data.server.id, srvData.channels ?? [])
      setMembers(data.server.id, srvData.members ?? [])
      const firstText = (srvData.channels ?? []).find((c: any) => c.type === 'text' || c.type === 'announcement')
      if (firstText) setCurrentChannel(firstText.id)

      onJoined()
      onClose()
    } catch {
      setError('Błąd serwera')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-6 w-full max-w-sm"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        {}
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--eb-text1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text3)')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--eb-text1)' }}>
            Dołącz do serwera
          </h2>
        </div>
        <p className="text-xs mb-5 ml-10" style={{ color: 'var(--eb-text3)' }}>
          Wpisz kod zaproszenia lub wklej pełny link
        </p>

        <div className="mb-1">
          <label className="text-xs font-semibold tracking-wide uppercase mb-1.5 block"
            style={{ color: 'var(--eb-text2)' }}>Kod lub link zaproszenia</label>
          <input
            autoFocus
            value={code}
            onChange={e => { setCode(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && join()}
            placeholder="np. aBcDeFgH lub http://…/invite/aBcDeFgH"
            className="ember-input w-full px-4 py-3"
          />
        </div>

        {error && (
          <p className="text-xs mt-2 mb-1" style={{ color: 'var(--eb-accent2)' }}>{error}</p>
        )}

        <p className="text-xs mt-3 mb-5" style={{ color: 'var(--eb-text3)' }}>
          Zaproszenia wygasają po ustalonym czasie. Skontaktuj się z administratorem serwera, jeśli link nie działa.
        </p>

        <div className="flex gap-2">
          <button onClick={onClose} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
          <button onClick={join} disabled={loading || !code.trim()}
            className="ember-btn flex-1 py-2.5 text-sm font-semibold"
            style={{ opacity: !code.trim() ? 0.5 : 1 }}>
            {loading ? 'Dołączanie...' : 'Dołącz'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateServerModal({
  onClose,
  onBack,
  onCreated,
  catalog,
}: {
  onClose: () => void
  onBack: () => void
  onCreated: () => void
  catalog: SlotCatalog
}) {
  const { token, addServer, setCurrentServer, setChannels, setMembers, setCurrentChannel } = useStore()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo]   = useState('')
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')

  const tiers = catalog.tiers
  // Indeks suwaka — domyślnie tier oznaczony jako recommended, inaczej pierwszy.
  const defaultIdx = Math.max(0, tiers.findIndex(t => t.recommended))
  const [tierIdx, setTierIdx] = useState<number>(defaultIdx)
  const tier = tiers[tierIdx] ?? tiers[0]
  const hasPrices = tiers.some(t => t.priceMonthly != null)

  const COLORS = [
    'linear-gradient(135deg,#dc2626,#f59e0b)',
    'linear-gradient(135deg,#4a4aff,#7a4aff)',
    'linear-gradient(135deg,#22c55e,#15803d)',
    'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    'linear-gradient(135deg,#a855f7,#7c3aed)',
    'linear-gradient(135deg,#ec4899,#be185d)',
  ]
  const [color, setColor] = useState(COLORS[0])

  async function create() {
    if (!name.trim()) { setError('Podaj nazwę serwera'); return }
    setLoading(true); setError(''); setInfo('')
    try {
      const res = await fetch(`${BASE}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slots: tier.slots, period, name: name.trim(), iconColor: color }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd'); return }

      // Bramka aktywna — przekierowanie do płatności.
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return }

      // Brak procesora / cennika — zamówienie oczekujące.
      if (!data.provisioned) {
        setInfo(data.message ?? 'Zamówienie zapisano jako oczekujące.')
        return
      }

      addServer(data.server)
      setCurrentServer(data.server.id)

      const srvRes = await fetch(`${BASE}/api/servers/${data.server.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const srvData = await srvRes.json()
      setChannels(data.server.id, srvData.channels ?? [])
      setMembers(data.server.id, srvData.members ?? [])
      const firstText = (srvData.channels ?? []).find((c: any) => c.type === 'text')
      if (firstText) setCurrentChannel(firstText.id)

      onCreated()
      onClose()
    } catch {
      setError('Błąd serwera')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-6 w-full max-w-md overflow-y-auto"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)', maxHeight: '88vh' }}>

        {}
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--eb-text1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text3)')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--eb-text1)' }}>Utwórz serwer</h2>
        </div>
        <p className="text-xs mb-5 ml-10" style={{ color: 'var(--eb-text3)' }}>
          Twój serwer to przestrzeń dla Ciebie i Twojej społeczności
        </p>

        {}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ background: color }}>
            {name.slice(0, 1).toUpperCase() || 'N'}
          </div>
        </div>

        {}
        <div className="flex gap-2 justify-center mb-5">
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-all"
              style={{
                background: c,
                outline: color === c ? '2px solid white' : 'none',
                outlineOffset: 2,
                transform: color === c ? 'scale(1.15)' : 'scale(1)',
              }} />
          ))}
        </div>

        {}
        <div className="mb-4">
          <label className="text-xs font-semibold tracking-wide uppercase mb-1.5 block"
            style={{ color: 'var(--eb-text2)' }}>Nazwa serwera</label>
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="np. The Quinfall"
            className="ember-input w-full px-4 py-3"
          />
        </div>

        {}
        {tiers.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Liczba slotów
              </label>
              {hasPrices && (
                <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--eb-bg3)' }}>
                  {(['monthly', 'yearly'] as const).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                      style={{
                        background: period === p ? 'var(--eb-bg1)' : 'transparent',
                        color: period === p ? 'var(--eb-text1)' : 'var(--eb-text3)',
                      }}>
                      {p === 'monthly' ? 'Miesięcznie' : 'Rocznie'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {}
            <div className="px-3 py-3 rounded-xl" style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ color: 'var(--eb-text1)' }}>{tier.slots}</span>
                  <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>slotów · {tier.label}</span>
                  {tier.recommended && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                      Polecany
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold" style={{ color: '#a855f7' }}>
                  {formatPrice(period === 'yearly' ? tier.priceYearly : tier.priceMonthly, period)}
                </span>
              </div>

              <input
                type="range" min={0} max={tiers.length - 1} step={1} value={tierIdx}
                onChange={e => setTierIdx(Number(e.target.value))}
                className="w-full accent-[#a855f7] cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                {tiers.map((t, i) => (
                  <button key={t.slots} onClick={() => setTierIdx(i)}
                    className="text-[9px] tabular-nums transition-colors"
                    style={{ color: i === tierIdx ? '#a855f7' : 'var(--eb-text3)', fontWeight: i === tierIdx ? 700 : 400 }}>
                    {t.slots >= 1000 ? '1k' : t.slots}
                  </button>
                ))}
              </div>

              {}
              <div className="grid grid-cols-4 gap-1 mt-3 text-center">
                {[['RAM', tier.ram], ['vCPU', String(tier.vcpu)], ['Dysk', tier.disk], ['Transfer', tier.transfer]].map(([k, v]) => (
                  <div key={k} className="px-1 py-1.5 rounded-lg" style={{ background: 'var(--eb-bg2)' }}>
                    <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--eb-text3)' }}>{k}</div>
                    <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--eb-text1)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {}
            <p className="text-[10px] mt-2 mb-1" style={{ color: 'var(--eb-text3)' }}>
              Wszystkie pakiety mają te same funkcje — różni się tylko pojemność:
            </p>
            <ul className="flex flex-col gap-1">
              {catalog.sharedFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--eb-text3)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-xs mb-3 text-center" style={{ color: 'var(--eb-accent2)' }}>{error}</p>
        )}
        {info && (
          <p className="text-xs mb-3 text-center px-3 py-2 rounded-lg"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
            {info}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
          <button onClick={create} disabled={loading} className="ember-btn flex-1 py-2.5 text-sm font-semibold">
            {loading ? 'Przetwarzanie...'
              : ((period === 'yearly' ? tier.priceYearly : tier.priceMonthly) ?? 0) > 0
                ? 'Przejdź do płatności' : 'Zamów'}
          </button>
        </div>
      </div>
    </div>
  )
}

type ModalView = 'none' | 'picker' | 'join' | 'create'

export function ServerRail() {
  const { servers, currentServerId, setCurrentServer, setChannels, setMembers, setCurrentChannel, token, dmUnread, setDmOpen } = useStore()
  const [modal, setModal]         = useState<ModalView>('none')
  const [showTickets, setShowTickets] = useState(false)
  const [billing, setBilling] = useState<{ available: boolean; catalog: SlotCatalog | null }>({ available: false, catalog: null })

  const totalDmUnread = Object.values(dmUnread).reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/api/billing/plans`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.available) {
          setBilling({ available: true, catalog: { minSlots: d.minSlots, currency: d.currency, sharedFeatures: d.sharedFeatures ?? [], tiers: d.tiers ?? [] } })
        } else {
          setBilling({ available: false, catalog: null })
        }
      })
      .catch(() => setBilling({ available: false, catalog: null }))
  }, [token])

  async function selectServer(serverId: string) {
    if (serverId === currentServerId) return
    setCurrentServer(serverId)
    try {
      const res = await fetch(`${BASE}/api/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setChannels(serverId, data.channels ?? [])
      setMembers(serverId, data.members ?? [])
      const first = (data.channels ?? []).find((c: any) => c.type === 'text' || c.type === 'announcement')
      if (first) setCurrentChannel(first.id)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <>
      <nav className="flex flex-col items-center py-2 gap-1 border-r"
        style={{ width: 60, background: 'var(--eb-bg0)', borderColor: 'var(--eb-border)' }}>

        {}
        <div
          onClick={() => setDmOpen(true)}
          className="relative w-10 h-10 flex items-center justify-center cursor-pointer rounded-2xl hover:rounded-[10px] transition-all duration-200"
          style={{ background: 'var(--eb-bg2)', color: 'var(--eb-text2)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--eb-text1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = 'var(--eb-text2)' }}
          title="Wiadomości prywatne"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {totalDmUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-white font-bold flex items-center justify-center"
              style={{ fontSize: 10, background: 'var(--eb-accent2)', lineHeight: 1 }}>
              {totalDmUnread > 99 ? '99+' : totalDmUnread}
            </span>
          )}
        </div>

        {servers.length > 0 && (
          <div className="w-7 h-px my-0.5" style={{ background: 'var(--eb-border2)' }} />
        )}

        {servers.map((srv) => (
          <div key={srv.id} className="relative group">
            <div
              className={clsx(
                'absolute left-[-8px] top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200',
                currentServerId === srv.id ? 'h-[65%] bg-[var(--eb-accent)]' : 'h-0 group-hover:h-[30%] bg-[var(--eb-text2)]'
              )}
            />
            <div
              onClick={() => selectServer(srv.id)}
              className={clsx(
                'w-10 h-10 flex items-center justify-center cursor-pointer select-none font-semibold text-white text-sm transition-all duration-200 overflow-hidden',
                currentServerId === srv.id ? 'rounded-[10px]' : 'rounded-2xl hover:rounded-[10px]'
              )}
              style={{ background: srv.icon_url ? 'transparent' : (srv.icon_color ?? 'linear-gradient(135deg,#dc2626,#f59e0b)') }}
              title={srv.name}
            >
              {srv.icon_url
                ? <img src={srv.icon_url} alt={srv.name} className="w-full h-full object-cover" />
                : srv.name.slice(0, 1).toUpperCase()
              }
            </div>
          </div>
        ))}

        {}
        <div
          onClick={() => setModal('picker')}
          className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-2xl hover:rounded-[10px] transition-all duration-200 text-xl font-light border border-dashed"
          style={{ color: 'var(--eb-online)', borderColor: 'rgba(34,197,94,0.35)' }}
          title="Dodaj serwer"
        >
          +
        </div>

        <div className="flex-1" />

        <div
          onClick={() => setShowTickets(true)}
          className="icon-btn mb-1 cursor-pointer"
          title="Zgłoszenia"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
      </nav>

      {modal === 'picker' && (
        <AddServerPicker
          onClose={() => setModal('none')}
          onJoin={() => setModal('join')}
          onCreate={() => setModal('create')}
          canCreate={billing.available && !!billing.catalog}
        />
      )}
      {modal === 'join' && (
        <JoinServerModal
          onClose={() => setModal('none')}
          onBack={() => setModal('picker')}
          onJoined={() => {}}
        />
      )}
      {modal === 'create' && billing.catalog && (
        <CreateServerModal
          onClose={() => setModal('none')}
          onBack={() => setModal('picker')}
          onCreated={() => {}}
          catalog={billing.catalog}
        />
      )}

      {showTickets && <TicketsModal onClose={() => setShowTickets(false)} />}
    </>
  )
}
