'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { UserSettings } from '@/components/settings/UserSettings'

const STATUS_META: Record<string, { color: string; label: string }> = {
  online:  { color: '#22c55e', label: 'Online' },
  idle:    { color: '#f59e0b', label: 'Zaraz wracam' },
  dnd:     { color: '#ef4444', label: 'Nie przeszkadzać' },
  offline: { color: '#6b7280', label: 'Offline' },
}

export function ChannelSidebar() {
  const { currentUser } = useStore()
  const [showSettings, setShowSettings] = useState(false)
  const [avatarImgError, setAvatarImgError] = useState(false)

  useEffect(() => { setAvatarImgError(false) }, [currentUser?.avatar_url])

  const status     = (currentUser?.status as string) ?? 'offline'
  const statusMeta = STATUS_META[status] ?? STATUS_META.offline
  const initial    = (currentUser?.display_name ?? '?').slice(0, 1).toUpperCase()
  const avatarColor = currentUser?.avatar_color ?? 'linear-gradient(135deg,#dc2626,#f59e0b)'

  return (
    <>
      <aside className="flex flex-col border-r"
        style={{ width: 200, background: 'var(--eb-bg1)', borderColor: 'var(--eb-border)' }}>

        <div className="flex-1" />

        <div
          className="flex items-center gap-2.5 px-3 py-2.5 border-t cursor-pointer transition-colors hover:bg-white/[0.04] group"
          style={{ background: 'var(--eb-bg0)', borderColor: 'var(--eb-border)' }}
          onClick={() => setShowSettings(true)}
          title="Ustawienia użytkownika"
        >
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm"
              style={{ background: currentUser?.avatar_url && !avatarImgError ? 'transparent' : avatarColor }}>
              {currentUser?.avatar_url && !avatarImgError
                ? <img
                    src={currentUser.avatar_url}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    onError={() => setAvatarImgError(true)}
                  />
                : initial
              }
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{ background: statusMeta.color, borderColor: 'var(--eb-bg0)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="text-xs font-semibold truncate leading-tight" style={{ color: 'var(--eb-text1)' }}>
                {currentUser?.display_name ?? '...'}
              </div>
              {currentUser?.is_dev ? (
                <span className="text-[8px] font-bold px-1 py-0.5 rounded flex-shrink-0 leading-none"
                  style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '0.5px solid rgba(139,92,246,0.4)' }}>
                  DEV
                </span>
              ) : null}
            </div>
            <div className="text-[10px] font-medium mt-0.5" style={{ color: statusMeta.color }}>
              {statusMeta.label}
            </div>
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: 'var(--eb-text3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
        </div>
      </aside>

      {showSettings && <UserSettings onClose={() => setShowSettings(false)} />}
    </>
  )
}
