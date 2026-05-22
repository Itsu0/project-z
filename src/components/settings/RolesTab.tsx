'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { usePermissions } from '@/hooks/usePermissions'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function api(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Błąd serwera')
  return data
}

export const FIXED_ROLES = [
  {
    name: 'Administrator',
    color: '#f87171',
    icon: '👑',
    description: 'Pełne uprawnienia do wszystkiego na serwerze',
    permissions: [
      'ADMINISTRATOR', 'VIEW_CHANNELS', 'MANAGE_CHANNELS', 'MANAGE_ROLES',
      'MANAGE_SERVER', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_INVITES',
      'SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'ADD_REACTIONS',
      'MENTION_EVERYONE', 'MANAGE_MESSAGES', 'READ_HISTORY',
      'CONNECT', 'SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS', 'STREAM', 'USE_VOICE_ACTIVITY',
    ],
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  {
    name: 'Moderator',
    color: '#fb923c',
    icon: '🛡',
    description: 'Może wyrzucać, banować i wyciszać członków na określony czas',
    permissions: [
      'VIEW_CHANNELS', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_INVITES',
      'SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'ADD_REACTIONS',
      'MANAGE_MESSAGES', 'READ_HISTORY',
      'CONNECT', 'SPEAK', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS', 'MOVE_MEMBERS', 'STREAM', 'USE_VOICE_ACTIVITY',
    ],
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  {
    name: 'Członek',
    color: '#60a5fa',
    icon: '✅',
    description: 'Zweryfikowana osoba — może pisać, czytać i korzystać z kanałów głosowych',
    permissions: [
      'VIEW_CHANNELS', 'SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES',
      'ADD_REACTIONS', 'READ_HISTORY', 'CONNECT', 'SPEAK', 'STREAM', 'USE_VOICE_ACTIVITY',
    ],
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    name: 'Do Weryfikacji',
    color: '#94a3b8',
    icon: '⏳',
    description: 'Nowy użytkownik — brak uprawnień do pisania i głosowania, czeka na weryfikację',
    permissions: [],
    badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  },
]

function RoleCard({ role, dbRole }: { role: typeof FIXED_ROLES[0]; dbRole: any | null }) {
  const PERM_LABELS: Record<string, string> = {
    ADMINISTRATOR: 'Administrator', VIEW_CHANNELS: 'Przeglądaj kanały',
    MANAGE_CHANNELS: 'Zarządzaj kanałami', MANAGE_ROLES: 'Zarządzaj rolami',
    MANAGE_SERVER: 'Zarządzaj serwerem', KICK_MEMBERS: 'Wyrzucaj',
    BAN_MEMBERS: 'Banuj', MANAGE_INVITES: 'Zaproszenia',
    SEND_MESSAGES: 'Pisz wiadomości', EMBED_LINKS: 'Linki',
    ATTACH_FILES: 'Pliki', ADD_REACTIONS: 'Reakcje',
    MENTION_EVERYONE: '@everyone', MANAGE_MESSAGES: 'Zarządzaj wiad.',
    READ_HISTORY: 'Historia', CONNECT: 'Dołącz do voice',
    SPEAK: 'Mów', MUTE_MEMBERS: 'Wyciszaj', DEAFEN_MEMBERS: 'Ogłuszaj',
    MOVE_MEMBERS: 'Przenoś', STREAM: 'Stream', USE_VOICE_ACTIVITY: 'VAD',
  }

  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: `0.5px solid ${role.color}30`, background: `${role.color}08` }}>
      {}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${role.color}20` }}>
          {role.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: role.color }}>{role.name}</span>
            {!dbRole && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '0.5px solid rgba(220,38,38,0.3)' }}>
                Nie utworzona
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--eb-text3)' }}>{role.description}</p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--eb-text3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {}
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: `0.5px solid ${role.color}20` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mt-3 mb-2" style={{ color: 'var(--eb-text3)' }}>
            Uprawnienia ({role.permissions.length})
          </p>
          {role.permissions.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--eb-text3)' }}>Brak uprawnień — tylko wgląd do serwera</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {role.permissions.map(p => (
                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${role.color}15`, color: role.color, border: `0.5px solid ${role.color}30` }}>
                  {PERM_LABELS[p] ?? p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MemberRoleAssigner({ member, serverId, dbRoles, onClose }: {
  member: any; serverId: string; dbRoles: any[]; onClose: () => void
}) {
  const { token } = useStore()
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!token) return
    api(`/api/servers/${serverId}/members/${member.user_id}/roles`, token)
      .then(d => {
        const roles: any[] = d.roles ?? []

        const sorted = roles.sort((a, b) => b.position - a.position)
        setCurrentRoleId(sorted[0]?.id ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, serverId, member.user_id])

  async function assignRole(roleId: string) {
    if (!token || saving) return
    setSaving(true)
    try {

      const allRoles = await api(`/api/servers/${serverId}/members/${member.user_id}/roles`, token)
      for (const r of allRoles.roles ?? []) {
        await api(`/api/servers/${serverId}/members/${member.user_id}/roles/${r.id}`, token, { method: 'DELETE' })
      }

      await api(`/api/servers/${serverId}/members/${member.user_id}/roles/${roleId}`, token, { method: 'POST' })
      setCurrentRoleId(roleId)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function removeAllRoles() {
    if (!token || saving) return
    setSaving(true)
    try {
      const allRoles = await api(`/api/servers/${serverId}/members/${member.user_id}/roles`, token)
      for (const r of allRoles.roles ?? []) {
        await api(`/api/servers/${serverId}/members/${member.user_id}/roles/${r.id}`, token, { method: 'DELETE' })
      }
      setCurrentRoleId(null)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  const assignableDbRoles = FIXED_ROLES
    .map(fr => ({ fixed: fr, db: dbRoles.find(r => r.name === fr.name) }))
    .filter(x => x.db)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>

        {}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ background: member.avatar_color ?? 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>
              {member.display_name.slice(0,1).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>{member.display_name}</div>
              <div className="text-xs" style={{ color: 'var(--eb-text3)' }}>@{member.username}</div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: 'var(--eb-text3)' }}>✕</button>
        </div>

        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--eb-text2)' }}>
          Wybierz rolę
        </p>

        {loading ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--eb-text3)' }}>Ładowanie...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {assignableDbRoles.map(({ fixed, db }) => {
              const isSelected = currentRoleId === db.id
              return (
                <button
                  key={db.id}
                  onClick={() => isSelected ? removeAllRoles() : assignRole(db.id)}
                  disabled={saving}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all"
                  style={{
                    background: isSelected ? `${fixed.color}18` : 'rgba(255,255,255,0.03)',
                    border: `0.5px solid ${isSelected ? fixed.color + '50' : 'var(--eb-border)'}`,
                    opacity: saving ? 0.7 : 1,
                  }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${fixed.color}15` }}>
                    {fixed.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: isSelected ? fixed.color : 'var(--eb-text1)' }}>
                      {fixed.name}
                    </div>
                    <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--eb-text3)' }}>
                      {fixed.permissions.length === 0 ? 'Brak uprawnień' : `${fixed.permissions.length} uprawnień`}
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: isSelected ? fixed.color : 'rgba(255,255,255,0.08)',
                      border: isSelected ? 'none' : '1.5px solid var(--eb-border2)',
                    }}>
                    {isSelected && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}

            {}
            <button
              onClick={removeAllRoles}
              disabled={saving || currentRoleId === null}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
              style={{
                background: currentRoleId === null ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: `0.5px solid ${currentRoleId === null ? 'var(--eb-border2)' : 'var(--eb-border)'}`,
                opacity: saving ? 0.7 : 1,
              }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}>⬜</div>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: currentRoleId === null ? 'var(--eb-text1)' : 'var(--eb-text2)' }}>
                  Brak roli
                </div>
                <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>Usuń wszystkie role</div>
              </div>
              {currentRoleId === null && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--eb-text2)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </button>
          </div>
        )}

        {saving && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--eb-accent)" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>Zapisywanie...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function RolesTab({ server }: { server: any }) {
  const { token, members } = useStore()
  const serverMembers = members[server.id] ?? []
  const { canManageRoles, isAdmin } = usePermissions(server.id)
  const [dbRoles,      setDbRoles]      = useState<any[]>([])
  const [loaded,       setLoaded]       = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [createMsg,    setCreateMsg]    = useState('')
  const [assignMember, setAssignMember] = useState<any | null>(null)
  const [activeView, setActiveView] = useState<'roles' | 'members'>('members')

  useEffect(() => {
    if (!token || loaded) return
    api(`/api/servers/${server.id}`, token)
      .then(d => { setDbRoles(d.roles ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [token, server.id, loaded])

  async function initRoles() {
    if (!token) return
    setCreating(true); setCreateMsg('')
    let created = 0
    try {
      for (let i = 0; i < FIXED_ROLES.length; i++) {
        const fr = FIXED_ROLES[i]
        const exists = dbRoles.find(r => r.name === fr.name)
        if (!exists) {
          const data = await api(`/api/servers/${server.id}/roles`, token, {
            method: 'POST',
            body: JSON.stringify({
              name: fr.name,
              color: fr.color,
              permissions: fr.permissions,
              position: FIXED_ROLES.length - i,
            }),
          })
          setDbRoles(prev => [...prev, data.role])
          created++
        }
      }
      setCreateMsg(created > 0 ? `✓ Utworzono ${created} ${created === 1 ? 'rolę' : 'role'}` : '✓ Wszystkie role już istnieją')
    } catch (e: any) { setCreateMsg(e.message) }
    finally { setCreating(false) }
  }

  const missingRoles = FIXED_ROLES.filter(fr => !dbRoles.find(r => r.name === fr.name))

  return (
    <div className="flex flex-col gap-5">

      {}
      {loaded && missingRoles.length > 0 && (
        <div className="p-4 rounded-2xl" style={{ background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.3)' }}>
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--eb-accent)' }}>
                Brakuje {missingRoles.length} {missingRoles.length === 1 ? 'roli' : 'ról'}
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--eb-text2)' }}>
                Role <strong>{missingRoles.map(r => r.name).join(', ')}</strong> nie zostały jeszcze utworzone w bazie danych.
              </p>
              <div className="flex items-center gap-3">
                <button onClick={initRoles} disabled={creating} className="ember-btn px-4 py-2 text-xs">
                  {creating ? 'Tworzenie...' : '🚀 Utwórz brakujące role'}
                </button>
                {createMsg && <span className="text-xs" style={{ color: createMsg.startsWith('✓') ? 'var(--eb-online)' : 'var(--eb-accent2)' }}>{createMsg}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {isAdmin && (
          <button onClick={() => setActiveView('roles')}
            className="flex-1 py-1.5 text-xs rounded-lg font-medium transition-all"
            style={activeView === 'roles'
              ? { background: 'var(--eb-gradient)', color: '#fff' }
              : { color: 'var(--eb-text2)' }}>
            Przegląd ról
          </button>
        )}
        <button onClick={() => setActiveView('members')}
          className="flex-1 py-1.5 text-xs rounded-lg font-medium transition-all"
          style={activeView === 'members'
            ? { background: 'var(--eb-gradient)', color: '#fff' }
            : { color: 'var(--eb-text2)' }}>
          Przypisz role ({serverMembers.length})
        </button>
      </div>

      {}
      {activeView === 'roles' && (
        <div className="flex flex-col gap-3">
          {FIXED_ROLES.map(fr => (
            <RoleCard
              key={fr.name}
              role={fr}
              dbRole={dbRoles.find(r => r.name === fr.name) ?? null}
            />
          ))}
          <p className="text-xs text-center pt-1" style={{ color: 'var(--eb-text3)' }}>
            System 4 stałych ról — uprawnienia są predefiniowane i nie można ich zmieniać
          </p>
        </div>
      )}

      {}
      {activeView === 'members' && (
        <div className="flex flex-col gap-2">
          {serverMembers.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--eb-text3)' }}>Brak członków</p>
          ) : serverMembers.map(m => {
            return (
              <button key={m.user_id}
                onClick={() => setAssignMember(m)}
                disabled={dbRoles.filter(r => FIXED_ROLES.find(fr => fr.name === r.name)).length === 0}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group hover:bg-white/[0.03]"
                style={{ border: '0.5px solid var(--eb-border)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: m.avatar_color ?? 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>
                  {m.display_name.slice(0,1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--eb-text1)' }}>{m.display_name}</div>
                  <div className="text-xs" style={{ color: 'var(--eb-text3)' }}>@{m.username} · {m.status ?? 'offline'}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--eb-accent)' }}>
                  Zmień rolę
                </span>
              </button>
            )
          })}
        </div>
      )}

      {}
      {assignMember && (
        <MemberRoleAssigner
          member={assignMember}
          serverId={server.id}
          dbRoles={dbRoles}
          onClose={() => setAssignMember(null)}
        />
      )}
    </div>
  )
}
