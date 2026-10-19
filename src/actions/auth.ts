'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { resolveOrigin } from '@/lib/auth/site-origin'
import { sanitizeNextPath } from '@/lib/auth/next-path'
import { loginSchema, registerSchema } from '@/lib/validations/auth'
import { promoteIfAdminEmail } from '@/lib/auth/admin-email'

export async function login(values: unknown, next?: string) {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Invalid email or password format' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }
  if (await promoteIfAdminEmail(data.user)) await supabase.auth.refreshSession()

  revalidatePath('/', 'layout')
  redirect(sanitizeNextPath(next))
}

export async function register(values: unknown) {
  const parsed = registerSchema.safeParse(values)
  if (!parsed.success) {
    return { error: 'Invalid registration data' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: error.message }
  }
  if (await promoteIfAdminEmail(data.user)) await supabase.auth.refreshSession()

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signInWithGoogle(next?: string) {
  const supabase = await createClient()

  // Build redirectTo from the request's own origin so OAuth returns to whichever
  // host the user is actually on (canonical bloodmarkers.localhost in prod, any
  // *.bloodmarkers-tracker.localhost worktree URL in local dev, the production
  // domain, etc.). Falls back to NEXT_PUBLIC_SITE_URL if no host header is
  // present (defensive — should always be set in practice). The per-host URL
  // must still be whitelisted in Supabase Auth → URL Configuration → Redirect
  // URLs; for local dev a `https://*.bloodmarkers-tracker.localhost:1355/**`
  // wildcard covers every worktree.
  const origin = resolveOrigin(await headers())

  const nextPath = sanitizeNextPath(next)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
