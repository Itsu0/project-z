'use client'
import { useEffect, useRef, useState } from 'react'
import { useSocket } from '@/hooks/useSocket'

interface Pt { x: number; y: number }          // znormalizowane 0..1
interface Stroke { id: string; color: string; size: number; erase: boolean; points: Pt[] }

const BOARD_BG = '#faf8fa'
const COLORS = ['#1a1a1f', '#dc2626', '#f59e0b', '#22c55e', '#4a9eff', '#a855f7', '#ec4899', '#ffffff']

export function Whiteboard({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const { emit, on, off } = useSocket()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef<Stroke | null>(null)
  const clientId = useRef(Math.random().toString(36).slice(2))
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize]   = useState(6)
  const [tool, setTool]   = useState<'pen' | 'eraser'>('pen')
  const toolRef = useRef(tool), colorRef = useRef(color), sizeRef = useRef(size)
  toolRef.current = tool; colorRef.current = color; sizeRef.current = size

  function ctx() { return canvasRef.current!.getContext('2d')! }
  function dims() { const r = canvasRef.current!.getBoundingClientRect(); return { w: r.width, h: r.height } }

  function setup() {
    const c = canvasRef.current!; const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr)
    ctx().setTransform(dpr, 0, 0, dpr, 0, 0)
    redraw()
  }
  function seg(s: Stroke, a: Pt, b: Pt) {
    const { w, h } = dims(); const g = ctx()
    g.strokeStyle = s.erase ? BOARD_BG : s.color
    g.lineWidth = Math.max(1, s.size * (w / 1000)); g.lineCap = 'round'; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(a.x * w, a.y * h); g.lineTo(b.x * w, b.y * h); g.stroke()
  }
  function dot(s: Stroke, p: Pt) {
    const { w, h } = dims(); const g = ctx()
    g.fillStyle = s.erase ? BOARD_BG : s.color
    g.beginPath(); g.arc(p.x * w, p.y * h, Math.max(0.5, s.size * (w / 1000) / 2), 0, 7); g.fill()
  }
  function redraw() {
    const { w, h } = dims(); const g = ctx()
    g.clearRect(0, 0, w, h); g.fillStyle = BOARD_BG; g.fillRect(0, 0, w, h)
    for (const s of strokesRef.current) {
      if (s.points.length === 1) dot(s, s.points[0])
      else for (let i = 1; i < s.points.length; i++) seg(s, s.points[i - 1], s.points[i])
    }
  }

  // ── Sync ──
  useEffect(() => {
    emit('WB_JOIN', channelId)
    const onState = (d: any) => { if (d.channelId !== channelId) return; strokesRef.current = d.strokes ?? []; redraw() }
    const onOp = (d: any) => {
      if (d.channelId !== channelId) return
      applyRemote(d.op)
    }
    on('WB_STATE', onState); on('WB_OP', onOp)
    return () => { off('WB_STATE', onState); off('WB_OP', onOp); emit('WB_LEAVE', channelId) }
  }, [channelId])

  function applyRemote(op: any) {
    const strokes = strokesRef.current
    if (op.t === 'begin') {
      const s: Stroke = { id: op.id, color: op.color, size: op.size, erase: op.erase, points: [op.p] }
      strokes.push(s); dot(s, op.p)
    } else if (op.t === 'point') {
      const s = strokes.find(x => x.id === op.id)
      if (s) { const prev = s.points[s.points.length - 1]; s.points.push(op.p); seg(s, prev, op.p) }
    } else if (op.t === 'undo') {
      strokesRef.current = strokes.filter(x => x.id !== op.id); redraw()
    } else if (op.t === 'clear') {
      strokesRef.current = []; redraw()
    }
  }

  function sendOp(op: any) { emit('WB_OP', { channelId, op }) }

  function pos(e: React.PointerEvent): Pt {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: +((e.clientX - r.left) / r.width).toFixed(4), y: +((e.clientY - r.top) / r.height).toFixed(4) }
  }
  function onDown(e: React.PointerEvent) {
    canvasRef.current!.setPointerCapture(e.pointerId)
    const p = pos(e)
    const s: Stroke = { id: clientId.current + '-' + Date.now() + Math.random().toString(36).slice(2, 5), color: colorRef.current, size: sizeRef.current, erase: toolRef.current === 'eraser', points: [p] }
    strokesRef.current.push(s); drawingRef.current = s; dot(s, p)
    sendOp({ t: 'begin', id: s.id, color: s.color, size: s.size, erase: s.erase, p })
  }
  function onMove(e: React.PointerEvent) {
    const s = drawingRef.current; if (!s) return
    const p = pos(e); const prev = s.points[s.points.length - 1]
    s.points.push(p); seg(s, prev, p); sendOp({ t: 'point', id: s.id, p })
  }
  function onUp() { drawingRef.current = null }

  function undo() {
    // cofnij ostatnie pociągnięcie TEGO klienta
    const mine = [...strokesRef.current].reverse().find(s => s.id.startsWith(clientId.current))
    if (!mine) return
    strokesRef.current = strokesRef.current.filter(s => s.id !== mine.id); redraw()
    sendOp({ t: 'undo', id: mine.id })
  }
  function clearAll() { strokesRef.current = []; redraw(); sendOp({ t: 'clear' }) }

  useEffect(() => { setup(); const r = () => setup(); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r) }, [])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: 'var(--eb-bg0)' }}>
      <div className="flex items-center gap-2 px-3 h-12 flex-shrink-0" style={{ background: 'var(--eb-bg1)', borderBottom: '0.5px solid var(--eb-border2)' }}>
        <span className="text-sm font-semibold mr-2" style={{ color: 'var(--eb-text1)' }}>🎨 Tablica</span>
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('pen') }}
              className="w-6 h-6 rounded-lg transition-transform"
              style={{ background: c, border: c === '#ffffff' ? '2px solid #555' : '2px solid transparent', outline: color === c && tool === 'pen' ? '2px solid #fff' : 'none', outlineOffset: 1, transform: color === c && tool === 'pen' ? 'scale(1.12)' : 'scale(1)' }} />
          ))}
        </div>
        <div className="w-px h-6 mx-1" style={{ background: 'var(--eb-border2)' }} />
        <button onClick={() => setTool('eraser')} className="ghost-btn px-2.5 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: tool === 'eraser' ? 'rgba(168,85,247,0.15)' : 'var(--eb-bg3)', color: tool === 'eraser' ? '#a855f7' : 'var(--eb-text3)', border: '0.5px solid var(--eb-border2)' }}>🩹 Gumka</button>
        <input type="range" min={2} max={40} value={size} onChange={e => setSize(Number(e.target.value))} className="w-24 accent-[#a855f7]" />
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--eb-text3)' }}>{size}px</span>
        <div className="w-px h-6 mx-1" style={{ background: 'var(--eb-border2)' }} />
        <button onClick={undo} className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text2)', border: '0.5px solid var(--eb-border2)' }}>↶ Cofnij</button>
        <button onClick={clearAll} className="px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--eb-bg3)', color: 'var(--eb-text2)', border: '0.5px solid var(--eb-border2)' }}>🗑 Wyczyść</button>
        <button onClick={onClose} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--eb-accent2)', border: '0.5px solid rgba(220,38,38,0.3)' }}>Zamknij ✕</button>
      </div>
      <div className="flex-1 relative m-3 rounded-2xl overflow-hidden" style={{ border: '0.5px solid var(--eb-border2)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          className="absolute inset-0 w-full h-full" style={{ touchAction: 'none', cursor: 'crosshair' }} />
      </div>
    </div>
  )
}
