import { Router, Request, Response } from 'express'
import multer from 'multer'
import path   from 'path'
import fs     from 'fs'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'
import { saveDmAttachment } from '../lib/fileStorage'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

const ALLOWED_TYPES = new Set([
  'image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif','image/bmp',
  'video/mp4','video/webm','video/quicktime',
  'audio/mpeg','audio/ogg','audio/wav','audio/webm',
  'application/pdf','text/plain',
])

const dmUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => ALLOWED_TYPES.has(f.mimetype) ? cb(null, true) : cb(new Error(`Niedozwolony typ: ${f.mimetype}`)),
})

// ── helpers ──────────────────────────────────────────────────────────────────

function convPairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

async function getOrCreateConv(myId: string, otherId: string): Promise<string | null> {
  const [u1, u2] = convPairKey(myId, otherId)
  const ex = await queryOne<{ id: string }>('SELECT id FROM dm_conversations WHERE user1_id=? AND user2_id=?', [u1, u2])
  if (ex) return ex.id
  const id = uuidv4()
  await execute('INSERT INTO dm_conversations (id,user1_id,user2_id) VALUES (?,?,?)', [id, u1, u2])
  return id
}

async function isFriend(myId: string, otherId: string): Promise<boolean> {
  const r = await queryOne('SELECT 1 FROM friends WHERE user_id=? AND friend_id=?', [myId, otherId])
  return !!r
}

async function isBlocked(myId: string, otherId: string): Promise<boolean> {
  const r = await queryOne(
    'SELECT 1 FROM dm_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)',
    [myId, otherId, otherId, myId]
  )
  return !!r
}

async function enrichMessages(msgs: any[], myId: string): Promise<any[]> {
  if (!msgs.length) return []
  const ids = msgs.map(m => m.id)
  const [reactions, attachments] = await Promise.all([
    queryMany<any>(
      `SELECT message_id, user_id, emoji FROM dm_reactions WHERE message_id IN (${ids.map(() => '?').join(',')})`,
      ids
    ),
    queryMany<any>(
      `SELECT id, message_id, filename, file_path, content_type, size, width, height
       FROM dm_attachments WHERE message_id IN (${ids.map(() => '?').join(',')})`,
      ids
    ),
  ])
  const BASE = process.env.BACKEND_URL ?? 'http://localhost:3001'
  const rxMap = new Map<string, any[]>()
  for (const r of reactions) {
    if (!rxMap.has(r.message_id)) rxMap.set(r.message_id, [])
    rxMap.get(r.message_id)!.push(r)
  }
  const attMap = new Map<string, any[]>()
  for (const a of attachments) {
    if (!attMap.has(a.message_id)) attMap.set(a.message_id, [])
    attMap.get(a.message_id)!.push({ ...a, url: `${BASE}/api/dm/files/${a.id}` })
  }
  // aggregate reactions
  function aggregateRx(raw: any[]) {
    const map = new Map<string, { emoji: string; count: number; me: boolean }>()
    for (const r of raw) {
      const ex = map.get(r.emoji)
      if (ex) { ex.count++; if (r.user_id === myId) ex.me = true }
      else map.set(r.emoji, { emoji: r.emoji, count: 1, me: r.user_id === myId })
    }
    return [...map.values()]
  }
  return msgs.map(m => ({
    ...m,
    reactions:   aggregateRx(rxMap.get(m.id) ?? []),
    attachments: attMap.get(m.id) ?? [],
  }))
}

// ── LIST CONVERSATIONS ────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const me = req.user!.userId
    const convs = await queryMany<any>(
      `SELECT
         dc.id, dc.user1_id, dc.user2_id, dc.last_message_at,
         u.id AS other_id, u.username, u.display_name, u.avatar_url, u.avatar_color, u.status,
         (SELECT dm.content FROM dm_messages dm
          WHERE dm.conversation_id = dc.id AND dm.deleted_at IS NULL
          ORDER BY dm.created_at DESC LIMIT 1) AS last_content,
         (SELECT dm.author_id FROM dm_messages dm
          WHERE dm.conversation_id = dc.id AND dm.deleted_at IS NULL
          ORDER BY dm.created_at DESC LIMIT 1) AS last_author_id,
         (SELECT dm.created_at FROM dm_messages dm
          WHERE dm.conversation_id = dc.id AND dm.deleted_at IS NULL
          ORDER BY dm.created_at DESC LIMIT 1) AS last_msg_at,
         dr.last_read_id
       FROM dm_conversations dc
       INNER JOIN users u ON u.id = IF(dc.user1_id=?, dc.user2_id, dc.user1_id)
       LEFT JOIN dm_reads dr ON dr.conversation_id=dc.id AND dr.user_id=?
       WHERE (dc.user1_id=? OR dc.user2_id=?)
       ORDER BY dc.last_message_at DESC
       LIMIT 50`,
      [me, me, me, me]
    )
    return res.json({ conversations: convs })
  } catch (err) {
    console.error('[dm/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── OPEN / CREATE CONVERSATION ────────────────────────────────────────────────

router.post('/open/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const me    = req.user!.userId
    const other = req.params.userId
    if (me === other) return res.status(400).json({ error: 'Nie możesz pisać do siebie' })

    const target = await queryOne<{ id: string }>('SELECT id FROM users WHERE id=?', [other])
    if (!target) return res.status(404).json({ error: 'Użytkownik nie istnieje' })

    if (!await isFriend(me, other)) return res.status(403).json({ error: 'Możesz pisać tylko do znajomych' })
    if (await isBlocked(me, other)) return res.status(403).json({ error: 'Zablokowany' })

    const convId = await getOrCreateConv(me, other)
    return res.json({ conversationId: convId })
  } catch (err) {
    console.error('[dm/open]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── GET MESSAGES (cursor pagination) ─────────────────────────────────────────

router.get('/:convId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const me     = req.user!.userId
    const convId = req.params.convId
    const before = req.query.before as string | undefined
    const limit  = Math.min(parseInt(req.query.limit as string) || 50, 100)

    const conv = await queryOne<{ user1_id: string; user2_id: string }>(
      'SELECT user1_id, user2_id FROM dm_conversations WHERE id=?', [convId]
    )
    if (!conv || (conv.user1_id !== me && conv.user2_id !== me))
      return res.status(403).json({ error: 'Brak dostępu' })

    const params: any[] = [convId]
    let cursor = ''
    if (before) { cursor = 'AND m.created_at < (SELECT created_at FROM dm_messages WHERE id=?)'; params.push(before) }

    const msgs = await queryMany<any>(
      `SELECT m.id, m.conversation_id, m.author_id, m.content, m.edited_at, m.deleted_at, m.created_at,
              u.username AS author_username, u.display_name AS author_display_name,
              u.avatar_color AS author_avatar_color, u.avatar_url AS author_avatar_url
       FROM dm_messages m
       INNER JOIN users u ON u.id = m.author_id
       WHERE m.conversation_id=? ${cursor}
       ORDER BY m.created_at DESC
       LIMIT ${limit}`,
      params
    )

    const enriched = await enrichMessages(msgs.reverse(), me)
    return res.json({ messages: enriched, hasMore: msgs.length === limit })
  } catch (err) {
    console.error('[dm/messages]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── SEND MESSAGE ──────────────────────────────────────────────────────────────

router.post('/:convId/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const me     = req.user!.userId
    const convId = req.params.convId
    const { content } = req.body

    if (!content?.trim() || content.length > 4000)
      return res.status(400).json({ error: 'Treść wiadomości jest wymagana (maks. 4000 znaków)' })

    const conv = await queryOne<{ user1_id: string; user2_id: string }>(
      'SELECT user1_id, user2_id FROM dm_conversations WHERE id=?', [convId]
    )
    if (!conv || (conv.user1_id !== me && conv.user2_id !== me))
      return res.status(403).json({ error: 'Brak dostępu' })

    const otherId = conv.user1_id === me ? conv.user2_id : conv.user1_id
    if (await isBlocked(me, otherId)) return res.status(403).json({ error: 'Zablokowany' })

    const id = uuidv4()
    await execute('INSERT INTO dm_messages (id,conversation_id,author_id,content) VALUES (?,?,?,?)',
      [id, convId, me, content.trim()])
    await execute('UPDATE dm_conversations SET last_message_at=UTC_TIMESTAMP() WHERE id=?', [convId])

    const msg = await queryOne<any>(
      `SELECT m.*, u.username AS author_username, u.display_name AS author_display_name,
              u.avatar_color AS author_avatar_color, u.avatar_url AS author_avatar_url
       FROM dm_messages m INNER JOIN users u ON u.id=m.author_id WHERE m.id=?`, [id]
    )

    const { getSocketInstance } = await import('../socket')
    const io = getSocketInstance()
    if (io) {
      io.to(`dm:${convId}`).emit('DM_MESSAGE_CREATE', { ...msg, reactions: [], attachments: [] })
    }

    return res.status(201).json({ message: { ...msg, reactions: [], attachments: [] } })
  } catch (err) {
    console.error('[dm/send]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── EDIT MESSAGE ──────────────────────────────────────────────────────────────

router.patch('/:convId/messages/:msgId', requireAuth, async (req: Request, res: Response) => {
  try {
    const me    = req.user!.userId
    const { content } = req.body
    if (!content?.trim()) return res.status(400).json({ error: 'Treść wymagana' })

    const msg = await queryOne<{ author_id: string; conversation_id: string; deleted_at: string | null }>(
      'SELECT author_id, conversation_id, deleted_at FROM dm_messages WHERE id=?', [req.params.msgId]
    )
    if (!msg || msg.author_id !== me || msg.conversation_id !== req.params.convId || msg.deleted_at)
      return res.status(403).json({ error: 'Brak dostępu' })

    await execute('UPDATE dm_messages SET content=?, edited_at=UTC_TIMESTAMP() WHERE id=?',
      [content.trim().slice(0, 4000), req.params.msgId])

    const { getSocketInstance } = await import('../socket')
    getSocketInstance()?.to(`dm:${req.params.convId}`).emit('DM_MESSAGE_UPDATE', {
      id: req.params.msgId, conversationId: req.params.convId,
      content: content.trim().slice(0, 4000), edited_at: new Date().toISOString(),
    })
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

// ── DELETE MESSAGE (soft) ─────────────────────────────────────────────────────

router.delete('/:convId/messages/:msgId', requireAuth, async (req: Request, res: Response) => {
  try {
    const me  = req.user!.userId
    const msg = await queryOne<{ author_id: string; conversation_id: string }>(
      'SELECT author_id, conversation_id FROM dm_messages WHERE id=? AND deleted_at IS NULL', [req.params.msgId]
    )
    if (!msg || msg.author_id !== me || msg.conversation_id !== req.params.convId)
      return res.status(403).json({ error: 'Brak dostępu' })

    await execute('UPDATE dm_messages SET deleted_at=UTC_TIMESTAMP(), content=? WHERE id=?',
      ['Wiadomość usunięta', req.params.msgId])

    const { getSocketInstance } = await import('../socket')
    getSocketInstance()?.to(`dm:${req.params.convId}`).emit('DM_MESSAGE_DELETE', {
      id: req.params.msgId, conversationId: req.params.convId,
    })
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

// ── REACTIONS ─────────────────────────────────────────────────────────────────

router.post('/:convId/messages/:msgId/react', requireAuth, async (req: Request, res: Response) => {
  try {
    const me = req.user!.userId
    const { emoji } = req.body
    if (!emoji) return res.status(400).json({ error: 'Emoji wymagane' })

    const msg = await queryOne<{ conversation_id: string; deleted_at: string | null }>(
      'SELECT conversation_id, deleted_at FROM dm_messages WHERE id=?', [req.params.msgId]
    )
    if (!msg || msg.conversation_id !== req.params.convId || msg.deleted_at)
      return res.status(404).json({ error: 'Wiadomość nie znaleziona' })

    await execute(
      'INSERT IGNORE INTO dm_reactions (message_id,user_id,emoji) VALUES (?,?,?)',
      [req.params.msgId, me, emoji]
    )
    const reactions = await queryMany<any>(
      'SELECT user_id, emoji FROM dm_reactions WHERE message_id=?', [req.params.msgId]
    )
    const { getSocketInstance } = await import('../socket')
    getSocketInstance()?.to(`dm:${req.params.convId}`).emit('DM_REACTION_UPDATE',
      { messageId: req.params.msgId, conversationId: req.params.convId, reactions })
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.delete('/:convId/messages/:msgId/react/:emoji', requireAuth, async (req: Request, res: Response) => {
  try {
    const me = req.user!.userId
    await execute('DELETE FROM dm_reactions WHERE message_id=? AND user_id=? AND emoji=?',
      [req.params.msgId, me, decodeURIComponent(req.params.emoji)])
    const reactions = await queryMany<any>(
      'SELECT user_id, emoji FROM dm_reactions WHERE message_id=?', [req.params.msgId]
    )
    const { getSocketInstance } = await import('../socket')
    getSocketInstance()?.to(`dm:${req.params.convId}`).emit('DM_REACTION_UPDATE',
      { messageId: req.params.msgId, conversationId: req.params.convId, reactions })
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

// ── ATTACHMENT UPLOAD ─────────────────────────────────────────────────────────

router.post('/:convId/attachments', requireAuth,
  (req: Request, res: Response, next: any) => {
    dmUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message })
      next()
    })
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Brak pliku' })
      const me     = req.user!.userId
      const convId = req.params.convId

      const conv = await queryOne<{ user1_id: string; user2_id: string }>(
        'SELECT user1_id, user2_id FROM dm_conversations WHERE id=?', [convId]
      )
      if (!conv || (conv.user1_id !== me && conv.user2_id !== me))
        return res.status(403).json({ error: 'Brak dostępu' })

      const saved = await saveDmAttachment(req.file.buffer, req.file.mimetype, req.file.originalname)
      const attId = uuidv4()
      const BASE  = process.env.BACKEND_URL ?? 'http://localhost:3001'

      await execute(
        'INSERT INTO dm_attachments (id,message_id,filename,file_path,content_type,size,width,height) VALUES (?,?,?,?,?,?,?,?)',
        [attId, '', req.file.originalname, saved.filename, saved.contentType, saved.size, saved.width, saved.height]
      )

      return res.status(201).json({
        id: attId, filename: req.file.originalname,
        contentType: saved.contentType, size: saved.size,
        width: saved.width, height: saved.height,
        url: `${BASE}/api/dm/files/${attId}`,
      })
    } catch (err) {
      console.error('[dm/attachment]', err)
      return res.status(500).json({ error: 'Błąd przesyłania' })
    }
  }
)

// ── SERVE DM FILE (auth check) ────────────────────────────────────────────────

router.get('/files/:attId', requireAuth, async (req: Request, res: Response) => {
  try {
    const me  = req.user!.userId
    const att = await queryOne<any>(
      `SELECT da.*, dm.conversation_id FROM dm_attachments da
       LEFT JOIN dm_messages dm ON dm.id=da.message_id
       WHERE da.id=?`, [req.params.attId]
    )
    if (!att) return res.status(404).json({ error: 'Nie znaleziono' })

    if (att.conversation_id) {
      const conv = await queryOne<{ user1_id: string; user2_id: string }>(
        'SELECT user1_id, user2_id FROM dm_conversations WHERE id=?', [att.conversation_id]
      )
      if (!conv || (conv.user1_id !== me && conv.user2_id !== me))
        return res.status(403).json({ error: 'Brak dostępu' })
    }

    const filePath = path.join(UPLOAD_DIR, 'dm', att.file_path)
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Plik nie znaleziony' })

    const ct = ALLOWED_TYPES.has(att.content_type) ? att.content_type : 'application/octet-stream'
    res.set('Content-Type', ct)
    res.set('Cache-Control', 'private, max-age=31536000')
    res.set('X-Content-Type-Options', 'nosniff')
    if (!ct.startsWith('image/')) {
      const safe = encodeURIComponent(att.filename.replace(/[^\w.\-]/g, '_'))
      res.set('Content-Disposition', `attachment; filename="${safe}"`)
    }
    return res.sendFile(filePath)
  } catch (err) {
    console.error('[dm/file]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── MARK READ ─────────────────────────────────────────────────────────────────

router.patch('/:convId/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const me     = req.user!.userId
    const convId = req.params.convId
    const { lastReadId } = req.body
    await execute(
      `INSERT INTO dm_reads (user_id,conversation_id,last_read_id) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE last_read_id=?`,
      [me, convId, lastReadId, lastReadId]
    )
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

// ── BLOCK / UNBLOCK ───────────────────────────────────────────────────────────

router.post('/block/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const me = req.user!.userId
    if (me === req.params.userId) return res.status(400).json({ error: 'Nie możesz zablokować siebie' })
    await execute('INSERT IGNORE INTO dm_blocks (blocker_id,blocked_id) VALUES (?,?)', [me, req.params.userId])
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.delete('/block/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    await execute('DELETE FROM dm_blocks WHERE blocker_id=? AND blocked_id=?', [req.user!.userId, req.params.userId])
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.get('/blocks', requireAuth, async (req: Request, res: Response) => {
  try {
    const blocks = await queryMany<any>(
      `SELECT db.blocked_id, u.username, u.display_name, u.avatar_color
       FROM dm_blocks db INNER JOIN users u ON u.id=db.blocked_id
       WHERE db.blocker_id=?`, [req.user!.userId]
    )
    return res.json({ blocks })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

export default router
