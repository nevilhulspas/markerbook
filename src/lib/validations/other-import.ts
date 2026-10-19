import { z } from 'zod'

// Generic "Other test" extraction. Optional fields are nullable with a null
// default so a missing key parses to null (mirrors rmr-import.ts: the model
// omits keys it can't read).

export const OTHER_OUTCOMES = [
  'positive',
  'negative',
  'normal',
  'abnormal',
  'inconclusive',
  'not_applicable',
] as const

export const otherOutcomeSchema = z
  .enum(OTHER_OUTCOMES)
  .default('not_applicable')

// One individual reading. `value` is a string so it can hold "12", "Detected",
// "Elevated", etc. Everything but the label is optional.
export const otherValueSchema = z.object({
  label: z.string().min(1),
  value: z.string().nullable().default(null),
  unit: z.string().nullable().default(null),
  flag: z.string().nullable().default(null),
})

export const otherTestSchema = z.object({
  test_name: z.string().min(1), // e.g. "SIBO breath test"
  test_date: z.string().min(1),
  provider: z.string().nullable().default(null),
  outcome: otherOutcomeSchema,
  result_summary: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
})

export const otherExtractionSchema = z.object({
  test: otherTestSchema,
  values: z.array(otherValueSchema).default([]),
})

export type OtherExtraction = z.infer<typeof otherExtractionSchema>
export type OtherTestExtract = z.infer<typeof otherTestSchema>
export type OtherValueExtract = z.infer<typeof otherValueSchema>
