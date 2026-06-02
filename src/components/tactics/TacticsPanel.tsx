'use client'
import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { useStore } from '@/lib/store'
import { useSocket } from '@/hooks/useSocket'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Target { id: string; name: string; updated_at: string; updated_by_name?: string | null }

// ── Edytor współdzielony (Yjs) ───────────────────────────────────────────────
function TacticsEditor({ serverId, target, token }: { serverId: string; target: Target; token: string | null }) {
  const { emit, on, off } = useSocket()
  const taRef    = useRef<HTMLTextAreaElement>(null)
  const ydocRef  = useRef<Y.Doc | null>(null)
  const ytextRef = useRef<Y.Text | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [synced,  setSynced]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showHist, setShowHist] = useState(false)

  useEffect(() => {
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    ydocRef.current = ydoc; ytextRef.current = ytext
    setSynced(false); setCanEdit(false)

    const authH = () => (token ? { Authorization: `Bearer ${token}` } : {})

    // Lokalne zmiany Y.Doc → wyślij na serwer (pomijamy zmiany pochodzenia 'remote')
    ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote') emit('TAC_UPDATE', { targetId: target.id, update })
    })

    function render(restore?: { s: Y.RelativePosition; e: Y.RelativePosition } | null) {
      const ta = taRef.current; if (!ta) return
      ta.value = ytext.toString()
      if (restore) {
        const a = Y.createAbsolutePositionFromRelativePosition(restore.s, ydoc)
        const b = Y.createAbsolutePositionFromRelativePosition(restore.e, ydoc)
        ta.selectionStart = a ? a.index : ta.value.length
        ta.selectionEnd   = b ? b.index : ta.value.length
      }
    }
    function applyRemote(update: Uint8Array) {
      const ta = taRef.current
      let restore: any = null
      if (ta && document.activeElement === ta) {
        restore = {
          s: Y.createRelativePositionFromTypeIndex(ytext, ta.selectionStart),
          e: Y.createRelativePositionFromTypeIndex(ytext, ta.selectionEnd),
        }
      }
      Y.applyUpdate(ydoc, update, 'remote')
      render(restore)
    }

    const onSync = (d: any) => {
      if (d.targetId !== target.id) return
      setCanEdit(!!d.canEdit); setSynced(true)
      Y.applyUpdate(ydoc, new Uint8Array(d.update), 'remote')
      render(null)
    }
    const onUpd = (d: any) => { if (d.targetId === target.id) applyRemote(new Uint8Array(d.update)) }

    on('TAC_SYNC', onSync); on('TAC_UPDATE', onUpd)
    emit('TAC_JOIN', target.id)

    return () => {
      off('TAC_SYNC', onSync); off('TAC_UPDATE', onUpd)
      emit('TAC_LEAVE', target.id)
      ydoc.destroy()
      ydocRef.current = null; ytextRef.current = null
    }
  }, [target.id])

  // Wpis w textarea → diff (wspólny prefiks/sufiks) → Y.Text
  function onInput() {
    const ta = taRef.current, ytext = ytextRef.current, ydoc = ydocRef.current
    if (!ta || !ytext || !ydoc || !canEdit) return
    const oldV = ytext.toString(), newV = ta.value
    if (oldV === newV) return
    let s = 0
    while (s < oldV.length && s < newV.length && oldV[s] === newV[s]) s++
    let eo = oldV.length, en = newV.length
    while (eo > s && en > s && oldV[eo - 1] === newV[en - 1]) { eo--; en-- }
    const removed = eo - s, inserted = newV.slice(s, en)
    ydoc.transact(() => {
      if (removed > 0) ytext.delete(s, removed)
      if (inserted)    ytext.insert(s, inserted)
    })
  }

  async function saveVersion() {
    if (!ytextRef.current) return
    const content = ytextRef.current.toString()
    const label = prompt('Etykieta wersji (opcjonalnie), np. „po zmianie wroga na turtle”:') ?? ''
    setSaving(true)
    try {
      await fetch(`${BASE}/api/servers/${serverId}/tactics/${target.id}/revisions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content, label }),
      })
      setSavedAt(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }))
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 pb-2 flex-shrink-0">
        <span className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--eb-text1)' }}>{target.name}</span>
        {canEdit && (
          <button onClick={saveVersion} disabled={saving}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
            style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '0.5px solid rgba(168,85,247,0.3)' }}>
            {saving ? '…' : '💾 Zapisz wersję'}
          </button>
        )}
        <button onClick={() => setShowHist(v => !v)}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
          style={{ background: showHist ? 'var(--eb-bg4)' : 'var(--eb-bg3)', color: 'var(--eb-text2)', border: '0.5px solid var(--eb-border2)' }}>
          🕘 Historia
        </button>
      </div>

      <div className="flex items-center gap-2 px-1 pb-2 text-[10px]" style={{ color: 'var(--eb-text3)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: synced ? 'var(--eb-online)' : 'var(--eb-text3)' }} />
          {synced ? (canEdit ? 'Współedycja — zapis automatyczny' : 'Podgląd (edycja: oficerowie)') : 'Łączenie…'}
        </span>
        {savedAt && <span>· wersja zapisana {savedAt}</span>}
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <textarea ref={taRef} onInput={onInput} readOnly={!canEdit} spellCheck={false}
          placeholder={canEdit ? 'Spostrzeżenia, skład wroga, wasza taktyka…' : 'Brak treści.'}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm resize-none outline-none font-mono"
          style={{ background: 'var(--eb-bg0)', border: '0.5px solid var(--eb-border2)', color: 'var(--eb-text1)', lineHeight: 1.6 }} />
        {showHist && <RevisionList serverId={serverId} targetId={target.id} token={token} />}
      </div>
    </div>
  )
}

function RevisionList({ serverId, targetId, token }: { serverId: string; targetId: string; token: string | null }) {
  const [revs, setRevs] = useState<any[]>([])
  const [view, setView] = useState<any | null>(null)
  const authH = token ? { Authorization: `Bearer ${token}` } : undefined

  useEffect(() => {
    fetch(`${BASE}/api/servers/${serverId}/tactics/${targetId}/revisions`, { headers: authH })
      .then(r => r.json()).then(d => setRevs(d.revisions ?? [])).catch(() => {})
  }, [targetId])

  async function open(id: string) {
    const d = await fetch(`${BASE}/api/servers/${serverId}/tactics/${targetId}/revisions/${id}`, { headers: authH }).then(r => r.json())
    setView(d.revision)
  }

  return (
    <div className="w-56 flex-shrink-0 rounded-xl overflow-y-auto p-2" style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border)' }}>
      {view ? (
        <div className="flex flex-col gap-2">
          <button onClick={() => setView(null)} className="text-[11px] self-start" style={{ color: 'var(--eb-text3)' }}>← Lista wersji</button>
          <div className="text-[10px]" style={{ color: 'var(--eb-text3)' }}>{view.label || 'bez etykiety'} · {new Date(view.created_at).toLocaleString('pl-PL')}</div>
          <pre className="text-[11px] whitespace-pre-wrap break-words" style={{ color: 'var(--eb-text1)', fontFamily: 'inherit' }}>{view.content || '(pusto)'}</pre>
        </div>
      ) : revs.length === 0 ? (
        <p className="text-[11px] p-2" style={{ color: 'var(--eb-text3)' }}>Brak zapisanych wersji.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {revs.map(r => (
            <button key={r.id} onClick={() => open(r.id)} className="text-left px-2 py-1.5 rounded-lg" style={{ background: 'var(--eb-bg3)' }}>
              <div className="text-xs truncate" style={{ color: 'var(--eb-text1)' }}>{r.label || 'Wersja'}</div>
              <div className="text-[9px]" style={{ color: 'var(--eb-text3)' }}>{r.author_name ?? '—'} · {new Date(r.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TacticsPanel({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const token = useStore(s => s.token)
  const [targets, setTargets] = useState<Target[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [active, setActive]   = useState<Target | null>(null)
  const [loading, setLoading] = useState(true)
  const authH = token ? { Authorization: `Bearer ${token}` } : undefined

  async function load() {
    try {
      const d = await fetch(`${BASE}/api/servers/${serverId}/tactics`, { headers: authH }).then(r => r.json())
      setTargets(d.targets ?? []); setCanEdit(!!d.canEdit)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [serverId])

  async function addTarget() {
    const name = prompt('Nazwa przeciwnika / gildii:')?.trim()
    if (!name) return
    const r = await fetch(`${BASE}/api/servers/${serverId}/tactics`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(authH ?? {}) }, body: JSON.stringify({ name }),
    })
    const d = await r.json()
    if (r.ok && d.target) { setTargets(t => [d.target, ...t]); setActive(d.target) }
  }
  async function delTarget(id: string) {
    if (!confirm('Usunąć tego przeciwnika i jego notatki?')) return
    await fetch(`${BASE}/api/servers/${serverId}/tactics/${id}`, { method: 'DELETE', headers: authH })
    setTargets(t => t.filter(x => x.id !== id))
    if (active?.id === id) setActive(null)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full rounded-2xl flex overflow-hidden" style={{ maxWidth: 920, height: '82vh', background: 'var(--eb-bg1)', border: '0.5px solid var(--eb-border2)' }}>
        {/* Lista przeciwników */}
        <div className="flex flex-col flex-shrink-0" style={{ width: 220, background: 'var(--eb-bg0)', borderRight: '0.5px solid var(--eb-border)' }}>
          <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: 'var(--eb-border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--eb-text1)' }}>⚔️ Taktyki</span>
            {canEdit && <button onClick={addTarget} className="text-lg leading-none px-1" style={{ color: 'var(--eb-accent)' }} title="Dodaj przeciwnika">+</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? <p className="text-[11px] p-2" style={{ color: 'var(--eb-text3)' }}>Ładowanie…</p>
            : targets.length === 0 ? <p className="text-[11px] p-2" style={{ color: 'var(--eb-text3)' }}>Brak przeciwników.{canEdit ? ' Dodaj „+”.' : ''}</p>
            : targets.map(t => (
              <div key={t.id} className="group flex items-center gap-1">
                <button onClick={() => setActive(t)}
                  className="flex-1 text-left px-2.5 py-2 rounded-lg my-0.5 transition-all"
                  style={{ background: active?.id === t.id ? 'var(--eb-bg3)' : 'transparent', color: active?.id === t.id ? 'var(--eb-text1)' : 'var(--eb-text2)' }}>
                  <div className="text-xs font-medium truncate">{t.name}</div>
                  <div className="text-[9px]" style={{ color: 'var(--eb-text3)' }}>akt. {new Date(t.updated_at).toLocaleDateString('pl-PL')}</div>
                </button>
                {canEdit && <button onClick={() => delTarget(t.id)} className="opacity-0 group-hover:opacity-100 px-1 text-xs" style={{ color: 'var(--eb-accent2)' }} title="Usuń">✕</button>}
              </div>
            ))}
          </div>
        </div>

        {/* Edytor */}
        <div className="flex-1 flex flex-col p-3 min-w-0">
          <div className="flex justify-end mb-1">
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {active ? <TacticsEditor serverId={serverId} target={active} token={token} />
          : <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--eb-text3)' }}>
              <span className="text-4xl opacity-30">⚔️</span>
              <p className="text-sm">Wybierz przeciwnika z listy</p>
              <p className="text-[11px]">Notatki taktyczne — współedycja na żywo, historia wersji</p>
            </div>}
        </div>
      </div>
    </div>
  )
}
