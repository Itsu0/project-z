import { queryOne, queryMany, execute, pool } from './pool'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'crypto'

function genInviteCode(len = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const bytes = randomBytes(len)
  for (let i = 0; i < len; i++) code += chars[bytes[i] % chars.length]
  return code
}

export interface DbUser {
  id: string
  username: string
  display_name: string
  email: string
  password_hash: string
  avatar_url: string | null
  avatar_color: string
  status: 'online' | 'idle' | 'dnd' | 'offline'
  custom_status: string | null
  is_dev: number
  created_at: string
}

export interface DbServer {
  id: string
  name: string
  icon_url: string | null
  icon_color: string
  description: string | null
  owner_id: string
  plan: 'free' | 'standard' | 'pro'
  expires_at: string | null
  member_limit: number
  invite_code: string
  created_at: string
}

export interface DbChannel {
  id: string
  server_id: string
  category_id: string | null
  type: 'text' | 'voice' | 'announcement' | 'forum' | 'stage'
  name: string
  topic: string | null
  position: number
  bitrate: number
  user_limit: number
  last_message_id: string | null
}

export interface DbMessage {
  id: string
  channel_id: string
  server_id: string
  author_id: string
  content: string
  type: 'DEFAULT' | 'SYSTEM' | 'BOT_EMBED'
  pinned: number
  edited_at: string | null
  created_at: string

  author_username?: string
  author_display_name?: string
  author_avatar_url?: string | null
  author_avatar_color?: string
  author_status?: string
}

export interface DbRole {
  id: string
  server_id: string
  name: string
  color: string
  permissions: string
  position: number
  hoist: number
  mentionable: number
}

export const userQueries = {
  findById: (id: string) =>
    queryOne<DbUser>('SELECT * FROM users WHERE id = ?', [id]),

  findByEmail: (email: string) =>
    queryOne<DbUser>('SELECT * FROM users WHERE email = ?', [email]),

  findByUsername: (username: string) =>
    queryOne<DbUser>('SELECT * FROM users WHERE username = ?', [username]),

  create: async (data: {
    username: string
    displayName: string
    email: string
    passwordHash: string
    avatarColor?: string
  }) => {
    const id = uuidv4()
    await execute(
      `INSERT INTO users (id, username, display_name, email, password_hash, avatar_color)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.username, data.displayName, data.email, data.passwordHash, data.avatarColor ?? 'linear-gradient(135deg,#64748b,#475569)']
    )
    return id
  },

  updateStatus: (id: string, status: DbUser['status']) =>
    execute('UPDATE users SET status = ? WHERE id = ?', [status, id]),

  updateProfile: (id: string, data: { displayName?: string; customStatus?: string; avatarColor?: string }) => {
    const fields: string[] = []
    const values: unknown[] = []
    if (data.displayName)  { fields.push('display_name = ?');  values.push(data.displayName) }
    if (data.customStatus !== undefined) { fields.push('custom_status = ?'); values.push(data.customStatus) }
    if (data.avatarColor)  { fields.push('avatar_color = ?');  values.push(data.avatarColor) }
    if (!fields.length) return Promise.resolve()
    values.push(id)
    return execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
  },

  publicProfile: async (id: string) => {
    const row = await queryOne<Omit<DbUser, 'password_hash' | 'email'>>(
      `SELECT id, username, display_name,
              CASE WHEN LENGTH(avatar_url) > 512 THEN avatar_url ELSE NULL END AS avatar_url,
              avatar_color, status, custom_status, is_dev, created_at
       FROM users WHERE id = ?`,
      [id]
    )
    return row
  },
}

export const serverQueries = {
  findById: (id: string) =>
    queryOne<DbServer>('SELECT * FROM servers WHERE id = ?', [id]),

  findByInviteCode: (code: string) =>
    queryOne<DbServer>('SELECT * FROM servers WHERE invite_code = ?', [code]),

  create: async (data: {
    name: string
    ownerId: string
    iconColor?: string
    description?: string
  }) => {
    const id = uuidv4()
    const inviteCode = genInviteCode(12)
    await execute(
      `INSERT INTO servers (id, name, owner_id, icon_color, description, invite_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.ownerId, data.iconColor ?? 'linear-gradient(135deg,#dc2626,#f59e0b)', data.description ?? null, inviteCode]
    )
    return { id, inviteCode }
  },

  forUser: (userId: string) =>
    queryMany<DbServer>(
      `SELECT s.* FROM servers s
       INNER JOIN server_members sm ON sm.server_id = s.id
       WHERE sm.user_id = ?
       ORDER BY s.created_at ASC`,
      [userId]
    ),

  memberCount: async (serverId: string): Promise<number> => {
    const row = await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM server_members WHERE server_id = ?',
      [serverId]
    )
    return row?.cnt ?? 0
  },

  onlineCount: async (serverId: string): Promise<number> => {
    const row = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM server_members sm
       INNER JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = ? AND u.status != 'offline'`,
      [serverId]
    )
    return row?.cnt ?? 0
  },
}

export const memberQueries = {
  add: (userId: string, serverId: string) =>
    execute(
      'INSERT IGNORE INTO server_members (user_id, server_id) VALUES (?, ?)',
      [userId, serverId]
    ),

  remove: (userId: string, serverId: string) =>
    execute('DELETE FROM server_members WHERE user_id = ? AND server_id = ?', [userId, serverId]),

  isMember: async (userId: string, serverId: string): Promise<boolean> => {
    const row = await queryOne(
      'SELECT 1 FROM server_members WHERE user_id = ? AND server_id = ?',
      [userId, serverId]
    )
    return !!row
  },

  list: (serverId: string) =>
    queryMany<{
      user_id: string; username: string; display_name: string
      avatar_url: string | null; avatar_color: string; status: string
      custom_status: string | null; nickname: string | null; joined_at: string
      is_dev: number
    }>(
      `SELECT u.id as user_id, u.username, u.display_name,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS avatar_url,
              u.avatar_color, u.status, u.custom_status,
              u.is_dev, sm.nickname, sm.joined_at
       FROM server_members sm
       INNER JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = ?
       ORDER BY u.display_name ASC`,
      [serverId]
    ),

  roles: (userId: string, serverId: string) =>
    queryMany<DbRole>(
      `SELECT r.* FROM roles r
       INNER JOIN member_roles mr ON mr.role_id = r.id
       WHERE mr.user_id = ? AND mr.server_id = ?
       ORDER BY r.position DESC`,
      [userId, serverId]
    ),

  assignRole: (userId: string, serverId: string, roleId: string) =>
    execute(
      'INSERT IGNORE INTO member_roles (user_id, server_id, role_id) VALUES (?, ?, ?)',
      [userId, serverId, roleId]
    ),

  removeRole: (userId: string, serverId: string, roleId: string) =>
    execute(
      'DELETE FROM member_roles WHERE user_id = ? AND server_id = ? AND role_id = ?',
      [userId, serverId, roleId]
    ),
}

export const channelQueries = {
  findById: (id: string) =>
    queryOne<DbChannel>('SELECT * FROM channels WHERE id = ?', [id]),

  forServer: (serverId: string) =>
    queryMany<DbChannel>(
      `SELECT * FROM channels WHERE server_id = ?
       ORDER BY
         CASE type WHEN 'voice' THEN 1 ELSE 0 END ASC,
         position ASC,
         created_at ASC`,
      [serverId]
    ),

  create: async (data: {
    serverId: string
    categoryId?: string
    type?: DbChannel['type']
    name: string
    topic?: string
    position?: number
    bitrate?: number
    userLimit?: number
  }) => {
    const id = uuidv4()
    await execute(
      `INSERT INTO channels (id, server_id, category_id, type, name, topic, position, bitrate, user_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.serverId,
        data.categoryId ?? null,
        data.type ?? 'text',
        data.name,
        data.topic ?? null,
        data.position ?? 0,
        data.bitrate ?? 64000,
        data.userLimit ?? 0,
      ]
    )
    return id
  },

  updateLastMessage: (channelId: string, messageId: string) =>
    execute('UPDATE channels SET last_message_id = ? WHERE id = ?', [messageId, channelId]),
}

export const messageQueries = {
  findById: (id: string) =>
    queryOne<DbMessage>(
      `SELECT m.*, u.username as author_username, u.display_name as author_display_name,
              u.avatar_url as author_avatar_url, u.avatar_color as author_avatar_color,
              u.status as author_status,
              rm.id as reply_to_msg_id, rm.content as reply_to_content,
              ru.display_name as reply_to_author_name
       FROM messages m
       INNER JOIN users u ON u.id = m.author_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.author_id
       WHERE m.id = ?`,
      [id]
    ),

  forChannel: (channelId: string, limit = 50, beforeId?: string) => {
    const lim = String(Math.max(1, Math.min(100, Math.floor(Number(limit)) || 50)))
    if (beforeId) {
      return queryMany<DbMessage>(
        `SELECT m.*, u.username as author_username, u.display_name as author_display_name,
                u.avatar_url as author_avatar_url, u.avatar_color as author_avatar_color,
                u.status as author_status,
                rm.id as reply_to_msg_id, rm.content as reply_to_content,
                ru.display_name as reply_to_author_name
         FROM messages m
         INNER JOIN users u ON u.id = m.author_id
         LEFT JOIN messages rm ON rm.id = m.reply_to_id
         LEFT JOIN users ru ON ru.id = rm.author_id
         WHERE m.channel_id = ?
           AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)
         ORDER BY m.created_at DESC
         LIMIT ${lim}`,
        [channelId, beforeId]
      )
    }
    return queryMany<DbMessage>(
      `SELECT m.*, u.username as author_username, u.display_name as author_display_name,
              u.avatar_url as author_avatar_url, u.avatar_color as author_avatar_color,
              u.status as author_status,
              rm.id as reply_to_msg_id, rm.content as reply_to_content,
              ru.display_name as reply_to_author_name
       FROM messages m
       INNER JOIN users u ON u.id = m.author_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.author_id
       WHERE m.channel_id = ?
       ORDER BY m.created_at DESC
       LIMIT ${lim}`,
      [channelId]
    )
  },

  create: async (data: {
    channelId: string
    serverId: string
    authorId: string
    content: string
    type?: DbMessage['type']
  }) => {
    const id = uuidv4()
    await execute(
      `INSERT INTO messages (id, channel_id, server_id, author_id, content, type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.channelId, data.serverId, data.authorId, data.content, data.type ?? 'DEFAULT']
    )

    await channelQueries.updateLastMessage(data.channelId, id)
    return id
  },

  update: (id: string, content: string) =>
    execute(
      'UPDATE messages SET content = ?, edited_at = NOW() WHERE id = ?',
      [content, id]
    ),

  delete: (id: string) =>
    execute('DELETE FROM messages WHERE id = ?', [id]),

  unreadCount: async (userId: string, channelId: string): Promise<number> => {
    const row = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM messages m
       WHERE m.channel_id = ?
         AND m.author_id != ?
         AND m.created_at > COALESCE(
           (SELECT last_read_at FROM channel_reads WHERE user_id = ? AND channel_id = ?),
           '2000-01-01'
         )`,
      [channelId, userId, userId, channelId]
    )
    return row?.cnt ?? 0
  },

  markRead: (userId: string, channelId: string, messageId: string) =>
    execute(
      `INSERT INTO channel_reads (user_id, channel_id, last_read_id, last_read_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_read_id = ?, last_read_at = NOW()`,
      [userId, channelId, messageId, messageId]
    ),
}

export const reactionQueries = {
  add: (messageId: string, userId: string, emoji: string) =>
    execute(
      'INSERT IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
      [messageId, userId, emoji]
    ),

  remove: (messageId: string, userId: string, emoji: string) =>
    execute(
      'DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [messageId, userId, emoji]
    ),

  forMessage: (messageId: string, currentUserId: string) =>
    queryMany<{ emoji: string; count: number; user_reacted: number }>(
      `SELECT emoji,
              COUNT(*) as count,
              MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
       FROM reactions
       WHERE message_id = ?
       GROUP BY emoji
       ORDER BY MIN(created_at) ASC`,
      [currentUserId, messageId]
    ),

  forMessages: (messageIds: string[], currentUserId: string) => {
    if (messageIds.length === 0) return Promise.resolve([])
    const placeholders = messageIds.map(() => '?').join(',')
    return queryMany<{ message_id: string; emoji: string; count: number; user_reacted: number }>(
      `SELECT message_id, emoji,
              COUNT(*) as count,
              MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as user_reacted
       FROM reactions
       WHERE message_id IN (${placeholders})
       GROUP BY message_id, emoji
       ORDER BY MIN(created_at) ASC`,
      [currentUserId, ...messageIds]
    )
  },
}

export const roleQueries = {
  forServer: (serverId: string) =>
    queryMany<DbRole>(
      'SELECT * FROM roles WHERE server_id = ? ORDER BY position DESC',
      [serverId]
    ),

  create: async (data: {
    serverId: string
    name: string
    color?: string
    permissions?: string[]
    position?: number
    hoist?: boolean
    mentionable?: boolean
  }) => {
    const id = uuidv4()
    await execute(
      `INSERT INTO roles (id, server_id, name, color, permissions, position, hoist, mentionable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.serverId, data.name,
        data.color ?? '#a8a9af',
        JSON.stringify(data.permissions ?? []),
        data.position ?? 0,
        data.hoist ? 1 : 0,
        data.mentionable ? 1 : 0,
      ]
    )
    return id
  },

  delete: (id: string) =>
    execute('DELETE FROM roles WHERE id = ?', [id]),
}
