import type { CookieOptions } from '@supabase/ssr'

/**
 * Cookie options applied to the SERVER-written Supabase auth cookies
 * (`src/lib/supabase/server.ts` + `src/proxy.ts`).
 *
 * Why `httpOnly: true` — the bug it fixes:
 * The app is also an iOS app (Capacitor WKWebView loading the remote site) and
 * is used in mobile Safari. By default `@supabase/ssr`'s BROWSER client writes
 * the `sb-…-auth-token` cookie via `document.cookie` (i.e. a JavaScript-set
 * cookie). WebKit/Safari Intelligent Tracking Prevention (ITP) purges
 * JavaScript-set first-party cookies aggressively, so the login was dropped on
 * essentially every app/tab relaunch on iOS — while desktop Chrome was fine.
 * Server-set, same-domain Secure cookies are EXEMPT from that purge.
 *
 * Making the auth cookie `httpOnly` forces it to be owned by the server
 * (written via `Set-Cookie`, never `document.cookie`), so iOS keeps it. The
 * trade-off is that the browser Supabase client can no longer read the session
 * — so all auth/data reads must go through the server (server components +
 * server actions + the `/auth/callback` route). See the three former
 * browser-client call sites migrated alongside this change.
 *
 * IMPORTANT — only override `httpOnly`. We deliberately do NOT set `secure`,
 * `sameSite`, `maxAge`, or `path` here: `@supabase/ssr` merges this object over
 * its own `DEFAULT_COOKIE_OPTIONS` (`{ path:'/', sameSite:'lax', maxAge:400d }`)
 * and always re-forces the 400-day `maxAge`. A May 2026 regression was caused
 * by a client/server mismatch on the `Secure` attribute — leaving everything
 * but `httpOnly` at the library defaults keeps client and server in agreement
 * and keeps `http://…localhost` dev logins working.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
}
