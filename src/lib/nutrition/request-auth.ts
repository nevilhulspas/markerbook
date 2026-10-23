import { createClient } from '@/lib/supabase/server'
import { resolveUserIdByToken } from '@/lib/nutrition/log-token'

/**
 * The personal log token, from the Authorization header only. A `?token=` in
 * the URL is no longer read: URLs end up in proxy and server logs and browser
 * history, which would leak a token that never expires.
 */
function readToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return null
}

/** Bearer token (iPhone Shortcut) or session cookie (in-app) → user id, or null.
 *  An explicit bad token stays a hard 401 (no fallback to the cookie). */
export async function authenticateNutritionRequest(req: Request): Promise<string | null> {
  const token = readToken(req)
  if (token) return resolveUserIdByToken(token)
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
