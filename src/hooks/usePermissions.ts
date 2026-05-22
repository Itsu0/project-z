import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function usePermissions(serverId: string | null) {
  const { token } = useStore()
  const [permissions, setPermissions] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!token || !serverId) { setPermissions([]); setLoaded(false); return }
    fetch(`${BASE}/api/servers/${serverId}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setPermissions(d.permissions ?? []); setLoaded(true) })
      .catch(() => { setPermissions([]); setLoaded(true) })
  }, [token, serverId])

  const has = (perm: string) =>
    permissions.includes('ADMINISTRATOR') || permissions.includes(perm)

  return {
    permissions,
    loaded,
    isAdmin:       has('ADMINISTRATOR'),
    canManageServer:   has('MANAGE_SERVER'),
    canManageChannels: has('MANAGE_CHANNELS'),
    canManageRoles:    has('MANAGE_ROLES'),
    canKick:           has('KICK_MEMBERS'),
    canBan:            has('BAN_MEMBERS'),
    canManageMessages: has('MANAGE_MESSAGES'),
    canMute:           has('MUTE_MEMBERS'),
  }
}
