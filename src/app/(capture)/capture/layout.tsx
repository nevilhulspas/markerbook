import { redirect } from 'next/navigation'

import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

/**
 * Chrome-free layout for the focused food-capture screen: no sidebar, no
 * floating menu — just the capture surface. Opened by the native "Log Food →
 * Record" intent via the `://record` deep link.
 */
export default async function CaptureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      {children}
    </main>
  )
}
