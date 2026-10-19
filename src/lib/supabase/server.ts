import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { AUTH_COOKIE_OPTIONS } from './cookie-options'
import type { Database } from './database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Auth cookies are server-owned (httpOnly) so iOS/WebKit doesn't purge
      // them — see cookie-options.ts.
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component; safe to ignore if proxy refreshes sessions
          }
        },
      },
    }
  )
}
