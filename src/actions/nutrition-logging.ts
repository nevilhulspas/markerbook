'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/session'
import { countedAiCall, takeAiRequest } from '@/lib/ai/quota'
import { isAiConfigured } from '@/lib/ai/config'
import { AI_NOT_CONFIGURED_MESSAGE } from '@/lib/ai/messages'
import {
  isUndoCommand,
  parseSaveCommand,
  bucketMealTime,
  parseFoodTextV2,
} from '@/lib/nutrition/parse'
import { rerankCandidates, scaleTo, type Macros100 } from '@/lib/nutrition/match'
import { loadLibraryItems } from '@/lib/nutrition/library'
import { searchOff } from '@/lib/nutrition/off'
import { logSubmission, resolveEntryDate, type FoodLogInsertRow } from '@/lib/nutrition/log-core'
import type { FoodLog, MealType, NevoFood, CustomFood, Recipe } from '@/lib/database.types'
import type { MatchSource } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// logFood v2
// ---------------------------------------------------------------------------

export type LogFoodResult =
  | { ok: true; undone: true; message: string }
  | { ok: true; saved: true; name: string }
  | { ok: true; question: string }
  | {
      ok: true
      logged: {
        foodName: string
        items: { name: string; grams: number; matchSource: MatchSource | null }[]
        totals: Macros100
      }
    }
  | { ok: false; error: string }

export async function logFood(
  rawText: string,
  opts?: {
    meal?: MealType | null
    date?: string | null
    clarification?: string | null
  }
): Promise<LogFoodResult> {
  const text = rawText.trim()
  if (!text) return { ok: false, error: 'Say what you ate.' }

  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { ok: false, error: authError ?? 'You must be signed in.' }

  // ── Undo ─────────────────────────────────────────────────────────────────
  if (isUndoCommand(text)) {
    const { data: last } = await supabase
      .from('food_logs')
      .select('id, food_name')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!last) return { ok: true, undone: true, message: 'No recent meal to undo.' }
    const { error } = await supabase
      .from('food_logs')
      .update({ is_deleted: true })
      .eq('id', (last as { id: string }).id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/nutrition')
    return {
      ok: true,
      undone: true,
      message: `Removed: ${(last as { food_name: string }).food_name}`,
    }
  }

  // ── Save-command ──────────────────────────────────────────────────────────
  const saveName = parseSaveCommand(text)
  if (saveName) {
    const result = await promoteLatestSubmission(saveName)
    if (result.error) return { ok: false, error: result.error }
    revalidatePath('/nutrition')
    return { ok: true, saved: true, name: saveName }
  }

  // ── Normal logging ────────────────────────────────────────────────────────
  if (!isAiConfigured()) return { ok: false, error: AI_NOT_CONFIGURED_MESSAGE }
  const quota = await takeAiRequest(user.id)
  if (!quota.ok) return { ok: false, error: quota.error }

  // RLS-scoped client (no user_id filter), ordered by name.
  const library = await loadLibraryItems(await createClient(), { orderByName: true, logTag: '[logFood]' })

  // Append clarification to text when provided
  const effectiveText = opts?.clarification
    ? `${text}\nClarification: ${opts.clarification}`
    : text

  const assumeDefaults = !!opts?.clarification

  try {
    const outcome = await logSubmission(
      {
        library,
        searchNevo: async (q: string) => {
          const { data, error } = await supabase.rpc('search_nevo', { q, max_results: 5 })
          if (error) console.error('[logFood] NEVO search failed:', error.message)
          return (data ?? []) as NevoFood[]
        },
        searchOff,
        rerank: countedAiCall(user.id, rerankCandidates, null),
        parse: parseFoodTextV2,
        insertRows: async (rows: FoodLogInsertRow[]) => {
          const { error } = await supabase.from('food_logs').insert(rows)
          return { error: error?.message ?? null }
        },
      },
      {
        userId: user.id,
        text: effectiveText,
        source: 'app',
        mealOverride: opts?.meal ?? null,
        dateOverride: opts?.date ?? null,
        assumeDefaults,
      }
    )

    if (outcome.kind === 'question') {
      return { ok: true, question: outcome.question }
    }

    revalidatePath('/nutrition')
    return {
      ok: true,
      logged: {
        foodName: outcome.foodName,
        items: outcome.items.map((it) => ({
          name: it.name,
          grams: it.grams,
          matchSource: it.matchSource,
        })),
        totals: outcome.totals,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not log that meal.' }
  }
}

// ---------------------------------------------------------------------------
// promoteLatestSubmission — save latest logged items as a recipe
// ---------------------------------------------------------------------------

async function promoteLatestSubmission(
  name: string
): Promise<{ error: string | null; recipeId?: string }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  // Find the most recent non-deleted row to get its submission_id
  const { data: anchor } = await supabase
    .from('food_logs')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!anchor) return { error: 'No recent meal to save.' }

  const anchorRow = anchor as FoodLog

  // Load all rows of that submission
  let rows: FoodLog[] = []
  if (anchorRow.submission_id) {
    const { data: siblings } = await supabase
      .from('food_logs')
      .select('*')
      .eq('submission_id', anchorRow.submission_id)
      .eq('is_deleted', false)
    rows = (siblings ?? []) as FoodLog[]
  } else {
    rows = [anchorRow]
  }

  if (rows.length === 0) rows = [anchorRow]

  // Compute totals and per-100g for each ingredient
  let totalGrams = 0
  let totalKcal = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0
  let totalFiber = 0
  let totalSugar = 0
  let totalSodiumMg = 0
  let totalSatFat = 0

  for (const r of rows) {
    const g = r.grams ?? 100
    totalGrams += g
    totalKcal += r.calories ?? 0
    totalProtein += r.protein_g ?? 0
    totalCarbs += r.carbs_g ?? 0
    totalFat += r.fat_g ?? 0
    totalFiber += r.fiber_g ?? 0
    totalSugar += r.sugar_g ?? 0
    totalSodiumMg += r.sodium_mg ?? 0
    totalSatFat += r.saturated_fat_g ?? 0
  }

  // Insert recipe
  const { data: recipeData, error: recipeErr } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      name,
      notes: null,
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
    })
    .select('id')
    .single()

  if (recipeErr) return { error: recipeErr.message }
  const recipeId = (recipeData as { id: string }).id

  // Insert ingredients
  const ingredients = rows.map((r, idx) => {
    const g = r.grams ?? 100
    // grams<=0 (estimate without amount) → zero snapshot; recipe totals stay correct (summed from row macros).
    const k = g > 0 ? 100 / g : 0
    return {
      recipe_id: recipeId,
      position: idx,
      nevo_code: r.match_source === 'nevo' ? r.match_ref : null,
      off_barcode: r.match_source === 'off' ? r.match_ref : null,
      custom_food_id: r.custom_food_id,
      raw_name: r.food_name,
      grams: g,
      kcal_per_100g: (r.calories ?? 0) * k,
      protein_per_100g: (r.protein_g ?? 0) * k,
      carbs_per_100g: (r.carbs_g ?? 0) * k,
      fat_per_100g: (r.fat_g ?? 0) * k,
      fiber_per_100g: (r.fiber_g ?? 0) * k,
      sugar_per_100g: (r.sugar_g ?? 0) * k,
      sodium_mg_per_100g: (r.sodium_mg ?? 0) * k,
      sat_fat_per_100g: (r.saturated_fat_g ?? 0) * k,
    }
  })

  const { error: ingErr } = await supabase.from('recipe_ingredients').insert(ingredients)
  if (ingErr) {
    // Best-effort cleanup of the orphaned recipe row (mirrors the route handler).
    await supabase.from('recipes').delete().eq('id', recipeId)
    return { error: ingErr.message }
  }

  return { error: null, recipeId }
}

// ---------------------------------------------------------------------------
// logRecipe
// ---------------------------------------------------------------------------

export async function logRecipe(
  recipeId: string,
  servings: number,
  opts?: { meal?: MealType | null; date?: string | null }
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const { data: recipeData } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!recipeData) return { error: 'Recipe not found.' }

  const r = recipeData as Recipe
  const grams = r.total_grams * servings
  const now = new Date()
  const mealType: MealType = opts?.meal ?? bucketMealTime(now)
  const entryDate = resolveEntryDate(mealType, opts?.date ?? null, null, now)

  const { error } = await supabase.from('food_logs').insert({
    user_id: user.id,
    entry_date: entryDate.toISOString(),
    raw_input: null,
    food_name: r.name,
    calories: r.total_kcal * servings,
    protein_g: r.total_protein * servings,
    carbs_g: r.total_carbs * servings,
    fat_g: r.total_fat * servings,
    fiber_g: r.total_fiber * servings,
    sugar_g: r.total_sugar * servings,
    sodium_mg: r.total_sodium_mg * servings,
    saturated_fat_g: r.total_sat_fat * servings,
    meal_type: mealType,
    notes: null,
    source: 'app',
    is_deleted: false,
    grams,
    match_source: 'recipe' as MatchSource,
    match_ref: null,
    recipe_id: recipeId,
    custom_food_id: null,
    submission_id: crypto.randomUUID(),
  })

  if (error) return { error: error.message }
  revalidatePath('/nutrition')
  return { error: null }
}

// ---------------------------------------------------------------------------
// getTopRecipes
// ---------------------------------------------------------------------------

export async function getTopRecipes(limit = 5): Promise<(Recipe & { useCount: number })[]> {
  const { supabase, user } = await getSessionUser()
  if (!user) return []

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [recipeResult, logResult] = await Promise.all([
    supabase
      .from('recipes')
      .select('*')
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    supabase
      .from('food_logs')
      .select('recipe_id')
      .eq('is_deleted', false)
      .not('recipe_id', 'is', null)
      .gte('entry_date', since),
  ])

  const recipes = (recipeResult.data ?? []) as Recipe[]
  const logRows = (logResult.data ?? []) as { recipe_id: string | null }[]

  // Count uses per recipe
  const useCounts = new Map<string, number>()
  for (const row of logRows) {
    if (!row.recipe_id) continue
    useCounts.set(row.recipe_id, (useCounts.get(row.recipe_id) ?? 0) + 1)
  }

  return recipes
    .map((r) => ({ ...r, useCount: useCounts.get(r.id) ?? 0 }))
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// logCustomFood — one-tap log of a library custom food at default_grams
// ---------------------------------------------------------------------------

export async function logCustomFood(
  customFoodId: string,
  opts?: { meal?: MealType | null; date?: string | null }
): Promise<{ error: string | null }> {
  const { supabase, user, authError } = await getSessionUser()
  if (!user) return { error: authError ?? 'You must be signed in.' }

  const { data: cfData } = await supabase
    .from('custom_foods')
    .select('*')
    .eq('id', customFoodId)
    .eq('user_id', user.id) // explicit ownership filter (RLS enforces this too)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!cfData) return { error: 'Custom food not found.' }

  const cf = cfData as CustomFood
  const grams = cf.default_grams
  const per100g: Macros100 = {
    kcal: cf.kcal_per_100g ?? 0,
    protein: cf.protein_per_100g ?? 0,
    carbs: cf.carbs_per_100g ?? 0,
    fat: cf.fat_per_100g ?? 0,
    fiber: cf.fiber_per_100g ?? 0,
    sugar: cf.sugar_per_100g ?? 0,
    sodium_mg: cf.sodium_mg_per_100g ?? 0,
    sat_fat: cf.sat_fat_per_100g ?? 0,
  }
  const scaled = scaleTo(per100g, grams)

  const now = new Date()
  const mealType: MealType = opts?.meal ?? bucketMealTime(now)
  const entryDate = resolveEntryDate(mealType, opts?.date ?? null, null, now)

  const { error } = await supabase.from('food_logs').insert({
    user_id: user.id,
    entry_date: entryDate.toISOString(),
    raw_input: null,
    food_name: cf.name,
    calories: scaled.kcal,
    protein_g: scaled.protein,
    carbs_g: scaled.carbs,
    fat_g: scaled.fat,
    fiber_g: scaled.fiber,
    sugar_g: scaled.sugar,
    sodium_mg: scaled.sodium_mg,
    saturated_fat_g: scaled.sat_fat,
    meal_type: mealType,
    notes: null,
    source: 'app',
    is_deleted: false,
    grams,
    match_source: 'custom_food' as MatchSource,
    match_ref: null,
    recipe_id: null,
    custom_food_id: customFoodId,
    submission_id: crypto.randomUUID(),
  })

  if (error) return { error: error.message }
  revalidatePath('/nutrition')
  return { error: null }
}
