import type { CustomFood, Recipe } from '@/lib/database.types'
import type { TypedSupabaseClient } from '@/lib/supabase/database'
import { libraryItemFromCustomFood, libraryItemFromRecipe, type LibraryItem } from './match'

export interface LoadLibraryOptions {
  /** Owner filter. Pass it with the service client (bypasses RLS); omit it
   *  with the request's RLS-scoped client. */
  userId?: string
  /** Order both lists by name (the in-app logFood action does; the token and
   *  photo routes don't). */
  orderByName?: boolean
  /** Prefix for the "library load failed" log line, e.g. '[logFood]'. */
  logTag: string
}

/**
 * The user's custom foods + recipes as LibraryItems for matching (custom
 * foods first; recipes without total grams are dropped).
 *
 * A query error is logged and that list is skipped — matching still works
 * without the library (NEVO / AI estimate). A thrown error propagates; the
 * routes catch it themselves, the logFood action doesn't.
 */
export async function loadLibraryItems(
  supabase: TypedSupabaseClient,
  opts: LoadLibraryOptions
): Promise<LibraryItem[]> {
  let cfQuery = supabase.from('custom_foods').select('*')
  let recQuery = supabase.from('recipes').select('*')
  if (opts.userId) {
    cfQuery = cfQuery.eq('user_id', opts.userId)
    recQuery = recQuery.eq('user_id', opts.userId)
  }
  cfQuery = cfQuery.eq('is_deleted', false)
  recQuery = recQuery.eq('is_deleted', false)
  if (opts.orderByName) {
    cfQuery = cfQuery.order('name', { ascending: true })
    recQuery = recQuery.order('name', { ascending: true })
  }

  const [cfResult, recResult] = await Promise.all([cfQuery, recQuery])
  if (cfResult.error || recResult.error) {
    // Matching still works without the library (NEVO / AI estimate), but
    // say so: the user's own foods were silently skipped before.
    console.error(`${opts.logTag} library load failed:`, cfResult.error?.message ?? recResult.error?.message)
  }
  const customFoods = (cfResult.data ?? []) as CustomFood[]
  const recipes = (recResult.data ?? []) as Recipe[]

  return [
    ...customFoods.map(libraryItemFromCustomFood),
    ...recipes.map(libraryItemFromRecipe).filter(Boolean),
  ] as LibraryItem[]
}
