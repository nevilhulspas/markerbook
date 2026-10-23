import { z } from 'zod'

import { normalizeQualifier, RESULT_QUALIFIERS } from '@/lib/blood-tests/qualifier'

export const extractedMarkerSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  catalog_match: z.string().nullable(),
  loinc_code: z.string().nullable().optional(),
  ref_range_low: z.number().nullable().optional(),
  ref_range_high: z.number().nullable().optional(),
  // An unknown sign is dropped, not fatal: one odd row must not fail the import.
  qualifier: z.preprocess((v) => normalizeQualifier(v), z.enum(RESULT_QUALIFIERS).nullable()).optional(),
})

export const extractionResultSchema = z.object({
  test_date: z.string().nullable(),
  lab_name: z.string().nullable(),
  sample_type: z.enum(['serum', 'plasma', 'unknown']),
  markers: z.array(extractedMarkerSchema),
})
