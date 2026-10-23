'use server'

import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'

export async function toggleFavorite(
  biomarkerId: string
): Promise<{ favorited: boolean } | { error: string }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { error: authError ?? 'Not authenticated' }

  // Check if already favorited
  const { data: existing } = await supabase
    .from('biomarker_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('biomarker_id', biomarkerId)
    .maybeSingle()

  if (existing) {
    // Remove favorite
    await supabase
      .from('biomarker_favorites')
      .delete()
      .eq('id', existing.id)
    return { favorited: false }
  }

  // Add favorite
  const { error } = await supabase
    .from('biomarker_favorites')
    .insert({ user_id: user.id, biomarker_id: biomarkerId })

  if (error) {
    return {
      error: userErrorMessage(
        'toggleFavorite',
        error,
        'Could not update your favorites. Please try again.'
      ),
    }
  }
  return { favorited: true }
}

export async function getFavoriteIds(): Promise<Set<string>> {
  const { supabase, user } = await getSessionUser()

  if (!user) return new Set()

  const { data } = await supabase
    .from('biomarker_favorites')
    .select('biomarker_id')
    .eq('user_id', user.id)

  return new Set((data ?? []).map((r) => r.biomarker_id))
}
