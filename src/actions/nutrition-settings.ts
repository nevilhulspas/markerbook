'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { suggestTargetsFromProfile } from '@/lib/nutrition/targets'
import { nutritionTargetsSchema, type NutritionTargetsInput } from '@/lib/validations/nutrition'
import type { Profile } from '@/lib/database.types'

export interface ResolvedTargets {
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  suggested: boolean
}

export async function getNutritionTargets(): Promise<ResolvedTargets> {
  const empty: ResolvedTargets = { calories: null, protein_g: null, carbs_g: null, fat_g: null, suggested: false }
  const { supabase, user } = await getSessionUser()
  if (!user) return empty
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const p = data as Profile | null
  if (p?.nutrition_calorie_target != null) {
    return {
      calories: p.nutrition_calorie_target ?? null,
      protein_g: p.nutrition_protein_target_g ?? null,
      carbs_g: p.nutrition_carbs_target_g ?? null,
      fat_g: p.nutrition_fat_target_g ?? null,
      suggested: false,
    }
  }
  const s = suggestTargetsFromProfile(p)
  // carbs/fat aren't estimated by Mifflin–St Jeor — leave null for the user to fill in.
  return { calories: s?.calories ?? null, protein_g: s?.protein_g ?? null, carbs_g: null, fat_g: null, suggested: true }
}

export async function setNutritionTargets(input: NutritionTargetsInput): Promise<{ error: string | null }> {
  const parsed = nutritionTargetsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid targets' }
  const { user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      nutrition_calorie_target: parsed.data.calories ?? null,
      nutrition_protein_target_g: parsed.data.protein_g ?? null,
      nutrition_carbs_target_g: parsed.data.carbs_g ?? null,
      nutrition_fat_target_g: parsed.data.fat_g ?? null,
    })
    .eq('id', user.id)
    .select('id')
  if (error) return { error: error.message }
  // An update that matches no row is not an error to PostgREST; without this
  // check the sheet would say "saved" while nothing was stored.
  if ((data ?? []).length === 0) return { error: 'Your profile could not be found. Targets were not saved.' }
  revalidatePath('/nutrition')
  return { error: null }
}

export async function getOrCreateLogToken(): Promise<{ token: string | null; error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { token: null, error: authError ?? 'You must be signed in.' }
  const readToken = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('nutrition_log_token')
      .eq('id', user.id)
      .single()
    return { token: (data as { nutrition_log_token: string | null } | null)?.nutrition_log_token ?? null, error }
  }

  const current = await readToken()
  // A failed read must never look like "no token yet": creating one would
  // silently replace the token the user's Shortcut is using.
  if (current.error) return { token: null, error: current.error.message }
  if (current.token) return { token: current.token, error: null }

  // Only fill an empty column, so a second request racing this one cannot
  // rotate the token the first one already handed out.
  const { data: upd, error } = await supabaseAdmin
    .from('profiles')
    .update({ nutrition_log_token: crypto.randomUUID() })
    .eq('id', user.id)
    .is('nutrition_log_token', null)
    .select('nutrition_log_token')
    .maybeSingle()
  if (error) return { token: null, error: error.message }
  const created = (upd as { nutrition_log_token: string } | null)?.nutrition_log_token
  if (created) return { token: created, error: null }

  // Lost the race: another request set it between our read and update.
  const again = await readToken()
  if (again.error) return { token: null, error: again.error.message }
  return { token: again.token, error: again.token ? null : 'Could not create a token.' }
}

export async function regenerateLogToken(): Promise<{ token: string | null; error: string | null }> {
  const { user, authError } = await getSessionUser()
  if (!user) return { token: null, error: authError ?? 'You must be signed in.' }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ nutrition_log_token: crypto.randomUUID() })
    .eq('id', user.id)
    .select('nutrition_log_token')
    .single()
  if (error) return { token: null, error: error.message }
  revalidatePath('/nutrition')
  return { token: (data as { nutrition_log_token: string }).nutrition_log_token, error: null }
}
