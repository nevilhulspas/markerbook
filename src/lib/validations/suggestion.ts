import { z } from 'zod'

export const BIOMARKER_CATEGORIES = [
  'Hematology',
  'Metabolic',
  'Lipid Panel',
  'Liver',
  'Kidney',
  'Thyroid',
  'Vitamins & Minerals',
  'Hormones',
  'Inflammation',
  'Cardiac',
  'Diabetes',
  'Electrolytes',
  'Iron Studies',
  'Immune',
  'Other',
] as const

export const suggestionSchema = z
  .object({
    type: z.enum(['marker', 'unit']),
    name: z
      .string()
      .min(1, 'Name is required')
      .max(200, 'Name must be at most 200 characters')
      .transform((v) => v.trim()),
    category: z.string().min(1, 'Category is required').optional(),
    details: z
      .string()
      .max(1000, 'Details must be at most 1000 characters')
      .optional(),
  })
  .refine(
    (data) => data.type !== 'marker' || (data.category && data.category.length > 0),
    {
      message: 'Category is required for marker suggestions',
      path: ['category'],
    }
  )

export type SuggestionValues = z.infer<typeof suggestionSchema>
