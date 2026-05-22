'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  src: string
  title: string
  onSave: (dataUrl: string) => void
  onClose: () => void
  round?: boolean
}

export function ImageCropModal({ src, title, onSave, onClose, round = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom,    setZoom]    = useState(1)
  const [offset,  setOffset]  = useState({ x: 0, y: 0 })
  const [dragging,setDragging]= useState(false)
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const imgRef    = useRef<HTMLImageElement | null>(null)

  const SIZE = 240

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, SIZE, SIZE)

    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, SIZE, SIZE)

    const scale = zoom
    const iw = img.naturalWidth  * scale
    const ih = img.naturalHeight * scale
    const x  = SIZE / 2 - iw / 2 + offset.x
    const y  = SIZE / 2 - ih / 2 + offset.y
    ctx.drawImage(img, x, y, iw, ih)

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    if (round) {
      ctx.arc(SIZE/2, SIZE/2, SIZE/2 - 8, 0, Math.PI * 2)
    } else {
      const pad = 8
      ctx.roundRect(pad, pad, SIZE - pad*2, SIZE - pad*2, 8)
    }
    ctx.fill()
    ctx.restore()

    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (round) {
      ctx.arc(SIZE/2, SIZE/2, SIZE/2 - 8, 0, Math.PI * 2)
    } else {
      const pad = 8
      ctx.roundRect(pad, pad, SIZE - pad*2, SIZE - pad*2, 8)
    }
    ctx.stroke()
  }, [zoom, offset, round])

  useEffect(() => {
    const img = new Image()
    img.onload = () => { imgRef.current = img; draw() }
    img.src = src
  }, [src])

  useEffect(() => { draw() }, [draw])

  function onMouseDown(e: React.MouseEvent) {
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      setOffset({ x: dragStart.current.ox + e.clientX - dragStart.current.mx, y: dragStart.current.oy + e.clientY - dragStart.current.my })
    }
    const up = () => setDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging])

  function save() {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const img = imgRef.current!

    if (round) {
      ctx.beginPath()
      ctx.arc(128, 128, 128, 0, Math.PI * 2)
      ctx.clip()
    } else {
      ctx.beginPath()
      ctx.roundRect(0, 0, 256, 256, 16)
      ctx.clip()
    }

    const scale = zoom
    const iw = img.naturalWidth  * scale
    const ih = img.naturalHeight * scale
    const x  = SIZE/2 - iw/2 + offset.x
    const y  = SIZE/2 - ih/2 + offset.y

    const ratio = 256 / SIZE
    ctx.drawImage(img, x * ratio, y * ratio, iw * ratio, ih * ratio)

    onSave(canvas.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl p-5 w-full max-w-xs"
        style={{ background: 'var(--eb-bg2)', border: '0.5px solid var(--eb-border2)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--eb-text1)' }}>{title}</h3>

        {}
        <div className="flex justify-center mb-4">
          <canvas ref={canvasRef} width={SIZE} height={SIZE}
            className="rounded-xl"
            style={{ cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
            onMouseDown={onMouseDown} />
        </div>

        {}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--eb-text3)' }}>Zoom</span>
            <span className="text-xs font-mono" style={{ color: 'var(--eb-text3)' }}>{zoom.toFixed(1)}×</span>
          </div>
          <input type="range" min={0.5} max={4} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-blue-500" />
        </div>

        <p className="text-[10px] mb-4 text-center" style={{ color: 'var(--eb-text3)' }}>
          Przeciągaj obrazek · Scroll = zoom
        </p>

        <div className="flex gap-2">
          <button onClick={onClose} className="ember-btn-ghost flex-1 py-2 text-sm">Anuluj</button>
          <button onClick={save} className="ember-btn flex-1 py-2 text-sm">✓ Zapisz</button>
        </div>
      </div>
    </div>
  )
}
