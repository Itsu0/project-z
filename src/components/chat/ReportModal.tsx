'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const CATS = [
  { value: 'abuse',    label: 'Naruszenie regulaminu', icon: '🚨' },
  { value: 'spam',     label: 'Spam',                  icon: '📢' },
  { value: 'security', label: 'Zagrożenie',            icon: '🔒' },
  { value: 'other',    label: 'Inne',                  icon: '💬' },
]

interface Props {
  messageId: string
  channelId: string
  serverId: string
  messageContent: string
  authorName: string
  onClose: () => void
}

export function ReportModal({ messageId, channelId, serverId, messageContent, authorName, onClose }: Props) {
  const { token } = useStore()
  const [category, setCategory] = useState('abuse')
  const [desc,     setDesc]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState('')

  async function submit() {
    if (!desc.trim()) { setError('Opisz problem'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category,
          subject: `Zgłoszenie wiadomości od ${authorName}`,
          description: desc.trim(),
          server_id: serverId || undefined,
          channel_id: channelId || undefined,
          message_id: messageId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Błąd'); return }
      setSent(true)
      setTimeout(onClose, 1800)
    } catch { setError('Błąd serwera') }
    finally { setLoading(false) }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl w-full flex flex-col gap-4 p-5"
        style={{ maxWidth: 400, background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🚩</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>Zgłoś wiadomość</p>
              <p className="text-[11px]" style={{ color: 'var(--eb-text3)' }}>od {authorName}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--eb-text3)', background: 'var(--eb-bg3)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {messageContent && (
          <div className="px-3 py-2 rounded-xl text-xs leading-relaxed"
            style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)', color: 'var(--eb-text2)', maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span className="block truncate" style={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
              {messageContent}
            </span>
          </div>
        )}

        {sent ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>✓</div>
            <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>Zgłoszenie wysłane</p>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Twórca platformy zajmie się nim wkrótce.</p>
          </div>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide mb-2 block"
                style={{ color: 'var(--eb-text3)' }}>Powód</label>
              <div className="grid grid-cols-2 gap-1.5">
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
              <label className="text-[10px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--eb-text3)' }}>Opis</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)}
                rows={3} maxLength={2000}
                placeholder="Opisz, dlaczego zgłaszasz tę wiadomość..."
                className="ember-input w-full px-3 py-2 text-xs resize-none" />
            </div>

            {error && <p className="text-xs" style={{ color: 'var(--eb-accent2)' }}>{error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text2)', border: '1px solid var(--eb-border)' }}>
                Anuluj
              </button>
              <button onClick={submit} disabled={loading || !desc.trim()}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(220,38,38,0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(220,38,38,0.35)',
                  opacity: loading || !desc.trim() ? 0.5 : 1,
                }}>
                {loading ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
