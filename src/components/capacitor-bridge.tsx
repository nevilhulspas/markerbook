'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { isNativePlatform, NATIVE_RECORD_HOST, NATIVE_PHOTO_HOST, NATIVE_URL_SCHEME } from '@/lib/capacitor'

/**
 * Handles native deep links that come back from OAuth in
 * `ASWebAuthenticationSession`. The flow:
 *
 *   1. User taps "Continue with Google" → we open Google's consent screen
 *      via `Browser.open` (see `oauth-button.tsx`).
 *   2. Supabase redirects back to `nl.naturalheroes.bloodmarkers://auth/callback?code=…`.
 *   3. iOS routes that custom-scheme URL to the app; Capacitor fires
 *      `appUrlOpen`; this listener hands the `code` to the server
 *      `/auth/callback` route (a full navigation) so the session cookie is
 *      written server-side as `httpOnly`. The PKCE verifier cookie set during
 *      step 1 rides along with the request. (We do NOT exchange the code with
 *      the browser client: that writes a JS cookie that iOS/WebKit ITP purges,
 *      logging the user out on the next relaunch — see cookie-options.ts.)
 *   4. We close the in-app browser overlay (if still up); the server route
 *      redirects to `/dashboard`.
 *
 * Render this once near the top of the client tree (see `<Providers>`).
 * Does nothing on the web — guarded by `isNativePlatform()`.
 */
export function CapacitorBridge() {
  const router = useRouter()

  useEffect(() => {
    if (!isNativePlatform()) return

    let cancelled = false
    let removeHandle: (() => void) | undefined

    void (async () => {
      const { App } = await import('@capacitor/app')
      const { Browser } = await import('@capacitor/browser')

      const handle = await App.addListener('appUrlOpen', async ({ url }) => {
        if (!url.startsWith(`${NATIVE_URL_SCHEME}://`)) return

        // Native App Shortcut (Back Tap / Siri / Action Button): open the
        // focused capture screen with the recorder auto-started. The
        // timestamp keeps the param unique so a second trigger re-fires even
        // when we're already on /capture.
        const target = url.slice(`${NATIVE_URL_SCHEME}://`.length)
        if (target === NATIVE_RECORD_HOST || target.startsWith(`${NATIVE_RECORD_HOST}?`)) {
          router.push(`/capture?autostart=${Date.now()}`)
          return
        }

        if (target === NATIVE_PHOTO_HOST || target.startsWith(`${NATIVE_PHOTO_HOST}?`)) {
          router.push(`/capture/photo?capture=${Date.now()}`)
          return
        }

        // Parse `?code=…` (or `?error=…`) out of the deep-link URL.
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')
        const errorDescription =
          parsed.searchParams.get('error_description') ??
          parsed.searchParams.get('error')

        // Always try to dismiss the auth session overlay. Safe to call
        // even if it's already closed.
        await Browser.close().catch(() => {})

        if (errorDescription) {
          router.replace(
            `/login?error=${encodeURIComponent(errorDescription)}`
          )
          return
        }

        if (!code) return

        // Hand the code to the SERVER callback (full navigation, not a client
        // route change) so it runs the Route Handler, exchanges the code, and
        // writes the session cookie as httpOnly before 302-ing to /dashboard.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a router push would stay client-side and skip the Route Handler
        window.location.assign(
          `/auth/callback?code=${encodeURIComponent(code)}&next=/dashboard`
        )
      })

      // If the effect was cancelled while the dynamic imports + addListener
      // were resolving, the listener is registered but cleanup has already
      // run. Remove it inline; otherwise expose the handle for cleanup.
      if (cancelled) {
        void handle.remove()
        return
      }
      removeHandle = () => {
        void handle.remove()
      }
    })()

    return () => {
      cancelled = true
      removeHandle?.()
    }
  }, [router])

  return null
}
