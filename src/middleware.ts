import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/forgot', '/auth/reset-password', '/auth/verify-email', '/auth/2fa', '/terms', '/privacy']

const MOBILE_UA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i

const MAIN_HOST   = 'project-z.cloud'
const MOBILE_HOST = 'm.project-z.cloud'

function isMobileUA(ua: string | null): boolean {
  if (!ua) return false
  return MOBILE_UA.test(ua)
}

function isLocalhost(host: string): boolean {
  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('::1')
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const host = req.headers.get('host') ?? ''
  const ua   = req.headers.get('user-agent')

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  /* ── Subdomain redirect (only in production) ─────────────────── */
  if (!isLocalhost(host)) {
    const onMobileSubdomain = host === MOBILE_HOST
    const onMainDomain      = host === MAIN_HOST || host === `www.${MAIN_HOST}`
    const mobile            = isMobileUA(ua)

    if (onMainDomain && mobile) {
      const target = new URL(req.url)
      target.host  = MOBILE_HOST
      const res = NextResponse.redirect(target)
      res.cookies.set('pz_platform', 'mobile', { path: '/', maxAge: 3600, sameSite: 'lax' })
      return res
    }

    if (onMobileSubdomain && !mobile) {
      const target = new URL(req.url)
      target.host  = MAIN_HOST
      const res = NextResponse.redirect(target)
      res.cookies.set('pz_platform', 'desktop', { path: '/', maxAge: 3600, sameSite: 'lax' })
      return res
    }

    /* Set platform cookie when already on the right domain */
    if (onMobileSubdomain) {
      const res = NextResponse.next()
      if (req.cookies.get('pz_platform')?.value !== 'mobile') {
        res.cookies.set('pz_platform', 'mobile', { path: '/', maxAge: 3600, sameSite: 'lax' })
      }
      return withAuth(req, res, pathname)
    }
  }

  return withAuth(req, NextResponse.next(), pathname)
}

function withAuth(req: NextRequest, res: NextResponse, pathname: string): NextResponse {
  const token = req.cookies.get('pz_token')?.value

  if (!token && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (token && PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
