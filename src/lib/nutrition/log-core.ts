import type { FoodSource, FoodLog, MealType } from '@/lib/database.types'
import type { ExtractionV2 } from './types'
import type { MatchedItem, MatchDeps, Macros100 } from './match'
import { computeEntryDate, bucketMealTime } from './parse'
import { scaleTo } from './macros'

// ---------------------------------------------------------------------------
// Row type for food_logs insert
// ---------------------------------------------------------------------------

export interface FoodLogInsertRow {
  user_id: string
  entry_date: string
  raw_input: string | null
  food_name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  saturated_fat_g: number | null
  meal_type: MealType | null
  notes: string | null
  source: FoodSource
  is_deleted: boolean
  grams: number | null
  match_source: FoodLog['match_source']
  match_ref: string | null
  recipe_id: string | null
  custom_food_id: string | null
  submission_id: string | null
  image_path: string | null
  weight_estimated: boolean
}

// ---------------------------------------------------------------------------
// Outcome types
// ---------------------------------------------------------------------------

export interface LoggedItemSummary {
  name: string
  grams: number
  matchSource: FoodLog['match_source']
}

export type LogOutcome =
  | { kind: 'question'; question: string }
  | {
      kind: 'logged'
      submissionId: string
      foodName: string
      notes: string | null
      mealType: MealType
      items: LoggedItemSummary[]
      totals: Macros100
    }

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface LogDeps extends MatchDeps {
  parse: (
    text: string,
    opts: { libraryNames: string[]; assumeDefaults: boolean }
  ) => Promise<ExtractionV2>
  insertRows: (rows: FoodLogInsertRow[]) => Promise<{ error: string | null }>
  now?: () => Date
}

// ---------------------------------------------------------------------------
// Entry-date resolution helper (exported so callers can reuse)
// ---------------------------------------------------------------------------

/** Resolve the calendar day + meal slot into a concrete Date.
 *  When `dateOverride` is provided it fixes the calendar day; otherwise
 *  `dateOffsetDays` (from the parser) or "now" is used. */
export function resolveEntryDate(
  mealType: MealType,
  dateOverride: string | null,
  dateOffsetDays: number | null,
  now: Date = new Date()
): Date {
  if (dateOverride) {
    // Build a temporary Date at noon UTC for the overridden day, then apply the
    // meal-slot hour in local time so it lands in the right calendar day.
    const base = new Date(`${dateOverride}T12:00:00`)
    switch (mealType) {
      case 'breakfast':
        base.setHours(8, 0, 0, 0)
        break
      case 'lunch':
        base.setHours(12, 30, 0, 0)
        break
      case 'snack':
        base.setHours(15, 0, 0, 0)
        break
      case 'dinner':
        base.setHours(19, 0, 0, 0)
        break
    }
    return base
  }
  return computeEntryDate(dateOffsetDays, mealType, now)
}

// ---------------------------------------------------------------------------
// sumMacros helper
// ---------------------------------------------------------------------------

function sumMacros(list: Macros100[]): Macros100 {
  return list.reduce<Macros100>(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fiber: acc.fiber + m.fiber,
      sugar: acc.sugar + m.sugar,
      sodium_mg: acc.sodium_mg + m.sodium_mg,
      sat_fat: acc.sat_fat + m.sat_fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0, sat_fat: 0 },
  )
}

// ---------------------------------------------------------------------------
// Core orchestrator
// ---------------------------------------------------------------------------

export async function logSubmission(
  deps: LogDeps,
  args: {
    userId: string
    text: string
    source: FoodSource
    mealOverride: MealType | null
    dateOverride: string | null
    assumeDefaults: boolean
  }
): Promise<LogOutcome> {
  const { userId, text, source, mealOverride, dateOverride, assumeDefaults } = args
  const now = deps.now ? deps.now() : new Date()

  // Get library names for the parser hint
  const libraryNames = deps.library.map((l) => l.name)

  // 1. Parse
  const parsed = await deps.parse(text, { libraryNames, assumeDefaults })

  // 2. If clarification needed and we're not in assume-defaults mode, return question
  if (parsed.question && !assumeDefaults) {
    return { kind: 'question', question: parsed.question }
  }

  // 3. Determine meal type and entry date
  const mealType: MealType = mealOverride ?? parsed.meal_time ?? bucketMealTime(now)
  const entryDate = resolveEntryDate(mealType, dateOverride, parsed.date_offset_days, now)

  // 4. Match each item (sequentially — respects rate limits and keeps deps simple)
  const { matchItem } = await import('./match')
  const submissionId = crypto.randomUUID()

  const matchedItems: MatchedItem[] = []
  for (const item of parsed.items) {
    const estimated: Macros100 = {
      kcal: item.estimated_calories ?? 0,
      protein: item.estimated_protein_g ?? 0,
      carbs: item.estimated_carbs_g ?? 0,
      fat: item.estimated_fat_g ?? 0,
      fiber: item.estimated_fiber_g ?? 0,
      sugar: item.estimated_sugar_g ?? 0,
      sodium_mg: item.estimated_sodium_mg ?? 0,
      sat_fat: item.estimated_saturated_fat_g ?? 0,
    }
    const matched = await matchItem({ query: item.query, grams: item.grams, estimated }, deps)
    matchedItems.push(matched)
  }

  // 5. Build insert rows — all items share submission_id and raw_input
  const rows: FoodLogInsertRow[] = matchedItems.map((matched) => ({
    user_id: userId,
    entry_date: entryDate.toISOString(),
    raw_input: text,
    food_name: matched.name,
    calories: matched.macros.kcal,
    protein_g: matched.macros.protein,
    carbs_g: matched.macros.carbs,
    fat_g: matched.macros.fat,
    fiber_g: matched.macros.fiber,
    sugar_g: matched.macros.sugar,
    sodium_mg: matched.macros.sodium_mg,
    saturated_fat_g: matched.macros.sat_fat,
    meal_type: mealType,
    notes: parsed.notes,
    source,
    is_deleted: false,
    grams: matched.grams,
    match_source: matched.source,
    match_ref: matched.ref,
    recipe_id: matched.recipeId,
    custom_food_id: matched.customFoodId,
    submission_id: submissionId,
    image_path: null,
    weight_estimated: false,
  }))

  // 6. Insert all rows in one call
  const { error } = await deps.insertRows(rows)
  if (error) throw new Error(error)

  // 7. Return outcome
  const totals = sumMacros(matchedItems.map((m) => m.macros))

  return {
    kind: 'logged',
    submissionId,
    foodName: parsed.food_name,
    notes: parsed.notes,
    mealType,
    items: matchedItems.map((m) => ({
      name: m.name,
      grams: m.grams,
      matchSource: m.source,
    })),
    totals,
  }
}

// ---------------------------------------------------------------------------
// logConfirmedItems — persist already-matched items (photo flow). No parse,
// no matching: the items arrive confirmed from /api/nutrition/photo/analyze.
// ---------------------------------------------------------------------------

export interface ConfirmedItem {
  query: string
  grams: number
  per100: Macros100
  weightEstimated: boolean
  matchSource: FoodLog['match_source']
  matchRef: string | null
  recipeId: string | null
  customFoodId: string | null
}

export interface LogConfirmedDeps {
  insertRows: (rows: FoodLogInsertRow[]) => Promise<{ error: string | null }>
  now?: () => Date
}

export interface LogConfirmedResult {
  submissionId: string
  foodName: string
  mealType: MealType
  imagePath: string | null
  items: LoggedItemSummary[]
  totals: Macros100
}

export async function logConfirmedItems(
  deps: LogConfirmedDeps,
  args: {
    userId: string
    source: FoodSource
    foodName: string
    notes: string | null
    mealOverride: MealType | null
    dateOverride: string | null
    imagePath: string | null
    items: ConfirmedItem[]
  },
): Promise<LogConfirmedResult> {
  const now = deps.now ? deps.now() : new Date()
  const mealType: MealType = args.mealOverride ?? bucketMealTime(now)
  const entryDate = resolveEntryDate(mealType, args.dateOverride, null, now)
  const submissionId = crypto.randomUUID()

  const perItem = args.items.map((it) => ({ it, macros: scaleTo(it.per100, it.grams) }))

  const rows: FoodLogInsertRow[] = perItem.map(({ it, macros }) => ({
    user_id: args.userId,
    entry_date: entryDate.toISOString(),
    raw_input: null,
    food_name: it.query,
    calories: macros.kcal,
    protein_g: macros.protein,
    carbs_g: macros.carbs,
    fat_g: macros.fat,
    fiber_g: macros.fiber,
    sugar_g: macros.sugar,
    sodium_mg: macros.sodium_mg,
    saturated_fat_g: macros.sat_fat,
    meal_type: mealType,
    notes: args.notes,
    source: args.source,
    is_deleted: false,
    grams: it.grams,
    match_source: it.matchSource,
    match_ref: it.matchRef,
    recipe_id: it.recipeId,
    custom_food_id: it.customFoodId,
    submission_id: submissionId,
    image_path: args.imagePath,
    weight_estimated: it.weightEstimated,
  }))

  const { error } = await deps.insertRows(rows)
  if (error) throw new Error(error)

  return {
    submissionId,
    foodName: args.foodName,
    mealType,
    imagePath: args.imagePath,
    items: perItem.map(({ it }) => ({ name: it.query, grams: it.grams, matchSource: it.matchSource })),
    totals: sumMacros(perItem.map((p) => p.macros)),
  }
}
