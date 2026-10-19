import { z } from 'zod'

export const intakeSchema = z.object({
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 08:00'),
  amount: z
    .string()
    .max(100, 'Amount must be at most 100 characters')
    .nullable()
    .optional(),
})

/** Shared by create, update and the in-chat tools: at most 12 moments, each at a distinct time. */
export const intakesSchema = z
  .array(intakeSchema)
  .max(12, 'At most 12 intake moments per supplement')
  .refine((rows) => new Set(rows.map((r) => r.time)).size === rows.length, {
    message: 'You listed the same time twice — combine those moments into one',
  })
  .optional()

export const createSupplementSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(200, 'Name must be at most 200 characters'),
    dose: z
      .string()
      .max(100, 'Dose must be at most 100 characters')
      .optional(),
    intakes: intakesSchema,
    start_date: z.string().date('Please enter a valid date'),
    end_date: z
      .string()
      .date('Please enter a valid date')
      .nullable()
      .optional(),
    notes: z
      .string()
      .max(1000, 'Notes must be at most 1000 characters')
      .optional(),
  })
  .refine(
    (data) => !data.end_date || data.end_date >= data.start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] }
  )

export const updateSupplementSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(200, 'Name must be at most 200 characters')
      .optional(),
    dose: z
      .string()
      .max(100, 'Dose must be at most 100 characters')
      .nullable()
      .optional(),
    intakes: intakesSchema,
    start_date: z.string().date('Please enter a valid date').optional(),
    end_date: z
      .string()
      .date('Please enter a valid date')
      .nullable()
      .optional(),
    notes: z
      .string()
      .max(1000, 'Notes must be at most 1000 characters')
      .nullable()
      .optional(),
  })

export type CreateSupplementValues = z.infer<typeof createSupplementSchema>
export type UpdateSupplementValues = z.infer<typeof updateSupplementSchema>
export type IntakeValues = z.infer<typeof intakeSchema>
