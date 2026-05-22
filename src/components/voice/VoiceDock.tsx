'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useVoice } from '@/hooks/useVoice'
import { useStore } from '@/lib/store'

interface DesktopSource { id: string; name: string; thumbnail: string; appIcon: string | null }

function SourceCard({ source, onSelect }: { source: DesktopSource; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={() => onSelect(source.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col rounded-xl overflow-hidden text-left transition-all"
      style={{
        background: hover ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${hover ? 'rgba(74,158,255,0.5)' : 'var(--eb-border2)'}`,
        outline: 'none',
      }}
    >
      <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
        <img src={source.thumbnail} alt={source.name} className="w-full h-full object-contain" />
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5 min-w-0">
        {source.appIcon && (
          <img src={source.appIcon} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
        )}
        <span className="text-xs truncate" style={{ color: hover ? 'var(--eb-voice)' : 'var(--eb-text2)' }}>
          {source.name}
        </span>
      </div>
    </button>
  )
}

export function DesktopSourcePicker({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const [sources, setSources]   = useState<DesktopSource[]>([])
  const [loading, setLoading]   = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const eN = (window as any).electronPZ
    eN?.getDesktopSources?.()
      .then((data: DesktopSource[]) => setSources(data ?? []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false))
  }, [])

  const screens = sources.filter(s => s.id.startsWith('screen:'))
  const windows = sources.filter(s => !s.id.startsWith('screen:'))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={wrapRef}
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 640, maxHeight: 560,
          background: 'var(--eb-bg1)',
          border: '0.5px solid var(--eb-border2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '0.5px solid var(--eb-border)' }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>
              Udostępnij ekran
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>
              Wybierz okno lub monitor do udostępnienia
            </div>
          </div>
          <button onClick={onClose} className="icon-btn w-7 h-7 flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2">
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span className="text-sm" style={{ color: 'var(--eb-text3)' }}>Ładowanie źródeł...</span>
            </div>
          ) : sources.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--eb-text3)' }}>
              Nie znaleziono żadnych źródeł
            </div>
          ) : (
            <>
              {screens.length > 0 && (
                <div className="mb-5">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--eb-text3)' }}>
                    Cały ekran
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {screens.map(s => <SourceCard key={s.id} source={s} onSelect={id => { onSelect(id); onClose() }} />)}
                  </div>
                </div>
              )}
              {windows.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--eb-text3)' }}>
                    Okna aplikacji
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {windows.map(s => <SourceCard key={s.id} source={s} onSelect={id => { onSelect(id); onClose() }} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SpeakingBars() {
  return (
    <div className="speaking-bars flex gap-px items-end" style={{ height: 10 }}>
      {[4, 8, 10].map((h, i) => (
        <span key={i} className="inline-block w-0.5 rounded-sm"
          style={{ background: 'var(--eb-online)', height: h }} />
      ))}
    </div>
  )
}

function DockBtn({
  onClick, title, active, danger, accent, children
}: {
  onClick?: () => void
  title: string
  active?: boolean
  danger?: boolean
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded-[10px] transition-all duration-150 hover:scale-105 active:scale-95"
      style={{
        width: 32, height: 32,
        background: danger
          ? 'rgba(220,38,38,0.2)'
          : active
          ? 'rgba(245,158,11,0.2)'
          : accent
          ? 'rgba(74,158,255,0.2)'
          : 'rgba(255,255,255,0.08)',
        border: `0.5px solid ${
          danger  ? 'rgba(220,38,38,0.5)'
          : active ? 'rgba(245,158,11,0.5)'
          : accent ? 'rgba(74,158,255,0.4)'
          : 'rgba(255,255,255,0.12)'
        }`,
        color: danger
          ? 'var(--eb-accent2)'
          : active
          ? 'var(--eb-accent)'
          : accent
          ? 'var(--eb-voice)'
          : 'var(--eb-text2)',
      }}
    >
      {children}
    </button>
  )
}

export function VoiceDock() {
  const { voice } = useStore()
  const {
    participants, connecting, muted, deafened, screenSharing,
    connected, toggleMute, toggleDeafen, toggleScreenShare, startScreenShareFromSource, disconnect,
  } = useVoice()

  const isElectron = typeof window !== 'undefined' && !!(window as any).electronPZ
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  useEffect(() => {
    const onState = (e: Event) => {
      const visible = (e as CustomEvent).detail?.visible as boolean | undefined
      if (typeof visible === 'boolean') setOverlayVisible(visible)
    }
    window.addEventListener('pz-overlay-state', onState as EventListener)
    return () => window.removeEventListener('pz-overlay-state', onState as EventListener)
  }, [])

  if (!connected && !connecting) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl"
      style={{
        background: 'rgba(20,8,18,0.95)',
        backdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(245,158,11,0.25)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.05)',
        minWidth: 380,
      }}
    >
      {}
      <div className="flex items-center gap-2 pr-3 flex-shrink-0"
        style={{ borderRight: '0.5px solid rgba(255,255,255,0.08)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={muted ? 'var(--eb-accent2)' : 'var(--eb-accent)'} strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        </svg>
        <div>
          <div className="font-semibold leading-none" style={{ fontSize: 11, color: '#fff' }}>
            {connecting ? 'Łączenie...' : muted ? 'Wyciszony' : 'Połączono'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--eb-accent)', marginTop: 2 }}>
            {connecting ? '...' : `${participants.length} osób · LiveKit`}
          </div>
        </div>
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: connecting ? 'var(--eb-accent)' : muted ? 'var(--eb-accent2)' : 'var(--eb-online)',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
      </div>

      {}
      <div className="flex items-center gap-1.5 flex-1 overflow-hidden min-w-0">
        {connecting ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="var(--eb-text3)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--eb-text2)' }}>Łączenie...</span>
          </div>
        ) : participants.map(p => (
          <div key={p.identity}
            className="voice-pill flex-shrink-0 transition-all"
            style={p.isSpeaking && !p.isMuted
              ? { background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)' }
              : p.isMuted
              ? { background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.25)' }
              : undefined}>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0 text-[9px] font-bold"
              style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>
              {p.name.slice(0, 1).toUpperCase()}
            </div>
            <span style={{ fontSize: 11, color: 'var(--eb-text1)' }}>
              {p.name}{p.isLocal ? ' (Ty)' : ''}
            </span>
            {p.isSpeaking && !p.isMuted
              ? <SpeakingBars />
              : p.isMuted
              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="var(--eb-accent2)" strokeWidth="2.5">
                  <line x1="2" y1="2" x2="22" y2="22"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
                </svg>
              : null}
          </div>
        ))}
      </div>

      {}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {}
        <DockBtn
          onClick={toggleMute}
          title={muted ? 'Włącz mikrofon (M)' : 'Wycisz mikrofon (M)'}
          danger={muted}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {muted ? (
              <>
                <line x1="2" y1="2" x2="22" y2="22"/>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
                <path d="M19 10v2a7 7 0 0 1-1.64 4.49"/>
              </>
            ) : (
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </>
            )}
          </svg>
        </DockBtn>

        {}
        <DockBtn
          onClick={toggleDeafen}
          title={deafened ? 'Odgłuś (D)' : 'Ogłuś (D)'}
          danger={deafened}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            {deafened && <line x1="2" y1="2" x2="22" y2="22"/>}
          </svg>
        </DockBtn>

        {}
        <DockBtn
          onClick={() => {
            if (screenSharing) {
              toggleScreenShare()
            } else if (isElectron) {
              setShowSourcePicker(true)
            } else {
              toggleScreenShare()
            }
          }}
          title={screenSharing ? 'Zatrzymaj udostępnianie' : 'Udostępnij ekran'}
          accent={screenSharing}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {screenSharing ? (
              <>
                <rect x="2" y="3" width="20" height="14" rx="2" fill="rgba(74,158,255,0.2)"/>
                <polyline points="8 21 12 17 16 21"/>
                <line x1="9" y1="10" x2="15" y2="10"/>
              </>
            ) : (
              <>
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <polyline points="8 21 12 17 16 21"/>
                <polyline points="10 8 12 6 14 8"/>
                <line x1="12" y1="6" x2="12" y2="13"/>
              </>
            )}
          </svg>
        </DockBtn>

        {}
        {isElectron && (
          <DockBtn
            onClick={async () => {
              await (window as any).electronPZ?.toggleOverlay?.()

            }}
            title={overlayVisible ? 'Ukryj nakładkę w grze' : 'Pokaż nakładkę w grze'}
            accent={overlayVisible}
          >
            {}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </DockBtn>
        )}

        {}
        <DockBtn onClick={disconnect} title="Rozłącz" danger>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67"/>
            <path d="M6.5 6.5a19.29 19.29 0 0 0-2.07 4.9 2 2 0 0 0 1.72 2.3c.9.13 1.84.3 2.71.53"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>
        </DockBtn>
      </div>

      {}
      {showSourcePicker && createPortal(
        <DesktopSourcePicker
          onSelect={sourceId => {
            startScreenShareFromSource(sourceId)
            setShowSourcePicker(false)
          }}
          onClose={() => setShowSourcePicker(false)}
        />,
        document.body
      )}
    </div>
  )
}
