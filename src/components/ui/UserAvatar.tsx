'use client'
import { useState } from 'react'
import clsx from 'clsx'
import type { User, UserStatus } from '@/types'

interface Props {
  user: Pick<User, 'displayName' | 'avatar' | 'avatarColor' | 'status'>
  size?: number
  showStatus?: boolean
  statusOverride?: UserStatus
  className?: string
}

export function UserAvatar({ user, size = 32, showStatus = false, statusOverride, className }: Props) {
  const status = statusOverride ?? user.status
  const initials = user.displayName.slice(0, 1).toUpperCase()
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className={clsx('relative flex-shrink-0 flex items-center justify-center rounded-full font-medium text-white select-none', className)}
      style={{ width: size, height: size, background: user.avatarColor ?? '#444', fontSize: size * 0.38 }}
    >
      {user.avatar && !imgError ? (
        <img
          src={user.avatar}
          alt={user.displayName}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : initials}

      {showStatus && (
        <span
          className={clsx('absolute rounded-full border-[2px]', {
            'bg-[var(--eb-online)]':  status === 'online',
            'bg-[var(--eb-accent)]':  status === 'idle',
            'bg-[var(--eb-accent2)]': status === 'dnd',
            'bg-[var(--eb-text3)]':   status === 'offline',
          })}
          style={{
            width: Math.max(8, size * 0.28),
            height: Math.max(8, size * 0.28),
            bottom: -1, right: -1,
            borderColor: 'var(--eb-bg1)',
          }}
        />
      )}
    </div>
  )
}
