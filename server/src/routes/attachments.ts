import { Router, Request, Response } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'
import { execute, queryOne } from '../db/pool'
import { hasPermission } from '../middleware/permissions'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  'application/pdf',
  'text/plain',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Niedozwolony typ pliku: ${file.mimetype}`))
    }
  },
})

function getBaseUrl(): string {
  if (process.env.RAILWAY_STATIC_URL) return `https://${process.env.RAILWAY_STATIC_URL}`
  return process.env.BACKEND_URL ?? 'http://localhost:3001'
}

router.post('/:channelId/attachments', requireAuth, (req: Request, res: Response, next: any) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Błąd przesyłania: ${err.message}` })
    }
    if (err) {
      return res.status(400).json({ error: err.message })
    }
    next()
  })
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' })
    const { channelId } = req.params
    const id = uuidv4()
    let width: number | null = null
    let height: number | null = null

    if (req.file.mimetype.startsWith('image/')) {
      try {
        const buf = req.file.buffer
        if (req.file.mimetype === 'image/png' && buf.length > 24) {
          width  = buf.readUInt32BE(16)
          height = buf.readUInt32BE(20)
        } else if ((req.file.mimetype === 'image/jpeg' || req.file.mimetype === 'image/jpg') && buf.length > 4) {
          let i = 2
          while (i < buf.length - 8) {
            if (buf[i] === 0xFF) {
              const marker = buf[i + 1]
              if (marker >= 0xC0 && marker <= 0xC3) {
                height = buf.readUInt16BE(i + 5)
                width  = buf.readUInt16BE(i + 7)
                break
              }
              i += 2 + buf.readUInt16BE(i + 2)
            } else { i++ }
          }
        }
      } catch {  }
    }

    await execute(
      'INSERT INTO message_attachments (id, channel_id, uploader_id, filename, content_type, size, width, height, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, channelId, req.user!.userId, req.file.originalname, req.file.mimetype, req.file.size, width, height, req.file.buffer]
    )

    return res.status(201).json({
      id,
      filename:    req.file.originalname,
      contentType: req.file.mimetype,
      size:        req.file.size,
      width,
      height,
      url: `${getBaseUrl()}/api/attachments/${id}`,
    })
  } catch (err) {
    console.error('[attachments/upload]', err)
    return res.status(500).json({ error: 'Błąd przesyłania pliku' })
  }
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ data: Buffer; content_type: string; filename: string; server_id: string }>(
      `SELECT ma.data, ma.content_type, ma.filename, c.server_id
       FROM message_attachments ma
       INNER JOIN channels c ON c.id = ma.channel_id
       WHERE ma.id = ?`,
      [req.params.id]
    )
    if (!row) return res.status(404).json({ error: 'Nie znaleziono' })

    if (!await hasPermission(req.user!.userId, row.server_id, 'VIEW_CHANNELS')) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }

    const safeContentType = ALLOWED_MIME_TYPES.has(row.content_type)
      ? row.content_type
      : 'application/octet-stream'

    const isImage = safeContentType.startsWith('image/')
    res.set('Content-Type', safeContentType)
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'private, max-age=31536000')

    const safeFilename = encodeURIComponent(row.filename.replace(/[^\w.\-]/g, '_'))
    if (!isImage) {
      res.set('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`)
    }

    return res.send(Buffer.from(row.data))
  } catch (err) {
    console.error('[attachments/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
