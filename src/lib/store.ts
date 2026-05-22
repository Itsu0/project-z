import { create } from 'zustand'
import type { Message, VoiceState, TypingIndicator } from '@/types'

export interface UserSettings {
  inputDevice: string
  outputDevice: string
  inputVolume: number
  outputVolume: number
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGain: boolean
  audioProfile: string
  vadThreshold: number
  pttEnabled: boolean
  pttKey: string
  fontSize: string
  compactMode: boolean
  colorTheme: string
}

export const DEFAULT_SETTINGS: UserSettings = {
  inputDevice: '', outputDevice: '',
  inputVolume: 100, outputVolume: 100,
  noiseSuppression: true, echoCancellation: true, autoGain: true,
  audioProfile: 'zbalansowany', vadThreshold: 0,
  pttEnabled: false, pttKey: 'Space',
  fontSize: 'normal', compactMode: false, colorTheme: 'ember',
}

export interface AuthUser {
  id: string
  username: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  status: string
  custom_status?: string | null
  is_dev?: number | boolean
}

export interface RealServer {
  id: string
  name: string
  icon_url: string | null
  icon_color: string
  owner_id: string
  plan: string
  member_limit: number
  invite_code: string
  memberCount?: number
  onlineCount?: number
}

export interface RealChannel {
  id: string
  server_id: string
  category_id: string | null
  type: 'text' | 'voice' | 'announcement' | 'forum' | 'stage'
  name: string
  topic: string | null
  position: number
  bitrate?: number
  user_limit?: number
}

export interface RealMember {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  avatar_color: string
  status: string
  custom_status?: string | null
  is_dev?: number | boolean
  nickname: string | null
  roles?: any[]
}

interface Store {

  token: string | null
  currentUser: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  setCurrentUserStatus: (status: string) => void
  clearAuth: () => void

  servers: RealServer[]
  currentServerId: string | null
  setServers: (servers: RealServer[]) => void
  addServer: (server: RealServer) => void
  setCurrentServer: (id: string) => void

  channels: Record<string, RealChannel[]>
  currentChannelId: string | null
  setChannels: (serverId: string, channels: RealChannel[]) => void
  setCurrentChannel: (id: string) => void

  members: Record<string, RealMember[]>
  setMembers:          (serverId: string, members: RealMember[])           => void
  addMember:           (serverId: string, member: RealMember)              => void
  removeMember:        (serverId: string, userId: string)                  => void
  updateMemberStatus:  (userId: string, status: string)                   => void

  messages: Record<string, Message[]>
  messagesLastFetched: Record<string, number>
  addMessage: (channelId: string, msg: Message) => void
  updateMessage: (channelId: string, msgId: string, data: Partial<Message>) => void
  deleteMessage: (channelId: string, msgId: string) => void
  setMessages: (channelId: string, msgs: Message[]) => void
  prependMessages: (channelId: string, msgs: Message[]) => void
  touchChannelFetch: (channelId: string) => void

  voice: VoiceState
  setVoiceMuted: (m: boolean) => void
  setVoiceDeafened: (d: boolean) => void
  joinVoice: (channelId: string) => void
  leaveVoice: () => void

  typing: Record<string, TypingIndicator[]>
  addTyping: (channelId: string, indicator: TypingIndicator) => void
  removeTyping: (channelId: string, userId: string) => void

  userSettings: UserSettings
  setUserSettings: (s: UserSettings) => void
  patchUserSettings: (patch: Partial<UserSettings>) => void

  membersPanelOpen: boolean
  toggleMembersPanel: () => void
}

export const useStore = create<Store>((set, get) => ({

  token: typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null,
  currentUser: null,
  setAuth: (token, user) => set({ token, currentUser: user }),
  setCurrentUserStatus: (status: string) => set(state => ({
    currentUser: state.currentUser ? { ...state.currentUser, status } : null
  })),
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nexus_token')
      document.cookie = 'nexus_token=; path=/; max-age=0'
    }
    set({ token: null, currentUser: null, servers: [], channels: {}, members: {} })
  },

  servers: [],
  currentServerId: null,
  setServers: (servers) => set({ servers }),
  addServer: (server) => set((s) => ({ servers: [...s.servers, server] })),
  setCurrentServer: (id) => set({ currentServerId: id, currentChannelId: null }),

  channels: {},
  currentChannelId: null,
  setChannels: (serverId, channels) => set((s) => ({
    channels: { ...s.channels, [serverId]: channels },
  })),
  setCurrentChannel: (id) => set({ currentChannelId: id }),

  members: {},
  setMembers: (serverId, members) => set((s) => ({
    members: { ...s.members, [serverId]: members },
  })),
  addMember: (serverId, member) => set((s) => {
    const existing = s.members[serverId] ?? []
    if (existing.some(m => m.user_id === member.user_id)) return s
    return { members: { ...s.members, [serverId]: [...existing, member] } }
  }),
  removeMember: (serverId, userId) => set((s) => ({
    members: {
      ...s.members,
      [serverId]: (s.members[serverId] ?? []).filter(m => m.user_id !== userId),
    },
  })),
  updateMemberStatus: (userId, status) => set((s) => {

    const updated: Record<string, RealMember[]> = {}
    let changed = false
    for (const [serverId, list] of Object.entries(s.members)) {
      const idx = list.findIndex(m => m.user_id === userId)
      if (idx !== -1 && list[idx].status !== status) {
        const newList = [...list]
        newList[idx] = { ...newList[idx], status }
        updated[serverId] = newList
        changed = true
      }
    }
    if (!changed) return s
    return { members: { ...s.members, ...updated } }
  }),

  messages: {},
  messagesLastFetched: {},
  touchChannelFetch: (channelId) => set((s) => ({
    messagesLastFetched: { ...s.messagesLastFetched, [channelId]: Date.now() },
  })),
  addMessage: (channelId, msg) => set((s) => ({
    messages: {
      ...s.messages,
      [channelId]: [...(s.messages[channelId] ?? []), msg],
    },
  })),
  updateMessage: (channelId, msgId, data) => set((s) => ({
    messages: {
      ...s.messages,
      [channelId]: (s.messages[channelId] ?? []).map(m =>
        m.id === msgId ? { ...m, ...data } : m
      ),
    },
  })),
  deleteMessage: (channelId, msgId) => set((s) => ({
    messages: {
      ...s.messages,
      [channelId]: (s.messages[channelId] ?? []).filter(m => m.id !== msgId),
    },
  })),
  setMessages: (channelId, msgs) => set((s) => ({
    messages: { ...s.messages, [channelId]: msgs },
  })),
  prependMessages: (channelId, msgs) => set((s) => ({
    messages: {
      ...s.messages,
      [channelId]: [...msgs, ...(s.messages[channelId] ?? [])],
    },
  })),

  voice: {
    channelId: null, channel: null, serverId: null,
    connected: false, muted: false, deafened: false, speaking: false, participants: [],
  },
  setVoiceMuted: (muted) => set((s) => ({ voice: { ...s.voice, muted } })),
  setVoiceDeafened: (deafened) => set((s) => ({ voice: { ...s.voice, deafened } })),
  joinVoice: (channelId) => set((s) => ({
    voice: { ...s.voice, channelId, serverId: s.currentServerId, connected: true },
  })),
  leaveVoice: () => set((s) => ({
    voice: { ...s.voice, channelId: null, channel: null, connected: false, participants: [] },
  })),

  typing: {},
  addTyping: (channelId, indicator) => set((s) => {
    const existing = (s.typing[channelId] ?? []).filter(t => t.userId !== indicator.userId)
    return { typing: { ...s.typing, [channelId]: [...existing, indicator] } }
  }),
  removeTyping: (channelId, userId) => set((s) => ({
    typing: {
      ...s.typing,
      [channelId]: (s.typing[channelId] ?? []).filter(t => t.userId !== userId),
    },
  })),

  userSettings: DEFAULT_SETTINGS,
  setUserSettings: (s) => set({ userSettings: s }),
  patchUserSettings: (patch) => set((state) => ({
    userSettings: { ...state.userSettings, ...patch },
  })),

  membersPanelOpen: true,
  toggleMembersPanel: () => set((s) => ({ membersPanelOpen: !s.membersPanelOpen })),
}))
