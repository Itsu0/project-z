'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { RolesTab } from './RolesTab'
import { usePermissions } from '@/hooks/usePermissions'
import { ImageCropModal } from '@/components/ui/ImageCropModal'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Tab = 'ogólne' | 'kanały' | 'role' | 'członkowie' | 'emoji'

async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Błąd serwera')
  return data
}

const ROLE_COLORS = ['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6','#ffffff','#94a3b8','#f59e0b']
const SERVER_COLORS = [
  'linear-gradient(135deg,#dc2626,#f59e0b)',
  'linear-gradient(135deg,#4a4aff,#7a4aff)',
  'linear-gradient(135deg,#22c55e,#15803d)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#f97316,#ea580c)',
  'linear-gradient(135deg,#06b6d4,#0891b2)',
]

function TabGeneral({ server, onClose }: { server: any; onClose: () => void }) {
  const { token, servers, setServers } = useStore()
  const [name,         setName]         = useState(server.name)
  const [color,        setColor]        = useState(server.icon_color)
  const [logoUrl,      setLogoUrl]      = useState<string | null>(server.icon_url ?? null)
  const [cropSrc,      setCropSrc]      = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')
  const [confirm,      setConfirm]      = useState(false)
  const [inviteCode,   setInviteCode]   = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleLogoCropped(dataUrl: string) {
    setCropSrc(null)
    if (!token) return
    try {
      const res = await apiFetch(`/api/servers/${server.id}/logo`, token, {
        method: 'POST',
        body: JSON.stringify({ logo: dataUrl }),
      })
      setLogoUrl(res.iconUrl)
      setServers(servers.map(s => s.id === server.id ? { ...s, icon_url: res.iconUrl } : s))
      setMsg('✓ Logo zaktualizowane')
    } catch (e: any) { setMsg(e.message) }
  }

  async function generateInvite() {
    if (!token) return
    setGeneratingInvite(true)
    try {
      const res = await apiFetch(`/api/servers/${server.id}/invites`, token, { method: 'POST' })
      setInviteCode(res.code)
    } catch (e: any) { setMsg(e.message) }
    finally { setGeneratingInvite(false) }
  }

  function copyInvite() {
    if (!inviteCode) return
    const url = `${window.location.origin}/invite/${inviteCode}`
    navigator.clipboard.writeText(url)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function save() {
    if (!token) return
    setSaving(true); setMsg('')
    try {
      await apiFetch(`/api/servers/${server.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), iconColor: color }),
      })
      setServers(servers.map(s => s.id === server.id ? { ...s, name: name.trim(), icon_color: color } : s))
      setMsg('✓ Zapisano')
    } catch (e: any) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      {}
      <div className="p-4 rounded-2xl" style={{ background: 'var(--eb-bg3)', border: '0.5px solid var(--eb-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--eb-text3)' }}>Podgląd</p>
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => logoRef.current?.click()}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl overflow-hidden"
              style={{ background: logoUrl ? 'transparent' : color }}>
              {logoUrl
                ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
                : name.slice(0,1).toUpperCase()
              }
            </div>
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
          {cropSrc && (
            <ImageCropModal
              src={cropSrc}
              title="Dostosuj logo serwera"
              round={false}
              onSave={handleLogoCropped}
              onClose={() => setCropSrc(null)}
            />
          )}
          <div>
            <div className="font-semibold" style={{ color: 'var(--eb-text1)' }}>{name}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>Serwer</div>
          </div>
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
          Kolor ikony
          {logoUrl && <span className="ml-2 text-[10px] font-normal normal-case" style={{ color: 'var(--eb-text3)' }}>(nieaktywny — używasz własnego logo)</span>}
        </label>
        <div className="flex gap-2 flex-wrap">
          {SERVER_COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setLogoUrl(null) }}
              className="w-9 h-9 rounded-full transition-all"
              style={{ background: c, outline: color === c && !logoUrl ? '2px solid white' : 'none', outlineOffset: 2, transform: color === c && !logoUrl ? 'scale(1.12)' : 'scale(1)' }} />
          ))}
          <button onClick={() => logoRef.current?.click()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
            style={{ border: '1.5px dashed var(--eb-border2)', color: 'var(--eb-text3)', outline: logoUrl ? '2px solid white' : 'none', outlineOffset: 2 }}
            title="Prześlij własne logo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text2)' }}>Nazwa serwera</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="ember-input w-full px-4 py-2.5" maxLength={100} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="ember-btn px-6 py-2 text-sm">
          {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
        </button>
        {msg && <span className="text-xs" style={{ color: msg.startsWith('✓') ? 'var(--eb-online)' : 'var(--eb-accent2)' }}>{msg}</span>}
      </div>

      {}
      <div style={{ borderTop: '0.5px solid var(--eb-border)', paddingTop: 16 }}>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--eb-text2)' }}>
          Link zaproszenia
        </label>
        {!inviteCode ? (
          <button onClick={generateInvite} disabled={generatingInvite}
            className="ember-btn px-4 py-2 text-sm flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {generatingInvite ? 'Generowanie...' : 'Wygeneruj link'}
          </button>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono truncate"
              style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid var(--eb-border)', color: 'var(--eb-text2)' }}>
              {window.location.origin}/invite/{inviteCode}
            </div>
            <button onClick={copyInvite}
              className="px-3 py-2.5 rounded-xl text-sm flex items-center gap-1.5 transition-all flex-shrink-0"
              style={{
                background: inviteCopied ? 'rgba(34,197,94,0.15)' : 'rgba(74,158,255,0.1)',
                color: inviteCopied ? 'var(--eb-online)' : 'var(--eb-voice)',
                border: `0.5px solid ${inviteCopied ? 'rgba(34,197,94,0.3)' : 'rgba(74,158,255,0.2)'}`,
              }}>
              {inviteCopied ? '✓ Skopiowano' : '📋 Kopiuj'}
            </button>
            <button onClick={() => setInviteCode(null)}
              className="px-2.5 py-2.5 rounded-xl transition-all hover:bg-white/10"
              style={{ color: 'var(--eb-text3)' }} title="Odśwież">
              ↻
            </button>
          </div>
        )}
      </div>

      {}
      <div style={{ borderTop: '0.5px solid var(--eb-border)', paddingTop: 16 }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--eb-accent2)' }}>Strefa niebezpieczna</h3>
        {!confirm ? (
          <button onClick={() => setConfirm(true)}
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)', border: '1px solid rgba(220,38,38,0.25)' }}>
            Usuń serwer
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: 'var(--eb-accent2)' }}>Czy na pewno chcesz usunąć serwer <strong>{server.name}</strong>? Tej operacji nie można cofnąć.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="ember-btn-ghost px-4 py-1.5 text-xs">Anuluj</button>
              <button className="px-4 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--eb-accent2)', border: '1px solid rgba(220,38,38,0.4)' }}>
                Tak, usuń serwer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabChannels({ server }: { server: any }) {
  const { token, channels, setChannels, currentChannelId, setCurrentChannel } = useStore()
  const serverChannels = channels[server.id] ?? []
  const [newName,   setNewName]   = useState('')
  const [newType,   setNewType]   = useState<'text' | 'voice' | 'forum'>('text')
  const [newTopic,  setNewTopic]  = useState('')
  const [creating,  setCreating]  = useState(false)
  const [error,     setError]     = useState('')

  const textChs  = serverChannels.filter(c => c.type === 'text' || c.type === 'announcement')
  const voiceChs = serverChannels.filter(c => c.type === 'voice')
  const forumChs = serverChannels.filter(c => c.type === 'forum')

  async function createChannel() {
    if (!token || !newName.trim()) return
    setCreating(true); setError('')
    try {
      const data = await apiFetch(`/api/servers/${server.id}/channels`, token, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), type: newType, topic: newTopic.trim() || undefined }),
      })
      setChannels(server.id, [...serverChannels, data.channel])
      setNewName(''); setNewTopic('')
    } catch (e: any) { setError(e.message) }
    finally { setCreating(false) }
  }

  async function deleteChannel(channelId: string, name: string) {
    if (!token || !confirm(`Usunąć kanał #${name}?`)) return
    try {
      await apiFetch(`/api/servers/${server.id}/channels/${channelId}`, token, { method: 'DELETE' })
      const updated = serverChannels.filter(c => c.id !== channelId)
      setChannels(server.id, updated)
      if (currentChannelId === channelId) {
        const next = updated.find(c => c.type === 'text' || c.type === 'announcement')
        setCurrentChannel(next?.id ?? '')
      }
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="flex flex-col gap-6">
      {}
      {[
        { label: 'Tekstowe', icon: '~',  list: textChs },
        { label: 'Głosowe',  icon: '🔊', list: voiceChs },
        { label: 'Forum',    icon: '🗂',  list: forumChs },
      ].map(group => (
        <div key={group.label}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"
            style={{ color: 'var(--eb-text3)' }}>
            {group.label}
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text3)' }}>
              {group.list.length}
            </span>
          </div>
          {group.list.length === 0 ? (
            <p className="text-xs py-2 px-3 rounded-lg" style={{ color: 'var(--eb-text3)', background: 'rgba(255,255,255,0.02)', border: '0.5px dashed var(--eb-border)' }}>
              Brak kanałów
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {group.list.map(ch => (
                <div key={ch.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl group"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--eb-border)' }}>
                  <span className="text-sm flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
                    {ch.type === 'voice' ? '🔊' : ch.type === 'forum' ? '🗂' : '#'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--eb-text1)' }}>{ch.name}</div>
                    {ch.topic && <div className="text-xs truncate mt-0.5" style={{ color: 'var(--eb-text3)' }}>{ch.topic}</div>}
                  </div>
                  <button onClick={() => deleteChannel(ch.id, ch.name)}
                    className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-all"
                    style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.25)' }}>
                    Usuń
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {}
      <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--eb-border)' }}>
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--eb-text2)' }}>Nowy kanał</h4>

        {}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: 'text',  label: '# Tekstowy',  desc: 'Wiadomości i czat' },
            { id: 'voice', label: '🔊 Głosowy',   desc: 'Rozmowy i stream' },
            { id: 'forum', label: '🗂 Forum',      desc: 'Wątki i dyskusje' },
          ].map(t => (
            <button key={t.id} onClick={() => setNewType(t.id as any)}
              className="py-2.5 px-3 rounded-xl text-left transition-all"
              style={{
                background: newType === t.id ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${newType === t.id ? 'rgba(245,158,11,0.4)' : 'var(--eb-border)'}`,
              }}>
              <div className="text-xs font-semibold" style={{ color: newType === t.id ? 'var(--eb-accent)' : 'var(--eb-text1)' }}>{t.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {}
        <div className="mb-2">
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--eb-text3)' }}>
            Nazwa kanału *
          </label>
          <input value={newName} onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-ąćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && createChannel()}
            placeholder={newType === 'voice' ? 'np. voice-chat' : newType === 'forum' ? 'np. pomysly' : 'np. ogólny'}
            className="ember-input w-full px-3 py-2.5 text-sm" maxLength={64} />
        </div>

        {}
        {(newType === 'text' || newType === 'forum') && (
          <div className="mb-3">
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--eb-text3)' }}>
              Temat (opcjonalne)
            </label>
            <input value={newTopic} onChange={e => setNewTopic(e.target.value)}
              placeholder="np. Ogólne rozmowy o grze..."
              className="ember-input w-full px-3 py-2.5 text-sm" maxLength={1024} />
          </div>
        )}

        {error && <p className="text-xs mb-2" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}

        <button onClick={createChannel} disabled={creating || !newName.trim()}
          className="ember-btn w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
          {creating ? (
            <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Tworzenie...</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Utwórz kanał</>
          )}
        </button>
      </div>
    </div>
  )
}

function TabMembers({ server }: { server: any }) {
  const { token, members, removeMember } = useStore()
  const serverMembers = members[server.id] ?? []
  const [search, setSearch] = useState('')
  const [kickTarget, setKickTarget] = useState<{ userId: string; name: string } | null>(null)
  const [kickLoading, setKickLoading] = useState(false)
  const [kickError,   setKickError]   = useState('')

  const filtered = serverMembers.filter(m =>
    m.display_name.toLowerCase().includes(search.toLowerCase()) ||
    m.username.toLowerCase().includes(search.toLowerCase())
  )

  async function confirmKick() {
    if (!token || !kickTarget) return
    setKickLoading(true); setKickError('')
    try {
      await apiFetch(`/api/servers/${server.id}/members/${kickTarget.userId}`, token, { method: 'DELETE' })
      removeMember(server.id, kickTarget.userId)
      setKickTarget(null)
    } catch (e: any) { setKickError(e.message) }
    finally { setKickLoading(false) }
  }

  return (
    <>
      {}
      {kickTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setKickTarget(null) }}>
          <div className="rounded-2xl p-5 w-full max-w-sm"
            style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(100,116,139,0.15)' }}>👢</div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
                  Wyrzuć {kickTarget.name}
                </h3>
                <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
                  Użytkownik zostanie usunięty z serwera
                </p>
              </div>
            </div>
            {kickError && <p className="text-xs mb-3" style={{ color: 'var(--eb-accent2)' }}>{kickError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setKickTarget(null)} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
              <button onClick={confirmKick} disabled={kickLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'rgba(100,116,139,0.2)', color: 'var(--eb-text2)', border: '1px solid rgba(100,116,139,0.4)' }}>
                {kickLoading ? 'Wyrzucanie...' : '👢 Wyrzuć'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>
            Członkowie ({serverMembers.length})
          </h3>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj..."
            className="ember-input px-3 py-1.5 text-xs" style={{ width: 160 }} />
        </div>
        <div className="flex flex-col gap-1.5">
          {filtered.map(m => (
            <div key={m.user_id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors hover:bg-white/[0.03]"
              style={{ border: '0.5px solid var(--eb-border)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: m.avatar_color ?? 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>
                {m.display_name.slice(0,1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--eb-text1)' }}>{m.display_name}</div>
                <div className="text-xs" style={{ color: 'var(--eb-text3)' }}>@{m.username}</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text2)' }}>
                {m.status ?? 'offline'}
              </span>
              <button onClick={() => setKickTarget({ userId: m.user_id, name: m.display_name })}
                className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-all"
                style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)' }}>
                Wyrzuć
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function TabEmoji({ server }: { server: any }) {
  const { token } = useStore()
  const [emoji,     setEmoji]     = useState<any[]>([])
  const [loaded,    setLoaded]    = useState(false)
  const [newName,   setNewName]   = useState('')
  const [preview,   setPreview]   = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg,       setMsg]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const MAX = 50

  useEffect(() => {
    if (!token || loaded) return
    apiFetch(`/api/servers/${server.id}/emoji`, token)
      .then(d => { setEmoji(d.emoji ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [token, server.id, loaded])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg('Tylko pliki graficzne'); return }
    if (file.size > 256 * 1024) { setMsg('Maks. 256KB'); return }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    setNewName(file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 32))
    e.target.value = ''
  }

  async function uploadEmoji() {
    if (!token || !preview || !newName.trim()) return
    if (emoji.length >= MAX) { setMsg('Osiągnięto limit 50 emoji'); return }
    if (!/^[a-z0-9_]+$/i.test(newName)) { setMsg('Nazwa może zawierać tylko litery, cyfry i _'); return }
    setUploading(true); setMsg('')
    try {
      const data = await apiFetch(`/api/servers/${server.id}/emoji`, token, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), image: preview }),
      })
      setEmoji(prev => [...prev, data.emoji])
      setPreview(null); setNewName('')
      setMsg('✓ Dodano emoji')
      setTimeout(() => setMsg(''), 3000)
    } catch (e: any) { setMsg(e.message) }
    finally { setUploading(false) }
  }

  async function deleteEmoji(id: string) {
    if (!token) return
    if (!confirm('Usunąć to emoji?')) return
    try {
      await apiFetch(`/api/servers/${server.id}/emoji/${id}`, token, { method: 'DELETE' })
      setEmoji(prev => prev.filter(e => e.id !== id))
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="flex flex-col gap-5">
      {}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>Niestandardowe Emoji</h3>
        <div className="flex items-center gap-2">
          <div className="h-1.5 rounded-full overflow-hidden w-24" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(emoji.length / MAX) * 100}%`, background: emoji.length >= MAX ? 'var(--eb-accent2)' : 'var(--eb-gradient)' }} />
          </div>
          <span className="text-xs" style={{ color: emoji.length >= MAX ? 'var(--eb-accent2)' : 'var(--eb-text3)' }}>
            {emoji.length}/{MAX}
          </span>
        </div>
      </div>

      {}
      {emoji.length < MAX && (
        <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--eb-border)' }}>
          <input ref={fileRef} type="file" accept="image/png,image/gif,image/jpeg,image/webp" className="hidden" onChange={handleFileSelect} />

          {!preview ? (
            <button onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 w-full py-6 rounded-xl transition-all hover:bg-white/[0.04]"
              style={{ border: '1.5px dashed var(--eb-border2)' }}>
              <span className="text-3xl">➕</span>
              <span className="text-xs font-medium" style={{ color: 'var(--eb-text2)' }}>Kliknij aby wybrać emoji</span>
              <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>PNG, GIF, JPEG, WEBP · maks. 256KB · zalecane 128×128px</span>
            </button>
          ) : (
            <div className="flex items-center gap-4">
              {}
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <img src={preview} alt="preview" className="w-full h-full object-contain" />
              </div>
              {}
              <div className="flex-1">
                <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--eb-text3)' }}>
                  Nazwa (używaj jako :nazwa:)
                </label>
                <div className="flex gap-2">
                  <span className="text-sm" style={{ color: 'var(--eb-text3)' }}>:</span>
                  <input value={newName} onChange={e => setNewName(e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase())}
                    placeholder="nazwa_emoji" maxLength={32}
                    className="ember-input flex-1 px-3 py-2 text-sm" />
                  <span className="text-sm" style={{ color: 'var(--eb-text3)' }}>:</span>
                </div>
              </div>
              {}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={uploadEmoji} disabled={uploading || !newName.trim()}
                  className="ember-btn px-3 py-1.5 text-xs">
                  {uploading ? '...' : '✓ Dodaj'}
                </button>
                <button onClick={() => { setPreview(null); setNewName('') }}
                  className="ember-btn-ghost px-3 py-1.5 text-xs">
                  Anuluj
                </button>
              </div>
            </div>
          )}
          {msg && (
            <p className="text-xs mt-2 text-center" style={{ color: msg.startsWith('✓') ? 'var(--eb-online)' : 'var(--eb-accent2)' }}>
              {msg}
            </p>
          )}
        </div>
      )}

      {}
      {emoji.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl"
          style={{ border: '0.5px dashed var(--eb-border)' }}>
          <span className="text-4xl">😄</span>
          <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Brak emoji — dodaj pierwszy!</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {emoji.map(e => (
            <div key={e.id}
              className="group relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors hover:bg-white/[0.05]"
              style={{ border: '0.5px solid var(--eb-border)' }}>
              <img src={e.url ?? e.image} alt={e.name} className="w-12 h-12 object-contain rounded-lg" />
              <span className="text-[9px] text-center truncate w-full font-medium" style={{ color: 'var(--eb-text3)' }}>
                :{e.name}:
              </span>
              <button onClick={() => deleteEmoji(e.id)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(220,38,38,0.8)', color: '#fff' }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ServerSettings({ onClose }: { onClose: () => void }) {
  const { currentServerId, servers } = useStore()
  const [activeTab, setActiveTab] = useState<Tab>('ogólne')
  const server = servers.find(s => s.id === currentServerId)

  const { canManageServer, canManageChannels, canManageRoles, canKick, canBan, canMute } = usePermissions(currentServerId ?? null)

  const TABS = [
    { id: 'ogólne'     as Tab, label: 'Ogólne',     icon: '⚙' },
    { id: 'kanały'     as Tab, label: 'Kanały',      icon: '#' },
    { id: 'role'       as Tab, label: 'Role',        icon: '🏷' },
    { id: 'członkowie' as Tab, label: 'Członkowie',  icon: '👥' },
    { id: 'emoji'      as Tab, label: 'Emoji',       icon: '😄' },
  ].filter(t => {
    if (t.id === 'ogólne')     return canManageServer
    if (t.id === 'kanały')     return canManageChannels
    if (t.id === 'role')       return canManageRoles || canKick || canBan || canMute
    if (t.id === 'członkowie') return canKick || canBan || canMute
    if (t.id === 'emoji')      return canManageServer
    return false
  })

  useEffect(() => {
    if (TABS.length > 0 && !TABS.find(t => t.id === activeTab)) {
      setActiveTab(TABS[0].id)
    }
  }, [TABS.length])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  if (!server) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
        <p className="text-sm mb-4" style={{ color: 'var(--eb-text2)' }}>Nie wybrano serwera</p>
        <button onClick={onClose} className="ember-btn px-6 py-2 text-sm">Zamknij</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex"
        style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)', maxHeight: '82vh' }}>

        {}
        <div className="flex flex-col border-r py-4 flex-shrink-0"
          style={{ width: 196, background: 'var(--eb-bg0)', borderColor: 'var(--eb-border)' }}>

          {}
          <div className="px-4 pb-4 mb-2 border-b" style={{ borderColor: 'var(--eb-border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: server.icon_color }}>
                {server.name.slice(0,1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>{server.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>Ustawienia serwera</div>
              </div>
            </div>
          </div>

          {}
          <div className="flex flex-col gap-0.5 px-2 flex-1 overflow-y-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-all"
                style={{
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--eb-text1)' : 'var(--eb-text2)',
                  fontWeight: activeTab === tab.id ? 500 : 400,
                }}>
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-2 pt-2 border-t" style={{ borderColor: 'var(--eb-border)' }}>
            <button onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full transition-all hover:bg-white/[0.04]"
              style={{ color: 'var(--eb-text3)' }}>
              <span>✕</span> Zamknij (Esc)
            </button>
          </div>
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--eb-text1)' }}>
            <span>{TABS.find(t => t.id === activeTab)?.icon}</span>
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          {activeTab === 'ogólne'     && <TabGeneral server={server} onClose={onClose} />}
          {activeTab === 'kanały'     && <TabChannels server={server} />}
          {activeTab === 'role'       && <RolesTab server={server} />}
          {activeTab === 'członkowie' && <TabMembers server={server} />}
          {activeTab === 'emoji'      && <TabEmoji server={server} />}
        </div>
      </div>
    </div>
  )
}
