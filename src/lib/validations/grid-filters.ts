import { z } from 'zod'

export const gridFiltersSchema = z.object({
  search: z.string().optional(),
  categories: z.array(z.string()).optional(),
  status: z
    .array(z.enum(['normal', 'borderline', 'out-of-range', 'unknown']))
    .optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
})

export type GridFilters = z.infer<typeof gridFiltersSchema>
