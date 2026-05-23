'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/lib/store'
import { useModeration } from '@/hooks/useModeration'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface MuteModalProps {
  member: { userId: string; displayName: string }
  serverId: string
  onClose: () => void
  onDone: () => void
}

export function MuteModal({ member, serverId, onClose, onDone }: MuteModalProps) {
  const { mute } = useModeration(serverId)
  const [duration, setDuration] = useState(10)
  const [reason,   setReason]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const PRESETS = [
    { label: '5 min',   value: 5 },
    { label: '10 min',  value: 10 },
    { label: '30 min',  value: 30 },
    { label: '1 godz',  value: 60 },
    { label: '6 godz',  value: 360 },
    { label: '24 godz', value: 1440 },
    { label: '7 dni',   value: 10080 },
  ]

  async function submit() {
    setLoading(true); setError('')
    try {
      await mute(member.userId, duration, reason.trim() || undefined)
      onDone()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'rgba(251,146,60,0.15)' }}>🔇</div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
              Wycisz {member.displayName}
            </h3>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
              Użytkownik nie będzie mógł pisać przez wybrany czas
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
          Czas wyciszenia
        </label>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {PRESETS.map(p => (
            <button key={p.value} onClick={() => setDuration(p.value)}
              className="py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: duration === p.value ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.05)',
                color: duration === p.value ? '#fff' : 'var(--eb-text2)',
              }}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="number" min={1} max={10080} value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="ember-input px-3 py-2 text-sm w-24" />
          <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>minut (maks. 7 dni)</span>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--eb-text2)' }}>
          Powód (opcjonalnie)
        </label>
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder="np. Spam w kanale ogólnym"
          className="ember-input w-full px-3 py-2.5 text-sm mb-4" maxLength={512} />

        {error && <p className="text-xs mb-3" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
            style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)' }}>
            {loading ? 'Wyciszanie...' : `🔇 Wycisz na ${duration} min`}
          </button>
        </div>
      </div>
    </div>
  )
}

interface BanModalProps {
  member: { userId: string; displayName: string }
  serverId: string
  onClose: () => void
  onDone: () => void
}

export function BanModal({ member, serverId, onClose, onDone }: BanModalProps) {
  const { ban } = useModeration(serverId)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [confirm, setConfirm] = useState(false)

  async function submit() {
    if (!confirm) { setConfirm(true); return }
    setLoading(true); setError('')
    try {
      await ban(member.userId, reason.trim() || undefined)
      onDone()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid rgba(220,38,38,0.3)' }}>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'rgba(220,38,38,0.15)' }}>🔨</div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--eb-accent2)' }}>
              Zbanuj {member.displayName}
            </h3>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
              Użytkownik zostanie wyrzucony i nie wróci
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--eb-text2)' }}>
          Powód (opcjonalnie)
        </label>
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder="np. Łamanie regulaminu serwera"
          className="ember-input w-full px-3 py-2.5 text-sm mb-4" maxLength={512} />

        {confirm && (
          <div className="p-3 rounded-xl mb-4 text-xs"
            style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '0.5px solid rgba(220,38,38,0.3)' }}>
            ⚠ Na pewno chcesz zbanować <strong>{member.displayName}</strong>? Zostanie natychmiast wyrzucony.
          </div>
        )}

        {error && <p className="text-xs mb-3" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
          <button onClick={submit} disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
            style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--eb-accent2)', border: '1px solid rgba(220,38,38,0.4)' }}>
            {loading ? 'Banowanie...' : confirm ? '🔨 Potwierdź ban' : '🔨 Zbanuj'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface MessageActionsProps {
  message: { id: string; channelId: string; authorId: string; authorName: string; serverId: string }
  currentUserId: string
  canManageMessages: boolean
  onDelete: (id: string) => void
}

export function MessageActions({ message, currentUserId, canManageMessages, onDelete }: MessageActionsProps) {
  const { deleteMessage } = useModeration(message.serverId)
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [showMute, setShowMute] = useState(false)
  const [showBan,  setShowBan]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isOwn = message.authorId === currentUserId
  const canDelete = isOwn || canManageMessages

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteMessage(message.channelId, message.id)
      onDelete(message.id)
    } catch (e: any) { alert(e.message) }
    finally { setLoading(false); setOpen(false) }
  }

  if (!canDelete && !canManageMessages) return null

  return (
    <>
      {showMute && !isOwn && (
        <MuteModal
          member={{ userId: message.authorId, displayName: message.authorName }}
          serverId={message.serverId}
          onClose={() => setShowMute(false)}
          onDone={() => { setShowMute(false); setOpen(false) }}
        />
      )}
      {showBan && !isOwn && (
        <BanModal
          member={{ userId: message.authorId, displayName: message.authorName }}
          serverId={message.serverId}
          onClose={() => setShowBan(false)}
          onDone={() => { setShowBan(false); setOpen(false) }}
        />
      )}

      <div ref={ref} className="relative">
        <button onClick={() => setOpen(o => !o)}
          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md transition-all hover:bg-white/10"
          style={{ color: 'var(--eb-text3)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-7 z-50 rounded-xl overflow-hidden py-1 min-w-44"
            style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {canDelete && (
              <button onClick={handleDelete} disabled={loading}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors hover:bg-white/[0.05]"
                style={{ color: 'var(--eb-accent2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                </svg>
                {loading ? 'Usuwanie...' : 'Usuń wiadomość'}
              </button>
            )}
            {canManageMessages && !isOwn && (
              <>
                <div style={{ height: '0.5px', background: 'var(--eb-border)', margin: '2px 8px' }} />
                <button onClick={() => { setShowMute(true); setOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors hover:bg-white/[0.05]"
                  style={{ color: '#fb923c' }}>
                  🔇 Wycisz {message.authorName}
                </button>
                <button onClick={() => { setShowBan(true); setOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors hover:bg-white/[0.05]"
                  style={{ color: 'var(--eb-accent2)' }}>
                  🔨 Zbanuj {message.authorName}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function StrikeModal({ member, serverId, onClose }: { member: { userId: string; displayName: string }; serverId: string; onClose: () => void }) {
  const { token } = useStore()
  const [strikes, setStrikes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    if (!token) return
    try {
      const r = await fetch(`${BASE}/api/servers/${serverId}/strikes/${member.userId}`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      setStrikes(d.strikes ?? [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function addStrike() {
    if (!token || !reason.trim()) return
    setAdding(true); setErr('')
    try {
      const r = await fetch(`${BASE}/api/servers/${serverId}/strikes/${member.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setReason('')
      load()
    } catch (e: any) { setErr(e.message) }
    finally { setAdding(false) }
  }

  async function removeStrike(id: string) {
    if (!token) return
    try {
      await fetch(`${BASE}/api/servers/${serverId}/strikes/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      setStrikes(prev => prev.filter(s => s.id !== id))
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'rgba(234,179,8,0.15)' }}>⚠️</div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>Strike — {member.displayName}</h3>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Aktualne strike: {strikes.length}</p>
          </div>
        </div>

        <div className="mb-3 max-h-36 overflow-y-auto space-y-1.5">
          {loading ? <div className="text-xs text-center py-3" style={{ color: 'var(--eb-text3)' }}>Ładowanie...</div>
          : strikes.length === 0 ? <div className="text-xs text-center py-3" style={{ color: 'var(--eb-text3)' }}>Brak strike</div>
          : strikes.map((s, i) => (
            <div key={s.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(234,179,8,0.07)', border: '0.5px solid rgba(234,179,8,0.2)' }}>
              <span className="text-xs font-bold mt-0.5" style={{ color: '#eab308' }}>#{i+1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: 'var(--eb-text1)' }}>{s.reason}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                  {s.auto ? '🤖 Auto' : '👤 Mod'} · {new Date(s.created_at).toLocaleDateString('pl')}
                </p>
              </div>
              <button onClick={() => removeStrike(s.id)} className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0" title="Usuń strike">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--eb-accent2)" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-1">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Powód strike..."
            className="ember-input flex-1 px-3 py-2 text-sm" maxLength={500}
            onKeyDown={e => e.key === 'Enter' && addStrike()} />
          <button onClick={addStrike} disabled={adding || !reason.trim()}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(234,179,8,0.2)', color: '#eab308', border: '0.5px solid rgba(234,179,8,0.4)' }}>
            {adding ? '...' : '+Strike'}
          </button>
        </div>
        {err && <p className="text-xs mt-1" style={{ color: 'var(--eb-accent2)' }}>{err}</p>}

        <button onClick={onClose} className="ember-btn-ghost w-full py-2 text-sm mt-3">Zamknij</button>
      </div>
    </div>
  )
}

const ROLE_META_MENU: Record<string, { color: string; icon: string }> = {
  'Administrator': { color: '#f87171', icon: '👑' },
  'Moderator':     { color: '#fb923c', icon: '🛡' },
  'Członek':       { color: '#60a5fa', icon: '✅' },
  'Do Weryfikacji':{ color: '#94a3b8', icon: '⏳' },
}

interface MemberActionsProps {
  member: { userId: string; displayName: string; username: string }
  serverId: string
  currentUserId: string
  canKick: boolean
  canBan: boolean
  canMute: boolean
  canManageRoles?: boolean
  isAdmin?: boolean
  currentRole?: string | null
  onRoleChanged?: (userId: string, newRole: string | null) => void
}

export function MemberActions({
  member, serverId, currentUserId,
  canKick, canBan, canMute,
  canManageRoles = false,
  isAdmin = false,
  currentRole = null,
  onRoleChanged,
}: MemberActionsProps) {

  const targetIsAdmin = currentRole === 'Administrator'
  const { kick, unmute } = useModeration(serverId)
  const [open,        setOpen]        = useState(false)
  const [showMute,    setShowMute]    = useState(false)
  const [showBan,     setShowBan]     = useState(false)
  const [showKick,    setShowKick]    = useState(false)
  const [showRoles,   setShowRoles]   = useState(false)
  const [showStrikes, setShowStrikes] = useState(false)
  const [kickLoading, setKickLoading] = useState(false)
  const [kickError,   setKickError]   = useState('')
  const [isMuted,     setIsMuted]     = useState(false)
  const [serverRoles, setServerRoles] = useState<any[]>([])
  const [assigningRole, setAssigningRole] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const ref        = useRef<HTMLDivElement>(null)
  const btnRef     = useRef<HTMLButtonElement>(null)
  const portalRef  = useRef<HTMLDivElement>(null)
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const { token } = useStore()

  useEffect(() => {
    if (!token || !open) return
    fetch(`${BASE_URL}/api/servers/${serverId}/moderation/status/${member.userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setIsMuted(d.muted ?? false))
      .catch(() => {})
  }, [open, token, serverId, member.userId])

  useEffect(() => {
    if (!token || !open || !canManageRoles) return
    fetch(`${BASE_URL}/api/servers/${serverId}/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const ORDER = ['Administrator', 'Moderator', 'Członek', 'Do Weryfikacji']
        let roles = (d.roles ?? []).filter((r: any) => ROLE_META_MENU[r.name])

        if (!isAdmin) {
          roles = roles.filter((r: any) => r.name !== 'Administrator' && r.name !== 'Moderator')
        }
        roles.sort((a: any, b: any) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name))
        setServerRoles(roles)
      })
      .catch(() => {})
  }, [open, token, serverId, canManageRoles, isAdmin])

  useEffect(() => {
    if (!open) return
    const update = () => {
      if (!btnRef.current) return
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const target = e.target as Node

      const inBtn    = ref.current?.contains(target)
      const inPortal = portalRef.current?.contains(target)
      if (!inBtn && !inPortal) {
        setOpen(false)
        setShowRoles(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const effectiveCanMute = canMute && (!targetIsAdmin || isAdmin)
  const effectiveCanKick = canKick && (!targetIsAdmin || isAdmin)
  const effectiveCanBan  = canBan  && (!targetIsAdmin || isAdmin)
  if (member.userId === currentUserId || (!effectiveCanKick && !effectiveCanBan && !effectiveCanMute && !canManageRoles)) return null

  async function handleKickConfirm() {
    setKickLoading(true); setKickError('')
    try {
      await kick(member.userId)
      setShowKick(false); setOpen(false)
    } catch (e: any) {
      setKickError(e.message)
    } finally {
      setKickLoading(false)
    }
  }

  async function handleAssignRole(roleId: string, roleName: string) {
    if (assigningRole || !token) return
    setAssigningRole(roleId)
    try {

      if (roleName === currentRole) {
        await fetch(`${BASE_URL}/api/servers/${serverId}/members/${member.userId}/roles/${roleId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {

        if (currentRole) {
          const prevRole = serverRoles.find(r => r.name === currentRole)
          if (prevRole) {
            await fetch(`${BASE_URL}/api/servers/${serverId}/members/${member.userId}/roles/${prevRole.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            })
          }
        }

        await fetch(`${BASE_URL}/api/servers/${serverId}/members/${member.userId}/roles/${roleId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      const newRole = roleName === currentRole ? null : roleName
      onRoleChanged?.(member.userId, newRole)
      setOpen(false)
      setShowRoles(false)
    } catch (e: any) {
      console.error('[assignRole]', e)
    } finally {
      setAssigningRole(null)
    }
  }

  const hasModActions = effectiveCanMute || effectiveCanKick || effectiveCanBan

  return (
    <>
      {showMute    && <MuteModal   member={{ userId: member.userId, displayName: member.displayName }} serverId={serverId} onClose={() => setShowMute(false)}    onDone={() => setShowMute(false)} />}
      {showBan     && <BanModal    member={{ userId: member.userId, displayName: member.displayName }} serverId={serverId} onClose={() => setShowBan(false)}     onDone={() => setShowBan(false)} />}
      {showStrikes && <StrikeModal member={{ userId: member.userId, displayName: member.displayName }} serverId={serverId} onClose={() => setShowStrikes(false)} />}

      {}
      {showKick && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowKick(false) }}>
          <div className="rounded-2xl p-5 w-full max-w-sm"
            style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(100,116,139,0.15)' }}>👢</div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
                  Wyrzuć {member.displayName}
                </h3>
                <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
                  Użytkownik zostanie usunięty z serwera
                </p>
              </div>
            </div>
            {kickError && <p className="text-xs mb-3" style={{ color: 'var(--eb-accent2)' }}>{kickError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowKick(false)} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
              <button onClick={handleKickConfirm} disabled={kickLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'rgba(100,116,139,0.2)', color: 'var(--eb-text2)', border: '1px solid rgba(100,116,139,0.4)' }}>
                {kickLoading ? 'Wyrzucanie...' : '👢 Wyrzuć'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={ref} className="relative">
        <button
          ref={btnRef}
          onClick={() => { setOpen(o => !o); setShowRoles(false) }}
          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:bg-white/10"
          style={{ color: 'var(--eb-text3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>

        {open && menuPos && createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 9999,
              background: 'var(--eb-bg1)',
              border: '0.5px solid var(--eb-border2)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              borderRadius: 12,
              overflow: 'hidden',
              minWidth: 168,
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >

            {}
            {canManageRoles && (
              <>
                <button
                  onClick={() => setShowRoles(r => !r)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-white/[0.05] transition-colors"
                  style={{ color: '#a78bfa' }}
                >
                  <span className="flex items-center gap-2">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    Nadaj rangę
                  </span>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ transform: showRoles ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {}
                {showRoles && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderTop: '0.5px solid var(--eb-border)' }}>
                    {serverRoles.length === 0 && (
                      <div className="px-4 py-2 text-[10px]" style={{ color: 'var(--eb-text3)' }}>Ładowanie...</div>
                    )}
                    {serverRoles.map(role => {
                      const meta = ROLE_META_MENU[role.name]
                      const isActive = currentRole === role.name
                      const loading = assigningRole === role.id
                      return (
                        <button
                          key={role.id}
                          onClick={() => handleAssignRole(role.id, role.name)}
                          disabled={!!assigningRole}
                          className="flex items-center gap-2.5 w-full px-4 py-2 text-xs transition-colors hover:bg-white/[0.05]"
                          style={{ color: meta?.color ?? 'var(--eb-text2)', opacity: assigningRole && !loading ? 0.5 : 1 }}
                        >
                          {}
                          <span style={{ width: 14, flexShrink: 0 }}>
                            {loading ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ animation: 'spin 0.7s linear infinite' }}>
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                              </svg>
                            ) : isActive ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            ) : null}
                          </span>
                          <span>{meta?.icon} {role.name}</span>
                          {isActive && (
                            <span className="ml-auto text-[9px] opacity-50">kliknij aby usunąć</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {hasModActions && <div style={{ height: '0.5px', background: 'var(--eb-border)', margin: '2px 8px' }} />}
              </>
            )}

            {}
            {effectiveCanMute && !isMuted && (
              <button onClick={() => { setShowMute(true); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/[0.05] transition-colors"
                style={{ color: '#fb923c' }}>
                🔇 Wycisz
              </button>
            )}
            {effectiveCanMute && isMuted && (
              <button onClick={async () => { await unmute(member.userId); setIsMuted(false); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/[0.05] transition-colors"
                style={{ color: '#60a5fa' }}>
                🔊 Cofnij wyciszenie
              </button>
            )}
            {effectiveCanKick && (
              <button onClick={() => { setShowKick(true); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/[0.05] transition-colors"
                style={{ color: 'var(--eb-text2)' }}>
                👢 Wyrzuć
              </button>
            )}
            {effectiveCanBan && (
              <button onClick={() => { setShowBan(true); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/[0.05] transition-colors"
                style={{ color: 'var(--eb-accent2)' }}>
                🔨 Zbanuj
              </button>
            )}
            {hasModActions && (
              <>
                <div style={{ height: '0.5px', background: 'var(--eb-border)', margin: '2px 8px' }} />
                <button onClick={() => { setShowStrikes(true); setOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-white/[0.05] transition-colors"
                  style={{ color: '#eab308' }}>
                  ⚠️ Strike / historia
                </button>
              </>
            )}
          </div>,
          document.body
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
