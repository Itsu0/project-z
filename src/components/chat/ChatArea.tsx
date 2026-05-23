'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import clsx from 'clsx'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { useMessages } from '@/hooks/useMessages'
import { useSocket } from '@/hooks/useSocket'
import { useVoice } from '@/hooks/useVoice'
import { usePermissions } from '@/hooks/usePermissions'
import { MessageItem } from './MessageItem'
import { ChatInput } from './ChatInput'
import { SearchPanel } from './SearchPanel'
import { JoinVoiceButton } from '@/components/voice/JoinVoiceButton'
import { ScreenShareBar } from '@/components/voice/ScreenShareView'
import { ForumView } from '@/components/forum/ForumView'
import type { RealChannel } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function PinnedPanel({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const t = useT()
  const { token } = useStore()
  const [pins, setPins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !channelId) return
    fetch(`${BASE}/api/channels/${channelId}/pins`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setPins(d.messages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [channelId, token])

  return (
    <div className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-2xl overflow-hidden"
      style={{ width: 360, maxHeight: 480, background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)' }}>
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b" style={{ borderColor: 'var(--eb-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>{t('chat.pinned')}</span>
        <button onClick={onClose} className="icon-btn" style={{ width: 22, height: 22 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : pins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span style={{ fontSize: 28 }}>📌</span>
            <p className="text-sm font-medium" style={{ color: 'var(--eb-text2)' }}>{t('chat.noPinned')}</p>
          </div>
        ) : pins.map(m => (
          <div key={m.id} className="px-3 py-2.5 border-b hover:bg-white/[0.03] transition-colors" style={{ borderColor: 'var(--eb-border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white text-[8px] font-bold"
                style={{ background: m.author_avatar_url ? 'transparent' : (m.author_avatar_color ?? '#64748b') }}>
                {m.author_avatar_url
                  ? <img src={m.author_avatar_url} alt={m.author_display_name} className="w-full h-full object-cover" />
                  : (m.author_display_name ?? 'U').slice(0, 1).toUpperCase()
                }
              </div>
              <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>{m.author_display_name ?? m.author_username}</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--eb-text2)' }}>
              {m.content?.length > 120 ? m.content.slice(0, 120) + '…' : m.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChannelTabBar({ channels, activeId, serverId, serverName, serverColor, serverLogo, memberCount, onSelect, onOpenSettings, onSearch, onPins, onBulkDelete }: {
  channels: RealChannel[]
  activeId: string
  serverId: string
  serverName: string
  serverColor: string
  serverLogo?: string | null
  memberCount?: number
  onSelect: (id: string) => void
  onOpenSettings?: () => void
  onSearch?: () => void
  onPins?: () => void
  onBulkDelete?: () => void
}) {
  const { participants, connected } = useVoice()
  const { voice: voiceState, token, channels: allChannels, setChannels } = useStore()
  const { canManageServer, canManageChannels, canKick, canBan, canMute } = usePermissions(serverId)
  const canOpenSettings = canManageServer || canKick || canBan || canMute
  const [showCreate, setShowCreate] = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newType,    setNewType]    = useState<'text' | 'voice' | 'forum'>('text')
  const [creating,   setCreating]   = useState(false)
  const [expandedVoice, setExpandedVoice] = useState<string | null>(null)
  const [dragSrcId,  setDragSrcId]  = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const socket = useSocket()
  const [voiceOccupants, setVoiceOccupants] = useState<Record<string, { userId: string; displayName: string; avatarColor: string; avatarUrl?: string | null }[]>>({})
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

  useEffect(() => {
    if (!token || !serverId) return
    fetch(`${BASE_URL}/api/servers/${serverId}/voice-state`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.voiceState) setVoiceOccupants(d.voiceState) })
      .catch(() => {})
  }, [token, serverId])

  useEffect(() => {
    if (!socket) return
    const onJoin = (d: any) => setVoiceOccupants(prev => ({
      ...prev,
      [d.channelId]: [...(prev[d.channelId] ?? []).filter(p => p.userId !== d.userId), { userId: d.userId, displayName: d.displayName, avatarColor: d.avatarColor, avatarUrl: d.avatarUrl }],
    }))
    const onLeave = (d: any) => setVoiceOccupants(prev => ({
      ...prev,
      [d.channelId]: (prev[d.channelId] ?? []).filter(p => p.userId !== d.userId),
    }))
    socket.on('VOICE_JOIN', onJoin)
    socket.on('VOICE_LEAVE', onLeave)
    return () => { socket.off('VOICE_JOIN', onJoin); socket.off('VOICE_LEAVE', onLeave) }
  }, [socket])

  const getCount = (ch: RealChannel) => {
    const fromSocket = voiceOccupants[ch.id]?.length ?? 0
    if (connected && voiceState?.channelId === ch.id) return Math.max(fromSocket, participants.length)
    return fromSocket
  }

  const textChannels = channels
    .filter(c => c.type === 'text' || c.type === 'announcement' || c.type === 'voice' || c.type === 'forum')
    .sort((a, b) => a.position - b.position)

  async function handleChannelDrop(targetId: string) {
    if (!dragSrcId || dragSrcId === targetId || !token) return
    const list = [...textChannels]
    const srcIdx = list.findIndex(c => c.id === dragSrcId)
    const tgtIdx = list.findIndex(c => c.id === targetId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const [moved] = list.splice(srcIdx, 1)
    list.splice(tgtIdx, 0, moved)
    const reordered = list.map((c, i) => ({ id: c.id, position: i }))
    const posMap: Record<string, number> = {}
    reordered.forEach(c => { posMap[c.id] = c.position })
    const existing = allChannels[serverId] ?? []
    const updated = existing
      .map(c => posMap[c.id] !== undefined ? { ...c, position: posMap[c.id] } : c)
      .sort((a, b) => a.position - b.position)
    setChannels(serverId, updated)
    try {
      await fetch(`${BASE_URL}/api/servers/${serverId}/channels/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channels: reordered }),
      })
    } catch {}
  }

  async function quickCreateChannel() {
    if (!token || !newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/servers/${serverId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim().toLowerCase().replace(/\s+/g, '-'), type: newType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setChannels(serverId, [...(allChannels[serverId] ?? []), data.channel])
      setNewName(''); setShowCreate(false)
      onSelect(data.channel.id)
    } catch (e: any) { alert(e.message) }
    finally { setCreating(false) }
  }

  return (
    <div className="flex flex-wrap items-start border-b flex-shrink-0"
      style={{ background: 'var(--eb-bg1)', borderColor: 'var(--eb-border)' }}>

      {}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="rounded-2xl p-5 w-full max-w-xs"
            style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--eb-text1)' }}>Utwórz kanał</h3>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {[{ id: 'text', label: '# Tekstowy' }, { id: 'voice', label: '🔊 Głosowy' }, { id: 'forum', label: '🗂 Forum' }].map(t => (
                <button key={t.id} onClick={() => setNewType(t.id as any)}
                  className="py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: newType === t.id ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.04)',
                    color: newType === t.id ? '#fff' : 'var(--eb-text2)',
                  }}>{t.label}</button>
              ))}
            </div>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-ąćęłńóśźż]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') quickCreateChannel(); if (e.key === 'Escape') setShowCreate(false) }}
              placeholder={newType === 'voice' ? 'np. voice-chat' : newType === 'forum' ? 'np. pomysly' : 'np. ogólny'}
              className="ember-input w-full px-3 py-2.5 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="ember-btn-ghost flex-1 py-2 text-sm">Anuluj</button>
              <button onClick={quickCreateChannel} disabled={creating || !newName.trim()} className="ember-btn flex-1 py-2 text-sm">
                {creating ? '...' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}
      {}
      <div
        className={`flex items-center gap-2.5 px-3.5 border-r flex-shrink-0 transition-colors self-stretch ${canOpenSettings ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'}`}
        style={{ borderColor: 'var(--eb-border)', minHeight: 48 }}
        onClick={canOpenSettings ? onOpenSettings : undefined}
        title={canOpenSettings ? 'Ustawienia serwera' : undefined}
      >
        <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 overflow-hidden"
          style={{ background: serverLogo ? 'transparent' : serverColor }}>
          {serverLogo
            ? <img src={serverLogo} alt={serverName} className="w-full h-full object-cover" />
            : serverName.slice(0, 1)
          }
        </div>
        <div>
          <div className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--eb-text1)' }}>{serverName}</div>
          {memberCount && (
            <div className="text-[10px] whitespace-nowrap" style={{ color: 'var(--eb-accent)' }}>
              {memberCount} członków
            </div>
          )}
        </div>
        {canOpenSettings && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--eb-text3)', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </div>

      {}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 flex-1" style={{ minWidth: 0 }}>
        <div className="flex flex-wrap items-center gap-0.5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {textChannels.map(ch => {
            const count = ch.type === 'voice' ? getCount(ch) : 0
            const occupants = voiceOccupants[ch.id] ?? []
            const isExpanded = expandedVoice === ch.id
            const isDragging = dragSrcId === ch.id
            const isDragOver = dragOverId === ch.id && dragSrcId !== ch.id

            return (
              <div
                key={ch.id}
                className="relative"
                draggable={canManageChannels}
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragSrcId(ch.id) }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (ch.id !== dragSrcId) setDragOverId(ch.id) }}
                onDragLeave={() => setDragOverId(prev => prev === ch.id ? null : prev)}
                onDrop={e => { e.preventDefault(); handleChannelDrop(ch.id); setDragSrcId(null); setDragOverId(null) }}
                onDragEnd={() => { setDragSrcId(null); setDragOverId(null) }}
                style={{
                  opacity: isDragging ? 0.35 : 1,
                  cursor: canManageChannels ? (isDragging ? 'grabbing' : 'grab') : undefined,
                  outline: isDragOver ? '1px solid var(--eb-accent)' : undefined,
                  borderRadius: isDragOver ? 8 : undefined,
                  transition: 'opacity 0.15s, outline 0.1s',
                }}
              >
                <button onClick={() => {
                  onSelect(ch.id)
                  if (ch.type === 'voice') setExpandedVoice(isExpanded ? null : ch.id)
                }}
                  className={clsx('server-tab flex items-center gap-1', ch.id === activeId && 'active')}>
                  {ch.type === 'voice' ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                  ) : ch.type === 'announcement' ? '▸' : ch.type === 'forum' ? '🗂' : '~'} {ch.name}
                  {ch.type === 'voice' && count > 0 && (
                    <span className="text-[9px] font-semibold px-1 rounded"
                      style={{ background: ch.id === activeId ? 'rgba(255,255,255,0.25)' : 'rgba(34,197,94,0.2)', color: ch.id === activeId ? '#fff' : 'var(--eb-online)' }}>
                      {count}
                    </span>
                  )}
                </button>

                {}
                {ch.type === 'voice' && isExpanded && occupants.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 z-50 rounded-xl py-1.5 min-w-40"
                    style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <div className="px-3 pb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--eb-text3)' }}>
                      Na kanale
                    </div>
                    {occupants.map(p => (
                      <div key={p.userId} className="flex items-center gap-2 px-3 py-1.5">
                        <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                          style={{ background: p.avatarUrl ? 'transparent' : p.avatarColor }}>
                          {p.avatarUrl
                            ? <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                            : p.displayName.slice(0, 1).toUpperCase()
                          }
                        </div>
                        <span className="text-[11px] truncate" style={{ color: 'var(--eb-text2)' }}>
                          {p.displayName}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto" style={{ background: '#22c55e' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {canManageChannels && (
            <button className="server-tab" onClick={() => setShowCreate(true)} title="Nowy kanał">+</button>
          )}
        </div>
      </div>

      {}
      <div className="flex-shrink-0 pr-3 self-start pt-2.5 flex items-center gap-1">
        {onPins && (
          <button className="icon-btn" title="Przypięte wiadomości" onClick={onPins}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
        )}
        <button className="icon-btn" title="Szukaj wiadomości (Ctrl+F)" onClick={onSearch}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
        {onBulkDelete && (
          <button className="icon-btn" title="Zaznacz wiadomości do usunięcia" onClick={onBulkDelete}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyServers() {
  const t = useT()
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
        style={{ background: 'var(--eb-bg3)' }}>🏰</div>
      <div className="text-center">
        <p className="font-semibold mb-1" style={{ color: 'var(--eb-text1)' }}>{t('chat.noMessages')}</p>
        <p style={{ fontSize: 12, color: 'var(--eb-text3)' }}>{t('chat.noMessagesHint')}</p>
      </div>
    </div>
  )
}

export function ChatArea({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const t = useT()
  const { currentChannelId, currentServerId, setCurrentChannel, typing, servers, channels, members,
          automodBlock, setAutomodBlock, raidLockdown, clearRaidLockdown, token, currentUser } = useStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesTopRef = useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pinsOpen, setPinsOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; authorName: string } | null>(null)
  const pinsBtnRef = useRef<HTMLDivElement>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useSocket()

  const channelId = currentChannelId ?? ''
  const serverId  = currentServerId  ?? ''

  const { messages, loading, hasMore, loadMore, loadingMore } = useMessages(channelId)
  const typingIndicators = typing[channelId] ?? []

  const currentServer   = servers.find(s => s.id === serverId)
  const serverChannels  = channels[serverId] ?? []
  const serverMembers   = members[serverId]  ?? []
  const currentChannel  = serverChannels.find(c => c.id === channelId)
  const { canManageMessages } = usePermissions(serverId)
  const [verifying, setVerifying] = useState(false)
  const [verifyEmailRequired, setVerifyEmailRequired] = useState(false)
  const [resendingVerify, setResendingVerify] = useState(false)
  const [resentVerify, setResentVerify] = useState(false)

  const currentMember = currentUser ? serverMembers.find(m => m.user_id === currentUser.id) : null
  const hasVerificationRole = currentMember?.roles?.some((r: any) => r.name === 'Do Weryfikacji') ?? false

  async function handleVerify() {
    if (!token || !serverId) return
    setVerifying(true)
    setVerifyEmailRequired(false)
    try {
      const res = await fetch(`${BASE}/api/servers/${serverId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'EMAIL_NOT_VERIFIED') setVerifyEmailRequired(true)
      }
    } catch {}
    finally { setVerifying(false) }
  }

  async function handleResendVerifyEmail() {
    if (!currentUser?.email && !(currentUser as any)?.email) return
    setResendingVerify(true)
    try {
      await fetch(`${BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: (currentUser as any).email }),
      })
      setResentVerify(true)
      setTimeout(() => setResentVerify(false), 5000)
    } finally { setResendingVerify(false) }
  }

  useEffect(() => { setPinsOpen(false); setReplyTo(null); setBulkMode(false); setSelected(new Set()) }, [channelId])

  useEffect(() => {
    if (!automodBlock) return
    const t = setTimeout(() => setAutomodBlock(null), 4000)
    return () => clearTimeout(t)
  }, [automodBlock, setAutomodBlock])

  async function handleBulkDelete() {
    if (!token || selected.size === 0) return
    setBulkDeleting(true)
    try {
      await fetch(`${BASE}/api/servers/${serverId}/channels/${channelId}/messages/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageIds: Array.from(selected) }),
      })
      setBulkMode(false)
      setSelected(new Set())
    } catch {}
    finally { setBulkDeleting(false) }
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    if (!messagesTopRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(messagesTopRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const grouped = messages.map((msg, i) => {
    const prev = messages[i - 1]
    const sameAuthor = prev && prev.author.id === msg.author.id && prev.type === 'DEFAULT' && msg.type === 'DEFAULT'
    const timeDiff = prev ? new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() : Infinity
    return { msg, compact: !!(sameAuthor && timeDiff < 5 * 60 * 1000) }
  })

  if (!currentServer) return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--eb-bg2)' }}>
      <EmptyServers />
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--eb-bg2)' }}>

      {/* AutoMod block toast */}
      {automodBlock && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl"
          style={{ background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 500, pointerEvents: 'none' }}>
          <span>🛡</span>
          <span>Wiadomość zablokowana przez AutoMod: {automodBlock}</span>
        </div>
      )}

      {/* Raid lockdown banner */}
      {raidLockdown && raidLockdown.serverId === serverId && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{ background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 500 }}>
          <div className="flex items-center gap-2">
            <span>🚨</span>
            <span>{raidLockdown.message}</span>
          </div>
          <button onClick={clearRaidLockdown} className="opacity-70 hover:opacity-100 transition-opacity text-xs underline">
            Zamknij
          </button>
        </div>
      )}

      {/* Verification banner */}
      {hasVerificationRole && !verifyEmailRequired && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{ background: 'rgba(148,163,184,0.12)', borderBottom: '0.5px solid rgba(148,163,184,0.25)', fontSize: 13 }}>
          <div className="flex items-center gap-2">
            <span>⏳</span>
            <span style={{ color: 'var(--eb-text1)', fontWeight: 500 }}>Twoje konto wymaga weryfikacji na tym serwerze.</span>
            <span style={{ color: 'var(--eb-text3)', fontSize: 11 }}>Kliknij Weryfikuj, aby uzyskać pełny dostęp.</span>
          </div>
          <button onClick={handleVerify} disabled={verifying}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(148,163,184,0.2)', color: '#94a3b8', border: '0.5px solid rgba(148,163,184,0.4)' }}>
            {verifying ? '...' : '✅ Weryfikuj'}
          </button>
        </div>
      )}

      {/* Email not verified banner */}
      {hasVerificationRole && verifyEmailRequired && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '0.5px solid rgba(245,158,11,0.3)', fontSize: 13 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span>✉️</span>
            <span style={{ color: '#fbbf24', fontWeight: 500 }}>Zweryfikuj swój adres email, aby dołączyć do serwera.</span>
            {resentVerify
              ? <span style={{ color: '#4ade80', fontSize: 11 }}>✓ Email wysłany!</span>
              : <button onClick={handleResendVerifyEmail} disabled={resendingVerify}
                  className="text-xs underline disabled:opacity-50"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 0 }}>
                  {resendingVerify ? 'Wysyłanie...' : 'Wyślij ponownie'}
                </button>
            }
          </div>
          <button onClick={() => setVerifyEmailRequired(false)}
            className="text-xs opacity-50 hover:opacity-100 flex-shrink-0"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
      )}

      {/* Bulk delete bar */}
      {bulkMode && (
        <div className="flex items-center gap-3 px-4 py-2 border-b"
          style={{ background: 'var(--eb-bg3)', borderColor: 'var(--eb-border)', fontSize: 13 }}>
          <span style={{ color: 'var(--eb-text2)' }}>Zaznaczono: <strong style={{ color: 'var(--eb-text1)' }}>{selected.size}</strong></span>
          <div className="flex-1" />
          <button
            disabled={selected.size === 0 || bulkDeleting}
            onClick={handleBulkDelete}
            className="px-3 py-1 rounded-lg text-white text-xs font-medium transition-opacity disabled:opacity-40"
            style={{ background: '#ef4444' }}>
            {bulkDeleting ? 'Usuwanie…' : `Usuń zaznaczone (${selected.size})`}
          </button>
          <button onClick={() => { setBulkMode(false); setSelected(new Set()) }}
            className="px-3 py-1 rounded-lg text-xs font-medium"
            style={{ background: 'var(--eb-bg4)', color: 'var(--eb-text2)' }}>
            Anuluj
          </button>
        </div>
      )}

      <div className="relative">
        <ChannelTabBar
          channels={serverChannels}
          activeId={channelId}
          serverId={serverId}
          serverName={currentServer.name}
          serverColor={currentServer.icon_color}
          serverLogo={currentServer.icon_url ?? null}
          memberCount={serverMembers.length}
          onSelect={setCurrentChannel}
          onOpenSettings={onOpenSettings}
          onSearch={() => setSearchOpen(true)}
          onPins={currentChannel?.type === 'text' || currentChannel?.type === 'announcement' ? () => setPinsOpen(p => !p) : undefined}
          onBulkDelete={canManageMessages && (currentChannel?.type === 'text' || currentChannel?.type === 'announcement') ? () => { setBulkMode(m => !m); setSelected(new Set()) } : undefined}
        />
        {pinsOpen && channelId && (
          <div className="absolute right-2 top-full mt-0.5 z-50">
            <PinnedPanel channelId={channelId} onClose={() => setPinsOpen(false)} />
          </div>
        )}
      </div>

      {searchOpen && (
        <SearchPanel
          onClose={() => setSearchOpen(false)}
          onJumpTo={(chId, _msgId) => {
            setCurrentChannel(chId)
            setSearchOpen(false)
          }}
        />
      )}

      {}
      {currentChannel?.type === 'forum' ? (
        <ForumView
          channelId={channelId}
          channelName={currentChannel.name}
          channelTopic={currentChannel.topic}
        />
      ) : (
        <>
          {currentChannel?.topic && (
            <div className="px-4 py-1.5 text-xs border-b flex items-center gap-2"
              style={{ color: 'var(--eb-text3)', borderColor: 'var(--eb-border)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              </svg>
              {currentChannel.topic}
            </div>
          )}

          {}
          {currentChannel?.type === 'voice' ? (
            <JoinVoiceButton channel={currentChannel} />
          ) : (
          <>
            <ScreenShareBar />
            <div className="flex-1 overflow-y-auto px-2 py-4">
            <div ref={messagesTopRef} className="h-1" />

            {loadingMore && (
              <div className="flex justify-center py-3">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-32 gap-2">
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span style={{ fontSize: 12, color: 'var(--eb-text3)' }}>{t('chat.loading')}</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: 'var(--eb-bg3)' }}>💬</div>
                <p className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>{t('chat.noMessages')}</p>
                <p style={{ fontSize: 12, color: 'var(--eb-text3)' }}>{t('chat.noMessagesHint')}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-2 mb-4">
                  <div className="flex-1 h-px" style={{ background: 'var(--eb-border)' }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--eb-text3)', whiteSpace: 'nowrap' }}>
                    Początek historii · #{currentChannel?.name}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--eb-border)' }} />
                </div>
                {grouped.map(({ msg, compact }) => (
                  <div key={msg.id} className={`flex items-start gap-2 group/sel ${bulkMode ? 'cursor-pointer select-none' : ''}`}
                    onClick={bulkMode ? () => setSelected(prev => {
                      const next = new Set(prev)
                      if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id)
                      return next
                    }) : undefined}
                    style={bulkMode && selected.has(msg.id) ? { background: 'rgba(239,68,68,0.08)', borderRadius: 8 } : undefined}>
                    {bulkMode && (
                      <div className="flex-shrink-0 mt-3 ml-2">
                        <div className="w-4 h-4 rounded flex items-center justify-center border transition-all"
                          style={{
                            borderColor: selected.has(msg.id) ? '#ef4444' : 'var(--eb-border2)',
                            background: selected.has(msg.id) ? '#ef4444' : 'transparent',
                          }}>
                          {selected.has(msg.id) && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0" onClick={e => bulkMode && e.stopPropagation()}>
                      <MessageItem
                        message={msg}
                        compact={compact}
                        onReply={bulkMode ? undefined : info => { setReplyTo(info); setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 50) }}
                        onPin={() => {}}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}

            {typingIndicators.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 mt-1">
                <div className="flex gap-0.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="typing-dot w-1 h-1 rounded-full"
                      style={{ background: 'var(--eb-text2)', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: 'var(--eb-text2)' }}>
                  {typingIndicators.length === 1
                    ? t('chat.typingOne', { user: typingIndicators[0].username })
                    : typingIndicators.length === 2
                      ? t('chat.typingTwo', { u1: typingIndicators[0].username, u2: typingIndicators[1].username })
                      : t('chat.typingMany')
                  }
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
          </>
          )}

          {channelId && (!currentChannel || currentChannel.type !== 'voice') && (
            <ChatInput
              channelName={currentChannel?.name ?? 'kanał'}
              channelId={channelId}
              serverId={serverId}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
