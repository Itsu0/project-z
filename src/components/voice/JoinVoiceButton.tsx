'use client'
import { useVoice } from '@/hooks/useVoice'
import { useStore } from '@/lib/store'
import { useSocket } from '@/hooks/useSocket'
import { ScreenShareBar } from '@/components/voice/ScreenShareView'
import { DesktopSourcePicker } from '@/components/voice/VoiceDock'
import type { RealChannel } from '@/lib/store'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function keyLabel(code: string): string {
  const map: Record<string, string> = {
    Space: 'Spacja', Tab: 'Tab', CapsLock: 'Caps Lock', Escape: 'Esc',
    LeftShift: 'L.Shift', RightShift: 'R.Shift',
    LeftControl: 'L.Ctrl', RightControl: 'R.Ctrl',
    LeftAlt: 'L.Alt', RightAlt: 'R.Alt',
  }
  if (map[code]) return map[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

function VoiceOccupants({ channelId, serverId }: { channelId: string; serverId: string }) {
  const { token } = useStore()
  const socket = useSocket()
  const [occupants, setOccupants] = useState<{ userId: string; displayName: string; avatarColor: string; avatarUrl?: string | null }[]>([])

  useEffect(() => {
    if (!token || !serverId) return
    fetch(`${BASE}/api/servers/${serverId}/voice-state`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setOccupants(d.voiceState?.[channelId] ?? []))
      .catch(() => {})
  }, [token, serverId, channelId])

  useEffect(() => {
    if (!socket) return
    const onJoin = (d: any) => {
      if (d.channelId !== channelId) return
      setOccupants(prev => [...prev.filter(p => p.userId !== d.userId), { userId: d.userId, displayName: d.displayName, avatarColor: d.avatarColor, avatarUrl: d.avatarUrl }])
    }
    const onLeave = (d: any) => {
      if (d.channelId !== channelId) return
      setOccupants(prev => prev.filter(p => p.userId !== d.userId))
    }
    socket.on('VOICE_JOIN', onJoin)
    socket.on('VOICE_LEAVE', onLeave)
    return () => { socket.off('VOICE_JOIN', onJoin); socket.off('VOICE_LEAVE', onLeave) }
  }, [socket, channelId])

  if (occupants.length === 0) return (
    <p className="text-xs" style={{ color: 'var(--eb-text3)' }}>Nikt jeszcze nie dołączył — bądź pierwszy!</p>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--eb-text3)' }}>
        Na kanale ({occupants.length})
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {occupants.map(p => (
          <div key={p.userId} className="flex flex-col items-center gap-1.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg"
                style={{ background: p.avatarUrl ? 'transparent' : p.avatarColor, boxShadow: '0 0 0 2px rgba(34,197,94,0.6)' }}>
                {p.avatarUrl
                  ? <img src={p.avatarUrl} alt={p.displayName} className="w-full h-full object-cover" />
                  : p.displayName.slice(0, 1).toUpperCase()
                }
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2"
                style={{ background: '#22c55e', borderColor: 'var(--eb-bg2)' }} />
            </div>
            <span className="text-[10px] font-medium max-w-16 truncate text-center"
              style={{ color: 'var(--eb-text2)' }}>
              {p.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props { channel: RealChannel }

export function JoinVoiceButton({ channel }: Props) {
  const { voice, userSettings } = useStore()
  const hook = useVoice()
  const {
    connected, connecting, error,
    participants, muted, deafened, screenSharing, screenTracks,
    pttActive, audioBlocked,
    openDevicePicker, unlockAudio, disconnect,
    toggleMute, toggleDeafen, toggleScreenShare, startScreenShareFromSource,
    showStream, setShowStream,
  } = hook
  const { pttEnabled, pttKey } = userSettings
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronPZ
  const [showSourcePicker, setShowSourcePicker] = useState(false)

  const isInThisChannel = voice.channelId === channel.id

  return (
    <>
      <div className="flex flex-col items-center justify-center flex-1 gap-5">
        {isInThisChannel ? (
          <>
            {}
            {audioBlocked && (
              <button
                onClick={unlockAudio}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium w-full justify-center"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  color: '#f59e0b',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
                Kliknij, aby włączyć dźwięk
              </button>
            )}

            {}
            {pttEnabled && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium w-full justify-center select-none"
                style={{
                  background: pttActive ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${pttActive ? 'rgba(34,197,94,0.5)' : 'var(--eb-border)'}`,
                  color: pttActive ? 'var(--eb-online)' : 'var(--eb-text3)',
                  transition: 'all 0.1s',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                {pttActive ? 'Nadawanie...' : `Push to Talk — przytrzymaj [${keyLabel(pttKey)}]`}
              </div>
            )}

            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>🎙</div>
            <div className="text-center">
              <p className="font-semibold mb-1" style={{ color: 'var(--eb-online)' }}>Połączono</p>
              <p style={{ fontSize: 12, color: 'var(--eb-text3)' }}>#{channel.name}</p>
            </div>

            {participants.length > 0 && (
              <div className="flex flex-col gap-2 w-52">
                {participants.map(p => (
                  <div key={p.identity} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: p.isSpeaking ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${p.isSpeaking ? 'rgba(34,197,94,0.3)' : 'var(--eb-border)'}` }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                      style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium" style={{ color: 'var(--eb-text1)' }}>
                        {p.name}{p.isLocal ? ' (Ty)' : ''}
                      </div>
                      <div className="text-[10px]" style={{ color: p.isSpeaking ? 'var(--eb-online)' : 'var(--eb-text3)' }}>
                        {p.isMuted ? '🔇 Wyciszony' : p.isSpeaking ? '🎙 Mówi...' : '🎙 Połączony'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} title={muted ? 'Włącz mikrofon' : 'Wycisz mikrofon'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: muted ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${muted ? 'rgba(220,38,38,0.35)' : 'var(--eb-border)'}`, color: muted ? 'var(--eb-accent2)' : 'var(--eb-text1)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {muted ? <><line x1="2" y1="2" x2="22" y2="22"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/></> : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></>}
                </svg>
                {muted ? 'Wyciszony' : 'Mikrofon'}
              </button>

              <button onClick={toggleDeafen} title={deafened ? 'Odgłuś' : 'Ogłuś'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: deafened ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${deafened ? 'rgba(220,38,38,0.35)' : 'var(--eb-border)'}`, color: deafened ? 'var(--eb-accent2)' : 'var(--eb-text1)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                  {deafened && <line x1="2" y1="2" x2="22" y2="22"/>}
                </svg>
                {deafened ? 'Ogłuszony' : 'Słuchawki'}
              </button>

              <button
                onClick={() => {
                  if (screenSharing) {
                    toggleScreenShare()
                  } else if (isElectron) {
                    setShowSourcePicker(true)
                  } else {
                    toggleScreenShare()
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: screenSharing ? 'rgba(74,158,255,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${screenSharing ? 'rgba(74,158,255,0.35)' : 'var(--eb-border)'}`,
                  color: screenSharing ? 'var(--eb-voice)' : 'var(--eb-text1)'
                }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <polyline points="8 21 12 17 16 21"/>
                  {!screenSharing && <><polyline points="10 8 12 6 14 8"/><line x1="12" y1="6" x2="12" y2="13"/></>}
                  {screenSharing && <line x1="9" y1="10" x2="15" y2="10"/>}
                </svg>
                {screenSharing ? 'Zatrzymaj' : 'Udostępnij ekran'}
              </button>

              {screenTracks.length > 0 && <ScreenShareBar />}

              <button onClick={disconnect}
                className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                style={{ background: 'rgba(220,38,38,0.15)', color: 'var(--eb-accent2)', border: '1px solid rgba(220,38,38,0.3)' }}>
                Rozłącz
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'var(--eb-bg3)' }}>🔊</div>
            <div className="text-center">
              <p className="font-semibold mb-1" style={{ color: 'var(--eb-text1)' }}>Kanał głosowy</p>
              <p style={{ fontSize: 12, color: 'var(--eb-text3)' }}>
                #{channel.name}
              </p>
            </div>

            {}
            <VoiceOccupants channelId={channel.id} serverId={channel.server_id} />

            {error && (
              <p className="text-xs px-4 py-2 rounded-lg"
                style={{ color: 'var(--eb-accent2)', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
                {error}
              </p>
            )}

            <button
              onClick={() => openDevicePicker(channel.id)}
              disabled={connecting}
              className="ember-btn px-8 py-3 text-sm font-semibold flex items-center gap-2"
              style={{ opacity: connecting ? 0.7 : 1 }}
            >
              {connecting ? (
                <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Łączenie...</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>Dołącz do kanału</>
              )}
            </button>
          </>
        )}
      </div>

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
    </>
  )
}
