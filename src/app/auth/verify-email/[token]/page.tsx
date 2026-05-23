'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { tokenStore } from '@/lib/api'
import Link from 'next/link'

export default function VerifyTokenPage() {
  const { token } = useParams<{ token: string }>()
  const router    = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    fetch(`${BASE}/api/auth/verify-email/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.token && data.user) {
          tokenStore.set(data.token)
          setStatus('success')
          setTimeout(() => router.push('/'), 2000)
        } else {
          setStatus('error')
          setMessage(data.error ?? 'Błąd weryfikacji')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Błąd połączenia z serwerem')
      })
  }, [token, router])

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4"
          style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>N</div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--eb-text1)' }}>Weryfikacja konta</h1>
      </div>

      <div className="rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-5 text-center"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
              <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-base" style={{ color: 'var(--eb-text1)' }}>Weryfikowanie adresu email...</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--eb-text2)' }}>Poczekaj chwilę</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-base" style={{ color: 'var(--eb-text1)' }}>Email potwierdzony!</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--eb-text2)' }}>
                Konto zostało aktywowane. Przekierowanie do aplikacji...
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--eb-text3)' }}>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Przekierowywanie...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(220,38,38,0.12)', border: '1.5px solid rgba(220,38,38,0.3)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-base" style={{ color: 'var(--eb-text1)' }}>Weryfikacja nieudana</h3>
              <p className="text-sm mt-1" style={{ color: '#f87171' }}>{message}</p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <Link href="/auth/login"
                className="ember-btn w-full text-sm font-semibold flex items-center justify-center"
                style={{ minHeight: 42 }}>
                Przejdź do logowania
              </Link>
              <Link href="/auth/register"
                className="ember-btn-ghost w-full text-sm flex items-center justify-center"
                style={{ minHeight: 42 }}>
                Utwórz nowe konto
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
