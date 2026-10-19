import { z } from 'zod'

const rankEnum = z.enum([
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
  'strain',
  'functional_group',
])

const statusEnum = z.enum(['low', 'normal', 'high', 'unknown'])

const categoryEnum = z.enum([
  'beneficial',
  'commensal',
  'opportunistic',
  'pathogenic',
  'unknown',
])

export const microbiomeResultExtractionSchema = z.object({
  name: z.string().min(1),
  rank: rankEnum,
  category: categoryEnum.nullable(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  ref_low: z.number().nullable(),
  ref_high: z.number().nullable(),
  status: statusEnum,
  raw_label: z.string().nullable(),
})

export const microbiomeScoreExtractionSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  unit: z.string().nullable(),
  ref_low: z.number().nullable(),
  ref_high: z.number().nullable(),
  status: statusEnum,
  description: z.string().nullable(),
})

export const microbiomeExtractionSchema = z.object({
  test: z.object({
    name: z.string().min(1),
    test_date: z.string(),
    lab_name: z.string().nullable(),
    sample_type: z.string().nullable(),
  }),
  results: z.array(microbiomeResultExtractionSchema),
  scores: z.array(microbiomeScoreExtractionSchema),
})

export type MicrobiomeExtraction = z.infer<typeof microbiomeExtractionSchema>
export type MicrobiomeResultExtraction = z.infer<
  typeof microbiomeResultExtractionSchema
>
export type MicrobiomeScoreExtraction = z.infer<
  typeof microbiomeScoreExtractionSchema
>
