'use client'
import { useState, useRef, KeyboardEvent, useCallback, useEffect, useMemo, DragEvent } from 'react'
import { useStore } from '@/lib/store'
import { useSocket } from '@/hooks/useSocket'
import { EmojiPicker } from './EmojiPicker'
import { PollModal } from './PollModal'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface GifItem { id: string; url: string; preview: string; title: string }

function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery]   = useState('')
  const [gifs,  setGifs]    = useState<GifItem[]>([])
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<NodeJS.Timeout>()

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const endpoint = q.trim()
        ? `${BASE}/api/gifs/search?q=${encodeURIComponent(q)}`
        : `${BASE}/api/gifs/trending`
      const r = await fetch(endpoint)
      const d = await r.json()
      setGifs((d.gifs ?? []) as GifItem[])
    } catch { setGifs([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchGifs('') }, [fetchGifs])

  const onSearch = (v: string) => {
    setQuery(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGifs(v), 400)
  }

  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])

  return (
    <div
      ref={wrapRef}
      className="absolute bottom-full right-0 mb-2 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
      style={{
        width: 340, height: 380,
        background: 'var(--eb-bg1)',
        border: '0.5px solid var(--eb-border2)',
      }}
    >
      {}
      <div className="p-2 flex-shrink-0" style={{ borderBottom: '0.5px solid var(--eb-border)' }}>
        <input
          autoFocus
          value={query}
          onChange={e => onSearch(e.target.value)}
          placeholder="Szukaj GIF..."
          className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text1)', border: '0.5px solid var(--eb-border2)' }}
        />
      </div>

      {}
      <div className="gif-scroll flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--eb-text3)' }}>
            Brak wyników
          </div>
        ) : (
          <div className="columns-3 gap-1.5">
            {gifs.map(g => (
              <button
                key={g.id}
                onClick={() => { onSelect(g.url); onClose() }}
                className="w-full mb-1.5 rounded-lg overflow-hidden block hover:opacity-80 transition-opacity"
                title={g.title}
              >
                <img src={g.preview} alt={g.title} className="w-full h-auto block" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {}
      <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-end" style={{ borderTop: '0.5px solid var(--eb-border)' }}>
        <span className="text-[10px] font-semibold" style={{ color: 'var(--eb-text3)' }}>Powered by Tenor</span>
      </div>
    </div>
  )
}

interface Props {
  channelName: string
  channelId: string
  serverId: string
  replyTo?: { id: string; content: string; authorName: string } | null
  onClearReply?: () => void
}

interface MentionSuggestion {
  id: string
  label: string
  sub: string
  avatar?: string
  avatarColor?: string
  special?: boolean
}

function useMentionQuery(value: string, cursorPos: number) {
  return useMemo(() => {

    const before = value.slice(0, cursorPos)
    const match = before.match(/@([^\s@]*)$/)
    if (!match) return null
    return {
      query: match[1].toLowerCase(),
      start: before.lastIndexOf('@' + match[1]),
    }
  }, [value, cursorPos])
}

interface PendingAttachment {
  id: string
  url: string
  filename: string
  contentType: string
  size: number
  width?: number | null
  height?: number | null
  previewUrl?: string
}

export function ChatInput({ channelName, channelId, serverId, replyTo, onClearReply }: Props) {
  const [value, setValue] = useState('')
  const [cursorPos, setCursorPos] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showPollModal, setShowPollModal] = useState(false)
  const [muteError, setMuteError] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const { addMessage, deleteMessage, currentUser, token, members } = useStore()
  const { sendMessage, startTyping, stopTyping, on, off } = useSocket()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingRef = useRef(false)
  const typingTimer = useRef<NodeJS.Timeout>()
  const lastNonceRef = useRef<string | null>(null)
  const mentionRef = useRef<HTMLDivElement>(null)

  const uploadFile = useCallback(async (file: File) => {
    if (!token) return
    setUploadingFile(true)
    try {

      let previewUrl: string | undefined
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file)
      }

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${BASE}/api/channels/${channelId}/attachments`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      })
      if (!res.ok) {
        const d = await res.json()
        setMuteError(d.error ?? 'Błąd przesyłania pliku')
        setTimeout(() => setMuteError(''), 4000)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        return
      }
      const data = await res.json()
      setPendingAttachment({ ...data, previewUrl })
    } catch {
      setMuteError('Błąd przesyłania pliku')
      setTimeout(() => setMuteError(''), 4000)
    } finally {
      setUploadingFile(false)
    }
  }, [token, channelId])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)

    e.target.value = ''
  }, [uploadFile])

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const removePendingAttachment = useCallback(() => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl)
    setPendingAttachment(null)
  }, [pendingAttachment])

  const mentionQuery = useMentionQuery(value, cursorPos)

  const serverMembers = members[serverId] ?? []

  const suggestions: MentionSuggestion[] = useMemo(() => {
    if (!mentionQuery) return []
    const q = mentionQuery.query

    const specials: MentionSuggestion[] = [
      { id: 'everyone', label: '@everyone', sub: 'Oznacz wszystkich',  special: true },
      { id: 'here',     label: '@here',     sub: 'Oznacz aktywnych',   special: true },
    ].filter(s => s.id.startsWith(q) || q === '')

    const users: MentionSuggestion[] = serverMembers
      .filter(m =>
        m.username.toLowerCase().includes(q) ||
        (m.display_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map(m => ({
        id:          m.user_id,
        label:       m.display_name || m.username,
        sub:         '@' + m.username,
        avatar:      m.avatar_url ?? undefined,
        avatarColor: m.avatar_color,
      }))

    return [...specials, ...users].slice(0, 10)
  }, [mentionQuery, serverMembers])

  useEffect(() => { setMentionIndex(0) }, [suggestions.length])

  useEffect(() => {
    if (!suggestions.length) return
    const fn = (e: MouseEvent) => {
      if (!mentionRef.current?.contains(e.target as Node)) setMentionIndex(0)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [suggestions.length])

  const insertMention = useCallback((s: MentionSuggestion) => {
    if (!mentionQuery || !inputRef.current) return

    const insertText = s.special ? s.id : s.sub.replace(/^@/, '')
    const before = value.slice(0, mentionQuery.start)
    const after  = value.slice(cursorPos)
    const newVal = `${before}@${insertText} ${after}`
    setValue(newVal)

    const newPos = mentionQuery.start + insertText.length + 2
    setTimeout(() => {
      inputRef.current!.focus()
      inputRef.current!.setSelectionRange(newPos, newPos)
      setCursorPos(newPos)
    }, 0)
  }, [mentionQuery, value, cursorPos])

  useEffect(() => {
    if (!showEmojiPicker) return
    const fn = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest?.('[data-emoji-picker]')) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [showEmojiPicker])

  useEffect(() => {
    const handler = (data: { message: string }) => {
      setMuteError(data.message)
      setTimeout(() => setMuteError(''), 4000)
      if (lastNonceRef.current) {
        deleteMessage(channelId, lastNonceRef.current)
        lastNonceRef.current = null
      }
    }
    on('ERROR', handler)
    return () => off('ERROR', handler)
  }, [on, off, channelId, deleteMessage])

  const handleTyping = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true
      startTyping(channelId)
    }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      typingRef.current = false
      stopTyping(channelId)
    }, 3000)
  }, [channelId, startTyping, stopTyping])

  useEffect(() => { return () => clearTimeout(typingTimer.current) }, [])

  const send = useCallback(async () => {
    const content = value.trim()
    if (!content && !pendingAttachment) return
    if (!currentUser) return

    const nonce = `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    lastNonceRef.current = nonce

    const att = pendingAttachment

    addMessage(channelId, {
      id: nonce, channelId, serverId, type: 'DEFAULT', content: content || ' ',
      createdAt: new Date().toISOString(), pinned: false,
      replyTo: replyTo ?? null,
      author: {
        id: currentUser.id, username: currentUser.username,
        displayName: currentUser.display_name, avatarColor: currentUser.avatar_color,
        avatar: currentUser.avatar_url ?? undefined,
        status: 'online' as any, discriminator: '0000',
      },
      reactions: [], embeds: [],
      attachments: att ? [{ id: att.id, filename: att.filename, url: att.previewUrl ?? att.url, contentType: att.contentType, size: att.size, width: att.width, height: att.height }] : [],
    })

    setValue('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    clearTimeout(typingTimer.current)
    typingRef.current = false
    stopTyping(channelId)
    onClearReply?.()

    if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl)
    setPendingAttachment(null)

    if (token) {
      try {
        const res = await fetch(`${BASE}/api/servers/${serverId}/moderation/status/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.muted) {
          const mins = data.muteExpiresAt
            ? Math.ceil((new Date(data.muteExpiresAt).getTime() - Date.now()) / 60000)
            : 0
          setMuteError(`Jesteś wyciszony jeszcze przez ${mins} min`)
          setTimeout(() => setMuteError(''), 4000)
          deleteMessage(channelId, nonce)
          lastNonceRef.current = null
          return
        }
      } catch {  }
    }

    sendMessage(channelId, serverId, content || ' ', nonce, replyTo?.id, att ? [att.id] : undefined)
  }, [value, channelId, serverId, currentUser, token, replyTo, pendingAttachment, addMessage, deleteMessage, sendMessage, stopTyping, onClearReply])

  const sendGif = useCallback(async (gifUrl: string) => {
    if (!currentUser) return
    const nonce = `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    lastNonceRef.current = nonce

    addMessage(channelId, {
      id: nonce, channelId, serverId, type: 'DEFAULT', content: gifUrl,
      createdAt: new Date().toISOString(), pinned: false,
      author: {
        id: currentUser.id, username: currentUser.username,
        displayName: currentUser.display_name, avatarColor: currentUser.avatar_color,
        avatar: currentUser.avatar_url ?? undefined,
        status: 'online' as any, discriminator: '0000',
      },
      reactions: [], embeds: [], attachments: [],
    })

    sendMessage(channelId, serverId, gifUrl, nonce)
  }, [channelId, serverId, currentUser, addMessage, sendMessage])

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {

    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(i => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(i => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(suggestions[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setValue(v => v)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className="px-4 pb-4 flex-shrink-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={dragOver ? { outline: '2px dashed var(--eb-accent)', outlineOffset: -4, borderRadius: 12 } : undefined}
    >
      {}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt,.mp3,.mp4"
        onChange={handleFileSelect}
      />
      {}
      {suggestions.length > 0 && mentionQuery && (
        <div
          ref={mentionRef}
          className="mb-1 rounded-xl overflow-hidden shadow-xl"
          style={{
            background: 'var(--eb-bg2)',
            border: '0.5px solid var(--eb-border2)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--eb-text3)' }}>
            Wzmianki
          </div>
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); insertMention(s) }}
              onMouseEnter={() => setMentionIndex(i)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{
                background: i === mentionIndex ? 'rgba(255,255,255,0.07)' : 'transparent',
              }}
            >
              {}
              {s.special ? (
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                  style={{ background: 'var(--eb-gradient)' }}>
                  {s.id === 'everyone' ? '📢' : '🟢'}
                </div>
              ) : s.avatar ? (
                <img src={s.avatar} alt={s.label} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: s.avatarColor ?? '#64748b', color: '#fff' }}>
                  {s.label[0]?.toUpperCase()}
                </div>
              )}
              {}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--eb-text1)' }}>
                  {s.label}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--eb-text3)' }}>
                  {s.sub}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {}
      {replyTo && (
        <div className="mb-1 px-3 py-1.5 rounded-lg flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--eb-border2)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--eb-accent)" strokeWidth="2" className="flex-shrink-0">
            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
          </svg>
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--eb-accent)' }}>
            Odpowiadasz {replyTo.authorName}
          </span>
          <span className="text-xs truncate flex-1" style={{ color: 'var(--eb-text3)' }}>
            {replyTo.content.length > 80 ? replyTo.content.slice(0, 80) + '…' : replyTo.content}
          </span>
          <button onClick={onClearReply} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--eb-text3)' }} title="Anuluj odpowiedź">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {}
      {pendingAttachment && (
        <div className="mb-1 px-3 py-2 rounded-lg flex items-center gap-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--eb-border2)' }}>
          {pendingAttachment.contentType.startsWith('image/') && pendingAttachment.previewUrl ? (
            <img src={pendingAttachment.previewUrl} alt={pendingAttachment.filename}
              className="rounded-lg object-cover flex-shrink-0"
              style={{ width: 48, height: 48 }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: 'var(--eb-text1)' }}>{pendingAttachment.filename}</div>
            <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>{(pendingAttachment.size / 1024).toFixed(0)} KB</div>
          </div>
          <button onClick={removePendingAttachment} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: 'var(--eb-text3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
      {uploadingFile && (
        <div className="mb-1 px-3 py-1.5 rounded-lg flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--eb-border2)' }}>
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--eb-accent)" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>Przesyłanie pliku…</span>
        </div>
      )}

      {}
      {muteError && (
        <div className="mb-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
          {muteError}
        </div>
      )}

      <div
        className="flex items-end gap-2 px-3 py-2 rounded-xl transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--eb-border2)' }}
      >
        {}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile || !!pendingAttachment}
          className="icon-btn mb-0.5 flex-shrink-0"
          style={{ width: 28, height: 28, opacity: (uploadingFile || !!pendingAttachment) ? 0.4 : 1 }}
          title="Dodaj plik"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        {}
        <button
          onClick={() => setShowPollModal(true)}
          className="icon-btn mb-0.5 flex-shrink-0"
          style={{ width: 28, height: 28 }}
          title="Utwórz ankietę"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </button>

        {}
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => {
            setValue(e.target.value)
            setCursorPos(e.target.selectionStart ?? 0)
            if (e.target.value) handleTyping()
          }}
          onKeyDown={onKey}
          onSelect={e => setCursorPos((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onClick={e => setCursorPos((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          placeholder={`Napisz coś na #${channelName}...`}
          rows={1}
          className="flex-1 resize-none outline-none text-sm py-0.5"
          style={{
            background: 'transparent', border: 'none',
            color: 'var(--eb-text1)', fontFamily: 'DM Sans, sans-serif',
            maxHeight: 120, lineHeight: 1.5,
          }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
        />

        {}
        <div className="flex items-center gap-1 mb-0.5 flex-shrink-0">
          {}
          <div className="relative">
            <button
              onClick={() => { setShowGifPicker(p => !p); setShowEmojiPicker(false) }}
              className="icon-btn"
              style={{ width: 28, height: 28, color: showGifPicker ? 'var(--eb-accent)' : undefined }}
              title="GIF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="4"/>
                <path d="M9.5 9.5v5M14 9.5h-2.5v5M14 12h-2"/><path d="M18 9.5v5"/>
              </svg>
            </button>
            {showGifPicker && (
              <GifPicker
                onSelect={url => sendGif(url)}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>
          <div className="relative" data-emoji-picker>
            <button
              onClick={() => setShowEmojiPicker(p => !p)}
              className="icon-btn"
              style={{ width: 28, height: 28, color: showEmojiPicker ? 'var(--eb-accent)' : undefined }}
              title="Emoji">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-10 right-0 z-50">
                <EmojiPicker
                  serverId={serverId}
                  onSelect={(value, name, type) => {
                    if (type === 'custom' && name) setValue(v => v + `:${name}:`)
                    else setValue(v => v + value)
                    setShowEmojiPicker(false)
                    inputRef.current?.focus()
                  }}
                />
              </div>
            )}
          </div>
          <button
            onClick={send}
            disabled={!value.trim() && !pendingAttachment}
            className="flex items-center justify-center rounded-lg transition-all duration-150"
            style={{
              width: 28, height: 28,
              background: (value.trim() || pendingAttachment) ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.05)',
              color: (value.trim() || pendingAttachment) ? '#fff' : 'var(--eb-text3)',
            }}
            title="Wyślij (Enter)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>

      {}
      {showPollModal && (
        <PollModal
          channelId={channelId}
          serverId={serverId}
          onClose={() => setShowPollModal(false)}
        />
      )}
    </div>
  )
}
