import { Router, Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import os from 'os'
import { promises as fs, createReadStream } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'
import { emitToUser, kickUserFromPlatform } from '../socket/index'
import { RoomServiceClient } from 'livekit-server-sdk'

const execFileP = promisify(execFile)
const router = Router()

// Próbka obciążenia CPU w oknie ~200 ms (różnica liczników z os.cpus())
function cpuSnapshot(): { idle: number; total: number } {
  let idle = 0, total = 0
  for (const c of os.cpus()) {
    for (const t of Object.values(c.times)) total += t
    idle += c.times.idle
  }
  return { idle, total }
}
function measureCpu(ms = 200): Promise<number> {
  const a = cpuSnapshot()
  return new Promise(resolve => {
    setTimeout(() => {
      const b = cpuSnapshot()
      const idle = b.idle - a.idle
      const total = b.total - a.total
      resolve(total > 0 ? Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100))) : 0)
    }, ms)
  })
}

async function isCreator(userId: string): Promise<boolean> {
  const row = await queryOne<{ is_dev: number; is_creator: number }>(
    'SELECT is_dev, COALESCE(is_creator, 0) AS is_creator FROM users WHERE id = ?', [userId]
  )
  if (!row) return false
  if (row.is_dev) return true
  if (row.is_creator) return true
  const first = await queryOne<{ id: string }>('SELECT id FROM users ORDER BY created_at ASC LIMIT 1')
  if (first?.id === userId) {
    await queryOne('UPDATE users SET is_creator = 1 WHERE id = ?', [userId]).catch(() => {})
    return true
  }
  return false
}

async function isModerator(userId: string): Promise<boolean> {
  if (await isCreator(userId)) return true
  const mod = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = ? AND is_mod = 1', [userId])
  return !!mod
}

async function requireCreator(req: Request, res: Response): Promise<boolean> {
  if (!(await isCreator(req.user!.userId))) {
    res.status(403).json({ error: 'Brak uprawnień' })
    return false
  }
  return true
}

async function requireStaff(req: Request, res: Response): Promise<boolean> {
  if (!(await isModerator(req.user!.userId))) {
    res.status(403).json({ error: 'Brak uprawnień' })
    return false
  }
  return true
}

router.get('/bans', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const bans = await queryMany(
      `SELECT b.*, u.username, u.display_name, u.avatar_color, u.avatar_url
       FROM user_bans b
       JOIN users u ON u.id = b.user_id
       WHERE b.expires_at IS NULL OR b.expires_at > NOW()
       ORDER BY b.created_at DESC`
    )
    return res.json({ bans })
  } catch (err) {
    console.error('[admin/bans]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/bans', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { userId, reason, days, banIps } = req.body
    if (!userId || !reason?.trim())
      return res.status(400).json({ error: 'Wymagane: userId, reason' })

    const banTarget = await queryOne<{ is_dev: number; is_creator: number }>(
      'SELECT is_dev, COALESCE(is_creator, 0) AS is_creator FROM users WHERE id = ?', [userId]
    )
    if (banTarget?.is_dev || banTarget?.is_creator) {
      return res.status(403).json({ error: 'Nie można zbanować administratora platformy' })
    }

    await execute('DELETE FROM user_bans WHERE user_id = ?', [userId])

    const expiresAt = days ? new Date(Date.now() + days * 86400_000) : null
    const id = uuid()
    await execute(
      'INSERT INTO user_bans (id, user_id, banned_by, reason, expires_at) VALUES (?, ?, ?, ?, ?)',
      [id, userId, req.user!.userId, reason.trim(), expiresAt]
    )

    if (banIps) {
      const ips = await queryMany<{ ip: string }>('SELECT ip FROM user_ips WHERE user_id = ?', [userId])
      for (const { ip } of ips) {
        const ipId = uuid()
        await execute(
          `INSERT INTO banned_ips (id, ip, reason, banned_by) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
          [ipId, ip, reason.trim(), req.user!.userId]
        )
      }
    }

    const ban = await queryOne('SELECT * FROM user_bans WHERE id = ?', [id])

    // Natychmiastowe rozłączenie aktywnych socketów
    kickUserFromPlatform(userId, reason.trim())

    return res.status(201).json({ ban })
  } catch (err) {
    console.error('[admin/ban]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/bans/:userId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    await execute('DELETE FROM user_bans WHERE user_id = ?', [req.params.userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/warnings/:userId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const warnings = await queryMany(
      'SELECT * FROM user_warnings WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.userId]
    )
    return res.json({ warnings })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/warnings', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { userId, reason } = req.body
    if (!userId || !reason?.trim())
      return res.status(400).json({ error: 'Wymagane: userId, reason' })

    const id = uuid()
    await execute(
      'INSERT INTO user_warnings (id, user_id, warned_by, reason) VALUES (?, ?, ?, ?)',
      [id, userId, req.user!.userId, reason.trim()]
    )
    const warning = await queryOne('SELECT * FROM user_warnings WHERE id = ?', [id])

    emitToUser(userId, 'WARNING_RECEIVED', {
      id,
      reason: reason.trim(),
      created_at: (warning as any)?.created_at ?? new Date().toISOString(),
    })

    return res.status(201).json({ warning })
  } catch (err) {
    console.error('[admin/warn]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/warnings/:id', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    await execute('DELETE FROM user_warnings WHERE id = ?', [req.params.id])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/ghost/:serverId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { serverId } = req.params

    const [server, categories, channels, members, roles, memberCount] = await Promise.all([
      queryOne(
        `SELECT s.*, u.display_name as owner_name, u.avatar_color as owner_avatar_color,
                u.avatar_url as owner_avatar_url
         FROM servers s JOIN users u ON u.id = s.owner_id
         WHERE s.id = ?`, [serverId]
      ),
      queryMany(
        `SELECT * FROM channel_categories WHERE server_id = ? ORDER BY position ASC`,
        [serverId]
      ),
      queryMany(
        `SELECT c.*
         FROM channels c
         WHERE c.server_id = ?
         ORDER BY c.position ASC`, [serverId]
      ),
      queryMany(
        `SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_url,
                u.status, u.custom_status, sm.nickname, sm.joined_at,
                (SELECT GROUP_CONCAT(mr.role_id) FROM member_roles mr
                 WHERE mr.user_id = u.id AND mr.server_id = sm.server_id) as role_ids
         FROM server_members sm
         JOIN users u ON u.id = sm.user_id
         WHERE sm.server_id = ?
         ORDER BY
           FIELD(u.status, 'online', 'idle', 'dnd', 'offline'),
           u.display_name ASC`, [serverId]
      ),
      queryMany('SELECT * FROM roles WHERE server_id = ? ORDER BY position DESC', [serverId]),
      queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM server_members WHERE server_id = ?', [serverId]),
    ])

    if (!server) return res.status(404).json({ error: 'Serwer nie znaleziony' })

    return res.json({
      server, categories, channels, members, roles,
      memberCount: memberCount?.cnt ?? 0,
      ghost: true,
    })
  } catch (err) {
    console.error('[admin/ghost]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/ghost/:serverId/messages/:channelId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { serverId, channelId } = req.params
    const limit    = Math.max(1, Math.min(Number(req.query.limit ?? 50) || 50, 100)) | 0
    const chCheck = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!chCheck || chCheck.server_id !== serverId) return res.status(404).json({ error: 'Kanał nie istnieje' })
    const beforeId = req.query.before as string | undefined

    let beforeDate: string | null = null
    if (beforeId) {
      const ref = await queryOne<{ created_at: string }>(
        'SELECT created_at FROM messages WHERE id = ?', [beforeId]
      )
      beforeDate = ref?.created_at ?? null
    }

    const messages = await queryMany(
      `SELECT m.*, u.display_name as author_name, u.avatar_color, u.avatar_url, u.username,
              r.display_name as reply_author_name, rm.content as reply_content
       FROM messages m
       JOIN users u ON u.id = m.author_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users r ON r.id = rm.author_id
       WHERE m.channel_id = ?
       ${beforeDate ? 'AND m.created_at < ?' : ''}
       ORDER BY m.created_at DESC
       LIMIT ${limit}`,
      beforeDate ? [channelId, beforeDate] : [channelId]
    )

    return res.json({ messages: messages.reverse(), hasMore: messages.length === limit })
  } catch (err) {
    console.error('[admin/ghost/messages]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/warning-replies', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const replies = await queryMany(
      `SELECT w.*, u.display_name, u.username, u.avatar_color, u.avatar_url
       FROM user_warnings w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_reply IS NOT NULL
       ORDER BY w.reply_at DESC`
    )
    return res.json({ replies })
  } catch (err) {
    console.error('[admin/warning-replies]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/all', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const users = await queryMany(
      `SELECT id, username, display_name, avatar_color, avatar_url, is_dev, is_mod
       FROM users
       ORDER BY display_name ASC`
    )
    return res.json({ users })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/users/:userId/dev', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const { isDev } = req.body
    await execute('UPDATE users SET is_dev = ? WHERE id = ?', [isDev ? 1 : 0, req.params.userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/users/:userId/mod', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const { isMod } = req.body
    await execute('UPDATE users SET is_mod = ? WHERE id = ?', [isMod ? 1 : 0, req.params.userId])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/search', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const q = `%${(req.query.q as string) ?? ''}%`
    const users = await queryMany(
      `SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_url, u.email,
              u.created_at, u.status,
              (SELECT COUNT(*) FROM user_bans b
               WHERE b.user_id = u.id AND (b.expires_at IS NULL OR b.expires_at > NOW())) as is_banned,
              (SELECT COUNT(*) FROM user_warnings w WHERE w.user_id = u.id) as warning_count
       FROM users u
       WHERE u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?
       ORDER BY u.created_at DESC
       LIMIT 20`,
      [q, q, q]
    )
    return res.json({ users })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/:userId/servers', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const servers = await queryMany(
      `SELECT s.id, s.name, s.icon_color, s.icon_url, sm.joined_at,
              u.display_name as owner_name
       FROM server_members sm
       JOIN servers s ON s.id = sm.server_id
       JOIN users u ON u.id = s.owner_id
       WHERE sm.user_id = ?
       ORDER BY sm.joined_at DESC`,
      [req.params.userId]
    )
    return res.json({ servers })
  } catch (err) {
    console.error('[admin/users/servers]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/:userId', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const { userId } = req.params
    const [user, bans, warnings] = await Promise.all([
      queryOne(
        `SELECT id, username, display_name, avatar_color, avatar_url, email, status, created_at
         FROM users WHERE id = ?`, [userId]
      ),
      queryMany(
        `SELECT * FROM user_bans WHERE user_id = ? ORDER BY created_at DESC`, [userId]
      ),
      queryMany(
        `SELECT * FROM user_warnings WHERE user_id = ? ORDER BY created_at DESC`, [userId]
      ),
    ])
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' })
    return res.json({ user, bans, warnings })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/users/:userId/ips', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const ips = await queryMany(
      `SELECT ip, first_seen, last_seen,
              (SELECT COUNT(*) FROM banned_ips b WHERE b.ip = ui.ip) as is_banned
       FROM user_ips ui
       WHERE user_id = ?
       ORDER BY last_seen DESC`,
      [req.params.userId]
    )
    return res.json({ ips })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/banned-ips', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const ips = await queryMany(
      `SELECT b.*, u.display_name as banned_by_name
       FROM banned_ips b
       JOIN users u ON u.id = b.banned_by
       ORDER BY b.created_at DESC`
    )
    return res.json({ ips })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/ban-ip', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { ip, reason } = req.body
    if (!ip?.trim() || !reason?.trim())
      return res.status(400).json({ error: 'Wymagane: ip, reason' })
    const id = uuid()
    await execute(
      `INSERT INTO banned_ips (id, ip, reason, banned_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by)`,
      [id, ip.trim(), reason.trim(), req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/ban-ip/:ip', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    await execute('DELETE FROM banned_ips WHERE ip = ?', [decodeURIComponent(req.params.ip)])
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/ghost/:serverId/channels/:channelId/message', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireStaff(req, res))) return
  try {
    const { serverId, channelId } = req.params
    const { content } = req.body
    if (!content?.trim() || content.length > 2000)
      return res.status(400).json({ error: 'Wymagana treść (maks. 2000 znaków)' })

    const channel = await queryOne<{ id: string }>('SELECT id FROM channels WHERE id = ? AND server_id = ?', [channelId, serverId])
    if (!channel) return res.status(404).json({ error: 'Kanał nie znaleziony' })

    const id = uuid()
    const now = new Date()
    await execute(
      `INSERT INTO messages (id, channel_id, server_id, author_id, content, type, is_admin_msg)
       VALUES (?, ?, ?, ?, ?, 'DEFAULT', 1)`,
      [id, channelId, serverId, req.user!.userId, content.trim()]
    )

    const { getSocketInstance } = await import('../socket')
    const io = getSocketInstance()
    if (io) {
      io.to(`channel:${channelId}`).emit('MESSAGE_CREATE', {
        id,
        channel_id: channelId,
        server_id: serverId,
        author_id: req.user!.userId,
        author_display_name: 'Administrator Aplikacji',
        author_username: 'admin',
        author_avatar_color: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
        author_avatar_url: null,
        content: content.trim(),
        type: 'DEFAULT',
        is_admin_msg: true,
        pinned: false,
        created_at: now.toISOString(),
        edited_at: null,
        reactions: [],
        replyTo: null,
        attachments: [],
      })
    }

    return res.json({ ok: true, messageId: id })
  } catch (err) {
    console.error('[admin/ghost/message]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── MONITORING (live metryki serwera) ────────────────────────────────────────

const BACKUP_DIR = process.env.BACKUP_DIR ?? '/opt/nexus/backups'

router.get('/monitor', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    // CPU (próbka) + load average
    const cpuPct = await measureCpu(200)
    const load = os.loadavg()             // [1m, 5m, 15m]
    const cores = os.cpus().length

    // RAM
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const memPct = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0

    // Dysk (df -P -k /) — w KB
    let disk: { total: number; used: number; available: number; pct: number } | null = null
    try {
      const { stdout } = await execFileP('df', ['-P', '-k', '/'], { timeout: 4000 })
      const line = stdout.trim().split('\n').pop() ?? ''
      const cols = line.split(/\s+/)
      if (cols.length >= 5) {
        const totalK = Number(cols[1]) * 1024
        const usedK = Number(cols[2]) * 1024
        const availK = Number(cols[3]) * 1024
        const pct = parseInt(cols[4], 10) || 0
        disk = { total: totalK, used: usedK, available: availK, pct }
      }
    } catch {}

    // Baza danych — ping i latencja
    let db: { online: boolean; latencyMs: number | null } = { online: false, latencyMs: null }
    try {
      const t0 = Date.now()
      await queryOne('SELECT 1 AS ok')
      db = { online: true, latencyMs: Date.now() - t0 }
    } catch {}

    // Ostatni backup — najnowszy plik w katalogu kopii zapasowych
    let backup: { exists: boolean; file: string | null; sizeBytes: number | null; ageHours: number | null; mtime: string | null } =
      { exists: false, file: null, sizeBytes: null, ageHours: null, mtime: null }
    try {
      const files = await fs.readdir(BACKUP_DIR)
      const dumps = files.filter(f => f.startsWith('nexus_') && f.endsWith('.sql.gz'))
      let newest: { name: string; mtimeMs: number; size: number } | null = null
      for (const name of dumps) {
        const st = await fs.stat(`${BACKUP_DIR}/${name}`)
        if (!newest || st.mtimeMs > newest.mtimeMs) newest = { name, mtimeMs: st.mtimeMs, size: st.size }
      }
      if (newest) {
        backup = {
          exists: true,
          file: newest.name,
          sizeBytes: newest.size,
          ageHours: Math.round(((Date.now() - newest.mtimeMs) / 3_600_000) * 10) / 10,
          mtime: new Date(newest.mtimeMs).toISOString(),
        }
      } else {
        backup.exists = false
      }
    } catch {}

    // Progi alertów (spójne ze skryptem monitorującym na VPS)
    const thresholds = { cpu: 80, ram: 90, disk: 85, backupMaxHours: 26 }

    return res.json({
      timestamp: new Date().toISOString(),
      host: os.hostname(),
      backend: {
        online: true,
        nodeVersion: process.version,
        processUptimeSec: Math.round(process.uptime()),
        systemUptimeSec: Math.round(os.uptime()),
        rssBytes: process.memoryUsage().rss,
      },
      cpu: { pct: cpuPct, cores, load1: +load[0].toFixed(2), load5: +load[1].toFixed(2), load15: +load[2].toFixed(2) },
      memory: { totalBytes: totalMem, usedBytes: usedMem, freeBytes: freeMem, pct: memPct },
      disk,
      db,
      backup,
      thresholds,
    })
  } catch (err) {
    console.error('[admin/monitor]', err)
    return res.status(500).json({ error: 'Błąd serwera podczas pobierania metryk' })
  }
})

// Sumaryczny licznik bajtów RX/TX z interfejsów (poza lo) — do pomiaru pasma.
async function readNetBytes(): Promise<{ rx: number; tx: number } | null> {
  try {
    const txt = await fs.readFile('/proc/net/dev', 'utf8')
    let rx = 0, tx = 0
    for (const line of txt.split('\n')) {
      const m = line.trim().match(/^([^:]+):\s+(.*)$/)
      if (!m || m[1].trim() === 'lo') continue
      const f = m[2].trim().split(/\s+/).map(Number)
      rx += f[0] || 0           // rx_bytes
      tx += f[8] || 0           // tx_bytes
    }
    return { rx, tx }
  } catch { return null }
}

// Odczyt metryk LiveKit z Prometheus (latencja SFU, jakość, jitter).
async function readLiveKitMetrics(): Promise<{ latencyMs: number | null; qualityScore: number | null; jitterMs: number | null }> {
  const empty = { latencyMs: null, qualityScore: null, jitterMs: null }
  try {
    const port = process.env.LIVEKIT_PROM_PORT ?? '6789'
    const r = await fetch(`http://127.0.0.1:${port}/metrics`, { signal: AbortSignal.timeout(2000) })
    const text = await r.text()
    const num = (name: string) => {
      const m = text.match(new RegExp(name + '(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)'))
      return m ? Number(m[1]) : null
    }
    const latSum = num('livekit_forward_latency_ns_sum')
    const latCnt = num('livekit_forward_latency_ns_count')
    const qSum   = num('livekit_quality_score_sum')
    const qCnt   = num('livekit_quality_score_count')
    const jit    = num('livekit_forward_jitter')
    return {
      latencyMs:    (latSum != null && latCnt && latCnt > 0) ? +(latSum / latCnt / 1e6).toFixed(1) : null,
      qualityScore: (qSum   != null && qCnt   && qCnt   > 0) ? +(qSum / qCnt).toFixed(2) : null,
      jitterMs:     (jit    != null) ? +(jit / 1e6).toFixed(2) : null,
    }
  } catch { return empty }
}

// ── MONITORING GŁOSOWY (aktywne pokoje LiveKit + uczestnicy) ─────────────────
router.get('/voice', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    // Pasmo: próbka liczników NIC w oknie ~700 ms.
    const net1 = await readNetBytes()
    await new Promise(r => setTimeout(r, 700))
    const net2 = await readNetBytes()
    let network: { rxMbps: number; txMbps: number; linkMbps: number } | null = null
    if (net1 && net2) {
      const dt = 0.7
      network = {
        rxMbps: Math.max(0, +(((net2.rx - net1.rx) * 8) / dt / 1e6).toFixed(1)),
        txMbps: Math.max(0, +(((net2.tx - net1.tx) * 8) / dt / 1e6).toFixed(1)),
        linkMbps: Number(process.env.LINK_MBPS ?? 400),
      }
    }
    const livekit = await readLiveKitMetrics()

    const apiKey    = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const lkUrl     = process.env.LIVEKIT_URL ?? 'ws://localhost:7880'
    if (!apiKey || !apiSecret) {
      return res.json({ available: false, totalRooms: 0, totalParticipants: 0, rooms: [] })
    }

    const svc = new RoomServiceClient(lkUrl, apiKey, apiSecret)
    const rooms = await svc.listRooms()

    let totalParticipants = 0
    const out: any[] = []
    for (const room of rooms) {
      const channelId = room.name.startsWith('channel_') ? room.name.slice('channel_'.length) : room.name
      let channelName: string | null = null
      let serverName:  string | null = null
      try {
        const ch = await queryOne<{ name: string; server_id: string }>(
          'SELECT name, server_id FROM channels WHERE id = ?', [channelId]
        )
        if (ch) {
          channelName = ch.name
          const srv = await queryOne<{ name: string }>('SELECT name FROM servers WHERE id = ?', [ch.server_id])
          serverName = srv?.name ?? null
        }
      } catch {}

      let participants: any[] = []
      try {
        const ps = await svc.listParticipants(room.name)
        participants = ps.map(p => ({
          identity:    p.identity,
          name:        p.name || p.identity,
          joinedAtSec: Number(p.joinedAt),
          tracks:      (p.tracks ?? []).length,
        }))
      } catch {}
      totalParticipants += participants.length

      out.push({
        room:            room.name,
        channelId,
        channelName,
        serverName,
        numParticipants: room.numParticipants,
        creationTimeSec: Number(room.creationTime),
        participants,
      })
    }

    out.sort((a, b) => b.numParticipants - a.numParticipants)

    return res.json({
      available: true,
      timestamp: new Date().toISOString(),
      totalRooms: out.length,
      totalParticipants,
      network,
      livekit,
      rooms: out,
    })
  } catch (err) {
    console.error('[admin/voice]', err)
    return res.status(500).json({ error: 'Błąd pobierania danych głosowych' })
  }
})

// ── KOPIE ZAPASOWE (lista + pobieranie, tylko creator) ───────────────────────

// Ścisły wzorzec nazwy — blokuje path-traversal (brak slashy, brak "..")
const BACKUP_FILE_RE = /^nexus_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.sql\.gz$/

router.get('/backups', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    let files: string[] = []
    try { files = await fs.readdir(BACKUP_DIR) } catch { files = [] }
    const list: Array<{ file: string; sizeBytes: number; mtime: string; date: string | null }> = []
    for (const name of files) {
      const m = name.match(BACKUP_FILE_RE)
      if (!m) continue
      const st = await fs.stat(`${BACKUP_DIR}/${name}`).catch(() => null)
      if (!st || !st.isFile()) continue
      const [, Y, Mo, D, H, Mi, S] = m
      list.push({
        file: name,
        sizeBytes: st.size,
        mtime: new Date(st.mtimeMs).toISOString(),
        date: `${Y}-${Mo}-${D}T${H}:${Mi}:${S}`,
      })
    }
    list.sort((a, b) => (a.mtime < b.mtime ? 1 : -1))
    return res.json({ backups: list })
  } catch (err) {
    console.error('[admin/backups]', err)
    return res.status(500).json({ error: 'Nie udało się odczytać kopii zapasowych' })
  }
})

router.get('/backups/:file/download', requireAuth, async (req: Request, res: Response) => {
  if (!(await requireCreator(req, res))) return
  try {
    const file = req.params.file
    if (!BACKUP_FILE_RE.test(file)) {
      return res.status(400).json({ error: 'Nieprawidłowa nazwa pliku' })
    }
    const full = `${BACKUP_DIR}/${file}`
    const st = await fs.stat(full).catch(() => null)
    if (!st || !st.isFile()) return res.status(404).json({ error: 'Plik nie istnieje' })

    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Length', String(st.size))
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`)
    const stream = createReadStream(full)
    stream.on('error', () => { if (!res.headersSent) res.status(500).end() })
    stream.pipe(res)
  } catch (err) {
    console.error('[admin/backups/download]', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Błąd pobierania' })
  }
})

// ── PATCH NOTES ───────────────────────────────────────────────────────────────

router.get('/patch-notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const notes = await queryMany<any>(
      'SELECT id, version, date, label_pl, label_en, entries, created_at FROM patch_notes ORDER BY date DESC, version DESC'
    )
    const parsed = notes.map(n => ({
      ...n,
      entries: typeof n.entries === 'string' ? JSON.parse(n.entries) : n.entries,
    }))
    return res.json({ notes: parsed })
  } catch (err) {
    console.error('[admin/patch-notes/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/patch-notes', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!await requireCreator(req, res)) return
    const { version, date, labelPl, labelEn, entries } = req.body
    if (!version?.trim() || !date?.trim() || !Array.isArray(entries))
      return res.status(400).json({ error: 'Wymagane: version, date, entries' })
    const id = uuid()
    await execute(
      'INSERT INTO patch_notes (id, version, date, label_pl, label_en, entries) VALUES (?,?,?,?,?,?)',
      [id, version.trim(), date.trim(), labelPl?.trim() ?? '', labelEn?.trim() ?? '', JSON.stringify(entries)]
    )
    return res.status(201).json({ id })
  } catch (err) {
    console.error('[admin/patch-notes/post]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/patch-notes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!await requireCreator(req, res)) return
    await execute('DELETE FROM patch_notes WHERE id = ?', [req.params.id])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[admin/patch-notes/delete]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
