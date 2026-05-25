'use client'
import { useState } from 'react'
import clsx from 'clsx'
import { useStore } from '@/lib/store'
import { TicketsModal } from '@/components/tickets/TicketsModal'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function AddServerPicker({
  onClose,
  onJoin,
  onCreate,
}: {
  onClose: () => void
  onJoin: () => void
  onCreate: () => void
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
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-xl text-left opacity-40 cursor-not-allowed select-none"
            style={{
              background: 'var(--eb-bg3)',
              border: '1px solid var(--eb-border)',
            }}
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
}: {
  onClose: () => void
  onBack: () => void
  onCreated: () => void
}) {
  const { token, addServer, setCurrentServer, setChannels, setMembers, setCurrentChannel } = useStore()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), iconColor: color }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd'); return }

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

        {error && (
          <p className="text-xs mb-3 text-center" style={{ color: 'var(--eb-accent2)' }}>{error}</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
          <button onClick={create} disabled={loading} className="ember-btn flex-1 py-2.5 text-sm font-semibold">
            {loading ? 'Tworzenie...' : 'Utwórz'}
          </button>
        </div>
      </div>
    </div>
  )
}

type ModalView = 'none' | 'picker' | 'join' | 'create'

export function ServerRail() {
  const { servers, currentServerId, setCurrentServer, setChannels, setMembers, setCurrentChannel, token } = useStore()
  const [modal, setModal]         = useState<ModalView>('none')
  const [showTickets, setShowTickets] = useState(false)

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

        {servers.length > 0 && (
          <div className="w-7 h-px my-0.5" style={{ background: 'var(--eb-border2)' }} />
        )}

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
        />
      )}
      {modal === 'join' && (
        <JoinServerModal
          onClose={() => setModal('none')}
          onBack={() => setModal('picker')}
          onJoined={() => {}}
        />
      )}
      {modal === 'create' && (
        <CreateServerModal
          onClose={() => setModal('none')}
          onBack={() => setModal('picker')}
          onCreated={() => {}}
        />
      )}

      {showTickets && <TicketsModal onClose={() => setShowTickets(false)} />}
    </>
  )
}
