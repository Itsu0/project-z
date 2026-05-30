'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useVoice } from '@/contexts/VoiceContext'
import { useSocket }  from '@/hooks/useSocket'
import { useMessages } from '@/hooks/useMessages'
import { ReportModal } from '@/components/chat/ReportModal'
import { UserSettings } from '@/components/settings/UserSettings'
import { EmojiPicker } from '@/components/chat/EmojiPicker'
import { ForumView } from '@/components/forum/ForumView'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Tab = 'chat' | 'members' | 'notifications' | 'profile'

/* ─── SVG Icons ─────────────────────────────────────────────────── */
const IC = {
  Chat: ({ a }: { a: boolean }) => (
    <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.862 9.862 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Members: ({ a }: { a: boolean }) => (
    <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Bell: ({ a }: { a: boolean }) => (
    <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  User: ({ a }: { a: boolean }) => (
    <svg viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Hash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  Volume: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 6v12M9 9H5a1 1 0 00-1 1v4a1 1 0 001 1h4l3 3V6l-3 3z" />
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Send: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={17} height={17}>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  Flag: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={15} height={15}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V4m0 0l9-2 9 2v10l-9-2-9 2V4z" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={14} height={14}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Mic: ({ muted }: { muted: boolean }) => muted ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M12 19v3M8 23h8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3M8 23h8" />
    </svg>
  ),
  Leave: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
}

/* ─── Avatar ────────────────────────────────────────────────────── */
function Av({ url, color, name, size = 36 }: { url?: string | null; color: string; name: string; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

/* ─── Mobile GIF picker (bottom sheet) ─────────────────────────── */
interface GifItem { id: string; url: string; preview: string; title: string }

function MobileGifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const token = useStore(s => s.token)
  const [query, setQuery]     = useState('')
  const [gifs, setGifs]       = useState<GifItem[]>([])
  const [loading, setLoading] = useState(true)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const url = q.trim()
        ? `${BASE}/api/gifs/search?q=${encodeURIComponent(q)}`
        : `${BASE}/api/gifs/trending`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      setGifs((d.gifs ?? []) as GifItem[])
    } catch { setGifs([]) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchGifs('') }, [fetchGifs])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--eb-bg1)', borderRadius: '20px 20px 0 0', border: '0.5px solid var(--eb-border2)', display: 'flex', flexDirection: 'column', maxHeight: '70vh', zIndex: 1 }}>
        <div style={{ padding: '12px 16px 8px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '0.5px solid var(--eb-border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--eb-border2)', margin: '0 auto', position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }} />
          <input
            autoFocus
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (debounce.current) clearTimeout(debounce.current)
              debounce.current = setTimeout(() => fetchGifs(e.target.value), 350)
            }}
            placeholder="Szukaj GIF-ów..."
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--eb-border2)', borderRadius: 12, padding: '8px 12px', color: 'var(--eb-text1)', fontSize: 14, outline: 'none', marginTop: 8 }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            </div>
          ) : gifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--eb-text3)', fontSize: 13 }}>Brak wyników</div>
          ) : (
            <div style={{ columns: 2, gap: 6 }}>
              {gifs.map(g => (
                <button key={g.id} onClick={() => { onSelect(g.url); onClose() }}
                  style={{ width: '100%', marginBottom: 6, borderRadius: 10, overflow: 'hidden', display: 'block', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <img src={g.preview} alt={g.title} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10 }} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '6px 16px', borderTop: '0.5px solid var(--eb-border)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--eb-text3)' }}>Powered by Tenor</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Chat Screen ───────────────────────────────────────────────── */
function ChatScreen() {
  const { servers, channels, currentServerId, currentChannelId, setCurrentServer, setCurrentChannel, currentUser, voice, token } = useStore()
  const { sendMessage }  = useSocket()
  const { openDevicePicker, disconnect, toggleMute, muted, participants } = useVoice()
  const currentChannelIdSafe = currentChannelId ?? ''
  const { messages, loading } = useMessages(currentChannelIdSafe)
  const [serverPickerOpen, setServerPickerOpen] = useState(false)
  const [text, setText]                         = useState('')
  const [reportMsg, setReportMsg]           = useState<null | { id: string; content: string; author: string }>(null)
  const [ctxMenu, setCtxMenu]               = useState<null | { msgId: string; content: string; author: string; y: number }>(null)
  const [showEmoji, setShowEmoji]           = useState(false)
  const [showGif, setShowGif]               = useState(false)
  const [showVoicePanel, setShowVoicePanel] = useState(false)
  const [uploadingFile, setUploadingFile]   = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<{ id: string; url: string; filename: string; contentType: string; previewUrl?: string } | null>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string; content: string } | null>(null)
  const endRef     = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    if (!token || !currentChannelId) return
    setUploadingFile(true)
    try {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${BASE}/api/channels/${currentChannelId}/attachments`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      if (!res.ok) return
      setPendingAttachment({ ...(await res.json()), previewUrl })
    } catch {} finally { setUploadingFile(false) }
  }, [token, currentChannelId])

  const currentServer  = servers.find(s => s.id === currentServerId)
  const serverChannels = currentServerId ? (channels[currentServerId] ?? []) : []
  const currentChannel = serverChannels.find(c => c.id === currentChannelId)
  const textChannels   = serverChannels.filter(c => c.type === 'text' || c.type === 'announcement')
  const voiceChannels  = serverChannels.filter(c => c.type === 'voice')

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  function send() {
    const t = text.trim()
    if ((!t && !pendingAttachment) || !currentChannelId || !currentServerId) return
    sendMessage(currentChannelId, currentServerId, t, undefined, replyTo?.id, pendingAttachment ? [pendingAttachment.id] : undefined)
    setText('')
    setPendingAttachment(null)
    setReplyTo(null)
    inputRef.current?.focus()
  }

  function sendGif(url: string) {
    if (!currentChannelId || !currentServerId) return
    sendMessage(currentChannelId, currentServerId, url)
  }

  function onLongPressStart(msgId: string, content: string, author: string, clientY: number) {
    pressTimer.current = setTimeout(() => {
      setCtxMenu({ msgId, content, author, y: clientY })
    }, 500)
  }
  function onLongPressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Header */}
      <div className="mobile-header" style={{ gap: 8 }}>
        {/* Server selector */}
        <button onClick={() => setServerPickerOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '0.5px solid var(--eb-border2)', borderRadius: 10, padding: '4px 8px', cursor: 'pointer', flexShrink: 0, maxWidth: 120 }}>
          {currentServer?.icon_url
            ? <img src={currentServer.icon_url} alt="" width={18} height={18} style={{ borderRadius: 4, objectFit: 'cover' }} />
            : <div style={{ width: 18, height: 18, borderRadius: 4, background: currentServer?.icon_color || 'var(--eb-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {currentServer ? currentServer.name.charAt(0).toUpperCase() : '?'}
              </div>
          }
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--eb-text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentServer?.name ?? 'Serwer'}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10" style={{ color: 'var(--eb-text3)', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        <span className="mobile-header-title" style={{ fontSize: 13 }}>
          {currentChannel ? `~ ${currentChannel.name}` : ''}
        </span>
        {/* Report button */}
        {currentChannel && (
          <button className="icon-btn" style={{ flexShrink: 0 }}
            onClick={() => setCtxMenu({ msgId: '', content: '', author: '', y: 0 })}>
            <IC.Flag />
          </button>
        )}
      </div>

      {/* Channel strip */}
      <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '0.5px solid var(--eb-border)', background: 'var(--eb-bg1)', padding: '0 6px', flexShrink: 0, gap: 2 }}
        className="hide-scrollbar">
        {serverChannels.map(ch => {
          const isVoice = ch.type === 'voice'
          const isActive = isVoice ? voice.channelId === ch.id : currentChannelId === ch.id
          return (
            <button key={ch.id}
              className={`server-tab${isActive ? ' active' : ''}`}
              onClick={() => {
                if (isVoice) { isActive ? disconnect() : openDevicePicker(ch.id) }
                else setCurrentChannel(ch.id)
              }}>
              {isVoice
                ? <IC.Volume />
                : <span style={{ fontSize: 11, opacity: 0.7 }}>~</span>
              }
              {ch.name}
            </button>
          )
        })}
      </div>

      {/* Voice bar */}
      {voice.connected && (() => {
        const voiceCh = serverChannels.find(c => c.id === voice.channelId)
        return (
          <div style={{ background: 'rgba(34,197,94,0.07)', borderBottom: '0.5px solid rgba(34,197,94,0.18)', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minHeight: 40 }}>
            <button onClick={() => setShowVoicePanel(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', minWidth: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--eb-online)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--eb-online)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {voiceCh ? voiceCh.name : 'Głos'}
              </span>
              {participants.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--eb-text3)', fontWeight: 400, flexShrink: 0 }}>{participants.length} os. ›</span>
              )}
            </button>
            <button onClick={() => toggleMute()}
              style={{ background: muted ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)', border: `0.5px solid ${muted ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius: 20, padding: '4px 11px', fontSize: 12, fontWeight: 500, color: muted ? '#ef4444' : 'var(--eb-online)', cursor: 'pointer', flexShrink: 0 }}>
              {muted ? '🔇' : '🎤'}
            </button>
            <button onClick={() => disconnect()}
              style={{ background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '4px 11px', fontSize: 12, fontWeight: 500, color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
              Rozłącz
            </button>
          </div>
        )
      })()}

      {/* Forum channel */}
      {currentChannel?.type === 'forum' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ForumView
            channelId={currentChannel.id}
            channelName={currentChannel.name}
            channelTopic={(currentChannel as any).topic ?? ''}
          />
        </div>
      )}

      {/* Messages + Input (text/announcement channels only) */}
      {currentChannel?.type !== 'forum' && (<>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 0' }}
        onClick={() => setCtxMenu(null)}>
        {!currentChannel ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>
            Wybierz kanał
          </div>
        ) : loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>Ładowanie...</div>
        ) : messages.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>
            Początek kanału #{currentChannel.name}
          </div>
        ) : null}

        {messages.map((msg: any) => {
          const isMine    = msg.author?.id === currentUser?.id || msg.userId === currentUser?.id
          const isAdmin   = Boolean(msg.isAdminMsg)
          const authorName = isAdmin ? 'Administrator Aplikacji' : (msg.author?.displayName ?? msg.author?.display_name ?? msg.author?.username ?? 'Użytkownik')
          const timeStr   = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' }) : ''
          const isGif     = typeof msg.content === 'string' && /^https?:\/\/(media\.tenor\.com|media[0-9]*\.giphy\.com|tenor\.com)/i.test(msg.content.trim())
          return (
            <div
              key={msg.id}
              onTouchStart={e => onLongPressStart(msg.id, msg.content, authorName, e.touches[0].clientY)}
              onTouchEnd={onLongPressEnd}
              onTouchMove={onLongPressEnd}
              style={{
                display: 'flex', gap: 10, padding: '4px 12px',
                background: ctxMenu?.msgId === msg.id
                  ? 'rgba(255,255,255,0.04)'
                  : isAdmin ? 'rgba(124,58,237,0.06)' : 'transparent',
                borderLeft: isAdmin ? '2px solid #7c3aed' : 'none',
              }}
            >
              {/* Avatar */}
              {isAdmin ? (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginTop: 2 }}>⚡</div>
              ) : (
                <Av
                  url={msg.author?.avatar ?? msg.author?.avatar_url}
                  color={msg.author?.avatarColor ?? msg.author?.avatar_color ?? '#f59e0b'}
                  name={authorName}
                  size={32}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Reply reference */}
                {msg.replyTo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, paddingLeft: 6, borderLeft: '2px solid var(--eb-accent)' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2.5"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--eb-accent)', flexShrink: 0 }}>{msg.replyTo.authorName}</span>
                    <span style={{ fontSize: 11, color: 'var(--eb-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {/^https?:\/\/(media\.tenor\.com|media[0-9]*\.giphy\.com|tenor\.com)/i.test(msg.replyTo.content ?? '') ? '🖼 GIF' : msg.replyTo.content}
                    </span>
                  </div>
                )}
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isAdmin ? '#a78bfa' : 'var(--eb-text1)' }}>
                    {authorName}
                  </span>
                  {isAdmin && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#a78bfa', background: 'rgba(124,58,237,0.18)', border: '0.5px solid rgba(124,58,237,0.5)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.03em' }}>⚡ ADMIN</span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--eb-text3)' }}>{timeStr}</span>
                </div>
                {/* Content */}
                {isGif ? (
                  <img src={msg.content.trim()} alt="GIF" style={{ borderRadius: 10, maxHeight: 160, maxWidth: '85%', objectFit: 'contain', display: 'block', marginTop: 2 }} />
                ) : (
                  <div style={{ fontSize: 14, color: 'var(--eb-text2)', lineHeight: 1.45, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                )}
                {/* Attachments */}
                {(msg.attachments ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {msg.attachments.map((a: any) => (
                      a.contentType?.startsWith('image/') ? (
                        <img key={a.id} src={a.previewUrl ?? a.url} alt={a.filename} style={{ borderRadius: 8, maxHeight: 160, maxWidth: '85%', objectFit: 'contain', display: 'block' }} />
                      ) : (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--eb-bg3)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: 'var(--eb-accent)', textDecoration: 'none' }}>
                          📎 {a.filename}
                        </a>
                      )
                    ))}
                  </div>
                )}
              </div>
              {/* Action: reply */}
              <button
                onTouchStart={e => { e.stopPropagation(); setReplyTo({ id: msg.id, authorName, content: msg.content ?? '' }); inputRef.current?.focus() }}
                style={{ background: 'none', border: 'none', color: 'var(--eb-text3)', padding: '2px 4px', alignSelf: 'flex-start', flexShrink: 0, opacity: 0.6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              </button>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ background: 'var(--eb-bg1)', borderTop: '0.5px solid var(--eb-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }}>
        {replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 0', borderBottom: '0.5px solid var(--eb-border)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--eb-accent)" strokeWidth="2.5"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            <span style={{ fontSize: 11, color: 'var(--eb-text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Odpowiadasz <span style={{ color: 'var(--eb-accent)', fontWeight: 600 }}>{replyTo.authorName}</span>
            </span>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--eb-text3)', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
              <IC.X />
            </button>
          </div>
        )}
        {pendingAttachment && (
          <div style={{ padding: '8px 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            {pendingAttachment.previewUrl
              ? <img src={pendingAttachment.previewUrl} alt="" style={{ height: 56, maxWidth: 100, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={{ height: 36, padding: '0 10px', borderRadius: 8, background: 'var(--eb-bg3)', display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--eb-text2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {pendingAttachment.filename}</div>
            }
            <button onClick={() => { if (pendingAttachment.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl); setPendingAttachment(null) }}
              style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <IC.X />
            </button>
          </div>
        )}
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={!currentChannelId}
            style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '0.5px solid var(--eb-border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: uploadingFile ? 'var(--eb-accent)' : 'var(--eb-text3)', opacity: !currentChannelId ? 0.4 : 1 }}>
            {uploadingFile
              ? <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            }
          </button>
          <textarea
            ref={inputRef}
            className="mobile-input"
            placeholder={currentChannel ? `Wiadomość do #${currentChannel.name}` : 'Wybierz kanał...'}
            value={text}
            rows={1}
            onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={!currentChannelId}
            style={{ resize: 'none', overflowY: 'auto', minHeight: 34, maxHeight: 100, flex: 1 }}
          />
          <button onClick={() => { setShowGif(false); setShowEmoji(s => !s) }} disabled={!currentChannelId}
            style={{ width: 34, height: 34, borderRadius: 10, background: showEmoji ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', border: '0.5px solid var(--eb-border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 16, opacity: !currentChannelId ? 0.4 : 1 }}>
            😊
          </button>
          <button onClick={() => { setShowEmoji(false); setShowGif(s => !s) }} disabled={!currentChannelId}
            style={{ width: 34, height: 34, borderRadius: 10, background: showGif ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', border: '0.5px solid var(--eb-border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 10, fontWeight: 700, color: showGif ? 'var(--eb-accent)' : 'var(--eb-text2)', opacity: !currentChannelId ? 0.4 : 1 }}>
            GIF
          </button>
          <button className="mobile-send-btn" onClick={send}
            disabled={(!text.trim() && !pendingAttachment) || !currentChannelId}
            style={{ opacity: ((!text.trim() && !pendingAttachment) || !currentChannelId) ? 0.4 : 1, flexShrink: 0, width: 34, height: 34 }}>
            <IC.Send />
          </button>
        </div>
      </div>
      </>)}

      {showEmoji && currentChannelId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowEmoji(false)} />
          <div style={{ position: 'relative', zIndex: 1, maxHeight: '65vh', overflow: 'hidden', borderRadius: '20px 20px 0 0' }}>
            <EmojiPicker
              serverId={currentServerId ?? undefined}
              onSelect={(val) => { setText(t => t + val); setShowEmoji(false); inputRef.current?.focus() }}
            />
          </div>
        </div>
      )}

      {showGif && currentChannelId && (
        <MobileGifPicker
          onSelect={(url) => { sendGif(url); setShowGif(false) }}
          onClose={() => setShowGif(false)}
        />
      )}

      {showVoicePanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowVoicePanel(false)} />
          <div style={{ position: 'relative', background: 'var(--eb-bg1)', borderRadius: '20px 20px 0 0', border: '0.5px solid var(--eb-border2)', zIndex: 1, paddingBottom: 'env(safe-area-inset-bottom, 0px)', maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '0.5px solid var(--eb-border)', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--eb-online)' }} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--eb-text1)' }}>
                {serverChannels.find(c => c.id === voice.channelId)?.name ?? 'Kanał głosowy'}
              </span>
              <button onClick={() => toggleMute()}
                style={{ background: muted ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: muted ? '#ef4444' : 'var(--eb-online)', cursor: 'pointer' }}>
                {muted ? '🔇 Wyciszony' : '🎤 Aktywny'}
              </button>
              <button onClick={() => { disconnect(); setShowVoicePanel(false) }}
                style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#ef4444', cursor: 'pointer' }}>
                Rozłącz
              </button>
            </div>
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {participants.length === 0
                ? <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>Tylko Ty jesteś na kanale</div>
                : participants.map(p => (
                  <div key={p.identity} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid var(--eb-border)' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Av url={null} color="#f59e0b" name={p.name} size={42} />
                      {p.isSpeaking && !p.isMuted && (
                        <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid var(--eb-online)' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--eb-text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}{p.isLocal && <span style={{ fontSize: 11, color: 'var(--eb-text3)' }}> (Ty)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: p.isSpeaking && !p.isMuted ? 'var(--eb-online)' : 'var(--eb-text3)' }}>
                        {p.isMuted ? '🔇 Wyciszony' : p.isSpeaking ? '🎙 Mówi...' : 'Słucha'}
                      </div>
                    </div>
                    {p.isMuted && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2" width="18" height="18">
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6M12 19v3M8 23h8"/>
                      </svg>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Context menu (long press) */}
      {ctxMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300 }}
          onClick={() => setCtxMenu(null)}
        >
          <div
            style={{
              position: 'fixed', bottom: 80, left: 16, right: 16,
              background: 'var(--eb-bg2)', borderRadius: 16,
              border: '0.5px solid var(--eb-border2)',
              overflow: 'hidden', zIndex: 301,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--eb-border)', fontSize: 12, color: 'var(--eb-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Wiadomość od <strong style={{ color: 'var(--eb-text2)' }}>{ctxMenu.author}</strong>
            </div>
            <button
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', color: 'var(--eb-text2)', fontSize: 14, cursor: 'pointer' }}
              onClick={() => { setReplyTo({ id: ctxMenu.msgId, authorName: ctxMenu.author, content: ctxMenu.content }); setCtxMenu(null); inputRef.current?.focus() }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> Odpowiedz
            </button>
            <button
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', borderTop: '0.5px solid var(--eb-border)' }}
              onClick={() => { setReportMsg({ id: ctxMenu.msgId, content: ctxMenu.content, author: ctxMenu.author }); setCtxMenu(null) }}
            >
              <IC.Flag /> Zgłoś wiadomość
            </button>
            <button
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', color: 'var(--eb-text2)', fontSize: 14, cursor: 'pointer', borderTop: '0.5px solid var(--eb-border)' }}
              onClick={() => setCtxMenu(null)}
            >
              <IC.X /> Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Report modal */}
      {reportMsg && currentChannelId && currentServerId && (
        <ReportModal
          messageId={reportMsg.id}
          channelId={currentChannelId}
          serverId={currentServerId}
          messageContent={reportMsg.content}
          authorName={reportMsg.author}
          onClose={() => setReportMsg(null)}
        />
      )}

      {/* Server picker sheet */}
      {serverPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setServerPickerOpen(false)} />
          <div style={{ position: 'relative', background: 'var(--eb-bg1)', borderRadius: '20px 20px 0 0', border: '0.5px solid var(--eb-border2)', zIndex: 1, paddingBottom: 'env(safe-area-inset-bottom, 0px)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 16px 10px', borderBottom: '0.5px solid var(--eb-border)', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Serwery</span>
            </div>
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {servers.map(srv => (
                <button key={srv.id}
                  onClick={() => { setCurrentServer(srv.id); setServerPickerOpen(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: currentServerId === srv.id ? 'rgba(255,255,255,0.05)' : 'none', border: 'none', borderBottom: '0.5px solid var(--eb-border)', cursor: 'pointer' }}>
                  <div style={{ width: 36, height: 36, borderRadius: currentServerId === srv.id ? 10 : 14, background: srv.icon_color || 'var(--eb-bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden', transition: 'border-radius 0.2s' }}>
                    {srv.icon_url ? <img src={srv.icon_url} alt={srv.name} width={36} height={36} style={{ objectFit: 'cover' }} /> : srv.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: currentServerId === srv.id ? 'var(--eb-text1)' : 'var(--eb-text2)', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {srv.name}
                  </span>
                  {currentServerId === srv.id && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--eb-accent)', flexShrink: 0 }} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Members Screen ────────────────────────────────────────────── */
const ROLE_META: Record<string, { color: string; icon: string }> = {
  'Administrator': { color: '#f87171', icon: '👑' },
  'Moderator':     { color: '#fb923c', icon: '🛡' },
  'Członek':       { color: '#60a5fa', icon: '✅' },
  'Do Weryfikacji':{ color: '#94a3b8', icon: '⏳' },
}
const ROLE_ORDER = ['Administrator', 'Moderator', 'Członek', 'Do Weryfikacji']

function MembersScreen() {
  const members          = useStore(s => s.members)
  const token            = useStore(s => s.token)
  const currentServerId  = useStore(s => s.currentServerId)
  const serverMembers    = currentServerId ? (members[currentServerId] ?? []) : []
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!token || !currentServerId || serverMembers.length === 0) return
    let cancelled = false
    const fetchRoles = async () => {
      const result: Record<string, string> = {}
      await Promise.all(serverMembers.map(async m => {
        try {
          const res = await fetch(`${BASE}/api/servers/${currentServerId}/members/${m.user_id}/roles`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await res.json()
          const roles: any[] = data.roles ?? []
          const top = roles.filter(r => ROLE_META[r.name]).sort((a, b) => b.position - a.position)[0]
          if (top) result[m.user_id] = top.name
        } catch {}
      }))
      if (!cancelled) setMemberRoles(result)
    }
    fetchRoles()
    return () => { cancelled = true }
  }, [token, currentServerId, serverMembers.length])

  const sorted = [...serverMembers].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(memberRoles[a.user_id] ?? '')
    const ib = ROLE_ORDER.indexOf(memberRoles[b.user_id] ?? '')
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const online  = sorted.filter(m => m.status !== 'offline')
  const offline = sorted.filter(m => m.status === 'offline')

  const statusColor = (s: string) => s === 'online' ? 'var(--eb-online)' : s === 'idle' ? 'var(--eb-accent)' : s === 'dnd' ? 'var(--eb-accent2)' : 'var(--eb-text3)'

  const Row = ({ m, dim = false }: { m: any; dim?: boolean }) => {
    const roleName = memberRoles[m.user_id]
    const roleMeta = roleName ? ROLE_META[roleName] : null
    return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid var(--eb-border)', opacity: dim ? 0.45 : 1 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Av url={m.avatar_url} color={m.avatar_color} name={m.display_name || m.username} size={38} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: statusColor(m.status), border: '2px solid var(--eb-bg1)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: roleMeta ? roleMeta.color : 'var(--eb-text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.nickname || m.display_name || m.username}
        </div>
        {m.custom_status && <div style={{ fontSize: 12, color: 'var(--eb-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.custom_status}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        {roleMeta && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: `${roleMeta.color}18`, color: roleMeta.color, border: `0.5px solid ${roleMeta.color}40`, whiteSpace: 'nowrap' }}>
            {roleMeta.icon} {roleName}
          </span>
        )}
        {Boolean(m.is_dev || m.is_mod) && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: m.is_dev ? 'rgba(168,85,247,0.15)' : 'rgba(245,158,11,0.12)', color: m.is_dev ? 'var(--eb-purple)' : 'var(--eb-accent)' }}>
            {m.is_dev ? 'DEV' : 'MOD'}
          </span>
        )}
      </div>
    </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="mobile-header">
        <span className="mobile-header-title">Członkowie {serverMembers.length > 0 && <span style={{ fontSize: 12, color: 'var(--eb-text3)', fontWeight: 400 }}>({serverMembers.length})</span>}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {serverMembers.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>Wybierz serwer, by zobaczyć członków</div>
        )}
        {online.length > 0 && (
          <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Online — {online.length}
          </div>
        )}
        {online.map(m => <Row key={m.user_id} m={m} />)}
        {offline.length > 0 && (
          <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Offline — {offline.length}
          </div>
        )}
        {offline.map(m => <Row key={m.user_id} m={m} dim />)}
      </div>
    </div>
  )
}

/* ─── Notifications Screen ──────────────────────────────────────── */
interface Notif { id: string; type: string; content: string; read: boolean; createdAt: string; channelName?: string; serverName?: string; senderName?: string; senderAvatar?: string; senderColor?: string }

function NotificationsScreen() {
  const token = useStore(s => s.token)
  const lang  = useStore(s => s.userSettings.language ?? 'pl')
  const [notifs, setNotifs]     = useState<Notif[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'notifs' | 'patch'>('notifs')
  const [patchNotes, setPatchNotes] = useState<any[]>([])
  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${BASE}/api/notifications?limit=50`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
    }).then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => { setNotifs(d.notifications ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  // Patch notes z bazy (te same co desktop) zamiast zahardkodowanych
  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/api/admin/patch-notes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { notes: [] })
      .then(d => setPatchNotes(d.notes ?? []))
      .catch(() => {})
  }, [token])

  async function markAllRead() {
    await fetch(`${BASE}/api/notifications/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function deleteNotif(id: string) {
    fetch(`${BASE}/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const typeLabel = (t: string) => t === 'mention' ? '@ Wzmianka' : t === 'reply' ? '↩ Odpowiedź' : '😊 Reakcja'
  const typeColor = (t: string) => t === 'mention' ? 'var(--eb-mention)' : t === 'reply' ? 'var(--eb-voice)' : 'var(--eb-accent)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="mobile-header">
        <span className="mobile-header-title">Aktywność</span>
        {unread > 0 && tab === 'notifs' && (
          <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--eb-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Odczytaj wszystkie
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid var(--eb-border)', background: 'var(--eb-bg1)' }}>
        {[{ id: 'notifs', label: 'Powiadomienia' }, { id: 'patch', label: 'Aktualizacje' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--eb-accent)' : 'var(--eb-text3)', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid var(--eb-accent)' : '2px solid transparent', cursor: 'pointer' }}>
            {t.label}{t.id === 'notifs' && unread > 0 ? ` (${unread})` : ''}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {tab === 'notifs' && (
          <>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>Ładowanie...</div>}
            {!loading && notifs.length === 0 && (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                Brak powiadomień
              </div>
            )}
            {notifs.map(n => (
              <div key={n.id} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid var(--eb-border)', background: n.read ? 'transparent' : 'rgba(245,158,11,0.04)' }}>
                {n.senderAvatar || n.senderColor ? (
                  <Av url={n.senderAvatar} color={n.senderColor || '#f59e0b'} name={n.senderName || '?'} size={36} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--eb-bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {n.type === 'mention' ? '💬' : n.type === 'reply' ? '↩' : '😊'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: typeColor(n.type) }}>{typeLabel(n.type)}</span>
                    {n.channelName && <span style={{ fontSize: 11, color: 'var(--eb-text3)' }}>#{n.channelName}</span>}
                    {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--eb-accent)', marginLeft: 'auto', flexShrink: 0 }} />}
                  </div>
                  {n.senderName && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--eb-text1)', marginBottom: 2 }}>{n.senderName}</div>}
                  <div style={{ fontSize: 13, color: 'var(--eb-text2)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                    {n.content}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--eb-text3)', marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleString('pl', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button onClick={() => deleteNotif(n.id)} style={{ background: 'none', border: 'none', color: 'var(--eb-text3)', cursor: 'pointer', alignSelf: 'flex-start', padding: 2, flexShrink: 0 }}>
                  <IC.X />
                </button>
              </div>
            ))}
          </>
        )}

        {tab === 'patch' && (
          <div style={{ padding: '8px 0' }}>
            {patchNotes.length === 0 && (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>
                Brak wpisów
              </div>
            )}
            {patchNotes.map(release => {
              const label = lang === 'en' ? release.label_en : release.label_pl
              const entries: any[] = Array.isArray(release.entries) ? release.entries : []
              return (
                <div key={release.id ?? release.version} style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--eb-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--eb-text1)' }}>v{release.version}</span>
                    {label && <span style={{ fontSize: 11, color: 'var(--eb-accent)', background: 'rgba(245,158,11,0.1)', borderRadius: 6, padding: '1px 7px' }}>{label}</span>}
                    <span style={{ fontSize: 11, color: 'var(--eb-text3)', marginLeft: 'auto' }}>{release.date}</span>
                  </div>
                  {entries.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: e.type === 'fix' ? 'var(--eb-voice)' : e.type === 'imp' ? 'var(--eb-accent)' : 'var(--eb-online)', flexShrink: 0 }}>
                        {e.type === 'fix' ? '🔧' : e.type === 'imp' ? '⚡' : '✨'}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--eb-text2)', lineHeight: 1.4 }}>{lang === 'en' ? e.en : e.pl}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Profile / Settings Screen ─────────────────────────────────── */
function ProfileScreen() {
  const currentUser = useStore(s => s.currentUser)
  const [showSettings, setShowSettings] = useState(false)

  if (showSettings) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="mobile-header" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <button className="icon-btn" onClick={() => setShowSettings(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={20} height={20}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="mobile-header-title">Ustawienia</span>
        </div>
        <div style={{ padding: '0 0 80px' }}>
          <UserSettings onClose={() => setShowSettings(false)} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="mobile-header">
        <span className="mobile-header-title">Profil</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {currentUser && (
          <>
            {/* Hero */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 24px', gap: 10 }}>
              <Av url={currentUser.avatar_url} color={currentUser.avatar_color} name={currentUser.display_name || currentUser.username} size={80} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--eb-text1)' }}>{currentUser.display_name || currentUser.username}</div>
                <div style={{ fontSize: 13, color: 'var(--eb-text3)' }}>@{currentUser.username}</div>
              </div>
              {currentUser.custom_status && (
                <div style={{ fontSize: 13, color: 'var(--eb-text2)', background: 'var(--eb-bg2)', borderRadius: 10, padding: '6px 14px', border: '0.5px solid var(--eb-border)' }}>
                  {currentUser.custom_status}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--eb-online)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--eb-online)' }} />
                Online
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="ember-btn"
                onClick={() => setShowSettings(true)}
                style={{ width: '100%', padding: '13px 16px', fontSize: 14, borderRadius: 14 }}
              >
                ⚙️ Ustawienia konta
              </button>
            </div>

            {/* Info tiles */}
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Nazwa użytkownika', value: currentUser.username },
                { label: 'Wyświetlana nazwa', value: currentUser.display_name || '—' },
                { label: 'ID', value: currentUser.id },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--eb-bg2)', borderRadius: 12, padding: '12px 14px', border: '0.5px solid var(--eb-border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--eb-text1)', fontFamily: item.label === 'ID' ? 'monospace' : undefined }}>{item.value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── MobileApp root ─────────────────────────────────────────────── */
export function MobileApp() {
  const [tab, setTab] = useState<Tab>('chat')
  const token = useStore(s => s.token)
  const { on, off } = useSocket()
  const [notifCount, setNotifCount] = useState(0)

  // Liczba nieprzeczytanych powiadomień (initial + live przez socket)
  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/api/notifications?limit=50`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
    }).then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => setNotifCount((d.notifications ?? []).filter((n: any) => !n.read).length))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    const onNotif = () => setNotifCount(c => c + 1)
    on('NOTIFICATION', onNotif)
    return () => off('NOTIFICATION', onNotif)
  }, [on, off])

  // Wyzeruj badge po wejściu w zakładkę Aktywność
  useEffect(() => { if (tab === 'notifications') setNotifCount(0) }, [tab])

  const TABS: { id: Tab; label: string; Icon: React.FC; badge?: number }[] = [
    { id: 'chat',          label: 'Czaty',        Icon: () => <IC.Chat a={tab === 'chat'} /> },
    { id: 'members',       label: 'Członkowie',   Icon: () => <IC.Members a={tab === 'members'} /> },
    { id: 'notifications', label: 'Aktywność',    Icon: () => <IC.Bell a={tab === 'notifications'} />, badge: notifCount },
    { id: 'profile',       label: 'Profil',       Icon: () => <IC.User a={tab === 'profile'} /> },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--eb-bg0)', display: 'flex', flexDirection: 'column' }}>
      {/* Screen */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tab === 'chat'          && <ChatScreen />}
        {tab === 'members'       && <MembersScreen />}
        {tab === 'notifications' && <NotificationsScreen />}
        {tab === 'profile'       && <ProfileScreen />}
      </div>

      {/* Bottom nav */}
      <nav className="mobile-bottom-nav">
        {TABS.map(({ id, label, Icon, badge }) => (
          <button key={id} className={`mobile-nav-item${tab === id ? ' active' : ''}`} onClick={() => setTab(id)} style={{ position: 'relative' }}>
            <Icon />
            <span>{label}</span>
            {!!badge && badge > 0 && (
              <span style={{ position: 'absolute', top: 2, right: '50%', marginRight: -22, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--eb-accent2)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
