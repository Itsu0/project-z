import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { userQueries, serverQueries } from '../db/queries'
import { signToken, requireAuth, getClientIp, recordIp } from '../middleware/auth'
import { execute, queryOne } from '../db/pool'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer'
import { generateSecret, verify as totpVerify, generateURI } from 'otplib'

const router = Router()

// ── Helpers bezpieczeństwa ────────────────────────────────────────────────────
function isStrongPassword(p: string): boolean {
  let cats = 0
  if (/[a-z]/.test(p)) cats++
  if (/[A-Z]/.test(p)) cats++
  if (/[0-9]/.test(p)) cats++
  if (/[^a-zA-Z0-9]/.test(p)) cats++
  return cats >= 3
}

const DUMMY_HASH = bcrypt.hashSync('__timing_protection_dummy__', 12)
const resendCooldown = new Map<string, number>()
const avatarRateMap  = new Map<string, number>()
const twoFaAttempts  = new Map<string, { count: number; resetAt: number }>()

const AUTH_COOKIE = 'pz_token'
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
}

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

    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Hasło musi zawierać znaki z co najmniej 3 kategorii: małe litery, wielkie litery, cyfry, znaki specjalne' })
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
    res.cookie(AUTH_COOKIE, jwtToken, cookieOpts)
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

    const lastSent = resendCooldown.get(String(email).toLowerCase()) ?? 0
    if (Date.now() - lastSent < 5 * 60_000) {
      return res.status(429).json({ error: 'Poczekaj 5 minut przed ponownym wysłaniem' })
    }
    resendCooldown.set(String(email).toLowerCase(), Date.now())

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

    const attemptKey = String(email).toLowerCase().slice(0, 254)

    const lockRow = await queryOne<{ attempts: number; locked_until: string | null }>(
      'SELECT attempts, locked_until FROM login_lockouts WHERE lookup_key = ?',
      [attemptKey]
    )
    if (lockRow?.locked_until && new Date(lockRow.locked_until + 'Z') > new Date()) {
      const remaining = Math.ceil((new Date(lockRow.locked_until + 'Z').getTime() - Date.now()) / 60000)
      return res.status(429).json({ error: `Konto zablokowane na ${remaining} min z powodu zbyt wielu nieudanych prób` })
    }

    const user = await userQueries.findByEmail(email)
    const hashToCompare = user?.password_hash ?? DUMMY_HASH
    const valid = await bcrypt.compare(password, hashToCompare)

    if (!user || !valid) {
      await execute(
        `INSERT INTO login_lockouts (lookup_key, attempts, locked_until) VALUES (?, 1, NULL)
         ON DUPLICATE KEY UPDATE
           attempts = attempts + 1,
           locked_until = CASE WHEN attempts + 1 >= 5
             THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)
             ELSE locked_until END`,
        [attemptKey]
      )
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' })
    }

    await execute('DELETE FROM login_lockouts WHERE lookup_key = ?', [attemptKey])

    const verCheck = await queryOne<{ email_verified: number }>(
      'SELECT email_verified FROM users WHERE id = ?', [user.id]
    )
    if (!verCheck?.email_verified) {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', email: user.email })
    }

    const twoFaRow = await queryOne<{ totp_enabled: number }>(
      'SELECT totp_enabled FROM users WHERE id = ?', [user.id]
    )
    if (twoFaRow?.totp_enabled) {
      const jwt = await import('jsonwebtoken')
      const tempToken = jwt.sign(
        { userId: user.id, twoFaPending: true },
        process.env.JWT_SECRET!,
        { expiresIn: '5m' }
      )
      recordIp(user.id, getClientIp(req)).catch(() => {})
      return res.json({ twoFaRequired: true, tempToken })
    }

    await userQueries.updateStatus(user.id, 'online')

    const token = signToken({ userId: user.id, username: user.username })
    const profile = await userQueries.publicProfile(user.id)

    recordIp(user.id, getClientIp(req)).catch(() => {})
    res.cookie(AUTH_COOKIE, token, cookieOpts)
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
    const freshToken = signToken({ userId: req.user!.userId, username: req.user!.username })
    res.cookie(AUTH_COOKIE, freshToken, cookieOpts)
    return res.json({ user, token: freshToken })
  } catch (err) {
    console.error('[auth/me]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await userQueries.updateStatus(req.user!.userId, 'offline')
    res.clearCookie(AUTH_COOKIE, { path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) })
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
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: 'Hasło musi zawierać znaki z co najmniej 3 kategorii: małe litery, wielkie litery, cyfry, znaki specjalne' })

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

// ── Reset hasła ──────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Wymagany email' })
    const user = await userQueries.findByEmail(email)
    if (!user) return res.json({ ok: true }) // nie ujawniamy czy email istnieje

    await execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id])
    const token = crypto.randomBytes(32).toString('hex')
    const { v4: uuidv4 } = await import('uuid')
    await execute(
      'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))',
      [uuidv4(), user.id, token]
    )
    sendPasswordResetEmail(email, user.display_name ?? user.username, token).catch(() => {})
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/forgot-password]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ error: 'Wymagane: token, password' })
    if (password.length < 8) return res.status(400).json({ error: 'Hasło musi mieć min. 8 znaków' })
    if (!isStrongPassword(password)) return res.status(400).json({ error: 'Hasło musi zawierać znaki z co najmniej 3 kategorii: małe litery, wielkie litery, cyfry, znaki specjalne' })

    const row = await queryOne<{ id: string; user_id: string; expires_at: string }>(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = ? LIMIT 1', [token]
    )
    if (!row) return res.status(400).json({ error: 'Nieprawidłowy lub wygasły link' })
    if (new Date(row.expires_at + 'Z') < new Date()) {
      return res.status(400).json({ error: 'Link wygasł. Poproś o nowy.' })
    }

    const hash = await bcrypt.hash(password, 12)
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id])
    await execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [row.user_id])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/reset-password]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Usuwanie konta ───────────────────────────────────────────────────────────
router.delete('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const { password } = req.body
    if (!password) return res.status(400).json({ error: 'Wymagane hasło' })
    const user = await userQueries.findById(req.user!.userId)
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })
    const devOrCreator = await queryOne<{ is_dev: number; is_creator: number }>(
      'SELECT is_dev, COALESCE(is_creator, 0) AS is_creator FROM users WHERE id = ?', [req.user!.userId]
    )
    if (devOrCreator?.is_dev || devOrCreator?.is_creator) {
      return res.status(403).json({ error: 'Konto założyciela platformy nie może zostać usunięte' })
    }
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Nieprawidłowe hasło' })
    await execute('DELETE FROM users WHERE id = ?', [req.user!.userId])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/delete-account]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── 2FA TOTP ─────────────────────────────────────────────────────────────────
router.post('/2fa/setup', requireAuth, async (req: Request, res: Response) => {
  try {

    const QRCode = await import('qrcode')
    const user = await userQueries.publicProfile(req.user!.userId)
    if (!user) return res.status(404).json({ error: 'Nie znaleziono użytkownika' })

    const secret = await generateSecret()
    const otpauth = await generateURI({ issuer: 'Project-Z', label: user.username, secret })
    const qrDataUrl = await QRCode.toDataURL(otpauth)

    await execute(
      `UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`,
      [secret, req.user!.userId]
    )
    return res.json({ secret, qrDataUrl })
  } catch (err) {
    console.error('[auth/2fa/setup]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/2fa/enable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Wymagany kod' })
    const row = await queryOne<{ totp_secret: string | null }>(
      'SELECT totp_secret FROM users WHERE id = ?', [req.user!.userId]
    )
    if (!row?.totp_secret) return res.status(400).json({ error: 'Najpierw skonfiguruj 2FA' })

    const { valid } = await totpVerify({ token: code, secret: row.totp_secret! })
    if (!valid) return res.status(400).json({ error: 'Nieprawidłowy kod' })
    await execute('UPDATE users SET totp_enabled = 1 WHERE id = ?', [req.user!.userId])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/2fa/enable]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/2fa/disable', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Wymagany kod' })
    const row = await queryOne<{ totp_secret: string | null; totp_enabled: number }>(
      'SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [req.user!.userId]
    )
    if (!row?.totp_enabled) return res.status(400).json({ error: '2FA nie jest włączone' })

    const { valid } = await totpVerify({ token: code, secret: row.totp_secret! })
    if (!valid) return res.status(400).json({ error: 'Nieprawidłowy kod' })
    await execute('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', [req.user!.userId])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[auth/2fa/disable]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Weryfikacja 2FA przy logowaniu ────────────────────────────────────────────
router.post('/2fa/verify-login', async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body
    if (!tempToken || !code) return res.status(400).json({ error: 'Wymagane: tempToken, code' })

    const ipKey = getClientIp(req)
    const twoFaRec = twoFaAttempts.get(ipKey) ?? { count: 0, resetAt: Date.now() + 5 * 60_000 }
    if (Date.now() > twoFaRec.resetAt) { twoFaRec.count = 0; twoFaRec.resetAt = Date.now() + 5 * 60_000 }
    if (twoFaRec.count >= 10) {
      return res.status(429).json({ error: 'Zbyt wiele prób weryfikacji 2FA, poczekaj 5 minut' })
    }

    let payload: { userId: string; twoFaPending: boolean }
    try {
      const jwt = await import('jsonwebtoken')
      payload = jwt.verify(tempToken, process.env.JWT_SECRET!) as any
    } catch {
      return res.status(401).json({ error: 'Nieprawidłowy token' })
    }
    if (!payload.twoFaPending) return res.status(400).json({ error: 'Nieprawidłowy token' })

    const row = await queryOne<{ totp_secret: string }>(
      'SELECT totp_secret FROM users WHERE id = ?', [payload.userId]
    )
    if (!row?.totp_secret) return res.status(400).json({ error: 'Błąd konfiguracji 2FA' })

    const { valid } = await totpVerify({ token: code, secret: row.totp_secret! })
    if (!valid) {
      twoFaRec.count++
      twoFaAttempts.set(ipKey, twoFaRec)
      return res.status(400).json({ error: 'Nieprawidłowy kod 2FA' })
    }
    twoFaAttempts.delete(ipKey)

    const user = await userQueries.publicProfile(payload.userId)
    if (!user) return res.status(404).json({ error: 'Nie znaleziono użytkownika' })
    const token = signToken({ userId: payload.userId, username: user.username })
    await userQueries.updateStatus(payload.userId, 'online')
    res.cookie(AUTH_COOKIE, token, cookieOpts)
    return res.json({ token, user })
  } catch (err) {
    console.error('[auth/2fa/verify-login]', err)
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

    const lastChange = avatarRateMap.get(req.user!.userId) ?? 0
    if (Date.now() - lastChange < 60_000) {
      return res.status(429).json({ error: 'Możesz zmieniać avatar raz na minutę' })
    }
    avatarRateMap.set(req.user!.userId, Date.now())
    await execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar, req.user!.userId])

    const { invalidateUserProfile } = await import('../socket')
    invalidateUserProfile(req.user!.userId)
    return res.json({ avatarUrl: avatar })
  } catch (err) { console.error('[auth/avatar]', err); return res.status(500).json({ error: 'Błąd serwera' }) }
})

export default router
