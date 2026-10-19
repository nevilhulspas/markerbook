import { z } from 'zod'

export const createAnnotationSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(200, 'Title must be at most 200 characters'),
    body: z
      .string()
      .max(2000, 'Body must be at most 2000 characters')
      .optional(),
    date: z.string().date('Please enter a valid date'),
    end_date: z
      .string()
      .date('Please enter a valid date')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => !data.end_date || data.end_date >= data.date,
    { message: 'End date must be on or after start date', path: ['end_date'] }
  )

export const updateAnnotationSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .max(200, 'Title must be at most 200 characters')
      .optional(),
    body: z
      .string()
      .max(2000, 'Body must be at most 2000 characters')
      .optional(),
    date: z.string().date('Please enter a valid date').optional(),
    end_date: z
      .string()
      .date('Please enter a valid date')
      .nullable()
      .optional(),
  })

export type CreateAnnotationValues = z.infer<typeof createAnnotationSchema>
export type UpdateAnnotationValues = z.infer<typeof updateAnnotationSchema>
