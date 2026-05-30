import { Router, Request, Response } from 'express'
import { randomBytes } from 'crypto'
import { requireAuth } from '../middleware/auth'
import { serverQueries, memberQueries, channelQueries, roleQueries } from '../db/queries'
import { execute, queryOne, queryMany } from '../db/pool'
import { canModerate } from '../middleware/permissions'
import { v4 as uuidv4 } from 'uuid'
import { checkRaid } from './serverMod'

async function assignVerificationRole(userId: string, serverId: string): Promise<void> {
  try {
    const s = await queryOne<{ verification_enabled: number; verification_role_id: string }>(
      'SELECT verification_enabled, verification_role_id FROM server_mod_settings WHERE server_id = ?', [serverId]
    )
    if (!s?.verification_enabled || !s.verification_role_id) return
    await execute('INSERT IGNORE INTO member_roles (user_id, server_id, role_id) VALUES (?, ?, ?)',
      [userId, serverId, s.verification_role_id])
  } catch {}
}

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

    const { hasPermission: hasPerm, canModerate: canMod } = await import('../middleware/permissions')
    const canView    = await hasPerm(userId, serverId, 'VIEW_CHANNELS')
    const canModView = await canMod(userId, serverId, 'ADMINISTRATOR')
    const isOwner    = server.owner_id === userId
    const allVisible = canView ? allChannels : []
    let channels: any[]
    if (isOwner || canModView) {
      channels = allVisible
    } else {
      const canManageMsgs = await hasPerm(userId, serverId, 'MANAGE_MESSAGES')
      const visibleBase = canManageMsgs ? allVisible : allVisible.filter((c: any) => !c.mod_only)
      if (visibleBase.length > 0) {
        const channelIds = visibleBase.map((c: any) => c.id)
        const ph = channelIds.map(() => '?').join(',')
        const userRoles = await queryMany<{ role_id: string }>(
          'SELECT role_id FROM member_roles WHERE user_id = ? AND server_id = ?', [userId, serverId]
        )
        let deniedChannelIds = new Set<string>()
        if (userRoles.length > 0) {
          const roleIds = userRoles.map(r => r.role_id)
          const rolePh = roleIds.map(() => '?').join(',')
          const denied = await queryMany<{ channel_id: string }>(
            `SELECT channel_id FROM channel_role_permissions
             WHERE channel_id IN (${ph}) AND role_id IN (${rolePh}) AND deny_view = 1`,
            [...channelIds, ...roleIds]
          )
          deniedChannelIds = new Set(denied.map(d => d.channel_id))
        }
        channels = visibleBase.filter((c: any) => !deniedChannelIds.has(c.id))
      } else {
        channels = []
      }
    }

    return res.json({ server, channels, members, roles, memberCount, onlineCount })
  } catch (err: any) {
    console.error('[servers/get]', err?.message ?? err, { serverId: req.params.serverId, userId: req.user?.userId })
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

    const existingBan = await queryOne<{ reason: string }>(
      'SELECT reason FROM server_bans WHERE user_id = ? AND server_id = ?',
      [req.user!.userId, server.id]
    )
    if (existingBan) return res.status(403).json({ error: 'Jesteś zbanowany na tym serwerze' })

    const memberCount = await serverQueries.memberCount(server.id)
    if (memberCount >= server.member_limit) {
      return res.status(403).json({ error: 'Serwer jest pełny' })
    }

    await memberQueries.add(req.user!.userId, server.id)
    await assignVerificationRole(req.user!.userId, server.id)

    const { io } = await import('../index')
    checkRaid(server.id, io).catch(() => {})
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
    const ALLOWED_LOGO = ['data:image/jpeg;', 'data:image/jpg;', 'data:image/png;', 'data:image/gif;', 'data:image/webp;']
    if (!logo || !ALLOWED_LOGO.some(p => logo.startsWith(p))) return res.status(400).json({ error: 'Nieprawidłowy format (dozwolone: jpeg, png, gif, webp)' })
    if (logo.length > 10_000_000) return res.status(400).json({ error: 'Logo za duże (maks. 8MB przed kompresją)' })
    const { hasPermission: hasPerm } = await import('../middleware/permissions')
    const canManage = await hasPerm(req.user!.userId, serverId, 'MANAGE_SERVER')
    if (!canManage) return res.status(403).json({ error: 'Wymagane uprawnienie: Zarządzaj serwerem' })

    const { base64ToBuffer, saveIcon, deleteUpload } = await import('../lib/fileStorage')
    const parsed = base64ToBuffer(logo)
    if (!parsed) return res.status(400).json({ error: 'Nieprawidłowe dane obrazu' })

    const old = await queryOne<{ icon_url: string | null }>('SELECT icon_url FROM servers WHERE id = ?', [serverId])
    if (old?.icon_url && !old.icon_url.startsWith('data:')) deleteUpload(old.icon_url)

    const url = await saveIcon(parsed.buffer, parsed.mimeType)
    await execute('UPDATE servers SET icon_url = ? WHERE id = ?', [url, serverId])
    return res.json({ iconUrl: url })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

export default router

router.get('/:serverId/invites', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { hasPermission: hasPerm } = await import('../middleware/permissions')
    if (!await hasPerm(req.user!.userId, serverId, 'MANAGE_SERVER'))
      return res.status(403).json({ error: 'Brak uprawnień' })
    const invites = await queryMany<any>(
      `SELECT i.code, i.uses, i.max_uses, i.expires_at, i.created_at,
              u.username AS creator_username, u.display_name AS creator_display_name
       FROM invites i LEFT JOIN users u ON u.id = i.created_by
       WHERE i.server_id = ? ORDER BY i.created_at DESC`,
      [serverId]
    )
    return res.json({ invites })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.delete('/:serverId/invites/:code', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, code } = req.params
    const { hasPermission: hasPerm } = await import('../middleware/permissions')
    if (!await hasPerm(req.user!.userId, serverId, 'MANAGE_SERVER'))
      return res.status(403).json({ error: 'Brak uprawnień' })
    await execute('DELETE FROM invites WHERE code = ? AND server_id = ?', [code, serverId])
    return res.json({ ok: true })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

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
    return res.json({ server, alreadyMember })
  } catch (err) { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.post('/invite/:code/join', requireAuth, async (req: Request, res: Response) => {
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

    const inviteBan = await queryOne<{ reason: string }>(
      'SELECT reason FROM server_bans WHERE user_id = ? AND server_id = ?',
      [req.user!.userId, invite.server_id]
    )
    if (inviteBan) return res.status(403).json({ error: 'Jesteś zbanowany na tym serwerze' })

    await memberQueries.add(req.user!.userId, invite.server_id)
    await assignVerificationRole(req.user!.userId, invite.server_id)

    try {
      const { io } = await import('../index')
      checkRaid(invite.server_id, io).catch(() => {})
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

router.get('/:serverId/channels/:channelId/role-permissions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, channelId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'MANAGE_CHANNELS')) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    const ch = await queryOne<{ id: string }>('SELECT id FROM channels WHERE id = ? AND server_id = ?', [channelId, serverId])
    if (!ch) return res.status(404).json({ error: 'Kanał nie istnieje' })
    const perms = await queryMany<{ role_id: string; deny_view: number }>(
      'SELECT role_id, deny_view FROM channel_role_permissions WHERE channel_id = ?',
      [channelId]
    )
    return res.json({ permissions: perms })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.put('/:serverId/channels/:channelId/role-permissions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, channelId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'MANAGE_CHANNELS')) {
      return res.status(403).json({ error: 'Brak uprawnień' })
    }
    const ch = await queryOne<{ id: string }>('SELECT id FROM channels WHERE id = ? AND server_id = ?', [channelId, serverId])
    if (!ch) return res.status(404).json({ error: 'Kanał nie istnieje' })
    const { roleId, denyView } = req.body
    if (!roleId) return res.status(400).json({ error: 'Wymagane: roleId' })
    const roleCheck = await queryOne<{ id: string }>('SELECT id FROM roles WHERE id = ? AND server_id = ?', [roleId, serverId])
    if (!roleCheck) return res.status(404).json({ error: 'Rola nie istnieje' })
    if (denyView) {
      await execute(
        `INSERT INTO channel_role_permissions (channel_id, role_id, deny_view) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE deny_view = 1`,
        [channelId, roleId]
      )
    } else {
      await execute(
        'DELETE FROM channel_role_permissions WHERE channel_id = ? AND role_id = ?',
        [channelId, roleId]
      )
    }
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})
