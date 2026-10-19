import { notFound } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { AUTH_UNAVAILABLE_MESSAGE, isAuthOutage } from './auth-outage'
import type { TypedSupabaseClient } from './database'
import { createClient } from './server'
import { getRequestUser } from './request-user'

export { AUTH_UNAVAILABLE_MESSAGE, isAuthOutage } from './auth-outage'

/**
 * The request's Supabase client plus the signed-in user (null when signed
 * out or when the session could not be checked).
 *
 * `authError` is AUTH_UNAVAILABLE_MESSAGE when Supabase Auth failed (network,
 * 5xx) and null otherwise. Actions put it in their normal error result, e.g.
 * `{ error: authError ?? 'Not authenticated' }`, so an outage reads as an
 * outage instead of "signed out". It is a returned value on purpose: Next.js
 * hides thrown messages in production, and client callers expect a result.
 */
export async function getSessionUser(): Promise<{
  supabase: TypedSupabaseClient
  user: User | null
  authError: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await getRequestUser()
  // A returned user is a valid session even if an error came along with it.
  if (!user && isAuthOutage(error)) {
    console.error('[auth] getUser failed:', error?.name, error?.message)
    return { supabase, user: null, authError: AUTH_UNAVAILABLE_MESSAGE }
  }
  return { supabase, user, authError: null }
}

/**
 * Use instead of notFound() on pages whose data comes back empty: during an
 * auth outage the "missing" record is really an unknown user, so show the
 * error page (with a retry) rather than a 404. Costs an auth call only on
 * this path. Covers client-side navigations, where shared layouts (and their
 * throwIfAuthOutage) do not re-run.
 */
export async function notFoundOrAuthOutage(actionError?: string | null): Promise<never> {
  // The action already saw the outage: trust that, a second auth call could
  // succeed after a brief blip and turn the user's own record into a 404.
  if (actionError === AUTH_UNAVAILABLE_MESSAGE) throw new Error(AUTH_UNAVAILABLE_MESSAGE)
  // Null-returning reads carry no message, so check the session here.
  const { authError } = await getSessionUser()
  if (authError) throw new Error(AUTH_UNAVAILABLE_MESSAGE)
  notFound()
}
