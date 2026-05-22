'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from '@/lib/store'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const STANDARD_EMOJI: Record<string, string[]> = {
  '😀 Twarze': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  '👋 Gesty':  ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🧠','👀','👁️','👅','👄'],
  '❤️ Serca':  ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🔥','💥','✨','🎇','🎆','🌈'],
  '🎮 Aktywność': ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥊','🥋','🏒','🏑','🥍','🏏','🪃','🎯','⛳','🪁','🎣','🤿','🎽','🎿','🛷','🥌','🎮','🕹️','🎲','♟️','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻'],
  '🍕 Jedzenie': ['🍕','🍔','🍟','🌭','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🥣','🥗','🍿','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🍵','🧃','🥤','🧋','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃'],
  '🐶 Zwierzęta': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗','🪳','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️'],
  '🌍 Miejsca': ['🌍','🌎','🌏','🌐','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏗️','🏘️','🏙️','🏚️','🏛️','🏟️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏧','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🎡','🎢','💈','🎪'],
  '🚗 Transport': ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','⛽','🚨','🚥','🚦','🚧','⚓','🛟','⛵','🚤','🛥️','🛳️','⛴️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰️','🚀','🛸'],
  '💡 Obiekty': ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🗑️','🛢️','💰','💴','💵','💶','💷','💸','💳','🪙','💹','✉️','📧','📨','📩','📤','📥','📦','📫','📪','📬','📭','📮','🗳️'],
  '🔣 Symbole': ['✅','❎','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔑','🗝️','🔐','🔏','🔒','🔓','🚪','🪑','🛋️','🚽','🪠','🚿','🛁','🪤','🪒','🧴','🧷','🧹','🧺','🧻','🧼','🫧','🪣','🧽','🪥','🛒'],
}

interface Props {
  onSelect: (value: string, name?: string, type?: 'standard' | 'custom') => void
  serverId?: string
}

export function EmojiPicker({ onSelect, serverId }: Props) {
  const { token } = useStore()
  const [search,       setSearch]       = useState('')
  const [customEmoji,  setCustomEmoji]  = useState<any[]>([])
  const [activeGroup,  setActiveGroup]  = useState('😀 Twarze')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token || !serverId) return
    fetch(`${BASE}/api/servers/${serverId}/emoji`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setCustomEmoji(d.emoji ?? []))
      .catch(() => {})
  }, [token, serverId])

  const groups = useMemo(() => {
    const result: Record<string, { type: 'standard' | 'custom'; items: any[] }> = {}

    if (customEmoji.length > 0) {
      result['⭐ Serwer'] = { type: 'custom', items: customEmoji }
    }

    if (search) {
      const q = search.toLowerCase()
      const found: string[] = []
      Object.values(STANDARD_EMOJI).flat().forEach(e => {

        found.push(e)
      })
      result[`🔍 Wyniki (${found.slice(0,40).length})`] = { type: 'standard', items: found.slice(0, 40) }
    } else {
      Object.entries(STANDARD_EMOJI).forEach(([group, items]) => {
        result[group] = { type: 'standard', items }
      })
    }

    return result
  }, [customEmoji, search])

  const currentItems = groups[activeGroup] ?? groups[Object.keys(groups)[0]]

  return (
    <div ref={ref} className="rounded-2xl overflow-hidden"
      style={{
        width: 340, maxHeight: 420,
        background: 'var(--eb-bg1)',
        border: '0.5px solid var(--eb-border2)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
      }}>

      {}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Szukaj emoji..."
          className="ember-input w-full px-3 py-1.5 text-sm" />
      </div>

      {}
      <div className="flex gap-0.5 px-2 pb-2 flex-shrink-0"
        style={{ overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {Object.keys(groups).map(group => (
          <button key={group} onClick={() => setActiveGroup(group)}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: activeGroup === group ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontSize: 20,
              outline: activeGroup === group ? '1.5px solid rgba(255,255,255,0.2)' : 'none',
            }}
            title={group.replace(/^\S+ /, '')}>
            {group.split(' ')[0]}
          </button>
        ))}
      </div>

      {}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {currentItems?.type === 'custom' ? (
          <div className="grid grid-cols-7 gap-0.5">
            {currentItems.items.map((e: any) => (
              <button key={e.id}
                onClick={() => onSelect(e.url ?? e.image, e.name, 'custom')}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-all"
                title={`:${e.name}:`}>
                <img src={e.url ?? e.image} alt={e.name} className="w-7 h-7 object-contain" />
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {currentItems?.items.map((e, i) => (
              <button key={i} onClick={() => onSelect(e, undefined, 'standard')}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-all text-xl"
                title={e}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
