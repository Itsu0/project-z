'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1280
      let { width, height } = img
      if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
      if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = reject
    img.src = url
  })
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CATEGORIES = [
  { value: 'bug',      label: 'Błąd techniczny',          icon: '🐛' },
  { value: 'abuse',    label: 'Naruszenie regulaminu',     icon: '🚨' },
  { value: 'security', label: 'Problem z bezpieczeństwem', icon: '🔒' },
  { value: 'spam',     label: 'Spam',                      icon: '📢' },
  { value: 'other',    label: 'Inne',                      icon: '💬' },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Otwarte',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  in_progress: { label: 'W trakcie',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  resolved:    { label: 'Rozwiązane', color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  closed:      { label: 'Zamknięte', color: '#6b7280',  bg: 'rgba(107,114,128,0.12)'},
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.open
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: m.color, background: m.bg }}>{m.label}</span>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="var(--eb-text3)" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function Avatar({ user, size = 28 }: { user: any; size?: number }) {
  if (user?.avatar_url) return (
    <img src={user.avatar_url} alt="" width={size} height={size}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }} />
  )
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, background: user?.avatar_color ?? '#64748b',
        fontSize: size * 0.38 }}>
      {(user?.display_name ?? user?.username ?? '?')[0].toUpperCase()}
    </div>
  )
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  text:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  announcement: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  voice:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  forum:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  stage:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
}

const STATUS_DOT: Record<string, string> = {
  online: '#22c55e', idle: '#f59e0b', dnd: '#ef4444', offline: '#6b7280',
}

function GhostViewer({ token, serverId, onClose }: { token: string; serverId: string; onClose: () => void }) {
  const [data,         setData]       = useState<any>(null)
  const [loading,      setLoading]    = useState(true)
  const [error,        setError]      = useState('')
  const [channel,      setChannel]    = useState<any>(null)
  const [messages,     setMessages]   = useState<any[]>([])
  const [msgLoad,      setMsgLoad]    = useState(false)
  const [hasMore,      setHasMore]    = useState(false)
  const [loadingMore,  setLoadMore]   = useState(false)
  const [showMembers,  setShowMem]    = useState(true)
  const [collapsed,    setCollapsed]  = useState<Record<string, boolean>>({})
  const [memberMenu,   setMemberMenu] = useState<string | null>(null)
  const [action,       setAction]     = useState<{ type: 'ban' | 'warn' | 'unban' | 'platform_ban'; user: any } | null>(null)
  const [adminMsg,     setAdminMsg]   = useState('')
  const [adminSending, setAdminSend]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const msgContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${BASE}/api/admin/ghost/${serverId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)

        const first = (d.channels ?? []).find((c: any) => c.type === 'text' || c.type === 'announcement')
        if (first) loadChannel(first, d)
      })
      .catch(() => { setError('Nie udało się załadować serwera'); setLoading(false) })

  }, [token, serverId])

  async function loadChannel(ch: any, serverData?: any) {
    setChannel(ch)
    setMessages([])
    setHasMore(false)
    if (ch.type === 'voice' || ch.type === 'stage') return
    setMsgLoad(true)
    try {
      const r = await fetch(
        `${BASE}/api/admin/ghost/${serverId}/messages/${ch.id}?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const d = await r.json()
      setMessages(d.messages ?? [])
      setHasMore(d.hasMore ?? false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
    } catch {} finally { setMsgLoad(false) }
  }

  async function loadMore() {
    if (!channel || messages.length === 0 || loadingMore) return
    setLoadMore(true)
    const oldestId = messages[0]?.id
    const prevH = msgContainerRef.current?.scrollHeight ?? 0
    try {
      const r = await fetch(
        `${BASE}/api/admin/ghost/${serverId}/messages/${channel.id}?limit=50&before=${oldestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const d = await r.json()
      const older = d.messages ?? []
      setMessages(prev => [...older, ...prev])
      setHasMore(d.hasMore ?? false)

      requestAnimationFrame(() => {
        if (msgContainerRef.current) {
          msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight - prevH
        }
      })
    } catch {} finally { setLoadMore(false) }
  }

  const grouped = useCallback(() => {
    if (!data) return []
    const cats: Array<{ id: string | null; name: string | null; position: number; channels: any[] }> = []

    for (const cat of (data.categories ?? [])) {
      cats.push({ id: cat.id, name: cat.name, position: cat.position, channels: [] })
    }

    cats.push({ id: null, name: null, position: 9999, channels: [] })

    for (const ch of (data.channels ?? [])) {
      const bucket = cats.find(c => c.id === (ch.category_id ?? null)) ?? cats[cats.length - 1]
      bucket.channels.push(ch)
    }

    return cats.filter(c => c.channels.length > 0).sort((a, b) => a.position - b.position)
  }, [data])

  const memberGroups = useCallback(() => {
    if (!data) return []
    const online = (data.members ?? []).filter((m: any) => m.status === 'online' || m.status === 'idle' || m.status === 'dnd')
    const offline = (data.members ?? []).filter((m: any) => m.status === 'offline')
    return [
      { label: `Online — ${online.length}`, members: online },
      { label: `Offline — ${offline.length}`, members: offline },
    ].filter(g => g.members.length > 0)
  }, [data])

  function toggleCat(id: string | null) {
    const key = id ?? '__none__'
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function sendAdminMsg() {
    if (!adminMsg.trim() || !channel) return
    setAdminSend(true)
    try {
      await fetch(`${BASE}/api/admin/ghost/${serverId}/channels/${channel.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: adminMsg.trim() }),
      })
      setAdminMsg('')
    } catch {} finally { setAdminSend(false) }
  }

  const srv = data?.server

  return (
    <>
    {action && action.type === 'platform_ban' ? (
      <PlatformBanModal
        user={action.user}
        token={token}
        onDone={() => setAction(null)}
        onClose={() => setAction(null)} />
    ) : action ? (
      <ActionModal
        type={action.type as any}
        user={action.user}
        token={token}
        onDone={() => setAction(null)}
        onClose={() => setAction(null)} />
    ) : null}
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--eb-bg1)' }}>

      {}
      <div className="flex items-center gap-3 px-4 h-12 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg2)', zIndex: 10 }}>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide"
          style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
          👻 GHOST
        </div>
        {srv && (
          <div className="flex items-center gap-2">
            {srv.icon_url ? (
              <img src={srv.icon_url} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: srv.icon_color ?? '#6366f1' }}>
                {srv.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm font-bold" style={{ color: 'var(--eb-text1)' }}>{srv.name}</span>
            <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
              · {data?.memberCount ?? 0} członków · właściciel: {srv.owner_name}
            </span>
          </div>
        )}
        <div className="flex-1" />
        <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
          Twoja obecność nie jest widoczna
        </span>
        {}
        <button
          onClick={() => setShowMem(v => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          title="Lista członków"
          style={{
            background: showMembers ? 'rgba(99,102,241,0.15)' : 'var(--eb-bg3)',
            color: showMembers ? '#6366f1' : 'var(--eb-text3)',
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </button>
        <button onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--eb-bg3)')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <Spinner />
          <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>Ładowanie serwera...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm" style={{ color: 'var(--eb-accent2)' }}>{error}</p>
          <button onClick={onClose} className="ember-btn px-4 py-2 text-xs">Zamknij</button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {}
          <div className="w-60 flex-shrink-0 flex flex-col overflow-y-auto"
            style={{ background: 'var(--eb-bg2)', borderRight: '0.5px solid var(--eb-border)' }}>

            {}
            <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
              style={{ borderColor: 'var(--eb-border)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="1.8">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span className="text-xs font-bold truncate" style={{ color: 'var(--eb-text1)' }}>
                {srv?.name ?? '...'}
              </span>
            </div>

            {}
            <div className="flex-1 overflow-y-auto py-2">
              {grouped().map(group => {
                const key = group.id ?? '__none__'
                const isCollapsed = collapsed[key] ?? false
                return (
                  <div key={key} className="mb-1">
                    {}
                    {group.name && (
                      <button
                        onClick={() => toggleCat(group.id)}
                        className="w-full flex items-center gap-1 px-2 py-1 text-left"
                        style={{ color: 'var(--eb-text3)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5"
                          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
                          {group.name}
                        </span>
                      </button>
                    )}
                    {}
                    {!isCollapsed && group.channels.map((ch: any) => {
                      const isVoice = ch.type === 'voice' || ch.type === 'stage'
                      const isActive = channel?.id === ch.id
                      return (
                        <button key={ch.id}
                          onClick={() => loadChannel(ch)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 mx-1 rounded-lg text-left transition-all group"
                          style={{
                            width: 'calc(100% - 8px)',
                            background: isActive ? 'var(--eb-bg4)' : 'transparent',
                            color: isActive ? 'var(--eb-text1)' : 'var(--eb-text3)',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--eb-bg3)' }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                          <span className="flex-shrink-0" style={{ opacity: isActive ? 1 : 0.6 }}>
                            {CHANNEL_ICONS[ch.type] ?? CHANNEL_ICONS.text}
                          </span>
                          <span className="text-xs truncate flex-1">{ch.name}</span>
                          {isVoice && ch.user_limit > 0 && (
                            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
                              0/{ch.user_limit}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!channel ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2">
                <span className="text-4xl opacity-30">💬</span>
                <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>Wybierz kanał z listy po lewej</p>
              </div>
            ) : (
              <>
                {}
                <div className="flex items-center gap-2 px-4 h-12 flex-shrink-0 border-b"
                  style={{ borderColor: 'var(--eb-border)' }}>
                  <span style={{ color: 'var(--eb-text3)', flexShrink: 0 }}>
                    {CHANNEL_ICONS[channel.type] ?? CHANNEL_ICONS.text}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>
                    {channel.name}
                  </span>
                  {channel.topic && (
                    <>
                      <span style={{ color: 'var(--eb-border2)' }}>|</span>
                      <span className="text-xs truncate" style={{ color: 'var(--eb-text3)' }}>{channel.topic}</span>
                    </>
                  )}
                  {channel.slowmode > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto flex-shrink-0"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                      ⏱ {channel.slowmode}s
                    </span>
                  )}
                </div>

                {}
                {channel.type === 'voice' || channel.type === 'stage' ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-2">
                    <span className="text-4xl opacity-30">🎙️</span>
                    <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>Kanał głosowy — brak historii wiadomości</p>
                  </div>
                ) : (
                  <div ref={msgContainerRef} className="flex-1 overflow-y-auto flex flex-col px-4 py-4 gap-0.5">
                    {}
                    {hasMore && (
                      <div className="flex justify-center pb-3 flex-shrink-0">
                        <button onClick={loadMore} disabled={loadingMore}
                          className="text-xs px-4 py-1.5 rounded-full transition-all"
                          style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text2)', border: '1px solid var(--eb-border)' }}>
                          {loadingMore ? <Spinner /> : '↑ Załaduj starsze wiadomości'}
                        </button>
                      </div>
                    )}

                    {msgLoad ? (
                      <div className="flex justify-center py-12"><Spinner /></div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center flex-1 gap-2">
                        <span className="text-4xl opacity-20">📭</span>
                        <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>Brak wiadomości w tym kanale</p>
                      </div>
                    ) : (() => {

                      const grouped: Array<{ author: any; msgs: any[]; firstTs: Date }> = []
                      for (const msg of messages) {
                        const last = grouped[grouped.length - 1]
                        const ts = new Date(msg.created_at)
                        if (
                          last &&
                          last.author.id === msg.author_id &&
                          ts.getTime() - last.firstTs.getTime() < 5 * 60 * 1000
                        ) {
                          last.msgs.push(msg)
                        } else {
                          grouped.push({ author: { id: msg.author_id, display_name: msg.author_name, avatar_color: msg.avatar_color, avatar_url: msg.avatar_url }, msgs: [msg], firstTs: ts })
                        }
                      }
                      return grouped.map((group, gi) => (
                        <div key={group.msgs[0].id} className={`flex items-start gap-3 ${gi > 0 ? 'mt-3' : ''}`}>
                          <Avatar user={group.author} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>
                                {group.author.display_name}
                              </span>
                              <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                                {new Date(group.msgs[0].created_at).toLocaleString('pl-PL', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {group.msgs.map(msg => (
                              <div key={msg.id} className="group/msg relative">
                                {}
                                {msg.reply_author_name && (
                                  <div className="flex items-center gap-1.5 mb-0.5 text-[11px] opacity-60">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                                    </svg>
                                    <span style={{ color: 'var(--eb-text2)' }}>{msg.reply_author_name}:</span>
                                    <span className="truncate" style={{ color: 'var(--eb-text3)', maxWidth: 200 }}>{msg.reply_content}</span>
                                  </div>
                                )}
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap"
                                  style={{ color: msg.edited_at ? 'var(--eb-text2)' : 'var(--eb-text1)' }}>
                                  {msg.content}
                                  {msg.edited_at && (
                                    <span className="text-[10px] ml-1" style={{ color: 'var(--eb-text3)' }}>(edytowane)</span>
                                  )}
                                </p>
                                {}
                                <span className="absolute left-0 -top-0.5 text-[9px] hidden group-hover/msg:block"
                                  style={{ color: 'var(--eb-text3)', transform: 'translateX(-48px)' }}>
                                  {new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                    <div ref={bottomRef} />
                  </div>
                )}

                {}
                {channel && channel.type !== 'voice' && channel.type !== 'stage' && (
                  <div className="flex-shrink-0 px-4 py-3 border-t flex gap-2 items-end"
                    style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg1)' }}>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>⚡</div>
                    <textarea
                      value={adminMsg}
                      onChange={e => setAdminMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdminMsg() } }}
                      rows={1}
                      maxLength={2000}
                      placeholder="Wyślij wiadomość jako Administrator Aplikacji..."
                      className="flex-1 px-3 py-2 rounded-xl text-xs resize-none outline-none"
                      style={{
                        background: 'var(--eb-bg3)',
                        border: '1px solid rgba(124,58,237,0.3)',
                        color: 'var(--eb-text1)',
                        maxHeight: 80,
                      }}
                    />
                    <button
                      onClick={sendAdminMsg}
                      disabled={adminSending || !adminMsg.trim()}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: 'rgba(124,58,237,0.15)',
                        color: '#a78bfa',
                        border: '1px solid rgba(124,58,237,0.35)',
                        opacity: adminSending || !adminMsg.trim() ? 0.5 : 1,
                      }}>
                      {adminSending ? '...' : 'Wyślij'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {}
          {showMembers && (
            <div className="w-56 flex-shrink-0 flex flex-col overflow-y-auto py-3"
              style={{ background: 'var(--eb-bg2)', borderLeft: '0.5px solid var(--eb-border)' }}>
              {memberGroups().map(group => (
                <div key={group.label} className="mb-3">
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--eb-text3)' }}>
                    {group.label}
                  </div>
                  {group.members.map((m: any) => {
                    const isOpen = memberMenu === m.id
                    return (
                      <div key={m.id} className="mx-1 mb-0.5">
                        {}
                        <button
                          onClick={() => setMemberMenu(isOpen ? null : m.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left"
                          style={{
                            opacity: m.status === 'offline' ? 0.5 : 1,
                            background: isOpen ? 'var(--eb-bg4)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--eb-bg3)' }}
                          onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}>
                          <div className="relative flex-shrink-0">
                            <Avatar user={m} size={28} />
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                              style={{ background: STATUS_DOT[m.status] ?? STATUS_DOT.offline, borderColor: 'var(--eb-bg2)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--eb-text1)' }}>
                              {m.nickname ?? m.display_name}
                            </p>
                            {m.custom_status && (
                              <p className="text-[10px] truncate" style={{ color: 'var(--eb-text3)' }}>
                                {m.custom_status}
                              </p>
                            )}
                          </div>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="var(--eb-text3)" strokeWidth="2.5"
                            style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </button>

                        {}
                        {isOpen && (
                          <div className="mx-1 mb-1 px-2 py-2 rounded-xl flex flex-col gap-1.5"
                            style={{ background: 'var(--eb-bg4)', border: '1px solid var(--eb-border2)' }}>
                            {}
                            <div className="flex items-center gap-1.5 px-1 pb-1 mb-0.5"
                              style={{ borderBottom: '1px solid var(--eb-border)' }}>
                              <Avatar user={m} size={22} />
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>
                                  {m.display_name}
                                </p>
                                <p className="text-[10px] truncate" style={{ color: 'var(--eb-text3)' }}>
                                  @{m.username}
                                </p>
                              </div>
                            </div>
                            {}
                            <button
                              onClick={() => { setMemberMenu(null); setAction({ type: 'warn', user: m }) }}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold w-full transition-all"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.18)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.1)')}>
                              <span>⚠️</span> Ostrzeż
                            </button>
                            <button
                              onClick={() => { setMemberMenu(null); setAction({ type: 'ban', user: m }) }}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold w-full transition-all"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}>
                              <span>🔨</span> Ban serwer
                            </button>
                            <button
                              onClick={() => { setMemberMenu(null); setAction({ type: 'platform_ban', user: m }) }}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold w-full transition-all"
                              style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.18)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}>
                              <span>🚫</span> Ban platforma
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}

function PlatformBanModal({ user, token, onDone, onClose }: { user: any; token: string; onDone: () => void; onClose: () => void }) {
  const [reason,  setReason]  = useState('')
  const [days,    setDays]    = useState('')
  const [banIps,  setBanIps]  = useState(true)
  const [ips,     setIps]     = useState<any[]>([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const userId = user.user_id ?? user.id

  useEffect(() => {
    fetch(`${BASE}/api/admin/users/${userId}/ips`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setIps(d.ips ?? [])).catch(() => {})
  }, [userId, token])

  async function submit() {
    if (!reason.trim()) { setError('Podaj powód'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/admin/bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, reason: reason.trim(), days: days ? Number(days) : undefined, banIps }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd'); return }
      onDone()
    } catch { setError('Błąd serwera') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-5 w-full flex flex-col gap-4" style={{
        maxWidth: 400,
        background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)',
      }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">🚫</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>Ban na całą platformę</p>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>{user.display_name ?? user.username}</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--eb-text3)' }}>Powód *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            rows={3} placeholder="Opisz powód..."
            className="ember-input w-full px-3 py-2 text-xs resize-none" />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--eb-text3)' }}>Czas (dni) — puste = permanentny</label>
          <input type="number" value={days} onChange={e => setDays(e.target.value)}
            min={1} placeholder="np. 30, 365..."
            className="ember-input w-full px-3 py-2 text-xs" />
        </div>

        <div className="rounded-xl p-3 flex flex-col gap-2"
          style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBanIps(v => !v)}
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: banIps ? '#7c3aed' : 'var(--eb-bg3)',
                border: `1px solid ${banIps ? '#7c3aed' : 'var(--eb-border)'}`,
              }}>
              {banIps && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Zbanuj też adresy IP ({ips.length})</span>
          </div>
          {ips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {ips.map((ip: any) => (
                <span key={ip.ip} className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                  style={{ background: 'rgba(124,58,237,0.12)', color: '#c4b5fd', border: '0.5px solid rgba(124,58,237,0.3)' }}>
                  {ip.ip}
                  {ip.is_banned > 0 && <span className="ml-1 opacity-60">✓</span>}
                </span>
              ))}
            </div>
          )}
          {ips.length === 0 && <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>Brak zebranych adresów IP dla tego użytkownika</p>}
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text2)', border: '1px solid var(--eb-border)' }}>
            Anuluj
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Blokuję...' : 'Zablokuj platformę'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionModal({
  type, user, token,
  onDone, onClose,
}: {
  type: 'ban' | 'warn' | 'unban'
  user: any
  token: string
  onDone: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [days,   setDays]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function submit() {
    if (type !== 'unban' && !reason.trim()) { setError('Podaj powód'); return }
    setSaving(true); setError('')
    try {
      let res: Response
      if (type === 'ban') {
        res = await fetch(`${BASE}/api/admin/bans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.user_id ?? user.id, reason: reason.trim(), days: days ? Number(days) : undefined }),
        })
      } else if (type === 'unban') {
        res = await fetch(`${BASE}/api/admin/bans/${user.user_id ?? user.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        res = await fetch(`${BASE}/api/admin/warnings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.user_id ?? user.id, reason: reason.trim() }),
        })
      }
      const data = await res!.json()
      if (!res!.ok) { setError(data.error ?? 'Błąd'); return }
      onDone()
    } catch { setError('Błąd serwera') }
    finally { setSaving(false) }
  }

  const COLORS = { ban: '#ef4444', warn: '#f59e0b', unban: '#22c55e' }
  const LABELS = { ban: 'Zbanuj użytkownika', warn: 'Wyślij ostrzeżenie', unban: 'Odbanuj użytkownika' }
  const ICONS  = { ban: '🔨', warn: '⚠️', unban: '✅' }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-5 w-full" style={{
        maxWidth: 380,
        background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)',
      }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">{ICONS[type]}</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>{LABELS[type]}</p>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
              {user.display_name ?? user.username}
            </p>
          </div>
        </div>

        {type !== 'unban' && (
          <div className="flex flex-col gap-3 mb-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block"
                style={{ color: 'var(--eb-text3)' }}>Powód *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                rows={3} placeholder="Opisz powód..."
                className="ember-input w-full px-3 py-2 text-xs resize-none" />
            </div>
            {type === 'ban' && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block"
                  style={{ color: 'var(--eb-text3)' }}>Czas trwania (dni) — zostaw puste = permanentny</label>
                <input type="number" value={days} onChange={e => setDays(e.target.value)}
                  placeholder="np. 7, 30, 365..."
                  min={1}
                  className="ember-input w-full px-3 py-2 text-xs" />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs mb-3" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text2)', border: '1px solid var(--eb-border)' }}>
            Anuluj
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ background: COLORS[type], opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Zapisywanie...' : LABELS[type]}
          </button>
        </div>
      </div>
    </div>
  )
}

function MyWarnings({ token }: { token: string }) {
  const [warnings, setWarnings] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [replies,  setReplies]  = useState<Record<string, string>>({})
  const [sending,  setSending]  = useState<string | null>(null)
  const [sent,     setSent]     = useState<Record<string, boolean>>({})
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  function load() {
    setLoading(true)
    fetch(`${BASE}/api/user/warnings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setWarnings(d.warnings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [token])

  async function sendReply(w: any) {
    const reply = (replies[w.id] ?? '').trim()
    if (!reply) { setErrors(p => ({ ...p, [w.id]: 'Napisz wyjaśnienie' })); return }
    setSending(w.id); setErrors(p => ({ ...p, [w.id]: '' }))
    try {
      const res = await fetch(`${BASE}/api/user/warnings/${w.id}/reply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply }),
      })
      const data = await res.json()
      if (!res.ok) { setErrors(p => ({ ...p, [w.id]: data.error ?? 'Błąd' })); return }
      setSent(p => ({ ...p, [w.id]: true }))
      load()
    } catch { setErrors(p => ({ ...p, [w.id]: 'Błąd serwera' })) }
    finally { setSending(null) }
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  if (warnings.length === 0) return (
    <div className="flex flex-col items-center py-10 gap-2">
      <span className="text-3xl">✅</span>
      <p className="text-sm font-semibold" style={{ color: 'var(--eb-text2)' }}>Brak ostrzeżeń</p>
      <p className="text-xs text-center" style={{ color: 'var(--eb-text3)' }}>
        Twoje konto jest czyste. Przestrzegaj regulaminu, aby tak pozostało.
      </p>
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs mb-1" style={{ color: 'var(--eb-text3)' }}>
        Łącznie ostrzeżeń: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{warnings.length}</span>
      </p>

      {warnings.map(w => {
        const isOpen    = expanded === w.id
        const hasReply  = !!w.user_reply
        const notSeen   = !w.seen_at

        return (
          <div key={w.id} className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${notSeen ? 'rgba(245,158,11,0.35)' : 'var(--eb-border)'}`, background: 'var(--eb-bg3)' }}>

            {}
            <button onClick={() => setExpanded(isOpen ? null : w.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                style={{ background: notSeen ? 'rgba(245,158,11,0.15)' : 'var(--eb-bg4)' }}>
                ⚠️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>
                  {w.reason}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                  {new Date(w.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {notSeen && <span className="ml-2 font-semibold" style={{ color: '#f59e0b' }}>● Nowe</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasReply && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    Wyjaśniono
                  </span>
                )}
                <svg className="opacity-40 transition-transform" width="12" height="12"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>

            {}
            {isOpen && (
              <div className="px-4 pb-4 pt-0 flex flex-col gap-3 border-t"
                style={{ borderColor: 'var(--eb-border)' }}>

                {}
                <div className="mt-3 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: '#f59e0b' }}>Powód od twórcy platformy</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text1)' }}>
                    {w.reason}
                  </p>
                </div>

                {}
                {hasReply && (
                  <div className="px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: '#22c55e' }}>
                      Twoje wyjaśnienie
                      {w.reply_at && (
                        <span className="ml-2 font-normal" style={{ color: 'var(--eb-text3)' }}>
                          · {new Date(w.reply_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text1)' }}>
                      {w.user_reply}
                    </p>
                  </div>
                )}

                {}
                {!hasReply && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block"
                      style={{ color: 'var(--eb-text3)' }}>
                      {sent[w.id] ? 'Wyjaśnienie wysłane' : 'Napisz wyjaśnienie'}
                    </label>
                    {sent[w.id] ? (
                      <div className="px-3 py-2 rounded-xl text-xs font-semibold text-center"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                        ✓ Wysłano — twórca zapozna się z wyjaśnieniem
                      </div>
                    ) : (
                      <>
                        <textarea
                          value={replies[w.id] ?? ''}
                          onChange={e => setReplies(p => ({ ...p, [w.id]: e.target.value }))}
                          rows={4}
                          maxLength={2000}
                          placeholder="Wyjaśnij swoją sytuację — twórca platformy zapozna się z Twoją odpowiedzią..."
                          className="ember-input w-full px-3 py-2.5 text-sm resize-none mb-2"
                        />
                        {errors[w.id] && (
                          <p className="text-xs mb-2" style={{ color: 'var(--eb-accent2)' }}>{errors[w.id]}</p>
                        )}
                        <button
                          onClick={() => sendReply(w)}
                          disabled={sending === w.id || !(replies[w.id] ?? '').trim()}
                          className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: 'rgba(245,158,11,0.12)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            opacity: (sending === w.id || !(replies[w.id] ?? '').trim()) ? 0.5 : 1,
                          }}>
                          {sending === w.id ? 'Wysyłanie...' : 'Wyślij wyjaśnienie'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ServerSelect({ servers, value, onChange }: { servers: any[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const selected = servers.find(s => s.id === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="ember-input w-full px-3 py-2.5 text-sm text-left flex items-center gap-2"
        style={{ cursor: 'pointer', color: selected ? 'var(--eb-text1)' : 'var(--eb-text3)' }}>
        {selected ? (
          <>
            {selected.icon_url ? (
              <img src={selected.icon_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: selected.icon_color ?? '#6366f1' }}>
                {selected.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 truncate">— Nie dotyczy konkretnego serwera —</span>
        )}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl z-20 flex flex-col overflow-hidden"
          style={{
            background: 'var(--eb-bg4)',
            border: '1px solid var(--eb-border2)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
            maxHeight: 220,
            overflowY: 'auto',
          }}>
          {}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full px-3 py-2.5 text-sm text-left transition-all flex items-center"
            style={{ color: 'var(--eb-text3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--eb-bg3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            — Nie dotyczy konkretnego serwera —
          </button>
          <div style={{ height: 1, background: 'var(--eb-border)', margin: '0 8px' }} />
          {servers.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange(s.id); setOpen(false) }}
              className="w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 transition-all"
              style={{
                background: value === s.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: 'var(--eb-text1)',
              }}
              onMouseEnter={e => { if (value !== s.id) e.currentTarget.style.background = 'var(--eb-bg3)' }}
              onMouseLeave={e => { if (value !== s.id) e.currentTarget.style.background = 'transparent' }}>
              {s.icon_url ? (
                <img src={s.icon_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: s.icon_color ?? '#6366f1' }}>
                  {s.name?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="flex-1 truncate text-xs">{s.name}</span>
              {value === s.id && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NewTicketForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const t = useT()
  const CATS = [
    { value: 'bug',      label: t('tickets.cat.bug'),      icon: '🐛' },
    { value: 'abuse',    label: t('tickets.cat.abuse'),    icon: '🚨' },
    { value: 'security', label: t('tickets.cat.security'), icon: '🔒' },
    { value: 'spam',     label: t('tickets.cat.spam'),     icon: '📢' },
    { value: 'other',    label: t('tickets.cat.other'),    icon: '💬' },
  ]
  const [category,   setCategory]   = useState('bug')
  const [subject,    setSubject]    = useState('')
  const [desc,       setDesc]       = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [imgLoading, setImgLoading] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [sent,       setSent]       = useState(false)
  const [servers,    setServers]    = useState<any[]>([])
  const [serverId,   setServerId]   = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${BASE}/api/servers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setServers(d.servers ?? [])).catch(() => {})
  }, [token])

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Dozwolone tylko obrazy (PNG, JPG, WebP)'); return }
    if (file.size > 10_000_000) { setError('Plik za duży (maks. 10 MB przed kompresją)'); return }
    setImgLoading(true); setError('')
    try { setScreenshot(await compressImage(file)) }
    catch { setError('Nie udało się wczytać obrazu') }
    finally { setImgLoading(false) }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ''
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) handleFile(file)
  }

  async function submit() {
    if (!subject.trim() || !desc.trim()) { setError('Wypełnij wszystkie pola'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, subject, description: desc, screenshot, server_id: serverId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd'); return }
      setSent(true)
      setTimeout(() => { setSent(false); setSubject(''); setDesc(''); setCategory('bug'); setScreenshot(null); setServerId(''); onCreated() }, 1800)
    } catch { setError('Błąd serwera') }
    finally { setLoading(false) }
  }

  if (sent) return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
        style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>✓</div>
      <p className="font-semibold text-sm" style={{ color: 'var(--eb-online)' }}>Zgłoszenie wysłane!</p>
      <p className="text-xs text-center" style={{ color: 'var(--eb-text3)' }}>Twórca platformy zajmie się nim wkrótce.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide mb-2 block"
          style={{ color: 'var(--eb-text2)' }}>{t('tickets.category')}</label>
        <div className="grid grid-cols-2 gap-2">
          {CATS.map(c => (
            <button key={c.value} onClick={() => setCategory(c.value)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all"
              style={{
                background: category === c.value ? 'rgba(220,38,38,0.1)' : 'var(--eb-bg3)',
                border: `1px solid ${category === c.value ? 'rgba(220,38,38,0.4)' : 'var(--eb-border)'}`,
                color: category === c.value ? 'var(--eb-accent)' : 'var(--eb-text2)',
              }}>
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
          style={{ color: 'var(--eb-text2)' }}>{t('tickets.subject')}</label>
        <input value={subject} onChange={e => setSubject(e.target.value)}
          placeholder={t('tickets.subjectPlaceholder')} maxLength={200}
          className="ember-input w-full px-3 py-2.5 text-sm" />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
          style={{ color: 'var(--eb-text2)' }}>{t('tickets.description')}</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder={t('tickets.descriptionPlaceholder')}
          rows={5} className="ember-input w-full px-3 py-2.5 text-sm resize-none" />
      </div>

      {}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
          style={{ color: 'var(--eb-text2)' }}>
          {t('tickets.server')}
        </label>
        {servers.length > 0 ? (
          <ServerSelect servers={servers} value={serverId} onChange={setServerId} />
        ) : (
          <p className="text-xs px-3 py-2 rounded-xl"
            style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
            Nie jesteś jeszcze na żadnym serwerze
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block"
          style={{ color: 'var(--eb-text2)' }}>
          {t('tickets.screenshot')}
        </label>
        {screenshot ? (
          <div className="relative rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--eb-border)' }}>
            <img src={screenshot} alt="screenshot" className="w-full object-contain max-h-48" style={{ background: '#000' }} />
            <button onClick={() => setScreenshot(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ) : (
          <div onClick={() => fileRef.current?.click()} onDrop={onDrop} onDragOver={e => e.preventDefault()}
            className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all py-5"
            style={{ border: '1.5px dashed var(--eb-border2)', background: 'var(--eb-bg3)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(220,38,38,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--eb-border2)')}>
            {imgLoading ? <Spinner /> : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Kliknij lub przeciągnij obraz tutaj</p>
                <p className="text-[10px]" style={{ color: 'var(--eb-text3)', opacity: 0.6 }}>PNG, JPG, WebP · maks. 10 MB</p>
              </>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}

      <button onClick={submit} disabled={loading || !subject.trim() || !desc.trim()}
        className="ember-btn py-2.5 text-sm font-semibold w-full"
        style={{ opacity: (!subject.trim() || !desc.trim()) ? 0.5 : 1 }}>
        {loading ? t('tickets.submitting') : t('tickets.submit')}
      </button>
      <p className="text-[10px] text-center" style={{ color: 'var(--eb-text3)' }}>
        Zgłoszenie trafi bezpośrednio do twórcy platformy. Twoje dane są bezpieczne.
      </p>
    </div>
  )
}

function MyTickets({ token }: { token: string }) {
  const [tickets,  setTickets]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE}/api/tickets/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setTickets(d.tickets ?? []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (tickets.length === 0) return (
    <div className="flex flex-col items-center py-10 gap-2">
      <span className="text-3xl">📭</span>
      <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>Nie masz jeszcze żadnych zgłoszeń</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      {tickets.map(t => (
        <div key={t.id} className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--eb-border)', background: 'var(--eb-bg3)' }}>
          <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left">
            <span className="text-base">{CATEGORIES.find(c => c.value === t.category)?.icon ?? '💬'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>{t.subject}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                {new Date(t.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <StatusBadge status={t.status} />
            <svg className="opacity-40 flex-shrink-0 transition-transform" width="12" height="12"
              style={{ transform: expanded === t.id ? 'rotate(180deg)' : 'none' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {expanded === t.id && (
            <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: 'var(--eb-border)' }}>
              <p className="text-xs mt-3 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text2)' }}>
                {t.description}
              </p>
              {t.screenshot && (
                <a href={t.screenshot} target="_blank" rel="noopener noreferrer" className="block mt-3">
                  <img src={t.screenshot} alt="zrzut" className="rounded-lg w-full object-contain max-h-48 cursor-zoom-in"
                    style={{ border: '1px solid var(--eb-border)', background: '#000' }} />
                </a>
              )}
              {t.admin_reply && (
                <div className="mt-3 px-3 py-2.5 rounded-lg"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--eb-online)' }}>Odpowiedź twórcy</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text1)' }}>{t.admin_reply}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TicketsAdmin({ token, isCreator = true }: { token: string; isCreator?: boolean }) {
  const [tickets,  setTickets]  = useState<any[]>([])
  const [filter,   setFilter]   = useState('open')
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [reply,    setReply]    = useState('')
  const [status,   setStatus]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [action,   setAction]   = useState<{ type: 'ban' | 'warn' | 'unban' | 'platform_ban'; user: any } | null>(null)
  const [ghost,    setGhost]    = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`${BASE}/api/tickets?status=${filter}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setTickets(d.tickets ?? []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [token, filter])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`${BASE}/api/tickets/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...(status ? { status } : {}), ...(reply.trim() ? { admin_reply: reply.trim() } : {}) }),
      })
      const data = await res.json()
      if (res.ok) { setSelected(data.ticket); setReply(''); setStatus(''); load() }
    } finally { setSaving(false) }
  }

  const filterBtns = ['open', 'in_progress', 'resolved', 'closed']

  return (
    <>
      {ghost && <GhostViewer token={token} serverId={ghost} onClose={() => setGhost(null)} />}
      {action && action.type === 'platform_ban' ? (
        <PlatformBanModal user={action.user} token={token}
          onDone={() => { setAction(null); load() }} onClose={() => setAction(null)} />
      ) : action ? (
        <ActionModal type={action.type as any} user={action.user} token={token}
          onDone={() => { setAction(null); load() }} onClose={() => setAction(null)} />
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {filterBtns.map(f => {
            const m = STATUS_META[f]
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: filter === f ? m.bg : 'var(--eb-bg3)',
                  color: filter === f ? m.color : 'var(--eb-text3)',
                  border: `1px solid ${filter === f ? m.color + '44' : 'var(--eb-border)'}`,
                }}>
                {m.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : tickets.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--eb-text3)' }}>Brak zgłoszeń</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tickets.map(t => (
              <div key={t.id}>
                <button
                  onClick={() => { setSelected(selected?.id === t.id ? null : t); setReply(t.admin_reply ?? ''); setStatus(t.status) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    background: selected?.id === t.id ? 'var(--eb-bg4)' : 'var(--eb-bg3)',
                    border: `1px solid ${selected?.id === t.id ? 'var(--eb-border2)' : 'var(--eb-border)'}`,
                  }}>
                  <span>{CATEGORIES.find(c => c.value === t.category)?.icon ?? '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>{t.subject}</div>
                    <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--eb-text3)' }}>
                      <Avatar user={t} size={14} />
                      {t.display_name} · {new Date(t.created_at).toLocaleDateString('pl-PL')}
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </button>

                {selected?.id === t.id && (
                  <div className="mx-1 mb-2 px-4 py-4 rounded-b-xl flex flex-col gap-3"
                    style={{ background: 'var(--eb-bg4)', border: '1px solid var(--eb-border2)', borderTop: 'none' }}>

                    {}
                    {t.message_id && t.message_content && (
                      <div className="px-3 py-2.5 rounded-xl flex flex-col gap-1"
                        style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold" style={{ color: '#ef4444' }}>
                            🚩 Zgłoszona wiadomość
                            {t.message_author_name && (
                              <span className="ml-1 font-normal" style={{ color: 'var(--eb-text3)' }}>od {t.message_author_name}</span>
                            )}
                          </p>
                          {t.server_id && (
                            <button
                              onClick={() => setGhost(t.server_id)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-all"
                              style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
                              👻 Ghost
                            </button>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words"
                          style={{ color: 'var(--eb-text1)', maxHeight: 80, overflow: 'hidden' }}>
                          {t.message_content}
                        </p>
                        {t.channel_id && (
                          <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                            Kanał: {t.channel_id}
                          </p>
                        )}
                      </div>
                    )}

                    {}
                    {t.server_id && !t.message_id && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: t.server_icon_color ?? '#6366f1' }}>
                          {t.server_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>
                            {t.server_name ?? 'Serwer'}
                          </span>
                          <span className="text-[10px] ml-1.5" style={{ color: 'var(--eb-text3)' }}>
                            ID: {t.server_id}
                          </span>
                        </div>
                        <button
                          onClick={() => setGhost(t.server_id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all"
                          style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
                          👻 Ghost
                        </button>
                      </div>
                    )}

                    {}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text2)' }}>
                      {t.description}
                    </p>
                    {t.screenshot && (
                      <a href={t.screenshot} target="_blank" rel="noopener noreferrer">
                        <img src={t.screenshot} alt="zrzut"
                          className="rounded-lg w-full object-contain max-h-56 cursor-zoom-in"
                          style={{ border: '1px solid var(--eb-border)', background: '#000' }} />
                      </a>
                    )}

                    {}
                    <div className="flex flex-wrap gap-2 pt-1 pb-1"
                      style={{ borderTop: '1px solid var(--eb-border)', paddingTop: 10 }}>
                      <span className="text-[10px] font-semibold uppercase tracking-wide self-center"
                        style={{ color: 'var(--eb-text3)' }}>Akcje:</span>
                      <button
                        onClick={() => setAction({ type: 'warn', user: { user_id: t.user_id, display_name: t.display_name, avatar_color: t.avatar_color, avatar_url: t.avatar_url } })}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                        ⚠️ Ostrzeż
                      </button>
                      <button
                        onClick={() => setAction({ type: 'ban', user: { user_id: t.user_id, display_name: t.display_name, avatar_color: t.avatar_color, avatar_url: t.avatar_url } })}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                        🔨 Zbanuj serwer
                      </button>
                      <button
                        onClick={() => setAction({ type: 'platform_ban', user: { user_id: t.user_id, display_name: t.display_name, avatar_color: t.avatar_color, avatar_url: t.avatar_url } })}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                        🚫 Ban platforma
                      </button>
                    </div>

                    {}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: 'var(--eb-text3)' }}>Status</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {filterBtns.map(f => {
                          const m = STATUS_META[f]
                          return (
                            <button key={f} onClick={() => setStatus(f)}
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
                              style={{
                                background: status === f ? m.bg : 'var(--eb-bg3)',
                                color: status === f ? m.color : 'var(--eb-text3)',
                                border: `1px solid ${status === f ? m.color + '44' : 'var(--eb-border)'}`,
                              }}>
                              {m.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: 'var(--eb-text3)' }}>Odpowiedź dla użytkownika</label>
                      <textarea value={reply} onChange={e => setReply(e.target.value)}
                        rows={3} placeholder="Napisz odpowiedź..."
                        className="ember-input w-full px-3 py-2 text-xs resize-none" />
                    </div>

                    <button onClick={save} disabled={saving} className="ember-btn px-4 py-2 text-xs font-semibold self-start">
                      {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function WarningRepliesAdmin({ token }: { token: string }) {
  const [replies,  setReplies]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [action,   setAction]   = useState<{ type: 'ban' | 'warn' | 'unban'; user: any } | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${BASE}/api/admin/warning-replies`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setReplies(d.replies ?? []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [token])

  return (
    <>
      {action && (
        <ActionModal type={action.type} user={action.user} token={token}
          onDone={() => { setAction(null) }} onClose={() => setAction(null)} />
      )}

      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : replies.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <span className="text-3xl">📭</span>
            <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>Brak odpowiedzi na ostrzeżenia</p>
          </div>
        ) : replies.map((w: any) => {
          const isOpen = expanded === w.id
          return (
            <div key={w.id} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isOpen ? 'var(--eb-border2)' : 'var(--eb-border)'}` }}>

              {}
              <button
                onClick={() => setExpanded(isOpen ? null : w.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                style={{ background: isOpen ? 'var(--eb-bg4)' : 'var(--eb-bg3)' }}>
                <Avatar user={w} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>
                      {w.display_name}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>@{w.username}</span>
                  </div>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                    Ostrzeżenie: {w.reason}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    Odpowiedź
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                    {w.reply_at ? new Date(w.reply_at).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' }) : ''}
                  </span>
                </div>
                <svg className="opacity-40 flex-shrink-0 ml-1 transition-transform" width="12" height="12"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {}
              {isOpen && (
                <div className="px-4 pb-4 pt-3 flex flex-col gap-3 border-t"
                  style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg4)' }}>

                  {}
                  <div className="px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: '#f59e0b' }}>
                      Powód ostrzeżenia
                      <span className="ml-2 font-normal" style={{ color: 'var(--eb-text3)' }}>
                        · {new Date(w.created_at).toLocaleDateString('pl-PL')}
                      </span>
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text1)' }}>
                      {w.reason}
                    </p>
                  </div>

                  {}
                  <div className="px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <p className="text-[10px] font-semibold mb-1" style={{ color: '#22c55e' }}>
                      Wyjaśnienie użytkownika
                      <span className="ml-2 font-normal" style={{ color: 'var(--eb-text3)' }}>
                        · {w.reply_at ? new Date(w.reply_at).toLocaleString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text1)' }}>
                      {w.user_reply}
                    </p>
                  </div>

                  {}
                  <div className="flex gap-2 pt-1 flex-wrap"
                    style={{ borderTop: '1px solid var(--eb-border)' }}>
                    <span className="text-[10px] font-semibold self-center"
                      style={{ color: 'var(--eb-text3)' }}>Akcje:</span>
                    <button
                      onClick={() => setAction({ type: 'warn', user: { user_id: w.user_id, display_name: w.display_name, avatar_color: w.avatar_color, avatar_url: w.avatar_url } })}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                      ⚠️ Kolejne ostrzeżenie
                    </button>
                    <button
                      onClick={() => setAction({ type: 'ban', user: { user_id: w.user_id, display_name: w.display_name, avatar_color: w.avatar_color, avatar_url: w.avatar_url } })}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                      🔨 Zbanuj
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`${BASE}/api/admin/warnings/${w.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        })
                        setReplies(prev => prev.filter((r: any) => r.id !== w.id))
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ml-auto"
                      style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text3)', border: '1px solid var(--eb-border)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--eb-text1)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--eb-text3)' }}>
                      🗑 Usuń
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function UsersAdmin({ token }: { token: string }) {
  const [query,       setQuery]       = useState('')
  const [users,       setUsers]       = useState<any[]>([])
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState<any | null>(null)
  const [detail,      setDetail]      = useState<any | null>(null)
  const [detLoad,     setDetLoad]     = useState(false)
  const [userServers, setUserServers] = useState<any[]>([])
  const [copied,      setCopied]      = useState<string | null>(null)
  const [action,      setAction]      = useState<{ type: 'ban' | 'warn' | 'unban'; user: any } | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setUsers([]); return }
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/admin/users/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      setUsers(d.users ?? [])
    } catch {} finally { setLoading(false) }
  }, [token])

  useEffect(() => {
    const t = setTimeout(() => search(query), 350)
    return () => clearTimeout(t)
  }, [query, search])

  async function loadDetail(userId: string) {
    setDetLoad(true)
    setUserServers([])
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${BASE}/api/admin/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/admin/users/${userId}/servers`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [d1, d2] = await Promise.all([r1.json(), r2.json()])
      setDetail(d1)
      setUserServers(d2.servers ?? [])
    } catch {} finally { setDetLoad(false) }
  }

  async function removeWarning(warnId: string) {
    await fetch(`${BASE}/api/admin/warnings/${warnId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (selected) loadDetail(selected.id)
  }

  return (
    <>
      {action && (
        <ActionModal
          type={action.type}
          user={action.user}
          token={token}
          onDone={() => { setAction(null); if (selected) loadDetail(selected.id); search(query) }}
          onClose={() => setAction(null)} />
      )}

      <div className="flex flex-col gap-3">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Szukaj po nazwie, username lub emailu..."
          className="ember-input w-full px-3 py-2 text-sm" />

        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : users.length > 0 ? (
          <div className="flex flex-col gap-1">
            {users.map(u => (
              <button key={u.id}
                onClick={() => { setSelected(u); loadDetail(u.id) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: selected?.id === u.id ? 'var(--eb-bg4)' : 'var(--eb-bg3)',
                  border: `1px solid ${selected?.id === u.id ? 'var(--eb-border2)' : 'var(--eb-border)'}`,
                }}>
                <Avatar user={u} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>{u.display_name}</span>
                    <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>@{u.username}</span>
                    {u.is_banned > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>ZBANOWANY</span>
                    )}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                    {u.email} · {u.warning_count} ostrzeżeń
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : query.trim() ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--eb-text3)' }}>Nie znaleziono użytkowników</p>
        ) : null}

        {}
        {selected && (
          <div className="rounded-xl p-4 flex flex-col gap-3 mt-1"
            style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border2)' }}>
            <div className="flex items-center gap-3">
              <Avatar user={selected} size={40} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>{selected.display_name}</p>
                <p className="text-[11px]" style={{ color: 'var(--eb-text3)' }}>@{selected.username} · {selected.email}</p>
              </div>
            </div>

            {}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setAction({ type: 'warn', user: selected })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                ⚠️ Ostrzeż
              </button>
              {selected.is_banned > 0 ? (
                <button
                  onClick={() => setAction({ type: 'unban', user: selected })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                  ✅ Odbanuj
                </button>
              ) : (
                <button
                  onClick={() => setAction({ type: 'ban', user: selected })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                  🔨 Zbanuj
                </button>
              )}
            </div>

            {detLoad ? (
              <div className="flex justify-center py-3"><Spinner /></div>
            ) : detail ? (
              <>
                {}
                {detail.bans?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--eb-text3)' }}>Aktywne bany</p>
                    {detail.bans.map((b: any) => (
                      <div key={b.id} className="text-xs px-3 py-2 rounded-lg mb-1"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <span style={{ color: '#ef4444' }}>{b.reason}</span>
                        {b.expires_at && (
                          <span className="ml-2" style={{ color: 'var(--eb-text3)' }}>
                            do {new Date(b.expires_at).toLocaleDateString('pl-PL')}
                          </span>
                        )}
                        {!b.expires_at && <span className="ml-2" style={{ color: 'var(--eb-text3)' }}>permanentny</span>}
                      </div>
                    ))}
                  </div>
                )}

                {}
                {detail.warnings?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--eb-text3)' }}>Ostrzeżenia ({detail.warnings.length})</p>
                    {detail.warnings.map((w: any) => (
                      <div key={w.id} className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg mb-1"
                        style={{ background: 'rgba(245,158,11,0.08)', border: `1px solid ${w.user_reply ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.2)'}` }}>
                        <div className="flex-1">
                          <span style={{ color: '#f59e0b' }}>{w.reason}</span>
                          <span className="ml-2 text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                            {new Date(w.created_at).toLocaleDateString('pl-PL')}
                          </span>
                          {w.user_reply && (
                            <span className="ml-2 text-[10px] font-semibold" style={{ color: '#22c55e' }}>
                              ● Wyjaśniono
                            </span>
                          )}
                        </div>
                        <button onClick={() => removeWarning(w.id)}
                          className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
                          style={{ color: 'var(--eb-text3)' }} title="Usuń ostrzeżenie">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {}
                {userServers.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--eb-text3)' }}>Serwery ({userServers.length})</p>
                    <div className="flex flex-col gap-1">
                      {userServers.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                          style={{ background: 'var(--eb-bg4)', border: '1px solid var(--eb-border)' }}>
                          {s.icon_url ? (
                            <img src={s.icon_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ background: s.icon_color ?? '#6366f1' }}>
                              {s.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>{s.name}</p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--eb-text3)' }}>wł. {s.owner_name}</p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(s.id)
                              setCopied(s.id)
                              setTimeout(() => setCopied(null), 1800)
                            }}
                            className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg font-semibold transition-all"
                            style={{
                              background: copied === s.id ? 'rgba(34,197,94,0.12)' : 'var(--eb-bg3)',
                              color: copied === s.id ? '#22c55e' : 'var(--eb-text3)',
                              border: `1px solid ${copied === s.id ? 'rgba(34,197,94,0.3)' : 'var(--eb-border)'}`,
                            }}>
                            {copied === s.id ? '✓ Skopiowano' : 'Kopiuj ID'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.bans?.length === 0 && detail.warnings?.length === 0 && (
                  <p className="text-xs text-center py-2" style={{ color: 'var(--eb-text3)' }}>
                    Brak banów ani ostrzeżeń
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}

function DevManager({ token }: { token: string }) {
  const [users,    setUsers]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/admin/users/all`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      setUsers(d.users ?? [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token])

  async function toggleDev(userId: string, current: boolean) {
    setToggling(userId)
    try {
      await fetch(`${BASE}/api/admin/users/${userId}/dev`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isDev: !current }),
      })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_dev: !current ? 1 : 0 } : u))
    } catch {} finally { setToggling(null) }
  }

  const filtered = users.filter(u =>
    (u.display_name + u.username).toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(167,139,250,0.07))', border: '1px solid rgba(167,139,250,0.25)' }}>
        <span className="text-base">⚡</span>
        <div>
          <p className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>Zarządzanie odznaką Dev</p>
          <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
            {users.filter(u => !!u.is_dev).length} / {users.length} użytkowników ma odznakę
          </p>
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Szukaj użytkownika..."
        className="ember-input w-full px-3 py-2 text-sm"
      />

      <div className="flex flex-col gap-1.5">
        {filtered.map(u => {
          const isDev = !!u.is_dev
          return (
            <div key={u.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: isDev ? 'rgba(139,92,246,0.07)' : 'var(--eb-bg3)',
                border: `1px solid ${isDev ? 'rgba(167,139,250,0.3)' : 'var(--eb-border)'}`,
              }}>
              <Avatar user={u} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>{u.display_name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>@{u.username}</span>
                  {isDev && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(167,139,250,0.15))', color: '#c4b5fd', border: '0.5px solid rgba(167,139,250,0.4)' }}>
                      ⚡ Dev
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleDev(u.id, isDev)}
                disabled={toggling === u.id}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: isDev ? 'rgba(239,68,68,0.1)' : 'rgba(167,139,250,0.1)',
                  color: isDev ? '#ef4444' : '#c4b5fd',
                  border: `1px solid ${isDev ? 'rgba(239,68,68,0.3)' : 'rgba(167,139,250,0.3)'}`,
                  opacity: toggling === u.id ? 0.5 : 1,
                }}>
                {toggling === u.id ? '...' : isDev ? 'Odbierz' : 'Nadaj Dev'}
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: 'var(--eb-text3)' }}>Brak użytkowników</p>
        )}
      </div>
    </div>
  )
}

function ModManager({ token }: { token: string }) {
  const [users,    setUsers]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/admin/users/all`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      setUsers(d.users ?? [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token])

  async function toggleMod(userId: string, current: boolean) {
    setToggling(userId)
    try {
      await fetch(`${BASE}/api/admin/users/${userId}/mod`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isMod: !current }),
      })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_mod: !current ? 1 : 0 } : u))
    } catch {} finally { setToggling(null) }
  }

  const filtered = users.filter(u =>
    (u.display_name + u.username).toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <span className="text-base">🛡</span>
        <div>
          <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>Zarządzanie Moderatorami Aplikacji</p>
          <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
            {users.filter(u => !!u.is_mod).length} moderatorów · mogą przeglądać i odpowiadać na zgłoszenia
          </p>
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Szukaj użytkownika..."
        className="ember-input w-full px-3 py-2 text-sm"
      />

      <div className="flex flex-col gap-1.5">
        {filtered.map(u => {
          const isMod = !!u.is_mod
          return (
            <div key={u.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: isMod ? 'rgba(34,197,94,0.07)' : 'var(--eb-bg3)',
                border: `1px solid ${isMod ? 'rgba(34,197,94,0.3)' : 'var(--eb-border)'}`,
              }}>
              <Avatar user={u} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>{u.display_name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>@{u.username}</span>
                  {isMod && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '0.5px solid rgba(34,197,94,0.35)' }}>
                      🛡 Mod
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleMod(u.id, isMod)}
                disabled={toggling === u.id}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: isMod ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                  color: isMod ? '#ef4444' : '#4ade80',
                  border: `1px solid ${isMod ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  opacity: toggling === u.id ? 0.5 : 1,
                }}>
                {toggling === u.id ? '...' : isMod ? 'Odbierz' : 'Nadaj Mod'}
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: 'var(--eb-text3)' }}>Brak użytkowników</p>
        )}
      </div>
    </div>
  )
}

function GhostLauncher({ token }: { token: string }) {
  const [serverId, setServerId] = useState('')
  const [ghost,    setGhost]    = useState<string | null>(null)
  const [error,    setError]    = useState('')

  function launch() {
    const id = serverId.trim()
    if (!id) { setError('Wpisz ID serwera'); return }
    setError(''); setGhost(id)
  }

  return (
    <>
      {ghost && <GhostViewer token={token} serverId={ghost} onClose={() => setGhost(null)} />}
      <div className="flex flex-col gap-3">
        <div className="px-3 py-3 rounded-xl flex flex-col gap-2"
          style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <p className="text-xs font-semibold" style={{ color: '#a855f7' }}>
            👻 Tryb Ghost — niewidzialna inspekcja serwera
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--eb-text3)' }}>
            Wchodzisz na serwer bez dołączania. Twoja obecność nie jest nigdzie wyświetlana
            — nie pojawisz się na liście członków ani w historii wejść.
          </p>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block"
            style={{ color: 'var(--eb-text3)' }}>ID serwera</label>
          <div className="flex gap-2">
            <input value={serverId} onChange={e => setServerId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && launch()}
              placeholder="np. a1b2c3d4-e5f6-..."
              className="ember-input flex-1 px-3 py-2 text-xs" />
            <button onClick={launch}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0"
              style={{ background: '#a855f7' }}>
              Wejdź
            </button>
          </div>
          {error && <p className="text-xs mt-1" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}
        </div>

        <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
          ID serwera znajdziesz w zgłoszeniu lub w linku zaproszenia. Możesz też wyszukać serwer po nazwie
          w przyszłej wersji panelu.
        </p>
      </div>
    </>
  )
}

export function TicketsModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { token } = useStore()
  const [tab,       setTab]       = useState<'new' | 'my' | 'warnings' | 'tickets' | 'warnreply' | 'users' | 'ghost' | 'dev' | 'mods'>('new')
  const [isCreator, setIsCreator] = useState(false)
  const [isMod,     setIsMod]     = useState(false)
  const [myCount,   setMyCount]   = useState(0)
  const [warnCount, setWarnCount] = useState(0)

  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/api/tickets/creator-check`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.isCreator) setIsCreator(true)
        if (d.isMod) setIsMod(true)
      }).catch(() => {})
    fetch(`${BASE}/api/tickets/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMyCount(d.tickets?.length ?? 0)).catch(() => {})
    fetch(`${BASE}/api/user/warnings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setWarnCount(d.warnings?.length ?? 0)).catch(() => {})
  }, [token])

  const userTabs = [
    { key: 'new',      label: t('tickets.tabNew') },
    { key: 'my',       label: `${t('tickets.tabMine')}${myCount > 0 ? ` (${myCount})` : ''}` },
    { key: 'warnings', label: warnCount > 0 ? `⚠️ ${t('tickets.tabWarnings')} (${warnCount})` : t('tickets.tabWarnings') },
  ] as const

  const adminTabs = [
    { key: 'tickets',  label: `📋 ${t('tickets.tabSubmissions')}` },
    { key: 'warnreply',label: `💬 ${t('tickets.tabReplies')}` },
    { key: 'users',    label: `👤 ${t('tickets.tabUsers')}` },
    { key: 'ghost',    label: `👻 ${t('tickets.tabGhost')}` },
    { key: 'dev',      label: `⚡ Dev` },
    { key: 'mods',     label: `🛡 Mody` },
  ] as const

  const modTabs = [
    { key: 'tickets',  label: `📋 Zgłoszenia` },
    { key: 'warnreply',label: `💬 Odpowiedzi` },
    { key: 'ghost',    label: `👻 Ghost` },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl w-full flex flex-col" style={{
        maxWidth: 500, maxHeight: '88vh',
        background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)',
      }}>
        {}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--eb-text1)' }}>{t('tickets.title')}</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>
              {t('tickets.subtitle')}
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--eb-text1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text3)')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {}
        <div className="flex gap-1 px-6 pb-2 flex-shrink-0">
          {userTabs.map(tab_ => (
            <button key={tab_.key} onClick={() => setTab(tab_.key as any)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: tab === tab_.key ? 'var(--eb-bg4)' : 'transparent',
                color: tab === tab_.key ? 'var(--eb-text1)' : 'var(--eb-text3)',
              }}>
              {tab_.label}
            </button>
          ))}
        </div>

        {}
        {isCreator && (
          <div className="flex gap-1 px-6 pb-3 flex-shrink-0 flex-wrap" style={{ borderBottom: '0.5px solid var(--eb-border)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest self-center mr-1"
              style={{ color: '#a855f7' }}>CREATOR</div>
            {adminTabs.map(tab_ => (
              <button key={tab_.key} onClick={() => setTab(tab_.key as any)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tab === tab_.key ? 'rgba(168,85,247,0.12)' : 'transparent',
                  color: tab === tab_.key ? '#a855f7' : 'var(--eb-text3)',
                }}>
                {tab_.label}
              </button>
            ))}
          </div>
        )}
        {!isCreator && isMod && (
          <div className="flex gap-1 px-6 pb-3 flex-shrink-0" style={{ borderBottom: '0.5px solid var(--eb-border)' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest self-center mr-1"
              style={{ color: '#4ade80' }}>MOD</div>
            {modTabs.map(tab_ => (
              <button key={tab_.key} onClick={() => setTab(tab_.key as any)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tab === tab_.key ? 'rgba(34,197,94,0.1)' : 'transparent',
                  color: tab === tab_.key ? '#4ade80' : 'var(--eb-text3)',
                }}>
                {tab_.label}
              </button>
            ))}
          </div>
        )}
        {!isCreator && !isMod && <div className="flex-shrink-0" style={{ borderBottom: '0.5px solid var(--eb-border)' }} />}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'new'       && <NewTicketForm token={token!} onCreated={() => setTab('my')} />}
          {tab === 'my'        && <MyTickets token={token!} />}
          {tab === 'warnings'  && <MyWarnings token={token!} />}
          {tab === 'tickets'   && (isCreator || isMod) && <TicketsAdmin token={token!} isCreator={isCreator} />}
          {tab === 'warnreply' && (isCreator || isMod) && <WarningRepliesAdmin token={token!} />}
          {tab === 'users'     && isCreator && <UsersAdmin token={token!} />}
          {tab === 'ghost'     && (isCreator || isMod) && <GhostLauncher token={token!} />}
          {tab === 'dev'       && isCreator && <DevManager token={token!} />}
          {tab === 'mods'      && isCreator && <ModManager token={token!} />}
        </div>
      </div>
    </div>
  )
}
