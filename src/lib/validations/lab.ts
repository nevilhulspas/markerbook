import { z } from 'zod'

/** Optional free-text field: trim, and treat blank as omitted. */
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined),
  z.string().max(80, 'Must be at most 80 characters').optional()
)

/** User lab suggestion: name + website (http/https) required; location optional. */
export const labSubmissionSchema = z.object({
  name: z
    .string()
    .min(1, 'Lab name is required')
    .max(120, 'Name must be at most 120 characters')
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, 'Lab name is required'),
  website: z
    .string()
    .min(1, 'Website is required')
    .transform((v) => v.trim())
    .refine((v) => {
      try {
        const u = new URL(v)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    }, 'Enter a valid website URL (https://…)'),
  country: optionalText,
  city: optionalText,
})

export type LabSubmissionValues = z.infer<typeof labSubmissionSchema>
