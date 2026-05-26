import fs   from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

let sharp: any
try { sharp = require('sharp') } catch { sharp = null }

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')

export function getBaseUrl(): string {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL
  if (process.env.RAILWAY_STATIC_URL) return `https://${process.env.RAILWAY_STATIC_URL}`
  return 'http://localhost:3001'
}

function ensureDir(sub: string): string {
  const dir = path.join(UPLOAD_DIR, sub)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff',
])

export interface SavedFile {
  filename:    string
  url:         string
  size:        number
  width:       number | null
  height:      number | null
  contentType: string
}

export async function saveAttachment(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<SavedFile> {
  const dir = ensureDir('attachments')
  const id  = uuidv4()

  if (sharp && IMAGE_TYPES.has(mimeType)) {
    const result = await sharp(buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .withMetadata(false)
      .toBuffer({ resolveWithObject: true }) as { data: Buffer; info: { width: number; height: number } }

    const filename = `${id}.webp`
    fs.writeFileSync(path.join(dir, filename), result.data)
    return {
      filename,
      url:         `${getBaseUrl()}/uploads/attachments/${filename}`,
      size:        result.data.length,
      width:       result.info.width,
      height:      result.info.height,
      contentType: 'image/webp',
    }
  }

  const ext = getExt(mimeType, originalName)
  const filename = `${id}${ext}`
  fs.writeFileSync(path.join(dir, filename), buffer)
  return {
    filename,
    url:         `${getBaseUrl()}/uploads/attachments/${filename}`,
    size:        buffer.length,
    width:       null,
    height:      null,
    contentType: mimeType,
  }
}

export async function saveAvatar(buffer: Buffer, mimeType: string): Promise<string> {
  const dir = ensureDir('avatars')
  const id  = uuidv4()

  if (sharp && IMAGE_TYPES.has(mimeType)) {
    const data = await sharp(buffer)
      .resize(256, 256, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .withMetadata(false)
      .toBuffer() as Buffer
    const filename = `${id}.webp`
    fs.writeFileSync(path.join(dir, filename), data)
    return `${getBaseUrl()}/uploads/avatars/${filename}`
  }

  const ext = getExt(mimeType, 'avatar')
  const filename = `${id}${ext}`
  fs.writeFileSync(path.join(dir, filename), buffer)
  return `${getBaseUrl()}/uploads/avatars/${filename}`
}

export async function saveIcon(buffer: Buffer, mimeType: string): Promise<string> {
  const dir = ensureDir('icons')
  const id  = uuidv4()

  if (sharp && IMAGE_TYPES.has(mimeType)) {
    const data = await sharp(buffer)
      .resize(256, 256, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .withMetadata(false)
      .toBuffer() as Buffer
    const filename = `${id}.webp`
    fs.writeFileSync(path.join(dir, filename), data)
    return `${getBaseUrl()}/uploads/icons/${filename}`
  }

  const ext = getExt(mimeType, 'icon')
  const filename = `${id}${ext}`
  fs.writeFileSync(path.join(dir, filename), buffer)
  return `${getBaseUrl()}/uploads/icons/${filename}`
}

export async function saveDmAttachment(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<SavedFile> {
  const dir = ensureDir('dm')
  const id  = uuidv4()

  if (sharp && IMAGE_TYPES.has(mimeType)) {
    const result = await sharp(buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .withMetadata(false)
      .toBuffer({ resolveWithObject: true }) as { data: Buffer; info: { width: number; height: number } }

    const filename = `${id}.webp`
    fs.writeFileSync(path.join(dir, filename), result.data)
    return {
      filename,
      url:         `${getBaseUrl()}/uploads/dm/${filename}`,
      size:        result.data.length,
      width:       result.info.width,
      height:      result.info.height,
      contentType: 'image/webp',
    }
  }

  const ext = getExt(mimeType, originalName)
  const filename = `${id}${ext}`
  fs.writeFileSync(path.join(dir, filename), buffer)
  return {
    filename,
    url:         `${getBaseUrl()}/uploads/dm/${filename}`,
    size:        buffer.length,
    width:       null,
    height:      null,
    contentType: mimeType,
  }
}

export function deleteUpload(url: string): void {
  try {
    const base = getBaseUrl()
    if (!url.startsWith(base + '/uploads/')) return
    const rel      = url.slice((base + '/uploads/').length)
    const filePath = path.join(UPLOAD_DIR, rel)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

function getExt(mime: string, originalName: string): string {
  const map: Record<string, string> = {
    'video/mp4':       '.mp4',
    'video/webm':      '.webm',
    'video/quicktime': '.mov',
    'audio/mpeg':      '.mp3',
    'audio/ogg':       '.ogg',
    'audio/wav':       '.wav',
    'audio/webm':      '.weba',
    'application/pdf': '.pdf',
    'text/plain':      '.txt',
  }
  if (map[mime]) return map[mime]
  const dotIdx = originalName.lastIndexOf('.')
  if (dotIdx !== -1) return originalName.slice(dotIdx).toLowerCase()
  return '.bin'
}

export function base64ToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1] }
}
