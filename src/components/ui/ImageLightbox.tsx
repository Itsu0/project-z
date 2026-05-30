'use client'
import { useEffect } from 'react'

interface Props {
  url: string
  filename?: string
  onClose: () => void
}

export function ImageLightbox({ url, filename, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="relative flex flex-col items-center gap-2"
        onClick={e => e.stopPropagation()}>

        <img
          src={url}
          alt={filename ?? ''}
          style={{ maxWidth: '88vw', maxHeight: '82vh', display: 'block', borderRadius: 12, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
        />

        <div className="flex items-center gap-3">
          {filename && (
            <span className="text-xs px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
              {filename}
            </span>
          )}
          <a href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Otwórz
          </a>
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
