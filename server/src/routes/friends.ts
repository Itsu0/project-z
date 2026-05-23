import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { execute, queryOne, queryMany } from '../db/pool'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string ?? '').trim()
    if (q.length < 2) return res.json({ users: [] })
    const users = await queryMany<{
      id: string; username: string; display_name: string; avatar_color: string
    }>(
      `SELECT id, username, display_name, avatar_color
       FROM users
       WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? AND email_verified = 1
       LIMIT 20`,
      [`%${q}%`, `%${q}%`, req.user!.userId]
    )
    return res.json({ users })
  } catch (err) {
    console.error('[friends/search]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const friends = await queryMany<{
      id: string; username: string; display_name: string
      avatar_url: string | null; avatar_color: string; status: string; custom_status: string | null
    }>(
      `SELECT u.id, u.username, u.display_name,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS avatar_url,
              u.avatar_color, u.status, u.custom_status
       FROM friends f
       INNER JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ?
       ORDER BY u.display_name ASC`,
      [req.user!.userId]
    )
    return res.json({ friends })
  } catch (err) {
    console.error('[friends/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const incoming = await queryMany<{
      id: string; from_id: string; username: string; display_name: string
      avatar_url: string | null; avatar_color: string; created_at: string
    }>(
      `SELECT fr.id, fr.from_id, u.username, u.display_name,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS avatar_url,
              u.avatar_color, fr.created_at
       FROM friend_requests fr
       INNER JOIN users u ON u.id = fr.from_id
       WHERE fr.to_id = ?
       ORDER BY fr.created_at DESC`,
      [req.user!.userId]
    )
    const outgoing = await queryMany<{ id: string; to_id: string; username: string; display_name: string }>(
      `SELECT fr.id, fr.to_id, u.username, u.display_name
       FROM friend_requests fr
       INNER JOIN users u ON u.id = fr.to_id
       WHERE fr.from_id = ?`,
      [req.user!.userId]
    )
    return res.json({ incoming, outgoing })
  } catch (err) {
    console.error('[friends/requests]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/request/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const myId = req.user!.userId
    if (userId === myId) return res.status(400).json({ error: 'Nie możesz dodać siebie' })

    const target = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = ?', [userId])
    if (!target) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })

    const alreadyFriend = await queryOne(
      'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [myId, userId]
    )
    if (alreadyFriend) return res.status(409).json({ error: 'Już jesteś znajomym tego użytkownika' })

    const reverseRequest = await queryOne<{ id: string }>(
      'SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?', [userId, myId]
    )
    if (reverseRequest) {
      await execute('DELETE FROM friend_requests WHERE id = ?', [reverseRequest.id])
      await execute('INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)', [myId, userId, userId, myId])
      return res.json({ ok: true, accepted: true })
    }

    await execute(
      'INSERT IGNORE INTO friend_requests (id, from_id, to_id) VALUES (?, ?, ?)',
      [uuidv4(), myId, userId]
    )
    return res.status(201).json({ ok: true })
  } catch (err) {
    console.error('[friends/request]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/accept/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params
    const row = await queryOne<{ from_id: string; to_id: string }>(
      'SELECT from_id, to_id FROM friend_requests WHERE id = ? AND to_id = ?',
      [requestId, req.user!.userId]
    )
    if (!row) return res.status(404).json({ error: 'Zaproszenie nie znalezione' })

    await execute('DELETE FROM friend_requests WHERE id = ?', [requestId])
    await execute(
      'INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
      [row.to_id, row.from_id, row.from_id, row.to_id]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[friends/accept]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/decline/:requestId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params
    await execute(
      'DELETE FROM friend_requests WHERE id = ? AND (to_id = ? OR from_id = ?)',
      [requestId, req.user!.userId, req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[friends/decline]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    await execute(
      'DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [req.user!.userId, userId, userId, req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[friends/remove]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
