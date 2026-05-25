import { Server as SocketIO, Socket } from 'socket.io'
import { verifySocketToken } from '../middleware/auth'
import { messageQueries, userQueries, reactionQueries, memberQueries } from '../db/queries'
import { execute, queryMany, queryOne } from '../db/pool'
import { isMuted, hasPermission } from '../middleware/permissions'
import { v4 as uuidv4 } from 'uuid'
import { invalidateChannel } from '../cache/messages'
import { checkAutoMod, addStrike, logModAction, isRaidLocked } from '../routes/serverMod'

const onlineUsers = new Map<string, string>()
const typingUsers = new Map<string, Set<string>>()
const typingTimers = new Map<string, NodeJS.Timeout>()

async function handleMentions(
  io: SocketIO,
  content: string,
  messageId: string,
  channelId: string,
  serverId: string,
  authorId: string,
  replyToAuthorId?: string
) {
  const mentions = new Set<string>()
  console.log(`[mentions] content="${content.slice(0,50)}"`)

  if (content.includes('@everyone')) {
    const members = await memberQueries.list(serverId)
    members.forEach(m => { if (m.user_id !== authorId) mentions.add(m.user_id) })
  } else {

    const userMatches = content.match(/@([\w\-\.ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)/gu) ?? []
    console.log(`[mentions] matches:`, userMatches)
    for (const match of userMatches) {
      const username = match.slice(1)
      const user = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE username = ? OR display_name = ?',
        [username, username]
      )
      console.log(`[mentions] lookup "${username}" → ${user?.id ?? 'not found'}`)
      if (user && user.id !== authorId) mentions.add(user.id)
    }
  }
  console.log(`[mentions] will notify: ${mentions.size} users`)

  if (replyToAuthorId && replyToAuthorId !== authorId) {
    const notifId = uuidv4()
    await execute(
      'INSERT INTO notifications (id, user_id, server_id, channel_id, message_id, type) VALUES (?, ?, ?, ?, ?, ?)',
      [notifId, replyToAuthorId, serverId, channelId, messageId, 'reply']
    )
    const socketId = onlineUsers.get(replyToAuthorId)
    if (socketId) {
      io.to(socketId).emit('NOTIFICATION', { type: 'reply', channelId, serverId, messageId })
    }
  }

  for (const userId of mentions) {
    if (userId === replyToAuthorId) continue
    const notifId = uuidv4()
    await execute(
      'INSERT INTO notifications (id, user_id, server_id, channel_id, message_id, type) VALUES (?, ?, ?, ?, ?, ?)',
      [notifId, userId, serverId, channelId, messageId, 'mention']
    )
    const socketId = onlineUsers.get(userId)
    if (socketId) {
      io.to(socketId).emit('NOTIFICATION', { type: 'mention', channelId, serverId, messageId })
    }
  }
}

function clearTyping(io: SocketIO, channelId: string, userId: string, username: string) {
  const key = `${channelId}:${userId}`
  const timer = typingTimers.get(key)
  if (timer) { clearTimeout(timer); typingTimers.delete(key) }
  const ch = typingUsers.get(channelId)
  if (ch) { ch.delete(userId) }
  io.to(`channel:${channelId}`).emit('TYPING_STOP', { userId, username, channelId })
}

interface UserProfile { display_name: string; username: string; avatar_color: string; avatar_url: string | null }
const userProfileCache = new Map<string, { profile: UserProfile; at: number }>()
const USER_CACHE_TTL = 5 * 60_000

async function getProfile(userId: string): Promise<UserProfile> {
  const hit = userProfileCache.get(userId)
  if (hit && Date.now() - hit.at < USER_CACHE_TTL) return hit.profile
  const row = await queryOne<UserProfile>(
    'SELECT display_name, username, avatar_color, avatar_url FROM users WHERE id = ?', [userId]
  )
  const profile: UserProfile = row ?? { display_name: 'Użytkownik', username: 'user', avatar_color: '#64748b', avatar_url: null }
  userProfileCache.set(userId, { profile, at: Date.now() })
  return profile
}

export function invalidateUserProfile(userId: string): void {
  userProfileCache.delete(userId)
}

let _io: SocketIO | null = null

export function emitToUser(userId: string, event: string, data: unknown): void {
  const socketId = onlineUsers.get(userId)
  if (socketId && _io) _io.to(socketId).emit(event, data)
}

export function getSocketInstance(): SocketIO | null {
  return _io
}

export function kickUserFromServer(userId: string, serverId: string, eventName: 'KICKED' | 'BANNED', reason?: string): void {
  const socketId = onlineUsers.get(userId)
  if (socketId && _io) {
    _io.to(socketId).emit(eventName, { serverId, reason: reason ?? null })
    const sock = _io.sockets.sockets.get(socketId)
    if (sock) sock.leave(`server:${serverId}`)
  }
}

const msgRateMap = new Map<string, number[]>()

export function setupSocket(io: SocketIO) {
  _io = io

  io.use(async (socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie ?? ''
    const cookieMatch  = cookieHeader.match(/(?:^|;\s*)pz_token=([^;]+)/)
    const cookieToken  = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null
    const rawToken     = cookieToken || (socket.handshake.auth?.token as string | undefined)

    if (!rawToken) return next(new Error('Brak tokena'))
    const payload = verifySocketToken(rawToken)
    if (!payload) return next(new Error('Nieprawidłowy token'))

    const xff = socket.handshake.headers['x-forwarded-for']
    const ip  = (Array.isArray(xff) ? xff[0] : (xff ?? '')).split(',')[0].trim()
              || socket.handshake.address || '0.0.0.0'
    const ipBan = await queryOne<{ reason: string }>('SELECT reason FROM banned_ips WHERE ip = ? LIMIT 1', [ip]).catch(() => null)
    if (ipBan) return next(new Error('IP_BANNED'))

    const userBan = await queryOne<{ reason: string }>(
      `SELECT reason FROM user_bans WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [payload.userId]
    ).catch(() => null)
    if (userBan) return next(new Error('BANNED'))

    socket.data.userId   = payload.userId
    socket.data.username = payload.username
    next()
  })

  io.on('connection', async (socket: Socket) => {
    const { userId, username } = socket.data
    console.log(`🔌 ${username} (${userId}) połączony`)

    onlineUsers.set(userId, socket.id)

    socket.on('join_server', async (serverId: string) => {
      const isMem = await memberQueries.isMember(userId, serverId)
      if (!isMem) return

      const ban = await queryOne<{ reason: string }>(
        'SELECT reason FROM server_bans WHERE user_id = ? AND server_id = ?',
        [userId, serverId]
      )
      if (ban) {
        socket.emit('BANNED', { serverId, reason: ban.reason })
        return
      }

      socket.join(`server:${serverId}`)
      const userRow = await queryOne<{ status: string }>('SELECT status FROM users WHERE id = ?', [userId])
      const currentStatus = userRow?.status ?? 'online'
      socket.to(`server:${serverId}`).emit('PRESENCE_UPDATE', { userId, status: currentStatus })

      const muted = await isMuted(userId, serverId)
      if (muted) {
        const muteRow = await queryOne<{ expires_at: string; reason: string; muted_by: string }>(
          'SELECT expires_at, reason, muted_by FROM server_mutes WHERE user_id = ? AND server_id = ?',
          [userId, serverId]
        )
        if (muteRow) {
          socket.emit('MUTE_STATUS', { userId, serverId, muted: true, expiresAt: muteRow.expires_at, reason: muteRow.reason })
        }
      }

      console.log(`📡 ${username} dołączył do server:${serverId}`)
    })

    socket.on('join_channel', async (channelId: string) => {
      const ch = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
      if (!ch) return
      const memberOk = await memberQueries.isMember(userId, ch.server_id)
      if (!memberOk) return
      socket.join(`channel:${channelId}`)
    })
    socket.on('leave_channel', (channelId: string) => socket.leave(`channel:${channelId}`))
    socket.on('leave_server',  (serverId: string)  => socket.leave(`server:${serverId}`))

    socket.on('MESSAGE_CREATE', async (data: {
      channelId:      string
      serverId:       string
      content:        string
      replyToId?:     string
      nonce?:         string
      attachmentIds?: string[]
    }) => {
      try {
        if ((data.content?.length ?? 0) > 2000) return

        if (!data.content?.trim() && !data.attachmentIds?.length) return

        const rateNow = Date.now()
        const timestamps = (msgRateMap.get(userId) ?? []).filter(t => rateNow - t < 5000)
        if (timestamps.length >= 10) {
          socket.emit('ERROR', { code: 'RATE_LIMIT', message: 'Wysyłasz za dużo wiadomości' })
          return
        }
        msgRateMap.set(userId, [...timestamps, rateNow])

        const banCheck = await queryOne<{ reason: string }>(
          'SELECT reason FROM server_bans WHERE user_id = ? AND server_id = ?',
          [userId, data.serverId]
        )
        if (banCheck) return

        if (!await hasPermission(userId, data.serverId, 'SEND_MESSAGES')) return

        if (await isMuted(userId, data.serverId)) {
          const mute = await queryOne<{ expires_at: string }>(
            'SELECT expires_at FROM server_mutes WHERE user_id = ? AND server_id = ? AND expires_at > NOW()',
            [userId, data.serverId]
          )
          const mins = mute ? Math.ceil((new Date(mute.expires_at).getTime() - Date.now()) / 60000) : 0
          socket.emit('ERROR', { message: `Jesteś wyciszony jeszcze przez ${mins} min` })
          return
        }

        // AutoMod check
        if (data.content?.trim()) {
          const automod = await checkAutoMod(data.serverId, userId, data.channelId, data.content)
          if (automod) {
            socket.emit('AUTOMOD_BLOCK', { reason: automod.reason, channelId: data.channelId })
            if (automod.action === 'delete_warn' || automod.action === 'delete_mute') {
              await addStrike(data.serverId, userId, `AutoMod: ${automod.reason}`, null, true)
            }
            if (automod.action === 'delete_mute') {
              const mins = 10
              await execute(
                `INSERT INTO server_mutes (user_id, server_id, muted_by, reason, expires_at)
                 VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
                 ON DUPLICATE KEY UPDATE reason = VALUES(reason), expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)`,
                [userId, data.serverId, userId, `AutoMod: ${automod.reason}`, mins, mins]
              )
              const mute = await queryOne<any>('SELECT * FROM server_mutes WHERE user_id = ? AND server_id = ?', [userId, data.serverId])
              io.to(`server:${data.serverId}`).emit('MEMBER_MUTED', {
                userId, serverId: data.serverId,
                expiresAt: mute?.expires_at ? mute.expires_at + 'Z' : null,
                reason: `AutoMod: ${automod.reason}`,
              })
            }
            await logModAction(data.serverId, 'AUTOMOD', null, userId, automod.reason, {
              action: automod.action,
              blockedContent: data.content?.slice(0, 200),
            })
            return
          }
        }

        // Raid lockdown check
        if (isRaidLocked(data.serverId)) {
          socket.emit('ERROR', { message: '🛡 Serwer jest w trybie lockdown. Pisanie tymczasowo zablokowane.' })
          return
        }

        let replyToAuthorId: string | undefined
        let replyToMessage: any = null
        const [profile] = await Promise.all([
          getProfile(userId),
          data.replyToId
            ? messageQueries.findById(data.replyToId).then(m => { replyToMessage = m; replyToAuthorId = m?.author_id })
            : Promise.resolve(),
        ])

        const now = new Date().toISOString()
        const messageId = await messageQueries.create({
          channelId: data.channelId,
          serverId:  data.serverId,
          authorId:  userId,
          content:   data.content.trim(),
        })

        if (data.replyToId) {
          await execute('UPDATE messages SET reply_to_id = ? WHERE id = ?', [data.replyToId, messageId])
        }

        const enriched = {
          id:                 messageId,
          channel_id:         data.channelId,
          server_id:          data.serverId,
          author_id:          userId,
          author_username:    profile.username,
          author_display_name: profile.display_name,
          author_avatar_color: profile.avatar_color,
          author_avatar_url:  profile.avatar_url,
          content:            data.content.trim(),
          type:               'DEFAULT',
          pinned:             false,
          created_at:         now,
          edited_at:          null,
          reactions:          [],
          nonce:              data.nonce,
          replyTo: replyToMessage ? {
            id:         replyToMessage.id,
            content:    replyToMessage.content,
            authorName: replyToMessage.author_display_name,
          } : null,
        }

        if (data.attachmentIds?.length) {
          for (const attId of data.attachmentIds) {
            await execute(
              'UPDATE message_attachments SET message_id = ? WHERE id = ? AND uploader_id = ? AND message_id IS NULL',
              [messageId, attId, userId]
            )
          }
        }

        const attachments = await queryMany<any>(
          'SELECT id, filename, content_type AS contentType, size, width, height FROM message_attachments WHERE message_id = ?',
          [messageId]
        )
        const BASE_URL = process.env.RAILWAY_STATIC_URL
          ? `https://${process.env.RAILWAY_STATIC_URL}`
          : (process.env.BACKEND_URL ?? 'http://localhost:3001')
        ;(enriched as any).attachments = attachments.map((a: any) => ({
          ...a,
          url: `${BASE_URL}/api/attachments/${a.id}`,
        }))

        invalidateChannel(data.channelId)

        io.to(`channel:${data.channelId}`).emit('MESSAGE_CREATE', enriched)

        handleMentions(io, data.content, messageId, data.channelId, data.serverId, userId, replyToAuthorId)
          .catch(err => console.error('[mentions]', err))

        clearTyping(io, data.channelId, userId, username)
      } catch (err) {
        console.error('[socket/MESSAGE_CREATE]', err)
        socket.emit('ERROR', { message: 'Nie udało się wysłać wiadomości' })
      }
    })

    socket.on('MESSAGE_UPDATE', async (data: { messageId: string; channelId: string; content: string }) => {
      try {
        const existing = await messageQueries.findById(data.messageId)
        if (!existing || existing.author_id !== userId) return
        if (existing.channel_id !== data.channelId) return
        const updCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [data.channelId])
        if (!updCh || !await memberQueries.isMember(userId, updCh.server_id)) return
        const updBanned = await queryOne<{ id: string }>('SELECT id FROM server_bans WHERE user_id = ? AND server_id = ?', [userId, updCh.server_id])
        if (updBanned) return
        const trimmed = data.content.trim().slice(0, 2000)
        if (!trimmed) return
        await messageQueries.update(data.messageId, trimmed)
        invalidateChannel(data.channelId)
        io.to(`channel:${data.channelId}`).emit('MESSAGE_UPDATE', {
          id: data.messageId,
          channel_id: data.channelId,
          content: trimmed,
          edited_at: new Date().toISOString(),
        })
      } catch (err) { console.error('[socket/MESSAGE_UPDATE]', err) }
    })

    socket.on('MESSAGE_DELETE', async (data: { messageId: string; channelId: string }) => {
      try {
        const existing = await messageQueries.findById(data.messageId)
        if (!existing || existing.author_id !== userId) return
        if (existing.channel_id !== data.channelId) return
        const delCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [data.channelId])
        if (!delCh || !await memberQueries.isMember(userId, delCh.server_id)) return
        const delBanned = await queryOne<{ id: string }>('SELECT id FROM server_bans WHERE user_id = ? AND server_id = ?', [userId, delCh.server_id])
        if (delBanned) return
        await messageQueries.delete(data.messageId)
        invalidateChannel(data.channelId)
        io.to(`channel:${data.channelId}`).emit('MESSAGE_DELETE', { id: data.messageId, channelId: data.channelId })
      } catch (err) { console.error('[socket/MESSAGE_DELETE]', err) }
    })

    socket.on('REACTION_ADD', async (data: { messageId: string; channelId: string; emoji: string }) => {
      try {
        const rxAddCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [data.channelId])
        if (!rxAddCh || !await memberQueries.isMember(userId, rxAddCh.server_id)) return
        await reactionQueries.add(data.messageId, userId, data.emoji)
        const reactions = await reactionQueries.forMessage(data.messageId, userId)

        const message = await messageQueries.findById(data.messageId)
        if (message && message.author_id !== userId) {
          const notifId = uuidv4()
          await execute(
            'INSERT INTO notifications (id, user_id, server_id, channel_id, message_id, type) VALUES (?, ?, ?, ?, ?, ?)',
            [notifId, message.author_id, message.server_id, data.channelId, data.messageId, 'reaction']
          )
          const socketId = onlineUsers.get(message.author_id)
          if (socketId) io.to(socketId).emit('NOTIFICATION', { type: 'reaction', channelId: data.channelId, messageId: data.messageId })
        }

        io.to(`channel:${data.channelId}`).emit('REACTION_UPDATE', { messageId: data.messageId, reactions })
      } catch (err) { console.error('[socket/REACTION_ADD]', err) }
    })

    socket.on('REACTION_REMOVE', async (data: { messageId: string; channelId: string; emoji: string }) => {
      try {
        const rxRemCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [data.channelId])
        if (!rxRemCh || !await memberQueries.isMember(userId, rxRemCh.server_id)) return
        await reactionQueries.remove(data.messageId, userId, data.emoji)
        const reactions = await reactionQueries.forMessage(data.messageId, userId)
        io.to(`channel:${data.channelId}`).emit('REACTION_UPDATE', { messageId: data.messageId, reactions })
      } catch (err) { console.error('[socket/REACTION_REMOVE]', err) }
    })

    socket.on('TYPING_START', async (data: { channelId: string }) => {
      const { channelId } = data
      const typingCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
      if (!typingCh || !await memberQueries.isMember(userId, typingCh.server_id)) return
      if (!typingUsers.has(channelId)) typingUsers.set(channelId, new Set())
      typingUsers.get(channelId)!.add(userId)
      socket.to(`channel:${channelId}`).emit('TYPING_START', { userId, username, channelId })

      const key = `${channelId}:${userId}`
      const existing = typingTimers.get(key)
      if (existing) clearTimeout(existing)
      typingTimers.set(key, setTimeout(() => clearTyping(io, channelId, userId, username), 5000))
    })

    socket.on('TYPING_STOP', (data: { channelId: string }) => {
      clearTyping(io, data.channelId, userId, username)
    })

    socket.on('CHANNEL_REORDER', async (data: { serverId: string; channels: { id: string; position: number }[] }) => {
      try {

        const { canModerate } = await import('../middleware/permissions')
        const canReorder = await canModerate(userId, data.serverId, 'MANAGE_CHANNELS')
        if (!canReorder) {
          socket.emit('ERROR', { message: 'Brak uprawnień do zmiany kolejności kanałów' })
          return
        }

        for (const ch of data.channels) {
          await execute('UPDATE channels SET position = ? WHERE id = ? AND server_id = ?', [ch.position, ch.id, data.serverId])
        }

        io.to(`server:${data.serverId}`).emit('CHANNELS_REORDERED', { serverId: data.serverId, channels: data.channels })
      } catch (err) { console.error('[socket/CHANNEL_REORDER]', err) }
    })

    socket.on('MUTE_APPLY', async (data: { targetUserId: string; serverId: string }) => {
      if (!await hasPermission(userId, data.serverId, 'MUTE_MEMBERS')) return

      const mute = await queryOne<any>(
        `SELECT sm.*, u.display_name, u.username FROM server_mutes sm
         INNER JOIN users u ON u.id = sm.user_id
         WHERE sm.user_id = ? AND sm.server_id = ? AND sm.expires_at > NOW()`,
        [data.targetUserId, data.serverId]
      )
      if (mute) {
        io.to(`server:${data.serverId}`).emit('MEMBER_MUTED', {
          userId: data.targetUserId,
          displayName: mute.display_name,
          serverId: data.serverId,
          expiresAt: mute.expires_at,
          reason: mute.reason,
        })
      }
    })

    socket.on('VOICE_LEAVE', async (data: { channelId: string; serverId: string }) => {
      try {
        const vlCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [data.channelId])
        if (!vlCh || vlCh.server_id !== data.serverId) return
        if (!await memberQueries.isMember(userId, data.serverId)) return
        await execute('DELETE FROM voice_states WHERE user_id = ? AND channel_id = ?', [userId, data.channelId])
        io.to(`server:${data.serverId}`).emit('VOICE_LEAVE', { channelId: data.channelId, userId })
      } catch {}
    })

    socket.on('PING', (cb: unknown) => {
      if (typeof cb === 'function') cb()
    })

    socket.on('MARK_NOTIFICATIONS_READ', async (data: { channelId?: string; serverId?: string }) => {
      try {
        if (data.channelId) {
          await execute(
            'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND channel_id = ? AND read_at IS NULL',
            [userId, data.channelId]
          )
        } else if (data.serverId) {
          await execute(
            'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND server_id = ? AND read_at IS NULL',
            [userId, data.serverId]
          )
        }
      } catch (err) { console.error('[socket/MARK_READ]', err) }
    })

    socket.on('disconnect', async () => {
      console.log(`❌ ${username} rozłączony`)
      onlineUsers.delete(userId)
      await userQueries.updateStatus(userId, 'offline')

      try {
        const voiceRows = await queryMany<{ channel_id: string; server_id: string }>(
          'SELECT channel_id, server_id FROM voice_states WHERE user_id = ?', [userId]
        )
        await execute('DELETE FROM voice_states WHERE user_id = ?', [userId])
        for (const row of voiceRows) {
          io.to(`server:${row.server_id}`).emit('VOICE_LEAVE', { channelId: row.channel_id, userId })
        }
      } catch {}

      typingUsers.forEach((users, channelId) => {
        if (users.has(userId)) clearTyping(io, channelId, userId, username)
      })

      socket.rooms.forEach(room => {
        if (room.startsWith('server:')) {
          const serverId = room.replace('server:', '')
          socket.to(room).emit('PRESENCE_UPDATE', { userId, status: 'offline' })
        }
      })
    })
  })
}
