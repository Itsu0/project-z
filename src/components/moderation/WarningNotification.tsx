'use client'
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { getSocketInstance } from '@/hooks/useSocket'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Warning {
  id: string
  reason: string
  created_at: string
}

export function WarningNotification() {
  const { token } = useStore()
  const [queue,         setQueue]        = useState<Warning[]>([])
  const [current,       setCurrent]      = useState<Warning | null>(null)
  const [reply,         setReply]        = useState('')
  const [acknowledging, setAcknowledging] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${BASE}/api/user/warnings?unseen=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.warnings?.length > 0) setQueue(d.warnings) })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    const handler = (data: Warning) => {
      setQueue(prev => {
        if (prev.some(w => w.id === data.id)) return prev
        return [...prev, data]
      })
    }

    function attach() {
      const socket = getSocketInstance()
      if (!socket) return
      socket.on('WARNING_RECEIVED', handler)
      if (interval) clearInterval(interval)
      interval = null
    }

    const socket = getSocketInstance()
    if (socket) attach()
    else interval = setInterval(attach, 500)

    return () => {
      if (interval) clearInterval(interval)
      getSocketInstance()?.off('WARNING_RECEIVED', handler)
    }
  }, [])

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0])
      setReply('')
    }
  }, [queue, current])

  const acknowledge = useCallback(async () => {
    if (!current || !token) return
    setAcknowledging(true)
    try {
      await fetch(`${BASE}/api/user/warnings/${current.id}/seen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply: reply.trim() || undefined }),
      })
    } catch {}
    setQueue(prev => prev.filter(w => w.id !== current.id))
    setCurrent(null)
    setAcknowledging(false)
  }, [current, token, reply])

  if (!current) return null

  const remaining = queue.length - 1

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxWidth: 460,
          background: 'var(--eb-bg2)',
          border: '1px solid rgba(245,158,11,0.4)',
          boxShadow: '0 0 80px rgba(245,158,11,0.12)',
        }}>

        {}
        <div className="flex items-center gap-3 px-5 py-3.5"
          style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.2)' }}>⚠️</div>
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: '#f59e0b' }}>Oficjalne ostrzeżenie</p>
            <p className="text-[11px]" style={{ color: 'rgba(245,158,11,0.65)' }}>od twórcy platformy Nexus</p>
          </div>
          {remaining > 0 && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              +{remaining} więcej
            </span>
          )}
        </div>

        {}
        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--eb-text3)' }}>Powód ostrzeżenia</p>
            <div className="px-4 py-3 rounded-xl"
              style={{ background: 'var(--eb-bg3)', border: '1px solid var(--eb-border)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--eb-text1)' }}>
                {current.reason}
              </p>
            </div>
          </div>

          {}
          <div className="px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--eb-text2)' }}>
              Naruszanie regulaminu może skutkować trwałym zablokowaniem konta.
              Możesz wyjaśnić swoją sytuację poniżej — twórca platformy zapozna się z odpowiedzią.
            </p>
          </div>

          {}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--eb-text3)' }}>
              Twoje wyjaśnienie <span style={{ color: 'var(--eb-text3)', opacity: 0.6, textTransform: 'none', fontWeight: 400 }}>(opcjonalne)</span>
            </p>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Napisz swoje wyjaśnienie... Możesz też zrobić to później w zakładce Ostrzeżenia w panelu wsparcia."
              className="ember-input w-full px-3 py-2.5 text-sm resize-none"
            />
            {reply.length > 1800 && (
              <p className="text-[10px] mt-1 text-right" style={{ color: reply.length > 1950 ? 'var(--eb-accent2)' : 'var(--eb-text3)' }}>
                {reply.length}/2000
              </p>
            )}
          </div>

          {}
          <p className="text-[10px] text-center -mt-1" style={{ color: 'var(--eb-text3)' }}>
            {new Date(current.created_at).toLocaleString('pl-PL', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>

          {}
          <button
            onClick={acknowledge}
            disabled={acknowledging}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              color: '#fff',
              opacity: acknowledging ? 0.7 : 1,
              boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
            }}
            onMouseEnter={e => !acknowledging && (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => !acknowledging && (e.currentTarget.style.opacity = '1')}>
            {acknowledging
              ? 'Zapisywanie...'
              : reply.trim()
                ? 'Wyślij wyjaśnienie i potwierdź'
                : 'Rozumiem i potwierdzam zapoznanie się'}
          </button>
        </div>
      </div>
    </div>
  )
}
