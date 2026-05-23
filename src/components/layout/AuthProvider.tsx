'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore, DEFAULT_SETTINGS, type UserSettings } from '@/lib/store'
import { api, tokenStore } from '@/lib/api'
import { WarningNotification } from '@/components/moderation/WarningNotification'
import { UpdateBanner } from '@/components/layout/UpdateBanner'
import { useSocket } from '@/hooks/useSocket'
import { applyColorTheme } from '@/lib/themes'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, clearAuth, setServers, setChannels, setMembers, setCurrentServer, setCurrentChannel, setCurrentUserStatus, updateMemberStatus, token, setUserSettings } = useStore()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const { on, off } = useSocket()

  useEffect(() => {
    const handler = (data: { userId: string; status: string }) => {
      updateMemberStatus(data.userId, data.status)
    }
    on('USER_STATUS', handler)
    return () => off('USER_STATUS', handler)
  }, [on, off, updateMemberStatus])

  useEffect(() => {
    const storedToken = tokenStore.get()
    if (!storedToken) {
      router.push('/auth/login')
      return
    }

    api.auth.me(storedToken)
      .then(async ({ user }) => {
        const savedStatus = (typeof window !== 'undefined' ? localStorage.getItem('pz_status_pref') : null) ?? 'online'
        setAuth(storedToken, { ...user, status: savedStatus })
        setCurrentUserStatus(savedStatus)

        try {
          const sRes = await fetch(`${BASE}/api/user/settings`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          })
          const sData = await sRes.json()
          let settings: UserSettings = { ...DEFAULT_SETTINGS, ...sData.settings }

          if (settings.vadThreshold > 15) settings = { ...settings, vadThreshold: 0 }

          const isEmpty = !sData.settings || Object.keys(sData.settings).length === 0
          if (isEmpty) {
            try {
              const local = JSON.parse(localStorage.getItem('pz_audio_prefs') ?? '{}')
              if (Object.keys(local).length > 0) {
                settings = { ...settings, ...local }

                await fetch(`${BASE}/api/user/settings`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storedToken}` },
                  body: JSON.stringify(settings),
                }).catch(() => {})
              }
            } catch {}
          }
          setUserSettings(settings)

          const fs = settings.fontSize
          document.documentElement.style.fontSize = fs === 'small' ? '14px' : fs === 'large' ? '18px' : '16px'
          applyColorTheme(settings.colorTheme ?? 'ember')
        } catch {}

        await fetch(`${BASE}/api/auth/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${storedToken}` },
          body: JSON.stringify({ status: savedStatus }),
        }).catch(() => {})

        const res = await fetch(`${BASE}/api/servers`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
        const data = await res.json()
        const servers = data.servers ?? []
        setServers(servers)

        if (servers.length === 0) {

          setReady(true)
          return
        }

        const firstServer = servers[0]
        setCurrentServer(firstServer.id)

        const srvRes = await fetch(`${BASE}/api/servers/${firstServer.id}`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
        const srvData = await srvRes.json()
        setChannels(firstServer.id, srvData.channels ?? [])
        setMembers(firstServer.id, srvData.members ?? [])

        const firstTextChannel = (srvData.channels ?? []).find(
          (c: any) => c.type === 'text' || c.type === 'announcement'
        )
        if (firstTextChannel) setCurrentChannel(firstTextChannel.id)

        setReady(true)
      })
      .catch(() => {
        clearAuth()
        router.push('/auth/login')
      })
  }, [])

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--eb-bg0)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
            style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}
          >
            N
          </div>
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <span style={{ fontSize: 13, color: 'var(--eb-text3)' }}>Ładowanie...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <WarningNotification />
      <UpdateBanner />
      {children}
    </>
  )
}
