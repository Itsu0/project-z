'use client'
import { useEffect, useRef, useState } from 'react'

interface Participant {
  identity: string
  name: string
  isSpeaking: boolean
  isMuted: boolean
  isLocal: boolean
}

function SpeakingBars() {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14, flexShrink: 0 }}>
      {[4, 11, 7].map((h, i) => (
        <span key={i} style={{
          display: 'inline-block',
          width: 3,
          borderRadius: 2,
          background: '#4ade80',
          height: h,
          animation: `overlayBar${i} ${0.6 + i * 0.12}s ease-in-out infinite alternate`,
        }} />
      ))}
    </div>
  )
}

export default function OverlayPage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.overflow = 'hidden'
  }, [])

  useEffect(() => {
    const el = (window as any).electronNexus
    if (!el?.onOverlayParticipants) return
    const cleanup = el.onOverlayParticipants((parts: Participant[]) => {
      setParticipants(Array.isArray(parts) ? parts : [])
    })
    return () => { try { cleanup?.() } catch {} }
  }, [])

  useEffect(() => {
    const el = (window as any).electronNexus
    if (!el?.setOverlayInteractive) return
    const onMove = (e: MouseEvent) => {
      const panel = panelRef.current
      if (!panel) return
      const r = panel.getBoundingClientRect()
      const over =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top  && e.clientY <= r.bottom
      el.setOverlayInteractive(over)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <>
      {}
      <style>{`
        @keyframes overlayBar0 { from { height: 4px }  to { height: 12px } }
        @keyframes overlayBar1 { from { height: 11px } to { height: 4px  } }
        @keyframes overlayBar2 { from { height: 7px }  to { height: 11px } }
      `}</style>

      {}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {}
        {participants.length > 0 && (
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 228,
              background: 'rgba(9, 3, 11, 0.90)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 14,
              border: '0.5px solid rgba(255,255,255,0.10)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.95), 0 0 0 0.5px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            {}
            <div style={{
              padding: '7px 10px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.035)',
              borderBottom: '0.5px solid rgba(255,255,255,0.07)',
              WebkitAppRegion: 'drag',
              userSelect: 'none',
              cursor: 'grab',
            } as React.CSSProperties & { WebkitAppRegion: string }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(245,158,11,0.9)" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8"  y1="23" x2="16" y2="23"/>
                </svg>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.09em',
                  color: 'rgba(245,158,11,0.9)',
                }}>
                  NEXUS VOICE
                </span>
              </div>

              {}
              <button
                onClick={() => (window as any).electronNexus?.hideOverlay?.()}
                title="Ukryj nakładkę"
                style={{
                  WebkitAppRegion: 'no-drag',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.22)',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: '0 1px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.12s',
                } as React.CSSProperties & { WebkitAppRegion: string }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}
              >
                ×
              </button>
            </div>

            {}
            <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {participants.map(p => (
                <div
                  key={p.identity}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 8px',
                    borderRadius: 9,
                    background:
                      p.isSpeaking && !p.isMuted ? 'rgba(34,197,94,0.12)' :
                      p.isMuted                  ? 'rgba(220,38,38,0.07)'  :
                                                   'rgba(255,255,255,0.035)',
                    border: `0.5px solid ${
                      p.isSpeaking && !p.isMuted ? 'rgba(34,197,94,0.32)' :
                      p.isMuted                  ? 'rgba(220,38,38,0.20)'  :
                                                   'rgba(255,255,255,0.07)'}`,
                    transition: 'background 0.18s, border-color 0.18s',
                  }}
                >
                  {}
                  <div style={{
                    width: 26, height: 26,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #dc2626, #f59e0b)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff',
                    flexShrink: 0,
                    boxShadow: p.isSpeaking && !p.isMuted
                      ? '0 0 0 2.5px rgba(34,197,94,0.55), 0 0 10px rgba(34,197,94,0.25)'
                      : 'none',
                    transition: 'box-shadow 0.2s',
                  }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>

                  {}
                  <span style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color:
                      p.isSpeaking && !p.isMuted ? '#86efac' :
                      p.isMuted                  ? '#fca5a5' :
                                                   '#d1d5db',
                  }}>
                    {p.name}{p.isLocal ? ' (Ty)' : ''}
                  </span>

                  {}
                  {p.isSpeaking && !p.isMuted ? (
                    <SpeakingBars />
                  ) : p.isMuted ? (

                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <line x1="2" y1="2" x2="22" y2="22"/>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
                      <path d="M19 10v2a7 7 0 0 1-1.64 4.49"/>
                    </svg>
                  ) : (

                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
