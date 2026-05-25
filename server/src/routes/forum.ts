import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { memberQueries } from '../db/queries'
import { queryMany, queryOne, execute, pool } from '../db/pool'
import { v4 as uuidv4 } from 'uuid'

async function rawQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query<any[]>(sql, params)
  return rows as T[]
}

const router = Router()

async function assertMember(userId: string, serverId: string, res: Response): Promise<boolean> {
  const ok = await memberQueries.isMember(userId, serverId)
  if (!ok) { res.status(403).json({ error: 'Brak dostępu' }); return false }
  return true
}

router.get('/:channelId/posts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params
    const limit  = Math.min(parseInt(String(req.query.limit  ?? 30), 10) || 30, 50)
    const offset = parseInt(String(req.query.offset ?? 0), 10) || 0

    const channel = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!channel) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await memberQueries.isMember(req.user!.userId, channel.server_id)) return res.status(403).json({ error: 'Brak dostępu' })

    const posts = await rawQuery<any>(
      `SELECT fp.id, fp.channel_id, fp.title, fp.content, fp.gif_url,
              fp.pinned, fp.reply_count, fp.last_reply_at, fp.created_at,
              u.id as author_id, u.display_name as author_display_name,
              u.username as author_username, u.avatar_color as author_avatar_color,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS author_avatar_url
       FROM forum_posts fp
       INNER JOIN users u ON u.id = fp.author_id
       WHERE fp.channel_id = ?
       ORDER BY fp.pinned DESC, COALESCE(fp.last_reply_at, fp.created_at) DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [channelId]
    )
    return res.json({ posts })
  } catch (err: any) {
    console.error('[forum/list]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:channelId/posts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params
    const { title, content, gifUrl } = req.body

    if (!title?.trim() || title.trim().length < 2) return res.status(400).json({ error: 'Tytuł jest za krótki' })
    if (!content?.trim()) return res.status(400).json({ error: 'Treść jest wymagana' })
    if (title.length > 256) return res.status(400).json({ error: 'Tytuł za długi (max 256 znaków)' })

    const channel = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!channel) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await memberQueries.isMember(req.user!.userId, channel.server_id)) return res.status(403).json({ error: 'Brak dostępu' })

    const id = uuidv4()
    await execute(
      `INSERT INTO forum_posts (id, channel_id, server_id, author_id, title, content, gif_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, channelId, channel.server_id, req.user!.userId, title.trim(), content.trim(), gifUrl ?? null]
    )

    const postRows2 = await rawQuery<any>(
      `SELECT fp.*, u.display_name as author_display_name, u.username as author_username,
              u.avatar_color as author_avatar_color,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS author_avatar_url
       FROM forum_posts fp INNER JOIN users u ON u.id = fp.author_id WHERE fp.id = ?`, [id]
    )
    return res.status(201).json({ post: postRows2[0] ?? null })
  } catch (err: any) {
    console.error('[forum/create]', err)
    return res.status(500).json({ error: 'Błąd serwera', detail: err?.message ?? String(err) })
  }
})

router.get('/:channelId/posts/:postId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, postId } = req.params

    const channel = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!channel) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await memberQueries.isMember(req.user!.userId, channel.server_id)) return res.status(403).json({ error: 'Brak dostępu' })

    const postRows = await rawQuery<any>(
      `SELECT fp.*, u.display_name as author_display_name, u.username as author_username,
              u.avatar_color as author_avatar_color,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS author_avatar_url
       FROM forum_posts fp INNER JOIN users u ON u.id = fp.author_id WHERE fp.id = ? AND fp.channel_id = ?`,
      [postId, channelId]
    )
    const post = postRows[0] ?? null
    if (!post) return res.status(404).json({ error: 'Post nie istnieje' })

    const replies = await rawQuery<any>(
      `SELECT fr.id, fr.post_id, fr.content, fr.gif_url, fr.created_at,
              u.id as author_id, u.display_name as author_display_name,
              u.username as author_username, u.avatar_color as author_avatar_color,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS author_avatar_url
       FROM forum_replies fr INNER JOIN users u ON u.id = fr.author_id
       WHERE fr.post_id = ? ORDER BY fr.created_at ASC`,
      [postId]
    )

    return res.json({ post, replies })
  } catch (err) {
    console.error('[forum/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.post('/:channelId/posts/:postId/replies', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, postId } = req.params
    const { content, gifUrl } = req.body

    if (!content?.trim() && !gifUrl) return res.status(400).json({ error: 'Treść odpowiedzi jest wymagana' })

    const channel = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!channel) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await memberQueries.isMember(req.user!.userId, channel.server_id)) return res.status(403).json({ error: 'Brak dostępu' })

    const post = await queryOne<{ id: string }>('SELECT id FROM forum_posts WHERE id = ? AND channel_id = ?', [postId, channelId])
    if (!post) return res.status(404).json({ error: 'Post nie istnieje' })

    const id = uuidv4()
    await execute(
      'INSERT INTO forum_replies (id, post_id, author_id, content, gif_url) VALUES (?, ?, ?, ?, ?)',
      [id, postId, req.user!.userId, content?.trim() ?? '', gifUrl ?? null]
    )

    await execute(
      'UPDATE forum_posts SET reply_count = reply_count + 1, last_reply_at = NOW() WHERE id = ?',
      [postId]
    )

    const replyRows = await rawQuery<any>(
      `SELECT fr.*, u.id as author_id, u.display_name as author_display_name,
              u.username as author_username, u.avatar_color as author_avatar_color,
              CASE WHEN LENGTH(u.avatar_url) > 512 THEN u.avatar_url ELSE NULL END AS author_avatar_url
       FROM forum_replies fr INNER JOIN users u ON u.id = fr.author_id WHERE fr.id = ?`, [id]
    )
    return res.status(201).json({ reply: replyRows[0] ?? null })
  } catch (err) {
    console.error('[forum/reply]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:channelId/posts/:postId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, postId } = req.params
    const delChannel = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!delChannel) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await assertMember(req.user!.userId, delChannel.server_id, res)) return
    const post = await queryOne<{ author_id: string }>('SELECT author_id FROM forum_posts WHERE id = ? AND channel_id = ?', [postId, channelId])
    if (!post) return res.status(404).json({ error: 'Post nie istnieje' })
    if (post.author_id !== req.user!.userId) return res.status(403).json({ error: 'Możesz usuwać tylko swoje posty' })
    await execute('DELETE FROM forum_posts WHERE id = ?', [postId])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[forum/delete]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.delete('/:channelId/posts/:postId/replies/:replyId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, postId, replyId } = req.params
    const delReplyCh = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = ?', [channelId])
    if (!delReplyCh) return res.status(404).json({ error: 'Kanał nie istnieje' })
    if (!await assertMember(req.user!.userId, delReplyCh.server_id, res)) return
    const reply = await queryOne<{ author_id: string }>('SELECT author_id FROM forum_replies WHERE id = ?', [replyId])
    if (!reply) return res.status(404).json({ error: 'Odpowiedź nie istnieje' })
    if (reply.author_id !== req.user!.userId) return res.status(403).json({ error: 'Możesz usuwać tylko swoje odpowiedzi' })
    await execute('DELETE FROM forum_replies WHERE id = ?', [replyId])
    await execute('UPDATE forum_posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = ?', [postId])
    return res.json({ ok: true })
  } catch (err) {
    console.error('[forum/delete-reply]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
