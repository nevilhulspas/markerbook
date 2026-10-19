'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface MemoryFile {
  id: string
  path: string
  content: string
  updated_at: string
}

/**
 * List every memory file the Health AI has saved for the current user, newest
 * first. Powers the per-item review/delete UI on /profile.
 *
 * Returns an empty array (not an error) for unauthenticated callers so the
 * UI degrades gracefully when the session has expired in the background.
 */
export async function listInsightsMemory(): Promise<MemoryFile[]> {
  const { supabase, user } = await getSessionUser()
  if (!user) return []

  // RLS already scopes to the user, but we go through the user-context client
  // here so any future audit logging on the memory table sees the real actor.
  const { data } = await supabase
    .from('chat_memory_files')
    .select('id, path, content, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (data ?? []) as MemoryFile[]
}

/**
 * Delete a single memory file the AI has saved. Right-to-erasure at the
 * per-entry level. Returns { error } so the caller can render a toast
 * without coupling to a discriminated-union shape.
 */
export async function deleteInsightsMemoryFile(
  id: string
): Promise<{ error: string | null }> {
  const { user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'Not authenticated' }

  // `.select().single()` so PGRST116 surfaces on zero-row match (wrong id or
  // cross-user attempt) instead of silently returning ok.
  const { error } = await supabaseAdmin
    .from('chat_memory_files')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { error: null }
}

/**
 * Delete everything the Health AI has remembered about the current user
 * (the Claude memory tool's /memories files). Right-to-erasure for the
 * cross-conversation memory.
 */
export async function clearInsightsMemory(): Promise<{ error: string | null }> {
  const { user, authError } = await getSessionUser()

  if (!user) return { error: authError ?? 'Not authenticated' }

  const { error } = await supabaseAdmin
    .from('chat_memory_files')
    .delete()
    .eq('user_id', user.id)

  if (!error) revalidatePath('/profile')
  return { error: error?.message ?? null }
}
