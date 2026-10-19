'use server'

import { getSessionUser } from '@/lib/supabase/session'
import type { UnitPreferenceMap } from '@/lib/grid/unit-conversion'

export async function getUnitPreferences(): Promise<UnitPreferenceMap> {
  const { supabase, user } = await getSessionUser()

  if (!user) return new Map()

  const { data } = await supabase
    .from('user_unit_preferences')
    .select('biomarker_id, preferred_unit')
    .eq('user_id', user.id)

  return new Map((data ?? []).map((r) => [r.biomarker_id, r.preferred_unit]))
}

export async function setUnitPreference(
  biomarkerId: string,
  preferredUnit: string | null
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

  if (preferredUnit === null) {
    // Remove preference (revert to default)
    const { error } = await supabase
      .from('user_unit_preferences')
      .delete()
      .eq('user_id', user.id)
      .eq('biomarker_id', biomarkerId)

    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // Upsert preference
  const { error } = await supabase
    .from('user_unit_preferences')
    .upsert(
      {
        user_id: user.id,
        biomarker_id: biomarkerId,
        preferred_unit: preferredUnit,
      },
      { onConflict: 'user_id,biomarker_id' }
    )

  if (error) return { success: false, error: error.message }
  return { success: true }
}
