import { z } from 'zod'

export const dutchTestSchema = z.object({
  name: z
    .string()
    .min(1, 'Test name is required')
    .max(200, 'Test name must be at most 200 characters'),
  test_date: z.string().date('Please enter a valid date'),
  menstrual_phase: z
    .enum([
      'follicular',
      'luteal',
      'postmenopausal',
      'oral_progesterone',
      'oral_contraceptive',
      'male',
      'unknown',
    ])
    .nullable()
    .optional(),
  cycle_day: z.number().int().min(1).max(60).nullable().optional(),
  notes: z
    .string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional(),
  pdf_storage_path: z.string().optional(),
})

export type DutchTestFormValues = z.infer<typeof dutchTestSchema>

export const dutchMarkerEntrySchema = z.object({
  biomarker_id: z.string().uuid('Invalid biomarker'),
  value: z
    .number({ message: 'Value is required' })
    .nonnegative('Value must be zero or positive'),
  unit: z.string().min(1, 'Unit is required'),
  timepoint: z.enum(['waking', 'morning', 'afternoon', 'night', 'none']),
})

export const dutchTestWithMarkersSchema = dutchTestSchema.extend({
  markers: z
    .array(dutchMarkerEntrySchema)
    .min(1, 'Add at least one marker'),
})

export type DutchTestWithMarkersValues = z.infer<typeof dutchTestWithMarkersSchema>
export type DutchMarkerEntryValues = z.infer<typeof dutchMarkerEntrySchema>
