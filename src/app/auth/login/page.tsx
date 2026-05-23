'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { tokenStore } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [showPass,      setShowPass]      = useState(false)
  const [unverified,    setUnverified]    = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [resending,     setResending]     = useState(false)
  const [resent,        setResent]        = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setUnverified(false)
    setLoading(true)
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(data.email ?? email)
          setUnverified(true)
        } else {
          setError(data.error ?? 'Błąd logowania')
        }
        return
      }
      tokenStore.set(data.token)
      router.push('/')
    } catch {
      setError('Błąd połączenia z serwerem')
    } finally {
      setLoading(false)
    }
  }

  async function resendVerification() {
    setResending(true)
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      await fetch(`${BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: unverifiedEmail }),
      })
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>

      <div
        className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6 text-sm"
        style={{
          background: 'rgba(245,158,11,0.1)',
          border: '0.5px solid rgba(245,158,11,0.35)',
          color: '#fbbf24',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <p className="font-semibold leading-snug">Wersja testowa (produkcyjna)</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(251,191,36,0.75)' }}>
            Ta aplikacja jest w fazie testów. Dane mogą zostać zresetowane. Używaj na własne ryzyko.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4"
          style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}
        >
          N
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--eb-text1)' }}>
          Witaj z powrotem
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--eb-text2)' }}>
          Zaloguj się do Project-Z
        </p>
      </div>

      <div
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: 'var(--eb-bg2)',
          border: '0.5px solid var(--eb-border2)',
        }}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-wide uppercase"
              style={{ color: 'var(--eb-text2)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="twoj@email.com"
              className="ember-input w-full px-4 py-3"
              style={{ fontSize: 16 }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-wide uppercase"
                style={{ color: 'var(--eb-text2)' }}>
                Hasło
              </label>
              <Link href="/auth/forgot"
                className="text-xs hover:underline"
                style={{ color: 'var(--eb-voice)' }}>
                Zapomniałeś hasła?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="ember-input w-full px-4 py-3 pr-12"
                style={{ fontSize: 16 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--eb-text3)' }}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {unverified && (
            <div className="flex flex-col gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(245,158,11,0.1)', border: '0.5px solid rgba(245,158,11,0.35)' }}>
              <div className="flex items-start gap-2.5" style={{ color: '#fbbf24' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span>Adres e-mail nie został potwierdzony. Sprawdź skrzynkę pocztową.</span>
              </div>
              {resent ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: '#4ade80' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Email weryfikacyjny wysłany ponownie!
                </div>
              ) : (
                <button onClick={resendVerification} disabled={resending}
                  className="text-xs font-semibold text-left hover:underline"
                  style={{ color: '#f59e0b', opacity: resending ? 0.6 : 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {resending ? 'Wysyłanie...' : 'Wyślij email weryfikacyjny ponownie →'}
                </button>
              )}
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(220,38,38,0.12)', border: '0.5px solid rgba(220,38,38,0.3)', color: '#f87171' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ember-btn w-full mt-1"
            style={{ opacity: loading ? 0.7 : 1, minHeight: 44, fontSize: 14, fontWeight: 600 }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Logowanie...
              </span>
            ) : 'Zaloguj się'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: 'var(--eb-border)' }} />
          <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>lub</span>
          <div className="flex-1 h-px" style={{ background: 'var(--eb-border)' }} />
        </div>

        <p className="text-center text-sm" style={{ color: 'var(--eb-text2)' }}>
          Nie masz konta?{' '}
          <Link href="/auth/register"
            className="font-semibold hover:underline"
            style={{ color: 'var(--eb-accent)' }}>
            Zarejestruj się
          </Link>
        </p>
      </div>

    </div>
  )
}
