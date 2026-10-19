import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveUserIdByToken } from '@/lib/nutrition/log-token'
import { isUndoCommand, parseSaveCommand } from '@/lib/nutrition/parse'
import { parseFoodTextV2 } from '@/lib/nutrition/parse'
import { takeAiRequest } from '@/lib/ai/quota'
import { rerankCandidates, type LibraryItem } from '@/lib/nutrition/match'
import { loadLibraryItems } from '@/lib/nutrition/library'
import { searchOff } from '@/lib/nutrition/off'
import { logSubmission, type FoodLogInsertRow } from '@/lib/nutrition/log-core'
import type { FoodLog, MealType, NevoFood } from '@/lib/database.types'
import type { MatchSource } from '@/lib/database.types'

function readToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return new URL(req.url).searchParams.get('token')
}

/** Token auth (iPhone Shortcut) when a token is supplied — an explicit bad
 *  token stays a hard 401. Otherwise the logged-in session cookie (native
 *  Log Food intent, whose URLSession shares the app's cookies) authenticates. */
async function authenticate(req: Request): Promise<string | null> {
  const token = readToken(req)
  if (token) return resolveUserIdByToken(token)

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function POST(req: Request): Promise<Response> {
  const userId = await authenticate(req)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    food?: string
    meal?: string
    date?: string
    clarification?: string
    allow_question?: boolean
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }
  const food = (body.food ?? '').trim()
  if (!food) return Response.json({ error: "Missing 'food'" }, { status: 400 })

  const mealOverride = (body.meal as MealType | undefined) ?? null
  const dateOverride = body.date ?? null

  // Clarify round-trip (native Log Food intent): mirrors the `logFood` server
  // action — a clarification is appended to the original text and defaults are
  // assumed on that second round. `allow_question` opts into receiving a
  // `{ question }` response; the legacy iPhone Shortcut omits it and keeps the
  // always-assume behavior.
  const clarification = (body.clarification ?? '').trim()
  const effectiveFood = clarification ? `${food}\nClarification: ${clarification}` : food
  const assumeDefaults = clarification ? true : body.allow_question !== true

  // ── Undo ─────────────────────────────────────────────────────────────────
  if (isUndoCommand(food)) {
    const { data: last } = await supabaseAdmin
      .from('food_logs')
      .select('id, food_name')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (last) {
      const { error: undoError } = await supabaseAdmin
        .from('food_logs')
        .update({ is_deleted: true })
        .eq('id', (last as { id: string }).id)
      if (undoError) return Response.json({ error: undoError.message }, { status: 500 })
    }
    return Response.json({
      undone: true,
      food_name: (last as { food_name?: string } | null)?.food_name ?? null,
    })
  }

  // ── Save-command ──────────────────────────────────────────────────────────
  const saveName = parseSaveCommand(food)
  if (saveName) {
    // Find the user's most recent row for submission grouping
    const { data: anchor } = await supabaseAdmin
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!anchor) {
      return Response.json({ message: 'No recent meal to save.', success: false })
    }

    const anchorRow = anchor as FoodLog
    let rows: FoodLog[] = []
    if (anchorRow.submission_id) {
      const { data: siblings } = await supabaseAdmin
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('submission_id', anchorRow.submission_id)
        .eq('is_deleted', false)
      rows = (siblings ?? []) as FoodLog[]
    } else {
      rows = [anchorRow]
    }
    if (rows.length === 0) rows = [anchorRow]

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

    const { data: recipeData, error: recipeErr } = await supabaseAdmin
      .from('recipes')
      .insert({
        user_id: userId,
        name: saveName,
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

    if (recipeErr) return Response.json({ error: recipeErr.message }, { status: 500 })
    const recipeId = (recipeData as { id: string }).id

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

    const { error: ingErr } = await supabaseAdmin.from('recipe_ingredients').insert(ingredients)
    if (ingErr) {
      // Don't leave an empty recipe behind — best-effort cleanup of the row we just created.
      await supabaseAdmin.from('recipes').delete().eq('id', recipeId)
      return Response.json({ error: ingErr.message }, { status: 500 })
    }

    return Response.json({
      message: `Saved as meal: ${saveName}`,
      saved: true,
      recipe_id: recipeId,
      food_name: saveName,
      items: rows.length,
    })
  }

  // ── Load library (admin, filtered by user_id) ─────────────────────────────
  let library: LibraryItem[] = []
  try {
    library = await loadLibraryItems(supabaseAdmin, { userId, logTag: '[log route]' })
  } catch (err) {
    console.error('[log route] Library load failed:', err)
  }

  // ── AI limit (the parse below calls the model) ─────────────────────────────
  const quota = await takeAiRequest(userId)
  if (!quota.ok) return Response.json({ error: quota.error }, { status: 429 })

  // ── Log submission ─────────────────────────────────────────────────────────
  let outcome
  try {
    outcome = await logSubmission(
      {
        library,
        searchNevo: async (q: string) => {
          const { data, error } = await supabaseAdmin.rpc('search_nevo', { q, max_results: 5 })
          if (error) console.error('[log route] NEVO search failed:', error.message)
          return (data ?? []) as NevoFood[]
        },
        searchOff,
        rerank: rerankCandidates,
        parse: parseFoodTextV2,
        insertRows: async (rows: FoodLogInsertRow[]) => {
          const { error } = await supabaseAdmin.from('food_logs').insert(rows)
          return { error: error?.message ?? null }
        },
      },
      {
        userId,
        text: effectiveFood,
        source: 'shortcut',
        mealOverride,
        dateOverride,
        assumeDefaults,
      }
    )
  } catch (e) {
    console.error('[log route] logSubmission failed:', e)
    return Response.json({ error: 'Could not parse the meal' }, { status: 502 })
  }

  if (outcome.kind === 'question') {
    if (!assumeDefaults) {
      // Caller opted in via allow_question — let it ask the user and re-post
      // with `clarification`.
      return Response.json({ question: outcome.question })
    }
    // Shouldn't happen with assumeDefaults: true, but handle defensively
    return Response.json({ error: 'Unexpected clarification request' }, { status: 500 })
  }

  // ── Build caltrack-compatible aggregate response ──────────────────────────
  const { totals, items, foodName, notes } = outcome

  const matched = items.filter((it) => {
    const src = it.matchSource as MatchSource | null
    return src === 'nevo' || src === 'off' || src === 'legacy_usda'
  }).length
  const library_count = items.filter((it) => {
    const src = it.matchSource as MatchSource | null
    return src === 'recipe' || src === 'custom_food'
  }).length
  const estimated = items.filter((it) => {
    const src = it.matchSource as MatchSource | null
    return src === 'estimate' || src === 'manual' || src == null
  }).length

  return Response.json({
    calories: totals.kcal,
    protein_g: totals.protein,
    carbs_g: totals.carbs,
    fat_g: totals.fat,
    fiber_g: totals.fiber,
    sugar_g: totals.sugar,
    sodium_mg: totals.sodium_mg,
    saturated_fat_g: totals.sat_fat,
    food_name: foodName,
    notes,
    items: items.map((it) => ({
      name: it.name,
      grams: it.grams,
      match_source: it.matchSource,
    })),
    match_summary: {
      matched,
      library: library_count,
      estimated,
    },
  })
}
