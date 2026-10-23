'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { isOwnedPath } from '@/lib/supabase/storage-path'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { scaleTo, type Macros100 } from '@/lib/nutrition/match'
import { manualFoodLogSchema, type ManualFoodLogInput } from '@/lib/validations/nutrition'
import type { FoodLog } from '@/lib/database.types'

// 'today' fetches a 2-day UTC window so a local-morning meal is never clipped by
// the rolling 24h filter near the day boundary; the page narrows to the local
// calendar day via groupLogsByDay/localDayKey.
const RANGE_DAYS: Record<string, number> = { today: 2, '7d': 7, '30d': 30 }

/** Range-windowed, RLS-scoped logs (newest first). 'today' uses a 1-day window;
 *  the page narrows to the local calendar day via groupLogsByDay. */
export async function getFoodLogs(range = '7d'): Promise<FoodLog[]> {
  const days = RANGE_DAYS[range] ?? 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('is_deleted', false)
    .gte('entry_date', since)
    .order('entry_date', { ascending: false })
  // Throw rather than return [] so the page shows an error instead of
  // "no data" (dashboard error.tsx).
  if (error) {
    console.error('getFoodLogs failed:', error.message)
    throw new Error(`Could not load your data (getFoodLogs): ${error.message}`)
  }
  return (data ?? []) as FoodLog[]
}

export async function getFoodLogById(id: string): Promise<FoodLog | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('food_logs').select('*').eq('id', id).maybeSingle()
  return (data as FoodLog | null) ?? null
}

// ---------------------------------------------------------------------------
// updateFoodLogGrams
// ---------------------------------------------------------------------------

/** Rescales macros from the row's own stored values (row-derived per-100g).
 *  This is exact for any match source and avoids external refetch. */
export async function updateFoodLogGrams(
  id: string,
  grams: number
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const { data: rowData } = await supabase
    .from('food_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!rowData) return { error: 'Food log not found.' }
  const row = rowData as FoodLog

  if (!row.grams || row.grams <= 0) {
    // No grams stored — just update grams field without rescaling macros
    const { error } = await supabase.from('food_logs').update({ grams }).eq('id', id)
    return { error: error?.message ?? null }
  }

  // Derive per-100g from row's current values, then scale to new grams
  const oldGrams = row.grams
  const per100g: Macros100 = {
    kcal: ((row.calories ?? 0) / oldGrams) * 100,
    protein: ((row.protein_g ?? 0) / oldGrams) * 100,
    carbs: ((row.carbs_g ?? 0) / oldGrams) * 100,
    fat: ((row.fat_g ?? 0) / oldGrams) * 100,
    fiber: ((row.fiber_g ?? 0) / oldGrams) * 100,
    sugar: ((row.sugar_g ?? 0) / oldGrams) * 100,
    sodium_mg: ((row.sodium_mg ?? 0) / oldGrams) * 100,
    sat_fat: ((row.saturated_fat_g ?? 0) / oldGrams) * 100,
  }

  const scaled = scaleTo(per100g, grams)
  const { error } = await supabase
    .from('food_logs')
    .update({
      grams,
      calories: scaled.kcal,
      protein_g: scaled.protein,
      carbs_g: scaled.carbs,
      fat_g: scaled.fat,
      fiber_g: scaled.fiber,
      sugar_g: scaled.sugar,
      sodium_mg: scaled.sodium_mg,
      saturated_fat_g: scaled.sat_fat,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/nutrition')
  return { error: null }
}

export async function updateFoodLog(id: string, input: ManualFoodLogInput): Promise<{ error: string | null }> {
  const parsed = manualFoodLogSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid entry' }
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }
  const v = parsed.data
  const { error } = await supabase
    .from('food_logs')
    .update({
      entry_date: new Date(`${v.entry_date}T12:00:00`).toISOString(),
      food_name: v.food_name,
      calories: v.calories ?? null,
      protein_g: v.protein_g ?? null,
      carbs_g: v.carbs_g ?? null,
      fat_g: v.fat_g ?? null,
      fiber_g: v.fiber_g ?? null,
      sugar_g: v.sugar_g ?? null,
      sodium_mg: v.sodium_mg ?? null,
      saturated_fat_g: v.saturated_fat_g ?? null,
      meal_type: v.meal_type ?? null,
      notes: v.notes ?? null,
      // grams is only written when explicitly provided as a number — callers
      // omit it to leave the stored grams untouched (e.g. the rescale path,
      // which must keep the old grams as the per-100g derivation base).
      ...(typeof v.grams === 'number' ? { grams: v.grams } : {}),
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/nutrition')
  return { error: null }
}

export async function deleteFoodLog(id: string): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }
  const { error } = await supabase.from('food_logs').update({ is_deleted: true }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/nutrition')
  return { error: null }
}

/** Short-lived signed URL for a meal photo (private bucket). Returns null on failure. */
export async function getMealPhotoSignedUrl(path: string): Promise<string | null> {
  const { user } = await getSessionUser()
  // Path is namespaced as `${userId}/...`; only the owner may sign it.
  if (!user || !isOwnedPath(user.id, path)) return null
  const { data, error } = await supabaseAdmin.storage.from('meal-photos').createSignedUrl(path, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}
