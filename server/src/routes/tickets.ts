import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'

const router = Router()

async function isCreator(userId: string): Promise<boolean> {
  const row = await queryOne<{ is_dev: number; is_creator: number }>(
    'SELECT is_dev, COALESCE(is_creator, 0) AS is_creator FROM users WHERE id = ?', [userId]
  )
  if (!row) return false
  if (row.is_dev) return true
  if (row.is_creator) return true
  const first = await queryOne<{ id: string }>('SELECT id FROM users ORDER BY created_at ASC LIMIT 1')
  if (first?.id === userId) {
    await queryOne('UPDATE users SET is_creator = 1 WHERE id = ?', [userId]).catch(() => {})
    return true
  }
  return false
}

async function isStaff(userId: string): Promise<boolean> {
  if (await isCreator(userId)) return true
  const mod = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = ? AND is_mod = 1', [userId])
  return !!mod
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Błąd techniczny',
  abuse: 'Naruszenie regulaminu',
  security: 'Problem z bezpieczeństwem',
  spam: 'Spam',
  other: 'Inne',
}

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { category, subject, description, screenshot, server_id, channel_id, message_id } = req.body
    if (!subject?.trim() || !description?.trim())
      return res.status(400).json({ error: 'Wymagany temat i opis' })
    if (!CATEGORY_LABELS[category])
      return res.status(400).json({ error: 'Nieprawidłowa kategoria' })
    if (subject.length > 200)
      return res.status(400).json({ error: 'Temat za długi (maks. 200 znaków)' })
    if (screenshot && !screenshot.startsWith('data:image/'))
      return res.status(400).json({ error: 'Nieprawidłowy format zrzutu ekranu' })
    if (screenshot && screenshot.length > 4_000_000)
      return res.status(400).json({ error: 'Zrzut ekranu za duży (maks. ~3 MB)' })

    let resolvedServerId: string | null = null
    if (server_id) {
      const srv = await queryOne<{ id: string }>('SELECT id FROM servers WHERE id = ?', [server_id])
      if (srv) resolvedServerId = srv.id
    }

    const id = uuid()
    await execute(
      `INSERT INTO tickets (id, user_id, category, subject, description, screenshot, server_id, channel_id, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user!.userId, category, subject.trim(), description.trim(), screenshot ?? null, resolvedServerId, channel_id ?? null, message_id ?? null]
    )
    const ticket = await queryOne(
      `SELECT t.*, u.display_name, u.avatar_color, u.avatar_url,
              s.name as server_name, s.icon_color as server_icon_color, s.icon_url as server_icon_url
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN servers s ON s.id = t.server_id
       WHERE t.id = ?`, [id]
    )
    return res.status(201).json({ ticket })
  } catch (err) {
    console.error('[tickets/create]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const tickets = await queryMany(
      `SELECT t.*, u.display_name, u.avatar_color, u.avatar_url,
              s.name as server_name, s.icon_color as server_icon_color, s.icon_url as server_icon_url
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN servers s ON s.id = t.server_id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`,
      [req.user!.userId]
    )
    return res.json({ tickets })
  } catch (err) {
    console.error('[tickets/my]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await isStaff(req.user!.userId)))
      return res.status(403).json({ error: 'Brak uprawnień' })

    const { status } = req.query
    const where = status ? 'WHERE t.status = ?' : ''
    const params = status ? [status] : []

    const tickets = await queryMany(
      `SELECT t.*, u.display_name, u.avatar_color, u.avatar_url,
              s.name as server_name, s.icon_color as server_icon_color, s.icon_url as server_icon_url,
              m.content as message_content, mu.display_name as message_author_name
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN servers s ON s.id = t.server_id
       LEFT JOIN messages m ON m.id = t.message_id
       LEFT JOIN users mu ON mu.id = m.author_id
       ${where}
       ORDER BY
         FIELD(t.status,'open','in_progress','resolved','closed'),
         t.created_at DESC`,
      params
    )
    return res.json({ tickets })
  } catch (err) {
    console.error('[tickets/all]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!(await isStaff(req.user!.userId)))
      return res.status(403).json({ error: 'Brak uprawnień' })

    const { status, admin_reply } = req.body
    const allowed = ['open', 'in_progress', 'resolved', 'closed']
    if (status && !allowed.includes(status))
      return res.status(400).json({ error: 'Nieprawidłowy status' })

    await execute(
      `UPDATE tickets SET
         status      = COALESCE(?, status),
         admin_reply = COALESCE(?, admin_reply),
         updated_at  = NOW()
       WHERE id = ?`,
      [status ?? null, admin_reply ?? null, req.params.id]
    )
    const ticket = await queryOne('SELECT * FROM tickets WHERE id = ?', [req.params.id])
    return res.json({ ticket })
  } catch (err) {
    console.error('[tickets/patch]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/creator-check', requireAuth, async (req: Request, res: Response) => {
  try {
    const creator = await isCreator(req.user!.userId)
    const staff   = creator || await isStaff(req.user!.userId)
    return res.json({ isCreator: creator, isMod: staff && !creator })
  } catch {
    return res.json({ isCreator: false, isMod: false })
  }
})

export default router
