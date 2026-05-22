import { Router, Request, Response } from 'express'
import { randomBytes } from 'crypto'
import { requireAuth } from '../middleware/auth'
import { serverQueries, memberQueries, channelQueries, roleQueries } from '../db/queries'
import { execute, queryOne, queryMany } from '../db/pool'
import { v4 as uuidv4 } from 'uuid'

function generateInviteCode(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const bytes = randomBytes(len)
  for (let i = 0; i < len; i++) code += chars[bytes[i] % chars.length]
  return code
}

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const servers = await serverQueries.forUser(req.user!.userId)
    return res.json({ servers })
  } catch (err) {
    console.error('[servers/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  return res.status(403).json({ error: 'Tworzenie serwerów jest tymczasowo wyłączone. Skontaktuj się z administracją.' })

  try {
    const { name, iconColor, description } = req.body

    if (!name?.trim() || name.length > 100) {
      return res.status(400).json({ error: 'Nazwa serwera musi mieć 1-100 znaków' })
    }

    const { id: serverId, inviteCode } = await serverQueries.create({
      name: name.trim(),
      ownerId: req.user!.userId,
      iconColor,
      description,
    })

    await memberQueries.add(req.user!.userId, serverId)

    const FIXED_ROLES = [
      { name: 'Administrator', color: '#f87171', position: 40, hoist: true,  mentionable: true,  permissions: ['ADMINISTRATOR','VIEW_CHANNELS','MANAGE_CHANNELS','MANAGE_ROLES','MANAGE_SERVER','KICK_MEMBERS','BAN_MEMBERS','MANAGE_INVITES','SEND_MESSAGES','EMBED_LINKS','ATTACH_FILES','ADD_REACTIONS','MENTION_EVERYONE','MANAGE_MESSAGES','READ_HISTORY','CONNECT','SPEAK','MUTE_MEMBERS','DEAFEN_MEMBERS','MOVE_MEMBERS','STREAM','USE_VOICE_ACTIVITY'] },
      { name: 'Moderator',     color: '#fb923c', position: 30, hoist: true,  mentionable: true,  permissions: ['VIEW_CHANNELS','KICK_MEMBERS','BAN_MEMBERS','MANAGE_INVITES','SEND_MESSAGES','EMBED_LINKS','ATTACH_FILES','ADD_REACTIONS','MANAGE_MESSAGES','READ_HISTORY','CONNECT','SPEAK','MUTE_MEMBERS','DEAFEN_MEMBERS','MOVE_MEMBERS','STREAM','USE_VOICE_ACTIVITY'] },
      { name: 'Członek',       color: '#60a5fa', position: 20, hoist: false, mentionable: false, permissions: ['VIEW_CHANNELS','SEND_MESSAGES','EMBED_LINKS','ATTACH_FILES','ADD_REACTIONS','READ_HISTORY','CONNECT','SPEAK','STREAM','USE_VOICE_ACTIVITY'] },
      { name: 'Do Weryfikacji',color: '#94a3b8', position: 10, hoist: false, mentionable: false, permissions: [] },
      { name: '@everyone',     color: '#a8a9af', position: 0,  hoist: false, mentionable: false, permissions: [] },
    ]

    let adminRoleId = ''
    for (const role of FIXED_ROLES) {
      const id = await roleQueries.create({
        serverId,
        name: role.name,
        color: role.color,
        permissions: role.permissions,
        position: role.position,
        hoist: role.hoist,
        mentionable: role.mentionable,
      })
      if (role.name === 'Administrator') adminRoleId = id
    }

    if (adminRoleId) {
      await memberQueries.assignRole(req.user!.userId, serverId, adminRoleId)
    }

    const catGeneralId = uuidv4()
    await require('../db/pool').execute(
      'INSERT INTO channel_categories (id, server_id, name, position) VALUES (?, ?, ?, ?)',
      [catGeneralId, serverId, 'Ogólne', 0]
    )
    const catVoiceId = uuidv4()
    await require('../db/pool').execute(
      'INSERT INTO channel_categories (id, server_id, name, position) VALUES (?, ?, ?, ?)',
      [catVoiceId, serverId, 'Voice', 1]
    )

    await channelQueries.create({ serverId, categoryId: catGeneralId, type: 'text',  name: 'ogólny',  position: 0 })
    await channelQueries.create({ serverId, categoryId: catGeneralId, type: 'text',  name: 'off-topic', position: 1 })
    await channelQueries.create({ serverId, categoryId: catVoiceId,   type: 'voice', name: 'Ogólny',  position: 2, bitrate: 128000 })

    const server = await serverQueries.findById(serverId)
    return res.status(201).json({ server, inviteCode })
  } catch (err) {
    console.error('[servers/create]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:serverId/permissions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { getUserPermissions } = await import('../middleware/permissions')
    const perms = await getUserPermissions(req.user!.userId, serverId)
    return res.json({ permissions: perms })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})
router.get('/:serverId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const userId = req.user!.userId

    const isMember = await memberQueries.isMember(userId, serverId)
    if (!isMember) return res.status(403).json({ error: 'Nie jesteś członkiem tego serwera' })

    const [server, allChannels, members, roles, memberCount, onlineCount] = await Promise.all([
      serverQueries.findById(serverId),
      channelQueries.forServer(serverId),
      memberQueries.list(serverId),
      roleQueries.forServer(serverId),
      serverQueries.memberCount(serverId),
      serverQueries.onlineCount(serverId),
    ])

    if (!server) return res.status(404).json({ error: 'Serwer nie znaleziony' })

    const { hasPermission: hasPerm } = await import('../middleware/permissions')
    const canView = await hasPerm(userId, serverId, 'VIEW_CHANNELS')
    const channels = canView ? allChannels : []

    return res.json({ server, channels, members, roles, memberCount, onlineCount })
  } catch (err) {
    console.error('[servers/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/join/:inviteCode', requireAuth, async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.params
    const server = await serverQueries.findByInviteCode(inviteCode)
    if (!server) return res.status(404).json({ error: 'Nieprawidłowy kod zaproszenia' })

    const isMember = await memberQueries.isMember(req.user!.userId, server.id)
    if (isMember) return res.status(409).json({ error: 'Już jesteś członkiem tego serwera' })

    const memberCount = await serverQueries.memberCount(server.id)
    if (memberCount >= server.member_limit) {
      return res.status(403).json({ error: 'Serwer jest pełny' })
    }

    await memberQueries.add(req.user!.userId, server.id)

    const { io } = await import('../index')
    const userInfo = await import('../db/queries').then(m =>
      m.userQueries.publicProfile(req.user!.userId)
    )
    io.to(`server:${server.id}`).emit('MEMBER_JOIN', {
      serverId: server.id,
      member: {
        user_id:      req.user!.userId,
        username:     req.user!.username,
        display_name: userInfo?.display_name ?? req.user!.username,
        avatar_url:   userInfo?.avatar_url   ?? null,
        avatar_color: userInfo?.avatar_color ?? '#64748b',
        status:       'online',
        nickname:     null,
        roles:        [],
      },
    })

    return res.json({ server })
  } catch (err) {
    console.error('[servers/join]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/leave', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const server = await serverQueries.findById(serverId)
    if (!server) return res.status(404).json({ error: 'Serwer nie znaleziony' })

    if (server.owner_id === req.user!.userId) {
      return res.status(403).json({ error: 'Właściciel nie może opuścić serwera. Przenieś własność lub usuń serwer.' })
    }

    await memberQueries.remove(req.user!.userId, serverId)

    const { io } = await import('../index')
    io.to(`server:${serverId}`).emit('MEMBER_LEAVE', {
      serverId,
      userId: req.user!.userId,
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[servers/leave]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:serverId/logo', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { logo } = req.body
    if (!logo?.startsWith('data:image/')) return res.status(400).json({ error: 'Nieprawidłowy format' })
    if (logo.length > 700000) return res.status(400).json({ error: 'Logo za duże (maks. 500KB)' })
    const { hasPermission: hasPerm } = await import('../middleware/permissions')
    const canManage = await hasPerm(req.user!.userId, serverId, 'MANAGE_SERVER')
    if (!canManage) return res.status(403).json({ error: 'Wymagane uprawnienie: Zarządzaj serwerem' })
    await execute('UPDATE servers SET icon_url = ? WHERE id = ?', [logo, serverId])
    return res.json({ iconUrl: logo })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

export default router

router.post('/:serverId/invites', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const isMember = await memberQueries.isMember(req.user!.userId, serverId)
    if (!isMember) return res.status(403).json({ error: 'Brak dostępu' })

    const code = generateInviteCode()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await execute(
      'INSERT INTO invites (code, server_id, created_by, expires_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)',
      [code, serverId, req.user!.userId, expiresAt]
    )
    return res.json({ code, expiresAt })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.get('/invite/:code', requireAuth, async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const invite = await queryOne<{ server_id: string; expires_at: string }>(
      'SELECT server_id, expires_at FROM invites WHERE code = ? AND expires_at > UTC_TIMESTAMP()',
      [code]
    )
    if (!invite) return res.status(404).json({ error: 'Link zaproszenia wygasł lub jest nieprawidłowy' })
    const server = await serverQueries.findById(invite.server_id)
    if (!server) return res.status(404).json({ error: 'Serwer nie istnieje' })
    const alreadyMember = await memberQueries.isMember(req.user!.userId, invite.server_id)
    if (alreadyMember) return res.json({ server, alreadyMember: true })
    await memberQueries.add(req.user!.userId, invite.server_id)

    try {
      const { io } = await import('../index')
      const userInfo = await import('../db/queries').then(m =>
        m.userQueries.publicProfile(req.user!.userId)
      )
      io.to(`server:${invite.server_id}`).emit('MEMBER_JOIN', {
        serverId: invite.server_id,
        member: {
          user_id:      req.user!.userId,
          username:     req.user!.username,
          display_name: userInfo?.display_name ?? req.user!.username,
          avatar_url:   userInfo?.avatar_url   ?? null,
          avatar_color: userInfo?.avatar_color ?? '#64748b',
          status:       'online',
          nickname:     null,
          roles:        [],
        },
      })
    } catch (broadcastErr) {
      console.error('[invite/join] MEMBER_JOIN broadcast failed:', broadcastErr)
    }

    return res.json({ server, alreadyMember: false })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.get('/:serverId/voice-state', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const isMember = await memberQueries.isMember(req.user!.userId, serverId)
    if (!isMember) return res.status(403).json({ error: 'Brak dostępu' })

    const rows = await queryMany<{ channel_id: string; user_id: string; display_name: string; avatar_color: string; avatar_url: string | null }>(
      `SELECT vs.channel_id, vs.user_id, u.display_name, u.avatar_color, u.avatar_url
       FROM voice_states vs
       INNER JOIN users u ON u.id = vs.user_id
       INNER JOIN channels c ON c.id = vs.channel_id
       WHERE c.server_id = ?`,
      [serverId]
    )

    const voiceState: Record<string, any[]> = {}
    for (const row of rows) {
      if (!voiceState[row.channel_id]) voiceState[row.channel_id] = []
      voiceState[row.channel_id].push({
        userId: row.user_id,
        displayName: row.display_name,
        avatarColor: row.avatar_color,
        avatarUrl: row.avatar_url,
      })
    }
    return res.json({ voiceState })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})
