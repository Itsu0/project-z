import { useCallback } from 'react'
import { useStore } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function api(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Błąd serwera')
  return data
}

export function useModeration(serverId: string) {
  const { token } = useStore()

  const mute = useCallback(async (userId: string, duration: number, reason?: string) => {
    if (!token) throw new Error('Brak tokena')
    return api(`/api/servers/${serverId}/moderation/mute/${userId}`, token, {
      method: 'POST',
      body: JSON.stringify({ duration, reason }),
    })
  }, [token, serverId])

  const unmute = useCallback(async (userId: string) => {
    if (!token) throw new Error('Brak tokena')
    return api(`/api/servers/${serverId}/moderation/mute/${userId}`, token, { method: 'DELETE' })
  }, [token, serverId])

  const ban = useCallback(async (userId: string, reason?: string) => {
    if (!token) throw new Error('Brak tokena')
    return api(`/api/servers/${serverId}/moderation/ban/${userId}`, token, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }, [token, serverId])

  const unban = useCallback(async (userId: string) => {
    if (!token) throw new Error('Brak tokena')
    return api(`/api/servers/${serverId}/moderation/ban/${userId}`, token, { method: 'DELETE' })
  }, [token, serverId])

  const kick = useCallback(async (userId: string) => {
    if (!token) throw new Error('Brak tokena')
    return api(`/api/servers/${serverId}/moderation/kick/${userId}`, token, { method: 'DELETE' })
  }, [token, serverId])

  const deleteMessage = useCallback(async (channelId: string, messageId: string) => {
    if (!token) throw new Error('Brak tokena')
    return api(`/api/channels/${channelId}/messages/${messageId}`, token, { method: 'DELETE' })
  }, [token])

  const getMutes = useCallback(async () => {
    if (!token) return []
    const data = await api(`/api/servers/${serverId}/moderation/mutes`, token)
    return data.mutes ?? []
  }, [token, serverId])

  const getBans = useCallback(async () => {
    if (!token) return []
    const data = await api(`/api/servers/${serverId}/moderation/bans`, token)
    return data.bans ?? []
  }, [token, serverId])

  return { mute, unmute, ban, unban, kick, deleteMessage, getMutes, getBans }
}
