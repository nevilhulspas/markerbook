import { z } from 'zod'

/**
 * A manual body-metrics log entry. `logged_on` is required; at least one of
 * weight / body-fat % / waist must be present (an empty entry is meaningless).
 */
export const bodyLogEntrySchema = z
  .object({
    logged_on: z.string().min(1),
    weight_kg: z.number().positive().nullable().optional(),
    body_fat_pct: z.number().min(0).max(100).nullable().optional(),
    waist_cm: z.number().positive().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (v) => v.weight_kg != null || v.body_fat_pct != null || v.waist_cm != null,
    { message: 'Enter at least one of weight, body-fat %, or waist.' }
  )

export type BodyLogInput = z.infer<typeof bodyLogEntrySchema>
