import type { FoodLog, MealType } from '@/lib/database.types'
import { matchItem, type MatchDeps, type Macros100 } from './match'
import { per100From } from './macros'
import type { PhotoExtraction } from './photo-parse'

export interface AnalyzedItem {
  query: string
  grams: number
  per100: Macros100
  match_source: FoodLog['match_source']
  match_ref: string | null
  recipe_id: string | null
  custom_food_id: string | null
}

export interface PhotoAnalysis {
  food_name: string
  meal_time: MealType | null
  is_food: boolean
  question: string | null
  items: AnalyzedItem[]
}

export interface AnalyzePhotoDeps extends MatchDeps {
  parsePhoto: (opts: { libraryNames: string[]; clarification?: string | null }) => Promise<PhotoExtraction>
}

export async function analyzePhoto(
  deps: AnalyzePhotoDeps,
  args: { clarification?: string | null },
): Promise<PhotoAnalysis> {
  const libraryNames = deps.library.map((l) => l.name)
  const ext = await deps.parsePhoto({ libraryNames, clarification: args.clarification })

  // Ask first (or bail on non-food) before spending match calls.
  if (!ext.is_food || ext.question) {
    return { food_name: ext.food_name, meal_time: ext.meal_time, is_food: ext.is_food, question: ext.question, items: [] }
  }

  const items: AnalyzedItem[] = []
  for (const it of ext.items) {
    const estimated: Macros100 = {
      kcal: it.estimated_calories ?? 0,
      protein: it.estimated_protein_g ?? 0,
      carbs: it.estimated_carbs_g ?? 0,
      fat: it.estimated_fat_g ?? 0,
      fiber: it.estimated_fiber_g ?? 0,
      sugar: it.estimated_sugar_g ?? 0,
      sodium_mg: it.estimated_sodium_mg ?? 0,
      sat_fat: it.estimated_saturated_fat_g ?? 0,
    }
    // The photo flow requires a positive weight per item (the log payload schema enforces
    // grams > 0). The vision prompt always asks for a positive grams; floor to 100g defensively
    // so a model omission can't yield grams=0 → a mislabeled per100 and a whole-meal log failure.
    const grams = it.grams && it.grams > 0 ? it.grams : 100
    const matched = await matchItem({ query: it.query, grams, estimated }, deps)
    items.push({
      query: matched.name,
      grams: matched.grams,
      per100: per100From(matched.macros, matched.grams),
      match_source: matched.source,
      match_ref: matched.ref,
      recipe_id: matched.recipeId,
      custom_food_id: matched.customFoodId,
    })
  }

  return { food_name: ext.food_name, meal_time: ext.meal_time, is_food: true, question: null, items }
}
