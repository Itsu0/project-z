'use client'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useSocket } from '@/hooks/useSocket'
import { UserSettings } from '@/components/settings/UserSettings'
import { useT } from '@/lib/i18n'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type NotifType = 'mention' | 'reply' | 'reaction'

interface Notification {
  id: string
  type: NotifType
  read_at: string | null
  created_at: string
  server_id: string
  channel_id: string
  message_id: string
  message_content: string
  author_name: string
  author_avatar_color: string
  author_avatar_url: string | null
  author_username: string
  server_name: string
  channel_name: string
  reply_to_id?: string
}

interface PatchEntry { type: string; pl: string; en: string }
interface PatchRelease { version: string; date: string; labelPl: string; labelEn: string; entries: PatchEntry[] }


const ENTRY_COLORS = {
  new: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  fix: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  imp: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

function PatchNotes() {
  const t = useT()
  const lang = useStore(s => s.userSettings.language ?? 'pl')
  const token = useStore(s => s.token)
  const [dynamicNotes, setDynamicNotes] = useState<any[]>([])

  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/api/admin/patch-notes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.notes) setDynamicNotes(d.notes) })
      .catch(() => {})
  }, [token])

  const labelMap = {
    new: t('notif.changelog.new'),
    fix: t('notif.changelog.fix'),
    imp: t('notif.changelog.imp'),
  }

  const allReleases: PatchRelease[] = dynamicNotes.map(n => ({
    version: n.version,
    date: n.date,
    labelPl: n.label_pl,
    labelEn: n.label_en,
    entries: n.entries,
  }))

  const ReleaseBlock = ({ release }: { release: PatchRelease }) => {
    const label = lang === 'en' ? release.labelEn : release.labelPl
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--eb-gradient)', color: '#fff' }}>
            v{release.version}
          </span>
          {label && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '0.5px solid rgba(34,197,94,0.3)' }}>
              {label}
            </span>
          )}
          <span className="text-[10px] ml-auto" style={{ color: 'var(--eb-text3)' }}>{release.date}</span>
        </div>
        <div className="flex flex-col gap-1.5 pl-1">
          {release.entries.map((entry, i) => {
            const meta = ENTRY_COLORS[entry.type as keyof typeof ENTRY_COLORS] ?? ENTRY_COLORS.new
            const text = lang === 'en' ? entry.en : entry.pl
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0"
                  style={{ background: meta.bg, color: meta.color }}>
                  {labelMap[entry.type as keyof typeof labelMap] ?? entry.type}
                </span>
                <span className="text-[11px] leading-snug" style={{ color: 'var(--eb-text2)' }}>
                  {text}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 h-px" style={{ background: 'var(--eb-border)' }} />
      </div>
    )
  }

  return (
    <div className="pt-2 flex flex-col gap-4">
      {allReleases.map((release, idx) => (
        <ReleaseBlock key={`${release.version}-${idx}`} release={release} />
      ))}
    </div>
  )
}

const NOTIF_COLORS: Record<NotifType, { color: string; icon: string }> = {
  mention:  { color: '#f87171', icon: '@' },
  reply:    { color: '#4a9eff', icon: '↩' },
  reaction: { color: '#f59e0b', icon: '😄' },
}

export function NotificationsPanelExpanded() {
  const t = useT()
  const { token, currentServerId } = useStore()
  const { currentUser } = useStore()
  const socket = useSocket()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'patchnotes'>('unread')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const STATUS_META: Record<string, { color: string; label: string }> = {
    online:  { color: '#22c55e', label: t('status.online') },
    idle:    { color: '#f59e0b', label: t('status.idle') },
    dnd:     { color: '#ef4444', label: t('status.dnd') },
    offline: { color: '#6b7280', label: t('status.offline') },
  }
  const status     = (currentUser?.status as string) ?? 'offline'
  const statusMeta = STATUS_META[status] ?? STATUS_META.offline
  const avatarColor = currentUser?.avatar_color ?? 'linear-gradient(135deg,#dc2626,#f59e0b)'
  const initial     = (currentUser?.display_name ?? '?').slice(0, 1).toUpperCase()

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setNotifs(data.notifications ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(load, 30000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(interval) }
  }, [load])

  useEffect(() => {
    if (!socket) return
    const handler = () => load()
    socket.on('NOTIFICATION', handler)
    return () => { socket.off('NOTIFICATION', handler) }
  }, [socket, load])

  const unreadCount = notifs.filter(n => !n.read_at).length
  const visible = activeTab === 'unread' ? notifs.filter(n => !n.read_at) : notifs

  async function markRead(id: string) {
    if (!token) return
    setNotifs(p => p.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await fetch(`${BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notifId: id }),
    })
  }

  function markReadAndSwitch(id: string) {
    markRead(id)
    setActiveTab('all')
  }

  async function markAllRead() {
    if (!token) return
    setNotifs(p => p.map(n => ({ ...n, read_at: new Date().toISOString() })))
    await fetch(`${BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
  }

  function deleteNotif(id: string) {
    setNotifs(p => p.filter(n => n.id !== id))
    fetch(`${BASE}/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }

  function deleteAllNotifs() {
    setNotifs([])
    fetch(`${BASE}/api/notifications`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }

  function sendReply(notif: Notification) {
    if (!replyText.trim()) return
    socket.sendMessage(notif.channel_id, notif.server_id, replyText.trim(), undefined, notif.message_id)
    setNotifs(p => p.filter(n => n.id !== notif.id))
    fetch(`${BASE}/api/notifications/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notifId: notif.id }),
    }).catch(() => {})
    setReplyingTo(null)
    setReplyText('')
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'teraz'
    if (diffMins < 60) return `${diffMins} min temu`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} godz temu`
    return d.toLocaleDateString('pl')
  }

  return (
    <div className="flex flex-col overflow-hidden"
      style={{ width: 280, background: 'var(--eb-bg1)', borderRight: '0.5px solid var(--eb-border)' }}>

      {}
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--eb-accent)" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>{t('notif.title')}</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ background: 'var(--eb-accent2)' }}>{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--eb-accent)' }}>
                {t('notif.markAllRead')}
              </button>
            )}
            {activeTab === 'all' && notifs.length > 0 && (
              <button onClick={deleteAllNotifs} className="text-[10px] transition-opacity hover:opacity-70"
                style={{ color: 'var(--eb-accent2)' }}>
                Usuń wszystkie
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {([['unread', t('notif.tabNew', { n: unreadCount })], ['all', t('notif.tabAll')], ['patchnotes', t('notif.tabChangelog')]] as [string, string][]).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className="flex-1 py-1 text-xs rounded-md font-medium transition-all duration-150"
              style={activeTab === tab
                ? { background: 'var(--eb-gradient)', color: '#fff' }
                : { color: 'var(--eb-text2)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {}
      {activeTab === 'patchnotes' && (
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <PatchNotes />
        </div>
      )}

      {}
      {activeTab !== 'patchnotes' && <div className="flex-1 overflow-y-auto px-2 pb-3">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--eb-text3)' }}>{activeTab === 'unread' ? t('notif.noNew') : t('notif.noAll')}</span>
          </div>
        )}

        {!loading && (activeTab === 'all' || activeTab === 'unread') && visible.map(notif => {
          const notifColors = NOTIF_COLORS[notif.type]
          const notifLabel = notif.type === 'mention' ? t('notif.mention') : notif.type === 'reply' ? t('notif.reply') : t('notif.reaction')
          const isReplying = replyingTo === notif.id
          const canReply = notif.type === 'mention' || notif.type === 'reply'

          return (
            <div key={notif.id}
              className="rounded-xl p-3 mb-2 transition-all duration-150"
              style={{
                background: notif.read_at ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                border: `0.5px solid ${notif.read_at ? 'var(--eb-border)' : 'rgba(255,255,255,0.1)'}`,
              }}>

              {}
              <div className="flex items-start gap-2.5 mb-2">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-xs"
                    style={{ background: notif.author_avatar_url ? 'transparent' : notif.author_avatar_color }}>
                    {notif.author_avatar_url
                      ? <img src={notif.author_avatar_url} alt="" className="w-full h-full object-cover" />
                      : notif.author_name.slice(0, 1)
                    }
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: notifColors.color, border: '1.5px solid var(--eb-bg1)', color: '#fff' }}>
                    {notifColors.icon}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>
                      {notif.author_name}
                    </span>
                    <span className="text-[9px] font-medium px-1.5 py-px rounded-full flex-shrink-0"
                      style={{ background: `${notifColors.color}22`, color: notifColors.color }}>
                      {notifLabel}
                    </span>
                    {!notif.read_at && (
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-auto"
                        style={{ background: 'var(--eb-accent)' }} />
                    )}
                  </div>
                  <div className="mb-1">
                    <span style={{ fontSize: 9, color: 'var(--eb-text3)' }}>
                      {notif.server_name} · #{notif.channel_name} · {formatTime(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--eb-text2)' }}>
                    {notif.message_content}
                  </p>
                </div>
              </div>

              {}
              {canReply && (
                <div onClick={e => e.stopPropagation()}>
                  {!isReplying ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); setReplyingTo(notif.id) }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex-1 justify-center"
                        style={{ background: 'var(--eb-surface)', color: 'var(--eb-accent)', border: '0.5px solid var(--eb-accent)' }}>
                        ↩ Szybka odpowiedź
                      </button>
                      {!notif.read_at && (
                        <button
                          onClick={e => { e.stopPropagation(); markReadAndSwitch(notif.id) }}
                          className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--eb-text3)', border: '0.5px solid var(--eb-border)' }}
                          title="Oznacz jako przeczytane">
                          ✓
                        </button>
                      )}
                      {activeTab === 'all' && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteNotif(notif.id) }}
                          className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                          style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.2)' }}
                          title="Usuń powiadomienie">
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="mb-1.5 px-2 py-1 rounded-md text-[10px]"
                        style={{ background: 'var(--eb-surface)', color: 'var(--eb-text2)', borderLeft: '2px solid var(--eb-accent)' }}>
                        Odpowiadasz w #{notif.channel_name}
                      </div>
                      <div className="flex gap-1.5">
                        <input autoFocus
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') sendReply(notif)
                            if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') }
                          }}
                          placeholder="Napisz odpowiedź..."
                          className="ember-input flex-1 px-2.5 py-1.5"
                          style={{ fontSize: 11 }}
                        />
                        <button onClick={() => sendReply(notif)} disabled={!replyText.trim()}
                          className="px-2.5 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            background: replyText.trim() ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.05)',
                            color: replyText.trim() ? '#fff' : 'var(--eb-text3)',
                          }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                          </svg>
                        </button>
                        <button onClick={() => { setReplyingTo(null); setReplyText('') }}
                          className="px-2 rounded-lg text-xs"
                          style={{ color: 'var(--eb-text3)', background: 'rgba(255,255,255,0.03)' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!canReply && activeTab === 'all' && (
                <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => { e.stopPropagation(); deleteNotif(notif.id) }}
                    className="px-2.5 py-1.5 rounded-lg text-xs transition-all"
                    style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.2)' }}
                    title="Usuń powiadomienie">
                    ✕
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>}

      {}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 border-t cursor-pointer transition-colors hover:bg-white/[0.04] group flex-shrink-0"
        style={{ background: 'var(--eb-bg0)', borderColor: 'var(--eb-border)' }}
        onClick={() => setShowSettings(true)}
        title="Ustawienia użytkownika"
      >
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm"
            style={{ background: currentUser?.avatar_url ? 'transparent' : avatarColor }}>
            {currentUser?.avatar_url
              ? <img src={currentUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              : initial
            }
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ background: statusMeta.color, borderColor: 'var(--eb-bg0)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate leading-tight" style={{ color: 'var(--eb-text1)' }}>
            {currentUser?.display_name ?? '...'}
          </div>
          <div className="text-[10px] font-medium mt-0.5" style={{ color: statusMeta.color }}>
            {statusMeta.label}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
      </div>

      {showSettings && <UserSettings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
