'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { RolesTab } from './RolesTab'
import { usePermissions } from '@/hooks/usePermissions'
import { ImageCropModal } from '@/components/ui/ImageCropModal'
import { Select } from '@/components/ui/Select'
import { useT } from '@/lib/i18n'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Tab = 'ogólne' | 'kanały' | 'role' | 'członkowie' | 'emoji' | 'zbanowani' | 'moderacja' | 'zaproszenia' | 'analityka'

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
  const t = useT()
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
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--eb-text3)' }}>{t('serverSettings.general.preview')}</p>
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
            <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>{t('serverSettings.general.server')}</div>
          </div>
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
          {t('serverSettings.general.iconColor')}
          {logoUrl && <span className="ml-2 text-[10px] font-normal normal-case" style={{ color: 'var(--eb-text3)' }}>({t('settings.profile.avatarInactive')})</span>}
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
            title={t('serverSettings.general.uploadLogo')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text2)' }}>{t('serverSettings.general.serverName')}</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="ember-input w-full px-4 py-2.5" maxLength={100} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="ember-btn px-6 py-2 text-sm">
          {saving ? t('serverSettings.general.saving') : t('serverSettings.general.save')}
        </button>
        {msg && <span className="text-xs" style={{ color: msg.startsWith('✓') ? 'var(--eb-online)' : 'var(--eb-accent2)' }}>{msg}</span>}
      </div>

      {}
      <div style={{ borderTop: '0.5px solid var(--eb-border)', paddingTop: 16 }}>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--eb-text2)' }}>
          {t('serverSettings.general.inviteLink')}
        </label>
        {!inviteCode ? (
          <button onClick={generateInvite} disabled={generatingInvite}
            className="ember-btn px-4 py-2 text-sm flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {generatingInvite ? t('serverSettings.general.generating') : t('serverSettings.general.generateLink')}
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
              {inviteCopied ? t('serverSettings.general.copied') : `📋 ${t('serverSettings.general.copyLink')}`}
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
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--eb-accent2)' }}>{t('serverSettings.general.dangerZone')}</h3>
        {!confirm ? (
          <button onClick={() => setConfirm(true)}
            className="px-4 py-2 rounded-lg text-xs font-medium"
            style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)', border: '1px solid rgba(220,38,38,0.25)' }}>
            {t('serverSettings.general.deleteServer')}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: 'var(--eb-accent2)' }}>{t('serverSettings.general.deleteConfirm')} <strong>{server.name}</strong></p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(false)} className="ember-btn-ghost px-4 py-1.5 text-xs">{t('serverSettings.general.deleteCancel')}</button>
              <button className="px-4 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(220,38,38,0.2)', color: 'var(--eb-accent2)', border: '1px solid rgba(220,38,38,0.4)' }}>
                {t('serverSettings.general.deleteBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChannelPermsPanel({ serverId, channelId, channelName, token, onClose }: {
  serverId: string; channelId: string; channelName: string; token: string; onClose: () => void
}) {
  const [roles, setRoles] = useState<any[]>([])
  const [denied, setDenied] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/servers/${serverId}/roles`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${BASE}/api/servers/${serverId}/channels/${channelId}/role-permissions`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([rolesData, permsData]) => {
      setRoles(rolesData.roles ?? [])
      const d = new Set<string>((permsData.permissions ?? []).filter((p: any) => p.deny_view).map((p: any) => p.role_id as string))
      setDenied(d)
    }).catch(() => {})
  }, [serverId, channelId, token])

  async function toggleRole(roleId: string) {
    setSaving(roleId)
    const newDeny = !denied.has(roleId)
    try {
      await fetch(`${BASE}/api/servers/${serverId}/channels/${channelId}/role-permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roleId, denyView: newDeny }),
      })
      setDenied(prev => {
        const next = new Set(prev)
        if (newDeny) next.add(roleId); else next.delete(roleId)
        return next
      })
    } catch {} finally { setSaving(null) }
  }

  return (
    <div className="mt-2 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--eb-border2)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: 'var(--eb-text2)' }}>🔒 Widoczność #{channelName}</span>
        <button onClick={onClose} className="text-xs" style={{ color: 'var(--eb-text3)' }}>✕</button>
      </div>
      <p className="text-[11px] mb-3" style={{ color: 'var(--eb-text3)' }}>
        Zablokuj widoczność kanału dla wybranych ról. Administratorzy zawsze mają dostęp.
      </p>
      <div className="flex flex-col gap-2">
        {roles.filter((r: any) => r.name !== '@everyone').map((role: any) => {
          const isDenied = denied.has(role.id)
          const isLoading = saving === role.id
          return (
            <div key={role.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
              style={{ background: isDenied ? 'rgba(220,38,38,0.07)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${isDenied ? 'rgba(220,38,38,0.2)' : 'var(--eb-border)'}` }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: role.color ?? '#a8a9af' }} />
                <span className="text-xs" style={{ color: 'var(--eb-text1)' }}>{role.name}</span>
              </div>
              <button onClick={() => toggleRole(role.id)} disabled={!!saving}
                className="text-[11px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                style={{
                  background: isDenied ? 'rgba(220,38,38,0.15)' : 'rgba(34,197,94,0.1)',
                  color: isDenied ? '#f87171' : '#4ade80',
                  border: `0.5px solid ${isDenied ? 'rgba(220,38,38,0.3)' : 'rgba(34,197,94,0.25)'}`,
                }}>
                {isLoading ? '...' : isDenied ? '🚫 Zablokowany' : '✓ Widoczny'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabChannels({ server }: { server: any }) {
  const t = useT()
  const { token, channels, setChannels, currentChannelId, setCurrentChannel } = useStore()
  const serverChannels = channels[server.id] ?? []
  const [newName,   setNewName]   = useState('')
  const [newType,   setNewType]   = useState<'text' | 'voice' | 'forum'>('text')
  const [newTopic,  setNewTopic]  = useState('')
  const [creating,  setCreating]  = useState(false)
  const [error,     setError]     = useState('')
  const [permsChannel, setPermsChannel] = useState<string | null>(null)

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
        { label: t('serverSettings.channels.type.text'),  icon: '~',  list: textChs },
        { label: t('serverSettings.channels.type.voice'), icon: '🔊', list: voiceChs },
        { label: t('serverSettings.channels.type.forum'), icon: '🗂',  list: forumChs },
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
              {t('serverSettings.channels.noChannels')}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {group.list.map(ch => (
                <div key={ch.id}>
                  <div
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl group"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--eb-border)' }}>
                    <span className="text-sm flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
                      {ch.type === 'voice' ? '🔊' : ch.type === 'forum' ? '🗂' : '#'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--eb-text1)' }}>{ch.name}</div>
                      {ch.topic && <div className="text-xs truncate mt-0.5" style={{ color: 'var(--eb-text3)' }}>{ch.topic}</div>}
                    </div>
                    <button onClick={() => setPermsChannel(permsChannel === ch.id ? null : ch.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-all"
                      style={{
                        background: permsChannel === ch.id ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                        color: permsChannel === ch.id ? 'var(--eb-accent)' : 'var(--eb-text3)',
                        border: `0.5px solid ${permsChannel === ch.id ? 'rgba(245,158,11,0.3)' : 'var(--eb-border)'}`,
                      }}>
                      🔒
                    </button>
                    <button onClick={() => deleteChannel(ch.id, ch.name)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.25)' }}>
                      {t('serverSettings.channels.delete')}
                    </button>
                  </div>
                  {permsChannel === ch.id && token && (
                    <ChannelPermsPanel
                      serverId={server.id}
                      channelId={ch.id}
                      channelName={ch.name}
                      token={token}
                      onClose={() => setPermsChannel(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {}
      <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--eb-border)' }}>
        <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--eb-text2)' }}>{t('serverSettings.channels.addChannel')}</h4>

        {}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: 'text',  label: `# ${t('serverSettings.channels.type.text')}`,  desc: t('chat.noMessages') },
            { id: 'voice', label: `🔊 ${t('serverSettings.channels.type.voice')}`, desc: t('serverSettings.channels.type.voice') },
            { id: 'forum', label: `🗂 ${t('serverSettings.channels.type.forum')}`, desc: t('serverSettings.channels.type.forum') },
          ].map(ch => (
            <button key={ch.id} onClick={() => setNewType(ch.id as any)}
              className="py-2.5 px-3 rounded-xl text-left transition-all"
              style={{
                background: newType === ch.id ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${newType === ch.id ? 'rgba(245,158,11,0.4)' : 'var(--eb-border)'}`,
              }}>
              <div className="text-xs font-semibold" style={{ color: newType === ch.id ? 'var(--eb-accent)' : 'var(--eb-text1)' }}>{ch.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>{ch.desc}</div>
            </button>
          ))}
        </div>

        {}
        <div className="mb-2">
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--eb-text3)' }}>
            {t('serverSettings.channels.channelName')} *
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
            <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>{t('poll.creating')}</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>{t('serverSettings.channels.addChannel')}</>
          )}
        </button>
      </div>
    </div>
  )
}

function TabMembers({ server }: { server: any }) {
  const t = useT()
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
                  {t('serverSettings.members.kick')} {kickTarget.name}
                </h3>
                <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
                  {t('serverSettings.members.kick')}
                </p>
              </div>
            </div>
            {kickError && <p className="text-xs mb-3" style={{ color: 'var(--eb-accent2)' }}>{kickError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setKickTarget(null)} className="ember-btn-ghost flex-1 py-2.5 text-sm">{t('common.cancel')}</button>
              <button onClick={confirmKick} disabled={kickLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'rgba(100,116,139,0.2)', color: 'var(--eb-text2)', border: '1px solid rgba(100,116,139,0.4)' }}>
                {kickLoading ? '...' : `👢 ${t('serverSettings.members.kick')}`}
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
            placeholder={t('serverSettings.members.search')}
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
                {t('serverSettings.members.kick')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function TabBans({ server }: { server: any }) {
  const { token } = useStore()
  const [bans, setBans] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [unbanTarget, setUnbanTarget] = useState<{ userId: string; name: string } | null>(null)
  const [unbanLoading, setUnbanLoading] = useState(false)
  const [unbanError, setUnbanError] = useState('')

  useEffect(() => {
    if (!token || loaded) return
    apiFetch(`/api/servers/${server.id}/moderation/bans`, token)
      .then(d => { setBans(d.bans ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [token, server.id, loaded])

  async function confirmUnban() {
    if (!token || !unbanTarget) return
    setUnbanLoading(true); setUnbanError('')
    try {
      await apiFetch(`/api/servers/${server.id}/moderation/ban/${unbanTarget.userId}`, token, { method: 'DELETE' })
      setBans(prev => prev.filter(b => b.user_id !== unbanTarget.userId))
      setUnbanTarget(null)
    } catch (e: any) { setUnbanError(e.message) }
    finally { setUnbanLoading(false) }
  }

  return (
    <>
      {unbanTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setUnbanTarget(null) }}>
          <div className="rounded-2xl p-5 w-full max-w-sm"
            style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(34,197,94,0.1)' }}>🔓</div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
                  Cofnij bana — {unbanTarget.name}
                </h3>
                <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
                  Użytkownik będzie mógł ponownie dołączyć do serwera.
                </p>
              </div>
            </div>
            {unbanError && <p className="text-xs mb-3" style={{ color: 'var(--eb-accent2)' }}>{unbanError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setUnbanTarget(null)} className="ember-btn-ghost flex-1 py-2.5 text-sm">Anuluj</button>
              <button onClick={confirmUnban} disabled={unbanLoading}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
                style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--eb-online)', border: '1px solid rgba(34,197,94,0.35)' }}>
                {unbanLoading ? '...' : '🔓 Odbanuj'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>
            Zbanowani ({bans.length})
          </h3>
        </div>

        {!loaded ? (
          <div className="flex items-center justify-center py-10">
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : bans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl"
            style={{ border: '0.5px dashed var(--eb-border)' }}>
            <span className="text-4xl">🔓</span>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Brak zbanowanych użytkowników</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {bans.map(b => (
              <div key={b.user_id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors hover:bg-white/[0.03]"
                style={{ border: '0.5px solid var(--eb-border)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: b.avatar_color ?? '#64748b' }}>
                  {(b.display_name ?? b.username ?? '?').slice(0,1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--eb-text1)' }}>{b.display_name ?? b.username}</div>
                  <div className="text-xs" style={{ color: 'var(--eb-text3)' }}>@{b.username}</div>
                  {b.reason && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--eb-text3)' }}>
                      Powód: {b.reason}
                    </div>
                  )}
                </div>
                {b.created_at && (
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
                    {new Date(b.created_at).toLocaleDateString('pl-PL')}
                  </span>
                )}
                <button onClick={() => setUnbanTarget({ userId: b.user_id, name: b.display_name ?? b.username })}
                  className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-lg transition-all flex-shrink-0"
                  style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--eb-online)', border: '0.5px solid rgba(34,197,94,0.25)' }}>
                  Odbanuj
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function TabEmoji({ server }: { server: any }) {
  const t = useT()
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
        <h3 className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>{t('serverSettings.tab.emoji')}</h3>
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
              <span className="text-xs font-medium" style={{ color: 'var(--eb-text2)' }}>{t('serverSettings.emoji.add')}</span>
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
                  {uploading ? '...' : `✓ ${t('serverSettings.emoji.add')}`}
                </button>
                <button onClick={() => { setPreview(null); setNewName('') }}
                  className="ember-btn-ghost px-3 py-1.5 text-xs">
                  {t('common.cancel')}
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
          <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>{t('serverSettings.emoji.noEmoji')}</p>
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

function TabModeration({ server }: { server: any }) {
  const { token } = useStore()
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const [settings, setSettings]   = useState<any>({})
  const [rules,    setRules]       = useState<any[]>([])
  const [roles,    setRoles]       = useState<any[]>([])
  const [channels, setChannels2]   = useState<any[]>([])
  const [saving,   setSaving]      = useState(false)
  const [saved,    setSaved]       = useState(false)
  const [newRule,  setNewRule]     = useState<{ type: string; value: string; action: string }>({ type: 'banned_word', value: '', action: 'delete' })
  const [addingRule, setAddingRule] = useState(false)
  const [modLog,   setModLog]      = useState<any[]>([])
  const [logLoaded, setLogLoaded]  = useState(false)
  const [activeSection, setActiveSection] = useState<'settings' | 'automod' | 'log'>('settings')

  useEffect(() => {
    if (!token || !server?.id) return
    Promise.all([
      fetch(`${BASE_URL}/api/servers/${server.id}/mod-settings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => { if (d.settings) setSettings(d.settings) }).catch(() => {}),
      fetch(`${BASE_URL}/api/servers/${server.id}/automod`,      { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => { if (d.rules) setRules(d.rules) }).catch(() => {}),
      fetch(`${BASE_URL}/api/servers/${server.id}/roles`,        { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => { if (d.roles) setRoles(d.roles) }).catch(() => {}),
      fetch(`${BASE_URL}/api/servers/${server.id}`,              { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => { if (d.channels) setChannels2(d.channels.filter((c: any) => c.type === 'text' || c.type === 'announcement')) }).catch(() => {}),
    ])
  }, [token, server?.id])

  async function saveSettings(patch?: any) {
    setSaving(true)
    const body = patch ? { ...settings, ...patch } : settings
    if (patch) setSettings((s: any) => ({ ...s, ...patch }))
    try {
      const res = await fetch(`${BASE_URL}/api/servers/${server.id}/mod-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (d.settings) setSettings(d.settings)
      if (d.newChannel) {
        setChannels2((prev: any[]) => {
          if (prev.some((c: any) => c.id === d.newChannel.id)) return prev
          return [...prev, d.newChannel]
        })
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  async function addRule() {
    if (!newRule.type) return
    setAddingRule(true)
    try {
      const res = await fetch(`${BASE_URL}/api/servers/${server.id}/automod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newRule),
      })
      const d = await res.json()
      if (d.rule) { setRules(r => [...r, d.rule]); setNewRule({ type: 'banned_word', value: '', action: 'delete' }) }
    } finally { setAddingRule(false) }
  }

  async function toggleRule(ruleId: string, enabled: boolean) {
    await fetch(`${BASE_URL}/api/servers/${server.id}/automod/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled }),
    })
    setRules(r => r.map(x => x.id === ruleId ? { ...x, enabled: enabled ? 1 : 0 } : x))
  }

  async function deleteRule(ruleId: string) {
    await fetch(`${BASE_URL}/api/servers/${server.id}/automod/${ruleId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    })
    setRules(r => r.filter(x => x.id !== ruleId))
  }

  async function loadLog() {
    if (logLoaded) return
    setLogLoaded(true)
    const res = await fetch(`${BASE_URL}/api/servers/${server.id}/mod-log?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
    const d = await res.json()
    setModLog(d.logs ?? [])
  }

  const RULE_TYPES = [
    { value: 'banned_word', label: '🚫 Zakazane słowo/fraza' },
    { value: 'spam',        label: '📢 Spam (X wiad./5s)' },
    { value: 'links',       label: '🔗 Linki HTTP/HTTPS' },
    { value: 'caps',        label: '🔤 Nadużycie CAPS (>70%)' },
    { value: 'invites',     label: '💌 Zaproszenia Discord' },
  ]
  const RULE_ACTIONS = [
    { value: 'delete',       label: 'Usuń wiadomość' },
    { value: 'delete_warn',  label: 'Usuń + strajk' },
    { value: 'delete_mute',  label: 'Usuń + strajk + mute 10min' },
  ]
  const STRIKE_ACTIONS = ['warn', 'mute', 'kick', 'ban']

  const sectionBtns = [
    { id: 'settings', label: '⚙ Ustawienia' },
    { id: 'automod',  label: '🤖 AutoMod' },
    { id: 'log',      label: '📋 Mod Log' },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 pb-3" style={{ borderBottom: '1px solid var(--eb-border)' }}>
        {sectionBtns.map(b => (
          <button key={b.id}
            onClick={() => { setActiveSection(b.id); if (b.id === 'log') loadLog() }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeSection === b.id ? 'rgba(34,197,94,0.12)' : 'var(--eb-bg3)',
              color: activeSection === b.id ? '#4ade80' : 'var(--eb-text3)',
              border: `1px solid ${activeSection === b.id ? 'rgba(34,197,94,0.3)' : 'var(--eb-border)'}`,
            }}>
            {b.label}
          </button>
        ))}
      </div>

      {activeSection === 'settings' && (
        <div className="flex flex-col gap-5">
          {/* Mod log channel */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: 'var(--eb-text3)' }}>
              📋 Kanał Mod-Log
            </label>
            <Select
              value={settings.mod_log_channel_id ?? ''}
              onChange={v => setSettings((s: any) => ({ ...s, mod_log_channel_id: v || null }))}
              placeholder="— Wyłączony —"
              options={channels.map((c: any) => ({ value: c.id, label: `#${c.name}` }))}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--eb-text3)' }}>Wszystkie akcje moderacyjne będą logowane w tym kanale.</p>
          </div>

          {/* Raid protection */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>🛡 Ochrona przed raidem</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>Lockdown gdy dużo osób dołącza naraz</p>
              </div>
              <button onClick={() => saveSettings({ raid_protection: settings.raid_protection ? 0 : 1 })}
                className="w-10 h-5 rounded-full transition-all flex-shrink-0 relative"
                style={{ background: settings.raid_protection ? '#4ade80' : 'var(--eb-bg4)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: settings.raid_protection ? '1.25rem' : '0.125rem' }} />
              </button>
            </div>
            {!!settings.raid_protection && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>Próg (dołączeń)</label>
                  <input type="number" min={3} max={100}
                    value={settings.raid_threshold ?? 10}
                    onChange={e => setSettings((s: any) => ({ ...s, raid_threshold: Number(e.target.value) }))}
                    className="ember-input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>Okno czasowe (sek)</label>
                  <input type="number" min={5} max={300}
                    value={settings.raid_window_secs ?? 30}
                    onChange={e => setSettings((s: any) => ({ ...s, raid_window_secs: Number(e.target.value) }))}
                    className="ember-input w-full px-3 py-2 text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Verification */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>✅ Weryfikacja nowych członków</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>Nowi dostają rolę weryfikacji i muszą kliknąć przycisk</p>
              </div>
              <button onClick={() => saveSettings({ verification_enabled: settings.verification_enabled ? 0 : 1 })}
                className="w-10 h-5 rounded-full transition-all flex-shrink-0 relative"
                style={{ background: settings.verification_enabled ? '#4ade80' : 'var(--eb-bg4)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: settings.verification_enabled ? '1.25rem' : '0.125rem' }} />
              </button>
            </div>
            {!!settings.verification_enabled && (
              <div>
                <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>Rola weryfikacji (przypisywana nowym)</label>
                <Select
                  value={settings.verification_role_id ?? ''}
                  onChange={v => setSettings((s: any) => ({ ...s, verification_role_id: v || null }))}
                  placeholder="— Wybierz rolę —"
                  options={roles.map((r: any) => ({ value: r.id, label: r.name }))}
                />
              </div>
            )}
          </div>

          {/* Strike system */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>⚡ System strajków — auto-eskalacja</p>
            {[
              { n: 1, label: 'Próg 1' },
              { n: 2, label: 'Próg 2' },
              { n: 3, label: 'Próg 3' },
            ].map(({ n, label }) => (
              <div key={n} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>{label} — strajków</label>
                  <input type="number" min={1} max={50}
                    value={(settings as any)[`strike_${n}_threshold`] ?? (n === 1 ? 3 : n === 2 ? 5 : 7)}
                    onChange={e => setSettings((s: any) => ({ ...s, [`strike_${n}_threshold`]: Number(e.target.value) }))}
                    className="ember-input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>Akcja</label>
                  <Select
                    value={(settings as any)[`strike_${n}_action`] ?? (n === 1 ? 'mute' : n === 2 ? 'kick' : 'ban')}
                    onChange={v => setSettings((s: any) => ({ ...s, [`strike_${n}_action`]: v }))}
                    options={STRIKE_ACTIONS.map(a => ({ value: a, label: a }))}
                  />
                </div>
              </div>
            ))}
          </div>

          <button onClick={saveSettings} disabled={saving}
            className="ember-btn px-5 py-2.5 text-sm font-semibold self-start"
            style={{ opacity: saving ? 0.6 : 1 }}>
            {saved ? '✓ Zapisano' : saving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
          </button>
        </div>
      )}

      {activeSection === 'automod' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>Reguły AutoMod</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                Włącz AutoMod w Ustawieniach żeby reguły działały
              </p>
            </div>
            <button onClick={() => saveSettings({ automod_enabled: settings.automod_enabled ? 0 : 1 })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: settings.automod_enabled ? 'rgba(34,197,94,0.12)' : 'var(--eb-bg3)',
                color: settings.automod_enabled ? '#4ade80' : 'var(--eb-text3)',
                border: `1px solid ${settings.automod_enabled ? 'rgba(34,197,94,0.3)' : 'var(--eb-border)'}`,
              }}>
              {settings.automod_enabled ? '✓ AutoMod ON' : 'AutoMod OFF'}
            </button>
          </div>

          {/* Existing rules */}
          <div className="flex flex-col gap-2">
            {rules.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--eb-text3)' }}>Brak reguł — dodaj pierwszą poniżej</p>
            )}
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: rule.enabled ? 'var(--eb-bg3)' : 'var(--eb-bg2)',
                  border: `1px solid ${rule.enabled ? 'var(--eb-border2)' : 'var(--eb-border)'}`,
                  opacity: rule.enabled ? 1 : 0.5,
                }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>
                    {RULE_TYPES.find(t => t.value === rule.type)?.label ?? rule.type}
                    {rule.value && <span className="ml-2 font-mono text-[10px]" style={{ color: 'var(--eb-text3)' }}>({rule.value})</span>}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                    Akcja: {RULE_ACTIONS.find(a => a.value === rule.action)?.label ?? rule.action}
                  </p>
                </div>
                <button onClick={() => toggleRule(rule.id, !rule.enabled)}
                  className="text-[10px] px-2 py-1 rounded-lg font-semibold transition-all"
                  style={{
                    background: rule.enabled ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                    color: rule.enabled ? '#f59e0b' : '#4ade80',
                    border: `1px solid ${rule.enabled ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  }}>
                  {rule.enabled ? 'Wyłącz' : 'Włącz'}
                </button>
                <button onClick={() => deleteRule(rule.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                  style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg4)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text3)')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add rule form */}
          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--eb-bg3)', border: '1px dashed var(--eb-border2)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--eb-text2)' }}>+ Nowa reguła</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>Typ</label>
                <Select
                  value={newRule.type}
                  onChange={v => setNewRule(r => ({ ...r, type: v }))}
                  options={RULE_TYPES}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>Akcja</label>
                <Select
                  value={newRule.action}
                  onChange={v => setNewRule(r => ({ ...r, action: v }))}
                  options={RULE_ACTIONS}
                />
              </div>
            </div>
            {(newRule.type === 'banned_word' || newRule.type === 'spam') && (
              <div>
                <label className="text-[10px] font-semibold uppercase mb-1 block" style={{ color: 'var(--eb-text3)' }}>
                  {newRule.type === 'banned_word' ? 'Słowa (oddzielone przecinkami)' : 'Maks. wiadomości / 5s'}
                </label>
                <input value={newRule.value}
                  onChange={e => setNewRule(r => ({ ...r, value: e.target.value }))}
                  placeholder={newRule.type === 'banned_word' ? 'np. przekleństwo, spam, reklama' : 'np. 5'}
                  className="ember-input w-full px-3 py-2 text-xs" />
              </div>
            )}
            <button onClick={addRule} disabled={addingRule}
              className="ember-btn px-4 py-2 text-xs font-semibold self-start"
              style={{ opacity: addingRule ? 0.6 : 1 }}>
              {addingRule ? 'Dodawanie...' : 'Dodaj regułę'}
            </button>
          </div>
        </div>
      )}

      {activeSection === 'log' && (
        <div className="flex flex-col gap-2">
          {modLog.length === 0 && logLoaded && (
            <p className="text-xs text-center py-8" style={{ color: 'var(--eb-text3)' }}>Brak wpisów w logu moderacji</p>
          )}
          {modLog.map(log => {
            const ACTION_COLORS: Record<string, string> = {
              MUTE: '#f59e0b', UNMUTE: '#22c55e', BAN: '#ef4444', UNBAN: '#22c55e',
              KICK: '#f97316', WARN: '#f59e0b', BULK_DELETE: '#6366f1',
              AUTOMOD: '#8b5cf6', RAID_LOCKDOWN: '#ec4899', STRIKE: '#f59e0b',
            }
            const color = ACTION_COLORS[log.action] ?? 'var(--eb-text3)'
            return (
              <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: `${color}18`, color, border: `0.5px solid ${color}40` }}>
                  {log.action}
                </span>
                <div className="flex-1 min-w-0">
                  {log.target_name && (
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>
                      {log.target_name}
                    </p>
                  )}
                  {log.reason && (
                    <p className="text-[10px] truncate" style={{ color: 'var(--eb-text2)' }}>{log.reason}</p>
                  )}
                  {log.mod_name && (
                    <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>przez {log.mod_name}</p>
                  )}
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
                  {new Date(log.created_at).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabAnalytics({ server }: { server: any }) {
  const token = useStore(s => s.token)
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`${BASE}/api/servers/${server.id}/analytics`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Brak dostępu')))
      .then(d => { setData(d); setError('') })
      .catch(e => setError(e.message || 'Błąd'))
      .finally(() => setLoading(false))
  }, [token, server.id])

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--eb-accent)', borderRightColor: 'var(--eb-accent)' }} /></div>
  if (error || !data) return <p className="text-sm py-8 text-center" style={{ color: 'var(--eb-text3)' }}>{error || 'Brak danych'}</p>

  const s = data.summary
  const maxHour = Math.max(1, ...data.hours.map((h: any) => h.c))
  const maxCh   = Math.max(1, ...data.topChannels.map((c: any) => c.count))
  const WD = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']
  const maxWd = Math.max(1, ...data.weekdays.map((w: any) => w.c))
  const fmt = (n: number) => n.toLocaleString('pl-PL')

  const Card = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <div className="p-3 rounded-xl" style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border)' }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--eb-text3)' }}>{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: color ?? 'var(--eb-text1)' }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>{sub}</div>}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px]" style={{ color: 'var(--eb-text3)' }}>Dane z ostatnich 30 dni.</p>

      {/* Podsumowanie */}
      <div className="grid grid-cols-3 gap-2">
        <Card label="Członkowie" value={fmt(s.totalMembers)} sub={`+${fmt(s.newMembers30d)} w 30 dni`} />
        <Card label="Wiadomości 30 dni" value={fmt(s.messages30d)} sub={`${fmt(s.messagesToday)} dziś`} />
        <Card label="Aktywni (7 dni)" value={fmt(s.active7d)} sub={`${fmt(s.active30d)} w 30 dni`} color="var(--eb-online)" />
      </div>
      <div className="text-[11px] -mt-2" style={{ color: 'var(--eb-text3)' }}>
        Zaangażowanie: <b style={{ color: 'var(--eb-text2)' }}>{s.totalMembers > 0 ? Math.round(s.active30d / s.totalMembers * 100) : 0}%</b> członków napisało coś w 30 dni.
      </div>

      {/* Godziny szczytu */}
      <div>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text3)' }}>Aktywność wg godziny (UTC)</div>
        <div className="flex items-end gap-[2px]" style={{ height: 70 }}>
          {data.hours.map((h: any) => (
            <div key={h.h} className="flex-1 flex flex-col items-center justify-end" title={`${h.h}:00 — ${fmt(h.c)} wiad.`}>
              <div style={{ width: '100%', height: `${Math.max(2, h.c / maxHour * 60)}px`, background: 'var(--eb-gradient)', borderRadius: '3px 3px 0 0', opacity: h.c === 0 ? 0.15 : 1 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[9px]" style={{ color: 'var(--eb-text3)' }}>
          <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
        </div>
      </div>

      {/* Dni tygodnia */}
      <div>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text3)' }}>Aktywność wg dnia tygodnia</div>
        <div className="flex gap-1.5">
          {data.weekdays.map((w: any) => (
            <div key={w.wd} className="flex-1 text-center">
              <div className="rounded-md mb-1" style={{ height: `${Math.max(3, w.c / maxWd * 44)}px`, background: 'rgba(168,85,247,0.5)' }} />
              <span className="text-[9px]" style={{ color: 'var(--eb-text3)' }}>{WD[w.wd]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Najaktywniejsze kanały */}
      <div>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text3)' }}>Najaktywniejsze kanały</div>
        {data.topChannels.length === 0 ? <p className="text-[11px]" style={{ color: 'var(--eb-text3)' }}>Brak danych.</p> : (
          <div className="flex flex-col gap-1.5">
            {data.topChannels.map((c: any) => (
              <div key={c.channelId} className="flex items-center gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--eb-text2)', width: 90 }}># {c.name}</span>
                <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--eb-bg3)' }}>
                  <div style={{ width: `${c.count / maxCh * 100}%`, height: '100%', background: 'var(--eb-gradient)' }} />
                </div>
                <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--eb-text3)', width: 44, textAlign: 'right' }}>{fmt(c.count)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Najaktywniejsi członkowie */}
      <div>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text3)' }}>Najaktywniejsi członkowie</div>
        {data.topMembers.length === 0 ? <p className="text-[11px]" style={{ color: 'var(--eb-text3)' }}>Brak danych.</p> : (
          <div className="flex flex-col gap-1">
            {data.topMembers.map((m: any, i: number) => (
              <div key={m.userId} className="flex items-center gap-2 py-1">
                <span className="text-[10px] w-4 text-center font-bold" style={{ color: i < 3 ? 'var(--eb-accent)' : 'var(--eb-text3)' }}>{i + 1}</span>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden" style={{ background: m.avatarColor ?? 'var(--eb-gradient)' }}>
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" /> : (m.displayName?.[0]?.toUpperCase() ?? '?')}
                </div>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--eb-text1)' }}>{m.displayName}</span>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--eb-text3)' }}>{fmt(m.count)} wiad.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TabInvites({ server }: { server: any }) {
  const token = useStore(s => s.token)
  const [invites, setInvites]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied,   setCopied]   = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const d = await apiFetch(`/api/servers/${server.id}/invites`, token!)
      setInvites(d.invites ?? [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [server.id])

  async function createInvite() {
    setCreating(true)
    try {
      await apiFetch(`/api/servers/${server.id}/invites`, token!, { method: 'POST' })
      await load()
    } catch {} finally { setCreating(false) }
  }

  async function deleteInvite(code: string) {
    await apiFetch(`/api/servers/${server.id}/invites/${code}`, token!, { method: 'DELETE' })
    setInvites(prev => prev.filter(i => i.code !== code))
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/join/${code}`)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const isExpired = (exp: string) => new Date(exp) < new Date()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>Linki zaproszenia</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>Zarządzaj linkami do dołączenia do serwera</p>
        </div>
        <button onClick={createInvite} disabled={creating}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: 'var(--eb-accent)', color: '#fff' }}>
          {creating ? '…' : '+ Nowy link'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--eb-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
          <p className="text-2xl mb-2">🔗</p>
          <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>Brak linków zaproszenia</p>
          <p className="text-xs mt-1" style={{ color: 'var(--eb-text4)' }}>Utwórz pierwszy link, aby zapraszać użytkowników</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {invites.map(inv => {
            const expired = isExpired(inv.expires_at)
            return (
              <div key={inv.code}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: expired ? 'var(--eb-bg2)' : 'var(--eb-bg3)',
                  border: `1px solid ${expired ? 'rgba(239,68,68,0.2)' : 'var(--eb-border)'}`,
                  opacity: expired ? 0.6 : 1,
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--eb-bg1)', color: 'var(--eb-accent)', border: '1px solid var(--eb-border)' }}>
                      {inv.code}
                    </code>
                    {expired && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '0.5px solid rgba(239,68,68,0.3)' }}>
                        WYGASŁ
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: 'var(--eb-text4)' }}>
                      {inv.uses ?? 0} użyć
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                      Stworzył: <span style={{ color: 'var(--eb-text2)' }}>{inv.creator_display_name ?? inv.creator_username ?? '—'}</span>
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--eb-text4)' }}>·</span>
                    <span className="text-[10px]" style={{ color: expired ? '#f87171' : 'var(--eb-text3)' }}>
                      Wygasa: {fmtDate(inv.expires_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!expired && (
                    <button onClick={() => copyLink(inv.code)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                      style={{
                        background: copied === inv.code ? 'rgba(34,197,94,0.1)' : 'var(--eb-bg2)',
                        color: copied === inv.code ? '#22c55e' : 'var(--eb-text2)',
                        border: `1px solid ${copied === inv.code ? 'rgba(34,197,94,0.3)' : 'var(--eb-border)'}`,
                      }}>
                      {copied === inv.code ? '✓ Skopiowano' : '📋 Kopiuj'}
                    </button>
                  )}
                  <button onClick={() => deleteInvite(inv.code)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--eb-text4)', border: '1px solid transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--eb-text4)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ServerSettings({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { currentServerId, servers } = useStore()
  const [activeTab, setActiveTab] = useState<Tab>('ogólne')
  const server = servers.find(s => s.id === currentServerId)

  const { canManageServer, canManageChannels, canManageRoles, canKick, canBan, canMute } = usePermissions(currentServerId ?? null)

  const TABS = [
    { id: 'ogólne'     as Tab, label: t('serverSettings.tab.general'),  icon: '⚙' },
    { id: 'kanały'     as Tab, label: t('serverSettings.tab.channels'), icon: '#' },
    { id: 'role'       as Tab, label: t('serverSettings.tab.roles'),    icon: '🏷' },
    { id: 'członkowie' as Tab, label: t('serverSettings.tab.members'),  icon: '👥' },
    { id: 'emoji'      as Tab, label: t('serverSettings.tab.emoji'),    icon: '😄' },
    { id: 'analityka'  as Tab, label: 'Analityka',   icon: '📊' },
    { id: 'zaproszenia' as Tab, label: 'Zaproszenia', icon: '🔗' },
    { id: 'zbanowani'   as Tab, label: 'Zbanowani',   icon: '🔨' },
    { id: 'moderacja'   as Tab, label: 'Moderacja',   icon: '🛡' },
  ].filter(tab => {
    if (tab.id === 'ogólne')      return canManageServer
    if (tab.id === 'kanały')      return canManageChannels
    if (tab.id === 'role')        return canManageRoles || canKick || canBan || canMute
    if (tab.id === 'członkowie')  return canKick || canBan || canMute
    if (tab.id === 'emoji')       return canManageServer
    if (tab.id === 'analityka')   return canManageServer
    if (tab.id === 'zaproszenia') return canManageServer
    if (tab.id === 'zbanowani')   return canBan
    if (tab.id === 'moderacja')   return canManageServer
    return false
  })

  useEffect(() => {
    if (TABS.length > 0 && !TABS.find(tab => tab.id === activeTab)) {
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
    <div id="server-settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>{t('serverSettings.title')}</div>
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
              <span>✕</span> {t('serverSettings.close')}
            </button>
          </div>
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--eb-text1)' }}>
            <span>{TABS.find(tab => tab.id === activeTab)?.icon}</span>
            {TABS.find(tab => tab.id === activeTab)?.label}
          </h2>
          {activeTab === 'ogólne'     && <TabGeneral server={server} onClose={onClose} />}
          {activeTab === 'kanały'     && <TabChannels server={server} />}
          {activeTab === 'role'       && <RolesTab server={server} />}
          {activeTab === 'członkowie' && <TabMembers server={server} />}
          {activeTab === 'emoji'        && <TabEmoji server={server} />}
          {activeTab === 'analityka'    && <TabAnalytics server={server} />}
          {activeTab === 'zaproszenia'  && <TabInvites server={server} />}
          {activeTab === 'zbanowani'    && <TabBans server={server} />}
          {activeTab === 'moderacja'    && <TabModeration server={server} />}
        </div>
      </div>
    </div>
  )
}
