import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { userQueries } from '../db/queries'
import { queryOne, execute } from '../db/pool'
import { v4 as uuid } from 'uuid'

export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for']
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim()
    if (first) return first
  }
  return (req.headers['x-real-ip'] as string) ?? req.socket?.remoteAddress ?? '0.0.0.0'
}

export async function recordIp(userId: string, ip: string): Promise<void> {
  try {
    await execute(
      `INSERT INTO user_ips (id, user_id, ip) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE last_seen = NOW()`,
      [uuid(), userId, ip]
    )
    await execute('UPDATE users SET last_ip = ? WHERE id = ?', [ip, userId])
  } catch {}
}

export interface AuthPayload {
  userId: string
  username: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function signToken(payload: AuthPayload): string {

  return (jwt.sign as Function)(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  })
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokena autoryzacji' })
  }

  try {
    const token = auth.slice(7)
    const payload = verifyToken(token)

    const user = await userQueries.findById(payload.userId)
    if (!user) return res.status(401).json({ error: 'Użytkownik nie istnieje' })

    const clientIp = getClientIp(req)
    const ipBan = await queryOne<{ reason: string }>(
      'SELECT reason FROM banned_ips WHERE ip = ? LIMIT 1', [clientIp]
    )
    if (ipBan) {
      return res.status(403).json({
        error: `Dostęp zablokowany. Powód: ${ipBan.reason}`,
        banned: true,
      })
    }

    const ban = await queryOne<{ reason: string; expires_at: string | null }>(
      `SELECT reason, expires_at FROM user_bans
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [payload.userId]
    )
    if (ban) {
      const until = ban.expires_at
        ? ` do ${new Date(ban.expires_at).toLocaleDateString('pl-PL')}`
        : ' permanentnie'
      return res.status(403).json({
        error: `Twoje konto zostało zablokowane${until}. Powód: ${ban.reason}`,
        banned: true,
      })
    }

    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Nieprawidłowy lub wygasły token' })
  }
}

export function verifySocketToken(token: string): AuthPayload | null {
  try {
    return verifyToken(token)
  } catch {
    return null
  }
}
