import { z } from 'zod'

/**
 * Input for the "suggest a missing test" action. `labId` is the lab the test
 * belongs to (from page context, always present), and `url` is the test's
 * product page on that lab's own website. Both are required, so no empty-string
 * preprocessing is needed.
 */
export const labTestSuggestionSchema = z.object({
  labId: z.string().uuid('Invalid lab.'),
  url: z
    .string()
    .url('Enter a valid page URL (https://…).')
    .refine((u) => /^https?:\/\//i.test(u), 'Enter a valid page URL (https://…).'),
})

export type LabTestSuggestionInput = z.infer<typeof labTestSuggestionSchema>
