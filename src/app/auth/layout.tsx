import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center p-4 gap-6"
      style={{
        background: 'var(--eb-bg0)',
        backgroundImage: 'var(--eb-glow)',
        height: '100dvh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        justifyContent: 'safe center',
        paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {children}

      <p className="text-xs text-center" style={{ color: 'var(--eb-text3)' }}>
        <Link href="/terms" className="hover:underline" style={{ color: 'var(--eb-text3)' }}>Regulamin</Link>
        {' · '}
        <Link href="/privacy" className="hover:underline" style={{ color: 'var(--eb-text3)' }}>Polityka prywatności</Link>
        {' · '}
        <span>© {new Date().getFullYear()} Nexus</span>
      </p>
    </div>
  )
}
