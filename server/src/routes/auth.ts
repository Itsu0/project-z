import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { userQueries, serverQueries } from '../db/queries'
import { signToken, requireAuth, getClientIp, recordIp } from '../middleware/auth'
import { execute } from '../db/pool'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, displayName, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Wymagane pola: username, email, password' })
    }

    if (username.length < 2 || username.length > 32) {
      return res.status(400).json({ error: 'Nazwa użytkownika musi mieć 2-32 znaków' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Hasło musi mieć minimum 8 znaków' })
    }

    const existingEmail    = await userQueries.findByEmail(email)
    const existingUsername = await userQueries.findByUsername(username)

    if (existingEmail)    return res.status(409).json({ error: 'Email już zajęty' })
    if (existingUsername) return res.status(409).json({ error: 'Nazwa użytkownika już zajęta' })

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = await userQueries.create({
      username,
      displayName: displayName ?? username,
      email,
      passwordHash,
    })

    const token = signToken({ userId, username })
    const user  = await userQueries.publicProfile(userId)

    recordIp(userId, getClientIp(req)).catch(() => {})
    return res.status(201).json({ token, user })
  } catch (err) {
    console.error('[auth/register]', err)
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

    const { emitToUser } = await import('../socket')
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
