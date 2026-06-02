import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'
import { memberQueries, serverQueries } from '../db/queries'
import { hasPermission } from '../middleware/permissions'

const router = Router()

async function requireMember(userId: string, serverId: string): Promise<boolean> {
  return memberQueries.isMember(userId, serverId)
}
// Edycja = właściciel lub oficer (MANAGE_MESSAGES)
async function canEdit(userId: string, serverId: string): Promise<boolean> {
  const srv = await serverQueries.findById(serverId)
  if (srv?.owner_id === userId) return true
  return hasPermission(userId, serverId, 'MANAGE_MESSAGES')
}

// ── Lista przeciwników ───────────────────────────────────────────────────────
router.get('/:serverId/tactics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!(await requireMember(req.user!.userId, serverId))) return res.status(403).json({ error: 'Brak dostępu' })
    const targets = await queryMany(
      `SELECT t.id, t.name, t.updated_at, t.created_at, u.display_name AS updated_by_name
       FROM tactics_targets t LEFT JOIN users u ON u.id = t.updated_by
       WHERE t.server_id = ? ORDER BY t.updated_at DESC`,
      [serverId]
    )
    return res.json({ targets, canEdit: await canEdit(req.user!.userId, serverId) })
  } catch (err) {
    console.error('[tactics/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Utwórz przeciwnika (oficer) ──────────────────────────────────────────────
router.post('/:serverId/tactics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!(await canEdit(req.user!.userId, serverId))) return res.status(403).json({ error: 'Tylko oficerowie mogą dodawać' })
    const name = (req.body?.name ?? '').trim()
    if (!name || name.length > 120) return res.status(400).json({ error: 'Nazwa 1-120 znaków' })
    const id = uuid()
    await execute(
      'INSERT INTO tactics_targets (id, server_id, name, created_by, updated_by) VALUES (?,?,?,?,?)',
      [id, serverId, name, req.user!.userId, req.user!.userId]
    )
    const target = await queryOne('SELECT id, name, created_at, updated_at FROM tactics_targets WHERE id = ?', [id])
    return res.status(201).json({ target })
  } catch (err) {
    console.error('[tactics/create]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Usuń przeciwnika (oficer) ────────────────────────────────────────────────
router.delete('/:serverId/tactics/:targetId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, targetId } = req.params
    if (!(await canEdit(req.user!.userId, serverId))) return res.status(403).json({ error: 'Brak uprawnień' })
    await execute('DELETE FROM tactics_targets WHERE id = ? AND server_id = ?', [targetId, serverId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Historia wersji ──────────────────────────────────────────────────────────
router.get('/:serverId/tactics/:targetId/revisions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, targetId } = req.params
    if (!(await requireMember(req.user!.userId, serverId))) return res.status(403).json({ error: 'Brak dostępu' })
    const revisions = await queryMany(
      `SELECT r.id, r.label, r.created_at, u.display_name AS author_name
       FROM tactics_revisions r LEFT JOIN users u ON u.id = r.author_id
       WHERE r.target_id = ? ORDER BY r.created_at DESC LIMIT 100`,
      [targetId]
    )
    return res.json({ revisions })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Zapisz wersję (migawka aktualnej treści) — oficer ────────────────────────
router.post('/:serverId/tactics/:targetId/revisions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, targetId } = req.params
    if (!(await canEdit(req.user!.userId, serverId))) return res.status(403).json({ error: 'Brak uprawnień' })
    const content = String(req.body?.content ?? '')
    if (content.length > 100000) return res.status(400).json({ error: 'Treść za długa' })
    const label = (req.body?.label ?? '').toString().trim().slice(0, 120) || null
    const id = uuid()
    await execute(
      'INSERT INTO tactics_revisions (id, target_id, content, label, author_id) VALUES (?,?,?,?,?)',
      [id, targetId, content, label, req.user!.userId]
    )
    return res.status(201).json({ id })
  } catch (err) {
    console.error('[tactics/revision]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Treść konkretnej wersji ──────────────────────────────────────────────────
router.get('/:serverId/tactics/:targetId/revisions/:revId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, revId } = req.params
    if (!(await requireMember(req.user!.userId, serverId))) return res.status(403).json({ error: 'Brak dostępu' })
    const rev = await queryOne('SELECT id, content, label, created_at FROM tactics_revisions WHERE id = ?', [revId])
    if (!rev) return res.status(404).json({ error: 'Wersja nie znaleziona' })
    return res.json({ revision: rev })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
