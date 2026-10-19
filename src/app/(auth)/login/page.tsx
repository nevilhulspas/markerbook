import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { sanitizeNextPath } from '@/lib/auth/next-path'
import { LoginForm } from '@/components/auth/login-form'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Login | Blood Markers Tracker',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const nextPath = sanitizeNextPath(next)

  // Don't show the login form to a user who already has a valid session —
  // send them on to where they were headed (AUT-919).
  const {
    data: { user },
  } = await getRequestUser()
  if (user) redirect(nextPath)

  return <LoginForm next={nextPath} />
}
