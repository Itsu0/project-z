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

/* Keep <html data-platform> in sync with the actually-rendered platform so that
   scoped CSS ([data-platform="mobile"] .xxx) always applies — even when the
   server guessed "desktop" (e.g. a phone on the non-m. domain without a cookie). */
function syncHtmlPlatform(p: Platform) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.platform = p
  }
}

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(detectPlatform)

  useEffect(() => {
    /* If on mobile subdomain — lock to mobile, no listener needed */
    if (window.location.hostname.startsWith(MOBILE_SUBDOMAIN)) {
      setPlatform('mobile')
      syncHtmlPlatform('mobile')
      return
    }

    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const apply = (isMobile: boolean) => {
      const p: Platform = isMobile ? 'mobile' : 'desktop'
      setPlatform(p)
      syncHtmlPlatform(p)
    }
    const handler = (e: MediaQueryListEvent) => apply(e.matches)

    mq.addEventListener('change', handler)
    apply(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return platform
}

export function useIsMobile(): boolean {
  return usePlatform() === 'mobile'
}
