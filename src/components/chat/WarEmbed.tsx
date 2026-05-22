'use client'
import type { WarEmbed as WarEmbedType } from '@/types'
import { useState } from 'react'

interface Props {
  embed: WarEmbedType
}

const WEAPONS = ['Miecz', 'Łuk', 'Topór', 'Kosa', 'Tarcza + Miecz', 'Włócznia', 'Berło', 'Sztylet']

export function WarEmbed({ embed }: Props) {
  const [registered, setRegistered] = useState(embed.userRegistered ?? false)
  const [weapon, setWeapon] = useState(embed.userWeapon ?? '')
  const [showWeapons, setShowWeapons] = useState(false)
  const date = new Date(embed.dateTime)
  const dateStr = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth()+1).toString().padStart(2, '0')} — ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`

  return (
    <div className="ember-card p-3.5 max-w-sm mt-2">
      {}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="w-4 h-4 rounded-[4px] flex items-center justify-center text-white text-[9px] font-bold"
          style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>Q</div>
        <span style={{ fontSize: 10, color: 'var(--eb-text2)' }}>The Quinfall · System Wojen</span>
      </div>

      {}
      <div className="flex items-start justify-between gap-4 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#dc2626,#f59e0b)' }}>⚔</div>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--eb-text1)' }}>
              Wojna {dateStr}
            </div>
            <div style={{ fontSize: 10, color: 'var(--eb-text2)' }}>vs {embed.opponent} · Mapa {embed.map}</div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold text-base" style={{ color: 'var(--eb-accent)' }}>
            {embed.currentPlayers}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--eb-text2)' }}>/{embed.maxPlayers}</span>
          </div>
          {embed.reservePlayers > 0 && (
            <div style={{ fontSize: 9, color: 'var(--eb-text3)' }}>+{embed.reservePlayers} rezerwa</div>
          )}
        </div>
      </div>

      {}
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] mb-3"
        style={{ background: 'rgba(0,0,0,0.25)' }}>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full" style={{ width: `${embed.progress}%`, background: 'linear-gradient(90deg,#dc2626,#f59e0b)' }} />
        </div>
        <span style={{ fontSize: 10, color: 'var(--eb-accent)', fontWeight: 500 }}>{embed.progress}%</span>
      </div>

      {}
      {showWeapons && (
        <div className="mb-2.5 grid grid-cols-2 gap-1">
          {WEAPONS.map(w => (
            <button
              key={w}
              onClick={() => { setWeapon(w); setShowWeapons(false) }}
              className="px-2 py-1.5 rounded-lg text-xs text-left transition-colors"
              style={{
                background: weapon === w ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${weapon === w ? 'rgba(245,158,11,0.4)' : 'var(--eb-border)'}`,
                color: weapon === w ? 'var(--eb-accent)' : 'var(--eb-text2)',
              }}
            >
              {w}
            </button>
          ))}
        </div>
      )}

      {}
      <div className="flex gap-2">
        <button
          onClick={() => setRegistered(!registered)}
          className="ember-btn flex-1 text-center"
          style={registered ? { background: 'rgba(220,38,38,0.3)', border: '0.5px solid rgba(220,38,38,0.4)' } : undefined}
        >
          {registered ? '✓ Zapisany' : 'Zapisz mnie'}
        </button>
        <button
          onClick={() => setShowWeapons(!showWeapons)}
          className="ember-btn-ghost flex items-center gap-1.5"
        >
          ⚔ {weapon || 'Wybierz broń'}
        </button>
      </div>
    </div>
  )
}
