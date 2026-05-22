'use client'
import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STALE_MS = 60_000

function mapMessage(data: any): any {
  return {
    id: data.id,
    channelId: data.channel_id ?? data.channelId,
    serverId: data.server_id ?? data.serverId,
    type: data.type ?? 'DEFAULT',
    content: data.content,
    createdAt: data.created_at ?? data.createdAt ?? new Date().toISOString(),
    editedAt: data.edited_at ?? data.editedAt ?? null,
    pinned: !!data.pinned,
    author: {
      id: data.author_id,
      username: data.author_username ?? '',
      displayName: data.author_display_name ?? data.author_username ?? '',
      avatarColor: data.author_avatar_color ?? 'linear-gradient(135deg,#64748b,#475569)',
      avatar: data.author_avatar_url ?? undefined,
      status: data.author_status ?? 'online',
      discriminator: '0000',
    },
    reactions: (data.reactions ?? []).map((r: any) => ({
      emoji: r.emoji,
      count: Number(r.count),
      userReacted: !!r.user_reacted,
    })),
    embeds: data.embeds ?? [],
    attachments: (data.attachments ?? []).map((a: any) => ({
      id:          a.id,
      filename:    a.filename,
      url:         a.url,
      contentType: a.content_type ?? a.contentType ?? '',
      size:        a.size,
      width:       a.width  ?? null,
      height:      a.height ?? null,
    })),
    poll: data.poll ?? null,
    replyTo: data.reply_to ?? data.replyTo ?? (data.reply_to_msg_id ? {
      id: data.reply_to_msg_id,
      content: data.reply_to_content ?? '',
      authorName: data.reply_to_author_name ?? 'Użytkownik',
    } : null),
  }
}

export function useMessages(channelId: string) {
  const { messages, setMessages, prependMessages, token } = useStore()
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const channelMessages = messages[channelId] ?? []

  useEffect(() => {
    if (!channelId || !token) return

    const { messages: liveMessages, messagesLastFetched, touchChannelFetch } = useStore.getState()
    const lastFetch = messagesLastFetched[channelId] ?? 0
    const hasCached = (liveMessages[channelId] ?? []).filter(m => !m.id.startsWith('nonce_')).length > 0

    if (hasCached && Date.now() - lastFetch < STALE_MS) {

      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`${BASE}/api/channels/${channelId}/messages?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const { setMessages: liveSet, touchChannelFetch: liveTouch } = useStore.getState()
        liveSet(channelId, (data.messages ?? []).map(mapMessage))
        setHasMore(data.hasMore ?? false)
        liveTouch(channelId)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [channelId, token])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !token) return
    const oldest = channelMessages[0]
    if (!oldest) return

    setLoadingMore(true)
    try {
      const res = await fetch(
        `${BASE}/api/channels/${channelId}/messages?limit=50&before=${oldest.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      prependMessages(channelId, (data.messages ?? []).map(mapMessage))
      setHasMore(data.hasMore ?? false)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }, [channelId, token, hasMore, loadingMore, channelMessages])

  return { messages: channelMessages, loading, hasMore, loadMore, loadingMore }
}
