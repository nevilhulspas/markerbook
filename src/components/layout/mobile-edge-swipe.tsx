'use client'

import { useEffect } from 'react'

import { useSidebar } from '@/components/ui/sidebar'
import { shouldOpenDrawer, shouldCloseDrawer } from '@/lib/mobile/edge-swipe'

const THRESHOLD_PX = 40

/**
 * Swipe gestures for the nav drawer (mobile only), via passive window touch
 * listeners — we never call preventDefault, so taps and vertical scrolls pass
 * straight through; only a clear horizontal swipe acts. No overlay element, so
 * nothing blocks the underlying UI. Rendered inside SidebarProvider.
 *
 * - Drawer CLOSED: a rightward swipe starting in the LEFT half opens it.
 * - Drawer OPEN:   a leftward swipe starting in the RIGHT half retracts it.
 *   (So the left half is only swipeable when the menu is closed.)
 */
export function MobileEdgeSwipe() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    if (!isMobile) return
    let start: { x: number; y: number } | null = null

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      const mid = window.innerWidth / 2
      // Open zone = left half (only when closed); close zone = right half (only
      // when open). A touch outside the active zone is ignored.
      if (openMobile ? t.clientX < mid : t.clientX > mid) return
      start = { x: t.clientX, y: t.clientY }
    }
    const onMove = (e: TouchEvent) => {
      if (!start) return
      const t = e.touches[0]
      if (!t) return
      const g = { startX: start.x, dx: t.clientX - start.x, dy: t.clientY - start.y }
      const act = openMobile
        ? shouldCloseDrawer(g, { thresholdPx: THRESHOLD_PX })
        : // The left-half start zone is enforced in onStart, so the edge gate is
          // a no-op here — only travel/direction matter.
          shouldOpenDrawer(g, { edgeZonePx: Infinity, thresholdPx: THRESHOLD_PX })
      if (act) {
        setOpenMobile(!openMobile)
        start = null
      }
    }
    const clear = () => {
      start = null
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', clear, { passive: true })
    window.addEventListener('touchcancel', clear, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', clear)
      window.removeEventListener('touchcancel', clear)
    }
  }, [isMobile, openMobile, setOpenMobile])

  return null
}
