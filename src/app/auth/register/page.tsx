'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, tokenStore } from '@/lib/api'

const AVATAR_COLORS = [
  'linear-gradient(135deg,#dc2626,#991b1b)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#22c55e,#15803d)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#ec4899,#be185d)',
  'linear-gradient(135deg,#06b6d4,#0891b2)',
  'linear-gradient(135deg,#f97316,#ea580c)',
]

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'Min. 8 znaków',      ok: password.length >= 8 },
    { label: 'Wielka litera',      ok: /[A-Z]/.test(password) },
    { label: 'Cyfra lub znak',     ok: /[0-9!@#$%^&*]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['var(--eb-accent2)', 'var(--eb-accent)', 'var(--eb-online)']
  const labels = ['Słabe', 'Średnie', 'Silne']

  if (!password) return null

  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[0,1,2].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score - 1] : 'var(--eb-bg4)' }} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          {checks.map(c => (
            <span key={c.label} className="flex items-center gap-1 text-[10px]"
              style={{ color: c.ok ? 'var(--eb-online)' : 'var(--eb-text3)' }}>
              <span>{c.ok ? '✓' : '○'}</span>{c.label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span className="text-[10px] font-semibold" style={{ color: colors[score - 1] }}>
            {labels[score - 1]}
          </span>
        )}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)

  const [email,    setEmail]    = useState('')
  const [username, setUsername] = useState('')

  const [displayName,   setDisplayName]   = useState('')
  const [password,      setPassword]      = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [avatarColor,   setAvatarColor]   = useState(AVATAR_COLORS[0])
  const [showPass,      setShowPass]      = useState(false)

  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function goStep2(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (username.length < 2) { setError('Nazwa użytkownika musi mieć minimum 2 znaki'); return }
    if (username.length > 32) { setError('Nazwa użytkownika może mieć maksymalnie 32 znaki'); return }
    setDisplayName(username)
    setStep(2)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirm) { setError('Hasła nie są takie same'); return }
    if (password.length < 8) { setError('Hasło musi mieć minimum 8 znaków'); return }

    setLoading(true)
    try {
      const { token } = await api.auth.register({ username, displayName: displayName || username, email, password })
      tokenStore.set(token)
      router.push('/')
    } catch (err: any) {
      setError(err.message ?? 'Błąd rejestracji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>

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
          {step === 1 ? 'Utwórz konto' : 'Prawie gotowe!'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--eb-text2)' }}>
          {step === 1 ? 'Dołącz do Project-Z już teraz' : 'Ustaw hasło i spersonalizuj profil'}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6 px-2">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: step >= s ? 'var(--eb-gradient)' : 'var(--eb-bg3)',
                color: step >= s ? '#fff' : 'var(--eb-text3)',
              }}
            >
              {step > s ? '✓' : s}
            </div>
            <div className="text-xs" style={{ color: step >= s ? 'var(--eb-text2)' : 'var(--eb-text3)' }}>
              {s === 1 ? 'Dane konta' : 'Hasło & profil'}
            </div>
            {s < 2 && (
              <div className="flex-1 h-px ml-1" style={{ background: step > s ? 'var(--eb-accent)' : 'var(--eb-border)' }} />
            )}
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-6 sm:p-8"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}
      >

        {step === 1 && (
          <form onSubmit={goStep2} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus placeholder="twoj@email.com"
                className="ember-input w-full px-4 py-3"
                style={{ fontSize: 16 }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Nazwa użytkownika
              </label>
              <div className="relative">
                <input
                  type="text" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  required placeholder="twoja_nazwa"
                  className="ember-input w-full px-4 py-3"
                  maxLength={32}
                  style={{ fontSize: 16 }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: username.length > 28 ? 'var(--eb-accent)' : 'var(--eb-text3)' }}>
                  {username.length}/32
                </span>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                Tylko małe litery, cyfry, _ . - (bez spacji)
              </p>
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

            <button type="submit" className="ember-btn w-full mt-1" style={{ minHeight: 44, fontSize: 14, fontWeight: 600 }}>
              Dalej →
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Kolor avatara
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ background: avatarColor }}
                >
                  {(displayName || username).slice(0, 1).toUpperCase()}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color} type="button"
                      onClick={() => setAvatarColor(color)}
                      className="w-7 h-7 rounded-full transition-all duration-150"
                      style={{
                        background: color,
                        outline: avatarColor === color ? '2px solid white' : 'none',
                        outlineOffset: 2,
                        transform: avatarColor === color ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Wyświetlana nazwa
              </label>
              <input
                type="text" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={username}
                className="ember-input w-full px-4 py-3"
                maxLength={32}
                style={{ fontSize: 16 }}
              />
              <p className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>
                Może być różna od nazwy użytkownika
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Hasło
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  className="ember-input w-full px-4 py-3 pr-12"
                  style={{ fontSize: 16 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--eb-text3)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPass
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    }
                  </svg>
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--eb-text2)' }}>
                Potwierdź hasło
              </label>
              <input
                type="password" value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                required placeholder="••••••••"
                className="ember-input w-full px-4 py-3"
                style={Object.assign(
                  { fontSize: 16 },
                  passwordConfirm && password !== passwordConfirm ? { borderColor: 'rgba(220,38,38,0.5)' } : {}
                )}
              />
              {passwordConfirm && password !== passwordConfirm && (
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

            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => { setStep(1); setError('') }}
                className="ember-btn-ghost flex-1 text-sm font-medium"
                style={{ minHeight: 44 }}>
                ← Wstecz
              </button>
              <button type="submit" disabled={loading}
                className="ember-btn flex-1 text-sm font-semibold"
                style={{ opacity: loading ? 0.7 : 1, minHeight: 44 }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Tworzenie konta...
                  </span>
                ) : 'Utwórz konto'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm mt-6" style={{ color: 'var(--eb-text2)' }}>
          Masz już konto?{' '}
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: 'var(--eb-accent)' }}>
            Zaloguj się
          </Link>
        </p>
      </div>

      <p className="text-center text-xs mt-6" style={{ color: 'var(--eb-text3)' }}>
        Rejestrując się, akceptujesz nasze Warunki użytkowania i Politykę prywatności
      </p>
    </div>
  )
}
