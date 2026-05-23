'use client'
import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useStore } from '@/lib/store'

const BASE      = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'
const API_BASE  = process.env.NEXT_PUBLIC_API_URL    ?? 'http://localhost:3001'

let _socket: Socket | null = null
let _listenersSetup = false

function getSocket(token: string): Socket {

  if (_socket) return _socket
  _socket = io(BASE, {
    auth: { token },

    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  })
  return _socket
}

export function getSocketInstance(): Socket | null {
  return _socket
}

export function useSocket() {
  const {
    token, currentServerId, currentChannelId,
    addMessage, updateMessage, deleteMessage,
    addTyping, removeTyping,
  } = useStore()

  useEffect(() => {
    if (!token || _listenersSetup) return
    _listenersSetup = true

    const s = getSocket(token)

    s.on('connect', () => {
      console.log('🔌 Socket połączony:', s.id)
      const { currentServerId, currentChannelId } = useStore.getState()
      if (currentServerId)  s.emit('join_server',  currentServerId)
      if (currentChannelId) s.emit('join_channel', currentChannelId)
    })

    s.on('disconnect', (reason: string) => {
      console.log('❌ Socket rozłączony:', reason)
    })

    s.on('MESSAGE_CREATE', (data: any) => {
      const channelId = data.channel_id ?? data.channelId
      if (!channelId) return

      const msg = {
        id:        data.id,
        channelId,
        serverId:  data.server_id ?? data.serverId,
        type:      data.type ?? 'DEFAULT',
        content:   data.content,
        createdAt: data.created_at ?? data.createdAt ?? new Date().toISOString(),
        editedAt:  data.edited_at ?? undefined,
        pinned:    !!data.pinned,
        author: {
          id:            data.author_id,
          username:      data.author_username ?? '',
          displayName:   data.author_display_name ?? data.author_username ?? '',
          avatarColor:   data.author_avatar_color ?? '#64748b',
          avatar:        data.author_avatar_url ?? undefined,
          status:        'online' as any,
          discriminator: '0000',
        },
        reactions:   (data.reactions ?? []).map((r: any) => ({
          emoji: r.emoji, count: Number(r.count), userReacted: !!r.user_reacted,
        })),
        embeds:      data.embeds      ?? [],
        attachments: (data.attachments ?? []).map((a: any) => ({
          id:          a.id,
          filename:    a.filename,
          url:         a.url,
          contentType: a.content_type ?? a.contentType ?? '',
          size:        a.size,
          width:       a.width  ?? null,
          height:      a.height ?? null,
        })),
        poll:        data.poll ?? null,
        replyTo:     data.replyTo     ?? data.reply_to ?? (data.reply_to_msg_id ? {
          id: data.reply_to_msg_id,
          content: data.reply_to_content ?? '',
          authorName: data.reply_to_author_name ?? 'Użytkownik',
        } : null),
        isAdminMsg: !!(data.is_admin_msg ?? data.isAdminMsg),
      }

      const store = useStore.getState()
      const channelMsgs = store.messages[channelId] ?? []

      if (data.nonce) {
        const nonceMsg = channelMsgs.find(m => m.id === data.nonce)
        if (nonceMsg) {

          store.updateMessage(channelId, data.nonce, {
            ...msg,
            author: {
              ...msg.author,
              avatar: msg.author.avatar ?? nonceMsg.author.avatar,
            },
          })
          return
        }
      }

      if (!channelMsgs.some(m => m.id === data.id)) {
        store.addMessage(channelId, msg)
      }
    })

    s.on('MESSAGE_UPDATE', (data: any) => {
      const channelId = data.channel_id ?? data.channelId
      if (channelId) {
        useStore.getState().updateMessage(channelId, data.id, {
          content: data.content,
          editedAt: data.edited_at,
        })
      }
    })

    s.on('MESSAGE_DELETE', (data: { id: string; channelId: string }) => {
      useStore.getState().deleteMessage(data.channelId, data.id)
    })

    s.on('MESSAGE_PIN', (data: { messageId: string; channelId: string; pinned: boolean }) => {
      useStore.getState().updateMessage(data.channelId, data.messageId, { pinned: data.pinned })
    })

    s.on('TYPING_START', (data: { userId: string; username: string; channelId: string }) => {
      const { currentUser, addTyping } = useStore.getState()
      if (data.userId === currentUser?.id) return
      addTyping(data.channelId, {
        userId: data.userId,
        username: data.username,
        channelId: data.channelId,
        expiresAt: Date.now() + 5500,
      })
    })

    s.on('TYPING_STOP', (data: { userId: string; channelId: string }) => {
      useStore.getState().removeTyping(data.channelId, data.userId)
    })

    s.on('MEMBER_JOIN', async (data: { serverId: string; member: any }) => {

      useStore.getState().addMember(data.serverId, data.member)

      try {
        const { token } = useStore.getState()
        if (!token) return
        const res = await fetch(`${API_BASE}/api/servers/${data.serverId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const d = await res.json()
        if (Array.isArray(d.members)) useStore.getState().setMembers(data.serverId, d.members)
      } catch {}
    })

    s.on('MEMBER_LEAVE', async (data: { serverId: string; userId: string }) => {

      useStore.getState().removeMember(data.serverId, data.userId)

      try {
        const { token } = useStore.getState()
        if (!token) return
        const res = await fetch(`${API_BASE}/api/servers/${data.serverId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const d = await res.json()
        if (Array.isArray(d.members)) useStore.getState().setMembers(data.serverId, d.members)
      } catch {}
    })

    const handleForcedLeave = (data: { serverId: string }) => {
      const store = useStore.getState()
      const remaining = store.servers.filter(s => s.id !== data.serverId)
      store.setServers(remaining)
      _socket?.emit('leave_server', data.serverId)
      if (store.currentServerId === data.serverId) {
        const next = remaining[0]
        store.setCurrentServer(next?.id ?? '')
        store.setCurrentChannel('')
      }
    }

    s.on('KICKED', handleForcedLeave)
    s.on('BANNED', handleForcedLeave)

    s.on('PRESENCE_UPDATE', (data: { userId: string; status: string }) => {
      useStore.getState().updateMemberStatus(data.userId, data.status)
    })

    s.on('POLL_UPDATE', (data: { pollId: string; messageId: string; channelId: string; poll: any }) => {
      useStore.getState().updateMessage(data.channelId, data.messageId, { poll: data.poll })
    })

    s.on('CHANNEL_CREATE', (data: { serverId: string; channel: any }) => {
      const store = useStore.getState()
      const existing = store.channels[data.serverId] ?? []
      if (!existing.some(c => c.id === data.channel?.id)) {
        store.setChannels(data.serverId, [...existing, data.channel])
      }
    })

    s.on('CHANNEL_DELETE', (data: { serverId: string; channelId: string }) => {
      const store = useStore.getState()
      const existing = store.channels[data.serverId] ?? []
      const updated = existing.filter(c => c.id !== data.channelId)
      store.setChannels(data.serverId, updated)
      if (store.currentChannelId === data.channelId) {
        const next = updated.find(c => c.type === 'text' || c.type === 'announcement')
        store.setCurrentChannel(next?.id ?? '')
      }
    })

    s.on('CHANNELS_REORDER', (data: { serverId: string; channels: { id: string; position: number }[] }) => {
      const store = useStore.getState()
      const existing = store.channels[data.serverId] ?? []
      if (!existing.length) return
      const posMap: Record<string, number> = {}
      data.channels.forEach(c => { posMap[c.id] = c.position })
      const updated = existing
        .map(c => posMap[c.id] !== undefined ? { ...c, position: posMap[c.id] } : c)
        .sort((a, b) => a.position - b.position)
      store.setChannels(data.serverId, updated)
    })

    s.on('PROFILE_UPDATE', (data: { userId: string; displayName?: string; customStatus?: string | null; avatarColor?: string; avatarUrl?: string | null }) => {
      const store = useStore.getState()

      Object.keys(store.members).forEach(serverId => {
        const list = store.members[serverId]
        if (list?.some(m => m.user_id === data.userId)) {
          store.setMembers(serverId, list.map(m => m.user_id === data.userId ? {
            ...m,
            display_name: data.displayName ?? m.display_name,
            custom_status: data.customStatus !== undefined ? data.customStatus : m.custom_status,
            avatar_color: data.avatarColor ?? m.avatar_color,
            avatar_url: data.avatarUrl !== undefined ? data.avatarUrl : m.avatar_url,
          } : m))
        }
      })

      const { currentUser, token } = store
      if (currentUser && currentUser.id === data.userId) {
        store.setAuth(token!, {
          ...currentUser,
          display_name: data.displayName ?? currentUser.display_name,
          custom_status: data.customStatus !== undefined ? data.customStatus : currentUser.custom_status,
          avatar_color: data.avatarColor ?? currentUser.avatar_color,
          avatar_url: data.avatarUrl !== undefined ? data.avatarUrl : currentUser.avatar_url,
        })
      }
    })

  }, [token])

  const prevChannelRef = useRef<string | null>(null)
  const prevServerRef  = useRef<string | null>(null)

  useEffect(() => {
    if (!_socket) return

    if (prevChannelRef.current && prevChannelRef.current !== currentChannelId) {
      _socket.emit('leave_channel', prevChannelRef.current)
    }

    if (prevServerRef.current && prevServerRef.current !== currentServerId) {
      _socket.emit('leave_server', prevServerRef.current)
    }

    if (currentServerId)  _socket.emit('join_server',  currentServerId)
    if (currentChannelId) _socket.emit('join_channel', currentChannelId)

    prevChannelRef.current = currentChannelId
    prevServerRef.current  = currentServerId
  }, [currentServerId, currentChannelId])

  const sendMessage = useCallback((channelId: string, serverId: string, content: string, nonce?: string, replyToId?: string, attachmentIds?: string[]) => {
    _socket?.emit('MESSAGE_CREATE', { channelId, serverId, content, nonce, replyToId, attachmentIds })
  }, [])

  const editMessage = useCallback((messageId: string, channelId: string, content: string) => {
    _socket?.emit('MESSAGE_UPDATE', { messageId, channelId, content })
  }, [])

  const startTyping = useCallback((channelId: string) => {
    _socket?.emit('TYPING_START', { channelId })
  }, [])

  const stopTyping = useCallback((channelId: string) => {
    _socket?.emit('TYPING_STOP', { channelId })
  }, [])

  const addReaction = useCallback((messageId: string, channelId: string, emoji: string) => {
    _socket?.emit('REACTION_ADD', { messageId, channelId, emoji })
  }, [])

  const removeReaction = useCallback((messageId: string, channelId: string, emoji: string) => {
    _socket?.emit('REACTION_REMOVE', { messageId, channelId, emoji })
  }, [])

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    _socket?.on(event, handler)
  }, [])

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (handler) _socket?.off(event, handler)
    else _socket?.off(event)
  }, [])

  const emit = useCallback((event: string, data?: any) => {
    _socket?.emit(event, data)
  }, [])

  return { sendMessage, editMessage, startTyping, stopTyping, addReaction, removeReaction, on, off, emit }
}
