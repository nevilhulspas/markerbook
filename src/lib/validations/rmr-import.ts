import { z } from 'zod'

// Optional fields are nullable with a null default so a missing key parses to
// null (mirrors dexa-import.ts: extraction omits keys it can't read).
const nullableNumber = z.number().nullable().default(null)

export const rmrTestSchema = z.object({
  test_date: z.string().min(1),
  provider: z.string().nullable().default(null),
  rmr_kcal: z.number(), // measured RMR (kcal/day), required
  predicted_rmr_kcal: nullableNumber,
  rer: nullableNumber,
  fuel_carb_pct: nullableNumber,
  fuel_fat_pct: nullableNumber,
})

export const rmrExtractionSchema = z.object({ test: rmrTestSchema })

export type RmrExtraction = z.infer<typeof rmrExtractionSchema>
export type RmrTestExtract = z.infer<typeof rmrTestSchema>
