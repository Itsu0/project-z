import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { userQueries } from '../db/queries'
import { queryOne } from '../db/pool'

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
