'use client'
import { useEffect, useState, useCallback } from 'react'
import { useStore, RealMember } from '@/lib/store'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { MemberActions } from '@/components/moderation/ModerationMenu'
import { usePermissions } from '@/hooks/usePermissions'
import { useSocket } from '@/hooks/useSocket'
import { useT } from '@/lib/i18n'

const ROLE_ORDER_LIST = ['Administrator', 'Moderator', 'Członek', 'Do Weryfikacji']

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface MuteInfo {
  userId: string
  expiresAt: string
  reason: string | null
}

const ROLE_META: Record<string, { color: string; icon: string }> = {
  'Administrator': { color: '#f87171', icon: '👑' },
  'Moderator':     { color: '#fb923c', icon: '🛡' },
  'Członek':       { color: '#60a5fa', icon: '✅' },
  'Do Weryfikacji':{ color: '#94a3b8', icon: '⏳' },
}

function MuteTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    const update = () => {

      const raw = expiresAt.endsWith('Z') || expiresAt.includes('+') ? expiresAt : expiresAt + 'Z'
      const ms = new Date(raw).getTime() - Date.now()
      if (ms <= 0) { setRemaining(''); return }
      const totalMins = Math.floor(ms / 60000)
      const secs = Math.floor((ms % 60000) / 1000)
      if (totalMins >= 60) setRemaining(`${Math.floor(totalMins / 60)}h ${totalMins % 60}m`)
      else if (totalMins > 0) setRemaining(`${totalMins}m ${secs}s`)
      else setRemaining(`${secs}s`)
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [expiresAt])
  if (!remaining) return null
  return (
    <span title={`Wyciszony przez ${remaining}`}
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '0.5px solid rgba(251,146,60,0.3)' }}>
      🔇 {remaining}
    </span>
  )
}

function RoleBadge({ roleName }: { roleName: string }) {
  const meta = ROLE_META[roleName]
  if (!meta) return null
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{
        background: `${meta.color}18`,
        color: meta.color,
        border: `0.5px solid ${meta.color}40`,
      }}>
      {meta.icon} {roleName}
    </span>
  )
}

function MemberRow({ member, serverId, currentUserId, canKick, canBan, canMute, canManageRoles, isAdmin, memberRole, muteInfo, onRoleChanged }: {
  member: RealMember
  serverId: string
  currentUserId: string
  canKick: boolean
  canBan: boolean
  canMute: boolean
  canManageRoles: boolean
  isAdmin: boolean
  memberRole: string | null
  muteInfo: MuteInfo | null
  onRoleChanged: (userId: string, newRole: string | null) => void
}) {
  const offline = member.status === 'offline'
  const roleMeta = memberRole ? ROLE_META[memberRole] : null

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group hover:bg-white/[0.04]"
      style={{ opacity: offline ? 0.5 : 1 }}>
      <UserAvatar
        user={{
          displayName: member.nickname ?? member.display_name,
          avatar: member.avatar_url ?? undefined,
          avatarColor: member.avatar_color,
          status: member.status as any,
        }}
        size={28} showStatus={!offline}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium truncate"
            style={{ color: roleMeta?.color ?? 'var(--eb-text1)' }}>
            {member.nickname ?? member.display_name}
          </span>
          {!!member.is_dev && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(167,139,250,0.15))', color: '#c4b5fd', border: '0.5px solid rgba(167,139,250,0.4)', letterSpacing: '0.02em' }}>
              ⚡ Dev
            </span>
          )}
          {!!member.is_mod && !member.is_dev && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '0.5px solid rgba(34,197,94,0.35)', letterSpacing: '0.02em' }}>
              🛡 Mod
            </span>
          )}
        </div>
        {member.custom_status && (
          <p className="text-[10px] truncate leading-tight mt-0.5" style={{ color: 'var(--eb-text3)' }}>
            {member.custom_status}
          </p>
        )}
        {memberRole && (
          <div className="mt-0.5 flex items-center gap-1 flex-wrap">
            <RoleBadge roleName={memberRole} />
            {muteInfo && <MuteTimer expiresAt={muteInfo.expiresAt} />}
          </div>
        )}
        {!memberRole && muteInfo && (
          <div className="mt-0.5">
            <MuteTimer expiresAt={muteInfo.expiresAt} />
          </div>
        )}
      </div>
      {/* Menu renderujemy zawsze (akcje znajomych/DM są uniwersalne; mod-akcje
          pokazują się warunkowo wewnątrz). MemberActions sam zwraca null dla siebie. */}
      <MemberActions
        member={{ userId: member.user_id, displayName: member.display_name, username: member.username }}
        serverId={serverId}
        currentUserId={currentUserId}
        canKick={canKick}
        canBan={canBan}
        canMute={canMute}
        canManageRoles={canManageRoles}
        isAdmin={isAdmin}
        currentRole={memberRole}
        onRoleChanged={onRoleChanged}
      />
    </div>
  )
}

export function MembersPanel() {
  const t = useT()
  const { currentServerId, members, setMembers, addMember, removeMember, setChannels, currentUser, servers, token } = useStore()
  const serverMembers = currentServerId ? (members[currentServerId] ?? []) : []
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const currentServer = servers.find(s => s.id === currentServerId)
  const { canKick, canBan, canMute, canManageRoles, isAdmin } = usePermissions(currentServerId ?? null)
  const { on, off } = useSocket()
  const [mutes, setMutes] = useState<MuteInfo[]>([])

  const loadMutes = useCallback(async () => {
    if (!token || !currentServerId) return
    try {
      const res = await fetch(`${BASE}/api/notifications/mutes/${currentServerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setMutes((data.mutes ?? []).map((m: any) => ({
        userId: m.user_id,
        expiresAt: m.expires_at,
        reason: m.reason,
      })))
    } catch {}
  }, [token, currentServerId])

  useEffect(() => { loadMutes() }, [loadMutes])

  useEffect(() => {
    if (!token || !currentServerId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${BASE}/api/servers/${currentServerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (Array.isArray(data.members)) setMembers(currentServerId, data.members)
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [currentServerId, token, setMembers])

  useEffect(() => {
    const onJoin  = (data: any) => {
      if (data.serverId !== currentServerId) return
      if (data.member) addMember(data.serverId, data.member)
    }
    const onLeave = (data: any) => {
      if (data.serverId !== currentServerId) return
      if (data.userId)  removeMember(data.serverId, data.userId)
    }
    on('MEMBER_JOIN',  onJoin)
    on('MEMBER_LEAVE', onLeave)
    return () => {
      off('MEMBER_JOIN',  onJoin)
      off('MEMBER_LEAVE', onLeave)
    }
  }, [currentServerId, on, off, addMember, removeMember])

  useEffect(() => {
    const handler = async (data: { serverId: string; userId: string; roles: any[] }) => {
      if (data.serverId !== currentServerId) return

      const topRole = data.roles
        .filter((r: any) => ROLE_META[r.name])
        .sort((a: any, b: any) => ROLE_ORDER_LIST.indexOf(a.name) - ROLE_ORDER_LIST.indexOf(b.name))[0]
      setMemberRoles(prev => ({ ...prev, [data.userId]: topRole?.name ?? '' }))

      if (data.userId === currentUser?.id && token && currentServerId) {
        try {
          const res = await fetch(`${BASE}/api/servers/${currentServerId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const d = await res.json()
            if (Array.isArray(d.channels)) setChannels(currentServerId, d.channels)
          }
        } catch {}
      }
    }
    on('ROLE_UPDATE', handler)
    return () => { off('ROLE_UPDATE', handler) }
  }, [currentServerId, currentUser?.id, token, on, off, setChannels])

  useEffect(() => {
    const handler = (data: { userId: string; expiresAt: string; reason: string | null }) => {
      setMutes(prev => {
        const filtered = prev.filter(m => m.userId !== data.userId)
        if (data.expiresAt) filtered.push({ userId: data.userId, expiresAt: data.expiresAt, reason: data.reason })
        return filtered
      })
    }
    on('MEMBER_MUTED', handler)
    return () => { off('MEMBER_MUTED', handler) }
  }, [on, off])

  const fetchRoles = useCallback(async () => {
    if (!token || !currentServerId || serverMembers.length === 0) return
    const result: Record<string, string> = {}
    await Promise.all(
      serverMembers.map(async m => {
        try {
          const res = await fetch(`${BASE}/api/servers/${currentServerId}/members/${m.user_id}/roles`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await res.json()
          const roles: any[] = data.roles ?? []
          const sorted = roles.filter(r => ROLE_META[r.name]).sort((a, b) => b.position - a.position)
          if (sorted[0]) result[m.user_id] = sorted[0].name
        } catch {}
      })
    )
    setMemberRoles(result)
  }, [token, currentServerId, serverMembers.length])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const filtered = serverMembers.filter(m =>
    (m.nickname ?? m.display_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const ROLE_ORDER = ['Administrator', 'Moderator', 'Członek', 'Do Weryfikacji']
  const sorted = [...filtered].sort((a, b) => {
    const ra = memberRoles[a.user_id] ?? ''
    const rb = memberRoles[b.user_id] ?? ''
    const ia = ROLE_ORDER.indexOf(ra)
    const ib = ROLE_ORDER.indexOf(rb)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const online  = sorted.filter(m => m.status !== 'offline')
  const offline = sorted.filter(m => m.status === 'offline')

  return (
    <aside className="flex flex-col border-l"
      style={{ width: 220, background: 'var(--eb-bg1)', borderColor: 'var(--eb-border)' }}>
      <div className="flex items-center justify-between px-3.5 py-3 border-b"
        style={{ borderColor: 'var(--eb-border)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--eb-text3)' }}>
          {t('members.title')}
        </span>
        <span style={{ fontSize: 10, color: 'var(--eb-online)', fontWeight: 500 }}>{online.length} online</span>
      </div>

      <div className="px-2.5 py-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ember-input w-full py-1.5 px-2.5"
          style={{ fontSize: 11 }}
          placeholder={t('serverSettings.members.search')}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {online.length > 0 && (
          <div className="mb-3">
            <div className="px-2 py-1 text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--eb-text3)' }}>
              {t('members.online', { n: online.length })}
            </div>
            {online.map(m => (
              <MemberRow
                key={m.user_id}
                member={m}
                serverId={currentServerId ?? ''}
                currentUserId={currentUser?.id ?? ''}
                canKick={canKick}
                canBan={canBan}
                canMute={canMute}
                canManageRoles={canManageRoles || canKick}
                isAdmin={isAdmin}
                memberRole={memberRoles[m.user_id] ?? null}
                muteInfo={mutes.find(mu => mu.userId === m.user_id) ?? null}
                onRoleChanged={(userId, newRole) => setMemberRoles(prev => ({ ...prev, [userId]: newRole ?? '' }))}
              />
            ))}
          </div>
        )}
        {offline.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--eb-text3)' }}>
              {t('members.offline', { n: offline.length })}
            </div>
            {offline.map(m => (
              <MemberRow
                key={m.user_id}
                member={m}
                serverId={currentServerId ?? ''}
                currentUserId={currentUser?.id ?? ''}
                canKick={canKick}
                canBan={canBan}
                canMute={canMute}
                canManageRoles={canManageRoles || canKick}
                isAdmin={isAdmin}
                memberRole={memberRoles[m.user_id] ?? null}
                muteInfo={mutes.find(mu => mu.userId === m.user_id) ?? null}
                onRoleChanged={(userId, newRole) => setMemberRoles(prev => ({ ...prev, [userId]: newRole ?? '' }))}
              />
            ))}
          </div>
        )}
        {serverMembers.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <span style={{ fontSize: 12, color: 'var(--eb-text3)' }}>{t('members.noMembers')}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
