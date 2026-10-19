'use server'

import { getSessionUser } from '@/lib/supabase/session'
import { suggestionSchema } from '@/lib/validations/suggestion'

export async function submitMarkerSuggestion(
  values: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  // Step 1: Validate input
  const parsed = suggestionSchema.safeParse(values)
  if (!parsed.success) {
    return { success: false, error: 'Invalid submission. Please check your input.' }
  }

  const { supabase, user, authError } = await getSessionUser()

  if (!user) {
    return { success: false, error: authError ?? 'Not authenticated' }
  }

  // Step 2: Rate limit check — max 5 pending suggestions per user
  const { count, error: countError } = await supabase
    .from('marker_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (countError) {
    return { success: false, error: countError.message }
  }

  if ((count ?? 0) >= 5) {
    return {
      success: false,
      error: 'You already have 5 pending suggestions. Please wait for them to be reviewed before submitting more.',
    }
  }

  // Step 3: Duplicate detection (only for marker type)
  if (parsed.data.type === 'marker') {
    // 3a. Check name match (case-insensitive via ilike)
    const { data: nameMatches } = await supabase
      .from('biomarkers')
      .select('id, name')
      .ilike('name', parsed.data.name)
      .is('archived_at', null)
      .limit(1)

    if (nameMatches && nameMatches.length > 0) {
      return {
        success: false,
        error: `A biomarker named "${nameMatches[0].name}" already exists in the catalog`,
      }
    }

    // 3b. Check alias match (fetch all, compare in-memory)
    const { data: allBiomarkers } = await supabase
      .from('biomarkers')
      .select('id, name, aliases')
      .is('archived_at', null)

    if (allBiomarkers) {
      const normalizedName = parsed.data.name.toLowerCase()
      const aliasMatch = allBiomarkers.find(
        (b: { id: string; name: string; aliases: string[] | null }) =>
          b.aliases?.some((a: string) => a.toLowerCase() === normalizedName)
      )

      if (aliasMatch) {
        return {
          success: false,
          error: `"${parsed.data.name}" is a known alias for "${aliasMatch.name}"`,
        }
      }
    }
  }

  // Step 4: Insert suggestion
  const { error } = await supabase.from('marker_suggestions').insert({
    user_id: user.id,
    type: parsed.data.type,
    name: parsed.data.name,
    details: parsed.data.details || null,
    category: parsed.data.category || null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
