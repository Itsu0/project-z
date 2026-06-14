import { queryMany, queryOne } from '../db/pool'

export async function getUserPermissions(userId: string, serverId: string): Promise<string[]> {
  const server = await queryOne<{ owner_id: string }>('SELECT owner_id FROM servers WHERE id = ?', [serverId])
  if (server?.owner_id === userId) return ['ADMINISTRATOR']

  const roles = await queryMany<{ permissions: string }>(
    `SELECT r.permissions FROM roles r
     INNER JOIN member_roles mr ON mr.role_id = r.id
     WHERE mr.user_id = ? AND mr.server_id = ?`,
    [userId, serverId]
  )

  const perms = new Set<string>()
  for (const role of roles) {
    const raw = String(role.permissions ?? '')
    if (!raw) continue

    if (!raw.startsWith('[')) {
      raw.split(',').map(s => s.trim()).filter(Boolean).forEach(x => perms.add(x))
    } else {
      try {
        let parsed = JSON.parse(raw)
        if (typeof parsed === 'string') parsed = JSON.parse(parsed)
        if (Array.isArray(parsed)) parsed.forEach(x => perms.add(x))
      } catch {}
    }
  }

  return Array.from(perms)
}

export async function hasPermission(userId: string, serverId: string, permission: string): Promise<boolean> {
  const perms = await getUserPermissions(userId, serverId)
  return perms.includes('ADMINISTRATOR') || perms.includes(permission)
}

export async function isOwner(userId: string, serverId: string): Promise<boolean> {
  const row = await queryOne<{ owner_id: string }>(
    'SELECT owner_id FROM servers WHERE id = ?', [serverId]
  )
  return row?.owner_id === userId
}

export async function canModerate(userId: string, serverId: string, permission: string): Promise<boolean> {
  return (await isOwner(userId, serverId)) || (await hasPermission(userId, serverId, permission))
}

export async function canViewChannel(userId: string, channelId: string): Promise<boolean> {
  const ch = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
  if (!ch) return false
  const admin = await canModerate(userId, ch.server_id, 'ADMINISTRATOR')
  if (admin) return true
  const denied = await queryOne<{ id: string }>(
    `SELECT crp.channel_id as id FROM channel_role_permissions crp
     INNER JOIN member_roles mr ON mr.role_id = crp.role_id
     WHERE crp.channel_id = ? AND mr.user_id = ? AND mr.server_id = ? AND crp.deny_view = 1
     LIMIT 1`,
    [channelId, userId, ch.server_id]
  )
  return !denied
}

export async function canSendInChannel(userId: string, channelId: string): Promise<boolean> {
  const ch = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
  if (!ch) return false
  // Właściciel/administrator zawsze może pisać (np. na ogłoszeniach).
  if (await canModerate(userId, ch.server_id, 'ADMINISTRATOR')) return true
  // Blokada pisania, gdy którakolwiek rola użytkownika ma deny_send na tym kanale.
  const denied = await queryOne<{ id: string }>(
    `SELECT crp.channel_id as id FROM channel_role_permissions crp
     INNER JOIN member_roles mr ON mr.role_id = crp.role_id
     WHERE crp.channel_id = ? AND mr.user_id = ? AND mr.server_id = ? AND crp.deny_send = 1
     LIMIT 1`,
    [channelId, userId, ch.server_id]
  )
  return !denied
}

export async function isMuted(userId: string, serverId: string): Promise<boolean> {
  const row = await queryOne<{ expires_at: string }>(
    'SELECT expires_at FROM server_mutes WHERE user_id = ? AND server_id = ? AND expires_at > UTC_TIMESTAMP()',
    [userId, serverId]
  )
  return !!row
}
