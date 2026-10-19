import { isAuthApiError, isAuthRetryableFetchError, type AuthError, type User } from '@supabase/supabase-js'

// No server-only imports: the proxy uses this too.

/** Shown when Supabase Auth itself failed, so we do not know who is signed in. */
export const AUTH_UNAVAILABLE_MESSAGE =
  'We could not check your session right now. Please try again in a moment.'

/**
 * True when `auth.getUser()` failed because of the auth service or the
 * network rather than because there is no valid session. A missing session,
 * an invalid or expired token (4xx) all mean "signed out".
 */
export function isAuthOutage(error: AuthError | null): boolean {
  if (!error) return false
  if (isAuthRetryableFetchError(error)) return true
  if (isAuthApiError(error)) return error.status >= 500
  // AuthSessionMissingError, AuthInvalidJwtError, … are client-side
  // "no usable session" errors; anything without a status is unknown.
  return error.name === 'AuthUnknownError'
}

/**
 * For pages and layouts that redirect to /login when there is no user: throw
 * instead during an auth outage, so the user gets the error page (with a
 * retry) rather than being sent to log in while they are logged in.
 */
export function throwIfAuthOutage(user: User | null, error: AuthError | null): void {
  if (!user && isAuthOutage(error)) {
    console.error('[auth] getUser failed:', error?.name, error?.message)
    throw new Error(AUTH_UNAVAILABLE_MESSAGE)
  }
}
