import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'
import { emitToUser } from '../socket/index'

const router = Router()

async function isCreator(userId: string): Promise<boolean> {
  const dev = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = ? AND is_dev = 1', [userId])
  if (dev) return true
  const first = await queryOne<{ id: string }>('SELECT id FROM users ORDER BY created_at ASC LIMIT 1')
  return first?.id === userId
}

async function isModerator(userId: string): Promise<boolean> {
  if (await isCreator(userId)) return true
  const mod = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = ? AND is_mod = 1', [userId])
  return !!mod
}

async function requireCreator(req: Request, res: Response): Promise<boolean> {
  if (!(await isCreator(req.user!.userId))) {
    res.status(403).json({ error: 'Brak uprawnień' })
    return false
  }
  return true
}

async function requireStaff(req: Request, res: Response): Promise<boolean> {
  if (!(await isModerator(req.user!.userId))) {
    res.status(403).json({ error: 'Brak uprawnień' })
    return false
  }
  return true
}

router.get('/bans', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const bans = await queryMany(
      `SELECT b.*, u.username, u.display_name, u.avatar_color, u.avatar_url
       FROM user_bans b
       JOIN users u ON u.id = b.user_id
       WHERE b.expires_at IS NULL OR b.expires_at > NOW()
       ORDER BY b.created_at DESC`
    )
    return res.json({ bans })
  } catch (err) {
    console.error('[admin/bans]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/bans', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { userId, reason, days, banIps } = req.body
    if (!userId || !reason?.trim())
      return res.status(400).json({ error: 'Wymagane: userId, reason' })

    await execute('DELETE FROM user_bans WHERE user_id = ?', [userId])

    const expiresAt = days ? new Date(Date.now() + days * 86400_000) : null
    const id = uuid()
    await execute(
      'INSERT INTO user_bans (id, user_id, banned_by, reason, expires_at) VALUES (?, ?, ?, ?, ?)',
      [id, userId, req.user!.userId, reason.trim(), expiresAt]
    )

    if (banIps) {
      const ips = await queryMany<{ ip: string }>('SELECT ip FROM user_ips WHERE user_id = ?', [userId])
      for (const { ip } of ips) {
        const ipId = uuid()
        await execute(
          `INSERT INTO banned_ips (id, ip, reason, banned_by) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
          [ipId, ip, reason.trim(), req.user!.userId]
        )
      }
    }

    const ban = await queryOne('SELECT * FROM user_bans WHERE id = ?', [id])
    return res.status(201).json({ ban })
  } catch (err) {
    console.error('[admin/ban]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/bans/:userId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    await execute('DELETE FROM user_bans WHERE user_id = ?', [req.params.userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/warnings/:userId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const warnings = await queryMany(
      'SELECT * FROM user_warnings WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.userId]
    )
    return res.json({ warnings })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/warnings', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { userId, reason } = req.body
    if (!userId || !reason?.trim())
      return res.status(400).json({ error: 'Wymagane: userId, reason' })

    const id = uuid()
    await execute(
      'INSERT INTO user_warnings (id, user_id, warned_by, reason) VALUES (?, ?, ?, ?)',
      [id, userId, req.user!.userId, reason.trim()]
    )
    const warning = await queryOne('SELECT * FROM user_warnings WHERE id = ?', [id])

    emitToUser(userId, 'WARNING_RECEIVED', {
      id,
      reason: reason.trim(),
      created_at: (warning as any)?.created_at ?? new Date().toISOString(),
    })

    return res.status(201).json({ warning })
  } catch (err) {
    console.error('[admin/warn]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/warnings/:id', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    await execute('DELETE FROM user_warnings WHERE id = ?', [req.params.id])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/ghost/:serverId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { serverId } = req.params

    const [server, categories, channels, members, roles, memberCount] = await Promise.all([
      queryOne(
        `SELECT s.*, u.display_name as owner_name, u.avatar_color as owner_avatar_color,
                u.avatar_url as owner_avatar_url
         FROM servers s JOIN users u ON u.id = s.owner_id
         WHERE s.id = ?`, [serverId]
      ),
      queryMany(
        `SELECT * FROM channel_categories WHERE server_id = ? ORDER BY position ASC`,
        [serverId]
      ),
      queryMany(
        `SELECT c.*
         FROM channels c
         WHERE c.server_id = ?
         ORDER BY c.position ASC`, [serverId]
      ),
      queryMany(
        `SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_url,
                u.status, u.custom_status, sm.nickname, sm.joined_at,
                (SELECT GROUP_CONCAT(mr.role_id) FROM member_roles mr
                 WHERE mr.user_id = u.id AND mr.server_id = sm.server_id) as role_ids
         FROM server_members sm
         JOIN users u ON u.id = sm.user_id
         WHERE sm.server_id = ?
         ORDER BY
           FIELD(u.status, 'online', 'idle', 'dnd', 'offline'),
           u.display_name ASC`, [serverId]
      ),
      queryMany('SELECT * FROM roles WHERE server_id = ? ORDER BY position DESC', [serverId]),
      queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM server_members WHERE server_id = ?', [serverId]),
    ])

    if (!server) return res.status(404).json({ error: 'Serwer nie znaleziony' })

    return res.json({
      server, categories, channels, members, roles,
      memberCount: memberCount?.cnt ?? 0,
      ghost: true,
    })
  } catch (err) {
    console.error('[admin/ghost]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/ghost/:serverId/messages/:channelId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { channelId } = req.params
    const limit    = Math.min(Number(req.query.limit ?? 50), 100) | 0
    const beforeId = req.query.before as string | undefined

    let beforeDate: string | null = null
    if (beforeId) {
      const ref = await queryOne<{ created_at: string }>(
        'SELECT created_at FROM messages WHERE id = ?', [beforeId]
      )
      beforeDate = ref?.created_at ?? null
    }

    const messages = await queryMany(
      `SELECT m.*, u.display_name as author_name, u.avatar_color, u.avatar_url, u.username,
              r.display_name as reply_author_name, rm.content as reply_content
       FROM messages m
       JOIN users u ON u.id = m.author_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users r ON r.id = rm.author_id
       WHERE m.channel_id = ?
       ${beforeDate ? 'AND m.created_at < ?' : ''}
       ORDER BY m.created_at DESC
       LIMIT ?`,
      beforeDate ? [channelId, beforeDate, limit] : [channelId, limit]
    )

    return res.json({ messages: messages.reverse(), hasMore: messages.length === limit })
  } catch (err) {
    console.error('[admin/ghost/messages]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/warning-replies', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const replies = await queryMany(
      `SELECT w.*, u.display_name, u.username, u.avatar_color, u.avatar_url
       FROM user_warnings w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_reply IS NOT NULL
       ORDER BY w.reply_at DESC`
    )
    return res.json({ replies })
  } catch (err) {
    console.error('[admin/warning-replies]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/all', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const users = await queryMany(
      `SELECT id, username, display_name, avatar_color, avatar_url, is_dev, is_mod
       FROM users
       ORDER BY display_name ASC`
    )
    return res.json({ users })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/users/:userId/dev', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const { isDev } = req.body
    await execute('UPDATE users SET is_dev = ? WHERE id = ?', [isDev ? 1 : 0, req.params.userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/users/:userId/mod', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const { isMod } = req.body
    await execute('UPDATE users SET is_mod = ? WHERE id = ?', [isMod ? 1 : 0, req.params.userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/search', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const q = `%${(req.query.q as string) ?? ''}%`
    const users = await queryMany(
      `SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_url, u.email,
              u.created_at, u.status,
              (SELECT COUNT(*) FROM user_bans b
               WHERE b.user_id = u.id AND (b.expires_at IS NULL OR b.expires_at > NOW())) as is_banned,
              (SELECT COUNT(*) FROM user_warnings w WHERE w.user_id = u.id) as warning_count
       FROM users u
       WHERE u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?
       ORDER BY u.created_at DESC
       LIMIT 20`,
      [q, q, q]
    )
    return res.json({ users })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/:userId/servers', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const servers = await queryMany(
      `SELECT s.id, s.name, s.icon_color, s.icon_url, sm.joined_at,
              u.display_name as owner_name
       FROM server_members sm
       JOIN servers s ON s.id = sm.server_id
       JOIN users u ON u.id = s.owner_id
       WHERE sm.user_id = ?
       ORDER BY sm.joined_at DESC`,
      [req.params.userId]
    )
    return res.json({ servers })
  } catch (err) {
    console.error('[admin/users/servers]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/:userId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const { userId } = req.params
    const [user, bans, warnings] = await Promise.all([
      queryOne(
        `SELECT id, username, display_name, avatar_color, avatar_url, email, status, created_at
         FROM users WHERE id = ?`, [userId]
      ),
      queryMany(
        `SELECT * FROM user_bans WHERE user_id = ? ORDER BY created_at DESC`, [userId]
      ),
      queryMany(
        `SELECT * FROM user_warnings WHERE user_id = ? ORDER BY created_at DESC`, [userId]
      ),
    ])
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })
    return res.json({ user, bans, warnings })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/:userId/ips', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const ips = await queryMany(
      `SELECT ip, first_seen, last_seen,
              (SELECT COUNT(*) FROM banned_ips b WHERE b.ip = ui.ip) as is_banned
       FROM user_ips ui
       WHERE user_id = ?
       ORDER BY last_seen DESC`,
      [req.params.userId]
    )
    return res.json({ ips })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/banned-ips', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const ips = await queryMany(
      `SELECT b.*, u.display_name as banned_by_name
       FROM banned_ips b
       JOIN users u ON u.id = b.banned_by
       ORDER BY b.created_at DESC`
    )
    return res.json({ ips })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/ban-ip', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { ip, reason } = req.body
    if (!ip?.trim() || !reason?.trim())
      return res.status(400).json({ error: 'Wymagane: ip, reason' })
    const id = uuid()
    await execute(
      `INSERT INTO banned_ips (id, ip, reason, banned_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by)`,
      [id, ip.trim(), reason.trim(), req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/ban-ip/:ip', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    await execute('DELETE FROM banned_ips WHERE ip = ?', [decodeURIComponent(req.params.ip)])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/ghost/:serverId/channels/:channelId/message', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { serverId, channelId } = req.params
    const { content } = req.body
    if (!content?.trim() || content.length > 2000)
      return res.status(400).json({ error: 'Wymagana treść (maks. 2000 znaków)' })

    const channel = await queryOne<{ id: string }>('SELECT id FROM channels WHERE id = ? AND server_id = ?', [channelId, serverId])
    if (!channel) return res.status(404).json({ error: 'Kanał nie znaleziony' })

    const id = uuid()
    const now = new Date()
    await execute(
      `INSERT INTO messages (id, channel_id, server_id, author_id, content, type, is_admin_msg)
       VALUES (?, ?, ?, ?, ?, 'DEFAULT', 1)`,
      [id, channelId, serverId, req.user!.userId, content.trim()]
    )

    const { getSocketInstance } = await import('../socket')
    const io = getSocketInstance()
    if (io) {
      io.to(`channel:${channelId}`).emit('MESSAGE_CREATE', {
        id,
        channel_id: channelId,
        server_id: serverId,
        author_id: req.user!.userId,
        author_display_name: 'Administrator Aplikacji',
        author_username: 'admin',
        author_avatar_color: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
        author_avatar_url: null,
        content: content.trim(),
        type: 'DEFAULT',
        is_admin_msg: true,
        pinned: false,
        created_at: now.toISOString(),
        edited_at: null,
        reactions: [],
        replyTo: null,
        attachments: [],
      })
    }

    return res.json({ ok: true, messageId: id })
  } catch (err) {
    console.error('[admin/ghost/message]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
