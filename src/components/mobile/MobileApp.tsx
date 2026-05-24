'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { useVoice } from '@/contexts/VoiceContext'
import { UserSettings } from '@/components/settings/UserSettings'

type Tab = 'chat' | 'friends' | 'notifications' | 'profile'

/* ─── Icons ─────────────────────────────────────────────────────── */
function IconChat({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.862 9.862 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}
function IconFriends({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function IconBell({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}
function IconUser({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}
function IconHash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  )
}
function IconVolume() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-3-3m3 3l3-3M9 9H5a1 1 0 00-1 1v4a1 1 0 001 1h4" />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}
function IconMic({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6m-.06.6v.34M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v3M8 23h8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3M8 23h8" />
    </svg>
  )
}
function IconDeafen({ deafened }: { deafened: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d={deafened
          ? "M5.586 5.586A9 9 0 0118.413 18.414M12 3C7.029 3 3 7.029 3 12a9 9 0 001.172 4.413M21 12a9 9 0 00-9-9M12 21a9 9 0 009-9M12 7v2m0 4v2"
          : "M9 19V13a3 3 0 00-3-3H5a3 3 0 00-3 3v1a3 3 0 003 3h1M15 19V13a3 3 0 013-3h1a3 3 0 013 3v1a3 3 0 01-3 3h-1M12 4a8 8 0 018 8M12 4a8 8 0 00-8 8"
        } />
    </svg>
  )
}
function IconLeave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

/* ─── Avatar helper ─────────────────────────────────────────────── */
function Avatar({ url, color, name, size = 34 }: { url?: string | null; color: string; name: string; size?: number }) {
  if (url) {
    return <img src={url} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', width: size, height: size }} />
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, color: '#fff', flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

/* ─── Chat screen ───────────────────────────────────────────────── */
function ChatScreen() {
  const { servers, channels, currentServerId, currentChannelId, setCurrentServer, setCurrentChannel } = useStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<{ id: string; author: string; text: string; color: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentServer = servers.find(s => s.id === currentServerId)
  const serverChannels = currentServerId ? (channels[currentServerId] ?? []) : []
  const currentChannel = serverChannels.find(c => c.id === currentChannelId)
  const textChannels = serverChannels.filter(c => c.type === 'text' || c.type === 'announcement')
  const voiceChannels = serverChannels.filter(c => c.type === 'voice')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage() {
    const trimmed = message.trim()
    if (!trimmed) return
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      author: 'Ty',
      text: trimmed,
      color: '#f59e0b',
    }])
    setMessage('')
  }

  const headerTitle = currentChannel
    ? `#${currentChannel.name}`
    : currentServer
      ? currentServer.name
      : 'Czaty'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="mobile-header">
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} style={{ width: 36, height: 36 }}>
          <IconMenu />
        </button>
        <span className="mobile-header-title">{headerTitle}</span>
      </div>

      {/* Messages */}
      <div className="mobile-messages" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {messages.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>
            {currentChannel
              ? `Początek kanału #${currentChannel.name}`
              : 'Wybierz serwer i kanał z menu po lewej'}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="mobile-message-row">
            <div style={{
              width: 34, height: 34, borderRadius: '50%', background: msg.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0,
            }}>
              {msg.author.charAt(0)}
            </div>
            <div className="mobile-message-content">
              <div className="mobile-message-name">{msg.author}</div>
              <div className="mobile-message-text">{msg.text}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="mobile-input-bar">
        <input
          className="mobile-input"
          placeholder={currentChannel ? `Wiadomość do #${currentChannel.name}` : 'Wybierz kanał...'}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          disabled={!currentChannel}
        />
        <button className="mobile-send-btn" onClick={sendMessage} disabled={!message.trim()}>
          <IconSend />
        </button>
      </div>

      {/* Drawer overlay */}
      <div
        className={`mobile-drawer-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer */}
      <div className={`mobile-drawer${drawerOpen ? ' open' : ''}`} style={{ flexDirection: 'row' }}>
        {/* Server rail */}
        <div className="mobile-server-list">
          {servers.map(srv => (
            <button
              key={srv.id}
              className={`mobile-server-icon${currentServerId === srv.id ? ' active' : ''}`}
              style={{ background: srv.icon_color || 'var(--eb-bg3)' }}
              onClick={() => setCurrentServer(srv.id)}
              title={srv.name}
            >
              {srv.icon_url
                ? <img src={srv.icon_url} alt={srv.name} width={36} height={36} style={{ borderRadius: 'inherit', objectFit: 'cover' }} />
                : srv.name.charAt(0).toUpperCase()
              }
            </button>
          ))}
        </div>

        {/* Channel list */}
        <div className="mobile-channel-list">
          {textChannels.length > 0 && (
            <div style={{ padding: '8px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tekstowe
            </div>
          )}
          {textChannels.map(ch => (
            <div
              key={ch.id}
              className={`mobile-channel-item${currentChannelId === ch.id ? ' active' : ''}`}
              onClick={() => { setCurrentChannel(ch.id); setDrawerOpen(false) }}
            >
              <IconHash />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ch.name}
              </span>
            </div>
          ))}
          {voiceChannels.length > 0 && (
            <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Głosowe
            </div>
          )}
          {voiceChannels.map(ch => (
            <div key={ch.id} className="mobile-channel-item">
              <IconVolume />
              <span>{ch.name}</span>
            </div>
          ))}
          {serverChannels.length === 0 && currentServerId && (
            <div style={{ padding: '24px 16px', color: 'var(--eb-text3)', fontSize: 13 }}>
              Brak kanałów
            </div>
          )}
          {!currentServerId && (
            <div style={{ padding: '24px 16px', color: 'var(--eb-text3)', fontSize: 13 }}>
              Wybierz serwer z lewej
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Voice screen ──────────────────────────────────────────────── */
function VoiceScreen() {
  const voice = useStore(s => s.voice)
  const { disconnect, toggleMute, toggleDeafen } = useVoice()
  const participants = voice.participants ?? []

  if (!voice.connected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="mobile-header">
          <span className="mobile-header-title">Kanał głosowy</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 32 }}>🎤</div>
          <div style={{ color: 'var(--eb-text3)', fontSize: 14 }}>Nie jesteś na żadnym kanale</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="mobile-header">
        <span className="mobile-header-title" style={{ fontSize: 13 }}>
          🔊 {voice.channelId || 'Kanał głosowy'}
        </span>
      </div>

      {/* Participants grid */}
      <div className="mobile-voice-grid" style={{ flex: 1, overflowY: 'auto' }}>
        {participants.map((p: any) => (
          <div key={p.userId} className={`mobile-voice-tile${p.speaking ? ' speaking' : ''}`}>
            <Avatar url={p.avatarUrl} color={p.avatarColor || '#f59e0b'} name={p.username || '?'} size={48} />
            <div style={{ fontSize: 12, color: 'var(--eb-text2)', fontWeight: 500, textAlign: 'center', padding: '0 4px' }}>
              {p.displayName || p.username}
            </div>
            {p.muted && <div style={{ fontSize: 10, color: 'var(--eb-accent2)' }}>🔇</div>}
          </div>
        ))}
        {participants.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13, padding: 24 }}>
            Tylko Ty jesteś na kanale
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mobile-voice-controls">
        <button className="mobile-voice-btn" onClick={toggleMute}>
          <div className={`mobile-voice-btn-icon${voice.muted ? ' active' : ''}`}>
            <IconMic muted={voice.muted} />
          </div>
          <span className="mobile-voice-btn-label">{voice.muted ? 'Włącz mic' : 'Wycisz'}</span>
        </button>

        <button className="mobile-voice-btn" onClick={toggleDeafen}>
          <div className={`mobile-voice-btn-icon${voice.deafened ? ' active' : ''}`}>
            <IconDeafen deafened={voice.deafened} />
          </div>
          <span className="mobile-voice-btn-label">{voice.deafened ? 'Odkłuchaj' : 'Głuchy'}</span>
        </button>

        <button className="mobile-voice-btn" onClick={disconnect}>
          <div className="mobile-voice-btn-icon danger">
            <IconLeave />
          </div>
          <span className="mobile-voice-btn-label">Rozłącz</span>
        </button>
      </div>
    </div>
  )
}

/* ─── Friends screen ────────────────────────────────────────────── */
function FriendsScreen() {
  const currentUser = useStore(s => s.currentUser)
  const members = useStore(s => s.members)
  const currentServerId = useStore(s => s.currentServerId)
  const serverMembers = currentServerId ? (members[currentServerId] ?? []) : []

  const online = serverMembers.filter(m => m.status === 'online')
  const offline = serverMembers.filter(m => m.status !== 'online')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="mobile-header">
        <span className="mobile-header-title">Znajomi</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {online.length > 0 && (
          <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Online — {online.length}
          </div>
        )}
        {online.map(m => (
          <div key={m.user_id} className="mobile-friend-item">
            <div style={{ position: 'relative' }}>
              <Avatar url={m.avatar_url} color={m.avatar_color} name={m.display_name || m.username} size={40} />
              <div className="status-ring online" style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--eb-online)', border: '2px solid var(--eb-bg1)' }} />
            </div>
            <div className="mobile-friend-info">
              <div className="mobile-friend-name">{m.display_name || m.username}</div>
              {m.custom_status && <div className="mobile-friend-status">{m.custom_status}</div>}
            </div>
          </div>
        ))}
        {offline.length > 0 && (
          <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 600, color: 'var(--eb-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Offline — {offline.length}
          </div>
        )}
        {offline.map(m => (
          <div key={m.user_id} className="mobile-friend-item">
            <div style={{ position: 'relative', opacity: 0.5 }}>
              <Avatar url={m.avatar_url} color={m.avatar_color} name={m.display_name || m.username} size={40} />
            </div>
            <div className="mobile-friend-info" style={{ opacity: 0.5 }}>
              <div className="mobile-friend-name">{m.display_name || m.username}</div>
            </div>
          </div>
        ))}
        {serverMembers.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--eb-text3)', fontSize: 13 }}>
            Wybierz serwer, by zobaczyć członków
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Profile screen ────────────────────────────────────────────── */
function ProfileScreen() {
  const [showSettings, setShowSettings] = useState(false)
  const currentUser = useStore(s => s.currentUser)

  if (showSettings) {
    return <UserSettings onClose={() => setShowSettings(false)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="mobile-header">
        <span className="mobile-header-title">Profil</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {currentUser && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 24, paddingBottom: 24 }}>
            <Avatar url={currentUser.avatar_url} color={currentUser.avatar_color} name={currentUser.display_name || currentUser.username} size={72} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--eb-text1)' }}>{currentUser.display_name || currentUser.username}</div>
              <div style={{ fontSize: 13, color: 'var(--eb-text3)' }}>@{currentUser.username}</div>
            </div>
            {currentUser.custom_status && (
              <div style={{ fontSize: 13, color: 'var(--eb-text2)', background: 'var(--eb-bg2)', borderRadius: 10, padding: '6px 14px' }}>
                {currentUser.custom_status}
              </div>
            )}
          </div>
        )}
        <button
          className="ember-btn"
          style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 14 }}
          onClick={() => setShowSettings(true)}
        >
          Ustawienia
        </button>
      </div>
    </div>
  )
}

/* ─── Main MobileApp ────────────────────────────────────────────── */
export function MobileApp() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const voice = useStore(s => s.voice)

  const tabs: { id: Tab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
    { id: 'chat',          label: 'Czaty',         Icon: IconChat },
    { id: 'friends',       label: 'Znajomi',        Icon: IconFriends },
    { id: 'notifications', label: 'Głos',           Icon: ({ active }) => <IconDeafen deafened={false} /> },
    { id: 'profile',       label: 'Profil',         Icon: IconUser },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--eb-bg0)', display: 'flex', flexDirection: 'column' }}>
      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'chat'          && <ChatScreen />}
        {activeTab === 'friends'       && <FriendsScreen />}
        {activeTab === 'notifications' && <VoiceScreen />}
        {activeTab === 'profile'       && <ProfileScreen />}
      </div>

      {/* Bottom navigation */}
      <nav className="mobile-bottom-nav">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`mobile-nav-item${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon active={activeTab === id} />
            <span>{label}</span>
            {id === 'notifications' && voice.connected && (
              <div style={{ position: 'absolute', top: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--eb-online)' }} />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
