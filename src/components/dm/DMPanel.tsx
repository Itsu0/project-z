'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, DmConversation, DmMessage } from '@/lib/store'
import { useSocket } from '@/hooks/useSocket'
import TextareaAutosize from 'react-textarea-autosize'
import { EmojiPicker } from '@/components/chat/EmojiPicker'
import { GifPicker } from '@/components/chat/ChatInput'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import {
  generateIdentity, publicKeyB64, generateRecoveryCode, randomSalt, deriveKey,
  sealSecretKey, openSecretKey, encryptMessage, decryptMessage,
  getSessionSecret, setSessionSecret,
} from '@/lib/e2e'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000 && d.getDate() === now.getDate())
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86400000)
    return d.toLocaleDateString('pl-PL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
}

function UserAvatar({ user, size = 36 }: { user: { avatar_url?: string | null; avatar_color: string; display_name: string }; size?: number }) {
  if (user.avatar_url && !user.avatar_url.startsWith('data:')) {
    return (
      <img src={user.avatar_url} alt="" width={size} height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    )
  }
  if (user.avatar_url?.startsWith('data:')) {
    return (
      <img src={user.avatar_url} alt="" width={size} height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    )
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white"
      style={{ width: size, height: size, background: user.avatar_color, fontSize: size * 0.38 }}>
      {(user.display_name ?? '?').charAt(0).toUpperCase()}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const c: Record<string, string> = { online: '#22c55e', idle: '#f59e0b', dnd: '#ef4444', offline: '#64748b' }
  return <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
    style={{ background: c[status] ?? c.offline, borderColor: 'var(--eb-bg1)' }} />
}

// ── Conversation list item ────────────────────────────────────────────────────

function ConvItem({ conv, active, unread, onClick }: {
  conv: DmConversation; active: boolean; unread: number; onClick: () => void
}) {
  const me = useStore(s => s.currentUser)
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
      style={{
        background: active ? 'var(--eb-bg3)' : 'transparent',
        border: active ? '1px solid var(--eb-border2)' : '1px solid transparent',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--eb-bg2)' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <div className="relative flex-shrink-0">
        <UserAvatar user={{ avatar_url: conv.avatar_url, avatar_color: conv.avatar_color, display_name: conv.display_name }} size={38} />
        <StatusDot status={conv.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--eb-text1)' }}>
            {conv.display_name}
          </span>
          {conv.last_msg_at && (
            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--eb-text4)' }}>
              {fmtTime(conv.last_msg_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <p className="text-xs truncate" style={{ color: unread > 0 ? 'var(--eb-text2)' : 'var(--eb-text4)' }}>
            {conv.last_content
              ? (conv.last_author_id === me?.id ? `Ty: ${conv.last_content}` : conv.last_content)
              : <span className="italic">Brak wiadomości</span>
            }
          </p>
          {unread > 0 && (
            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--eb-accent)', color: '#fff', minWidth: 18, textAlign: 'center' }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MsgBubble({ msg, isMe, showAvatar, onReact, onDelete }: {
  msg: DmMessage; isMe: boolean; showAvatar: boolean
  onReact: (msgId: string, emoji: string) => void
  onDelete: (msgId: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [emojiPicker, setEmojiPicker] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null)
  const isDeleted = !!msg.deleted_at
  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

  return (
    <div className={`flex gap-2.5 group ${isMe ? 'flex-row-reverse' : ''} mb-1`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setEmojiPicker(false) }}
    >
      {!isMe && (
        <div className="flex-shrink-0 mt-auto mb-0.5" style={{ width: 32, height: 32 }}>
          {showAvatar ? (
            <UserAvatar user={{ avatar_url: msg.author_avatar_url, avatar_color: msg.author_avatar_color, display_name: msg.author_display_name }} size={32} />
          ) : null}
        </div>
      )}
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[72%]`}>
        {showAvatar && !isMe && (
          <span className="text-xs font-medium mb-0.5 ml-1" style={{ color: 'var(--eb-text3)' }}>
            {msg.author_display_name}
          </span>
        )}
        <div className="relative">
          {(msg.content || isDeleted || !msg.attachments?.length) && (
            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${isDeleted ? 'opacity-50 italic' : ''}`}
              style={{
                background: isMe ? 'var(--eb-accent)' : 'var(--eb-bg3)',
                color: isMe ? '#fff' : 'var(--eb-text1)',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                maxWidth: '100%',
              }}>
              {msg.content}
              {msg.edited_at && !isDeleted && (
                <span className="text-[10px] ml-1 opacity-60">(edyt.)</span>
              )}
            </div>
          )}
          {/* Attachments */}
          {lightbox && (
            <ImageLightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />
          )}
          {!isDeleted && msg.attachments?.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              {msg.attachments.map(att => (
                att.contentType?.startsWith('image/') ? (
                  <img key={att.id} src={att.url} alt={att.filename}
                    className="rounded-xl max-w-[280px] max-h-[280px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ border: '1px solid var(--eb-border)' }}
                    onClick={() => setLightbox({ url: att.url, filename: att.filename })} />
                ) : (
                  <a key={att.id} href={att.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: 'var(--eb-bg2)', border: '1px solid var(--eb-border)', color: 'var(--eb-text2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {att.filename}
                    <span className="opacity-50 ml-auto">{(att.size / 1024).toFixed(0)} KB</span>
                  </a>
                )
              ))}
            </div>
          )}
          {/* Reactions */}
          {msg.reactions?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {msg.reactions.map(r => (
                <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all"
                  style={{
                    background: r.me ? 'rgba(var(--eb-accent-rgb),0.2)' : 'var(--eb-bg3)',
                    border: `1px solid ${r.me ? 'var(--eb-accent)' : 'var(--eb-border)'}`,
                    color: 'var(--eb-text2)',
                  }}>
                  {r.emoji} <span>{r.count}</span>
                </button>
              ))}
            </div>
          )}
          {/* Hover actions */}
          {hover && !isDeleted && (
            <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} flex gap-1 z-10`}>
              <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl shadow-lg"
                style={{ background: 'var(--eb-bg2)', border: '1px solid var(--eb-border2)' }}>
                {QUICK_EMOJIS.map(e => (
                  <button key={e} onClick={() => onReact(msg.id, e)}
                    className="text-sm hover:scale-125 transition-transform px-0.5">
                    {e}
                  </button>
                ))}
                {isMe && (
                  <button onClick={() => onDelete(msg.id)}
                    className="ml-1 p-1 rounded-lg hover:bg-red-500/20 transition-colors"
                    style={{ color: 'var(--eb-text4)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <span className="text-[10px] mt-0.5 px-1" style={{ color: 'var(--eb-text4)' }}>
          {fmtTime(msg.created_at)}
        </span>
      </div>
    </div>
  )
}

// ── Conversation view ─────────────────────────────────────────────────────────

// ── Modal E2E: pierwsza konfiguracja (kod odzyskiwania) lub odblokowanie ──────
function E2EModal({ mode, token, onClose, onReady }: {
  mode: 'setup' | 'unlock'
  token: string | null
  onClose: () => void
  onReady: () => void
}) {
  const [code, setCode]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [hasDeviceCode, setHasDeviceCode] = useState(false) // dostępny zapisany kod (unlock)
  const authH = token ? { Authorization: `Bearer ${token}` } : undefined
  const electron = typeof window !== 'undefined' ? (window as any).electronPZ : null

  // Setup: generuj tożsamość + kod od razu (kod pokazujemy użytkownikowi)
  const [genCode] = useState(() => (mode === 'setup' ? generateRecoveryCode() : ''))
  const [identity] = useState(() => (mode === 'setup' ? generateIdentity() : null))

  // Unlock: sprawdź czy jest zapisany kod na tym komputerze
  useEffect(() => {
    if (mode !== 'unlock' || !electron?.getRecoveryCode) return
    electron.getRecoveryCode().then((r: any) => { if (r?.code) setHasDeviceCode(true) }).catch(() => {})
  }, [mode])

  async function confirmSetup() {
    if (!identity) return
    setBusy(true); setError('')
    try {
      const salt = randomSalt()
      const dk = await deriveKey(genCode, salt)
      const privateKeyEnc = sealSecretKey(identity.secretKey, dk)
      const res = await fetch(`${BASE}/api/e2e/keys`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(authH ?? {}) },
        body: JSON.stringify({ publicKey: publicKeyB64(identity), privateKeyEnc, kdfSalt: salt }),
      })
      if (!res.ok) throw new Error('Nie udało się zapisać kluczy')
      // Zapisz kod bezpiecznie na tym komputerze (DPAPI) — wygoda bez wycieku.
      try { await electron?.saveRecoveryCode?.(genCode) } catch {}
      setSessionSecret(identity.secretKey)
      onReady()
    } catch (e: any) { setError(e.message || 'Błąd') } finally { setBusy(false) }
  }

  // Odblokowanie zapisanym kodem (z bezpiecznego magazynu systemowego)
  async function unlockWithDevice() {
    if (!electron?.getRecoveryCode) return
    setBusy(true); setError('')
    try {
      const r = await electron.getRecoveryCode()
      if (!r?.code) throw new Error('Brak zapisanego kodu na tym komputerze')
      const res = await fetch(`${BASE}/api/e2e/keys/me`, { credentials: 'include', headers: authH })
      const d = await res.json()
      if (!d.keys) throw new Error('Brak zapisanych kluczy')
      const dk = await deriveKey(r.code, d.keys.kdfSalt)
      const secret = openSecretKey(d.keys.privateKeyEnc, dk)
      if (!secret) throw new Error('Zapisany kod nie pasuje (klucze zmienione?)')
      setSessionSecret(secret)
      onReady()
    } catch (e: any) { setError(e.message || 'Błąd'); setHasDeviceCode(false) } finally { setBusy(false) }
  }

  async function confirmUnlock() {
    setBusy(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/e2e/keys/me`, { credentials: 'include', headers: authH })
      const d = await res.json()
      if (!d.keys) throw new Error('Brak zapisanych kluczy')
      const dk = await deriveKey(code, d.keys.kdfSalt)
      const secret = openSecretKey(d.keys.privateKeyEnc, dk)
      if (!secret) throw new Error('Nieprawidłowy kod odzyskiwania')
      setSessionSecret(secret)
      onReady()
    } catch (e: any) { setError(e.message || 'Błąd') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-6 w-full max-w-md"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔒</span>
          <h2 className="text-base font-semibold" style={{ color: 'var(--eb-text1)' }}>
            {mode === 'setup' ? 'Skonfiguruj szyfrowanie' : 'Odblokuj szyfrowanie'}
          </h2>
        </div>

        {mode === 'setup' ? (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--eb-text3)' }}>
              Zapisz ten <b style={{ color: 'var(--eb-text1)' }}>kod odzyskiwania</b>. To jedyny sposób odzyskania
              szyfrowanych wiadomości na innym urządzeniu lub po wylogowaniu. Nie pokażemy go ponownie i nie znamy go.
            </p>
            <div className="p-3 rounded-xl mb-2 font-mono text-sm tracking-wide text-center break-all"
              style={{ background: 'var(--eb-bg0)', border: '0.5px solid var(--eb-border2)', color: 'var(--eb-accent)' }}>
              {genCode}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(genCode); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              className="text-xs mb-2" style={{ color: 'var(--eb-text3)' }}>
              {copied ? '✓ Skopiowano' : '📋 Kopiuj kod'}
            </button>
            {electron?.saveRecoveryCode && (
              <p className="text-[11px] mb-3 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--eb-online)', border: '0.5px solid rgba(34,197,94,0.2)' }}>
                🔐 Kod zostanie też <b>zapisany bezpiecznie na tym komputerze</b> (zaszyfrowany kontem Windows) — odblokujesz jednym kliknięciem. Skopiowany na inny komputer plik jest bezużyteczny.
              </p>
            )}
            {error && <p className="text-xs mb-2" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} className="ember-btn-ghost flex-1 py-2 text-sm">Anuluj</button>
              <button onClick={confirmSetup} disabled={busy} className="ember-btn flex-1 py-2 text-sm font-semibold">
                {busy ? '…' : 'Zapisałem — włącz'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--eb-text3)' }}>
              Wpisz swój kod odzyskiwania, aby odblokować szyfrowane wiadomości na tym urządzeniu.
            </p>
            {hasDeviceCode && (
              <button onClick={unlockWithDevice} disabled={busy}
                className="w-full py-2.5 mb-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--eb-online)', border: '0.5px solid rgba(34,197,94,0.3)' }}>
                {busy ? '…' : '🔐 Odblokuj zapisanym kodem (z tego komputera)'}
              </button>
            )}
            <input value={code} onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmUnlock()}
              placeholder="XXXX-XXXX-XXXX-…" autoFocus
              className="ember-input w-full px-3 py-2.5 mb-2 font-mono text-sm" />
            {error && <p className="text-xs mb-2" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} className="ember-btn-ghost flex-1 py-2 text-sm">Anuluj</button>
              <button onClick={confirmUnlock} disabled={busy || !code.trim()} className="ember-btn flex-1 py-2 text-sm font-semibold">
                {busy ? '…' : 'Odblokuj'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ConvView({ conv, onBack }: { conv: DmConversation; onBack?: () => void }) {
  const {
    currentUser, token, dmMessages, addDmMessage, updateDmMessage, deleteDmMessage,
    setDmMessages, prependDmMessages, clearDmUnread, updateDmConvLastMsg,
    dmTyping, setDmTyping,
  } = useStore()
  const { emit, on, off } = useSocket()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const msgs = dmMessages[conv.id] ?? []
  const typing = dmTyping[conv.id] ?? []

  // ── E2E ──
  const [e2eEnabled, setE2eEnabled] = useState(false)
  const [peerPub, setPeerPub]       = useState<string | null>(null)
  const [secretReady, setSecretReady] = useState<boolean>(() => !!getSessionSecret())
  const [e2eModal, setE2eModal]     = useState<null | 'setup' | 'unlock'>(null)
  const [enabling, setEnabling]     = useState(false)
  const e2eUnlocked = e2eEnabled && secretReady && !!peerPub

  const authHeaders = useCallback(
    (extra?: HeadersInit): HeadersInit => ({
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    }),
    [token]
  )

  // Load initial messages
  useEffect(() => {
    emit('DM_JOIN', conv.id)
    clearDmUnread(conv.id)

    setE2eEnabled(false); setPeerPub(null)
    fetch(`${BASE}/api/dm/${conv.id}/messages`, { credentials: 'include', headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.messages) { setDmMessages(conv.id, d.messages); setHasMore(d.hasMore ?? false) }
        if (d.e2eEnabled && d.peerId) {
          setE2eEnabled(true)
          fetch(`${BASE}/api/e2e/keys/${d.peerId}`, { credentials: 'include', headers: authHeaders() })
            .then(r => r.ok ? r.json() : null)
            .then(k => setPeerPub(k?.publicKey ?? null))
            .catch(() => {})
          // Klucz prywatny nie wczytany w tej sesji → poproś o odblokowanie kodem.
          if (!getSessionSecret()) setE2eModal('unlock')
        }
      })
      .catch(() => {})
    return () => { emit('DM_LEAVE', conv.id) }
  }, [conv.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  // Socket listeners
  useEffect(() => {
    const onNew = (msg: DmMessage) => {
      if (msg.conversation_id !== conv.id) return
      addDmMessage(conv.id, msg)
      updateDmConvLastMsg(conv.id, (msg as any).encrypted ? '🔒 Wiadomość szyfrowana' : msg.content, msg.created_at)
      clearDmUnread(conv.id)
      // mark read
      fetch(`${BASE}/api/dm/${conv.id}/read`, {
        method: 'PATCH', credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ lastReadId: msg.id }),
      }).catch(() => {})
    }
    const onUpd = (d: any) => {
      if (d.conversationId !== conv.id) return
      updateDmMessage(conv.id, d.id, { content: d.content, edited_at: d.edited_at })
    }
    const onDel = (d: any) => {
      if (d.conversationId !== conv.id) return
      deleteDmMessage(conv.id, d.id)
    }
    const onTyping = (d: any) => {
      if (d.convId !== conv.id || d.userId === currentUser?.id) return
      setDmTyping(conv.id, d.username, d.typing)
    }
    const onE2e = (d: any) => {
      if (d.conversationId !== conv.id) return
      setE2eEnabled(true)
      // Pobierz peerId (z endpointu wiadomości) i jego klucz publiczny
      fetch(`${BASE}/api/dm/${conv.id}/messages?limit=1`, { credentials: 'include', headers: authHeaders() })
        .then(r => r.json()).then(m => m?.peerId && fetch(`${BASE}/api/e2e/keys/${m.peerId}`, { credentials: 'include', headers: authHeaders() })
          .then(r => r.ok ? r.json() : null).then(k => setPeerPub(k?.publicKey ?? null))).catch(() => {})
    }
    on('DM_MESSAGE_CREATE', onNew)
    on('DM_MESSAGE_UPDATE', onUpd)
    on('DM_MESSAGE_DELETE', onDel)
    on('DM_TYPING',         onTyping)
    on('DM_E2E_ENABLED',    onE2e)
    return () => {
      off('DM_MESSAGE_CREATE', onNew)
      off('DM_MESSAGE_UPDATE', onUpd)
      off('DM_MESSAGE_DELETE', onDel)
      off('DM_TYPING',         onTyping)
      off('DM_E2E_ENABLED',    onE2e)
    }
  }, [conv.id, currentUser?.id])

  const loadMore = async () => {
    if (!hasMore || loadingMore || !msgs.length) return
    setLoadingMore(true)
    const oldest = msgs[0]
    const r = await fetch(`${BASE}/api/dm/${conv.id}/messages?before=${oldest.id}`, { credentials: 'include', headers: authHeaders() })
    const d = await r.json()
    if (d.messages?.length) { prependDmMessages(conv.id, d.messages); setHasMore(d.hasMore) }
    setLoadingMore(false)
  }

  const sendMsg = async () => {
    if (!text.trim() || sending) return
    const content = text.trim()

    let body: any = { content }
    if (e2eEnabled) {
      const secret = getSessionSecret()
      if (!secret) { setE2eModal('unlock'); return }
      if (!peerPub) { return }
      body = { content: encryptMessage(content, peerPub, secret), encrypted: true }
    }

    setText('')
    setSending(true)
    emit('DM_TYPING_STOP', conv.id)
    try {
      await fetch(`${BASE}/api/dm/${conv.id}/messages`, {
        method: 'POST', credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
    } finally { setSending(false) }
  }

  // Włączanie szyfrowania rozmowy (zapewnij klucze → POST /e2e)
  async function startE2E() {
    setEnabling(true)
    try {
      const st = await fetch(`${BASE}/api/e2e/keys/status`, { credentials: 'include', headers: authHeaders() }).then(r => r.json())
      if (!st.hasKeys) { setE2eModal('setup'); return }
      if (!getSessionSecret()) { setE2eModal('unlock'); return }
      await enableConv()
    } catch {} finally { setEnabling(false) }
  }
  async function enableConv() {
    const res = await fetch(`${BASE}/api/dm/${conv.id}/e2e`, {
      method: 'POST', credentials: 'include', headers: authHeaders({ 'Content-Type': 'application/json' }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.status === 400 && d.needKeys) { setE2eModal('setup'); return }
    if (res.status === 409) { alert('Druga osoba nie ma jeszcze włączonego szyfrowania. Poproś ją, by skonfigurowała E2E.'); return }
    if (res.ok) { setE2eEnabled(true); setPeerPub(d.peerPublicKey ?? null) }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
  }

  const onTextChange = (v: string) => {
    setText(v)
    emit('DM_TYPING_START', conv.id)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => emit('DM_TYPING_STOP', conv.id), 4000)
  }

  const onReact = async (msgId: string, emoji: string) => {
    const msg = msgs.find(m => m.id === msgId)
    const alreadyMe = msg?.reactions?.find(r => r.emoji === emoji && r.me)
    const url = `${BASE}/api/dm/${conv.id}/messages/${msgId}/react`
    if (alreadyMe) {
      await fetch(`${url}/${encodeURIComponent(emoji)}`, { method: 'DELETE', credentials: 'include', headers: authHeaders() })
    } else {
      await fetch(url, {
        method: 'POST', credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ emoji }),
      })
    }
  }

  const onDelete = async (msgId: string) => {
    await fetch(`${BASE}/api/dm/${conv.id}/messages/${msgId}`, { method: 'DELETE', credentials: 'include', headers: authHeaders() })
  }

  const sendGif = async (url: string) => {
    setShowGif(false)
    setSending(true)
    try {
      await fetch(`${BASE}/api/dm/${conv.id}/messages`, {
        method: 'POST', credentials: 'include',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content: url }),
      })
    } finally { setSending(false) }
  }

  const insertEmoji = (value: string, name?: string, type?: 'standard' | 'custom') => {
    const insert = type === 'custom' && name ? `:${name}:` : value
    setText(t => t + insert)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(`${BASE}/api/dm/${conv.id}/attachments`, {
        method: 'POST', credentials: 'include', headers: authHeaders(), body: fd,
      })
      const att = await r.json()
      if (att.id) {
        const content = text.trim()
        await fetch(`${BASE}/api/dm/${conv.id}/messages`, {
          method: 'POST', credentials: 'include',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ content, attachmentId: att.id }),
        })
      }
    } finally { setUploading(false) }
  }

  // Odszyfrowanie wiadomości do wyświetlenia (treść jawna żyje tylko w pamięci)
  const secret = secretReady ? getSessionSecret() : null
  const displayMsgs = msgs.map(m => {
    if (!(m as any).encrypted) return m
    if (!secret) return { ...m, content: '🔒 Kliknij „Odblokuj" i podaj kod, aby odczytać' }
    if (!peerPub) return { ...m, content: '🔒 Wczytywanie kluczy…' }
    const dec = decryptMessage(m.content, peerPub, secret)
    return { ...m, content: dec ?? '🔒 Nie można odszyfrować (inny klucz?)' }
  })

  function onE2EReady() {
    setSecretReady(true)
    setE2eModal(null)
    // Po konfiguracji/odblokowaniu włącz szyfrowanie rozmowy, jeśli jeszcze nie aktywne
    if (!e2eEnabled) enableConv()
    else if (!peerPub) {
      fetch(`${BASE}/api/dm/${conv.id}/messages?limit=1`, { credentials: 'include', headers: authHeaders() })
        .then(r => r.json()).then(d => d?.peerId && fetch(`${BASE}/api/e2e/keys/${d.peerId}`, { credentials: 'include', headers: authHeaders() })
          .then(r => r.ok ? r.json() : null).then(k => setPeerPub(k?.publicKey ?? null))).catch(() => {})
    }
  }

  return (
    <div className="flex flex-col h-full">
      {e2eModal && (
        <E2EModal mode={e2eModal} token={token} onClose={() => setE2eModal(null)} onReady={onE2EReady} />
      )}
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg1)' }}>
        {onBack && (
          <button onClick={onBack} className="flex-shrink-0 -ml-1 p-1" style={{ color: 'var(--eb-text2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
        )}
        <div className="relative">
          <UserAvatar user={{ avatar_url: conv.avatar_url, avatar_color: conv.avatar_color, display_name: conv.display_name }} size={34} />
          <StatusDot status={conv.status} />
        </div>
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>{conv.display_name}</div>
          <div className="text-xs" style={{ color: 'var(--eb-text4)' }}>@{conv.username}</div>
        </div>

        {/* E2E — przycisk / wskaźnik */}
        <div className="ml-auto flex-shrink-0">
          {!e2eEnabled ? (
            <button onClick={startE2E} disabled={enabling} title="Włącz szyfrowanie end-to-end"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text3)', border: '0.5px solid var(--eb-border2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--eb-text1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text3)')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
              {enabling ? '…' : 'Szyfruj'}
            </button>
          ) : e2eUnlocked ? (
            <span title="Rozmowa szyfrowana end-to-end" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--eb-online)', border: '0.5px solid rgba(34,197,94,0.3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Szyfrowana
            </span>
          ) : (
            <button onClick={() => setE2eModal('unlock')} title="Odblokuj szyfrowane wiadomości"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--eb-accent)', border: '0.5px solid rgba(245,158,11,0.3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Odblokuj
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--eb-border) transparent' }}>
        {hasMore && (
          <button onClick={loadMore} disabled={loadingMore}
            className="self-center mb-3 px-4 py-1.5 rounded-full text-xs transition-all"
            style={{ background: 'var(--eb-bg2)', color: 'var(--eb-text3)', border: '1px solid var(--eb-border)' }}>
            {loadingMore ? '…' : '↑ Załaduj starsze'}
          </button>
        )}
        {displayMsgs.map((msg, i) => {
          const isMe = msg.author_id === currentUser?.id
          const prev = displayMsgs[i - 1]
          const showAvatar = !prev || prev.author_id !== msg.author_id ||
            (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60000
          return (
            <MsgBubble key={msg.id} msg={msg} isMe={isMe} showAvatar={showAvatar}
              onReact={onReact} onDelete={onDelete} />
          )
        })}
        {typing.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1 px-2">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--eb-text4)', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-xs" style={{ color: 'var(--eb-text4)' }}>
              {typing.join(', ')} {typing.length === 1 ? 'pisze…' : 'piszą…'}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-end gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border2)' }}>

          {/* Attachment */}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors mb-0.5"
            style={{ color: 'var(--eb-text4)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--eb-text2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text4)')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input ref={fileRef} type="file" className="hidden"
            accept="image/*,video/mp4,video/webm,audio/mpeg,audio/ogg,application/pdf,text/plain"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }} />

          {/* Text */}
          <TextareaAutosize
            ref={inputRef}
            value={text}
            onChange={e => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Wiadomość do ${conv.display_name}…`}
            maxRows={8}
            className="flex-1 bg-transparent resize-none outline-none text-sm py-1"
            style={{ color: 'var(--eb-text1)', caretColor: 'var(--eb-accent)' }}
          />

          {/* GIF */}
          <div className="relative flex-shrink-0 mb-0.5">
            <button onClick={() => { setShowGif(p => !p); setShowEmoji(false) }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: showGif ? 'var(--eb-accent)' : 'var(--eb-text4)' }}
              title="GIF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="4"/>
                <path d="M9.5 9.5v5M14 9.5h-2.5v5M14 12h-2"/><path d="M18 9.5v5"/>
              </svg>
            </button>
            {showGif && (
              <GifPicker
                onSelect={sendGif}
                onClose={() => setShowGif(false)}
              />
            )}
          </div>

          {/* Emoji */}
          <div className="relative flex-shrink-0 mb-0.5" data-emoji-picker>
            <button onClick={() => { setShowEmoji(p => !p); setShowGif(false) }}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: showEmoji ? 'var(--eb-accent)' : 'var(--eb-text4)' }}
              title="Emoji">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>
            {showEmoji && (
              <div className="absolute bottom-10 right-0 z-50">
                <EmojiPicker onSelect={insertEmoji} />
              </div>
            )}
          </div>

          {/* Send */}
          <button onClick={sendMsg} disabled={!text.trim() || sending}
            className="flex-shrink-0 p-1.5 rounded-lg transition-all mb-0.5 disabled:opacity-30"
            style={{ color: text.trim() ? 'var(--eb-accent)' : 'var(--eb-text4)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main DMPanel ──────────────────────────────────────────────────────────────

export function DMPanel() {
  const {
    currentUser, dmOpen, setDmOpen,
    dmConversations, setDmConversations,
    activeDmConvId, setActiveDmConvId,
    dmUnread,
  } = useStore()
  const { } = useSocket()
  const [search, setSearch] = useState('')

  // Load conversations whenever panel opens or activeDmConvId changes from outside
  const token = useStore(s => s.token)
  useEffect(() => {
    if (!dmOpen || !currentUser) return
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${BASE}/api/dm`, { credentials: 'include', headers })
      .then(r => r.json())
      .then(d => { if (d.conversations) setDmConversations(d.conversations) })
  }, [dmOpen, currentUser?.id, activeDmConvId])

  // DM_MESSAGE_CREATE global tracking is handled in useSocket.ts

  const totalUnread = Object.values(dmUnread).reduce((a, b) => a + b, 0)

  const filtered = dmConversations.filter(c =>
    !search || c.display_name.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase())
  )

  const activeConv = activeDmConvId ? dmConversations.find(c => c.id === activeDmConvId) : null

  return (
    <div className="flex h-full border-l" style={{ borderColor: 'var(--eb-border)', flexShrink: 0 }}>

      {/* Conversation view — renders first (left side) when conv is active */}
      {activeDmConvId && (
        activeConv ? (
          <div className="flex flex-col h-full" style={{ width: 440, background: 'var(--eb-bg0)', borderRight: '1px solid var(--eb-border)' }}>
            <ConvView conv={activeConv} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full" style={{ width: 440, background: 'var(--eb-bg0)', borderRight: '1px solid var(--eb-border)' }}>
            <div className="text-center opacity-40">
              <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
                style={{ borderColor: 'var(--eb-accent)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--eb-text4)' }}>Ładowanie…</p>
            </div>
          </div>
        )
      )}

      {/* Sidebar: conversation list (right side) */}
      <div className="flex flex-col h-full" style={{ width: 240, flexShrink: 0, background: 'var(--eb-bg1)' }}>
        <div className="px-3 pt-3 pb-2 flex-shrink-0 border-b" style={{ borderColor: 'var(--eb-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>Wiadomości</h2>
            <button onClick={() => { setDmOpen(false); setActiveDmConvId(null) }}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--eb-text4)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--eb-text2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--eb-text4)')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj…"
            className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--eb-bg2)', border: '1px solid var(--eb-border)', color: 'var(--eb-text1)' }} />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--eb-border) transparent' }}>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 opacity-50 py-8">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--eb-text4)' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p className="text-xs text-center px-3" style={{ color: 'var(--eb-text4)' }}>
                Brak rozmów. Napisz do znajomego w zakładce Znajomi.
              </p>
            </div>
          )}
          {filtered.map(conv => (
            <ConvItem key={conv.id} conv={conv} active={activeDmConvId === conv.id}
              unread={dmUnread[conv.id] ?? 0}
              onClick={() => { setActiveDmConvId(conv.id) }} />
          ))}
        </div>
      </div>
    </div>
  )
}
