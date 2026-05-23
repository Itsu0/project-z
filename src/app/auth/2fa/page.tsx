'use client'
import { useState, FormEvent, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { tokenStore } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function TwoFAForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setAuth } = useStore()
  const tempToken = searchParams.get('t') ?? ''

  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!tempToken) router.replace('/auth/login')
  }, [tempToken, router])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: code.replace(/\s/g, '') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Nieprawidłowy kod')
      tokenStore.set(data.token)
      setAuth(data.token, data.user)
      router.push('/')
    } catch (err: any) {
      setError(err.message)
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4"
          style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>N</div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--eb-text1)' }}>Weryfikacja dwuskładnikowa</h1>
        <p className="text-sm mt-1 text-center" style={{ color: 'var(--eb-text2)' }}>
          Podaj 6-cyfrowy kod z aplikacji uwierzytelniającej
        </p>
      </div>

      <div className="rounded-2xl p-6 sm:p-8"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
              Kod 2FA
            </label>
            <input
              type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7}
              value={code} onChange={e => setCode(e.target.value)}
              required autoFocus placeholder="123 456"
              className="ember-input w-full px-4 py-3 text-center tracking-widest text-lg font-mono"
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

          <button type="submit" disabled={loading || code.replace(/\s/g,'').length !== 6}
            className="ember-btn w-full" style={{ minHeight: 44, fontSize: 14, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Weryfikowanie...' : 'Potwierdź'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TwoFAPage() {
  return <Suspense><TwoFAForm /></Suspense>
}
