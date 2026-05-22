'use client'
import { useEffect, useState } from 'react'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'ready' }

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onAvailable = (e: CustomEvent<{ version: string }>) => {
      setState({ phase: 'available', version: e.detail.version })
      setDismissed(false)
    }
    const onProgress = (e: CustomEvent<{ percent: number }>) => {
      setState({ phase: 'downloading', percent: e.detail.percent })
    }
    const onReady = () => {
      setState({ phase: 'ready' })
    }

    window.addEventListener('pz-update-available',  onAvailable as EventListener)
    window.addEventListener('pz-update-progress',   onProgress  as EventListener)
    window.addEventListener('pz-update-downloaded', onReady     as EventListener)
    return () => {
      window.removeEventListener('pz-update-available',  onAvailable as EventListener)
      window.removeEventListener('pz-update-progress',   onProgress  as EventListener)
      window.removeEventListener('pz-update-downloaded', onReady     as EventListener)
    }
  }, [])

  if (dismissed || state.phase === 'idle') return null

  const el = (window as any).electronPZ

  return (
    <div
      className="fixed bottom-4 right-4 z-[999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl"
      style={{
        background: 'var(--eb-bg2)',
        border: '0.5px solid var(--eb-border2)',
        backdropFilter: 'blur(12px)',
        maxWidth: 340,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--eb-gradient)' }}>
        {state.phase === 'ready'
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
        }
      </div>

      {}
      <div className="flex-1 min-w-0">
        {state.phase === 'available' && (
          <>
            <p className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>
              Project-Z {state.version} — dostępna aktualizacja
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>
              Pobierz i zainstaluj w tle
            </p>
          </>
        )}
        {state.phase === 'downloading' && (
          <>
            <p className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>
              Pobieranie aktualizacji… {state.percent}%
            </p>
            <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${state.percent}%`, background: 'var(--eb-gradient)' }} />
            </div>
          </>
        )}
        {state.phase === 'ready' && (
          <>
            <p className="text-xs font-semibold" style={{ color: 'var(--eb-text1)' }}>
              Aktualizacja gotowa do instalacji
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--eb-text3)' }}>
              Aplikacja uruchomi się ponownie
            </p>
          </>
        )}
      </div>

      {}
      <div className="flex gap-1.5 flex-shrink-0">
        {state.phase === 'available' && (
          <button
            onClick={() => { setState({ phase: 'downloading', percent: 0 }); el?.updateStartDownload() }}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'var(--eb-gradient)', color: '#fff' }}>
            Pobierz
          </button>
        )}
        {state.phase === 'ready' && (
          <button
            onClick={() => el?.updateInstallNow()}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'var(--eb-gradient)', color: '#fff' }}>
            Zainstaluj
          </button>
        )}
        {state.phase !== 'downloading' && (
          <button
            onClick={() => setDismissed(true)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition-all hover:bg-white/10"
            style={{ color: 'var(--eb-text3)' }}>
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
