// ── Provisioning serwera ──────────────────────────────────────────────────────
// Wspólna logika tworzenia serwera (role, kategorie, kanały) używana przez
// przepływ pakietów/płatności. Ustawia plan, member_limit i bitrate z katalogu.

import { v4 as uuidv4 } from 'uuid'
import { execute } from '../db/pool'
import { serverQueries, memberQueries, roleQueries, channelQueries } from '../db/queries'

const FIXED_ROLES = [
  { name: 'Administrator', color: '#f87171', position: 40, hoist: true,  mentionable: true,  permissions: ['ADMINISTRATOR','VIEW_CHANNELS','MANAGE_CHANNELS','MANAGE_ROLES','MANAGE_SERVER','KICK_MEMBERS','BAN_MEMBERS','MANAGE_INVITES','SEND_MESSAGES','EMBED_LINKS','ATTACH_FILES','ADD_REACTIONS','MENTION_EVERYONE','MANAGE_MESSAGES','READ_HISTORY','CONNECT','SPEAK','MUTE_MEMBERS','DEAFEN_MEMBERS','MOVE_MEMBERS','STREAM','USE_VOICE_ACTIVITY'] },
  { name: 'Moderator',     color: '#fb923c', position: 30, hoist: true,  mentionable: true,  permissions: ['VIEW_CHANNELS','KICK_MEMBERS','BAN_MEMBERS','MANAGE_INVITES','SEND_MESSAGES','EMBED_LINKS','ATTACH_FILES','ADD_REACTIONS','MANAGE_MESSAGES','READ_HISTORY','CONNECT','SPEAK','MUTE_MEMBERS','DEAFEN_MEMBERS','MOVE_MEMBERS','STREAM','USE_VOICE_ACTIVITY'] },
  { name: 'Członek',       color: '#60a5fa', position: 20, hoist: false, mentionable: false, permissions: ['VIEW_CHANNELS','SEND_MESSAGES','EMBED_LINKS','ATTACH_FILES','ADD_REACTIONS','READ_HISTORY','CONNECT','SPEAK','STREAM','USE_VOICE_ACTIVITY'] },
  { name: 'Do Weryfikacji',color: '#94a3b8', position: 10, hoist: false, mentionable: false, permissions: [] },
  { name: '@everyone',     color: '#a8a9af', position: 0,  hoist: false, mentionable: false, permissions: [] },
]

export interface ProvisionOpts {
  name:         string
  ownerId:      string
  memberLimit:  number   // liczba slotów
  voiceBitrate?: number  // bps (domyślnie 128 kbps)
  iconColor?:   string
  description?: string
}

export async function provisionServer(opts: ProvisionOpts): Promise<{ serverId: string; inviteCode: string }> {
  const { id: serverId, inviteCode } = await serverQueries.create({
    name: opts.name,
    ownerId: opts.ownerId,
    iconColor: opts.iconColor,
    description: opts.description,
  })

  // Ustaw limit slotów (pojemność serwera)
  await execute(
    'UPDATE servers SET member_limit = ? WHERE id = ?',
    [opts.memberLimit, serverId]
  )

  await memberQueries.add(opts.ownerId, serverId)

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
  if (adminRoleId) await memberQueries.assignRole(opts.ownerId, serverId, adminRoleId)

  const catGeneralId = uuidv4()
  await execute(
    'INSERT INTO channel_categories (id, server_id, name, position) VALUES (?, ?, ?, ?)',
    [catGeneralId, serverId, 'Ogólne', 0]
  )
  const catVoiceId = uuidv4()
  await execute(
    'INSERT INTO channel_categories (id, server_id, name, position) VALUES (?, ?, ?, ?)',
    [catVoiceId, serverId, 'Voice', 1]
  )

  await channelQueries.create({ serverId, categoryId: catGeneralId, type: 'text',  name: 'ogólny',    position: 0 })
  await channelQueries.create({ serverId, categoryId: catGeneralId, type: 'text',  name: 'off-topic', position: 1 })
  await channelQueries.create({ serverId, categoryId: catVoiceId,   type: 'voice', name: 'Ogólny',    position: 2, bitrate: opts.voiceBitrate ?? 128000 })

  return { serverId, inviteCode }
}
