import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Project-Z — Voice & Chat',
  description: 'Nowoczesny komunikator głosowy i tekstowy',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const headersList = await headers()

  const host            = headersList.get('host') ?? ''
  const platformCookie  = cookieStore.get('pz_platform')?.value
  const isMobileHost    = host.startsWith('m.')

  const platform: 'mobile' | 'desktop' =
    platformCookie === 'mobile' || isMobileHost ? 'mobile' : 'desktop'

  return (
    <html lang="pl" data-platform={platform} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f0008" />
      </head>
      <body>{children}</body>
    </html>
  )
}
