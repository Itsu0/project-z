'use client'
import clsx from 'clsx'
import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import type { Message, Poll } from '@/types'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { WarEmbed } from './WarEmbed'
import { MessageActions } from '@/components/moderation/ModerationMenu'
import { ReportModal } from '@/components/chat/ReportModal'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { useStore } from '@/lib/store'
import { useSocket } from '@/hooks/useSocket'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Props {
  message: Message
  compact?: boolean
  canManageMessages?: boolean
  onDelete?: (id: string) => void
  onReply?: (info: { id: string; content: string; authorName: string }) => void
  onPin?: (msgId: string, pinned: boolean) => void
}

function isGiphyUrl(content: string) {
  return /^https:\/\/(media\d*\.giphy\.com|media\.tenor\.com|c\.tenor\.com|media\d*\.tenor\.co)/i.test(content.trim())
}

function parseContent(content: string, customEmoji: any[] = []) {
  const parts = content.split(/(~\w[\w-]*|@[\w\-\.ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+|:\w+:)/g)
  return parts.map((part, i) => {
    if (part.startsWith('~')) return (
      <span key={i} className="cursor-pointer hover:underline"
        style={{ color: 'var(--eb-accent)', background: 'rgba(245,158,11,0.1)', padding: '0 3px', borderRadius: 3 }}>
        {part}
      </span>
    )
    if (part.startsWith('@')) return (
      <span key={i} className="cursor-pointer"
        style={{ color: 'var(--eb-voice)', background: 'rgba(74,158,255,0.1)', padding: '0 2px', borderRadius: 3 }}>
        {part}
      </span>
    )
    if (part.startsWith(':') && part.endsWith(':') && part.length > 2) {
      const name = part.slice(1, -1)
      const found = customEmoji.find(e => e.name === name)
      if (found) return (
        <img key={i} src={found.url ?? found.image} alt={part}
          className="inline-block align-middle mx-0.5"
          style={{ width: 22, height: 22, objectFit: 'contain', verticalAlign: 'text-bottom' }}
          title={part}
        />
      )
    }
    return <span key={i}>{part}</span>
  })
}

function EditInput({ initial, onSave, onCancel }: { initial: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.setSelectionRange(val.length, val.length)
  }, [])

  return (
    <div className="mt-1">
      <textarea
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (val.trim()) onSave(val.trim()) }
          if (e.key === 'Escape') onCancel()
        }}
        rows={2}
        className="w-full px-2.5 py-1.5 rounded-lg text-sm resize-none outline-none"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--eb-accent)',
          color: 'var(--eb-text1)',
          fontFamily: 'DM Sans, sans-serif',
          lineHeight: 1.5,
          maxHeight: 120,
        }}
      />
      <div className="flex gap-1.5 mt-1">
        <button onClick={onCancel} className="text-[11px] px-2.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--eb-text3)' }}>Anuluj</button>
        <button onClick={() => val.trim() && onSave(val.trim())} className="text-[11px] px-2.5 py-0.5 rounded-md" style={{ background: 'var(--eb-gradient)', color: '#fff' }}>Zapisz</button>
        <span className="text-[10px] self-center" style={{ color: 'var(--eb-text3)' }}>Esc anuluj · Enter zapisz</span>
      </div>
    </div>
  )
}

function MsgBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-white/10"
      style={{ color: 'var(--eb-text3)' }}
    >
      {children}
    </button>
  )
}

function AttachmentsBlock({ attachments }: { attachments: Message['attachments'] }) {
  const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null)
  if (!attachments?.length) return null
  return (
    <>
      {lightbox && (
        <ImageLightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />
      )}
    <div className="flex flex-wrap gap-2 mt-1.5">
      {attachments.map(att => (
        att.contentType?.startsWith('image/') ? (
          <img
            key={att.id}
            src={att.url}
            alt={att.filename}
            className="rounded-xl object-contain cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: 256, maxWidth: 320, display: 'block' }}
            onClick={() => setLightbox({ url: att.url, filename: att.filename })}
          />
        ) : (
          <a
            key={att.id}
            href={att.url}
            download={att.filename}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors no-underline"
            style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid var(--eb-border2)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="1.5" className="flex-shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--eb-text1)' }}>{att.filename}</div>
              <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>{(att.size / 1024).toFixed(0)} KB</div>
            </div>
          </a>
        )
      ))}
    </div>
    </>
  )
}

function PollResultCard({ content }: { content: string }) {
  let data: { question: string; totalVotes: number; options: { id: string; text: string; votes: number }[] }
  try { data = JSON.parse(content) } catch { return null }

  const { question, totalVotes, options } = data
  const total = totalVotes || 1
  const winner = options[0]

  return (
    <div
      className="mt-2 rounded-xl p-3 max-w-sm"
      style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--eb-border2)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="text-sm font-semibold leading-snug" style={{ color: 'var(--eb-text1)' }}>
          {question}
        </div>
        <span
          className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--eb-text3)' }}
        >
          Zakończona
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt, idx) => {
          const pct    = totalVotes === 0 ? 0 : Math.round((opt.votes / total) * 100)
          const isWin  = idx === 0 && totalVotes > 0
          return (
            <div
              key={opt.id}
              className="relative rounded-lg overflow-hidden"
              style={{
                background: isWin ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
                border: `0.5px solid ${isWin ? 'var(--eb-accent)' : 'var(--eb-border2)'}`,
                padding: '6px 10px',
              }}
            >
              <div
                className="absolute inset-0 rounded-lg transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: isWin ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                  pointerEvents: 'none',
                }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="text-sm truncate" style={{ color: isWin ? 'var(--eb-accent)' : 'var(--eb-text1)' }}>
                  {isWin && <span className="mr-1">👑</span>}{opt.text}
                </span>
                <span className="text-xs flex-shrink-0 font-medium" style={{ color: isWin ? 'var(--eb-accent)' : 'var(--eb-text3)' }}>
                  {pct}% · {opt.votes}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 text-[11px]" style={{ color: 'var(--eb-text3)' }}>
        {totalVotes} {totalVotes === 1 ? 'głos' : totalVotes >= 2 && totalVotes <= 4 ? 'głosy' : 'głosów'} łącznie
        {totalVotes > 0 && winner && (
          <span className="ml-1.5" style={{ color: 'var(--eb-accent)' }}>
            · Zwycięzca: {winner.text}
          </span>
        )}
      </div>
    </div>
  )
}

function useCountdown(expiresAt: string | null | undefined): string | null {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    if (!expiresAt) { setText(null); return }
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setText(null); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1000)
      if (h > 0)  setText(`${h}h ${m}m`)
      else if (m > 0) setText(`${m}m ${s}s`)
      else        setText(`${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return text
}

function PollCard({ poll: initialPoll, messageId }: { poll: Poll; messageId: string }) {
  const { token } = useStore()
  const [poll, setPoll] = useState<Poll>(initialPoll)
  const [voting, setVoting] = useState(false)
  const countdown = useCountdown(poll.expiresAt)

  useEffect(() => { setPoll(initialPoll) }, [initialPoll])

  const isExpired = poll.closed || (!!poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now() && !countdown)

  const vote = useCallback(async (optionId: string) => {
    if (!token || voting || isExpired) return
    setVoting(true)
    try {
      const isUnvote = poll.userVotedOptionId === optionId
      setPoll(p => ({
        ...p,
        totalVotes: isUnvote ? p.totalVotes - 1 : p.totalVotes + 1,
        userVotedOptionId: isUnvote ? null : optionId,
        options: p.options.map(o => ({
          ...o,
          votes: o.id === optionId ? (isUnvote ? o.votes - 1 : o.votes + 1) : o.votes,
        })),
      }))

      const res = await fetch(`${BASE}/api/polls/${poll.id}/vote`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ optionId }),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.poll) setPoll(d.poll)
      }
    } catch {  }
    finally { setVoting(false) }
  }, [poll, token, voting, isExpired])

  const total = poll.totalVotes || 1

  return (
    <div
      className="mt-2 rounded-xl p-3 max-w-sm"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '0.5px solid var(--eb-border2)',
        opacity: isExpired ? 0.75 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="text-sm font-semibold leading-snug" style={{ color: 'var(--eb-text1)' }}>
          {poll.question}
        </div>
        {isExpired ? (
          <span
            className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--eb-text3)' }}
          >
            Ankieta zakończona
          </span>
        ) : countdown ? (
          <span
            className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--eb-accent)' }}
            title={`Kończy się: ${new Date(poll.expiresAt!).toLocaleString('pl')}`}
          >
            ⏱ {countdown}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {poll.options.map(opt => {
          const pct   = poll.totalVotes === 0 ? 0 : Math.round((opt.votes / total) * 100)
          const voted = poll.userVotedOptionId === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => vote(opt.id)}
              disabled={voting || isExpired}
              className="relative w-full text-left rounded-lg overflow-hidden transition-all"
              style={{
                background: voted ? 'rgba(var(--eb-accent-rgb,245,158,11),0.15)' : 'rgba(255,255,255,0.05)',
                border: `0.5px solid ${voted ? 'var(--eb-accent)' : 'var(--eb-border2)'}`,
                padding: '6px 10px',
                cursor: isExpired ? 'not-allowed' : 'pointer',
                opacity: isExpired ? 0.7 : 1,
                pointerEvents: isExpired ? 'none' : 'auto',
              }}
            >
              <div
                className="absolute inset-0 rounded-lg transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: voted ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.05)',
                  pointerEvents: 'none',
                }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="text-sm truncate" style={{ color: voted ? 'var(--eb-accent)' : 'var(--eb-text1)' }}>
                  {voted && <span className="mr-1">✓</span>}{opt.text}
                </span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--eb-text3)' }}>
                  {pct}% · {opt.votes}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-[11px]" style={{ color: 'var(--eb-text3)' }}>
        {poll.totalVotes} {poll.totalVotes === 1 ? 'głos' : poll.totalVotes >= 2 && poll.totalVotes <= 4 ? 'głosy' : 'głosów'}
        {!isExpired && !poll.expiresAt && (
          <span className="ml-1 opacity-60">· Kliknij opcję, aby zagłosować</span>
        )}
      </div>
    </div>
  )
}

export function MessageItem({ message, compact = false, canManageMessages = false, onDelete, onReply, onPin }: Props) {
  const { currentUser, currentServerId, userSettings, token } = useStore()
  const compactMode = userSettings.compactMode
  const { editMessage } = useSocket()
  const [customEmoji, setCustomEmoji] = useState<any[]>([])
  const [reacted, setReacted] = useState<Record<string, boolean>>(
    Object.fromEntries((message.reactions ?? []).map(r => [String(r.emoji), r.userReacted]))
  )
  const [editing,    setEditing]    = useState(false)
  const [reporting,  setReporting]  = useState(false)

  const isOwn      = message.author.id === currentUser?.id
  const isAdminMsg = !!message.isAdminMsg
  const canEdit = isOwn && message.type === 'DEFAULT' && !isGiphyUrl(message.content) && !isAdminMsg
  const canPin  = canManageMessages

  useEffect(() => {
    if (!currentServerId || !token) return
    const stored = sessionStorage.getItem(`emoji_${currentServerId}`)
    if (stored) { setCustomEmoji(JSON.parse(stored)); return }
    fetch(`${BASE}/api/servers/${currentServerId}/emoji`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const emoji = d.emoji ?? []
        setCustomEmoji(emoji)
        sessionStorage.setItem(`emoji_${currentServerId}`, JSON.stringify(emoji))
      })
      .catch(() => {})
  }, [currentServerId, token])

  const topRole = message.authorMember?.roles.sort((a, b) => b.position - a.position)[0]
  const parsedDate = message.createdAt ? new Date(message.createdAt) : new Date()
  const timeStr = isNaN(parsedDate.getTime()) ? '??:??' : format(parsedDate, 'HH:mm')
  const isBot = message.author.username === 'QuinfallBot'

  const handleSaveEdit = useCallback((content: string) => {
    editMessage(message.id, message.channelId, content)
    setEditing(false)
  }, [message.id, message.channelId, editMessage])

  const handlePin = useCallback(async () => {
    if (!token) return
    const pinned = !message.pinned
    const method = pinned ? 'PUT' : 'DELETE'
    await fetch(`${BASE}/api/channels/${message.channelId}/pins/${message.id}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    onPin?.(message.id, pinned)
  }, [message.id, message.channelId, message.pinned, token, onPin])

  const actionProps = {
    message: {
      id: message.id,
      channelId: message.channelId ?? '',
      authorId: message.author.id ?? '',
      authorName: message.author.displayName,
      serverId: message.serverId ?? '',
    },
    currentUserId: currentUser?.id ?? '',
    canManageMessages,
    onDelete: onDelete ?? (() => {}),
  }

  const ActionBar = () => (
    <>
      {reporting && (
        <ReportModal
          messageId={message.id}
          channelId={message.channelId ?? ''}
          serverId={message.serverId ?? ''}
          messageContent={message.content}
          authorName={message.author.displayName}
          onClose={() => setReporting(false)}
        />
      )}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 absolute right-2 -top-3 z-10 rounded-lg px-1 py-0.5 shadow-md"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
        <MsgBtn title="Odpowiedz" onClick={() => onReply?.({ id: message.id, content: message.content, authorName: message.author.displayName })}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
          </svg>
        </MsgBtn>
        {canEdit && (
          <MsgBtn title="Edytuj" onClick={() => setEditing(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </MsgBtn>
        )}
        {canPin && !isAdminMsg && (
          <MsgBtn title={message.pinned ? 'Odepnij' : 'Przypnij'} onClick={handlePin}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={message.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </MsgBtn>
        )}
        {!isOwn && !isAdminMsg && (
          <MsgBtn title="Zgłoś" onClick={() => setReporting(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </MsgBtn>
        )}
        <MessageActions {...actionProps} />
      </div>
    </>
  )

  const ReplyBar = () => message.replyTo ? (
    <div className="flex items-center gap-1.5 mb-1 ml-1 pl-2 border-l-2 py-0.5" style={{ borderColor: 'var(--eb-accent)' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--eb-text3)" strokeWidth="2">
        <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
      </svg>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--eb-accent)' }}>{message.replyTo.authorName}</span>
      <span className="text-[11px] truncate" style={{ color: 'var(--eb-text3)', maxWidth: 260 }}>
        {isGiphyUrl(message.replyTo.content) ? '🖼 GIF' : message.replyTo.content}
      </span>
    </div>
  ) : null

  const EditedMark = () => message.editedAt ? (
    <span className="ml-1.5 text-[9px]" style={{ color: 'var(--eb-text3)' }} title={`Edytowano: ${new Date(message.editedAt).toLocaleString('pl')}`}>(edytowano)</span>
  ) : null

  const PinBadge = () => message.pinned ? (
    <span className="ml-1.5 text-[9px] font-semibold" style={{ color: 'var(--eb-accent)' }}>📌</span>
  ) : null

  if (compact) return (
    <div className="message-row flex gap-3 rounded-md px-2 py-0.5 group relative" style={{ marginTop: compactMode ? 0 : 1 }}>
      <div className="w-9 flex-shrink-0 flex items-start justify-end pt-0.5">
        <span className="msg-timestamp-hover text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--eb-text3)' }}>{timeStr}</span>
      </div>
      <div className="flex-1 min-w-0">
        <ReplyBar />
        {editing ? (
          <EditInput initial={message.content} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
        ) : message.type === 'POLL_RESULT' ? null : isGiphyUrl(message.content) ? (
          <div className="mt-0.5">
            <img src={message.content.trim()} alt="GIF" className="rounded-xl max-h-48 max-w-xs object-contain" style={{ display: 'block' }} />
          </div>
        ) : (
          <div className="text-sm leading-relaxed" style={{ color: 'var(--eb-text1)' }}>
            {parseContent(message.content, customEmoji)}
            <EditedMark />
            <PinBadge />
          </div>
        )}
        <AttachmentsBlock attachments={message.attachments} />

        {message.type === 'POLL' && message.poll && (
          <PollCard poll={message.poll} messageId={message.id} />
        )}
        {message.type === 'POLL_RESULT' && (
          <PollResultCard content={message.content} />
        )}

        {(message.reactions?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.reactions!.map(r => (
              <button key={String(r.emoji)}
                onClick={() => setReacted(p => ({ ...p, [String(r.emoji)]: !p[String(r.emoji)] }))}
                className={clsx('reaction-pill', reacted[String(r.emoji)] && 'active')}>
                <span>{String(r.emoji)}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ActionBar />
    </div>
  )

  return (
    <div className={`message-row flex gap-3 rounded-md px-2 group relative ${compactMode ? 'py-0.5' : 'py-1.5'}${isAdminMsg ? ' admin-msg' : ''}`}
      style={isAdminMsg ? { background: 'rgba(124,58,237,0.07)', borderLeft: '2px solid #7c3aed' } : {}}>
      {isAdminMsg ? (
        <div className="mt-0.5 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold"
          style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', fontSize: 14 }}>
          ⚡
        </div>
      ) : (
        <UserAvatar user={message.author} size={36} showStatus={false} className="mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <ReplyBar />
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-semibold" style={{ color: isAdminMsg ? '#a78bfa' : (topRole?.color ?? 'var(--eb-text1)') }}>
            {isAdminMsg ? 'Administrator Aplikacji' : message.author.displayName}
          </span>
          {isAdminMsg && (
            <span className="role-badge" style={{
              background: 'rgba(124,58,237,0.18)', color: '#a78bfa',
              border: '0.5px solid rgba(124,58,237,0.5)', fontSize: 9,
            }}>⚡ ADMIN</span>
          )}
          {!isAdminMsg && topRole && topRole.name !== 'CZŁONEK' && (
            <span className="role-badge" style={{
              background: `${topRole.color}22`,
              color: topRole.color,
              border: `0.5px solid ${topRole.color}44`,
            }}>{topRole.name}</span>
          )}
          {isBot && !isAdminMsg && (
            <span className="role-badge" style={{
              background: 'rgba(34,197,94,0.12)', color: 'var(--eb-online)',
              border: '0.5px solid rgba(34,197,94,0.3)'
            }}>BOT</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--eb-text3)' }}>{timeStr}</span>
        </div>

        {editing ? (
          <EditInput initial={message.content} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
        ) : message.type === 'POLL_RESULT' ? null : message.content ? (
          isGiphyUrl(message.content) ? (
            <div className="mt-1">
              <img src={message.content.trim()} alt="GIF" className="rounded-xl max-h-64 max-w-xs object-contain" style={{ display: 'block' }} />
            </div>
          ) : (
            <div className="text-sm leading-relaxed" style={{ color: 'var(--eb-text1)' }}>
              {parseContent(message.content, customEmoji)}
              <EditedMark />
              <PinBadge />
            </div>
          )
        ) : null}

        {message.embeds?.map(embed => embed.warEmbed && (
          <WarEmbed key={embed.id} embed={embed.warEmbed} />
        ))}

        <AttachmentsBlock attachments={message.attachments} />

        {message.type === 'POLL' && message.poll && (
          <PollCard poll={message.poll} messageId={message.id} />
        )}
        {message.type === 'POLL_RESULT' && (
          <PollResultCard content={message.content} />
        )}

        {(message.reactions?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.reactions!.map(r => (
              <button key={String(r.emoji)}
                onClick={() => setReacted(p => ({ ...p, [String(r.emoji)]: !p[String(r.emoji)] }))}
                className={clsx('reaction-pill', reacted[String(r.emoji)] && 'active')}>
                <span>{String(r.emoji)}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ActionBar />
    </div>
  )
}
