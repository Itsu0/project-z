import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { serverQueries, memberQueries, channelQueries, roleQueries } from '../db/queries'
import { canModerate, getUserPermissions } from '../middleware/permissions'
import { v4 as uuidv4 } from 'uuid'
import { execute, queryMany } from '../db/pool'

const router = Router()

router.patch('/:serverId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { name, iconColor, description } = req.body
    const server = await serverQueries.findById(serverId)
    if (!server) return res.status(404).json({ error: 'Serwer nie znaleziony' })
    if (server.owner_id !== req.user!.userId) return res.status(403).json({ error: 'Tylko właściciel może edytować serwer' })

    const fields: string[] = []
    const values: unknown[] = []
    if (name)       { fields.push('name = ?');        values.push(name.trim()) }
    if (iconColor)  { fields.push('icon_color = ?');  values.push(iconColor) }
    if (description !== undefined) { fields.push('description = ?'); values.push(description) }
    if (fields.length) {
      values.push(serverId)
      await execute(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    const updated = await serverQueries.findById(serverId)
    return res.json({ server: updated })
  } catch (err) {
    console.error('[settings/patch-server]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:serverId/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const isMember = await memberQueries.isMember(req.user!.userId, serverId)
    if (!isMember) return res.status(403).json({ error: 'Brak dostępu' })
    const roles = await roleQueries.forServer(serverId)
    return res.json({ roles })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:serverId/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { name, color, permissions, hoist, mentionable } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Wymagana nazwa roli' })

    const canManageRoles = await canModerate(req.user!.userId, serverId, 'MANAGE_ROLES')
    if (!canManageRoles) return res.status(403).json({ error: 'Wymagane uprawnienie: Zarządzaj rolami' })

    const requesterIsAdmin = await canModerate(req.user!.userId, serverId, 'ADMINISTRATOR')
    if (!requesterIsAdmin && Array.isArray(permissions)) {
      const blocked = ['ADMINISTRATOR', 'MANAGE_ROLES']
      if (permissions.some((p: string) => blocked.includes(p))) {
        return res.status(403).json({ error: 'Tylko administrator może tworzyć role z takimi uprawnieniami' })
      }
    }

    const id = await roleQueries.create({ serverId, name: name.trim(), color, permissions, hoist, mentionable })
    const roles = await roleQueries.forServer(serverId)
    const role = roles.find(r => r.id === id)
    return res.status(201).json({ role })
  } catch (err) {
    console.error('[settings/create-role]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/roles/:roleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, roleId } = req.params
    const server = await serverQueries.findById(serverId)
    if (server?.owner_id !== req.user!.userId) return res.status(403).json({ error: 'Tylko właściciel może usuwać role' })
    await roleQueries.delete(roleId, serverId)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[settings/delete-role]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/members/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    const server = await serverQueries.findById(serverId)
    if (!server) return res.status(404).json({ error: 'Serwer nie znaleziony' })
    if (server.owner_id !== req.user!.userId) return res.status(403).json({ error: 'Tylko właściciel może wyrzucać członków' })
    if (userId === server.owner_id) return res.status(400).json({ error: 'Nie możesz wyrzucić właściciela' })
    await memberQueries.remove(userId, serverId)

    const { io } = await import('../index')
    io.to(`server:${serverId}`).emit('MEMBER_LEAVE', { serverId, userId })

    try {
      const { kickUserFromServer } = await import('../socket')
      kickUserFromServer(userId, serverId, 'KICKED')
    } catch {}

    return res.json({ ok: true })
  } catch (err) {
    console.error('[settings/kick-member]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:serverId/channels', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { name, type, topic, bitrate } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Wymagana nazwa kanału' })

    const isMember = await memberQueries.isMember(req.user!.userId, serverId)
    if (!isMember) return res.status(403).json({ error: 'Brak dostępu' })

    const canManage = await canModerate(req.user!.userId, serverId, 'MANAGE_CHANNELS')
    if (!canManage) return res.status(403).json({ error: 'Nie masz uprawnień do tworzenia kanałów' })

    const id = await channelQueries.create({ serverId, name: name.trim(), type: type ?? 'text', topic, bitrate })
    const channel = await channelQueries.findById(id)
    try {
      const { io } = await import('../index')
      io.to(`server:${serverId}`).emit('CHANNEL_CREATE', { serverId, channel })
    } catch {}
    return res.status(201).json({ channel })
  } catch (err) {
    console.error('[settings/create-channel]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/channels/:channelId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, channelId } = req.params
    const canManage = await canModerate(req.user!.userId, serverId, 'MANAGE_CHANNELS')
    if (!canManage) return res.status(403).json({ error: 'Wymagane uprawnienie: Zarządzaj kanałami' })
    await execute('DELETE FROM channels WHERE id = ? AND server_id = ?', [channelId, serverId])
    try {
      const { io } = await import('../index')
      io.to(`server:${serverId}`).emit('CHANNEL_DELETE', { serverId, channelId })
    } catch {}
    return res.json({ ok: true })
  } catch (err) {
    console.error('[settings/delete-channel]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/:serverId/channels/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { channels } = req.body
    if (!Array.isArray(channels)) return res.status(400).json({ error: 'Wymagana lista kanałów' })

    const canManage = await canModerate(req.user!.userId, serverId, 'MANAGE_CHANNELS')
    if (!canManage) return res.status(403).json({ error: 'Wymagane uprawnienie: Zarządzaj kanałami' })

    for (const ch of channels) {
      if (ch.id && typeof ch.position === 'number') {
        await execute('UPDATE channels SET position = ? WHERE id = ? AND server_id = ?', [ch.position, ch.id, serverId])
      }
    }

    const { io } = await import('../index')
    io.to(`server:${serverId}`).emit('CHANNELS_REORDER', { serverId, channels })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[settings/reorder-channels]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/:serverId/roles/:roleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, roleId } = req.params
    const { name, color, permissions, hoist, mentionable } = req.body
    const server = await serverQueries.findById(serverId)
    if (server?.owner_id !== req.user!.userId) return res.status(403).json({ error: 'Brak uprawnień' })

    const fields: string[] = []
    const values: unknown[] = []
    if (name !== undefined)        { fields.push('name = ?');        values.push(name) }
    if (color !== undefined)       { fields.push('color = ?');       values.push(color) }
    if (permissions !== undefined) { fields.push('permissions = ?'); values.push(JSON.stringify(permissions)) }
    if (hoist !== undefined)       { fields.push('hoist = ?');       values.push(hoist ? 1 : 0) }
    if (mentionable !== undefined) { fields.push('mentionable = ?'); values.push(mentionable ? 1 : 0) }

    if (fields.length) {
      values.push(roleId)
      values.push(serverId)
      await execute(`UPDATE roles SET ${fields.join(', ')} WHERE id = ? AND server_id = ?`, values)
    }
    const roles = await roleQueries.forServer(serverId)
    return res.json({ role: roles.find(r => r.id === roleId) })
  } catch (err) {
    console.error('[settings/update-role]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:serverId/members/:userId/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    if (!await memberQueries.isMember(req.user!.userId, serverId)) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }
    const roles = await memberQueries.roles(userId, serverId)
    return res.json({ roles })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:serverId/members/:userId/roles/:roleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId, roleId } = req.params
    const { canModerate } = await import('../middleware/permissions')
    const allowed = await canModerate(req.user!.userId, serverId, 'MANAGE_ROLES')
    if (!allowed) return res.status(403).json({ error: 'Brak uprawnień (wymagane MANAGE_ROLES)' })

    const requesterIsAdmin = await canModerate(req.user!.userId, serverId, 'ADMINISTRATOR')
    if (!requesterIsAdmin) {
      const { queryOne: qOne } = await import('../db/pool')
      const role = await qOne<{ permissions: string }>('SELECT permissions FROM roles WHERE id = ? AND server_id = ?', [roleId, serverId])
      if (role) {
        let rolePerms: string[] = []
        const raw = String(role.permissions ?? '')
        if (raw.startsWith('[')) {
          try { rolePerms = JSON.parse(raw) } catch {}
        } else {
          rolePerms = raw.split(',').map(s => s.trim()).filter(Boolean)
        }
        if (rolePerms.includes('ADMINISTRATOR') || rolePerms.includes('MANAGE_ROLES')) {
          return res.status(403).json({ error: 'Tylko administrator może nadawać tę rangę' })
        }
      }
    }
    const { queryOne: qOneAssign } = await import('../db/pool')
    const roleExists = await qOneAssign<{ id: string }>('SELECT id FROM roles WHERE id = ? AND server_id = ?', [roleId, serverId])
    if (!roleExists) return res.status(404).json({ error: 'Ranga nie istnieje na tym serwerze' })
    await memberQueries.assignRole(userId, serverId, roleId)

    const { io } = await import('../index')
    const roles = await memberQueries.roles(userId, serverId)
    io.to(`server:${serverId}`).emit('ROLE_UPDATE', { serverId, userId, roles })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/members/:userId/roles/:roleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId, roleId } = req.params
    const { canModerate } = await import('../middleware/permissions')
    const allowed = await canModerate(req.user!.userId, serverId, 'MANAGE_ROLES')
    if (!allowed) return res.status(403).json({ error: 'Brak uprawnień (wymagane MANAGE_ROLES)' })

    const requesterIsAdminDel = await canModerate(req.user!.userId, serverId, 'ADMINISTRATOR')
    if (!requesterIsAdminDel) {
      const { queryOne: qOneDel } = await import('../db/pool')
      const roleDel = await qOneDel<{ permissions: string }>('SELECT permissions FROM roles WHERE id = ? AND server_id = ?', [roleId, serverId])
      if (roleDel) {
        let rolePermsDel: string[] = []
        const rawDel = String(roleDel.permissions ?? '')
        if (rawDel.startsWith('[')) { try { rolePermsDel = JSON.parse(rawDel) } catch {} }
        else { rolePermsDel = rawDel.split(',').map(s => s.trim()).filter(Boolean) }
        if (rolePermsDel.includes('ADMINISTRATOR') || rolePermsDel.includes('MANAGE_ROLES')) {
          return res.status(403).json({ error: 'Tylko administrator może odebrać tę rangę' })
        }
      }
    }

    await memberQueries.removeRole(userId, serverId, roleId)

    const { io } = await import('../index')
    const roles = await memberQueries.roles(userId, serverId)
    io.to(`server:${serverId}`).emit('ROLE_UPDATE', { serverId, userId, roles })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})
router.get('/:serverId/emoji', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await memberQueries.isMember(req.user!.userId, serverId)) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }
    const emoji = await queryMany('SELECT * FROM custom_emoji WHERE server_id = ? ORDER BY created_at ASC', [serverId])
    return res.json({ emoji })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:serverId/emoji', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const { name, image } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Wymagana nazwa emoji' })
    if (!image?.startsWith('data:image/')) return res.status(400).json({ error: 'Wymagany obraz' })
    if (image.length > 400000) return res.status(400).json({ error: 'Emoji za duże (maks. ~256KB)' })
    if (!/^[a-z0-9_]+$/i.test(name.trim())) return res.status(400).json({ error: 'Nazwa może zawierać tylko litery, cyfry i _' })

    const canManage = await canModerate(req.user!.userId, serverId, 'MANAGE_SERVER')
    if (!canManage) return res.status(403).json({ error: 'Wymagane uprawnienie: Zarządzaj serwerem' })

    const existing = await queryMany('SELECT id FROM custom_emoji WHERE server_id = ?', [serverId])
    if (existing.length >= 50) return res.status(400).json({ error: 'Osiągnięto limit 50 emoji' })

    const duplicate = await queryMany('SELECT id FROM custom_emoji WHERE server_id = ? AND name = ?', [serverId, name.trim()])
    if (duplicate.length > 0) return res.status(400).json({ error: 'Emoji o tej nazwie już istnieje' })

    const id = uuidv4()

    await execute(
      'INSERT INTO custom_emoji (id, server_id, name, url, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [id, serverId, name.trim().toLowerCase(), image, req.user!.userId]
    )
    return res.status(201).json({ emoji: { id, server_id: serverId, name: name.trim().toLowerCase(), url: image, image, animated: image.includes('gif') } })
  } catch (err) {
    console.error('[settings/upload-emoji]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:serverId/emoji/:emojiId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, emojiId } = req.params
    const canManage = await canModerate(req.user!.userId, serverId, 'MANAGE_SERVER')
    if (!canManage) return res.status(403).json({ error: 'Wymagane uprawnienie: Zarządzaj serwerem' })
    await execute('DELETE FROM custom_emoji WHERE id = ? AND server_id = ?', [emojiId, serverId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
