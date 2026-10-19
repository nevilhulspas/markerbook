import { createClient } from '@/lib/supabase/server'
import { resolveUserIdByToken } from '@/lib/nutrition/log-token'

function readToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return new URL(req.url).searchParams.get('token')
}

/** Bearer token (iPhone Shortcut) or session cookie (in-app) → user id, or null. */
export async function authenticateNutritionRequest(req: Request): Promise<string | null> {
  const token = readToken(req)
  if (token) return resolveUserIdByToken(token)
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
