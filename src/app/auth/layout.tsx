import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 gap-6"
      style={{
        background: 'var(--eb-bg0)',
        backgroundImage: 'var(--eb-glow)',
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
