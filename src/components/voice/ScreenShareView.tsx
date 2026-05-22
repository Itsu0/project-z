'use client'
import { useEffect, useRef, useState } from 'react'
import { useVoice } from '@/hooks/useVoice'

export function ScreenShareBar() {
  const { screenTracks, watchingIdentity, setWatchingIdentity, setShowStream } = useVoice()
  if (screenTracks.length === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
      style={{ background: 'rgba(74,158,255,0.08)', borderBottom: '0.5px solid rgba(74,158,255,0.2)' }}>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--eb-voice)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--eb-voice)' }}>Ekran</span>
      </div>
      <div className="flex items-center gap-2 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {screenTracks.map(st => {
          const isWatching = watchingIdentity === st.identity
          return (
            <button key={st.identity}
              onClick={() => { setWatchingIdentity(isWatching ? null : st.identity); setShowStream(!isWatching) }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg flex-shrink-0 transition-all text-xs"
              style={{
                background: isWatching ? 'rgba(74,158,255,0.2)' : 'rgba(255,255,255,0.06)',
                border: `0.5px solid ${isWatching ? 'rgba(74,158,255,0.5)' : 'var(--eb-border)'}`,
                color: isWatching ? 'var(--eb-voice)' : 'var(--eb-text2)',
              }}>
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>
                {st.name.slice(0, 1).toUpperCase()}
              </div>
              {st.name}{st.isLocal ? ' (Ty)' : ''}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isWatching
                  ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                }
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ScreenTile({ identity, name, videoElement, isLocal, onClose }: {
  identity: string; name: string; videoElement: HTMLVideoElement | null
  isLocal: boolean; onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef     = useRef<HTMLDivElement>(null)

  const [enlarged, setEnlarged] = useState(false)
  const [pip,      setPip]      = useState(false)

  const [pos,      setPos]      = useState({ x: 24, y: 24 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const SMALL = { w: 640, h: 400 }
  const LARGE = { w: 1100, h: 680 }
  const size  = enlarged ? LARGE : SMALL

  useEffect(() => {
    if (!containerRef.current || !videoElement) return
    videoElement.style.display    = 'block'
    videoElement.style.width      = '100%'
    videoElement.style.height     = '100%'
    videoElement.style.objectFit  = 'contain'
    videoElement.style.background = '#000'
    containerRef.current.appendChild(videoElement)
    return () => {
      videoElement.style.display = 'none'
      try { document.body.appendChild(videoElement) } catch {}
    }
  }, [videoElement])

  useEffect(() => {
    if (!videoElement) return
    const onEnter = () => setPip(true)
    const onLeave = () => setPip(false)
    videoElement.addEventListener('enterpictureinpicture', onEnter)
    videoElement.addEventListener('leavepictureinpicture', onLeave)
    return () => {
      videoElement.removeEventListener('enterpictureinpicture', onEnter)
      videoElement.removeEventListener('leavepictureinpicture', onLeave)
    }
  }, [videoElement])

  async function togglePip() {
    if (!videoElement) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoElement.requestPictureInPicture()
      }
    } catch (e) {
      console.warn('PiP nie jest obsługiwany:', e)
    }
  }

  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, dragStart.current.px + e.clientX - dragStart.current.mx),
        y: Math.max(0, dragStart.current.py + e.clientY - dragStart.current.my),
      })
    }
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])

  return (
    <div ref={panelRef}
      className="fixed z-50 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
      style={{
        left: pos.x, top: pos.y,
        width: size.w, height: size.h,
        background: '#0a0a0f',
        border: `1px solid ${pip ? 'rgba(168,85,247,0.4)' : 'rgba(74,158,255,0.3)'}`,
        boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.05)${pip ? ', 0 0 20px rgba(168,85,247,0.2)' : ''}`,
        transition: dragging ? 'none' : 'width 0.2s ease, height 0.2s ease',
        cursor: dragging ? 'grabbing' : 'default',
        userSelect: 'none',
      }}
    >
      {}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{
          background: 'rgba(0,0,0,0.5)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>
            {name.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--eb-text1)' }}>
            {name}{isLocal ? ' (Ty)' : ''}
          </span>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
            style={{ background: 'var(--eb-voice)' }} />
          {pip && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '0.5px solid rgba(168,85,247,0.3)' }}>
              🖥 PiP aktywny
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {}
          {pipSupported && (
            <button
              onClick={togglePip}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all hover:bg-white/10"
              style={{ color: pip ? '#a855f7' : 'var(--eb-text2)' }}
              title={pip ? 'Wyłącz Picture-in-Picture' : 'Otwórz nad wszystkimi oknami (PiP)'}
            >
              {pip ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><rect x="8" y="9" width="8" height="6" rx="1" fill="currentColor"/>
                  </svg>
                  Wyłącz PiP
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><rect x="10" y="9" width="8" height="6" rx="1"/>
                  </svg>
                  Nad ekranem
                </>
              )}
            </button>
          )}

          {}
          <button
            onClick={() => setEnlarged(e => !e)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all hover:bg-white/10"
            style={{ color: 'var(--eb-text2)' }}
          >
            {enlarged ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                </svg>
                Pomniejsz
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
                Powiększ
              </>
            )}
          </button>

          {}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-md transition-all hover:bg-white/10"
            style={{ color: 'var(--eb-text3)' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {}
      <div ref={containerRef} className="flex-1 bg-black" />
    </div>
  )
}

export function ScreenShareView() {
  const { screenTracks, showStream, watchingIdentity, setShowStream, setWatchingIdentity } = useVoice()
  const activeTrack = screenTracks.find(st => st.identity === watchingIdentity)
  if (!showStream || !activeTrack) return null

  return (
    <ScreenTile
      {...activeTrack}
      onClose={() => { setShowStream(false); setWatchingIdentity(null) }}
    />
  )
}
