import { z } from 'zod'

export const createBiomarkerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  short_name: z
    .string()
    .max(20, 'Short name must be at most 20 characters')
    .optional(),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  panel_id: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().uuid('Invalid panel ID').optional()
  ),
  parent_id: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.string().uuid('Invalid parent ID').optional()
  ),
  variant_name: z
    .string()
    .max(50, 'Variant name must be at most 50 characters')
    .optional(),
  aliases: z.array(z.string()).optional(),
})

export const updateBiomarkerSchema = createBiomarkerSchema.partial()

export const createUnitSchema = z.object({
  biomarker_id: z.string().uuid('Invalid biomarker ID'),
  unit: z.string().min(1, 'Unit is required'),
  is_default: z.boolean().default(false),
  conversion_factor: z.number().positive('Must be a positive number'),
})

export const createRangeSchema = z.object({
  biomarker_id: z.string().uuid('Invalid biomarker ID'),
  unit: z.string().min(1, 'Unit is required'),
  sex: z.enum(['male', 'female', 'general']),
  age_min: z.number().int().min(0).nullable().optional(),
  age_max: z.number().int().min(0).nullable().optional(),
  range_low: z.number().nullable(),
  range_high: z.number().nullable(),
  source: z.string().min(1, 'Source is required'),
  range_type: z.enum(['normal', 'optimal']).default('normal'),
})

export const verifyRangeSchema = z.object({
  range_low: z.number().nullable(),
  range_high: z.number().nullable(),
  source: z.string().min(1, 'Source is required'),
  source_url: z.string().url('Must be a valid URL'),
})

export type CreateBiomarkerValues = z.infer<typeof createBiomarkerSchema>
export type UpdateBiomarkerValues = z.infer<typeof updateBiomarkerSchema>
export type CreateUnitValues = z.infer<typeof createUnitSchema>
export type CreateRangeValues = z.infer<typeof createRangeSchema>
export type VerifyRangeValues = z.infer<typeof verifyRangeSchema>
