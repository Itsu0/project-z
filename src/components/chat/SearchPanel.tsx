'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface SearchResult {
  id: string
  channel_id: string
  content: string
  created_at: string
  author_display_name: string
  author_avatar_color: string
  author_avatar_url: string | null
  channel_name: string
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(245,158,11,0.35)', color: 'var(--eb-accent)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function SearchPanel({ onClose, onJumpTo }: {
  onClose: () => void
  onJumpTo: (channelId: string, messageId: string) => void
}) {
  const { token, currentServerId } = useStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const search = useCallback(async (q: string) => {
    if (!token || !currentServerId || q.trim().length < 2) {
      setResults([]); setSearched(false); return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `${BASE}/api/channels/${currentServerId}/search?q=${encodeURIComponent(q.trim())}&limit=25`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      setResults(data.messages ?? [])
      setSearched(true)
    } catch {}
    finally { setLoading(false) }
  }, [token, currentServerId])

  function handleChange(val: string) {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 350)
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pl', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full max-w-xl flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)', maxHeight: '70vh', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--eb-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2" className="flex-shrink-0">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(query) }}
            placeholder="Szukaj wiadomości na tym serwerze…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--eb-text1)' }}
          />
          {loading && (
            <svg className="animate-spin flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          )}
          {query && !loading && (
            <button onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus() }}
              className="flex-shrink-0 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--eb-text3)' }}>✕</button>
          )}
          <kbd className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text3)' }}>Esc</kbd>
        </div>

        {}
        <div className="flex-1 overflow-y-auto">
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Wpisz frazę aby wyszukać wiadomości</p>
            </div>
          )}

          {searched && results.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-2xl">🔍</span>
              <p className="text-xs font-medium" style={{ color: 'var(--eb-text2)' }}>Brak wyników dla „{query}"</p>
              <p className="text-[11px]" style={{ color: 'var(--eb-text3)' }}>Spróbuj innej frazy</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--eb-text3)' }}>
                {results.length} {results.length === 1 ? 'wynik' : results.length < 5 ? 'wyniki' : 'wyników'}
              </div>
              {results.map(msg => (
                <button key={msg.id}
                  onClick={() => { onJumpTo(msg.channel_id, msg.id); onClose() }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 overflow-hidden"
                    style={{ background: msg.author_avatar_url ? 'transparent' : msg.author_avatar_color }}>
                    {msg.author_avatar_url
                      ? <img src={msg.author_avatar_url} alt="" className="w-full h-full object-cover" />
                      : msg.author_display_name.slice(0, 1).toUpperCase()
                    }
                  </div>

                  {/* Treść */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>
                        {msg.author_display_name}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--eb-accent)' }}>
                        ~{msg.channel_name}
                      </span>
                      <span className="text-[10px] ml-auto" style={{ color: 'var(--eb-text3)' }}>
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-xs leading-snug line-clamp-2" style={{ color: 'var(--eb-text2)' }}>
                      {highlight(msg.content, query)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t flex items-center gap-3" style={{ borderColor: 'var(--eb-border)' }}>
          <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
            <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: 'rgba(255,255,255,0.06)' }}>Enter</kbd> — szukaj
          </span>
          <span className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
            <kbd className="px-1 py-0.5 rounded text-[9px]" style={{ background: 'rgba(255,255,255,0.06)' }}>↵</kbd> kliknij wynik — przejdź do wiadomości
          </span>
        </div>
      </div>
    </div>
  )
}
