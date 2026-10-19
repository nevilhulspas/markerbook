import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { resolveOrigin } from '@/lib/auth/site-origin'
import { sanitizeNextPath } from '@/lib/auth/next-path'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = sanitizeNextPath(requestUrl.searchParams.get('next'))
  // Resolve the PUBLIC origin from forwarded headers — NOT requestUrl.origin.
  // Behind the prod proxy `request.url` is the container-internal
  // `http://localhost:3000`, which bounced users to localhost after the code
  // exchange (AUT-889). resolveOrigin keeps the real host (prod domain, or a
  // per-worktree *.bloodmarkers-tracker.localhost dev URL) and only falls back
  // to NEXT_PUBLIC_SITE_URL when it sees the bare-localhost internal host.
  const origin = resolveOrigin(request.headers)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('OAuth code exchange error:', error.message, error)
    }

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
