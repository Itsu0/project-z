'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { tokenStore } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const { token, setAuth, setServers, servers } = useStore()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading')
  const [server, setServer] = useState<any>(null)
  const [error,  setError]  = useState('')

  useEffect(() => {
    const t = token ?? tokenStore.get()
    if (!t) { router.push(`/auth/login?redirect=/invite/${code}`); return }

    fetch(`${BASE}/api/servers/invite/${code}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setStatus('error'); return }
        setServer(data.server)
        setStatus(data.alreadyMember ? 'already' : 'success')
        if (!data.alreadyMember) {
          fetch(`${BASE}/api/servers`, { headers: { Authorization: `Bearer ${t}` } })
            .then(r => r.json())
            .then(d => setServers(d.servers ?? []))
        }
      })
      .catch(() => { setError('Błąd połączenia'); setStatus('error') })
  }, [code])

  function goToServer() {
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--eb-bg0)' }}>
      <div className="rounded-3xl p-8 w-full max-w-md text-center"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(74,158,255,0.1)' }}>
              <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--eb-voice)" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
            <p style={{ color: 'var(--eb-text2)' }}>Sprawdzam zaproszenie...</p>
          </>
        )}

        {(status === 'success' || status === 'already') && server && (
          <>
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-3xl font-bold overflow-hidden"
              style={{ background: server.icon_url ? 'transparent' : server.icon_color }}>
              {server.icon_url
                ? <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                : server.name.slice(0,1).toUpperCase()
              }
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--eb-text1)' }}>{server.name}</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--eb-text3)' }}>
              {status === 'already' ? 'Jesteś już członkiem tego serwera.' : 'Dołączyłeś do serwera!'}
            </p>
            <button onClick={goToServer} className="ember-btn px-8 py-3 w-full text-sm">
              {status === 'already' ? 'Przejdź do serwera' : '🎉 Wejdź na serwer'}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
              style={{ background: 'rgba(220,38,38,0.1)' }}>
              ❌
            </div>
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--eb-accent2)' }}>
              Nieprawidłowe zaproszenie
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--eb-text3)' }}>{error}</p>
            <button onClick={() => router.push('/')} className="ember-btn-ghost px-6 py-2 text-sm">
              Wróć do strony głównej
            </button>
          </>
        )}
      </div>
    </div>
  )
}
