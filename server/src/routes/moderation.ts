import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { canModerate, isOwner } from '../middleware/permissions'
import { execute, queryOne, queryMany } from '../db/pool'
import { memberQueries } from '../db/queries'

const router = Router()

router.get('/:serverId/moderation/status/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    const mute = await queryOne<{ expires_at: string; reason: string }>(
      'SELECT expires_at, reason FROM server_mutes WHERE user_id = ? AND server_id = ? AND expires_at > UTC_TIMESTAMP()',
      [userId, serverId]
    )
    const ban = await queryOne<{ reason: string }>(
      'SELECT reason FROM server_bans WHERE user_id = ? AND server_id = ?',
      [userId, serverId]
    )
    return res.json({
      muted: !!mute,
      muteExpiresAt: mute?.expires_at ? mute.expires_at + 'Z' : null,
      muteReason: mute?.reason,
      banned: !!ban
    })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:serverId/moderation/mute/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    const { reason, duration } = req.body

    if (!await canModerate(req.user!.userId, serverId, 'MUTE_MEMBERS')) {
      return res.status(403).json({ error: 'Brak uprawnień do wyciszania' })
    }
    if (userId === req.user!.userId) {
      return res.status(400).json({ error: 'Nie możesz wyciszyć samego siebie' })
    }
    if (await isOwner(userId, serverId)) {
      return res.status(400).json({ error: 'Nie możesz wyciszyć właściciela serwera' })
    }

    const targetIsAdmin = await canModerate(userId, serverId, 'ADMINISTRATOR')
    const requesterIsAdmin = await canModerate(req.user!.userId, serverId, 'ADMINISTRATOR')
    if (targetIsAdmin && !requesterIsAdmin) {
      return res.status(403).json({ error: 'Nie możesz moderować administratora' })
    }

    const mins = Math.min(Math.max(Number(duration) || 10, 1), 10080)
    await execute(
      `INSERT INTO server_mutes (user_id, server_id, muted_by, reason, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
       ON DUPLICATE KEY UPDATE muted_by = VALUES(muted_by), reason = VALUES(reason), expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)`,
      [userId, serverId, req.user!.userId, reason ?? null, mins, mins]
    )

    const mute = await queryOne(
      'SELECT * FROM server_mutes WHERE user_id = ? AND server_id = ?',
      [userId, serverId]
    )

    const { io } = await import('../index')
    io.to(`server:${serverId}`).emit('MEMBER_MUTED', {
      userId,
      serverId,
      expiresAt: (mute as any)?.expires_at ? (mute as any).expires_at + 'Z' : null,
      reason: reason ?? null,
    })

    return res.json({ ok: true, mute })
  } catch (err) {
    console.error('[moderation/mute]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/moderation/mute/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'MUTE_MEMBERS')) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    await execute('DELETE FROM server_mutes WHERE user_id = ? AND server_id = ?', [userId, serverId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:serverId/moderation/mutes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'MUTE_MEMBERS')) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    const mutes = await queryMany(
      `SELECT sm.*, u.username, u.display_name, u.avatar_color
       FROM server_mutes sm
       INNER JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = ? AND sm.expires_at > UTC_TIMESTAMP()
       ORDER BY sm.expires_at ASC`,
      [serverId]
    )
    const mutesWithZ = (mutes as any[]).map(m => ({ ...m, expires_at: m.expires_at + 'Z' }))
    return res.json({ mutes: mutesWithZ })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:serverId/moderation/ban/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    const { reason } = req.body

    if (!await canModerate(req.user!.userId, serverId, 'BAN_MEMBERS')) {
      return res.status(403).json({ error: 'Brak uprawnień do banowania' })
    }
    if (userId === req.user!.userId) {
      return res.status(400).json({ error: 'Nie możesz zbanować samego siebie' })
    }
    if (await isOwner(userId, serverId)) {
      return res.status(400).json({ error: 'Nie możesz zbanować właściciela serwera' })
    }

    const targetIsAdmin = await canModerate(userId, serverId, 'ADMINISTRATOR')
    const requesterIsAdmin = await canModerate(req.user!.userId, serverId, 'ADMINISTRATOR')
    if (targetIsAdmin && !requesterIsAdmin) {
      return res.status(403).json({ error: 'Nie możesz moderować administratora' })
    }

    await execute(
      `INSERT INTO server_bans (user_id, server_id, banned_by, reason) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE banned_by = VALUES(banned_by), reason = VALUES(reason)`,
      [userId, serverId, req.user!.userId, reason ?? null]
    )

    await memberQueries.remove(userId, serverId)

    const { io } = await import('../index')
    io.to(`server:${serverId}`).emit('MEMBER_LEAVE', { serverId, userId })

    const { kickUserFromServer } = await import('../socket')
    kickUserFromServer(userId, serverId, 'BANNED', reason ?? undefined)

    return res.json({ ok: true })
  } catch (err) {
    console.error('[moderation/ban]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/moderation/ban/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'BAN_MEMBERS')) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    await execute('DELETE FROM server_bans WHERE user_id = ? AND server_id = ?', [userId, serverId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:serverId/moderation/bans', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'BAN_MEMBERS')) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    const bans = await queryMany(
      `SELECT sb.*, u.username, u.display_name, u.avatar_color
       FROM server_bans sb
       INNER JOIN users u ON u.id = sb.user_id
       WHERE sb.server_id = ?
       ORDER BY sb.created_at DESC`,
      [serverId]
    )
    return res.json({ bans })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/moderation/kick/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'KICK_MEMBERS')) {
      return res.status(403).json({ error: 'Brak uprawnień do wyrzucania' })
    }
    if (userId === req.user!.userId) {
      return res.status(400).json({ error: 'Nie możesz wyrzucić samego siebie' })
    }
    if (await isOwner(userId, serverId)) {
      return res.status(400).json({ error: 'Nie możesz wyrzucić właściciela' })
    }

    const targetIsAdmin = await canModerate(userId, serverId, 'ADMINISTRATOR')
    const requesterIsAdmin = await canModerate(req.user!.userId, serverId, 'ADMINISTRATOR')
    if (targetIsAdmin && !requesterIsAdmin) {
      return res.status(403).json({ error: 'Nie możesz moderować administratora' })
    }
    await memberQueries.remove(userId, serverId)

    const { io } = await import('../index')
    io.to(`server:${serverId}`).emit('MEMBER_LEAVE', { serverId, userId })

    const { kickUserFromServer } = await import('../socket')
    kickUserFromServer(userId, serverId, 'KICKED')

    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
