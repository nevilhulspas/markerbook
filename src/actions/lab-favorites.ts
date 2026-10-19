'use server'

import { getSessionUser } from '@/lib/supabase/session'

export async function toggleLabFavorite(
  labId: string
): Promise<{ favorited: boolean } | { error: string }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { error: authError ?? 'Not authenticated' }

  // Check if already favorited
  const { data: existing } = await supabase
    .from('lab_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('lab_id', labId)
    .maybeSingle()

  if (existing) {
    // Remove favorite
    await supabase.from('lab_favorites').delete().eq('id', existing.id)
    return { favorited: false }
  }

  // Add favorite
  const { error } = await supabase
    .from('lab_favorites')
    .insert({ user_id: user.id, lab_id: labId })

  if (error) return { error: error.message }
  return { favorited: true }
}

export async function getFavoriteLabIds(): Promise<Set<string>> {
  const { supabase, user } = await getSessionUser()

  if (!user) return new Set()

  const { data } = await supabase
    .from('lab_favorites')
    .select('lab_id')
    .eq('user_id', user.id)

  return new Set((data ?? []).map((r) => r.lab_id as string))
}
