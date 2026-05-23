'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function VerifyEmailContent() {
  const params = useSearchParams()
  const email  = params.get('email') ?? ''
  const [resending, setResending] = useState(false)
  const [resent,    setResent]    = useState(false)

  async function resend() {
    if (!email) return
    setResending(true)
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      await fetch(`${BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4"
          style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>N</div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--eb-text1)' }}>Sprawdź email</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--eb-text2)' }}>Potwierdź swój adres e-mail</p>
      </div>

      <div className="rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-5 text-center"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <div>
          <h3 className="font-semibold text-base" style={{ color: 'var(--eb-text1)' }}>Link aktywacyjny wysłany!</h3>
          {email && (
            <>
              <p className="text-sm mt-1.5" style={{ color: 'var(--eb-text2)' }}>Wysłaliśmy email na adres</p>
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--eb-accent)' }}>{email}</p>
            </>
          )}
        </div>

        <div className="w-full px-4 py-3 rounded-xl text-xs text-left"
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--eb-border)' }}>
          <p style={{ color: 'var(--eb-text2)' }}>
            Kliknij link w emailu, aby aktywować konto. Link wygasa po{' '}
            <strong style={{ color: 'var(--eb-text1)' }}>24 godzinach</strong>.
          </p>
          <p className="mt-1.5" style={{ color: 'var(--eb-text3)' }}>Nie widzisz emaila? Sprawdź folder spam.</p>
        </div>

        {resent && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm w-full"
            style={{ background: 'rgba(34,197,94,0.1)', border: '0.5px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Email weryfikacyjny wysłany ponownie!
          </div>
        )}

        {email && (
          <button onClick={resend} disabled={resending}
            className="ember-btn-ghost w-full text-sm" style={{ minHeight: 42, opacity: resending ? 0.6 : 1 }}>
            {resending ? 'Wysyłanie...' : 'Wyślij email ponownie'}
          </button>
        )}

        <p className="text-sm" style={{ color: 'var(--eb-text2)' }}>
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: 'var(--eb-accent)' }}>
            ← Wróć do logowania
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
