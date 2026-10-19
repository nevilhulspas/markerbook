import type { FoodLog, FoodSource } from '@/lib/database.types'
import type { NutritionExtraction } from './types'

/** Pure builder for a food_logs insert row. Shared by logFood + the Shortcut route. */
export function toFoodLogInsert(opts: {
  userId: string
  nutrition: NutritionExtraction
  entryDate: Date
  rawInput: string | null
  source: FoodSource
}// Photo/per-item columns (grams, match_source, match_ref, recipe_id, custom_food_id, submission_id,
// image_path, weight_estimated) are filled by DB defaults or the photo log path — not this builder.
): Omit<FoodLog, 'id' | 'created_at' | 'updated_at' | 'grams' | 'match_source' | 'match_ref' | 'recipe_id' | 'custom_food_id' | 'submission_id' | 'image_path' | 'weight_estimated'> {
  const { userId, nutrition: n, entryDate, rawInput, source } = opts
  return {
    user_id: userId,
    entry_date: entryDate.toISOString(),
    raw_input: rawInput,
    food_name: n.food_name,
    calories: n.calories,
    protein_g: n.protein_g,
    carbs_g: n.carbs_g,
    fat_g: n.fat_g,
    fiber_g: n.fiber_g,
    sugar_g: n.sugar_g,
    sodium_mg: n.sodium_mg,
    saturated_fat_g: n.saturated_fat_g,
    meal_type: n.meal_time,
    notes: n.notes,
    source,
    is_deleted: false,
  }
}
