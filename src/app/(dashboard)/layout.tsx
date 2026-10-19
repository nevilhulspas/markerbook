import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getNextToTestSummary } from '@/actions/next-to-test/lists'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { FloatingMenuButton } from '@/components/layout/floating-menu-button'
import { ImpersonationBanner } from '@/components/layout/impersonation-banner'
import { MobileEdgeSwipe } from '@/components/layout/mobile-edge-swipe'
import { SidebarExtraProvider } from '@/components/layout/sidebar-extra-context'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth check is handled by proxy.ts — if we get here, user is authenticated
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)

  if (!user) {
    redirect('/login')
  }

  const isAdmin = user.app_metadata?.role === 'admin'

  const [{ data: profileRow }, summary] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle(),
    getNextToTestSummary(),
  ])
  const pendingBadge =
    summary.pendingCount > 0
      ? summary.pendingCount > 99
        ? '99+'
        : String(summary.pendingCount)
      : undefined
  const badgeOverrides: Record<string, string> = pendingBadge
    ? { '/next-to-test': pendingBadge }
    : {}

  return (
    <SidebarProvider>
      <SidebarExtraProvider>
        <AppSidebar
          user={{
            name: profileRow?.display_name ?? null,
            email: user.email ?? '',
            isAdmin: isAdmin === true,
          }}
          badgeOverrides={badgeOverrides}
        />
        <MobileEdgeSwipe />
        <SidebarInset className="h-dvh">
          <ImpersonationBanner />
          {/* Floating menu button on every page (no top bar). Opens the nav
              drawer. Skipped on /insights — the chat renders its own. */}
          <FloatingMenuButton />
          <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+3.5rem)] md:px-6 md:pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pt-[calc(env(safe-area-inset-top)+3.5rem)]">
            {children}
          </div>
        </SidebarInset>
      </SidebarExtraProvider>
    </SidebarProvider>
  )
}
