import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { queryOne, queryMany, execute } from '../db/pool'

const router = Router()

const DEFAULTS: Record<string, unknown> = {
  inputDevice: '', outputDevice: '',
  inputVolume: 100, outputVolume: 100,
  noiseSuppression: true, echoCancellation: true, autoGain: true,
  audioProfile: 'zbalansowany', vadThreshold: 0,
  pttEnabled: false, pttKey: 'Space',
  fontSize: 'normal', compactMode: false, colorTheme: 'ember',
}

router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await queryOne<{ settings: unknown }>(
      'SELECT settings FROM user_settings WHERE user_id = ?',
      [req.user!.userId]
    )
    const settings = (row?.settings && typeof row.settings === 'object') ? row.settings : { ...DEFAULTS }
    return res.json({ settings })
  } catch (err) {
    console.error('[user/settings/get]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId
    const patch = req.body
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'Nieprawidłowe dane' })
    }

    const row = await queryOne<{ settings: unknown }>(
      'SELECT settings FROM user_settings WHERE user_id = ?',
      [userId]
    )
    const current = (row?.settings && typeof row.settings === 'object') ? row.settings as Record<string, unknown> : { ...DEFAULTS }
    const updated = { ...current, ...patch }

    await execute(
      `INSERT INTO user_settings (user_id, settings) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE settings = ?, updated_at = NOW()`,
      [userId, JSON.stringify(updated), JSON.stringify(updated)]
    )
    return res.json({ settings: updated })
  } catch (err) {
    console.error('[user/settings/patch]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ── Eksport danych (RODO / prawo do przenoszenia danych, art. 20 RODO) ───────
router.get('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.userId

    // Profil — bez pól wrażliwych (hash hasła, sekret 2FA)
    const profile = await queryOne(
      `SELECT id, username, display_name, email, avatar_url, avatar_color,
              status, custom_status, is_dev, is_mod, is_creator, email_verified,
              birth_date, created_at, updated_at
       FROM users WHERE id = ?`,
      [uid]
    )

    const settingsRow = await queryOne<{ settings: unknown }>(
      'SELECT settings FROM user_settings WHERE user_id = ?', [uid]
    )

    const [
      ownedServers, memberships, memberRoles, messages, attachments,
      forumPosts, forumReplies, reactions, friends, friendRequestsOut,
      friendRequestsIn, dmConversations, dmMessages, dmBlocks, tickets,
      warnings, bans, strikes, mutes, notifications, ips, invitesCreated,
      customEmoji,
    ] = await Promise.all([
      queryMany('SELECT id, name, description, plan, member_limit, invite_code, created_at FROM servers WHERE owner_id = ?', [uid]),
      queryMany('SELECT server_id, nickname, joined_at, boosting FROM server_members WHERE user_id = ?', [uid]),
      queryMany('SELECT server_id, role_id FROM member_roles WHERE user_id = ?', [uid]),
      queryMany('SELECT id, channel_id, server_id, content, reply_to_id, type, pinned, edited_at, created_at FROM messages WHERE author_id = ?', [uid]),
      queryMany('SELECT a.id, a.message_id, a.filename, a.url, a.content_type, a.size FROM attachments a JOIN messages m ON a.message_id = m.id WHERE m.author_id = ?', [uid]),
      queryMany('SELECT id, channel_id, server_id, title, content, gif_url, created_at FROM forum_posts WHERE author_id = ?', [uid]),
      queryMany('SELECT id, post_id, content, gif_url, created_at FROM forum_replies WHERE author_id = ?', [uid]),
      queryMany('SELECT message_id, emoji, created_at FROM reactions WHERE user_id = ?', [uid]),
      queryMany('SELECT friend_id, created_at FROM friends WHERE user_id = ?', [uid]),
      queryMany('SELECT to_id, created_at FROM friend_requests WHERE from_id = ?', [uid]),
      queryMany('SELECT from_id, created_at FROM friend_requests WHERE to_id = ?', [uid]),
      queryMany('SELECT id, user1_id, user2_id, created_at, last_message_at FROM dm_conversations WHERE user1_id = ? OR user2_id = ?', [uid, uid]),
      queryMany('SELECT id, conversation_id, content, edited_at, deleted_at, created_at FROM dm_messages WHERE author_id = ?', [uid]),
      queryMany('SELECT blocked_id, created_at FROM dm_blocks WHERE blocker_id = ?', [uid]),
      queryMany('SELECT id, category, subject, description, status, admin_reply, created_at, updated_at FROM tickets WHERE user_id = ?', [uid]),
      queryMany('SELECT id, reason, seen_at, user_reply, reply_at, created_at FROM user_warnings WHERE user_id = ?', [uid]),
      queryMany('SELECT id, reason, expires_at, created_at FROM user_bans WHERE user_id = ?', [uid]),
      queryMany('SELECT id, server_id, reason, auto, created_at FROM server_strikes WHERE user_id = ?', [uid]),
      queryMany('SELECT server_id, reason, expires_at, created_at FROM server_mutes WHERE user_id = ?', [uid]),
      queryMany('SELECT id, server_id, channel_id, type, read_at, created_at FROM notifications WHERE user_id = ?', [uid]),
      queryMany('SELECT ip, first_seen, last_seen FROM user_ips WHERE user_id = ?', [uid]),
      queryMany('SELECT code, server_id, uses, max_uses, expires_at, created_at FROM invites WHERE created_by = ?', [uid]),
      queryMany('SELECT id, server_id, name, url, animated, created_at FROM custom_emoji WHERE uploaded_by = ?', [uid]),
    ])

    const exportData = {
      _meta: {
        format: 'Nexus / Project-Z — eksport danych użytkownika (RODO art. 20)',
        generated_at: new Date().toISOString(),
        note: 'Dane osobowe i treści powiązane z Twoim kontem. Pola wrażliwe (hasło, sekret 2FA) są celowo pominięte.',
      },
      profile,
      settings: settingsRow?.settings ?? {},
      owned_servers: ownedServers,
      memberships,
      member_roles: memberRoles,
      messages,
      message_attachments: attachments,
      forum_posts: forumPosts,
      forum_replies: forumReplies,
      reactions,
      friends,
      friend_requests_sent: friendRequestsOut,
      friend_requests_received: friendRequestsIn,
      dm_conversations: dmConversations,
      dm_messages: dmMessages,
      blocked_users: dmBlocks,
      tickets,
      warnings,
      bans,
      strikes,
      mutes,
      notifications,
      ip_history: ips,
      invites_created: invitesCreated,
      custom_emoji: customEmoji,
    }

    const stamp = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="nexus-dane-${stamp}.json"`)
    return res.status(200).send(JSON.stringify(exportData, null, 2))
  } catch (err) {
    console.error('[user/export]', err)
    return res.status(500).json({ error: 'Błąd serwera podczas eksportu danych' })
  }
})

router.get('/warnings', requireAuth, async (req: Request, res: Response) => {
  try {
    const unseenOnly = req.query.unseen === '1'
    const warnings = await queryMany(
      `SELECT * FROM user_warnings
       WHERE user_id = ?
       ${unseenOnly ? 'AND seen_at IS NULL' : ''}
       ORDER BY created_at DESC`,
      [req.user!.userId]
    )
    return res.json({ warnings })
  } catch (err) {
    console.error('[user/warnings]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/warnings/:id/seen', requireAuth, async (req: Request, res: Response) => {
  try {
    const { reply } = req.body
    if (reply && reply.trim().length > 2000)
      return res.status(400).json({ error: 'Wyjaśnienie za długie (maks. 2000 znaków)' })

    await execute(
      `UPDATE user_warnings
       SET seen_at    = COALESCE(seen_at, NOW()),
           user_reply = COALESCE(?, user_reply),
           reply_at   = CASE WHEN ? IS NOT NULL AND user_reply IS NULL THEN NOW() ELSE reply_at END
       WHERE id = ? AND user_id = ?`,
      [reply?.trim() || null, reply?.trim() || null, req.params.id, req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[user/warnings/seen]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

router.patch('/warnings/:id/reply', requireAuth, async (req: Request, res: Response) => {
  try {
    const { reply } = req.body
    if (!reply?.trim())
      return res.status(400).json({ error: 'Wyjaśnienie nie może być puste' })
    if (reply.trim().length > 2000)
      return res.status(400).json({ error: 'Wyjaśnienie za długie (maks. 2000 znaków)' })

    const warn = await queryOne<{ user_id: string; user_reply: string | null }>(
      'SELECT user_id, user_reply FROM user_warnings WHERE id = ?',
      [req.params.id]
    )
    if (!warn || warn.user_id !== req.user!.userId)
      return res.status(404).json({ error: 'Ostrzeżenie nie znalezione' })
    if (warn.user_reply)
      return res.status(409).json({ error: 'Wyjaśnienie zostało już wysłane' })

    await execute(
      `UPDATE user_warnings SET user_reply = ?, reply_at = NOW() WHERE id = ? AND user_id = ?`,
      [reply.trim(), req.params.id, req.user!.userId]
    )
    return res.json({ ok: true })
  } catch (err) {
    console.error('[user/warnings/reply]', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

export default router
