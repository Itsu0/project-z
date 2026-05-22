'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ForumAuthor {
  author_id: string
  author_display_name: string
  author_username: string
  author_avatar_color: string
  author_avatar_url: string | null
}

interface ForumPost extends ForumAuthor {
  id: string
  channel_id: string
  title: string
  content: string
  gif_url: string | null
  pinned: number
  reply_count: number
  last_reply_at: string
  created_at: string
}

interface ForumReply extends ForumAuthor {
  id: string
  post_id: string
  content: string
  gif_url: string | null
  created_at: string
}

interface GifResult {
  id: string
  title: string
  url: string
  original: string
}

function Avatar({ author, size = 32 }: { author: ForumAuthor; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, background: author.author_avatar_url ? 'transparent' : author.author_avatar_color, fontSize: size * 0.4 }}
    >
      {author.author_avatar_url
        ? <img src={author.author_avatar_url} alt="" className="w-full h-full object-cover" />
        : author.author_display_name.slice(0, 1).toUpperCase()
      }
    </div>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'przed chwilą'
  if (m < 60) return `${m} min temu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} godz. temu`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} dni temu`
  return new Date(iso).toLocaleDateString('pl', { day: 'numeric', month: 'short', year: 'numeric' })
}

function GifPicker({ onSelect, onClose }: { onSelect: (gif: GifResult) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const endpoint = q.trim()
        ? `${BASE}/api/gifs/search?q=${encodeURIComponent(q)}`
        : `${BASE}/api/gifs/trending`
      const res = await fetch(endpoint)
      const data = await res.json()
      setGifs((data.gifs ?? []).map((g: any) => ({
        id:       g.id,
        title:    g.title ?? '',
        url:      g.preview ?? g.url ?? '',
        original: g.url ?? '',
      })).filter((g: GifResult) => g.url))
    } catch { setGifs([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchGifs('') }, [fetchGifs])

  function handleSearch(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchGifs(val), 400)
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="absolute bottom-full mb-2 right-0 z-50 rounded-2xl overflow-hidden flex flex-col"
      style={{ width: 360, height: 360, background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
      {}
      <div className="px-3 pt-3 pb-2 flex-shrink-0 flex gap-2 items-center">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'var(--eb-bg3)', border: '0.5px solid var(--eb-border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input ref={inputRef} value={query} onChange={e => handleSearch(e.target.value)}
            placeholder="Szukaj gifów…"
            className="flex-1 bg-transparent outline-none text-xs" style={{ color: 'var(--eb-text1)' }} />
        </div>
        <button onClick={onClose} className="text-xs flex-shrink-0 hover:opacity-70 transition-opacity" style={{ color: 'var(--eb-text3)' }}>✕</button>
      </div>
      {}
      <div className="px-3 pb-1 flex-shrink-0">
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--eb-text3)' }}>Powered by Tenor</span>
      </div>
      {}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
        ) : (
          <div className="columns-3 gap-1.5 space-y-1.5">
            {gifs.map(gif => (
              <button key={gif.id} onClick={() => { onSelect(gif); onClose() }}
                className="w-full rounded-xl overflow-hidden block transition-all hover:scale-[1.03] hover:brightness-110"
                style={{ border: '0.5px solid var(--eb-border)' }}>
                <img src={gif.url} alt={gif.title} className="w-full block" loading="lazy" />
              </button>
            ))}
            {gifs.length === 0 && !loading && (
              <div className="col-span-3 text-center py-8 text-xs" style={{ color: 'var(--eb-text3)' }}>
                Brak wyników
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReplyInput({ postId, channelId, onReplyAdded }: { postId: string; channelId: string; onReplyAdded: (reply: ForumReply) => void }) {
  const { token } = useStore()
  const [text, setText] = useState('')
  const [gif, setGif] = useState<GifResult | null>(null)
  const [showGif, setShowGif] = useState(false)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function send() {
    if ((!text.trim() && !gif) || sending) return
    setSending(true)
    try {
      const res = await fetch(`${BASE}/api/forum/${channelId}/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim(), gifUrl: gif?.original ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onReplyAdded(data.reply)
      setText('')
      setGif(null)
    } catch (e: any) { alert(e.message) }
    finally { setSending(false) }
  }

  return (
    <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg1)' }}>
      {gif && (
        <div className="mb-2 relative inline-block">
          <img src={gif.url} alt="" className="h-20 rounded-xl" style={{ border: '0.5px solid var(--eb-border)' }} />
          <button onClick={() => setGif(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
            style={{ background: 'var(--eb-bg0)', border: '1px solid var(--eb-border2)', color: 'var(--eb-text2)' }}>✕</button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1 rounded-2xl px-4 py-2.5 flex items-end gap-2" style={{ background: 'var(--eb-bg3)', border: '0.5px solid var(--eb-border2)', minHeight: 44 }}>
          <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Napisz odpowiedź… (Enter aby wysłać)"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm leading-snug"
            style={{ color: 'var(--eb-text1)', maxHeight: 120 }} />
        </div>
        {}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowGif(v => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:brightness-110"
            style={{ background: showGif ? 'rgba(245,158,11,0.2)' : 'var(--eb-bg3)', border: `0.5px solid ${showGif ? 'rgba(245,158,11,0.5)' : 'var(--eb-border2)'}`, color: showGif ? 'var(--eb-accent)' : 'var(--eb-text2)' }}>
            GIF
          </button>
          {showGif && <GifPicker onSelect={g => { setGif(g); setShowGif(false) }} onClose={() => setShowGif(false)} />}
        </div>
        {}
        <button onClick={send} disabled={sending || (!text.trim() && !gif)}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:brightness-110 disabled:opacity-40"
          style={{ background: 'var(--eb-gradient)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function PostView({ post, channelId, onBack }: { post: ForumPost; channelId: string; onBack: () => void }) {
  const { token, currentUser } = useStore()
  const [replies, setReplies] = useState<ForumReply[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${BASE}/api/forum/${channelId}/posts/${post.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => {
      setReplies(d.replies ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [post.id, channelId, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies.length])

  async function deleteReply(replyId: string) {
    if (!confirm('Usunąć odpowiedź?')) return
    try {
      await fetch(`${BASE}/api/forum/${channelId}/posts/${post.id}/replies/${replyId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      setReplies(prev => prev.filter(r => r.id !== replyId))
    } catch {}
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {}
      <div className="flex-shrink-0 px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg1)' }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs transition-all hover:opacity-70 flex-shrink-0"
          style={{ color: 'var(--eb-text3)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Powrót
        </button>
        <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--eb-border)' }} />
        <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--eb-text1)' }}>{post.title}</h2>
        <span className="ml-auto text-xs flex-shrink-0 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text3)' }}>
          {post.reply_count} {post.reply_count === 1 ? 'odpowiedź' : post.reply_count < 5 ? 'odpowiedzi' : 'odpowiedzi'}
        </span>
      </div>

      {}
      <div className="flex-1 overflow-y-auto">
        {}
        <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--eb-border)' }}>
          <div className="flex items-start gap-3 mb-4">
            <Avatar author={post} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>{post.author_display_name}</span>
                {post.pinned ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--eb-accent)' }}>📌 Przypięty</span> : null}
                <span className="text-[11px] ml-auto" style={{ color: 'var(--eb-text3)' }}>{timeAgo(post.created_at)}</span>
              </div>
              <h1 className="text-xl font-bold mt-1 leading-snug" style={{ color: 'var(--eb-text1)' }}>{post.title}</h1>
            </div>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text2)' }}>{post.content}</p>
          {post.gif_url && (
            <img src={post.gif_url} alt="" className="mt-3 rounded-xl max-h-64 object-contain" style={{ border: '0.5px solid var(--eb-border)' }} />
          )}
        </div>

        {}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
        ) : replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'var(--eb-bg3)' }}>💬</div>
            <p className="text-sm font-medium" style={{ color: 'var(--eb-text2)' }}>Brak odpowiedzi</p>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Bądź pierwszy — napisz coś!</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--eb-border)' }}>
            {replies.map((reply) => (
              <div key={reply.id} className="flex items-start gap-3 px-5 py-4 group transition-colors hover:bg-white/[0.02]">
                <Avatar author={reply} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>{reply.author_display_name}</span>
                    <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>{timeAgo(reply.created_at)}</span>
                    {reply.author_id === currentUser?.id && (
                      <button onClick={() => deleteReply(reply.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] px-2 py-0.5 rounded-lg transition-all"
                        style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.2)' }}>
                        Usuń
                      </button>
                    )}
                  </div>
                  {reply.content && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--eb-text2)' }}>{reply.content}</p>}
                  {reply.gif_url && (
                    <img src={reply.gif_url} alt="" className="mt-2 rounded-xl max-h-48 object-contain" style={{ border: '0.5px solid var(--eb-border)' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ReplyInput postId={post.id} channelId={channelId}
        onReplyAdded={reply => setReplies(prev => [...prev, reply])} />
    </div>
  )
}

function CreatePostModal({ channelId, onClose, onCreated }: {
  channelId: string
  onClose: () => void
  onCreated: (post: ForumPost) => void
}) {
  const { token } = useStore()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [gif, setGif] = useState<GifResult | null>(null)
  const [showGif, setShowGif] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function create() {
    if (!title.trim() || !content.trim()) { setError('Uzupełnij tytuł i treść'); return }
    setCreating(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/forum/${channelId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), gifUrl: gif?.original ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error + (data.detail ? ` (${data.detail})` : ''))
      if (!data.post) throw new Error('Brak danych posta w odpowiedzi serwera')
      onCreated(data.post)
      onClose()
    } catch (e: any) { setError(e.message) }
    finally { setCreating(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)', maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        {}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--eb-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{ background: 'var(--eb-gradient)' }}>
              🗂
            </div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>Nowy post</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs hover:bg-white/10 transition-colors" style={{ color: 'var(--eb-text3)' }}>✕</button>
        </div>

        {}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text3)' }}>
              Tytuł *
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              maxLength={256}
              placeholder="Temat posta…"
              className="ember-input w-full px-4 py-2.5 text-sm" />
            <div className="flex justify-end mt-1">
              <span className="text-[10px]" style={{ color: title.length > 220 ? 'var(--eb-accent2)' : 'var(--eb-text3)' }}>{title.length}/256</span>
            </div>
          </div>

          {}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text3)' }}>
              Treść *
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Opisz szczegółowo temat…"
              rows={6}
              className="ember-input w-full px-4 py-3 text-sm resize-none leading-relaxed" />
          </div>

          {}
          {gif && (
            <div className="relative inline-block">
              <img src={gif.url} alt="" className="rounded-xl max-h-48 object-contain" style={{ border: '0.5px solid var(--eb-border)' }} />
              <button onClick={() => setGif(null)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                style={{ background: 'var(--eb-bg0)', border: '1px solid var(--eb-border2)', color: 'var(--eb-text2)' }}>✕</button>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}
        </div>

        {}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg1)' }}>
          {}
          <div className="relative">
            <button onClick={() => setShowGif(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
              style={{ background: showGif ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)', border: `0.5px solid ${showGif ? 'rgba(245,158,11,0.4)' : 'var(--eb-border)'}`, color: showGif ? 'var(--eb-accent)' : 'var(--eb-text2)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              GIF
            </button>
            {showGif && <GifPicker onSelect={g => { setGif(g); setShowGif(false) }} onClose={() => setShowGif(false)} />}
          </div>

          <div className="flex-1" />

          <button onClick={onClose} className="ember-btn-ghost px-4 py-2 text-sm">
            Anuluj
          </button>
          <button onClick={create} disabled={creating}
            className="ember-btn px-5 py-2 text-sm flex items-center gap-2">
            {creating ? (
              <><svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Tworzenie…</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Opublikuj post</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, onClick }: { post: ForumPost; onClick: () => void }) {
  const preview = post.content.length > 120 ? post.content.slice(0, 120) + '…' : post.content

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all group hover:bg-white/[0.04]"
      style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border)', outline: 'none' }}>
      <div className="flex items-start gap-3">
        {}
        <Avatar author={post} size={40} />

        {}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {post.pinned ? <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--eb-accent)' }}>📌</span> : null}
              <h3 className="text-sm font-semibold leading-snug transition-colors group-hover:text-[var(--eb-accent)]" style={{ color: 'var(--eb-text1)' }}>
                {post.title}
              </h3>
            </div>
            <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--eb-text3)' }}>{timeAgo(post.created_at)}</span>
          </div>

          <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--eb-text3)' }}>{preview}</p>

          {}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium" style={{ color: 'var(--eb-text3)' }}>
              {post.author_display_name}
            </span>
            <div className="flex-1" />
            {post.gif_url && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--eb-text3)' }}>GIF</span>
            )}
            <div className="flex items-center gap-1" style={{ color: 'var(--eb-text3)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span className="text-[11px] font-medium">{post.reply_count}</span>
            </div>
            <svg className="transition-transform group-hover:translate-x-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
    </button>
  )
}

export function ForumView({ channelId, channelName, channelTopic }: {
  channelId: string
  channelName: string
  channelTopic?: string | null
}) {
  const { token } = useStore()
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activePost, setActivePost] = useState<ForumPost | null>(null)
  const [search, setSearch] = useState('')

  const [loadError, setLoadError] = useState('')

  const loadPosts = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`${BASE}/api/forum/${channelId}/posts?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setPosts(data.posts ?? [])
    } catch (e: any) {
      console.error('[forum/loadPosts]', e)
      setLoadError(e.message ?? 'Błąd ładowania postów')
      setPosts([])
    }
    finally { setLoading(false) }
  }, [channelId, token])

  useEffect(() => { loadPosts() }, [loadPosts])

  const filtered = posts.filter(p =>
    !search.trim() ||
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase()) ||
    p.author_display_name.toLowerCase().includes(search.toLowerCase())
  )

  if (activePost) {
    return <PostView post={activePost} channelId={channelId} onBack={() => { setActivePost(null); loadPosts() }} />
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {}
      <div className="flex-shrink-0 px-5 py-4 border-b" style={{ borderColor: 'var(--eb-border)', background: 'var(--eb-bg1)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">🗂</span>
              <h2 className="text-sm font-bold" style={{ color: 'var(--eb-text1)' }}>{channelName}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text3)' }}>
                {posts.length} {posts.length === 1 ? 'post' : 'postów'}
              </span>
            </div>
            {channelTopic && <p className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>{channelTopic}</p>}
          </div>
          <div className="flex-1" />
          <button onClick={() => setShowCreate(true)}
            className="ember-btn flex items-center gap-1.5 px-4 py-2 text-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nowy post
          </button>
        </div>
        {}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--eb-bg3)', border: '0.5px solid var(--eb-border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj postów…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--eb-text1)' }} />
          {search && <button onClick={() => setSearch('')} className="text-[10px] hover:opacity-70" style={{ color: 'var(--eb-text3)' }}>✕</button>}
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loadError ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs text-center max-w-xs" style={{ color: 'var(--eb-accent2)' }}>{loadError}</p>
            <button onClick={loadPosts} className="ember-btn px-4 py-1.5 text-xs">Spróbuj ponownie</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48 gap-2">
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>Ładowanie postów…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.1))', border: '0.5px solid rgba(245,158,11,0.2)' }}>
              🗂
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--eb-text1)' }}>
                {search ? 'Brak wyników' : 'Brak postów'}
              </p>
              <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>
                {search ? `Nic nie pasuje do „${search}"` : 'Bądź pierwszy — utwórz nowy post!'}
              </p>
            </div>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="ember-btn px-5 py-2 text-sm">
                Utwórz pierwszy post
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(post => (
              <PostCard key={post.id} post={post} onClick={() => setActivePost(post)} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePostModal
          channelId={channelId}
          onClose={() => setShowCreate(false)}
          onCreated={post => { setPosts(prev => [post, ...prev]); setActivePost(post) }}
        />
      )}
    </div>
  )
}
