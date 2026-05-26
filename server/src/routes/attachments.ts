import { Router, Request, Response } from 'express'
import multer from 'multer'
import path   from 'path'
import fs     from 'fs'
import { requireAuth } from '../middleware/auth'
import { execute, queryOne } from '../db/pool'
import { hasPermission } from '../middleware/permissions'
import { saveAttachment } from '../lib/fileStorage'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  'application/pdf',
  'text/plain',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    ALLOWED_MIME_TYPES.has(file.mimetype) ? cb(null, true) : cb(new Error(`Niedozwolony typ pliku: ${file.mimetype}`))
  },
})

router.post('/:channelId/attachments', requireAuth, (req: Request, res: Response, next: any) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: `Błąd przesyłania: ${err.message}` })
    if (err) return res.status(400).json({ error: err.message })
    next()
  })
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' })
    const { channelId } = req.params
    const ch = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!ch) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await hasPermission(req.user!.userId, ch.server_id, 'SEND_MESSAGES'))
      return res.status(403).json({ error: 'Brak dostępu' })

    const saved = await saveAttachment(req.file.buffer, req.file.mimetype, req.file.originalname)
    const id    = uuidv4()

    await execute(
      `INSERT INTO message_attachments
         (id, channel_id, uploader_id, filename, content_type, size, width, height, file_path, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [id, channelId, req.user!.userId, req.file.originalname, saved.contentType,
       saved.size, saved.width, saved.height, saved.filename]
    )

    return res.status(201).json({
      id,
      filename:    req.file.originalname,
      contentType: saved.contentType,
      size:        saved.size,
      width:       saved.width,
      height:      saved.height,
      url:         saved.url,
    })
  } catch (err) {
    console.error('[attachments/upload]', err)
    return res.status(500).json({ error: 'Błąd przesyłania pliku' })
  }
})

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{
      data: Buffer | null; content_type: string; filename: string
      file_path: string | null; server_id: string; mod_only: number
    }>(
      `SELECT ma.data, ma.content_type, ma.filename, ma.file_path,
              c.server_id, COALESCE(c.mod_only, 0) AS mod_only
       FROM message_attachments ma
       INNER JOIN channels c ON c.id = ma.channel_id
       WHERE ma.id = ?`,
      [req.params.id]
    )
    if (!row) return res.status(404).json({ error: 'Nie znaleziono' })

    if (!await hasPermission(req.user!.userId, row.server_id, 'VIEW_CHANNELS'))
      return res.status(403).json({ error: 'Brak dostępu' })
    if (row.mod_only) {
      const { canModerate } = await import('../middleware/permissions')
      if (!await canModerate(req.user!.userId, row.server_id, 'MANAGE_MESSAGES'))
        return res.status(403).json({ error: 'Brak dostępu' })
    }

    const safeContentType = ALLOWED_MIME_TYPES.has(row.content_type) ? row.content_type : 'application/octet-stream'
    const isImage = safeContentType.startsWith('image/')
    res.set('Content-Type', safeContentType)
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'private, max-age=31536000')
    if (!isImage) {
      const safe = encodeURIComponent(row.filename.replace(/[^\w.\-]/g, '_'))
      res.set('Content-Disposition', `attachment; filename="${safe}"; filename*=UTF-8''${safe}`)
    }

    if (row.file_path) {
      const filePath = path.join(UPLOAD_DIR, 'attachments', row.file_path)
      if (fs.existsSync(filePath)) return res.sendFile(filePath)
    }
    if (row.data) return res.send(Buffer.from(row.data))
    return res.status(404).json({ error: 'Plik nie znaleziony' })
  } catch (err) {
    console.error('[attachments/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
