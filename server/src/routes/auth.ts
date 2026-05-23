import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { userQueries, serverQueries } from '../db/queries'
import { signToken, requireAuth, getClientIp, recordIp } from '../middleware/auth'
import { execute, queryOne } from '../db/pool'
import { sendVerificationEmail } from '../lib/mailer'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, displayName, email, password, avatarColor, birthDate } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Wymagane pola: username, email, password' })
    }

    if (username.length < 2 || username.length > 32) {
      return res.status(400).json({ error: 'Nazwa użytkownika musi mieć 2-32 znaków' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Hasło musi mieć minimum 8 znaków' })
    }

    if (/^\d+$/.test(password)) {
      return res.status(400).json({ error: 'Hasło nie może składać się wyłącznie z cyfr' })
    }

    if (!birthDate) {
      return res.status(400).json({ error: 'Data urodzenia jest wymagana' })
    }

    const birth = new Date(birthDate)
    if (isNaN(birth.getTime())) {
      return res.status(400).json({ error: 'Nieprawidłowa data urodzenia' })
    }

    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--

    if (age < 16) {
      return res.status(400).json({ error: 'Musisz mieć ukończone 16 lat, aby założyć konto' })
    }

    if (age > 120) {
      return res.status(400).json({ error: 'Nieprawidłowa data urodzenia' })
    }

    const existingEmail    = await userQueries.findByEmail(email)
    const existingUsername = await userQueries.findByUsername(username)

    if (existingEmail) {
      const verCheck = await queryOne<{ email_verified: number }>(
        'SELECT email_verified FROM users WHERE id = ?', [existingEmail.id]
      )
      if (verCheck?.email_verified) {
        return res.status(409).json({ error: 'Email już zajęty' })
      }
      // Niezweryfikowane konto — wyślij ponownie link weryfikacyjny
      await execute('DELETE FROM email_verification_tokens WHERE user_id = ?', [existingEmail.id])
      const verToken = crypto.randomBytes(32).toString('hex')
      const { v4: uuidv4 } = await import('uuid')
      await execute(
        'INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))',
        [uuidv4(), existingEmail.id, verToken]
      )
      sendVerificationEmail(email, existingEmail.display_name ?? existingEmail.username, verToken).catch(() => {})
      return res.status(201).json({ pendingVerification: true, email })
    }

    if (existingUsername) return res.status(409).json({ error: 'Nazwa użytkownika już zajęta' })

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = await userQueries.create({
      username,
      displayName: displayName ?? username,
      email,
      passwordHash,
      birthDate: birth.toISOString().split('T')[0],
    })

    if (avatarColor) {
      await execute('UPDATE users SET avatar_color = ? WHERE id = ?', [avatarColor, userId])
    }

    const verToken = crypto.randomBytes(32).toString('hex')
    const { v4: uuidv4 } = await import('uuid')
    await execute(
      'INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))',
      [uuidv4(), userId, verToken]
    )

    const user = await userQueries.publicProfile(userId)
    sendVerificationEmail(email, user?.display_name ?? username, verToken).catch(() => {})

    recordIp(userId, getClientIp(req)).catch(() => {})
    return res.status(201).json({ pendingVerification: true, email })
  } catch (err) {
    console.error('[auth/register]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/verify-email/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const row = await queryOne<{ id: string; user_id: string; expires_at: string }>(
      'SELECT id, user_id, expires_at FROM email_verification_tokens WHERE token = ? LIMIT 1',
      [token]
    )

    if (!row) return res.status(400).json({ error: 'Nieprawidłowy lub wygasły link weryfikacyjny' })
    if (new Date(row.expires_at + 'Z') < new Date()) {
      return res.status(400).json({ error: 'Link weryfikacyjny wygasł. Poproś o nowy.' })
    }

    await execute('UPDATE users SET email_verified = 1 WHERE id = ?', [row.user_id])
    await execute('DELETE FROM email_verification_tokens WHERE user_id = ?', [row.user_id])

    const user = await userQueries.publicProfile(row.user_id)
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })

    const jwtToken = signToken({ userId: row.user_id, username: user.username })
    return res.json({ token: jwtToken, user })
  } catch (err) {
    console.error('[auth/verify-email]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Wymagany email' })

    const user = await userQueries.findByEmail(email)
    if (!user) return res.status(200).json({ ok: true })

    const alreadyVerified = await queryOne<{ email_verified: number }>(
      'SELECT email_verified FROM users WHERE id = ?', [user.id]
    )
    if (alreadyVerified?.email_verified) return res.status(200).json({ ok: true })

    await execute('DELETE FROM email_verification_tokens WHERE user_id = ?', [user.id])

    const verToken = crypto.randomBytes(32).toString('hex')
    const { v4: uuidv4 } = await import('uuid')
    await execute(
      'INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))',
      [uuidv4(), user.id, verToken]
    )

    const profile = await userQueries.publicProfile(user.id)
    sendVerificationEmail(email, profile?.display_name ?? user.username, verToken).catch(() => {})

    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/resend-verification]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Wymagane pola: email, password' })
    }

    const user = await userQueries.findByEmail(email)
    if (!user) return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' })

    const verCheck = await queryOne<{ email_verified: number }>(
      'SELECT email_verified FROM users WHERE id = ?', [user.id]
    )
    if (!verCheck?.email_verified) {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', email: user.email })
    }

    await userQueries.updateStatus(user.id, 'online')

    const token = signToken({ userId: user.id, username: user.username })
    const profile = await userQueries.publicProfile(user.id)

    recordIp(user.id, getClientIp(req)).catch(() => {})
    return res.json({ token, user: profile })
  } catch (err) {
    console.error('[auth/login]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await userQueries.publicProfile(req.user!.userId)
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })
    return res.json({ user })
  } catch (err) {
    console.error('[auth/me]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await userQueries.updateStatus(req.user!.userId, 'offline')
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/logout]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { displayName, customStatus, avatarColor } = req.body
    await userQueries.updateProfile(req.user!.userId, { displayName, customStatus, avatarColor })
    const { invalidateUserProfile } = await import('../socket')
    invalidateUserProfile(req.user!.userId)
    const user = await userQueries.publicProfile(req.user!.userId)

    const { queryMany } = await import('../db/pool')
    const servers = await queryMany<{ server_id: string }>(
      'SELECT server_id FROM server_members WHERE user_id = ?',
      [req.user!.userId]
    )
    const { getSocketInstance } = await import('../socket')
    const io = getSocketInstance()
    if (io) {
      for (const { server_id } of servers) {
        io.to(`server:${server_id}`).emit('PROFILE_UPDATE', {
          userId: req.user!.userId,
          displayName: user?.display_name,
          customStatus: user?.custom_status ?? null,
          avatarColor: user?.avatar_color,
          avatarUrl: user?.avatar_url ?? null,
        })
      }
    }
    return res.json({ user })
  } catch (err) {
    console.error('[auth/profile]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Wymagane: oldPassword, newPassword' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'Nowe hasło musi mieć min. 8 znaków' })
    if (/^\d+$/.test(newPassword)) return res.status(400).json({ error: 'Hasło nie może składać się wyłącznie z cyfr' })

    const user = await userQueries.findById(req.user!.userId)
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })

    const valid = await bcrypt.compare(oldPassword, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Nieprawidłowe aktualne hasło' })

    const hash = await bcrypt.hash(newPassword, 12)
    await require('../db/pool').execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user!.userId])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/password]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const allowed = ['online', 'idle', 'dnd', 'offline']
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Nieprawidłowy status' })
    await execute('UPDATE users SET status = ? WHERE id = ?', [status, req.user!.userId])

    const { io } = await import('../index')
    const servers = await serverQueries.forUser(req.user!.userId)
    for (const server of servers) {
      io.to(`server:${server.id}`).emit('USER_STATUS', { userId: req.user!.userId, status })
    }
    return res.json({ ok: true, status })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.post('/avatar', requireAuth, async (req: Request, res: Response) => {
  try {
    const { avatar } = req.body
    if (!avatar?.startsWith('data:image/')) return res.status(400).json({ error: 'Nieprawidłowy format' })

    if (avatar.length > 700000) return res.status(400).json({ error: 'Avatar za duży (maks. 500KB)' })
    await execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar, req.user!.userId])

    const { invalidateUserProfile } = await import('../socket')
    invalidateUserProfile(req.user!.userId)
    return res.json({ avatarUrl: avatar })
  } catch (err) { console.error('[auth/avatar]', err); return res.status(500).json({ error: 'Błąd serwera' }) }
})

export default router
