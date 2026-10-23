'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { normalizeName } from '@/lib/nutrition/match'
import { searchOff } from '@/lib/nutrition/off'
import {
  customFoodSchema,
  recipeSchema,
  recipeRetroSchema,
  type CustomFoodInput,
  type RecipeInput,
  type RecipeRetroInput,
} from '@/lib/validations/nutrition'
import type { CustomFood, Recipe, RecipeIngredient, NevoFood } from '@/lib/database.types'
import type { Macros100 } from '@/lib/nutrition/match'
import { rescaleLoggedEntry, type RecipeTotals } from '@/lib/nutrition/macros'

// ---------------------------------------------------------------------------
// getLibrary
// ---------------------------------------------------------------------------

export interface RecipeWithIngredients extends Recipe {
  ingredients: RecipeIngredient[]
}

export async function getLibrary(): Promise<{
  customFoods: CustomFood[]
  recipes: RecipeWithIngredients[]
}> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { customFoods: [], recipes: [] }

  const [cfResult, recResult] = await Promise.all([
    supabase
      .from('custom_foods')
      .select('*')
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
  ])

  const customFoods = (cfResult.data ?? []) as CustomFood[]

  // Sort ingredients by position inside each recipe
  const recipes = ((recResult.data ?? []) as Array<Recipe & { recipe_ingredients: RecipeIngredient[] }>).map(
    (r) => ({
      ...r,
      ingredients: [...(r.recipe_ingredients ?? [])].sort((a, b) => a.position - b.position),
    })
  ) as RecipeWithIngredients[]

  return { customFoods, recipes }
}

// ---------------------------------------------------------------------------
// saveCustomFood
// ---------------------------------------------------------------------------

export async function saveCustomFood(
  input: CustomFoodInput
): Promise<{ error: string | null; id?: string }> {
  const parsed = customFoodSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid custom food' }
  }
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const v = parsed.data
  const row = {
    user_id: user.id,
    name: v.name,
    brand: v.brand ?? null,
    notes: v.notes ?? null,
    kcal_per_100g: v.kcal_per_100g ?? null,
    protein_per_100g: v.protein_per_100g ?? null,
    carbs_per_100g: v.carbs_per_100g ?? null,
    fat_per_100g: v.fat_per_100g ?? null,
    fiber_per_100g: v.fiber_per_100g ?? null,
    sugar_per_100g: v.sugar_per_100g ?? null,
    sodium_mg_per_100g: v.sodium_mg_per_100g ?? null,
    sat_fat_per_100g: v.sat_fat_per_100g ?? null,
    default_grams: v.default_grams,
    is_deleted: false,
  }

  if (v.id) {
    const { data, error } = await supabase
      .from('custom_foods')
      .update(row)
      .eq('id', v.id)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath('/nutrition/library')
    return { error: null, id: (data as { id: string }).id }
  }

  const { data, error } = await supabase
    .from('custom_foods')
    .insert(row)
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/nutrition/library')
  return { error: null, id: (data as { id: string }).id }
}

// ---------------------------------------------------------------------------
// deleteCustomFood
// ---------------------------------------------------------------------------

export async function deleteCustomFood(id: string): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const { error } = await supabase
    .from('custom_foods')
    .update({ is_deleted: true })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/nutrition/library')
  return { error: null }
}

// ---------------------------------------------------------------------------
// saveRecipe
// ---------------------------------------------------------------------------

function scaleIngredientMacros(per100g: number | null | undefined, grams: number): number {
  return ((per100g ?? 0) * grams) / 100
}

export async function saveRecipe(
  input: RecipeInput,
  opts?: { retro?: RecipeRetroInput }
): Promise<{ error: string | null; id?: string; updatedLogs?: number }> {
  const parsed = recipeSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid recipe' }
  }

  let retroSince: string | null = null
  if (opts?.retro) {
    const retroParsed = recipeRetroSchema.safeParse(opts.retro)
    if (!retroParsed.success) {
      return { error: retroParsed.error.issues[0]?.message ?? 'Invalid retro option' }
    }
    retroSince = retroParsed.data.since
  }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const v = parsed.data

  // Compute totals from ingredients
  let totalGrams = 0
  let totalKcal = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0
  let totalFiber = 0
  let totalSugar = 0
  let totalSodiumMg = 0
  let totalSatFat = 0

  for (const ing of v.ingredients) {
    totalGrams += ing.grams
    totalKcal += scaleIngredientMacros(ing.kcal_per_100g, ing.grams)
    totalProtein += scaleIngredientMacros(ing.protein_per_100g, ing.grams)
    totalCarbs += scaleIngredientMacros(ing.carbs_per_100g, ing.grams)
    totalFat += scaleIngredientMacros(ing.fat_per_100g, ing.grams)
    totalFiber += scaleIngredientMacros(ing.fiber_per_100g, ing.grams)
    totalSugar += scaleIngredientMacros(ing.sugar_per_100g, ing.grams)
    totalSodiumMg += scaleIngredientMacros(ing.sodium_mg_per_100g, ing.grams)
    totalSatFat += scaleIngredientMacros(ing.sat_fat_per_100g, ing.grams)
  }

  const recipeRow = {
    user_id: user.id,
    name: v.name,
    notes: v.notes ?? null,
    total_grams: totalGrams,
    total_kcal: totalKcal,
    total_protein: totalProtein,
    total_carbs: totalCarbs,
    total_fat: totalFat,
    total_fiber: totalFiber,
    total_sugar: totalSugar,
    total_sodium_mg: totalSodiumMg,
    total_sat_fat: totalSatFat,
    is_deleted: false,
  }

  const buildIngredientRows = (recipeId: string) =>
    v.ingredients.map((ing, idx) => ({
      recipe_id: recipeId,
      position: idx,
      nevo_code: ing.nevo_code ?? null,
      off_barcode: ing.off_barcode ?? null,
      custom_food_id: ing.custom_food_id ?? null,
      raw_name: ing.raw_name ?? null,
      grams: ing.grams,
      kcal_per_100g: ing.kcal_per_100g ?? null,
      protein_per_100g: ing.protein_per_100g ?? null,
      carbs_per_100g: ing.carbs_per_100g ?? null,
      fat_per_100g: ing.fat_per_100g ?? null,
      fiber_per_100g: ing.fiber_per_100g ?? null,
      sugar_per_100g: ing.sugar_per_100g ?? null,
      sodium_mg_per_100g: ing.sodium_mg_per_100g ?? null,
      sat_fat_per_100g: ing.sat_fat_per_100g ?? null,
    }))

  // supabase-js has no client-side transactions, so writes are ordered to keep
  // the recipe consistent on partial failure: ingredients settle first, the
  // recipe row (totals) is only touched once they match.
  let recipeId: string
  let updatedLogs = 0

  if (v.id) {
    recipeId = v.id

    // The retro update derives each entry's portion against the
    // recipe totals from BEFORE this edit — read them before mutating. Only
    // retro saves pay this extra query; plain saves skip it.
    let oldTotalGrams = 0
    if (retroSince) {
      const { data: oldRecipe, error: oldErr } = await supabase
        .from('recipes')
        .select('total_grams')
        .eq('id', recipeId)
        .single()
      if (oldErr) return { error: oldErr.message }
      // rescaleLoggedEntry returns null for a non-positive old total, so a
      // missing value (0) degrades to "skip all".
      oldTotalGrams = Number((oldRecipe as { total_grams: number | null }).total_grams ?? 0)
    }

    // Snapshot current ingredients so a failed reinsert can be restored.
    const { data: backupData, error: backupErr } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
    if (backupErr) return { error: backupErr.message }
    const backup = backupData ?? []

    const { error: delErr } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId)
    if (delErr) return { error: delErr.message }

    const { error: ingErr } = await supabase
      .from('recipe_ingredients')
      .insert(buildIngredientRows(recipeId))
    if (ingErr) {
      // Best-effort restore: the recipe keeps its previous ingredients + totals.
      if (backup.length > 0) await supabase.from('recipe_ingredients').insert(backup)
      return { error: ingErr.message }
    }

    const { error } = await supabase
      .from('recipes')
      .update(recipeRow)
      .eq('id', recipeId)
      .select('id')
      .single()
    // Ingredients are already updated; stale totals self-heal on the next save.
    if (error) return { error: error.message }

    if (retroSince) {
      const { data: logRows, error: logErr } = await supabase
        .from('food_logs')
        .select('id, grams')
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId)
        .eq('is_deleted', false)
        .gte('entry_date', retroSince)
      if (logErr) {
        return {
          error: `Meal saved, but updating logged entries failed: ${logErr.message}`,
          id: recipeId,
          updatedLogs,
        }
      }

      const nextTotals: RecipeTotals = {
        name: v.name,
        total_grams: totalGrams,
        total_kcal: totalKcal,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fat: totalFat,
        total_fiber: totalFiber,
        total_sugar: totalSugar,
        total_sodium_mg: totalSodiumMg,
        total_sat_fat: totalSatFat,
      }

      // Personal log volume — row-by-row updates are fine (and PostgREST's
      // 1000-row default page is far above any realistic per-recipe count).
      for (const row of (logRows ?? []) as { id: string; grams: number | null }[]) {
        const patch = rescaleLoggedEntry(row.grams, oldTotalGrams, nextTotals)
        if (!patch) continue // portion not derivable — leave the snapshot alone
        const { error: upErr } = await supabase
          .from('food_logs')
          .update(patch)
          .eq('id', row.id)
        if (upErr) {
          return {
            error: `Meal saved and ${updatedLogs} logged ${updatedLogs === 1 ? 'entry' : 'entries'} updated, but the rest failed: ${upErr.message}. Re-open the meal to retry.`,
            id: recipeId,
            updatedLogs,
          }
        }
        updatedLogs++
      }
      revalidatePath('/nutrition')
    }
  } else {
    const { data, error } = await supabase
      .from('recipes')
      .insert(recipeRow)
      .select('id')
      .single()
    if (error) return { error: error.message }
    recipeId = (data as { id: string }).id

    const { error: ingErr } = await supabase
      .from('recipe_ingredients')
      .insert(buildIngredientRows(recipeId))
    if (ingErr) {
      // Best-effort cleanup of the orphaned recipe row (mirrors the route handler).
      await supabase.from('recipes').delete().eq('id', recipeId)
      return { error: ingErr.message }
    }
  }

  revalidatePath('/nutrition/library')
  return { error: null, id: recipeId, updatedLogs }
}

// ---------------------------------------------------------------------------
// getRecipeSummary — lightweight fetch for edit-dialog servings derivation
// ---------------------------------------------------------------------------

export async function getRecipeSummary(
  recipeId: string
): Promise<{ id: string; name: string; total_grams: number } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, total_grams')
    .eq('id', recipeId)
    .eq('is_deleted', false)
    .maybeSingle()
  // Distinguish DB failures (reject → the form's .catch() recovers) from a
  // genuinely missing recipe (null).
  if (error) {
    console.error('getRecipeSummary failed:', error.message)
    throw new Error(error.message)
  }
  if (!data) return null
  const row = data as { id: string; name: string; total_grams: number }
  return { id: row.id, name: row.name, total_grams: row.total_grams }
}

// ---------------------------------------------------------------------------
// getRecipeLogStats — how many logged entries reference a recipe, and the
// earliest entry date (prefill for the retro "since" cutoff).
// ---------------------------------------------------------------------------

export async function getRecipeLogStats(
  recipeId: string
): Promise<{ count: number; earliestDate: string | null }> {
  const { supabase, user } = await getSessionUser()
  if (!user) return { count: 0, earliestDate: null }

  const { data, count, error } = await supabase
    .from('food_logs')
    .select('entry_date', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('recipe_id', recipeId)
    .eq('is_deleted', false)
    .order('entry_date', { ascending: true })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }
  const earliest = (data?.[0] as { entry_date: string } | undefined)?.entry_date ?? null
  // entry_date can be a timestamp; the <input type="date"> needs YYYY-MM-DD.
  return { count: count ?? 0, earliestDate: earliest ? earliest.slice(0, 10) : null }
}

// ---------------------------------------------------------------------------
// deleteRecipe
// ---------------------------------------------------------------------------

export async function deleteRecipe(id: string): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const { error } = await supabase.from('recipes').update({ is_deleted: true }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/nutrition/library')
  return { error: null }
}

// ---------------------------------------------------------------------------
// searchFoods
// ---------------------------------------------------------------------------

export interface LibrarySearchResult {
  kind: 'custom_food' | 'recipe'
  id: string
  name: string
  default_grams: number
  per100g: Macros100
}

export interface SearchFoodsResult {
  library: LibrarySearchResult[]
  nevo: {
    nevo_code: string
    name_nl: string
    name_en: string | null
    per100g: Macros100
  }[]
  off: {
    barcode: string
    name: string
    per100g: Macros100
  }[]
}

export async function searchFoods(q: string): Promise<SearchFoodsResult> {
  const empty: SearchFoodsResult = { library: [], nevo: [], off: [] }
  if (!q || q.length < 2) return empty

  const { supabase, user } = await getSessionUser()
  if (!user) return empty

  const normalized = normalizeName(q)

  // Push the name filter into the DB to keep payloads small; the normalized
  // substring pass below still refines the result. (ilike is diacritic-exact —
  // acceptable for user-named library entries.)
  const [cfResult, recResult, nevoResult, offResult] = await Promise.all([
    supabase
      .from('custom_foods')
      .select('*')
      .eq('is_deleted', false)
      .ilike('name', `%${q}%`)
      .limit(50),
    supabase
      .from('recipes')
      .select('*')
      .eq('is_deleted', false)
      .ilike('name', `%${q}%`)
      .limit(50),
    // Generous result counts: this feeds the browsable ingredient picker.
    // Library: 50 custom foods + 50 recipes (combined up to 100 before the
    // normalised-name post-filter). The AI matching pipeline keeps its own
    // tighter top-5 calls.
    supabase.rpc('search_nevo', { q, max_results: 50 }),
    searchOff(q, 25),
  ])

  const customFoods = (cfResult.data ?? []) as CustomFood[]
  const recipes = (recResult.data ?? []) as Recipe[]
  const nevoFoods = (nevoResult.data ?? []) as NevoFood[]

  // Filter library by normalized substring
  const matchingCustomFoods: LibrarySearchResult[] = customFoods
    .filter((f) => normalizeName(f.name).includes(normalized))
    .map((f) => ({
      kind: 'custom_food' as const,
      id: f.id,
      name: f.name,
      default_grams: f.default_grams,
      per100g: {
        kcal: f.kcal_per_100g ?? 0,
        protein: f.protein_per_100g ?? 0,
        carbs: f.carbs_per_100g ?? 0,
        fat: f.fat_per_100g ?? 0,
        fiber: f.fiber_per_100g ?? 0,
        sugar: f.sugar_per_100g ?? 0,
        sodium_mg: f.sodium_mg_per_100g ?? 0,
        sat_fat: f.sat_fat_per_100g ?? 0,
      },
    }))

  const matchingRecipes: LibrarySearchResult[] = recipes
    .filter((r) => normalizeName(r.name).includes(normalized))
    .map((r) => {
      const k = r.total_grams > 0 ? 100 / r.total_grams : 0
      return {
        kind: 'recipe' as const,
        id: r.id,
        name: r.name,
        default_grams: r.total_grams,
        per100g: {
          kcal: r.total_kcal * k,
          protein: r.total_protein * k,
          carbs: r.total_carbs * k,
          fat: r.total_fat * k,
          fiber: r.total_fiber * k,
          sugar: r.total_sugar * k,
          sodium_mg: r.total_sodium_mg * k,
          sat_fat: r.total_sat_fat * k,
        },
      }
    })

  return {
    library: [...matchingCustomFoods, ...matchingRecipes],
    nevo: nevoFoods.map((f) => ({
      nevo_code: f.nevo_code,
      name_nl: f.name_nl,
      name_en: f.name_en,
      per100g: {
        kcal: f.kcal_per_100g ?? 0,
        protein: f.protein_per_100g ?? 0,
        carbs: f.carbs_per_100g ?? 0,
        fat: f.fat_per_100g ?? 0,
        fiber: f.fiber_per_100g ?? 0,
        sugar: f.sugar_per_100g ?? 0,
        sodium_mg: f.sodium_mg_per_100g ?? 0,
        sat_fat: f.sat_fat_per_100g ?? 0,
      },
    })),
    off: offResult.map((o) => ({
      barcode: o.barcode,
      name: o.name,
      per100g: o.per100g,
    })),
  }
}
