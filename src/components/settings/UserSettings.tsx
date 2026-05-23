'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { tokenStore } from '@/lib/api'
import { ImageCropModal } from '@/components/ui/ImageCropModal'
import { Select } from '@/components/ui/Select'
import { applyColorTheme, THEME_META } from '@/lib/themes'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Tab = 'profil' | 'audio' | 'wygląd' | 'powiadomienia' | 'prywatność' | 'konto'

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

async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Błąd serwera')
  return data
}

function useAudioDevices() {
  const [inputs,  setInputs]  = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [loaded,  setLoaded]  = useState(false)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(s => s.getTracks().forEach(t => t.stop()))
      const devices = await navigator.mediaDevices.enumerateDevices()
      setInputs(devices.filter(d => d.kind === 'audioinput'))
      setOutputs(devices.filter(d => d.kind === 'audiooutput'))
      setLoaded(true)
    } catch (e: any) {
      setError('Brak dostępu do urządzeń audio — sprawdź uprawnienia przeglądarki')
    }
  }, [])

  return { inputs, outputs, loaded, error, load }
}

function TabProfile() {
  const { token, currentUser, setAuth, setCurrentUserStatus } = useStore()
  const t = useT()
  const [displayName,   setDisplayName]   = useState(currentUser?.display_name ?? '')
  const [customStatus,  setCustomStatus]  = useState(currentUser?.custom_status ?? '')
  const [avatarColor,   setAvatarColor]   = useState(currentUser?.avatar_color ?? AVATAR_COLORS[0])
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(currentUser?.avatar_url ?? null)
  const [userStatus,    setUserStatus]    = useState<string>(currentUser?.status ?? 'online')
  const [saving,        setSaving]        = useState(false)
  const [msg,           setMsg]           = useState('')
  const [showEmoji,     setShowEmoji]     = useState(false)
  const [cropSrc,       setCropSrc]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleAvatarCropped(dataUrl: string) {
    setCropSrc(null)
    if (!token || !currentUser) return
    try {
      const res = await apiFetch('/api/auth/avatar', token, {
        method: 'POST',
        body: JSON.stringify({ avatar: dataUrl }),
      })
      setAvatarUrl(res.avatarUrl)
      setAuth(token, { ...currentUser, avatar_url: res.avatarUrl })
      setMsg('✓ Avatar zaktualizowany')
    } catch (e: any) { setMsg(e.message) }
  }

  const STATUS_OPTIONS = [
    { value: 'online',  color: '#22c55e', label: t('status.online'),    emoji: '🟢' },
    { value: 'idle',    color: '#f59e0b', label: t('status.idle'),      emoji: '🌙' },
    { value: 'dnd',     color: '#ef4444', label: t('status.dnd'),       emoji: '⛔' },
    { value: 'offline', color: '#6b7280', label: t('status.invisible'), emoji: '⭕' },
  ]

  const QUICK_EMOJI = ['😀','😎','🎮','🔥','💤','🎵','📚','🏆','⚔️','🌙','☕','🎯','💻','🚀','❤️','✨','🎉','😴']

  async function save() {
    if (!token || !currentUser) return
    setSaving(true); setMsg('')
    try {
      await apiFetch('/api/auth/profile', token, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: displayName.trim(), customStatus, avatarColor }),
      })

      await fetch(`${BASE}/api/auth/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: userStatus }),
      })

      if (typeof window !== 'undefined') localStorage.setItem('pz_status_pref', userStatus)
      setAuth(token, { ...currentUser, display_name: displayName.trim(), avatar_color: avatarColor, status: userStatus, custom_status: customStatus.trim() || null })
      setCurrentUserStatus(userStatus)
      setMsg('✓ Zapisano')
    } catch (e: any) { setMsg(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      {}
      <div className="p-4 rounded-2xl" style={{ background: 'var(--eb-bg3)', border: '0.5px solid var(--eb-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--eb-text3)' }}>{t('settings.profile.preview')}</p>
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl overflow-hidden"
              style={{ background: avatarUrl ? 'transparent' : avatarColor }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : (displayName || currentUser?.display_name || 'U').slice(0, 1).toUpperCase()
              }
            </div>
            {}
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2"
              style={{ background: STATUS_OPTIONS.find(s => s.value === userStatus)?.color ?? '#22c55e', borderColor: 'var(--eb-bg3)' }} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
          {cropSrc && (
            <ImageCropModal
              src={cropSrc}
              title="Dostosuj avatar"
              round={true}
              onSave={handleAvatarCropped}
              onClose={() => setCropSrc(null)}
            />
          )}
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
              {displayName || currentUser?.display_name}
            </div>
            <div className="text-xs" style={{ color: 'var(--eb-text3)' }}>@{currentUser?.username}</div>
            {customStatus && <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text2)' }}>{customStatus}</div>}
          </div>
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
          {t('settings.profile.status')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map(s => (
            <button key={s.value} onClick={() => setUserStatus(s.value)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-sm"
              style={{
                background: userStatus === s.value ? `${s.color}18` : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${userStatus === s.value ? s.color + '50' : 'var(--eb-border)'}`,
                color: userStatus === s.value ? s.color : 'var(--eb-text2)',
              }}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
          {t('settings.profile.avatarColor')}
          {avatarUrl && <span className="ml-2 text-[10px] font-normal normal-case" style={{ color: 'var(--eb-text3)' }}>{t('settings.profile.avatarInactive')}</span>}
        </label>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map(c => (
            <button key={c} onClick={() => { setAvatarColor(c); setAvatarUrl(null) }}
              className="w-9 h-9 rounded-full transition-all"
              style={{ background: c, outline: avatarColor === c && !avatarUrl ? '2px solid white' : 'none', outlineOffset: 2, transform: avatarColor === c && !avatarUrl ? 'scale(1.12)' : 'scale(1)' }} />
          ))}
          <button onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
            style={{ border: '1.5px dashed var(--eb-border2)', color: 'var(--eb-text3)', outline: avatarUrl ? '2px solid white' : 'none', outlineOffset: 2 }}
            title={t('settings.profile.uploadAvatar')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text2)' }}>
          {t('settings.profile.displayName')}
        </label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)}
          className="ember-input w-full px-4 py-2.5" maxLength={32} />
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text2)' }}>
          {t('settings.profile.customStatus')}
        </label>
        <div className="relative">
          <div className="flex gap-2">
            <button onClick={() => setShowEmoji(e => !e)}
              className="px-3 py-2.5 rounded-xl flex-shrink-0 text-lg transition-all hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid var(--eb-border)' }}>
              {customStatus.match(/^\p{Emoji}/u)?.[0] ?? '😀'}
            </button>
            <input value={customStatus} onChange={e => setCustomStatus(e.target.value)}
              placeholder={t('settings.profile.customStatusPlaceholder')}
              className="ember-input flex-1 px-4 py-2.5" maxLength={128} />
          </div>
          {showEmoji && (
            <div className="absolute top-12 left-0 z-10 p-3 rounded-2xl"
              style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              <div className="flex flex-wrap gap-1.5 w-56">
                {QUICK_EMOJI.map(em => (
                  <button key={em} onClick={() => {
                    setCustomStatus(p => em + ' ' + p.replace(/^\p{Emoji}\s*/u, ''))
                    setShowEmoji(false)
                  }} className="text-xl hover:scale-125 transition-transform">
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="ember-btn px-6 py-2 text-sm">
          {saving ? t('settings.profile.saving') : t('settings.profile.save')}
        </button>
        {msg && <span className="text-xs" style={{ color: msg.startsWith('✓') ? 'var(--eb-online)' : 'var(--eb-accent2)' }}>{msg}</span>}
      </div>
    </div>
  )
}

function TabAudio() {
  const { token, userSettings, patchUserSettings } = useStore()
  const t = useT()
  const { inputs, outputs, loaded, error, load } = useAudioDevices()
  const s = userSettings

  const [inputDevice,      setInputDevice]      = useState<string>(s.inputDevice)
  const [outputDevice,     setOutputDevice]     = useState<string>(s.outputDevice)
  const [inputVolume,      setInputVolume]      = useState<number>(s.inputVolume)
  const [outputVolume,     setOutputVolume]     = useState<number>(s.outputVolume)
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(s.noiseSuppression)
  const [echoCancellation, setEchoCancellation] = useState<boolean>(s.echoCancellation)
  const [autoGain,         setAutoGain]         = useState<boolean>(s.autoGain)
  const [audioProfile,     setAudioProfile]     = useState<string>(s.audioProfile)
  const [vadThreshold,     setVadThresholdLocal] = useState<number>(s.vadThreshold)
  const [pttEnabled,       setPttEnabled]       = useState<boolean>(s.pttEnabled)
  const [pttKey,           setPttKey]           = useState<string>(s.pttKey)
  const [bindingKey,       setBindingKey]       = useState(false)
  const [testing,          setTesting]          = useState(false)
  const [testLevel,        setTestLevel]        = useState(0)
  const testRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animRef = useRef<number>(0)
  const saveRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted    = useRef(false)
  const syncedRef  = useRef(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!syncedRef.current) {
      syncedRef.current = true
      setInputDevice(s.inputDevice)
      setOutputDevice(s.outputDevice)
      setInputVolume(s.inputVolume)
      setOutputVolume(s.outputVolume)
      setNoiseSuppression(s.noiseSuppression)
      setEchoCancellation(s.echoCancellation)
      setAutoGain(s.autoGain)
      setAudioProfile(s.audioProfile)
      setVadThresholdLocal(s.vadThreshold)
      setPttEnabled(s.pttEnabled)
      setPttKey(s.pttKey)
    }
  }, [s])

  useEffect(() => {
    if (inputs.length  && !inputDevice)  setInputDevice(inputs[0].deviceId)
    if (outputs.length && !outputDevice) setOutputDevice(outputs[0].deviceId)
  }, [inputs, outputs])

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    const patch = { inputDevice, outputDevice, inputVolume, outputVolume, noiseSuppression, echoCancellation, autoGain, audioProfile, vadThreshold, pttEnabled, pttKey }
    patchUserSettings(patch)
    if (saveRef.current) clearTimeout(saveRef.current)
    saveRef.current = setTimeout(() => {
      if (!token) return
      fetch(`${BASE}/api/user/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      }).catch(console.warn)
    }, 600)
  }, [inputDevice, outputDevice, inputVolume, outputVolume, noiseSuppression, echoCancellation, autoGain, audioProfile, vadThreshold, pttEnabled, pttKey])

  async function testMic() {
    if (testing) {
      cancelAnimationFrame(animRef.current)
      testRef.current?.getTracks().forEach(t => t.stop())
      testRef.current = null
      analyserRef.current = null
      setTesting(false)
      setTestLevel(0)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: inputDevice || undefined, echoCancellation, noiseSuppression, autoGainControl: autoGain }
      })
      testRef.current = stream
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      setTesting(true)

      const tick = () => {
        if (!analyserRef.current) return
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setTestLevel(Math.min(100, avg * 2))
        animRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (e: any) {
      alert('Błąd dostępu do mikrofonu: ' + e.message)
    }
  }

  const PROFILES = [
    { id: 'oszczędny',     label: t('settings.audio.profile.oszczedny'), bitrate: '16 kbps', icon: '📶' },
    { id: 'zbalansowany',  label: t('settings.audio.profile.zbalansowany'), bitrate: '32 kbps', icon: '⚖️' },
    { id: 'wysoka_jakość', label: t('settings.audio.profile.wysoka'), bitrate: '64 kbps', icon: '🎯' },
  ]

  const Toggle = ({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm" style={{ color: 'var(--eb-text1)' }}>{label}</div>
        {desc && <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
        style={{ background: value ? 'var(--eb-gradient)' : 'var(--eb-bg4)' }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: value ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '0.5px solid rgba(220,38,38,0.3)' }}>
          ⚠ {t('settings.audio.micError')}
        </div>
      )}

      {!loaded && (
        <button onClick={load} className="ember-btn py-2 text-sm">
          {t('settings.audio.micPermission')}
        </button>
      )}

      {loaded && (
        <>
          {}
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text2)' }}>
                {t('settings.audio.micInput')}
              </label>
              <Select
                value={inputDevice}
                onChange={setInputDevice}
                options={inputs.map(d => ({ value: d.deviceId, label: d.label || `Mikrofon ${d.deviceId.slice(0,6)}` }))}
              />

              {}
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--eb-bg4)' }}>
                  <div className="h-full rounded-full transition-all duration-75"
                    style={{ width: `${testLevel}%`, background: testLevel > 80 ? 'var(--eb-accent2)' : testLevel > 50 ? 'var(--eb-accent)' : 'var(--eb-online)' }} />
                </div>
                <button onClick={testMic}
                  className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
                  style={{ background: testing ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.06)', color: testing ? 'var(--eb-accent2)' : 'var(--eb-text2)', border: '0.5px solid var(--eb-border)' }}>
                  {testing ? t('settings.audio.testStop') : t('settings.audio.test')}
                </button>
              </div>
              {testing && <p className="text-[10px] mt-1" style={{ color: 'var(--eb-text3)' }}>{t('settings.audio.testHint')}</p>}

              {}
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>{t('settings.audio.volume', { n: inputVolume })}</span>
                <input type="range" min={0} max={200} value={inputVolume} onChange={e => setInputVolume(Number(e.target.value))}
                  className="flex-1 accent-orange-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--eb-text2)' }}>
                {t('settings.audio.speakerOutput')}
              </label>
              <Select
                value={outputDevice}
                onChange={setOutputDevice}
                options={outputs.map(d => ({ value: d.deviceId, label: d.label || `Głośniki ${d.deviceId.slice(0,6)}` }))}
              />
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>{t('settings.audio.volume', { n: outputVolume })}</span>
                <input type="range" min={0} max={200} value={outputVolume} onChange={e => setOutputVolume(Number(e.target.value))}
                  className="flex-1 accent-orange-400" />
              </div>
            </div>
          </div>

          {}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--eb-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--eb-text2)' }}>{t('settings.audio.processing')}</p>
            <div className="divide-y" style={{ borderColor: 'var(--eb-border)' }}>
              <Toggle value={noiseSuppression} onChange={setNoiseSuppression} label={t('settings.audio.noiseSuppression')} desc={t('settings.audio.noiseSuppressionDesc')} />
              <Toggle value={echoCancellation} onChange={setEchoCancellation} label={t('settings.audio.echoCancellation')} desc={t('settings.audio.echoCancellationDesc')} />
              <Toggle value={autoGain}         onChange={setAutoGain}         label={t('settings.audio.autoGain')}         desc={t('settings.audio.autoGainDesc')} />
            </div>

            {}
            <div className="mt-4 pt-3" style={{ borderTop: '0.5px solid var(--eb-border)' }}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-sm" style={{ color: 'var(--eb-text1)' }}>{t('settings.audio.vad')}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                    {vadThreshold === 0
                      ? t('settings.audio.vad.off')
                      : vadThreshold <= 5
                      ? t('settings.audio.vad.1')
                      : vadThreshold <= 10
                      ? t('settings.audio.vad.2')
                      : vadThreshold <= 15
                      ? t('settings.audio.vad.3')
                      : t('settings.audio.vad.4')}
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'var(--eb-bg4)', color: 'var(--eb-accent)' }}>
                  {vadThreshold === 0 ? 'OFF' : vadThreshold}
                </span>
              </div>
              <input
                type="range" min={0} max={20} step={1}
                value={vadThreshold}
                onChange={e => setVadThresholdLocal(Number(e.target.value))}
                className="w-full accent-orange-400"
              />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--eb-text3)' }}>
                <span>{t('settings.audio.vad.label.off')}</span>
                <span>{t('settings.audio.vad.label.normal')}</span>
                <span>{t('settings.audio.vad.label.strict')}</span>
              </div>
            </div>
          </div>

          {}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
              {t('settings.audio.qualityProfile')}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROFILES.map((p, i) => (
                <button key={p.id} onClick={() => setAudioProfile(p.id)}
                  className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all${PROFILES.length % 2 !== 0 && i === PROFILES.length - 1 ? ' col-span-2 justify-self-center w-1/2' : ''}`}
                  style={{
                    background: audioProfile === p.id ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `0.5px solid ${audioProfile === p.id ? 'var(--eb-accent)' : 'var(--eb-border)'}`,
                  }}>
                  <span className="text-base leading-none mt-0.5">{p.icon}</span>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: audioProfile === p.id ? 'var(--eb-accent)' : 'var(--eb-text1)' }}>{p.label}</div>
                    <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>{p.bitrate}</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] mt-2" style={{ color: 'var(--eb-text3)' }}>
              {t('settings.audio.qualityHint')}
            </p>
          </div>

          {}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--eb-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--eb-text2)' }}>{t('settings.audio.ptt')}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>{t('settings.audio.pttDesc')}</p>
              </div>
              <button onClick={() => setPttEnabled(v => !v)}
                className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                style={{ background: pttEnabled ? 'var(--eb-gradient)' : 'var(--eb-bg4)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: pttEnabled ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>

            {pttEnabled && (
              <div className="flex flex-col gap-3 pt-3" style={{ borderTop: '0.5px solid var(--eb-border)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm flex-1" style={{ color: 'var(--eb-text1)' }}>{t('settings.audio.pttKey')}</span>
                  {bindingKey ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs animate-pulse" style={{ color: 'var(--eb-accent)' }}>
                        {t('settings.audio.pttBind')}
                      </span>
                      <button
                        onClick={() => setBindingKey(false)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: 'var(--eb-bg4)', color: 'var(--eb-text3)' }}>
                        {t('settings.audio.pttCancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setBindingKey(true)

                        const cleanup = () => {
                          window.removeEventListener('keydown',   onKey,   true)
                          window.removeEventListener('mousedown', onMouse, true)
                        }
                        const onKey = (e: KeyboardEvent) => {
                          e.preventDefault()
                          if (e.code === 'Escape') { setBindingKey(false); cleanup(); return }
                          setPttKey(e.code)
                          setBindingKey(false); cleanup()
                        }
                        const onMouse = (e: MouseEvent) => {

                          if (e.button === 0) return
                          e.preventDefault(); e.stopPropagation()
                          setPttKey(`Mouse${e.button}`)
                          setBindingKey(false); cleanup()
                        }
                        window.addEventListener('keydown',   onKey,   true)
                        window.addEventListener('mousedown', onMouse, true)
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all hover:brightness-110"
                      style={{ background: 'var(--eb-bg3)', border: '0.5px solid var(--eb-border2)', color: 'var(--eb-accent)', minWidth: 120, textAlign: 'center' }}>
                      {pttKeyLabel(pttKey, t)}
                    </button>
                  )}
                </div>

              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function pttKeyLabel(code: string, t: (k: string) => string): string {
  if (code.startsWith('Mouse')) {
    const mk = t(`key.${code}`)
    if (mk !== `key.${code}`) return mk
  }
  const special = t(`key.${code}`)
  if (special !== `key.${code}`) return special

  const map: Record<string, string> = {
    Tab: 'Tab', CapsLock: 'Caps Lock', Escape: 'Esc',
    LeftShift: 'L.Shift', RightShift: 'R.Shift',
    LeftControl: 'L.Ctrl', RightControl: 'R.Ctrl',
    LeftAlt: 'L.Alt', RightAlt: 'R.Alt',
    F13: 'F13', F14: 'F14', F15: 'F15', F16: 'F16',
  }
  if (map[code]) return map[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('F') && !isNaN(Number(code.slice(1)))) return code
  return code
}

function TabAppearance() {
  const { token, userSettings, patchUserSettings } = useStore()
  const t = useT()
  const [fontSize,    setFontSize]    = useState(userSettings.fontSize)
  const [compactMode, setCompactMode] = useState(userSettings.compactMode)
  const [colorTheme,  setColorTheme]  = useState(userSettings.colorTheme)
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function queueSave(patch: Partial<typeof userSettings>) {
    patchUserSettings(patch)
    if (saveRef.current) clearTimeout(saveRef.current)
    saveRef.current = setTimeout(() => {
      if (!token) return
      fetch(`${BASE}/api/user/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      }).catch(console.warn)
    }, 600)
  }

  const THEMES = Object.entries(THEME_META).map(([id, m]) => ({ id, ...m }))

  useEffect(() => {
    document.documentElement.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px'
    queueSave({ fontSize })

  }, [fontSize])

  useEffect(() => {
    applyColorTheme(colorTheme)
    queueSave({ colorTheme })

  }, [colorTheme])

  function applySettings() {
    queueSave({ compactMode })
  }

  return (
    <div className="flex flex-col gap-6">
      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
          {t('settings.appearance.colorTheme')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map(th => (
            <button key={th.id} onClick={() => setColorTheme(th.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{ background: colorTheme === th.id ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${colorTheme === th.id ? 'var(--eb-border2)' : 'var(--eb-border)'}` }}>
              <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: th.color }} />
              <span className="text-sm" style={{ color: 'var(--eb-text1)' }}>{th.label}</span>
              {colorTheme === th.id && <span className="ml-auto text-xs" style={{ color: 'var(--eb-online)' }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--eb-text2)' }}>
          {t('settings.appearance.fontSize')}
        </label>
        <div className="flex gap-2">
          {[
            { id: 'small',  label: t('settings.appearance.fontSmall') },
            { id: 'normal', label: t('settings.appearance.fontNormal') },
            { id: 'large',  label: t('settings.appearance.fontLarge') },
          ].map((s) => (
            <button key={s.id} onClick={() => setFontSize(s.id)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: fontSize === s.id ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.04)', color: fontSize === s.id ? '#fff' : 'var(--eb-text2)' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--eb-border)' }}>
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--eb-text1)' }}>{t('settings.appearance.compactMode')}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>{t('settings.appearance.compactDesc')}</div>
        </div>
        <button onClick={() => { const next = !compactMode; setCompactMode(next); queueSave({ compactMode: next }) }}
          className="relative w-10 h-5 rounded-full transition-all"
          style={{ background: compactMode ? 'var(--eb-gradient)' : 'var(--eb-bg4)' }}>
          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: compactMode ? '22px' : '2px' }} />
        </button>
      </div>

    </div>
  )
}

type UpdateCheckState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error'

function TabAccount() {
  const { token, currentUser, clearAuth, patchUserSettings, userSettings } = useStore()
  const t = useT()
  const router = useRouter()
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [updateState, setUpdateState] = useState<UpdateCheckState>('idle')
  const [updateMsg,   setUpdateMsg]   = useState('')
  const [appVersion,  setAppVersion]  = useState<string | null>(null)
  const el = typeof window !== 'undefined' ? (window as any).electronPZ : null

  useEffect(() => {
    if (!el?.getAppVersion) return
    el.getAppVersion().then((v: string) => setAppVersion(v)).catch(() => {})
  }, [])

  async function changePassword() {
    if (newPass !== confirmPass) { setMsg(t('settings.account.passwordMismatch')); return }
    if (newPass.length < 8) { setMsg(t('settings.account.passwordTooShort')); return }
    if (!token) return
    setSaving(true)
    setMsg('')
    try {
      await apiFetch('/api/auth/password', token, {
        method: 'PATCH',
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
      })
      setMsg(t('settings.account.passwordChanged'))
      setOldPass(''); setNewPass(''); setConfirmPass('')
    } catch (e: any) {
      setMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  function logout() {
    clearAuth()
    tokenStore.clear()
    router.push('/auth/login')
  }

  function changeLanguage(lang: 'pl' | 'en') {
    patchUserSettings({ language: lang })
    if (!token) return
    fetch(`${BASE}/api/user/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ language: lang }),
    }).catch(console.warn)
  }

  function checkForUpdates() {
    if (!el) { setUpdateState('error'); setUpdateMsg(t('settings.account.noElectron')); return }
    setUpdateState('checking')
    setUpdateMsg('')

    const timeout = setTimeout(() => {
      setUpdateState('error')
      setUpdateMsg(t('settings.account.updateTimeout'))
    }, 15000)

    const onAvailable = (e: Event) => {
      clearTimeout(timeout)
      const v = (e as CustomEvent).detail?.version ?? '?'
      setUpdateState('available')
      setUpdateMsg(t('settings.account.updateAvailable', { v }))
      cleanup()
    }
    const onNotAvailable = () => {
      clearTimeout(timeout)
      setUpdateState('up-to-date')
      setUpdateMsg(t('settings.account.upToDate'))
      cleanup()
    }
    const onError = (e: Event) => {
      clearTimeout(timeout)
      const errMsg = (e as CustomEvent).detail?.message ?? 'Error'
      setUpdateState('error')
      setUpdateMsg(errMsg)
      cleanup()
    }
    function cleanup() {
      window.removeEventListener('pz-update-available', onAvailable)
      window.removeEventListener('pz-update-not-available', onNotAvailable)
      window.removeEventListener('pz-update-error', onError)
    }

    window.addEventListener('pz-update-available',     onAvailable)
    window.addEventListener('pz-update-not-available', onNotAvailable)
    window.addEventListener('pz-update-error',         onError)
    el.updateCheck()
  }

  return (
    <div className="flex flex-col gap-6">
      {}
      <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--eb-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--eb-text2)' }}>{t('settings.account.info')}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>{t('settings.account.username')}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--eb-text1)' }}>@{currentUser?.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>{t('settings.account.userId')}</span>
            <span className="text-xs font-mono" style={{ color: 'var(--eb-text3)' }}>{currentUser?.id?.slice(0, 8)}...</span>
          </div>
          {el && (
            <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '0.5px solid var(--eb-border)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>{t('settings.account.appVersion')}</span>
                  {appVersion && (
                    <span className="text-xs font-semibold font-mono" style={{ color: 'var(--eb-text1)' }}>
                      v{appVersion}
                    </span>
                  )}
                </div>
                {updateMsg && (
                  <p className="text-[10px] mt-0.5" style={{
                    color: updateState === 'error' ? 'var(--eb-accent2)' : updateState === 'available' ? 'var(--eb-accent)' : 'var(--eb-online)'
                  }}>{updateMsg}</p>
                )}
              </div>
              <button
                onClick={checkForUpdates}
                disabled={updateState === 'checking'}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: updateState === 'checking' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
                  border: '0.5px solid var(--eb-border2)',
                  color: updateState === 'checking' ? 'var(--eb-text3)' : 'var(--eb-text1)',
                  opacity: updateState === 'checking' ? 0.6 : 1,
                }}>
                {updateState === 'checking' ? (
                  <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
                  </svg>
                )}
                {updateState === 'checking' ? t('settings.account.checking') : t('settings.account.checkUpdates')}
              </button>
            </div>
          )}
        </div>
      </div>

      {}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--eb-text1)' }}>{t('settings.account.changePassword')}</h3>
        <div className="flex flex-col gap-2">
          <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)}
            placeholder={t('settings.account.oldPassword')} className="ember-input w-full px-4 py-2.5 text-sm" />
          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
            placeholder={t('settings.account.newPassword')} className="ember-input w-full px-4 py-2.5 text-sm" />
          <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
            placeholder={t('settings.account.confirmPassword')} className="ember-input w-full px-4 py-2.5 text-sm"
            style={confirmPass && newPass !== confirmPass ? { borderColor: 'rgba(220,38,38,0.5)' } : undefined} />
          {msg && <span className="text-xs" style={{ color: msg.startsWith('✓') ? 'var(--eb-online)' : 'var(--eb-accent2)' }}>{msg}</span>}
          <button onClick={changePassword} disabled={saving || !oldPass || !newPass} className="ember-btn py-2.5 text-sm mt-1">
            {saving ? t('settings.account.changing') : t('settings.account.changeBtn')}
          </button>
        </div>
      </div>

      {}
      <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid var(--eb-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--eb-text2)' }}>{t('settings.account.language')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--eb-text3)' }}>{t('settings.account.languageDesc')}</p>
          </div>
          <div className="flex gap-1.5">
            {(['pl', 'en'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => changeLanguage(lang)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: userSettings.language === lang ? 'var(--eb-gradient)' : 'rgba(255,255,255,0.06)',
                  color: userSettings.language === lang ? '#fff' : 'var(--eb-text2)',
                  border: `0.5px solid ${userSettings.language === lang ? 'transparent' : 'var(--eb-border)'}`,
                }}>
                {lang === 'pl' ? '🇵🇱 PL' : '🇬🇧 EN'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {}
      <div className="pt-4" style={{ borderTop: '0.5px solid var(--eb-border)' }}>
        <button onClick={logout}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)', border: '1px solid rgba(220,38,38,0.25)' }}>
          {t('settings.account.logout')}
        </button>
      </div>
    </div>
  )
}

interface Props { onClose: () => void }

export function UserSettings({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('audio')
  const t = useT()

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'profil',  label: t('settings.tab.profile'),    icon: '👤' },
    { id: 'audio',   label: t('settings.tab.audio'),      icon: '🎤' },
    { id: 'wygląd',  label: t('settings.tab.appearance'), icon: '🎨' },
    { id: 'konto',   label: t('settings.tab.account'),    icon: '🔐' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex"
        style={{ background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)', maxHeight: '85vh' }}>

        {}
        <div className="flex flex-col border-r py-4 flex-shrink-0"
          style={{ width: 200, background: 'var(--eb-bg0)', borderColor: 'var(--eb-border)' }}>
          <div className="px-4 pb-3 mb-2 border-b" style={{ borderColor: 'var(--eb-border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--eb-text3)' }}>{t('settings.title')}</p>
          </div>

          <div className="flex flex-col gap-0.5 px-2 flex-1">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm"
                style={{
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--eb-text1)' : 'var(--eb-text2)',
                  fontWeight: activeTab === tab.id ? 500 : 400,
                }}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>

          <div className="px-2 pt-2 border-t mt-2" style={{ borderColor: 'var(--eb-border)' }}>
            <button onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full transition-all hover:bg-white/[0.04]"
              style={{ color: 'var(--eb-text3)' }}>
              <span>✕</span> {t('settings.close')}
            </button>
          </div>
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--eb-text1)' }}>
            {TABS.find(tab => tab.id === activeTab)?.icon} {TABS.find(tab => tab.id === activeTab)?.label}
          </h2>
          {activeTab === 'profil'  && <TabProfile />}
          {activeTab === 'audio'   && <TabAudio />}
          {activeTab === 'wygląd'  && <TabAppearance />}
          {activeTab === 'konto'   && <TabAccount />}
        </div>
      </div>
    </div>
  )
}
