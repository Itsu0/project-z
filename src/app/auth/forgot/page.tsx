'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function ForgotPasswordPage() {
  const t = useT()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.serverError'))
      setSent(true)
    } catch (err: any) {
      setError(err.message ?? t('common.serverError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4"
          style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>N</div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--eb-text1)' }}>
          {sent ? t('auth.forgot.titleSent') : t('auth.forgot.title')}
        </h1>
        <p className="text-sm mt-1 text-center" style={{ color: 'var(--eb-text2)' }}>
          {sent ? t('auth.forgot.subtitleSent') : t('auth.forgot.subtitle')}
        </p>
      </div>

      <div className="rounded-2xl p-6 sm:p-8"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        {sent ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--eb-text2)' }}>
              {t('auth.forgot.sentMsg', { email })}
            </p>
            <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>{t('auth.forgot.spamHint')}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                {t('auth.forgot.emailLabel')}
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus placeholder="you@example.com"
                className="ember-input w-full px-4 py-3" style={{ fontSize: 16 }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(220,38,38,0.12)', border: '0.5px solid rgba(220,38,38,0.3)', color: '#f87171' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="ember-btn w-full mt-1"
              style={{ minHeight: 44, fontSize: 14, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
              {loading ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
            </button>
          </form>
        )}

        <p className="text-center text-sm mt-6" style={{ color: 'var(--eb-text2)' }}>
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: 'var(--eb-accent)' }}>
            {t('auth.forgot.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  )
}
