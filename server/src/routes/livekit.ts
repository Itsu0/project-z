import { Router, Request, Response } from 'express'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { requireAuth } from '../middleware/auth'
import { channelQueries, memberQueries } from '../db/queries'
import { isMuted } from '../middleware/permissions'
import { queryOne, execute } from '../db/pool'

const router = Router()

router.get('/token', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.query as { channelId: string }

    if (!channelId) {
      return res.status(400).json({ error: 'Wymagany parametr: channelId' })
    }

    const channel = await channelQueries.findById(channelId)
    if (!channel) {
      return res.status(404).json({ error: 'Kanał nie znaleziony' })
    }

    if (channel.type !== 'voice') {
      return res.status(400).json({ error: 'To nie jest kanał głosowy' })
    }

    const isMember = await memberQueries.isMember(req.user!.userId, channel.server_id)
    if (!isMember) {
      return res.status(403).json({ error: 'Nie jesteś członkiem tego serwera' })
    }

    if (await isMuted(req.user!.userId, channel.server_id)) {
      const mute = await queryOne<{ expires_at: string }>(
        'SELECT expires_at FROM server_mutes WHERE user_id = ? AND server_id = ? AND expires_at > UTC_TIMESTAMP()',
        [req.user!.userId, channel.server_id]
      )
      return res.status(403).json({
        error: 'muted',
        muteExpiresAt: mute?.expires_at ? mute.expires_at + 'Z' : null,
      })
    }

    await execute(
      `INSERT INTO voice_states (user_id, channel_id, server_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), joined_at = NOW()`,
      [req.user!.userId, channelId, channel.server_id]
    )
    const userInfo = await queryOne<{ display_name: string; avatar_color: string; avatar_url: string | null }>(
      'SELECT display_name, avatar_color, avatar_url FROM users WHERE id = ?',
      [req.user!.userId]
    )
    const { io } = await import('../index')
    io.to(`server:${channel.server_id}`).emit('VOICE_JOIN', {
      channelId,
      userId: req.user!.userId,
      displayName: userInfo?.display_name,
      avatarColor: userInfo?.avatar_color,
      avatarUrl: userInfo?.avatar_url,
    })

    const apiKey    = process.env.LIVEKIT_API_KEY    ?? 'devkey'
    const apiSecret = process.env.LIVEKIT_API_SECRET ?? 'secret'
    const lkUrl     = process.env.LIVEKIT_URL        ?? 'ws://localhost:7880'

    const roomName = `channel_${channelId}`

    try {
      const svc = new RoomServiceClient(lkUrl, apiKey, apiSecret)

      let wasInRoom = false
      try {
        await svc.removeParticipant(roomName, String(req.user!.userId))
        wasInRoom = true
      } catch {

      }

      if (wasInRoom) {

        await new Promise(r => setTimeout(r, 400))

        try {
          const participants = await svc.listParticipants(roomName)
          if (participants.length === 0) {
            await svc.deleteRoom(roomName)
            console.log(`[livekit] Usunięto pusty pokój ${roomName} — świeży start`)
          }
        } catch {

        }

        await new Promise(r => setTimeout(r, 300))
      }
    } catch {

    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: req.user!.userId,
      name: req.user!.username,
      ttl: '4h',
    })

    at.addGrant({
      roomJoin:      true,
      room:          roomName,
      canPublish:    true,
      canSubscribe:  true,
      canPublishData: true,
    })

    const token = await at.toJwt()

    return res.json({
      token,
      roomName,
      serverUrl: process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
    })
  } catch (err) {
    console.error('[livekit/token]', err)
    return res.status(500).json({ error: 'Błąd generowania tokena' })
  }
})

router.post('/webhook', async (req: Request, res: Response) => {

  console.log('[livekit/webhook]', req.body?.event)
  res.json({ ok: true })
})

export default router
