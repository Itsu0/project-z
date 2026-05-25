import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { execute, queryMany, queryOne, withTransaction, pool } from '../db/pool'
import { memberQueries } from '../db/queries'
import { hasPermission } from '../middleware/permissions'
import { v4 as uuidv4 } from 'uuid'
import { getSocketInstance } from '../socket'

const router = Router()

const scheduledPolls = new Set<string>()

async function getPollData(pollId: string, userId: string) {
  const poll = await queryOne<any>('SELECT * FROM polls WHERE id = ?', [pollId])
  if (!poll) return null

  const options = await queryMany<any>(
    `SELECT po.id, po.text, po.position,
            COUNT(pv.user_id) AS votes,
            MAX(CASE WHEN pv.user_id = ? THEN 1 ELSE 0 END) AS user_voted
     FROM poll_options po
     LEFT JOIN poll_votes pv ON pv.poll_option_id = po.id
     WHERE po.poll_id = ?
     GROUP BY po.id
     ORDER BY po.position`,
    [userId, pollId]
  )

  const totalVotes        = options.reduce((s: number, o: any) => s + Number(o.votes), 0)
  const userVotedOptionId = options.find((o: any) => Number(o.user_voted) > 0)?.id ?? null

  const expired = poll.expires_at ? new Date(poll.expires_at + 'Z') < new Date() : false
  const closed  = !!poll.closed || expired

  return {
    id:               poll.id,
    question:         poll.question,
    multiChoice:      !!poll.multi_choice,
    expiresAt:        poll.expires_at ? new Date(poll.expires_at + 'Z').toISOString() : null,
    closed,
    totalVotes,
    userVotedOptionId,
    options: options.map((o: any) => ({ id: o.id, text: o.text, votes: Number(o.votes) })),
  }
}

async function closePoll(pollId: string) {
  try {
    const poll = await queryOne<any>('SELECT * FROM polls WHERE id = ?', [pollId])
    if (!poll || poll.closed) return

    await execute('UPDATE polls SET closed = 1 WHERE id = ?', [pollId])

    const options = await queryMany<any>(
      `SELECT po.id, po.text, COUNT(pv.user_id) AS votes
       FROM poll_options po
       LEFT JOIN poll_votes pv ON pv.poll_option_id = po.id
       WHERE po.poll_id = ?
       GROUP BY po.id ORDER BY votes DESC, po.position ASC`,
      [pollId]
    )
    const totalVotes = options.reduce((s: number, o: any) => s + Number(o.votes), 0)

    const resultPayload = {
      question:   poll.question,
      totalVotes,
      options: options.map((o: any) => ({
        id:    o.id,
        text:  o.text,
        votes: Number(o.votes),
      })),
    }

    const msgId = uuidv4()
    await execute(
      'INSERT INTO messages (id, channel_id, server_id, author_id, content, type) VALUES (?, ?, ?, ?, ?, ?)',
      [msgId, poll.channel_id, poll.server_id, poll.created_by, JSON.stringify(resultPayload), 'POLL_RESULT']
    )

    const profile = await queryOne<any>(
      'SELECT display_name, username, avatar_color FROM users WHERE id = ?',
      [poll.created_by]
    )

    const io = getSocketInstance()
    if (io) {

      const pollData = await getPollData(pollId, poll.created_by)
      io.to(`channel:${poll.channel_id}`).emit('POLL_UPDATE', {
        pollId,
        messageId: poll.message_id,
        channelId: poll.channel_id,
        poll:      pollData,
      })

      io.to(`channel:${poll.channel_id}`).emit('MESSAGE_CREATE', {
        id:                  msgId,
        channel_id:          poll.channel_id,
        server_id:           poll.server_id,
        author_id:           poll.created_by,
        author_username:     profile?.username      ?? '',
        author_display_name: profile?.display_name  ?? '',
        author_avatar_color: profile?.avatar_color  ?? '#64748b',
        content:             JSON.stringify(resultPayload),
        type:                'POLL_RESULT',
        pinned:              false,
        created_at:          new Date().toISOString(),
        reactions:           [],
        attachments:         [],
        poll:                null,
      })
    }

    scheduledPolls.delete(pollId)
    console.log(`[polls] Zamknięto ankietę ${pollId}`)
  } catch (err) {
    console.error('[polls/close]', err)
  }
}

function scheduleClose(pollId: string, expiresAt: Date) {
  if (scheduledPolls.has(pollId)) return
  const delay = expiresAt.getTime() - Date.now()
  if (delay <= 0) {

    void closePoll(pollId)
    return
  }
  scheduledPolls.add(pollId)

  setTimeout(() => void closePoll(pollId), Math.min(delay, 2_147_483_647))
  console.log(`[polls] Zaplanowano zamknięcie ${pollId} za ${Math.round(delay / 1000)}s`)
}

export async function restorePollTimers() {
  try {
    const openPolls = await queryMany<any>(
      'SELECT id, expires_at FROM polls WHERE expires_at IS NOT NULL AND closed = 0',
      []
    )
    for (const p of openPolls) {
      scheduleClose(p.id, new Date(p.expires_at + 'Z'))
    }
    if (openPolls.length > 0)
      console.log(`[polls] Przywrócono timery dla ${openPolls.length} ankiet`)
  } catch (err) {
    console.error('[polls/restore]', err)
  }
}

router.post('/:channelId/polls', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId }                                           = req.params
    const { question, options, multiChoice, expiresMinutes } = req.body

    if (!question?.trim())
      return res.status(400).json({ error: 'Pytanie jest wymagane' })
    if (!Array.isArray(options) || options.length < 2)
      return res.status(400).json({ error: 'Min. 2 opcje' })
    if (options.length > 8)
      return res.status(400).json({ error: 'Maks. 8 opcji' })

    const pollChannel = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!pollChannel) return res.status(404).json({ error: 'Kanał nie istnieje' })
    const realServerId = pollChannel.server_id
    if (!await hasPermission(req.user!.userId, realServerId, 'SEND_MESSAGES')) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }

    const pollId    = uuidv4()
    const messageId = uuidv4()

    const expiresMs = expiresMinutes ? Number(expiresMinutes) * 60_000 : null
    const expiresAt = expiresMs ? new Date(Date.now() + expiresMs) : null

    const expiresAtMysql = expiresAt
      ? expiresAt.toISOString().replace('T', ' ').replace('Z', '')
      : null

    await withTransaction(async (conn) => {
      await conn.execute(
        'INSERT INTO polls (id, message_id, channel_id, server_id, created_by, question, multi_choice, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [pollId, messageId, channelId, realServerId, req.user!.userId, question.trim(), multiChoice ? 1 : 0, expiresAtMysql]
      )
      for (let i = 0; i < options.length; i++) {
        await conn.execute(
          'INSERT INTO poll_options (id, poll_id, text, position) VALUES (?, ?, ?, ?)',
          [uuidv4(), pollId, String(options[i]).trim(), i]
        )
      }
      await conn.execute(
        'INSERT INTO messages (id, channel_id, server_id, author_id, content, type) VALUES (?, ?, ?, ?, ?, ?)',
        [messageId, channelId, realServerId, req.user!.userId, question.trim(), 'POLL']
      )
    })

    const profile = await queryOne<any>(
      'SELECT display_name, username, avatar_color, avatar_url FROM users WHERE id = ?',
      [req.user!.userId]
    )

    const now = new Date().toISOString()

    const pollData = await getPollData(pollId, req.user!.userId)

    const enriched = {
      id:                   messageId,
      channel_id:           channelId,
      server_id:            realServerId,
      author_id:            req.user!.userId,
      author_username:      profile?.username      ?? '',
      author_display_name:  profile?.display_name  ?? '',
      author_avatar_color:  profile?.avatar_color  ?? '#64748b',
      author_avatar_url:    profile?.avatar_url    ?? null,
      content:              question.trim(),
      type:                 'POLL',
      pinned:               false,
      created_at:           now,
      edited_at:            null,
      reactions:            [],
      attachments:          [],
      poll:                 pollData,
    }

    const io = getSocketInstance()
    io?.to(`channel:${channelId}`).emit('MESSAGE_CREATE', enriched)

    if (expiresAt) scheduleClose(pollId, expiresAt)

    return res.status(201).json({ message: enriched })
  } catch (err) {
    console.error('[polls/create]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:pollId/vote', requireAuth, async (req: Request, res: Response) => {
  try {
    const { pollId }  = req.params
    const { optionId } = req.body
    if (!optionId) return res.status(400).json({ error: 'Wymagane: optionId' })

    const poll = await queryOne<any>('SELECT * FROM polls WHERE id = ?', [pollId])
    if (!poll) return res.status(404).json({ error: 'Ankieta nie znaleziona' })

    if (!await memberQueries.isMember(req.user!.userId, poll.server_id)) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }

    const expired = poll.expires_at ? new Date(poll.expires_at + 'Z') < new Date() : false
    if (poll.closed || expired) {
      return res.status(400).json({ error: 'Ankieta jest już zakończona' })
    }

    const option = await queryOne<any>(
      'SELECT * FROM poll_options WHERE id = ? AND poll_id = ?',
      [optionId, pollId]
    )
    if (!option) return res.status(404).json({ error: 'Opcja nie znaleziona' })

    const existing = await queryOne<any>(
      'SELECT * FROM poll_votes WHERE poll_option_id = ? AND user_id = ?',
      [optionId, req.user!.userId]
    )

    await withTransaction(async (conn) => {
      if (existing) {
        await conn.execute(
          'DELETE FROM poll_votes WHERE poll_option_id = ? AND user_id = ?',
          [optionId, req.user!.userId]
        )
      } else {
        if (!poll.multi_choice) {
          const [allOpts] = await conn.execute<any[]>('SELECT id FROM poll_options WHERE poll_id = ?', [pollId])
          for (const opt of allOpts) {
            await conn.execute(
              'DELETE FROM poll_votes WHERE poll_option_id = ? AND user_id = ?',
              [opt.id, req.user!.userId]
            )
          }
        }
        await conn.execute(
          'INSERT INTO poll_votes (poll_option_id, user_id) VALUES (?, ?)',
          [optionId, req.user!.userId]
        )
      }
    })

    const pollData = await getPollData(pollId, req.user!.userId)

    const io = getSocketInstance()
    io?.to(`channel:${poll.channel_id}`).emit('POLL_UPDATE', {
      pollId,
      messageId: poll.message_id,
      channelId: poll.channel_id,
      poll:      pollData,
    })

    return res.json({ poll: pollData })
  } catch (err) {
    console.error('[polls/vote]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.get('/:pollId', requireAuth, async (req: Request, res: Response) => {
  try {
    const pollRow = await queryOne<{ server_id: string }>('SELECT server_id FROM polls WHERE id = ?', [req.params.pollId])
    if (!pollRow) return res.status(404).json({ error: 'Nie znaleziono' })
    if (!await memberQueries.isMember(req.user!.userId, pollRow.server_id)) {
      return res.status(403).json({ error: 'Brak dostępu' })
    }
    const data = await getPollData(req.params.pollId, req.user!.userId)
    if (!data) return res.status(404).json({ error: 'Nie znaleziono' })
    return res.json({ poll: data })
  } catch (err) {
    console.error('[polls/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
