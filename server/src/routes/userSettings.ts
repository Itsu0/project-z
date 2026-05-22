import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'

const router = Router()

const DEFAULTS: Record<string, unknown> = {
  inputDevice: '', outputDevice: '',
  inputVolume: 100, outputVolume: 100,
  noiseSuppression: true, echoCancellation: true, autoGain: true,
  audioProfile: 'zbalansowany', vadThreshold: 0,
  pttEnabled: false, pttKey: 'Space',
  fontSize: 'normal', compactMode: false, colorTheme: 'ember',
}

router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ settings: unknown }>(
      'SELECT settings FROM user_settings WHERE user_id = ?',
      [req.user!.userId]
    )
    const settings = (row?.settings && typeof row.settings === 'object') ? row.settings : { ...DEFAULTS }
    return res.json({ settings })
  } catch (err) {
    console.error('[user/settings/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const patch = req.body
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'Nieprawidłowe dane' })
    }

    const row = await queryOne<{ settings: unknown }>(
      'SELECT settings FROM user_settings WHERE user_id = ?',
      [userId]
    )
    const current = (row?.settings && typeof row.settings === 'object') ? row.settings as Record<string, unknown> : { ...DEFAULTS }
    const updated = { ...current, ...patch }

    await execute(
      `INSERT INTO user_settings (user_id, settings) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE settings = ?, updated_at = NOW()`,
      [userId, JSON.stringify(updated), JSON.stringify(updated)]
    )
    return res.json({ settings: updated })
  } catch (err) {
    console.error('[user/settings/patch]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/warnings', requireAuth, async (req: Request, res: Response) => {
  try {
    const unseenOnly = req.query.unseen === '1'
    const warnings = await queryMany(
      `SELECT * FROM user_warnings
       WHERE user_id = ?
       ${unseenOnly ? 'AND seen_at IS NULL' : ''}
       ORDER BY created_at DESC`,
      [req.user!.userId]
    )
    return res.json({ warnings })
  } catch (err) {
    console.error('[user/warnings]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/warnings/:id/seen', requireAuth, async (req: Request, res: Response) => {
  try {
    const { reply } = req.body
    if (reply && reply.trim().length > 2000)
      return res.status(400).json({ error: 'Wyjaśnienie za długie (maks. 2000 znaków)' })

    await execute(
      `UPDATE user_warnings
       SET seen_at    = COALESCE(seen_at, NOW()),
           user_reply = COALESCE(?, user_reply),
           reply_at   = CASE WHEN ? IS NOT NULL AND user_reply IS NULL THEN NOW() ELSE reply_at END
       WHERE id = ? AND user_id = ?`,
      [reply?.trim() || null, reply?.trim() || null, req.params.id, req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[user/warnings/seen]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/warnings/:id/reply', requireAuth, async (req: Request, res: Response) => {
  try {
    const { reply } = req.body
    if (!reply?.trim())
      return res.status(400).json({ error: 'Wyjaśnienie nie może być puste' })
    if (reply.trim().length > 2000)
      return res.status(400).json({ error: 'Wyjaśnienie za długie (maks. 2000 znaków)' })

    const warn = await queryOne<{ user_id: string; user_reply: string | null }>(
      'SELECT user_id, user_reply FROM user_warnings WHERE id = ?',
      [req.params.id]
    )
    if (!warn || warn.user_id !== req.user!.userId)
      return res.status(404).json({ error: 'Ostrzeżenie nie znalezione' })
    if (warn.user_reply)
      return res.status(409).json({ error: 'Wyjaśnienie zostało już wysłane' })

    await execute(
      `UPDATE user_warnings SET user_reply = ?, reply_at = NOW() WHERE id = ? AND user_id = ?`,
      [reply.trim(), req.params.id, req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[user/warnings/reply]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
