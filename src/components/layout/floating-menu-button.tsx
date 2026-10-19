'use client'

import { usePathname } from 'next/navigation'

import { SidebarTrigger } from '@/components/ui/sidebar'

/**
 * Global floating menu button (no top bar) — opens the nav drawer/sidebar.
 *
 * Skipped on the insights chat page: the conversation rail occupies this
 * corner there, so the chat renders its own trigger at the top-left of the
 * chat column instead (see InsightsChat).
 */
export function FloatingMenuButton() {
  const pathname = usePathname()
  if (pathname === '/insights') return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start p-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <SidebarTrigger className="pointer-events-auto size-9 rounded-full bg-card/70 text-foreground shadow-sm backdrop-blur-sm" />
    </div>
  )
}
