import { z } from 'zod'

export const microbiomeTestSchema = z.object({
  name: z
    .string()
    .min(1, 'Test name is required')
    .max(200, 'Test name must be at most 200 characters'),
  test_date: z.string().date('Please enter a valid date'),
  lab_name: z
    .string()
    .max(120, 'Lab name must be at most 120 characters')
    .optional(),
  sample_type: z
    .string()
    .max(60, 'Sample type must be at most 60 characters')
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be at most 2000 characters')
    .optional(),
  pdf_storage_path: z.string().optional(),
})

export type MicrobiomeTestFormValues = z.infer<typeof microbiomeTestSchema>
