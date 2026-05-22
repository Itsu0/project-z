'use client'
import { useState } from 'react'
import { ServerRail } from '@/components/layout/ServerRail'
import { NotificationsPanelExpanded } from '@/components/layout/NotificationsPanel'
import { ChannelSidebar } from '@/components/layout/ChannelSidebar'
import { ChatArea } from '@/components/chat/ChatArea'
import { MembersPanel } from '@/components/members/MembersPanel'
import { VoiceDock } from '@/components/voice/VoiceDock'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { ServerSettings } from '@/components/settings/ServerSettings'
import { VoiceProvider } from '@/contexts/VoiceContext'
import { ScreenShareView } from '@/components/voice/ScreenShareView'
import { useStore } from '@/lib/store'

function AppLayout() {
  const { membersPanelOpen } = useStore()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <main className="flex h-full overflow-hidden" style={{ background: 'var(--eb-bg0)', position: 'relative' }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--eb-glow)', zIndex: 0 }} />
      <div className="relative flex w-full h-full" style={{ zIndex: 1 }}>
        <ServerRail />
        <NotificationsPanelExpanded />
        <ChatArea onOpenSettings={() => setShowSettings(true)} />
        {membersPanelOpen && <MembersPanel />}
      </div>
      <VoiceDock />
      <ScreenShareView />
      {showSettings && <ServerSettings onClose={() => setShowSettings(false)} />}
    </main>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <VoiceProvider>
        <AppLayout />
      </VoiceProvider>
    </AuthProvider>
  )
}
