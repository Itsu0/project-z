'use client'

import { useState, useEffect } from 'react'

export type Platform = 'mobile' | 'desktop'

const MOBILE_BREAKPOINT  = 768
const MOBILE_SUBDOMAIN   = 'm.'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop'
  if (window.location.hostname.startsWith(MOBILE_SUBDOMAIN)) return 'mobile'
  return window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop'
}

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(detectPlatform)

  useEffect(() => {
    /* If on mobile subdomain — lock to mobile, no listener needed */
    if (window.location.hostname.startsWith(MOBILE_SUBDOMAIN)) {
      setPlatform('mobile')
      return
    }

    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setPlatform(e.matches ? 'mobile' : 'desktop')

    mq.addEventListener('change', handler)
    setPlatform(mq.matches ? 'mobile' : 'desktop')
    return () => mq.removeEventListener('change', handler)
  }, [])

  return platform
}

export function useIsMobile(): boolean {
  return usePlatform() === 'mobile'
}
