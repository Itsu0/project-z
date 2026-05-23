import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/auth/forgot', '/auth/reset-password', '/auth/verify-email', '/auth/2fa', '/terms', '/privacy']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('pz_token')?.value

  if (!token && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (token && PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
