import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getRequestUser } from '@/lib/supabase/request-user'

export default async function Home() {
  // The native iOS app loads this root URL on every launch. Send an already
  // signed-in user straight to their dashboard so they don't land on the
  // marketing page and assume they've been logged out.
  const {
    data: { user },
  } = await getRequestUser()
  if (user) redirect('/dashboard')

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Markerbook
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Track your blood test results over time and get personalized
          AI-powered interpretation and recommendations.
        </p>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Get Started
        </Link>
      </main>
    </div>
  )
}
