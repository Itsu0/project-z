'use client'
import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  channelId: string
  serverId:  string
  onClose:   () => void
}

export function PollModal({ channelId, serverId, onClose }: Props) {
  const t = useT()
  const { token } = useStore()

  const DURATION_PRESETS: { label: string; minutes: number | null }[] = [
    { label: t('poll.noLimit'), minutes: null },
    { label: '5 min',          minutes: 5    },
    { label: '10 min',         minutes: 10   },
    { label: '30 min',         minutes: 30   },
    { label: '1 h',            minutes: 60   },
    { label: '6 h',            minutes: 360  },
    { label: '24 h',           minutes: 1440 },
  ]
  const [question, setQuestion]             = useState('')
  const [options, setOptions]               = useState(['', ''])
  const [expiresMinutes, setExpiresMinutes] = useState<number | null>(null)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])

  const addOption = () => {
    if (options.length < 8) setOptions(p => [...p, ''])
  }

  const removeOption = (i: number) => {
    if (options.length <= 2) return
    setOptions(p => p.filter((_, idx) => idx !== i))
  }

  const updateOption = (i: number, val: string) => {
    setOptions(p => p.map((o, idx) => (idx === i ? val : o)))
  }

  const handleCreate = async () => {
    if (!question.trim()) { setError(t('poll.errorQuestion')); return }
    const filled = options.filter(o => o.trim())
    if (filled.length < 2) { setError(t('poll.errorOptions')); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BASE}/api/channels/${channelId}/polls`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          question:      question.trim(),
          options:       filled,
          serverId,
          expiresMinutes,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Błąd serwera')
        return
      }
      onClose()
    } catch {
      setError('Błąd połączenia z serwerem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        ref={wrapRef}
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col gap-4"
        style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'var(--eb-text1)' }}>{t('poll.title')}</h2>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: 'var(--eb-text3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--eb-text3)' }}>
            {t('poll.question')}
          </label>
          <input
            autoFocus
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder={t('poll.questionPlaceholder')}
            maxLength={512}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid var(--eb-border2)',
              color: 'var(--eb-text1)',
            }}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--eb-text3)' }}>
            {t('poll.options', { n: options.length })}
          </label>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  placeholder={t('poll.optionPlaceholder', { n: i + 1 })}
                  maxLength={256}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '0.5px solid var(--eb-border2)',
                    color: 'var(--eb-text1)',
                  }}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="w-6 h-6 rounded flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--eb-text3)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button
              onClick={addOption}
              className="mt-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--eb-accent)', background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--eb-border2)' }}
            >
              {t('poll.addOption')}
            </button>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: 'var(--eb-text3)' }}>
            {t('poll.duration')}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map(preset => {
              const active = expiresMinutes === preset.minutes
              return (
                <button
                  key={preset.label}
                  onClick={() => setExpiresMinutes(preset.minutes)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.06)',
                    color:      active ? '#fff' : 'var(--eb-text2)',
                    border:     active ? 'none' : '0.5px solid var(--eb-border2)',
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          {expiresMinutes !== null && (
            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--eb-text3)' }}>
              {t('poll.closesAt', { time: new Date(Date.now() + expiresMinutes * 60_000).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' }) })}
            </p>
          )}
        </div>

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text3)' }}
          >
            {t('poll.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: loading ? 'rgba(255,255,255,0.1)' : 'var(--eb-gradient)',
              color: loading ? 'var(--eb-text3)' : '#fff',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? t('poll.creating') : t('poll.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
