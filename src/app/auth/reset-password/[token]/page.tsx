'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function ResetPasswordPage() {
  const params = useParams()
  const token = params.token as string
  const router = useRouter()

  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Hasła nie są takie same'); return }
    if (password.length < 8)  { setError('Hasło musi mieć minimum 8 znaków'); return }
    if (/^\d+$/.test(password)) { setError('Hasło nie może składać się wyłącznie z cyfr'); return }
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Błąd serwera')
      setDone(true)
      setTimeout(() => router.push('/auth/login'), 3000)
    } catch (err: any) {
      setError(err.message ?? 'Błąd serwera')
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
          {done ? 'Hasło zmienione' : 'Nowe hasło'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--eb-text2)' }}>
          {done ? 'Za chwilę zostaniesz przekierowany' : 'Ustaw nowe hasło do konta'}
        </p>
      </div>

      <div className="rounded-2xl p-6 sm:p-8"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        {done ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--eb-text2)' }}>
              Hasło zostało pomyślnie zmienione. Za chwilę zostaniesz przekierowany na stronę logowania.
            </p>
            <Link href="/auth/login" className="ember-btn text-sm font-semibold px-6 py-2.5">
              Zaloguj się teraz
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Nowe hasło
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  required autoFocus placeholder="••••••••"
                  className="ember-input w-full px-4 py-3 pr-12" style={{ fontSize: 16 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--eb-text3)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Potwierdź hasło
              </label>
              <input
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required placeholder="••••••••"
                className="ember-input w-full px-4 py-3"
                style={Object.assign({ fontSize: 16 },
                  confirm && password !== confirm ? { borderColor: 'rgba(220,38,38,0.5)' } : {}
                )}
              />
              {confirm && password !== confirm && (
                <p className="text-[10px]" style={{ color: 'var(--eb-accent2)' }}>Hasła nie są takie same</p>
              )}
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
              {loading ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
