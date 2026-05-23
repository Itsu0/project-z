'use client'
import { useState, useEffect, useRef } from 'react'

export function Select({ value, onChange, options, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <div ref={ref} className={`relative w-full${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
        style={{
          background: 'var(--eb-bg3)',
          border: open ? '1px solid var(--eb-accent)' : '0.5px solid var(--eb-border2)',
          color: current ? 'var(--eb-text1)' : 'var(--eb-text3)',
          outline: 'none',
          fontFamily: 'inherit',
        }}>
        <span className="truncate text-left">{current?.label ?? placeholder ?? '— Wybierz —'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: 'var(--eb-text3)' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden py-1"
          style={{ background: 'var(--eb-bg1)', border: '1px solid var(--eb-border2)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxHeight: 240, overflowY: 'auto' }}>
          {placeholder && (
            <button type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/[0.05]"
              style={{ color: 'var(--eb-text3)' }}>
              {placeholder}
            </button>
          )}
          {options.map(o => (
            <button type="button" key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/[0.05] flex items-center justify-between gap-2"
              style={{ color: o.value === value ? 'var(--eb-accent)' : 'var(--eb-text1)' }}>
              <span className="truncate">{o.label}</span>
              {o.value === value && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
