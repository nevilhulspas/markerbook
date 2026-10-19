import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { isAuthOutage } from '@/lib/supabase/auth-outage'
import { AUTH_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options'

export async function proxy(request: NextRequest) {
  // Speculative link prefetches (Next fires many — every sidebar link on hover/
  // viewport) must NOT force a Supabase token refresh. Several prefetches racing
  // the real navigation refresh the SAME refresh token at once, tripping
  // rotation reuse-detection, which revokes the whole session → surprise logouts
  // (worst when a dev restart reloads every open tab together). Skip auth work
  // for prefetches; the real navigation — and each route's own layout auth
  // check — still enforces access. (The complete fix is widening Supabase's
  // refresh-token reuse interval; this just cuts the refresh fan-out.)
  const purpose =
    request.headers.get('next-router-prefetch') ??
    request.headers.get('purpose') ??
    request.headers.get('sec-purpose') ??
    ''
  if (purpose === '1' || purpose.includes('prefetch')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Auth cookies are server-owned (httpOnly) so iOS/WebKit doesn't purge
      // them — see lib/supabase/cookie-options.ts.
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth token
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // During an auth outage we do not know whether the user is signed in, so
  // do not bounce them to login: let the request through and the layout
  // (throwIfAuthOutage) shows the error page. Nothing is served without a
  // user — every layout, page and action checks auth again.
  const authUnavailable = !user && isAuthOutage(authError)

  // Redirect unauthenticated users to login (pages only, not API routes)
  if (
    !user &&
    !authUnavailable &&
    !request.nextUrl.pathname.startsWith('/api') &&
    request.nextUrl.pathname !== '/' &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Remember where the user was headed so login can send them back there.
    url.search = ''
    url.searchParams.set(
      'next',
      request.nextUrl.pathname + request.nextUrl.search
    )
    return NextResponse.redirect(url)
  }

  // Guard admin routes for non-admin users
  if (
    user &&
    request.nextUrl.pathname.startsWith('/admin')
  ) {
    const isAdmin = (user.app_metadata as Record<string, unknown>)?.role === 'admin'
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|auth/callback|auth/signout|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
