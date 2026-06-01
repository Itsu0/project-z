'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { tokenStore } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type View = 'loading' | 'pending' | 'paid' | 'provisioned' | 'failed' | 'error'

const POLL_MS = 2500
const TIMEOUT_MS = 90_000 // po tym czasie przestajemy odpytywać (płatność może dojść później)

export default function BillingReturnPage() {
  const router = useRouter()
  const [view,   setView]   = useState<View>('loading')
  const [server, setServer] = useState<{ id: string; name: string } | null>(null)
  const [error,  setError]  = useState('')
  const startedAt = useRef<number>(Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('order') || params.get('orderId')
    const token = tokenStore.get()

    if (!orderId) { setError('Brak identyfikatora zamówienia'); setView('error'); return }

    async function poll() {
      try {
        const r = await fetch(`${BASE}/api/billing/orders/${orderId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        })
        if (!r.ok) {
          if (r.status === 404) { setError('Nie znaleziono zamówienia'); setView('error'); return }
          throw new Error()
        }
        const d = await r.json()
        const status = d.order?.status as string

        if (status === 'provisioned') {
          setServer(d.server ?? null)
          setView('provisioned')
          return
        }
        if (status === 'failed' || status === 'cancelled') {
          setView('failed')
          return
        }
        // pending / paid — czekamy na webhook + provisioning
        setView(status === 'paid' ? 'paid' : 'pending')

        if (Date.now() - startedAt.current < TIMEOUT_MS) {
          timer.current = setTimeout(poll, POLL_MS)
        }
      } catch {
        if (Date.now() - startedAt.current < TIMEOUT_MS) {
          timer.current = setTimeout(poll, POLL_MS)
        } else {
          setError('Błąd połączenia'); setView('error')
        }
      }
    }

    poll()
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  const Spinner = (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--eb-voice)" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--eb-bg0)' }}>
      <div className="rounded-3xl p-8 w-full max-w-md text-center"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {(view === 'loading' || view === 'pending' || view === 'paid') && (
          <>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(74,158,255,0.1)' }}>{Spinner}</div>
            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--eb-text1)' }}>
              {view === 'paid' ? 'Płatność potwierdzona' : 'Przetwarzanie płatności…'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--eb-text3)' }}>
              {view === 'paid'
                ? 'Tworzymy Twój serwer — to potrwa chwilę.'
                : 'Oczekiwanie na potwierdzenie od operatora płatności. Nie zamykaj tej strony.'}
            </p>
          </>
        )}

        {view === 'provisioned' && (
          <>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.12)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--eb-text1)' }}>Serwer gotowy!</h1>
            <p className="text-sm mb-5" style={{ color: 'var(--eb-text3)' }}>
              {server?.name ? <>Serwer „{server.name}" został utworzony.</> : 'Twój serwer został utworzony.'}
            </p>
            <button onClick={() => router.push('/')}
              className="ember-btn w-full py-2.5 text-sm font-semibold">
              Przejdź do aplikacji
            </button>
          </>
        )}

        {view === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.12)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--eb-text1)' }}>Płatność nieudana</h1>
            <p className="text-sm mb-5" style={{ color: 'var(--eb-text3)' }}>
              Płatność została anulowana lub odrzucona. Nie pobrano żadnych środków.
            </p>
            <button onClick={() => router.push('/')}
              className="ember-btn-ghost w-full py-2.5 text-sm">
              Wróć do aplikacji
            </button>
          </>
        )}

        {view === 'error' && (
          <>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.12)' }}>
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--eb-text1)' }}>Nie udało się sprawdzić statusu</h1>
            <p className="text-sm mb-5" style={{ color: 'var(--eb-text3)' }}>
              {error || 'Spróbuj odświeżyć stronę.'} Jeśli płatność przeszła, serwer pojawi się w aplikacji za chwilę.
            </p>
            <button onClick={() => router.push('/')}
              className="ember-btn-ghost w-full py-2.5 text-sm">
              Wróć do aplikacji
            </button>
          </>
        )}

        {(view === 'pending' || view === 'paid') && (
          <p className="text-[11px] mt-5" style={{ color: 'var(--eb-text3)' }}>
            Status zaktualizuje się automatycznie. Możesz też sprawdzić go później w aplikacji.
          </p>
        )}
      </div>
    </div>
  )
}
