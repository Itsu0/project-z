import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth } from '../middleware/auth'
import { canModerate } from '../middleware/permissions'
import { queryOne, queryMany, execute } from '../db/pool'

const router = Router()

async function canAdmin(userId: string, serverId: string): Promise<boolean> {
  return canModerate(userId, serverId, 'ADMINISTRATOR')
}

// ─── Mod-log helper (exported for use in other routes) ───────

export async function logModAction(
  serverId: string,
  action: string,
  modId: string | null,
  targetId: string | null,
  reason: string | null,
  extra?: Record<string, any>
): Promise<void> {
  try {
    await execute(
      'INSERT INTO mod_action_log (id, server_id, action, mod_id, target_id, reason, extra) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid(), serverId, action, modId, targetId, reason, extra ? JSON.stringify(extra) : null]
    )
    const s = await queryOne<{ mod_log_channel_id: string }>(
      'SELECT mod_log_channel_id FROM server_mod_settings WHERE server_id = ?', [serverId]
    )
    if (s?.mod_log_channel_id) {
      await _postToModLog(serverId, s.mod_log_channel_id, action, modId, targetId, reason, extra)
    }
  } catch {}
}

async function _postToModLog(
  serverId: string, channelId: string, action: string,
  modId: string | null, targetId: string | null,
  reason: string | null, extra?: Record<string, any>
): Promise<void> {
  try {
    const [mod, target] = await Promise.all([
      modId   ? queryOne<{ display_name: string }>('SELECT display_name FROM users WHERE id = ?', [modId])   : null,
      targetId ? queryOne<{ display_name: string }>('SELECT display_name FROM users WHERE id = ?', [targetId]) : null,
    ])
    const LABELS: Record<string, string> = {
      MUTE: '🔇 Wyciszono', UNMUTE: '🔊 Odciszono',
      BAN: '🔨 Zbanowano', UNBAN: '✅ Odbanowano',
      KICK: '👢 Wyrzucono', WARN: '⚠️ Ostrzeżenie',
      BULK_DELETE: '🗑 Bulk delete', AUTOMOD: '🤖 AutoMod',
      RAID_LOCKDOWN: '🛡 Raid lockdown', STRIKE: '⚡ Strajk',
      MESSAGE_DELETE: '🗑 Usunięto wiadomość',
      FORUM_POST_DELETE: '🗑 Usunięto post forum',
    }
    let content = `${LABELS[action] ?? action}`
    if (target) content += ` · ${target.display_name}`
    if (mod)    content += ` (przez ${mod.display_name})`
    if (reason) content += ` — ${reason}`
    if (extra?.blockedContent) content += `\nTreść: "${extra.blockedContent}"`
    if (extra?.count) content += ` · ${extra.count} wiad.`

    const msgId = uuid()
    const owner = await queryOne<{ owner_id: string }>('SELECT owner_id FROM servers WHERE id = ?', [serverId])
    const authorId = modId ?? owner?.owner_id ?? serverId
    await execute(
      `INSERT INTO messages (id, channel_id, server_id, author_id, content, type, is_admin_msg)
       VALUES (?, ?, ?, ?, ?, 'DEFAULT', 1)`,
      [msgId, channelId, serverId, authorId, content]
    )
    const { getSocketInstance } = await import('../socket')
    const io = getSocketInstance()
    if (io) {
      io.to(`channel:${channelId}`).emit('MESSAGE_CREATE', {
        id: msgId, channel_id: channelId, server_id: serverId,
        author_id: authorId, author_display_name: 'Mod Log', author_username: 'modlog',
        author_avatar_color: 'linear-gradient(135deg,#f59e0b,#ef4444)', author_avatar_url: null,
        content, type: 'DEFAULT', is_admin_msg: true, pinned: false,
        created_at: new Date().toISOString(), edited_at: null, reactions: [], replyTo: null, attachments: [],
      })
    }
  } catch {}
}

// ─── Strike helper (exported) ────────────────────────────────

export async function addStrike(
  serverId: string, userId: string, reason: string,
  struckBy: string | null, auto: boolean
): Promise<void> {
  try {
    await execute(
      'INSERT INTO server_strikes (id, user_id, server_id, reason, struck_by, auto) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid(), userId, serverId, reason, struckBy, auto ? 1 : 0]
    )
    await logModAction(serverId, 'STRIKE', struckBy, userId, reason)

    const settings = await queryOne<{
      strike_1_action: string; strike_1_threshold: number
      strike_2_action: string; strike_2_threshold: number
      strike_3_action: string; strike_3_threshold: number
    }>('SELECT * FROM server_mod_settings WHERE server_id = ?', [serverId])
    if (!settings) return

    const cnt = await queryOne<{ n: number }>(
      'SELECT COUNT(*) as n FROM server_strikes WHERE user_id = ? AND server_id = ?', [userId, serverId]
    )
    const total = cnt?.n ?? 0

    let action: string | null = null
    if (total >= settings.strike_3_threshold)      action = settings.strike_3_action
    else if (total >= settings.strike_2_threshold) action = settings.strike_2_action
    else if (total >= settings.strike_1_threshold) action = settings.strike_1_action
    if (!action) return

    const server = await queryOne<{ owner_id: string }>('SELECT owner_id FROM servers WHERE id = ?', [serverId])
    const sysId  = server?.owner_id ?? userId

    if (action === 'mute') {
      const mins = 60
      await execute(
        `INSERT INTO server_mutes (user_id, server_id, muted_by, reason, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
         ON DUPLICATE KEY UPDATE reason = VALUES(reason), expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)`,
        [userId, serverId, sysId, `Auto-mute: ${total} strajków`, mins, mins]
      )
      const mute = await queryOne<any>('SELECT * FROM server_mutes WHERE user_id = ? AND server_id = ?', [userId, serverId])
      const { getSocketInstance } = await import('../socket')
      const io = getSocketInstance()
      if (io) io.to(`server:${serverId}`).emit('MEMBER_MUTED', {
        userId, serverId,
        expiresAt: mute?.expires_at ? mute.expires_at + 'Z' : null,
        reason: `Auto-mute: ${total} strajków`,
      })
    } else if (action === 'kick' || action === 'ban') {
      if (action === 'ban') {
        await execute(
          `INSERT INTO server_bans (user_id, server_id, banned_by, reason) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
          [userId, serverId, sysId, `Auto-ban: ${total} strajków`]
        )
      }
      const { memberQueries } = await import('../db/queries')
      await memberQueries.remove(userId, serverId)
      const { getSocketInstance, kickUserFromServer } = await import('../socket')
      const io = getSocketInstance()
      if (io) io.to(`server:${serverId}`).emit('MEMBER_LEAVE', { serverId, userId })
      kickUserFromServer(userId, serverId, action === 'ban' ? 'BANNED' : 'KICKED', `Auto-${action}: ${total} strajków`)
    }
    await logModAction(serverId, action.toUpperCase(), null, userId, `Auto: ${total} strajków`)
  } catch {}
}

// ─── AutoMod helper (exported) ───────────────────────────────

const spamTracker = new Map<string, number[]>()

export async function checkAutoMod(
  serverId: string, userId: string, channelId: string, content: string
): Promise<{ blocked: boolean; action: string; reason: string } | null> {
  try {
    const settings = await queryOne<{ automod_enabled: number }>(
      'SELECT automod_enabled FROM server_mod_settings WHERE server_id = ?', [serverId]
    )
    if (!settings?.automod_enabled) return null

    const rules = await queryMany<{
      id: string; type: string; value: string | null; action: string; enabled: number
    }>('SELECT * FROM automod_rules WHERE server_id = ? AND enabled = 1', [serverId])

    const lower = content.toLowerCase()

    for (const rule of rules) {
      if (rule.type === 'banned_word' && rule.value) {
        const words = rule.value.split(',').map(w => w.trim().toLowerCase()).filter(Boolean)
        if (words.some(w => lower.includes(w))) {
          return { blocked: true, action: rule.action, reason: `Zakazane słowo` }
        }
      }
      if (rule.type === 'caps') {
        const letters = content.replace(/[^a-zA-Z]/g, '')
        if (letters.length > 8) {
          const caps = letters.replace(/[^A-Z]/g, '').length
          if (caps / letters.length > 0.7) {
            return { blocked: true, action: rule.action, reason: `Nadużycie CAPS LOCK` }
          }
        }
      }
      if (rule.type === 'links') {
        if (/https?:\/\/|discord\.gg\//i.test(content)) {
          return { blocked: true, action: rule.action, reason: `Niedozwolony link` }
        }
      }
      if (rule.type === 'invites') {
        if (/discord\.gg\/|discord\.com\/invite\//i.test(content)) {
          return { blocked: true, action: rule.action, reason: `Niedozwolone zaproszenie Discord` }
        }
      }
      if (rule.type === 'spam') {
        const threshold = rule.value ? parseInt(rule.value) || 5 : 5
        const key = `${serverId}:${userId}`
        const now = Date.now()
        const times = (spamTracker.get(key) ?? []).filter(t => now - t < 5000)
        times.push(now)
        spamTracker.set(key, times)
        if (times.length >= threshold) {
          spamTracker.delete(key)
          return { blocked: true, action: rule.action, reason: `Spam (${times.length} wiad./5s)` }
        }
      }
    }
    return null
  } catch { return null }
}

// ─── Raid protection ─────────────────────────────────────────

const raidTracker = new Map<string, number[]>()
const raidLocked  = new Set<string>()

export async function checkRaid(serverId: string | null | undefined, io: any): Promise<void> {
  if (!serverId) return
  try {
    const settings = await queryOne<{
      raid_protection: number; raid_threshold: number; raid_window_secs: number
    }>('SELECT raid_protection, raid_threshold, raid_window_secs FROM server_mod_settings WHERE server_id = ?', [serverId])
    if (!settings?.raid_protection) return

    const now    = Date.now()
    const window = (settings.raid_window_secs ?? 30) * 1000
    const times  = (raidTracker.get(serverId) ?? []).filter(t => now - t < window)
    times.push(now)
    raidTracker.set(serverId, times)

    if (times.length >= (settings.raid_threshold ?? 10) && !raidLocked.has(serverId)) {
      raidLocked.add(serverId)
      setTimeout(() => raidLocked.delete(serverId), 10 * 60_000)

      io.to(`server:${serverId}`).emit('RAID_LOCKDOWN', {
        serverId, message: '🛡 Wykryto atak raid — serwer tymczasowo w trybie lockdown (10 min)',
      })
      const windowSecs = settings.raid_window_secs ?? 30
      await logModAction(serverId, 'RAID_LOCKDOWN', null, null,
        `Wykryto ${times.length} dołączeń w ${windowSecs}s`)
    }
  } catch {}
}

export function isRaidLocked(serverId: string): boolean {
  return raidLocked.has(serverId)
}

// ─── GET mod settings ────────────────────────────────────────

router.get('/:serverId/mod-settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await canAdmin(req.user!.userId, serverId)) return res.status(403).json({ error: 'Brak uprawnień' })
    const s = await queryOne('SELECT * FROM server_mod_settings WHERE server_id = ?', [serverId])
    return res.json({ settings: s ?? { server_id: serverId } })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.patch('/:serverId/mod-settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await canAdmin(req.user!.userId, serverId)) return res.status(403).json({ error: 'Brak uprawnień' })

    const f = req.body
    await execute(
      `INSERT INTO server_mod_settings (
         server_id, mod_log_channel_id, automod_enabled, raid_protection, raid_threshold,
         raid_window_secs, verification_enabled, verification_role_id,
         strike_1_action, strike_1_threshold, strike_2_action, strike_2_threshold,
         strike_3_action, strike_3_threshold
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         mod_log_channel_id   = IF(VALUES(mod_log_channel_id)   IS NOT NULL, VALUES(mod_log_channel_id),   mod_log_channel_id),
         automod_enabled      = IF(VALUES(automod_enabled)      IS NOT NULL, VALUES(automod_enabled),      automod_enabled),
         raid_protection      = IF(VALUES(raid_protection)      IS NOT NULL, VALUES(raid_protection),      raid_protection),
         raid_threshold       = IF(VALUES(raid_threshold)       IS NOT NULL, VALUES(raid_threshold),       raid_threshold),
         raid_window_secs     = IF(VALUES(raid_window_secs)     IS NOT NULL, VALUES(raid_window_secs),     raid_window_secs),
         verification_enabled = IF(VALUES(verification_enabled) IS NOT NULL, VALUES(verification_enabled), verification_enabled),
         verification_role_id = IF(VALUES(verification_role_id) IS NOT NULL, VALUES(verification_role_id), verification_role_id),
         strike_1_action      = IF(VALUES(strike_1_action)      IS NOT NULL, VALUES(strike_1_action),      strike_1_action),
         strike_1_threshold   = IF(VALUES(strike_1_threshold)   IS NOT NULL, VALUES(strike_1_threshold),   strike_1_threshold),
         strike_2_action      = IF(VALUES(strike_2_action)      IS NOT NULL, VALUES(strike_2_action),      strike_2_action),
         strike_2_threshold   = IF(VALUES(strike_2_threshold)   IS NOT NULL, VALUES(strike_2_threshold),   strike_2_threshold),
         strike_3_action      = IF(VALUES(strike_3_action)      IS NOT NULL, VALUES(strike_3_action),      strike_3_action),
         strike_3_threshold   = IF(VALUES(strike_3_threshold)   IS NOT NULL, VALUES(strike_3_threshold),   strike_3_threshold)`,
      [
        serverId,
        f.mod_log_channel_id   ?? null,
        f.automod_enabled      ?? null,
        f.raid_protection      ?? null,
        f.raid_threshold       ?? null,
        f.raid_window_secs     ?? null,
        f.verification_enabled ?? null,
        f.verification_role_id ?? null,
        f.strike_1_action      ?? null,
        f.strike_1_threshold   ?? null,
        f.strike_2_action      ?? null,
        f.strike_2_threshold   ?? null,
        f.strike_3_action      ?? null,
        f.strike_3_threshold   ?? null,
      ]
    )
    const updated = await queryOne<any>('SELECT * FROM server_mod_settings WHERE server_id = ?', [serverId])

    // Auto-create mod-log channel when automod enabled and no channel set yet
    let newChannel: any = null
    if (updated?.automod_enabled && !updated?.mod_log_channel_id) {
      try {
        const { v4: newId } = await import('uuid')
        const channelId = newId()

        // Find or create 'Moderacja' category
        let catRow = await queryOne<{ id: string }>(
          "SELECT id FROM channel_categories WHERE server_id = ? AND name = 'Moderacja' LIMIT 1", [serverId]
        )
        if (!catRow) {
          const catId = newId()
          const maxPos = await queryOne<{ m: number }>('SELECT COALESCE(MAX(position),0) as m FROM channel_categories WHERE server_id = ?', [serverId])
          await execute('INSERT INTO channel_categories (id, server_id, name, position) VALUES (?, ?, ?, ?)',
            [catId, serverId, 'Moderacja', (maxPos?.m ?? 0) + 1])
          catRow = { id: catId }
        }

        const maxPos = await queryOne<{ m: number }>('SELECT COALESCE(MAX(position),0) as m FROM channels WHERE server_id = ?', [serverId])
        await execute(
          'INSERT INTO channels (id, server_id, category_id, type, name, topic, position, mod_only) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          [channelId, serverId, catRow.id, 'text', 'mod-logi', 'Kanał tylko dla moderatorów i administratorów', (maxPos?.m ?? 0) + 1]
        )

        await execute('UPDATE server_mod_settings SET mod_log_channel_id = ? WHERE server_id = ?',
          [channelId, serverId])

        newChannel = { id: channelId, server_id: serverId, category_id: catRow.id, type: 'text', name: 'mod-logi', mod_only: 1 }

        // Emit socket event so channel appears immediately
        const { getSocketInstance } = await import('../socket')
        const io2 = getSocketInstance()
        if (io2) io2.to(`server:${serverId}`).emit('CHANNEL_CREATE', { serverId, channel: newChannel })
      } catch (e) {
        console.error('[serverMod/auto-modlog]', e)
      }
    }

    const finalSettings = await queryOne('SELECT * FROM server_mod_settings WHERE server_id = ?', [serverId])
    return res.json({ settings: finalSettings, newChannel })
  } catch (err) {
    console.error('[serverMod/settings]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── AutoMod rules ───────────────────────────────────────────

router.get('/:serverId/automod', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await canAdmin(req.user!.userId, serverId)) return res.status(403).json({ error: 'Brak uprawnień' })
    const rules = await queryMany('SELECT * FROM automod_rules WHERE server_id = ? ORDER BY created_at ASC', [serverId])
    return res.json({ rules })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.post('/:serverId/automod', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await canAdmin(req.user!.userId, serverId)) return res.status(403).json({ error: 'Brak uprawnień' })
    const { type, value, action } = req.body
    if (!type) return res.status(400).json({ error: 'Wymagany typ' })
    const id = uuid()
    await execute('INSERT INTO automod_rules (id, server_id, type, value, action) VALUES (?, ?, ?, ?, ?)',
      [id, serverId, type, value ?? null, action ?? 'delete'])
    const rule = await queryOne('SELECT * FROM automod_rules WHERE id = ?', [id])
    return res.status(201).json({ rule })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.patch('/:serverId/automod/:ruleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, ruleId } = req.params
    if (!await canAdmin(req.user!.userId, serverId)) return res.status(403).json({ error: 'Brak uprawnień' })
    const { enabled } = req.body
    await execute('UPDATE automod_rules SET enabled = ? WHERE id = ? AND server_id = ?', [enabled ? 1 : 0, ruleId, serverId])
    return res.json({ ok: true })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.delete('/:serverId/automod/:ruleId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, ruleId } = req.params
    if (!await canAdmin(req.user!.userId, serverId)) return res.status(403).json({ error: 'Brak uprawnień' })
    await execute('DELETE FROM automod_rules WHERE id = ? AND server_id = ?', [ruleId, serverId])
    return res.json({ ok: true })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

// ─── Strikes ─────────────────────────────────────────────────

router.get('/:serverId/strikes/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'KICK_MEMBERS'))
      return res.status(403).json({ error: 'Brak uprawnień' })
    const strikes = await queryMany(
      'SELECT * FROM server_strikes WHERE user_id = ? AND server_id = ? ORDER BY created_at DESC',
      [userId, serverId]
    )
    return res.json({ strikes, total: strikes.length })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.post('/:serverId/strikes/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, userId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'KICK_MEMBERS'))
      return res.status(403).json({ error: 'Brak uprawnień' })
    const { memberQueries: mq } = await import('../db/queries')
    if (!await mq.isMember(userId, serverId))
      return res.status(400).json({ error: 'Użytkownik nie jest członkiem serwera' })
    const { reason } = req.body
    if (!reason?.trim()) return res.status(400).json({ error: 'Wymagany powód' })
    await addStrike(serverId, userId, reason.trim(), req.user!.userId, false)
    const strikes = await queryMany(
      'SELECT * FROM server_strikes WHERE user_id = ? AND server_id = ? ORDER BY created_at DESC',
      [userId, serverId]
    )
    return res.status(201).json({ strikes, total: strikes.length })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

router.delete('/:serverId/strikes/:strikeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, strikeId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'KICK_MEMBERS'))
      return res.status(403).json({ error: 'Brak uprawnień' })
    await execute('DELETE FROM server_strikes WHERE id = ? AND server_id = ?', [strikeId, serverId])
    return res.json({ ok: true })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

// ─── Mod log ─────────────────────────────────────────────────

router.get('/:serverId/mod-log', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'KICK_MEMBERS'))
      return res.status(403).json({ error: 'Brak uprawnień' })
    const limit = Math.min(Number(req.query.limit ?? 50), 100)
    const logs = await queryMany(
      `SELECT l.*,
              mu.display_name as mod_name, mu.avatar_color as mod_avatar_color,
              tu.display_name as target_name, tu.avatar_color as target_avatar_color
       FROM mod_action_log l
       LEFT JOIN users mu ON mu.id = l.mod_id
       LEFT JOIN users tu ON tu.id = l.target_id
       WHERE l.server_id = ?
       ORDER BY l.created_at DESC
       LIMIT ${limit}`,
      [serverId]
    )
    return res.json({ logs })
  } catch { return res.status(500).json({ error: 'Błąd serwera' }) }
})

// ─── Bulk delete ─────────────────────────────────────────────

router.delete('/:serverId/channels/:channelId/messages/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, channelId } = req.params
    if (!await canModerate(req.user!.userId, serverId, 'MANAGE_MESSAGES'))
      return res.status(403).json({ error: 'Brak uprawnień' })
    const { queryOne: qOneBulk } = await import('../db/pool')
    const bulkCh = await qOneBulk<{ id: string }>('SELECT id FROM channels WHERE id = ? AND server_id = ?', [channelId, serverId])
    if (!bulkCh) return res.status(404).json({ error: 'Kanał nie istnieje' })
    const { messageIds } = req.body
    if (!Array.isArray(messageIds) || messageIds.length === 0)
      return res.status(400).json({ error: 'Wymagana lista ID' })
    const ids = messageIds.slice(0, 100).filter((id: any) => typeof id === 'string')
    if (!ids.length) return res.status(400).json({ error: 'Brak poprawnych ID' })

    const ph = ids.map(() => '?').join(',')
    await execute(`DELETE FROM messages WHERE id IN (${ph}) AND channel_id = ?`, [...ids, channelId])

    const { getSocketInstance } = await import('../socket')
    const io = getSocketInstance()
    if (io) io.to(`channel:${channelId}`).emit('MESSAGES_BULK_DELETE', { channelId, messageIds: ids })

    await logModAction(serverId, 'BULK_DELETE', req.user!.userId, null,
      `Usunięto ${ids.length} wiadomości`, { count: ids.length, channelId })

    return res.json({ ok: true, deleted: ids.length })
  } catch (err) {
    console.error('[serverMod/bulk-delete]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── Weryfikacja ─────────────────────────────────────────────

router.post('/:serverId/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params
    const userId = req.user!.userId

    const emailCheck = await queryOne<{ email_verified: number }>(
      'SELECT email_verified FROM users WHERE id = ?', [userId]
    )
    if (!emailCheck?.email_verified) {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' })
    }

    const settings = await queryOne<{ verification_enabled: number; verification_role_id: string }>(
      'SELECT verification_enabled, verification_role_id FROM server_mod_settings WHERE server_id = ?', [serverId]
    )
    if (!settings?.verification_enabled || !settings.verification_role_id)
      return res.status(400).json({ error: 'Weryfikacja nie jest włączona' })

    const member = await queryOne('SELECT user_id FROM server_members WHERE user_id = ? AND server_id = ?', [userId, serverId])
    if (!member) return res.status(404).json({ error: 'Nie jesteś członkiem' })

    await execute('DELETE FROM member_roles WHERE user_id = ? AND server_id = ? AND role_id = ?',
      [userId, serverId, settings.verification_role_id])

    const memberRole = await queryOne<{ id: string }>(
      `SELECT r.id FROM roles r WHERE r.server_id = ? AND r.id != ? ORDER BY r.position ASC LIMIT 1`,
      [serverId, settings.verification_role_id]
    )
    if (memberRole) {
      await execute('INSERT IGNORE INTO member_roles (user_id, server_id, role_id) VALUES (?, ?, ?)',
        [userId, serverId, memberRole.id])
    }

    const roles = await queryMany(
      'SELECT r.* FROM roles r JOIN member_roles mr ON mr.role_id = r.id WHERE mr.user_id = ? AND mr.server_id = ?',
      [userId, serverId]
    )
    const { getSocketInstance } = await import('../socket')
    const io = getSocketInstance()
    if (io) io.to(`server:${serverId}`).emit('ROLE_UPDATE', { serverId, userId, roles })

    return res.json({ ok: true })
  } catch (err) {
    console.error('[serverMod/verify]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
