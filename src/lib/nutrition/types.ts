import { z } from 'zod'

import { MEAL_TYPES } from '@/lib/database.types'

const nullableNumber = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => v ?? null)

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => v ?? null)

/** Shape Claude returns for one parsed meal. */
export const nutritionExtractionSchema = z.object({
  calories: nullableNumber,
  protein_g: nullableNumber,
  carbs_g: nullableNumber,
  fat_g: nullableNumber,
  fiber_g: nullableNumber,
  sugar_g: nullableNumber,
  sodium_mg: nullableNumber,
  saturated_fat_g: nullableNumber,
  food_name: z.string().min(1),
  notes: nullableString,
  date_offset_days: nullableNumber,
  meal_time: z
    .union([z.enum([...MEAL_TYPES]), z.null()])
    .optional()
    .transform((v) => v ?? null),
})

export type NutritionExtraction = z.infer<typeof nutritionExtractionSchema>

// ── v2 multi-item schema ────────────────────────────────────────────────────

/** One food item extracted from a meal description. */
export const extractedItemSchema = z.object({
  query: z.string().min(1),
  grams: nullableNumber,
  // Estimated macros may come back null for exotic foods — coerced to 0 at match time (matchItem deps).
  estimated_calories: nullableNumber,
  estimated_protein_g: nullableNumber,
  estimated_carbs_g: nullableNumber,
  estimated_fat_g: nullableNumber,
  estimated_fiber_g: nullableNumber,
  estimated_sugar_g: nullableNumber,
  estimated_sodium_mg: nullableNumber,
  estimated_saturated_fat_g: nullableNumber,
})
export type ExtractedItem = z.infer<typeof extractedItemSchema>

/** Full v2 extraction result with multi-item support and clarifying questions. */
export const extractionV2Schema = z.object({
  items: z.array(extractedItemSchema).min(1),
  food_name: z.string().min(1),
  notes: nullableString,
  date_offset_days: nullableNumber,
  meal_time: z
    .union([z.enum([...MEAL_TYPES]), z.null()])
    .optional()
    .transform((v) => v ?? null),
  question: nullableString,
})
export type ExtractionV2 = z.infer<typeof extractionV2Schema>
