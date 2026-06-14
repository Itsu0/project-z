import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { messageQueries, memberQueries, reactionQueries } from '../db/queries'
import { canModerate, isMuted, hasPermission, canViewChannel, canSendInChannel } from '../middleware/permissions'
import { queryOne, queryMany, execute } from '../db/pool'
import { getCached, setCached, invalidateChannel } from '../cache/messages'
import fs   from 'fs'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

function deleteAttachmentFile(filePath: string): void {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch {}
}

const router = Router()

router.get('/:channelId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params
    const limit  = Math.max(1, Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 100))
    const before = req.query.before as string | undefined
    const channelRow = await queryOne<{ server_id: string; mod_only: number }>(
      'SELECT server_id, COALESCE(mod_only,0) AS mod_only FROM channels WHERE id = ?', [channelId]
    )
    if (!channelRow) return res.status(404).json({ error: 'Kanał nie istnieje' })
    const effectiveServerId = channelRow.server_id
    if (!await hasPermission(req.user!.userId, effectiveServerId, 'VIEW_CHANNELS')) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego kanału' })
    }
    if (!await canViewChannel(req.user!.userId, channelId)) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego kanału' })
    }
    if (channelRow.mod_only && !await canModerate(req.user!.userId, effectiveServerId, 'MANAGE_MESSAGES')) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego kanału' })
    }

    const cached = getCached(channelId, before)
    if (cached) {
      const cachedIds = cached.data.map((m: any) => m.id)
      const cachedReactions = await reactionQueries.forMessages(cachedIds, req.user!.userId)
      const cachedReactionsMap: Record<string, any[]> = {}
      for (const r of cachedReactions) {
        ;(cachedReactionsMap[r.message_id] ??= []).push(r)
      }
      const withUserReactions = cached.data.map((msg: any) => ({
        ...msg,
        reactions: cachedReactionsMap[msg.id] ?? msg.reactions ?? [],
      }))
      return res.json({ messages: withUserReactions, hasMore: cached.hasMore })
    }

    const messages = await messageQueries.forChannel(channelId, limit, before)
    const sorted = messages.reverse()
    const hasMore = messages.length === limit
    const msgIds = sorted.map((m: any) => m.id)

    let reactionsMap: Record<string, any[]> = {}
    let attachmentsMap: Record<string, any[]> = {}
    let pollsMap: Record<string, any> = {}

    if (msgIds.length > 0) {
      const allReactions = await reactionQueries.forMessages(msgIds, req.user!.userId)
      for (const r of allReactions) {
        ;(reactionsMap[r.message_id] ??= []).push(r)
      }

      const BASE = process.env.RAILWAY_STATIC_URL
        ? `https://${process.env.RAILWAY_STATIC_URL}`
        : (process.env.BACKEND_URL ?? 'http://localhost:3001')

      const { pool: dbPool } = await import('../db/pool')
      const placeholders = msgIds.map(() => '?').join(',')

      const [attRows] = await dbPool.query<any[]>(
        `SELECT id, message_id, filename, content_type AS contentType, size, width, height
         FROM message_attachments WHERE message_id IN (${placeholders})`,
        msgIds
      )
      for (const a of attRows as any[]) {
        ;(attachmentsMap[a.message_id] ??= []).push({ ...a, url: `${BASE}/api/attachments/${a.id}` })
      }

      const pollMsgIds = sorted.filter((m: any) => m.type === 'POLL').map((m: any) => m.id)
      if (pollMsgIds.length > 0) {
        const pollPlaceholders = pollMsgIds.map(() => '?').join(',')
        const [pollRows] = await dbPool.query<any[]>(
          `SELECT id, message_id, closed, expires_at FROM polls WHERE message_id IN (${pollPlaceholders})`,
          pollMsgIds
        )
        const polls: any[] = pollRows
        if (polls.length > 0) {
          const pollIds = polls.map((p: any) => p.id)
          const optPlaceholders = pollIds.map(() => '?').join(',')
          const [optRows] = await dbPool.query<any[]>(
            `SELECT po.id, po.poll_id, po.text, po.position,
                    COUNT(pv.user_id) AS votes,
                    MAX(CASE WHEN pv.user_id = ? THEN 1 ELSE 0 END) AS user_voted
             FROM poll_options po
             LEFT JOIN poll_votes pv ON pv.poll_option_id = po.id
             WHERE po.poll_id IN (${optPlaceholders})
             GROUP BY po.id
             ORDER BY po.position`,
            [req.user!.userId, ...pollIds]
          )
          const options: any[] = optRows
          for (const poll of polls) {
            const pollOptions = options.filter((o: any) => o.poll_id === poll.id)
            const totalVotes = pollOptions.reduce((s: number, o: any) => s + Number(o.votes), 0)
            const msg = sorted.find((m: any) => m.id === poll.message_id)
            if (!msg) continue
            pollsMap[msg.id] = {
              id:                poll.id,
              question:          msg.content,
              totalVotes,
              userVotedOptionId: pollOptions.find((o: any) => Number(o.user_voted) > 0)?.id ?? null,
              options:           pollOptions.map((o: any) => ({ id: o.id, text: o.text, votes: Number(o.votes) })),
            }
          }
        }
      }
    }

    const final = sorted.map((m: any) => ({
      ...m,
      reactions:   reactionsMap[m.id] ?? [],
      attachments: attachmentsMap[m.id] ?? [],
      poll:        pollsMap[m.id] ?? null,
    }))

    const forCache = final.map((msg: any) => ({
      ...msg,
      reactions: (msg.reactions ?? []).map((r: any) => ({ ...r, user_reacted: false })),
    }))
    setCached(channelId, before, forCache, hasMore)

    return res.json({ messages: final, hasMore })
  } catch (err) {
    console.error('[messages/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// Wyszukiwanie wiadomości usunięte (funkcja wycofana).

router.post('/:channelId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params
    const { content, serverId } = req.body

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Wiadomość nie może być pusta' })
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Wiadomość może mieć maksymalnie 2000 znaków' })
    }

    const postChannelRow = await queryOne<{ server_id: string; mod_only: number }>(
      'SELECT server_id, COALESCE(mod_only, 0) AS mod_only FROM channels WHERE id = ?', [channelId]
    )
    if (!postChannelRow) return res.status(404).json({ error: 'Kanał nie istnieje' })
    const postServerId = postChannelRow.server_id
    if (postChannelRow.mod_only && !await canModerate(req.user!.userId, postServerId, 'MANAGE_MESSAGES')) {
      return res.status(403).json({ error: 'Brak dostępu do tego kanału' })
    }

    if (!await memberQueries.isMember(req.user!.userId, postServerId)) {
      return res.status(403).json({ error: 'Nie jesteś członkiem tego serwera' })
    }

    if (await isMuted(req.user!.userId, postServerId)) {
      const mute = await queryOne<{ expires_at: string }>(
        'SELECT expires_at FROM server_mutes WHERE user_id = ? AND server_id = ?',
        [req.user!.userId, postServerId]
      )
      const remainingMs = new Date(mute!.expires_at + 'Z').getTime() - Date.now()
      const mins = Math.ceil(remainingMs / 60000)
      return res.status(403).json({ error: `Jesteś wyciszony jeszcze przez ${mins} min` })
    }

    if (!await hasPermission(req.user!.userId, postServerId, 'SEND_MESSAGES')) {
      return res.status(403).json({ error: 'Nie masz uprawnień do wysyłania wiadomości na tym serwerze' })
    }

    if (!await canSendInChannel(req.user!.userId, channelId)) {
      return res.status(403).json({ error: 'Pisanie na tym kanale jest zablokowane dla Twojej roli' })
    }

    const messageId = await messageQueries.create({
      channelId,
      serverId: postServerId,
      authorId: req.user!.userId,
      content: content.trim(),
    })

    const message = await messageQueries.findById(messageId)
    return res.status(201).json({ message })
  } catch (err) {
    console.error('[messages/create]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/:channelId/messages/:messageId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params
    const { content } = req.body

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Wiadomość nie może być pusta' })
    }

    const existing = await messageQueries.findById(messageId)
    if (!existing) return res.status(404).json({ error: 'Wiadomość nie znaleziona' })
    if (existing.author_id !== req.user!.userId) {
      return res.status(403).json({ error: 'Możesz edytować tylko swoje wiadomości' })
    }
    if (!await memberQueries.isMember(req.user!.userId, existing.server_id)) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }

    await messageQueries.update(messageId, content.trim())
    const updated = await messageQueries.findById(messageId)
    return res.json({ message: updated })
  } catch (err) {
    console.error('[messages/update]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:channelId/messages/:messageId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, messageId } = req.params
    const existing = await messageQueries.findById(messageId)
    if (!existing) return res.status(404).json({ error: 'Wiadomość nie znaleziona' })

    const isMod = await canModerate(req.user!.userId, existing.server_id, 'MANAGE_MESSAGES')
    if (existing.author_id !== req.user!.userId && !isMod) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    if (existing.author_id === req.user!.userId && !isMod) {
      if (!await memberQueries.isMember(req.user!.userId, existing.server_id)) {
        return res.status(403).json({ error: 'Brak dostępu' })
      }
    }

    const isModDelete = isMod && existing.author_id !== req.user!.userId
    if (isModDelete) {
      const { logModAction } = await import('./serverMod')
      logModAction(
        (existing as any).server_id,
        'MESSAGE_DELETE',
        req.user!.userId,
        existing.author_id,
        null,
        { channelId, messageId, blockedContent: (existing as any).content?.slice(0, 500) }
      )
    }

    // Delete attachment files from disk before removing the message
    const attsToDelete = await queryMany<{ file_path: string }>(
      'SELECT file_path FROM message_attachments WHERE message_id = ? AND file_path IS NOT NULL',
      [messageId]
    )
    await messageQueries.delete(messageId)
    for (const a of attsToDelete) {
      deleteAttachmentFile(path.join(UPLOAD_DIR, 'attachments', a.file_path))
    }
    invalidateChannel(channelId)
    const { getSocketInstance } = await import('../socket')
    getSocketInstance()?.to(`channel:${channelId}`).emit('MESSAGE_DELETE', { id: messageId, channelId })
    return res.json({ ok: true, id: messageId })
  } catch (err) {
    console.error('[messages/delete]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.put('/:channelId/messages/:messageId/reactions/:emoji', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, messageId, emoji } = req.params
    const rxCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!rxCh) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await memberQueries.isMember(req.user!.userId, rxCh.server_id)) return res.status(403).json({ error: 'Brak dostępu' })
    const rxMsg = await queryOne<{ id: string }>('SELECT id FROM messages WHERE id = ? AND channel_id = ?', [messageId, channelId])
    if (!rxMsg) return res.status(404).json({ error: 'Wiadomość nie istnieje' })
    await reactionQueries.add(messageId, req.user!.userId, decodeURIComponent(emoji))
    return res.json({ ok: true })
  } catch (err) {
    console.error('[reactions/add]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:channelId/messages/:messageId/reactions/:emoji', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, messageId, emoji } = req.params
    const rxChDel = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!rxChDel) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await memberQueries.isMember(req.user!.userId, rxChDel.server_id)) return res.status(403).json({ error: 'Brak dostępu' })
    const rxMsgDel = await queryOne<{ id: string }>('SELECT id FROM messages WHERE id = ? AND channel_id = ?', [messageId, channelId])
    if (!rxMsgDel) return res.status(404).json({ error: 'Wiadomość nie istnieje' })
    await reactionQueries.remove(messageId, req.user!.userId, decodeURIComponent(emoji))
    return res.json({ ok: true })
  } catch (err) {
    console.error('[reactions/remove]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:channelId/pins', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params
    const pinsCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!pinsCh) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await hasPermission(req.user!.userId, pinsCh.server_id, 'VIEW_CHANNELS')) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }
    const msgs = await queryMany<any>(
      `SELECT m.id, m.channel_id, m.server_id, m.author_id, m.content, m.type, m.pinned, m.edited_at, m.created_at,
              u.username AS author_username, u.display_name AS author_display_name,
              u.avatar_color AS author_avatar_color, u.avatar_url AS author_avatar_url
       FROM messages m
       INNER JOIN users u ON u.id = m.author_id
       WHERE m.channel_id = ? AND m.pinned = 1
       ORDER BY m.created_at DESC LIMIT 50`,
      [channelId]
    )
    return res.json({ messages: msgs })
  } catch (err) {
    console.error('[pins/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.put('/:channelId/pins/:messageId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, messageId } = req.params
    const msg = await queryOne<any>('SELECT * FROM messages WHERE id = ? AND channel_id = ?', [messageId, channelId])
    if (!msg) return res.status(404).json({ error: 'Nie znaleziono wiadomości' })
    const isMember = await memberQueries.isMember(req.user!.userId, msg.server_id)
    if (!isMember) return res.status(403).json({ error: 'Brak dostępu' })
    const isMod = await canModerate(req.user!.userId, msg.server_id, 'MANAGE_MESSAGES')
    if (!isMod) {
      return res.status(403).json({ error: 'Brak uprawnień — tylko moderatorzy mogą przypinać wiadomości' })
    }
    await execute('UPDATE messages SET pinned = 1 WHERE id = ?', [messageId])
    const { getSocketInstance } = await import('../socket')
    getSocketInstance()?.to(`channel:${channelId}`).emit('MESSAGE_PIN', { messageId, channelId, pinned: true })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[pins/add]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:channelId/pins/:messageId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, messageId } = req.params
    const msg = await queryOne<any>('SELECT * FROM messages WHERE id = ? AND channel_id = ?', [messageId, channelId])
    if (!msg) return res.status(404).json({ error: 'Nie znaleziono wiadomości' })
    const isMemberDel = await memberQueries.isMember(req.user!.userId, msg.server_id)
    if (!isMemberDel) return res.status(403).json({ error: 'Brak dostępu' })
    const isModDel = await canModerate(req.user!.userId, msg.server_id, 'MANAGE_MESSAGES')
    if (!isModDel) {
      return res.status(403).json({ error: 'Brak uprawnień — tylko moderatorzy mogą odpinać wiadomości' })
    }
    await execute('UPDATE messages SET pinned = 0 WHERE id = ?', [messageId])
    const { getSocketInstance } = await import('../socket')
    getSocketInstance()?.to(`channel:${channelId}`).emit('MESSAGE_PIN', { messageId, channelId, pinned: false })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[pins/remove]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:channelId/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params
    const { messageId } = req.body
    if (!messageId) return res.status(400).json({ error: 'Wymagane: messageId' })
    const readCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!readCh) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await memberQueries.isMember(req.user!.userId, readCh.server_id)) return res.status(403).json({ error: 'Brak dostępu' })
    await messageQueries.markRead(req.user!.userId, channelId, messageId)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[messages/read]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
