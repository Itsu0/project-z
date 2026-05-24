'use client'
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useStore, type UserSettings } from '@/lib/store'
import { getSocketInstance } from '@/hooks/useSocket'

const BASE   = process.env.NEXT_PUBLIC_API_URL     ?? 'http://localhost:3001'
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880'

export interface VoiceParticipant {
  identity: string; name: string; isSpeaking: boolean; isMuted: boolean; isLocal: boolean
}
export interface AudioDevice { deviceId: string; label: string }

export interface ScreenTrack {
  identity: string
  name: string
  videoElement: HTMLVideoElement | null
  isLocal: boolean
}

interface VoiceCtx {
  participants: VoiceParticipant[]; connecting: boolean; connected: boolean
  muted: boolean; deafened: boolean; screenSharing: boolean
  error: string | null
  audioProfile: string; inputDevices: AudioDevice[]; outputDevices: AudioDevice[]
  selectedInput: string; selectedOutput: string
  pttActive: boolean
  audioBlocked: boolean
  extInstalled: boolean
  screenTracks: ScreenTrack[]
  showStream: boolean
  watchingIdentity: string | null
  latency: number | null
  setShowStream: (v: boolean) => void
  setWatchingIdentity: (id: string | null) => void
  openDevicePicker: (channelId: string) => Promise<void>
  unlockAudio: () => Promise<void>
  disconnect: () => Promise<void>
  toggleMute: () => Promise<void>; toggleDeafen: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  startScreenShareFromSource: (sourceId: string) => Promise<void>
}

const VoiceCtx = createContext<VoiceCtx | null>(null)

export function useVoice() {
  const ctx = useContext(VoiceCtx)
  if (!ctx) throw new Error('useVoice must be inside VoiceProvider')
  return ctx
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { token, voice, joinVoice, leaveVoice, setVoiceMuted, setVoiceDeafened, userSettings } = useStore()

  const [participants,     setParticipants]     = useState<VoiceParticipant[]>([])
  const [connecting,       setConnecting]       = useState(false)
  const [muted,            setMuted]            = useState(false)
  const [deafened,         setDeafened]         = useState(false)
  const [screenSharing,    setScreenSharing]    = useState(false)
  const [screenTracks,     setScreenTracks]     = useState<ScreenTrack[]>([])
  const [showStream,       setShowStream]       = useState(false)
  const [watchingIdentity, setWatchingIdentity] = useState<string | null>(null)
  const [error,            setError]            = useState<string | null>(null)
  const [inputDevices,     setInputDevices]     = useState<AudioDevice[]>([])
  const [outputDevices,    setOutputDevices]    = useState<AudioDevice[]>([])
  const [selectedInput,    setSelectedInput]    = useState('')
  const [selectedOutput,   setSelectedOutput]   = useState('')
  const [audioProfile,     setAudioProfile]     = useState('zbalansowany')
  const [pttActive,        setPttActive]        = useState(false)
  const [audioBlocked,     setAudioBlocked]     = useState(false)
  const [extInstalled,     setExtInstalled]     = useState(false)
  const [latency,          setLatency]          = useState<number | null>(null)

  const roomRef           = useRef<any>(null)
  const pendingChannelId  = useRef<string | null>(null)
  const rttIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const rttInitRef        = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sendToOverlay = useCallback((parts: VoiceParticipant[]) => {
    try { (window as any).electronPZ?.updateOverlayParticipants?.(parts) } catch {}
  }, [])

  useEffect(() => {
    const onSync = () => {
      try {
        (window as any).electronPZ?.updateOverlayParticipants?.(participants)
      } catch {}
    }
    window.addEventListener('pz-overlay-sync', onSync)
    return () => window.removeEventListener('pz-overlay-sync', onSync)
  }, [participants])

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null
    const onDeviceChange = () => {

      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(async () => {
        const lp = roomRef.current?.localParticipant
        if (!lp || !roomRef.current) return
        const { pttEnabled, inputDevice } = useStore.getState().userSettings
        if (pttEnabled) return

        try {
          const { Track, createLocalAudioTrack } = await import('livekit-client')

          const micPub = lp.getTrackPublication(Track.Source.Microphone)
          if (micPub?.audioTrack) {
            try { micPub.audioTrack.mediaStreamTrack?.stop() } catch {}
            await lp.unpublishTrack(micPub.audioTrack)
            await new Promise(r => setTimeout(r, 300))
          }
          if (!roomRef.current) return

          const newTrack = await createLocalAudioTrack({ deviceId: inputDevice || undefined })
          await lp.publishTrack(newTrack)
        } catch {}
      }, 800)
    }

    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
      if (debounce) clearTimeout(debounce)
    }
  }, [])

  useEffect(() => {
    const block = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('mousedown', block, true)
    window.addEventListener('mouseup',   block, true)
    window.addEventListener('auxclick',  block, true)
    return () => {
      window.removeEventListener('mousedown', block, true)
      window.removeEventListener('mouseup',   block, true)
      window.removeEventListener('auxclick',  block, true)
    }
  }, [])

  useEffect(() => {
    let extReleaseTimer: ReturnType<typeof setTimeout> | null = null

    const onReady = () => setExtInstalled(true)
    const onPing  = () => setExtInstalled(true)
    const onPTT   = (e: Event) => {
      const active = (e as CustomEvent).detail?.active as boolean
      const lp = roomRef.current?.localParticipant

      if (active) {

        if (extReleaseTimer) { clearTimeout(extReleaseTimer); extReleaseTimer = null }
        if (lp) lp.setMicrophoneEnabled(true).catch(console.warn)
        setPttActive(true); setMuted(false); setVoiceMuted(false)
      } else {

        setPttActive(false)
        if (extReleaseTimer) clearTimeout(extReleaseTimer)
        extReleaseTimer = setTimeout(() => {
          const lp2 = roomRef.current?.localParticipant
          if (lp2) lp2.setMicrophoneEnabled(false).catch(console.warn)
          setMuted(true); setVoiceMuted(true)
          extReleaseTimer = null
        }, 1000)
      }
    }
    window.addEventListener('pz-ext-ready', onReady)
    window.addEventListener('pz-ext-ping',  onPing)
    window.addEventListener('pz-ext-ptt',   onPTT as EventListener)
    return () => {
      window.removeEventListener('pz-ext-ready', onReady)
      window.removeEventListener('pz-ext-ping',  onPing)
      window.removeEventListener('pz-ext-ptt',   onPTT as EventListener)
      if (extReleaseTimer) clearTimeout(extReleaseTimer)
    }
  }, [setVoiceMuted])

  useEffect(() => {
    const onUnload = () => {
      const { voice: v } = useStore.getState()
      if (!v.connected || !v.channelId || !v.serverId) return
      getSocketInstance()?.emit('VOICE_LEAVE', { channelId: v.channelId, serverId: v.serverId })
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  useEffect(() => {
    const { pttEnabled, pttKey } = userSettings
    if (!voice.connected || !pttEnabled) return

    const isMouseButton = pttKey.startsWith('Mouse')
    const mouseButton   = isMouseButton ? Number(pttKey.slice(5)) : -1

    let releaseTimer: ReturnType<typeof setTimeout> | null = null

    const activate = () => {
      if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
      const lp = roomRef.current?.localParticipant
      if (!lp) return
      lp.setMicrophoneEnabled(true).catch(console.warn)
      setPttActive(true); setMuted(false); setVoiceMuted(false)
    }
    const deactivate = () => {
      setPttActive(false)
      if (releaseTimer) clearTimeout(releaseTimer)
      releaseTimer = setTimeout(() => {
        const lp = roomRef.current?.localParticipant
        if (!lp) return
        lp.setMicrophoneEnabled(false).catch(console.warn)
        setMuted(true); setVoiceMuted(true)
        releaseTimer = null
      }, 1000)
    }

    if (isMouseButton) {
      const onDown = (e: MouseEvent) => { if (e.button === mouseButton) { e.preventDefault(); e.stopPropagation(); activate() } }
      const onUp   = (e: MouseEvent) => { if (e.button === mouseButton) { e.preventDefault(); e.stopPropagation(); deactivate() } }
      const onAux  = (e: MouseEvent) => { if (e.button === mouseButton) { e.preventDefault(); e.stopPropagation() } }
      window.addEventListener('mousedown',  onDown, true)
      window.addEventListener('mouseup',    onUp,   true)
      window.addEventListener('auxclick',   onAux,  true)
      window.addEventListener('click',      onAux,  true)
      return () => {
        window.removeEventListener('mousedown',  onDown, true)
        window.removeEventListener('mouseup',    onUp,   true)
        window.removeEventListener('auxclick',   onAux,  true)
        window.removeEventListener('click',      onAux,  true)
        if (releaseTimer) clearTimeout(releaseTimer)
      }
    } else {
      const onDown = (e: KeyboardEvent) => { if (e.code !== pttKey || e.repeat) return; e.preventDefault(); activate() }
      const onUp   = (e: KeyboardEvent) => { if (e.code !== pttKey) return; deactivate() }
      window.addEventListener('keydown', onDown)
      window.addEventListener('keyup',   onUp)
      return () => {
        window.removeEventListener('keydown', onDown)
        window.removeEventListener('keyup', onUp)
        if (releaseTimer) clearTimeout(releaseTimer)
      }
    }
  }, [voice.connected, userSettings.pttEnabled, userSettings.pttKey, setVoiceMuted])

  useEffect(() => {
    const eN = (window as any).electronPZ
    if (!eN?.setPTTShortcut) return
    const { pttKey } = userSettings
    if (pttKey) eN.setPTTShortcut(pttKey).catch?.(() => {})
  }, [userSettings.pttKey])

  const refreshParticipants = useCallback((room: any) => {
    const parts: VoiceParticipant[] = []
    try {
      if (room.localParticipant) {
        const lp = room.localParticipant
        parts.push({ identity: lp.identity, name: lp.name ?? lp.identity, isSpeaking: lp.isSpeaking, isMuted: !lp.isMicrophoneEnabled, isLocal: true })
      }
      room.remoteParticipants?.forEach((p: any) => {
        parts.push({ identity: p.identity, name: p.name ?? p.identity, isSpeaking: p.isSpeaking, isMuted: !p.isMicrophoneEnabled, isLocal: false })
      })
    } catch {  }
    setParticipants([...parts])

    try { (window as any).electronPZ?.updateOverlayParticipants?.(parts) } catch {}
  }, [])

  const vadCleanupRef      = useRef<(() => void) | null>(null)
  const lastDisconnectRef  = useRef<number>(0)

  const measureRtt = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      const engine = (room as any).engine
      const pcs: RTCPeerConnection[] = []
      for (const key of ['publisher', '_publisher', 'subscriber', '_subscriber']) {
        const pc = engine?.[key]?.pc
        if (pc && typeof pc.getStats === 'function') pcs.push(pc)
      }
      if (pcs.length === 0) return
      let best: number | null = null
      for (const pc of pcs) {
        try {
          const stats = await pc.getStats()
          stats.forEach((r: any) => {
            if (r.type === 'candidate-pair' && r.currentRoundTripTime != null) {
              const ms = Math.round(r.currentRoundTripTime * 1000)
              if (best === null || ms < best) best = ms
            }
          })
        } catch {}
      }
      if (best !== null) setLatency(best)
    } catch {}
  }, [])

  const startRttMeasurement = useCallback(() => {
    if (rttIntervalRef.current) clearInterval(rttIntervalRef.current)
    if (rttInitRef.current) clearTimeout(rttInitRef.current)
    rttInitRef.current = setTimeout(measureRtt, 1500)
    rttIntervalRef.current = setInterval(measureRtt, 3000)
  }, [measureRtt])

  const connectWithDevices = useCallback(async (overrides?: { profile?: string; input?: string; output?: string }) => {
    const channelId = pendingChannelId.current
    if (!channelId || !token) return
    setConnecting(true); setError(null)

    const update = () => refreshParticipants(roomRef.current)

    const PROFILES: Record<string, any> = {
      oszczędny:     { maxBitrate: 16000, red: false, dtx: true,  noiseSuppression: true,  echoCancellation: true },
      zbalansowany:  { maxBitrate: 32000, red: false, dtx: true,  noiseSuppression: true,  echoCancellation: true },
      wysoka_jakość: { maxBitrate: 64000, red: true,  dtx: true,  noiseSuppression: true,  echoCancellation: true },
      studio:        { maxBitrate: 96000, red: true,  dtx: false, noiseSuppression: false, echoCancellation: false },
    }
    const _audioProfile   = overrides?.profile ?? audioProfile
    const _selectedOutput = overrides?.output  ?? selectedOutput
    const profile = PROFILES[_audioProfile] ?? PROFILES.zbalansowany

    let _selectedInput = overrides?.input ?? selectedInput
    if (_selectedInput) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const exists = devices.some(d => d.kind === 'audioinput' && d.deviceId === _selectedInput)
        if (!exists) {
          console.warn('[PZ] Zapisane urządzenie audio nie istnieje, używam domyślnego')
          _selectedInput = ''
        }
      } catch {}
    }

    try {
      const { Room, RoomEvent, createLocalAudioTrack } = await import('livekit-client')
      if (roomRef.current) {
        await roomRef.current.disconnect()
        roomRef.current = null

        lastDisconnectRef.current = Date.now()
      }
      vadCleanupRef.current?.(); vadCleanupRef.current = null

      const msSinceDisconnect = Date.now() - lastDisconnectRef.current
      if (msSinceDisconnect < 1500) {
        await new Promise(r => setTimeout(r, 1500 - msSinceDisconnect))
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true })
          s.getTracks().forEach(t => t.stop())
          break
        } catch {
          if (attempt < 2) await new Promise(r => setTimeout(r, 400))
        }
      }

      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room
        .on(RoomEvent.ParticipantConnected,    update)
        .on(RoomEvent.ParticipantDisconnected, update)
        .on(RoomEvent.ActiveSpeakersChanged,   update)
        .on(RoomEvent.TrackMuted,              update)
        .on(RoomEvent.TrackUnmuted,            update)
        .on(RoomEvent.TrackSubscribed, (track: any, pub: any, participant: any) => {
          if (track.kind === 'audio') {
            const el = track.attach() as HTMLAudioElement
            el.volume = 1.0; el.autoplay = true
            if (_selectedOutput && (el as any).setSinkId) (el as any).setSinkId(_selectedOutput).catch(console.warn)
            document.body.appendChild(el)
            el.play().catch(() => setTimeout(() => el.play().catch(console.warn), 500))
            room.once(RoomEvent.TrackUnsubscribed, (u: any) => { if (u === track) el.remove() })
          }
          if (track.kind === 'video' && pub?.source === 'screen_share') {
            const videoEl = track.attach() as HTMLVideoElement
            videoEl.style.display = 'none'
            document.body.appendChild(videoEl)
            setScreenTracks(prev => [...prev, {
              identity: participant.identity,
              name: participant.name ?? participant.identity,
              videoElement: videoEl,
              isLocal: false,
            }])
          }
          update()
        })
        .on(RoomEvent.TrackUnsubscribed, (track: any, pub: any) => {
          if (track.kind === 'video' && pub?.source === 'screen_share') {
            setScreenTracks(prev => prev.filter(st => {
              if (st.videoElement) { try { st.videoElement.remove() } catch {} }
              return false
            }))
          }
        })
        .on(RoomEvent.Disconnected, () => {
          document.querySelectorAll('audio').forEach(e => e.remove())
          document.querySelectorAll('video').forEach(e => e.remove())
          vadCleanupRef.current?.(); vadCleanupRef.current = null
          if (rttIntervalRef.current) { clearInterval(rttIntervalRef.current); rttIntervalRef.current = null }
          if (rttInitRef.current) { clearTimeout(rttInitRef.current); rttInitRef.current = null }
          setParticipants([]); setMuted(false); setDeafened(false)
          setScreenSharing(false); setScreenTracks([]); setShowStream(false)
          setWatchingIdentity(null); setAudioBlocked(false); setLatency(null); leaveVoice()
          try { (window as any).electronPZ?.updateOverlayParticipants?.([]) } catch {}
          try { (window as any).electronPZ?.hideOverlay?.() } catch {}
        })
        .on(RoomEvent.LocalTrackPublished, (pub: any) => {

          if (pub?.source === 'screen_share' && pub?.track) {
            const videoEl = pub.track.attach() as HTMLVideoElement
            videoEl.style.display = 'none'
            document.body.appendChild(videoEl)
            setScreenTracks(prev => [...prev, {
              identity: room.localParticipant.identity,
              name: room.localParticipant.name ?? room.localParticipant.identity,
              videoElement: videoEl,
              isLocal: true,
            }])
          }

          if (pub?.source === 'microphone' && pub?.track?.mediaStreamTrack) {
            const msTrack: MediaStreamTrack = pub.track.mediaStreamTrack
            if (msTrack.muted) {
              msTrack.addEventListener('unmute', async () => {
                const lp = roomRef.current?.localParticipant
                if (!lp || !roomRef.current) return
                await lp.setMicrophoneEnabled(false)
                await new Promise(r => setTimeout(r, 200))
                if (roomRef.current) await lp.setMicrophoneEnabled(true)
              }, { once: true })
            }
          }

          if (pub?.source === 'microphone' && pub?.track?.mediaStreamTrack) {
            const msTrack: MediaStreamTrack = pub.track.mediaStreamTrack
            const _vadThreshold = useStore.getState().userSettings.vadThreshold
            if (_vadThreshold > 0) {
              try {
                const actx = new AudioContext()
                const src = actx.createMediaStreamSource(new MediaStream([msTrack]))
                const analyser = actx.createAnalyser()
                analyser.fftSize = 2048
                src.connect(analyser)
                const timeBuf = new Uint8Array(analyser.fftSize)
                let silenceCount = 0
                let vadMuted = false
                let reEnableTimer: ReturnType<typeof setTimeout> | null = null
                const startTime = Date.now()

                const scheduleReCheck = () => {
                  reEnableTimer = setTimeout(() => {
                    if (!vadMuted || msTrack.readyState === 'ended') return
                    msTrack.enabled = true
                    setTimeout(() => {
                      analyser.getByteTimeDomainData(timeBuf)
                      let sum = 0
                      for (let i = 0; i < timeBuf.length; i++) {
                        const s = (timeBuf[i] - 128) / 128; sum += s * s
                      }
                      const rms = Math.sqrt(sum / timeBuf.length) * 100
                      if (rms >= _vadThreshold) {
                        vadMuted = false; silenceCount = 0

                      } else {
                        msTrack.enabled = false
                        scheduleReCheck()
                      }
                    }, 80)
                  }, 1000)
                }

                const iv = setInterval(() => {

                  if (Date.now() - startTime < 2000) return

                  if (vadMuted) return

                  analyser.getByteTimeDomainData(timeBuf)
                  let sum = 0
                  for (let i = 0; i < timeBuf.length; i++) {
                    const s = (timeBuf[i] - 128) / 128; sum += s * s
                  }
                  const rms = Math.sqrt(sum / timeBuf.length) * 100

                  if (rms < _vadThreshold) {
                    if (++silenceCount >= 6) {
                      vadMuted = true
                      msTrack.enabled = false
                      scheduleReCheck()
                    }
                  } else {
                    silenceCount = 0
                    msTrack.enabled = true
                  }
                }, 40)

                vadCleanupRef.current = () => {
                  clearInterval(iv)
                  if (reEnableTimer) clearTimeout(reEnableTimer)
                  actx.close()
                }
              } catch {}
            }
          }
          update()
        })
        .on(RoomEvent.LocalTrackUnpublished, (pub: any) => {
          if (pub?.source === 'screen_share') {
            setScreenTracks(prev => prev.filter(st => {
              if (st.isLocal) { try { st.videoElement?.remove() } catch {} return false }
              return true
            }))
          }
          if (pub?.source === 'microphone') {
            vadCleanupRef.current?.(); vadCleanupRef.current = null
          }
          update()
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioBlocked(!room.canPlaybackAudio)
        })

      const res = await fetch(`${BASE}/api/livekit/token?channelId=${channelId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const tokenData = await res.json()
      if (!res.ok) {
        if (tokenData.error === 'muted' && tokenData.muteExpiresAt) {
          const mins = Math.ceil((new Date(tokenData.muteExpiresAt).getTime() - Date.now()) / 60000)
          throw new Error(`Jesteś wyciszony jeszcze przez ${mins} min — nie możesz dołączyć do kanału głosowego`)
        }
        throw new Error(tokenData.error)
      }

      await room.connect(tokenData.serverUrl ?? LK_URL, tokenData.token)
      await room.startAudio()

      const { pttEnabled } = useStore.getState().userSettings
      const audioPublishOptions = {
        audioPreset: { maxBitrate: profile.maxBitrate },
        red: profile.red,
        dtx: profile.dtx,
      }
      const audioCaptureOptions = {
        deviceId:         _selectedInput || undefined,
        echoCancellation: profile.echoCancellation,
        noiseSuppression: profile.noiseSuppression,
        autoGainControl:  true,
      }

      await new Promise(r => setTimeout(r, 500))
      if (!roomRef.current) return

      const tryPublishMic = async () => {
        const attempts = [
          _selectedInput || undefined,
          'default',
          undefined,
        ]
        for (const deviceId of attempts) {
          try {
            if (pttEnabled) {
              await room.localParticipant.setMicrophoneEnabled(
                false,
                { ...audioCaptureOptions, deviceId },
                audioPublishOptions,
              )
            } else {
              const track = await createLocalAudioTrack({ deviceId })
              await room.localParticipant.publishTrack(track, audioPublishOptions)
            }
            return
          } catch {  }
        }
      }
      await tryPublishMic()

      if (_selectedOutput) await room.switchActiveDevice('audiooutput', _selectedOutput)

      if (pttEnabled) { setMuted(true); setVoiceMuted(true) } else { setMuted(false) }
      update(); joinVoice(channelId)
      startRttMeasurement()

      try { (window as any).electronPZ?.showOverlay?.() } catch {}

    } catch (e: any) {
      const msg: string = e?.message ?? 'Błąd połączenia'
      const isDeviceError =
        msg.toLowerCase().includes('not found')     ||
        msg.toLowerCase().includes('notfound')      ||
        msg.toLowerCase().includes('device')        ||
        msg.toLowerCase().includes('audio')         ||
        msg.toLowerCase().includes('media')         ||
        msg.toLowerCase().includes('constraint')    ||
        msg.toLowerCase().includes('permission')    ||
        (e?.name ?? '').toLowerCase().includes('notfounderror')  ||
        (e?.name ?? '').toLowerCase().includes('notallowederror')
      if (isDeviceError && roomRef.current) {

        update(); joinVoice(channelId)
        try { (window as any).electronPZ?.showOverlay?.() } catch {}
      } else {
        setError(msg)
      }
    } finally {
      setConnecting(false)
    }
  }, [token, selectedInput, selectedOutput, audioProfile, setVoiceMuted, refreshParticipants, joinVoice, leaveVoice])

  const openDevicePicker = useCallback(async (channelId: string) => {

    try { const ctx = new AudioContext(); if (ctx.state === 'suspended') ctx.resume() } catch {}

    const { audioProfile: _profile, inputDevice: _input, outputDevice: _output } = useStore.getState().userSettings
    setAudioProfile(_profile)
    setSelectedInput(_input)
    setSelectedOutput(_output)
    pendingChannelId.current = channelId
    await connectWithDevices({ profile: _profile, input: _input, output: _output })
  }, [connectWithDevices])

  const unlockAudio = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.startAudio()
      setAudioBlocked(!roomRef.current.canPlaybackAudio)
    }
  }, [])

  const disconnect = useCallback(async () => {

    const currentVoice = useStore.getState().voice
    if (currentVoice?.channelId && currentVoice?.serverId) {
      const socket = (await import('@/hooks/useSocket')).getSocketInstance()
      socket?.emit('VOICE_LEAVE', { channelId: currentVoice.channelId, serverId: currentVoice.serverId })
    }
    if (roomRef.current) {

      try {
        const { Track } = await import('livekit-client')
        const micPub = roomRef.current.localParticipant?.getTrackPublication(Track.Source.Microphone)
        micPub?.audioTrack?.mediaStreamTrack?.stop()
      } catch {}
      await roomRef.current.disconnect()
      roomRef.current = null
    }
    lastDisconnectRef.current = Date.now()
    vadCleanupRef.current?.(); vadCleanupRef.current = null
    if (rttIntervalRef.current) { clearInterval(rttIntervalRef.current); rttIntervalRef.current = null }
    if (rttInitRef.current) { clearTimeout(rttInitRef.current); rttInitRef.current = null }
    setParticipants([]); setMuted(false); setDeafened(false); setScreenSharing(false); setLatency(null); leaveVoice()

    try { (window as any).electronPZ?.updateOverlayParticipants?.([]) } catch {}
    try { (window as any).electronPZ?.hideOverlay?.() } catch {}
  }, [])

  const toggleMute = useCallback(async () => {
    const lp = roomRef.current?.localParticipant
    if (!lp) return
    const nowEnabled = lp.isMicrophoneEnabled
    await lp.setMicrophoneEnabled(!nowEnabled)
    setMuted(nowEnabled); setVoiceMuted(nowEnabled)
    setParticipants(prev => prev.map(p => p.isLocal ? { ...p, isMuted: nowEnabled } : p))
  }, [])

  const toggleDeafen = useCallback(async () => {
    const nd = !deafened
    roomRef.current?.remoteParticipants?.forEach((p: any) => {
      p.getTrackPublications?.()?.forEach((pub: any) => {
        if (pub.kind === 'audio' && pub.audioTrack) pub.audioTrack.setVolume(nd ? 0 : 1)
      })
    })
    setDeafened(nd); setVoiceDeafened(nd)
  }, [deafened])

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return
    try {
      await roomRef.current.localParticipant.setScreenShareEnabled(!screenSharing)
      setScreenSharing(s => !s)
    } catch (e: any) {
      if (e.name !== 'NotAllowedError') console.warn(e)
      setScreenSharing(false)
    }
  }, [screenSharing])

  const startScreenShareFromSource = useCallback(async (sourceId: string) => {
    if (!roomRef.current) return
    try {
      const el = (window as any).electronPZ

      if (el?.selectDesktopSource) {
        await el.selectDesktopSource(sourceId)
      }

      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      })
      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack) throw new Error('Brak track wideo')

      const { LocalVideoTrack, Track } = await import('livekit-client')
      const lkTrack = new LocalVideoTrack(videoTrack, undefined, true)
      await roomRef.current.localParticipant.publishTrack(lkTrack, {
        source: Track.Source.ScreenShare,
        simulcast: false,
      })
      setScreenSharing(true)
    } catch (e: any) {
      console.warn('[screenShare/source]', e)
      setScreenSharing(false)
    }
  }, [])

  return (
    <VoiceCtx.Provider value={{
      participants, connecting, connected: voice.connected, muted, deafened,
      screenSharing, error,
      audioProfile, inputDevices, outputDevices, selectedInput, selectedOutput,
      pttActive,
      audioBlocked,
      extInstalled,
      screenTracks,
      showStream,
      watchingIdentity,
      latency,
      setShowStream,
      setWatchingIdentity,
      openDevicePicker, unlockAudio, disconnect,
      toggleMute, toggleDeafen, toggleScreenShare, startScreenShareFromSource,
    }}>
      {children}
    </VoiceCtx.Provider>
  )
}
