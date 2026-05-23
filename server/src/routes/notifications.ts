import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { queryMany, execute } from '../db/pool'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const notifications = await queryMany(
      `SELECT n.*,
        m.content as message_content,
        u.display_name as author_name,
        u.avatar_color as author_avatar_color,
        u.avatar_url as author_avatar_url,
        u.username as author_username,
        s.name as server_name,
        c.name as channel_name
       FROM notifications n
       LEFT JOIN messages m  ON m.id = n.message_id
       LEFT JOIN users u     ON u.id = m.author_id
       LEFT JOIN servers s   ON s.id = n.server_id
       LEFT JOIN channels c  ON c.id = n.channel_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ${limit}`,
      [req.user!.userId]
    )
    const unreadCount = notifications.filter((n: any) => !n.read_at).length
    return res.json({ notifications, unreadCount })
  } catch (err) {
    console.error('[notifications/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, serverId, notifId } = req.body
    if (notifId) {
      await execute('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', [notifId, req.user!.userId])
    } else if (channelId) {
      await execute('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND channel_id = ? AND read_at IS NULL', [req.user!.userId, channelId])
    } else if (serverId) {
      await execute('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND server_id = ? AND read_at IS NULL', [req.user!.userId, serverId])
    } else {
      await execute('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.user!.userId])
    }
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/mutes/:serverId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const mutes = await queryMany(
      `SELECT sm.user_id, sm.expires_at, sm.reason, sm.created_at,
        u.display_name, u.username, u.avatar_color
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

export default router
