import { z } from 'zod'
import { MEAL_TYPES } from '@/lib/database.types'

const optionalNonNegative = z.number().nonnegative().nullable().optional()

export const manualFoodLogSchema = z.object({
  entry_date: z.string().min(1, 'Pick a date'),
  food_name: z.string().min(1, 'Name the food'),
  calories: optionalNonNegative,
  protein_g: optionalNonNegative,
  carbs_g: optionalNonNegative,
  fat_g: optionalNonNegative,
  fiber_g: optionalNonNegative,
  sugar_g: optionalNonNegative,
  sodium_mg: optionalNonNegative,
  saturated_fat_g: optionalNonNegative,
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable().optional(),
  notes: z.string().nullable().optional(),
  grams: z.number().positive().nullable().optional(),
})

export type ManualFoodLogInput = z.infer<typeof manualFoodLogSchema>

/** Atwater factors: kcal per gram of each macro. */
export const MACRO_KCAL = { protein_g: 4, carbs_g: 4, fat_g: 9 } as const

/** Allowed relative gap between the calorie goal and the kcal implied by the macro goals. */
export const MACRO_KCAL_TOLERANCE = 0.05

/** kcal implied by the macro goals, or null when any macro is unset. */
export function macroKcal(t: {
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
}): number | null {
  if (t.protein_g == null || t.carbs_g == null || t.fat_g == null) return null
  return (
    t.protein_g * MACRO_KCAL.protein_g + t.carbs_g * MACRO_KCAL.carbs_g + t.fat_g * MACRO_KCAL.fat_g
  )
}

export const nutritionTargetsSchema = z
  .object({
    calories: z.number().int().nonnegative().nullable().optional(),
    protein_g: z.number().int().nonnegative().nullable().optional(),
    carbs_g: z.number().int().nonnegative().nullable().optional(),
    fat_g: z.number().int().nonnegative().nullable().optional(),
  })
  .refine(
    (t) => {
      if (t.calories == null) return true
      const fromMacros = macroKcal(t)
      if (fromMacros == null) return true
      return Math.abs(fromMacros - t.calories) <= t.calories * MACRO_KCAL_TOLERANCE
    },
    {
      message: `Macro goals don't match the calorie goal (must be within ${MACRO_KCAL_TOLERANCE * 100}%)`,
    }
  )
  .refine(
    (t) => {
      // Even with some macros unset, the set ones must not already exceed the calorie goal.
      if (t.calories == null) return true
      const partialKcal =
        (t.protein_g ?? 0) * MACRO_KCAL.protein_g +
        (t.carbs_g ?? 0) * MACRO_KCAL.carbs_g +
        (t.fat_g ?? 0) * MACRO_KCAL.fat_g
      return partialKcal <= t.calories * (1 + MACRO_KCAL_TOLERANCE)
    },
    { message: 'Macro goals exceed the calorie goal' }
  )

export type NutritionTargetsInput = z.infer<typeof nutritionTargetsSchema>

// ---------------------------------------------------------------------------
// Custom food schema (Phase 1.5)
// ---------------------------------------------------------------------------

const per100gField = z.number().nonnegative().nullable().optional().default(null)

export const customFoodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  brand: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  kcal_per_100g: per100gField,
  protein_per_100g: per100gField,
  carbs_per_100g: per100gField,
  fat_per_100g: per100gField,
  fiber_per_100g: per100gField,
  sugar_per_100g: per100gField,
  sodium_mg_per_100g: per100gField,
  sat_fat_per_100g: per100gField,
  default_grams: z.number().positive().default(100),
})

export type CustomFoodInput = z.infer<typeof customFoodSchema>

// ---------------------------------------------------------------------------
// Recipe schema (Phase 1.5)
// ---------------------------------------------------------------------------

export const recipeIngredientInputSchema = z
  .object({
    nevo_code: z.string().nullable().optional(),
    off_barcode: z.string().nullable().optional(),
    custom_food_id: z.string().uuid().nullable().optional(),
    raw_name: z.string().nullable().optional(),
    grams: z.number().positive('Grams must be positive'),
    kcal_per_100g: per100gField,
    protein_per_100g: per100gField,
    carbs_per_100g: per100gField,
    fat_per_100g: per100gField,
    fiber_per_100g: per100gField,
    sugar_per_100g: per100gField,
    sodium_mg_per_100g: per100gField,
    sat_fat_per_100g: per100gField,
  })
  .refine(
    (d) => d.raw_name || d.nevo_code || d.off_barcode || d.custom_food_id,
    { message: 'Ingredient must have a name or a reference (nevo_code, off_barcode, or custom_food_id)' }
  )

export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>

export const recipeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  notes: z.string().nullable().optional().default(null),
  ingredients: z.array(recipeIngredientInputSchema).min(1, 'At least one ingredient is required'),
})

export type RecipeInput = z.infer<typeof recipeSchema>

// AUT-955: optional retro choice carried with saveRecipe — "also update logged
// entries with entry_date >= since". `since` is an exact ISO instant: the
// client computes the user's LOCAL midnight for the picked date (UI days are
// grouped by local day), keeping the server timezone-agnostic.
export const recipeRetroSchema = z.object({
  since: z.string().datetime({ message: 'Invalid timestamp (expected ISO 8601)' }),
})

export type RecipeRetroInput = z.infer<typeof recipeRetroSchema>

// ---------------------------------------------------------------------------
// Photo log validation (Task 6)
// ---------------------------------------------------------------------------

const MATCH_SOURCES = ['nevo', 'off', 'custom_food', 'recipe', 'estimate', 'manual', 'legacy_usda'] as const

const macros100Schema = z.object({
  kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(),
  fiber: z.number(), sugar: z.number(), sodium_mg: z.number(), sat_fat: z.number(),
})

export const confirmedPhotoItemSchema = z.object({
  query: z.string().min(1),
  grams: z.number().positive(),
  per100: macros100Schema,
  weightEstimated: z.boolean(),
  matchSource: z.enum(MATCH_SOURCES),
  matchRef: z.string().nullable(),
  recipeId: z.string().uuid().nullable(),
  customFoodId: z.string().uuid().nullable(),
})

export const photoLogBodySchema = z.object({
  food_name: z.string().min(1),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
  meal: z.enum([...MEAL_TYPES]).nullable().optional().transform((v) => v ?? null),
  date: z.string().nullable().optional().transform((v) => v ?? null),
  items: z.array(confirmedPhotoItemSchema).min(1),
})
export type PhotoLogBody = z.infer<typeof photoLogBodySchema>
